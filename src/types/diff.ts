import type { FolderCreatedEvent } from "../diff/events/folder-created";
import type { LinkCreatedEvent } from "../diff/events/link-created";

export type DiffEvent = LinkCreatedEvent | FolderCreatedEvent;

export type DiffDocument = {
  schema_version: 1;
  id: number;
  ts: string;
  event: DiffEvent;
};

export type DiffState = {
  lastSeq: number;
  lastDeliveredDiffId: number;
  initializedAt: string;
  lastHeartbeatAt: string;
  lastEventAt: string;
  lastError: string;
};
