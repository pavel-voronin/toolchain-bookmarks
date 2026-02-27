import type { CanonicalLinkNode } from "../../types/canonical";
import type { FlatNode } from "../../types/bookmarks";

export type LinkCreatedEvent = {
  type: "link_created";
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

export function collectLinkCreatedEvents(
  prev: Map<string, FlatNode>,
  curr: Map<string, FlatNode>,
): LinkCreatedEvent[] {
  const events: LinkCreatedEvent[] = [];

  for (const [id, node] of curr) {
    if (node.type !== "link" || prev.has(id)) {
      continue;
    }

    events.push({
      type: "link_created",
      payload: toCanonicalLink(node),
    });
  }

  return events;
}
