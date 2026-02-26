import type { FolderCreatedInInboxEvent } from "../diff/events/folder-created-in-inbox";
import type { LinkCreatedInInboxEvent } from "../diff/events/link-created-in-inbox";

export type DiffEvent = LinkCreatedInInboxEvent | FolderCreatedInInboxEvent;

export type DiffDocument = {
  schema_version: 1;
  id: number;
  ts: string;
  event: DiffEvent;
};

export type DiffState = {
  lastSeq: number;
  lastSnapshotPath: string;
  lastSnapshotHash: string;
  lastRunAt: string;
  lastDeliveredDiffId: number;
};
