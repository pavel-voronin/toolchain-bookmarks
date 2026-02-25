import type {
  CanonicalBookmarkNode,
  CanonicalFolderNode,
  CanonicalLinkNode,
} from "../types/canonical";

type BookmarkTreeNode = {
  id?: string;
  title?: string;
  index?: number;
  parentId?: string;
  url?: string;
  children?: BookmarkTreeNode[];
  dateAdded?: number;
  dateGroupModified?: number;
  dateLastUsed?: number;
  folderType?: "bookmarks-bar" | "other" | "mobile" | "managed";
  syncing?: boolean;
  unmodifiable?: "managed";
};

function isBookmarkNode(value: unknown): value is BookmarkTreeNode {
  if (!value || typeof value !== "object") {
    return false;
  }
  const node = value as BookmarkTreeNode;
  return typeof node.id === "string" && typeof node.title === "string";
}

function joinPath(parentPath: string | undefined, title: string): string {
  if (!parentPath || parentPath === "/") {
    return `/${title}`;
  }
  return `${parentPath}/${title}`;
}

function mapNode(
  node: BookmarkTreeNode,
  pathIndex: Map<string, string>,
  parentPath: string | undefined,
): CanonicalBookmarkNode {
  const type: "folder" | "link" =
    typeof node.url === "string" ? "link" : "folder";
  const title = node.title ?? "";
  const indexedPath = node.id ? pathIndex.get(node.id) : undefined;
  const path =
    indexedPath ?? (title ? joinPath(parentPath, title) : parentPath);

  if (type === "link") {
    const link: CanonicalLinkNode = {
      id: node.id ?? "",
      type: "link",
      title,
      url: node.url ?? "",
    };

    if (typeof node.parentId === "string") link.parentId = node.parentId;
    if (typeof node.index === "number") link.index = node.index;
    if (typeof node.dateAdded === "number") link.dateAdded = node.dateAdded;
    if (typeof node.dateLastUsed === "number")
      link.dateLastUsed = node.dateLastUsed;
    if (typeof node.syncing === "boolean") link.syncing = node.syncing;
    if (typeof path === "string" && path.length > 0) link.path = path;
    return link;
  }

  const folder: CanonicalFolderNode = {
    id: node.id ?? "",
    type: "folder",
    title,
  };

  if (typeof node.parentId === "string") folder.parentId = node.parentId;
  if (typeof node.index === "number") folder.index = node.index;
  if (typeof node.dateAdded === "number") folder.dateAdded = node.dateAdded;
  if (typeof node.dateGroupModified === "number")
    folder.dateGroupModified = node.dateGroupModified;
  if (typeof node.folderType === "string") folder.folderType = node.folderType;
  if (typeof node.syncing === "boolean") folder.syncing = node.syncing;
  if (typeof node.unmodifiable === "string")
    folder.unmodifiable = node.unmodifiable;
  if (typeof path === "string" && path.length > 0) folder.path = path;

  if (Array.isArray(node.children)) {
    folder.children = node.children
      .filter((child) => isBookmarkNode(child))
      .map((child) => mapNode(child, pathIndex, path));
  }

  return folder;
}

function collectPaths(
  nodes: BookmarkTreeNode[],
  index: Map<string, string>,
  parentPath: string,
): void {
  for (const node of nodes) {
    if (!isBookmarkNode(node)) {
      continue;
    }

    const title = node.title ?? "";
    const currentPath = title ? joinPath(parentPath, title) : parentPath;
    if (node.id) {
      index.set(node.id, currentPath);
    }

    if (Array.isArray(node.children)) {
      collectPaths(node.children, index, currentPath);
    }
  }
}

export function buildPathIndexFromTree(
  treePayload: unknown,
): Map<string, string> {
  const index = new Map<string, string>();
  if (!Array.isArray(treePayload)) {
    return index;
  }

  const roots = treePayload.filter((node) => isBookmarkNode(node));
  collectPaths(roots, index, "/");
  return index;
}

export function toCanonicalWithPathIndex(
  value: unknown,
  pathIndex: Map<string, string>,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => toCanonicalWithPathIndex(item, pathIndex));
  }

  if (!isBookmarkNode(value)) {
    return value;
  }

  return mapNode(value, pathIndex, undefined);
}
