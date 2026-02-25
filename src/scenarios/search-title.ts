import type { RuntimeConfig } from '../types/config';
import { fetchCanonicalTree, flattenCanonical } from './common';

export async function runSearchTitle(config: RuntimeConfig, needle: string): Promise<unknown> {
  const query = needle.trim().toLowerCase();
  const tree = await fetchCanonicalTree(config);
  const nodes = flattenCanonical(tree);

  return nodes.filter(
    (node) => node.type === 'link' && node.title.toLowerCase().includes(query)
  );
}
