export type BookmarkNode = {
  id?: string;
  parentId?: string;
  index?: number;
  name?: string;
  title?: string;
  url?: string;
  date_added?: string;
  dateAdded?: string;
  date_group_modified?: string;
  dateGroupModified?: string;
  children?: BookmarkNode[];
};

export type FlatNode = {
  id: string;
  type: 'folder' | 'link';
  title: string;
  url: string | null;
  parentId: string | null;
  index: number;
  path: string;
  folderId: string | null;
  folderTitle: string | null;
  folderPath: string | null;
};
