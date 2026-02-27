import type { FlatNode } from "../../types/bookmarks";
import type { RuntimeConfig } from "../../types/config";
import type { DiffEvent } from "../../types/diff";
import { collectFolderCreatedEvents } from "./folder-created";
import { collectLinkCreatedEvents } from "./link-created";

export function buildEvents(
  prev: Map<string, FlatNode>,
  curr: Map<string, FlatNode>,
  _config: RuntimeConfig,
): DiffEvent[] {
  return [
    ...collectLinkCreatedEvents(prev, curr),
    ...collectFolderCreatedEvents(prev, curr),
  ];
}
