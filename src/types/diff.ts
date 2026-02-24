export type DiffEvent = {
  type: 'link_created_in_inbox' | 'link_created_anywhere' | 'node_moved';
  bookmark_id: string;
  node_type: 'folder' | 'link';
  url: string | null;
  title: string;
  folder_id: string | null;
  folder_name: string | null;
  folder_path: string | null;
  old_parent_id?: string | null;
  new_parent_id?: string | null;
  old_index?: number;
  new_index?: number;
  old_path?: string;
  new_path?: string;
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
