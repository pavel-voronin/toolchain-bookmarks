import type { FlatNode } from "../../types/bookmarks";
import type { DiffEvent } from "../../types/diff";
import { collectFolderCreatedEvents } from "./folder-created";
import { collectLinkCreatedEvents } from "./link-created";

export function buildEvents(
  prev: Map<string, FlatNode>,
  curr: Map<string, FlatNode>,
): DiffEvent[] {
  return [
    ...collectLinkCreatedEvents(prev, curr),
    ...collectFolderCreatedEvents(prev, curr),
  ];
}
