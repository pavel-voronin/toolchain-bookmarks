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
  type: "folder";
  children?: CanonicalBookmarkNode[];
  dateGroupModified?: number;
  folderType?: "bookmarks-bar" | "other" | "mobile" | "managed";
  unmodifiable?: "managed";
};

export type CanonicalLinkNode = CanonicalNodeBase & {
  type: "link";
  url: string;
  dateLastUsed?: number;
};

export type CanonicalBookmarkNode = CanonicalFolderNode | CanonicalLinkNode;

export function isCanonicalBookmarkNode(
  value: unknown,
): value is CanonicalBookmarkNode {
  if (!value || typeof value !== "object") {
    return false;
  }

  const node = value as Record<string, unknown>;
  if (typeof node.id !== "string" || typeof node.title !== "string") {
    return false;
  }

  if (node.type === "link") {
    return typeof node.url === "string";
  }

  if (node.type === "folder") {
    if (node.children === undefined) {
      return true;
    }
    if (!Array.isArray(node.children)) {
      return false;
    }
    return node.children.every((child) => isCanonicalBookmarkNode(child));
  }

  return false;
}
