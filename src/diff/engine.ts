import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ensureDir, readJsonFile, writeJsonFile } from "../utils/fs";
import { normalizeBookmarks, readBookmarksJson } from "./bookmarks-model";
import type { AppPaths, RuntimeConfig } from "../types/config";
import type { DiffDocument, DiffState } from "../types/diff";
import { buildEvents } from "./events";

function nowIso(): string {
  return new Date().toISOString();
}

function hashContent(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function snapshotName(ts: string): string {
  return ts.replace(/[:.]/g, "-").replace(/Z$/, "Z.json");
}

function readState(paths: AppPaths): DiffState {
  if (!fs.existsSync(paths.stateFile)) {
    return {
      lastSeq: 0,
      lastSnapshotPath: "",
      lastSnapshotHash: "",
      lastRunAt: "",
      lastDeliveredDiffId: 0,
    };
  }
  const parsed = readJsonFile<Partial<DiffState>>(paths.stateFile);
  return {
    lastSeq: parsed.lastSeq ?? 0,
    lastSnapshotPath: parsed.lastSnapshotPath ?? "",
    lastSnapshotHash: parsed.lastSnapshotHash ?? "",
    lastRunAt: parsed.lastRunAt ?? "",
    lastDeliveredDiffId: parsed.lastDeliveredDiffId ?? 0,
  };
}

function writeState(paths: AppPaths, state: DiffState): void {
  ensureDir(paths.stateDir);
  writeJsonFile(paths.stateFile, state);
}

function listDiffIds(diffsDir: string): number[] {
  if (!fs.existsSync(diffsDir)) {
    return [];
  }
  return fs
    .readdirSync(diffsDir)
    .map((name) =>
      /^(\d+)\.json$/.test(name)
        ? Number.parseInt(name.split(".")[0], 10)
        : NaN,
    )
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

function readNextDiff(diffsDir: string, sinceId: number): DiffDocument | null {
  const nextId = listDiffIds(diffsDir).find((id) => id > sinceId);
  if (!nextId) {
    return null;
  }
  const file = path.join(diffsDir, `${String(nextId).padStart(12, "0")}.json`);
  return readJsonFile<DiffDocument>(file);
}

export function makeDiff(
  paths: AppPaths,
  config: RuntimeConfig,
): {
  initialized: boolean;
  wroteDiff: boolean;
  diffId: number | null;
  eventCount: number;
  reason?: string;
} {
  ensureDir(paths.snapshotsDir);
  ensureDir(paths.diffsDir);
  ensureDir(paths.stateDir);

  const raw = fs.readFileSync(config.BOOKMARKS_FILE, "utf8");
  const currentJson = JSON.parse(raw);
  const currentHash = hashContent(raw);
  const ts = nowIso();
  const state = readState(paths);
  const currentSnapshotPath = path.join(paths.snapshotsDir, snapshotName(ts));

  if (!state.lastSnapshotPath || !fs.existsSync(state.lastSnapshotPath)) {
    writeJsonFile(currentSnapshotPath, currentJson);
    writeState(paths, {
      ...state,
      lastSnapshotPath: currentSnapshotPath,
      lastSnapshotHash: currentHash,
      lastRunAt: ts,
    });
    return {
      initialized: true,
      wroteDiff: false,
      diffId: null,
      eventCount: 0,
      reason: "first_snapshot",
    };
  }

  if (state.lastSnapshotHash === currentHash) {
    writeState(paths, { ...state, lastRunAt: ts });
    return {
      initialized: false,
      wroteDiff: false,
      diffId: null,
      eventCount: 0,
      reason: "no_changes",
    };
  }

  const previousJson = readJsonFile<unknown>(state.lastSnapshotPath);
  const events = buildEvents(
    normalizeBookmarks(previousJson),
    normalizeBookmarks(currentJson),
    config,
  );
  writeJsonFile(currentSnapshotPath, currentJson);

  let diffId: number | null = null;
  if (events.length > 0) {
    for (const [offset, event] of events.entries()) {
      const nextId = state.lastSeq + offset + 1;
      const diffDoc: DiffDocument = {
        schema_version: 1,
        id: nextId,
        ts,
        event,
      };
      const diffPath = path.join(
        paths.diffsDir,
        `${String(nextId).padStart(12, "0")}.json`,
      );
      writeJsonFile(diffPath, diffDoc);
      diffId = nextId;
    }
  }

  writeState(paths, {
    lastSeq: diffId ?? state.lastSeq,
    lastSnapshotPath: currentSnapshotPath,
    lastSnapshotHash: currentHash,
    lastRunAt: ts,
    lastDeliveredDiffId: state.lastDeliveredDiffId,
  });

  return {
    initialized: false,
    wroteDiff: Boolean(diffId),
    diffId,
    eventCount: events.length,
  };
}

export function readNextDiffFromCursor(
  paths: AppPaths,
  diffsDir: string,
): DiffDocument | null {
  ensureDir(paths.stateDir);
  const state = readState(paths);
  const next = readNextDiff(diffsDir, state.lastDeliveredDiffId);
  if (!next) {
    return null;
  }
  writeState(paths, { ...state, lastDeliveredDiffId: next.id });
  return next;
}

export function validateBookmarksFile(config: RuntimeConfig): {
  ok: boolean;
  error?: string;
} {
  try {
    readBookmarksJson(config);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
