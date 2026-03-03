import fs from "node:fs";
import path from "node:path";
import { ensureDir, readJsonFile, writeJsonFile } from "../utils/fs";
import type { AppPaths } from "../types/config";
import type { CanonicalBookmarkNode } from "../types/canonical";
import type { DiffDocument, DiffEvent, DiffState } from "../types/diff";
import { flattenCanonicalTree } from "./canonical-model";
import { buildEvents } from "./events";

function nowIso(): string {
  return new Date().toISOString();
}

const EMPTY_STATE: DiffState = {
  lastSeq: 0,
  lastDeliveredDiffId: 0,
  initializedAt: "",
  lastHeartbeatAt: "",
  lastEventAt: "",
  lastError: "",
};

function readState(paths: AppPaths): DiffState {
  if (!fs.existsSync(paths.stateFile)) {
    return { ...EMPTY_STATE };
  }
  const parsed = readJsonFile<Partial<DiffState>>(paths.stateFile);
  return {
    lastSeq: parsed.lastSeq ?? 0,
    lastDeliveredDiffId: parsed.lastDeliveredDiffId ?? 0,
    initializedAt: parsed.initializedAt ?? "",
    lastHeartbeatAt: parsed.lastHeartbeatAt ?? "",
    lastEventAt: parsed.lastEventAt ?? "",
    lastError: parsed.lastError ?? "",
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
        : Number.NaN,
    )
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

function maxDiffId(diffsDir: string): number {
  const ids = listDiffIds(diffsDir);
  return ids.length > 0 ? (ids[ids.length - 1] ?? 0) : 0;
}

function readNextDiff(diffsDir: string, sinceId: number): DiffDocument | null {
  const nextId = listDiffIds(diffsDir).find((id) => id > sinceId);
  if (!nextId) {
    return null;
  }
  const file = path.join(diffsDir, `${String(nextId).padStart(12, "0")}.json`);
  return readJsonFile<DiffDocument>(file);
}

export function loadBaseline(paths: AppPaths): CanonicalBookmarkNode[] | null {
  if (!fs.existsSync(paths.baselineFile)) {
    return null;
  }
  return readJsonFile<CanonicalBookmarkNode[]>(paths.baselineFile);
}

export function storeBaseline(paths: AppPaths, tree: CanonicalBookmarkNode[]): void {
  ensureDir(paths.stateDir);
  writeJsonFile(paths.baselineFile, tree);
}

export function appendDiffEvent(
  paths: AppPaths,
  event: DiffEvent,
  ts = nowIso(),
): DiffDocument {
  ensureDir(paths.diffsDir);
  ensureDir(paths.stateDir);

  const state = readState(paths);
  const nextId =
    Math.max(state.lastSeq, state.lastDeliveredDiffId, maxDiffId(paths.diffsDir)) +
    1;
  const doc: DiffDocument = {
    schema_version: 1,
    id: nextId,
    ts,
    event,
  };

  const diffPath = path.join(paths.diffsDir, `${String(nextId).padStart(12, "0")}.json`);
  writeJsonFile(diffPath, doc);

  writeState(paths, {
    ...state,
    lastSeq: nextId,
    initializedAt: state.initializedAt || ts,
    lastEventAt: ts,
    lastHeartbeatAt: ts,
  });

  return doc;
}

export function updateHeartbeat(paths: AppPaths, error?: string): DiffState {
  ensureDir(paths.stateDir);
  const state = readState(paths);
  const ts = nowIso();
  const next: DiffState = {
    ...state,
    initializedAt: state.initializedAt || ts,
    lastHeartbeatAt: ts,
    ...(error !== undefined ? { lastError: error } : {}),
  };
  writeState(paths, next);
  return next;
}

export function reconcileFromTree(
  paths: AppPaths,
  tree: CanonicalBookmarkNode[],
): {
  initialized: boolean;
  wroteDiff: boolean;
  diffId: number | null;
  eventCount: number;
  reason?: string;
} {
  ensureDir(paths.diffsDir);
  ensureDir(paths.stateDir);

  const state = readState(paths);
  const ts = nowIso();
  const prevBaseline = loadBaseline(paths);

  if (!prevBaseline) {
    storeBaseline(paths, tree);
    writeState(paths, {
      ...state,
      initializedAt: state.initializedAt || ts,
      lastHeartbeatAt: ts,
    });
    return {
      initialized: true,
      wroteDiff: false,
      diffId: null,
      eventCount: 0,
      reason: "first_baseline",
    };
  }

  const prev = flattenCanonicalTree(prevBaseline);
  const curr = flattenCanonicalTree(tree);
  const events = buildEvents(prev, curr);

  let diffId: number | null = null;
  events.forEach((event) => {
    const doc = appendDiffEvent(paths, event, ts);
    diffId = doc.id;
  });

  storeBaseline(paths, tree);

  const nextState = readState(paths);
  writeState(paths, {
    ...nextState,
    initializedAt: nextState.initializedAt || ts,
    lastHeartbeatAt: ts,
  });

  return {
    initialized: false,
    wroteDiff: events.length > 0,
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

export function readServiceState(paths: AppPaths): DiffState {
  ensureDir(paths.stateDir);
  return readState(paths);
}
