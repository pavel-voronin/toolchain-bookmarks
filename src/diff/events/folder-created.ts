import type { CanonicalFolderNode } from "../../types/canonical";
import type { FlatNode } from "../../types/bookmarks";

export type FolderCreatedEvent = {
  type: "folder_created";
  payload: CanonicalFolderNode;
};

function toCanonicalFolder(node: FlatNode): CanonicalFolderNode {
  return {
    id: node.id,
    type: "folder",
    title: node.title,
    parentId: node.parentId ?? undefined,
    index: node.index,
    path: node.path,
  };
}

export function collectFolderCreatedEvents(
  prev: Map<string, FlatNode>,
  curr: Map<string, FlatNode>,
): FolderCreatedEvent[] {
  const events: FolderCreatedEvent[] = [];

  for (const [id, node] of curr) {
    if (node.type !== "folder" || prev.has(id)) {
      continue;
    }

    events.push({
      type: "folder_created",
      payload: toCanonicalFolder(node),
    });
  }

  return events;
}
