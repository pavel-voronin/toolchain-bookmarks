import { normalizeBookmarks, readBookmarksJson, isInboxNode } from '../diff/bookmarks-model';
import type { RuntimeConfig } from '../types/config';

export function runInboxLinks(config: RuntimeConfig): unknown {
  const nodes = Array.from(normalizeBookmarks(readBookmarksJson(config)).values());
  return nodes.filter((node) => node.nodeType === 'link' && isInboxNode(node, config));
}
