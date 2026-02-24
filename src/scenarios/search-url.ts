import { normalizeBookmarks, readBookmarksJson } from '../diff/bookmarks-model';
import type { RuntimeConfig } from '../types/config';

export function runSearchUrl(config: RuntimeConfig, needle: string): unknown {
  const query = needle.toLowerCase();
  const nodes = Array.from(normalizeBookmarks(readBookmarksJson(config)).values());
  return nodes.filter((node) => node.nodeType === 'link' && (node.url ?? '').toLowerCase().includes(query));
}
