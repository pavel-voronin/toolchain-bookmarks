import type { CanonicalLinkNode } from "../../types/canonical";
import type { FlatNode } from "../../types/bookmarks";
import type { RuntimeConfig } from "../../types/config";
import { isInboxNode } from "../bookmarks-model";

export type LinkCreatedInInboxEvent = {
  type: "link_created_in_inbox";
  payload: CanonicalLinkNode;
};

function toCanonicalLink(node: FlatNode): CanonicalLinkNode {
  return {
    id: node.id,
    type: "link",
    title: node.title,
    url: node.url ?? "",
    parentId: node.parentId ?? undefined,
    index: node.index,
    path: node.path,
  };
}

export function collectLinkCreatedInInboxEvents(
  prev: Map<string, FlatNode>,
  curr: Map<string, FlatNode>,
  config: RuntimeConfig,
): LinkCreatedInInboxEvent[] {
  const events: LinkCreatedInInboxEvent[] = [];

  for (const [id, node] of curr) {
    if (node.type !== "link" || prev.has(id) || !isInboxNode(node, config)) {
      continue;
    }

    events.push({
      type: "link_created_in_inbox",
      payload: toCanonicalLink(node),
    });
  }

  return events;
}
