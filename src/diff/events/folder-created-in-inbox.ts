import type { CanonicalFolderNode } from "../../types/canonical";
import type { FlatNode } from "../../types/bookmarks";
import type { RuntimeConfig } from "../../types/config";
import { isInboxNode } from "../bookmarks-model";

export type FolderCreatedInInboxEvent = {
  type: "folder_created_in_inbox";
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

export function collectFolderCreatedInInboxEvents(
  prev: Map<string, FlatNode>,
  curr: Map<string, FlatNode>,
  config: RuntimeConfig,
): FolderCreatedInInboxEvent[] {
  const events: FolderCreatedInInboxEvent[] = [];

  for (const [id, node] of curr) {
    if (node.type !== "folder" || prev.has(id) || !isInboxNode(node, config)) {
      continue;
    }

    events.push({
      type: "folder_created_in_inbox",
      payload: toCanonicalFolder(node),
    });
  }

  return events;
}
