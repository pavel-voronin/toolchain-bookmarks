export type DiffEvent = {
  type: 'link_created_in_inbox' | 'link_created_anywhere' | 'node_moved';
  id: string;
  nodeType: 'folder' | 'link';
  url: string | null;
  title: string;
  path: string;
  parentId: string | null;
  index: number;
  folderId: string | null;
  folderTitle: string | null;
  folderPath: string | null;
  oldParentId?: string | null;
  newParentId?: string | null;
  oldIndex?: number;
  newIndex?: number;
  oldPath?: string;
  newPath?: string;
};

export type DiffDocument = {
  schema_version: 1;
  id: number;
  ts: string;
  events: DiffEvent[];
};

export type DiffState = {
  lastSeq: number;
  lastSnapshotPath: string;
  lastSnapshotHash: string;
  lastRunAt: string;
  lastDeliveredDiffId: number;
};
