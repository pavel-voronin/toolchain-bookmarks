import type { BookmarksApiStreamEvent } from "../api/bridge";
import type { CanonicalBookmarkNode, CanonicalFolderNode, CanonicalLinkNode } from "../types/canonical";
import type { DiffEvent } from "../types/diff";

function toStringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function toNumberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function buildPath(parentPath: string | undefined, title: string): string | undefined {
  if (!title) {
    return parentPath;
  }
  if (!parentPath || parentPath === "/") {
    return `/${title}`;
  }
  return `${parentPath}/${title}`;
}

function asCreatedNode(args: unknown[]): Record<string, unknown> | null {
  const node = args[1];
  if (!node || typeof node !== "object") {
    return null;
  }
  return node as Record<string, unknown>;
}

export function toDomainEvent(
  event: BookmarksApiStreamEvent,
  parentPathById: Map<string, string>,
): DiffEvent | null {
  if (event.eventName !== "onCreated") {
    return null;
  }

  const node = asCreatedNode(event.args);
  if (!node) {
    return null;
  }

  const id = toStringOrUndefined(node.id);
  const title = toStringOrUndefined(node.title) ?? "";
  if (!id) {
    return null;
  }

  const parentId = toStringOrUndefined(node.parentId);
  const parentPath = parentId ? parentPathById.get(parentId) : undefined;
  const path = buildPath(parentPath, title);

  if (typeof node.url === "string" && node.url.length > 0) {
    const payload: CanonicalLinkNode = {
      id,
      type: "link",
      title,
      url: node.url,
      ...(parentId ? { parentId } : {}),
      ...(toNumberOrUndefined(node.index) !== undefined
        ? { index: toNumberOrUndefined(node.index) }
        : {}),
      ...(path ? { path } : {}),
      ...(toNumberOrUndefined(node.dateAdded) !== undefined
        ? { dateAdded: toNumberOrUndefined(node.dateAdded) }
        : {}),
      ...(typeof node.syncing === "boolean" ? { syncing: node.syncing } : {}),
    };
    return { type: "link_created", payload };
  }

  const payload: CanonicalFolderNode = {
    id,
    type: "folder",
    title,
    ...(parentId ? { parentId } : {}),
    ...(toNumberOrUndefined(node.index) !== undefined
      ? { index: toNumberOrUndefined(node.index) }
      : {}),
    ...(path ? { path } : {}),
    ...(toNumberOrUndefined(node.dateAdded) !== undefined
      ? { dateAdded: toNumberOrUndefined(node.dateAdded) }
      : {}),
    ...(typeof node.syncing === "boolean" ? { syncing: node.syncing } : {}),
  };
  return { type: "folder_created", payload };
}

export function seedParentPathIndex(tree: CanonicalBookmarkNode[]): Map<string, string> {
  const out = new Map<string, string>();

  const walk = (node: CanonicalBookmarkNode, parentPath: string): void => {
    const title = node.title ?? "";
    const path = node.path ?? (parentPath ? `${parentPath}/${title}` : `/${title}`);
    out.set(node.id, path);

    if (node.type !== "folder") {
      return;
    }
    const children = Array.isArray(node.children) ? node.children : [];
    children.forEach((child) => walk(child, path));
  };

  tree.forEach((root) => walk(root, ""));
  return out;
}

