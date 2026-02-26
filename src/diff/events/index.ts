import type { FlatNode } from "../../types/bookmarks";
import type { RuntimeConfig } from "../../types/config";
import type { DiffEvent } from "../../types/diff";
import { collectFolderCreatedInInboxEvents } from "./folder-created-in-inbox";
import { collectLinkCreatedInInboxEvents } from "./link-created-in-inbox";

export function buildEvents(
  prev: Map<string, FlatNode>,
  curr: Map<string, FlatNode>,
  config: RuntimeConfig,
): DiffEvent[] {
  return [
    ...collectLinkCreatedInInboxEvents(prev, curr, config),
    ...collectFolderCreatedInInboxEvents(prev, curr, config),
  ];
}
