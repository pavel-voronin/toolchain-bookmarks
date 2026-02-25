import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, readJsonFile, writeJsonFile } from '../utils/fs';
import { normalizeBookmarks, readBookmarksJson, isInboxNode } from './bookmarks-model';
import type { FlatNode } from '../types/bookmarks';
import type { AppPaths, RuntimeConfig } from '../types/config';
import type { DiffDocument, DiffEvent, DiffState } from '../types/diff';

function nowIso(): string {
  return new Date().toISOString();
}

function hashContent(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function snapshotName(ts: string): string {
  return ts.replace(/[:.]/g, '-').replace(/Z$/, 'Z.json');
}

function readState(paths: AppPaths): DiffState {
  if (!fs.existsSync(paths.stateFile)) {
    return { lastSeq: 0, lastSnapshotPath: '', lastSnapshotHash: '', lastRunAt: '', lastDeliveredDiffId: 0 };
  }
  const parsed = readJsonFile<Partial<DiffState>>(paths.stateFile);
  return {
    lastSeq: parsed.lastSeq ?? 0,
    lastSnapshotPath: parsed.lastSnapshotPath ?? '',
    lastSnapshotHash: parsed.lastSnapshotHash ?? '',
    lastRunAt: parsed.lastRunAt ?? '',
    lastDeliveredDiffId: parsed.lastDeliveredDiffId ?? 0
  };
}

function writeState(paths: AppPaths, state: DiffState): void {
  ensureDir(paths.stateDir);
  writeJsonFile(paths.stateFile, state);
}

export function listDiffIds(diffsDir: string): number[] {
  if (!fs.existsSync(diffsDir)) {
    return [];
  }
  return fs
    .readdirSync(diffsDir)
    .map((name) => (/^(\d+)\.json$/.test(name) ? Number.parseInt(name.split('.')[0], 10) : NaN))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

export function readNextDiff(diffsDir: string, sinceId: number): DiffDocument | null {
  const nextId = listDiffIds(diffsDir).find((id) => id > sinceId);
  if (!nextId) {
    return null;
  }
  const file = path.join(diffsDir, `${String(nextId).padStart(12, '0')}.json`);
  return readJsonFile<DiffDocument>(file);
}

function buildEvents(prev: Map<string, FlatNode>, curr: Map<string, FlatNode>, config: RuntimeConfig): DiffEvent[] {
  const events: DiffEvent[] = [];

  for (const [id, node] of curr) {
    if (node.type !== 'link' || prev.has(id)) {
      continue;
    }
    if (isInboxNode(node, config)) {
      events.push({
        type: 'link_created_in_inbox',
        id,
        nodeType: 'link',
        url: node.url,
        title: node.title,
        path: node.path,
        parentId: node.parentId,
        index: node.index,
        folderId: node.folderId,
        folderTitle: node.folderTitle,
        folderPath: node.folderPath
      });
    }
    events.push({
      type: 'link_created_anywhere',
      id,
      nodeType: 'link',
      url: node.url,
      title: node.title,
      path: node.path,
      parentId: node.parentId,
      index: node.index,
      folderId: node.folderId,
      folderTitle: node.folderTitle,
      folderPath: node.folderPath
    });
  }

  for (const [id, node] of curr) {
    const old = prev.get(id);
    if (!old) {
      continue;
    }
    if (old.parentId === node.parentId && old.index === node.index) {
      continue;
    }
    events.push({
      type: 'node_moved',
      id,
      nodeType: node.type,
      url: node.url,
      title: node.title,
      path: node.path,
      parentId: node.parentId,
      index: node.index,
      folderId: node.folderId,
      folderTitle: node.folderTitle,
      folderPath: node.folderPath,
      oldParentId: old.parentId,
      newParentId: node.parentId,
      oldIndex: old.index,
      newIndex: node.index,
      oldPath: old.path,
      newPath: node.path
    });
  }

  return events;
}

export function makeDiff(paths: AppPaths, config: RuntimeConfig): {
  initialized: boolean;
  wroteDiff: boolean;
  diffId: number | null;
  eventCount: number;
  reason?: string;
} {
  ensureDir(paths.snapshotsDir);
  ensureDir(paths.diffsDir);
  ensureDir(paths.stateDir);

  const raw = fs.readFileSync(config.BOOKMARKS_FILE, 'utf8');
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
      lastRunAt: ts
    });
    return { initialized: true, wroteDiff: false, diffId: null, eventCount: 0, reason: 'first_snapshot' };
  }

  if (state.lastSnapshotHash === currentHash) {
    writeState(paths, { ...state, lastRunAt: ts });
    return { initialized: false, wroteDiff: false, diffId: null, eventCount: 0, reason: 'no_changes' };
  }

  const previousJson = readJsonFile<unknown>(state.lastSnapshotPath);
  const events = buildEvents(normalizeBookmarks(previousJson), normalizeBookmarks(currentJson), config);
  writeJsonFile(currentSnapshotPath, currentJson);

  let diffId: number | null = null;
  if (events.length > 0) {
    diffId = state.lastSeq + 1;
    const diffDoc: DiffDocument = { schema_version: 1, id: diffId, ts, events };
    const diffPath = path.join(paths.diffsDir, `${String(diffId).padStart(12, '0')}.json`);
    writeJsonFile(diffPath, diffDoc);
  }

  writeState(paths, {
    lastSeq: diffId ?? state.lastSeq,
    lastSnapshotPath: currentSnapshotPath,
    lastSnapshotHash: currentHash,
    lastRunAt: ts,
    lastDeliveredDiffId: state.lastDeliveredDiffId
  });

  return {
    initialized: false,
    wroteDiff: Boolean(diffId),
    diffId,
    eventCount: events.length
  };
}

export function readNextDiffFromCursor(paths: AppPaths, diffsDir: string): DiffDocument | null {
  ensureDir(paths.stateDir);
  const state = readState(paths);
  const next = readNextDiff(diffsDir, state.lastDeliveredDiffId);
  if (!next) {
    return null;
  }
  writeState(paths, { ...state, lastDeliveredDiffId: next.id });
  return next;
}

export function listLastDiffId(diffsDir: string): number {
  const ids = listDiffIds(diffsDir);
  return ids.length > 0 ? ids[ids.length - 1] : 0;
}

export function validateBookmarksFile(config: RuntimeConfig): { ok: boolean; error?: string } {
  try {
    readBookmarksJson(config);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
