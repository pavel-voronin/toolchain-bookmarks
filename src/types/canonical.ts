export type CanonicalNodeBase = {
  id: string;
  title: string;
  parentId?: string;
  index?: number;
  dateAdded?: number;
  syncing?: boolean;
  path?: string;
};

export type CanonicalFolderNode = CanonicalNodeBase & {
  type: 'folder';
  children?: CanonicalBookmarkNode[];
  dateGroupModified?: number;
  folderType?: 'bookmarks-bar' | 'other' | 'mobile' | 'managed';
  unmodifiable?: 'managed';
};

export type CanonicalLinkNode = CanonicalNodeBase & {
  type: 'link';
  url: string;
  dateLastUsed?: number;
};

export type CanonicalBookmarkNode = CanonicalFolderNode | CanonicalLinkNode;

export function isCanonicalFolderNode(node: CanonicalBookmarkNode): node is CanonicalFolderNode {
  return node.type === 'folder';
}

export function isCanonicalLinkNode(node: CanonicalBookmarkNode): node is CanonicalLinkNode {
  return node.type === 'link';
}
