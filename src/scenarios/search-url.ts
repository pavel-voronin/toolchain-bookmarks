import type { RuntimeConfig } from '../types/config';
import { fetchCanonicalTree, flattenCanonical } from './common';

export async function runSearchUrl(config: RuntimeConfig, needle: string): Promise<unknown> {
  const query = needle.trim().toLowerCase();
  const tree = await fetchCanonicalTree(config);
  const nodes = flattenCanonical(tree);

  return nodes.filter(
    (node) =>
      node.type === 'link' &&
      typeof node.url === 'string' &&
      node.url.toLowerCase().includes(query)
  );
}
