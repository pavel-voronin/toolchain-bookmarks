import { callBookmarksApi } from '../api/bridge';
import { buildPathIndexFromTree, toCanonicalWithPathIndex } from '../api/canonical';
import type { RuntimeConfig } from '../types/config';
import type { CanonicalBookmarkNode } from '../types/canonical';

export async function fetchCanonicalTree(config: RuntimeConfig): Promise<CanonicalBookmarkNode[]> {
  const tree = await callBookmarksApi(config, 'getTree', []);
  const pathIndex = buildPathIndexFromTree(tree);
  return toCanonicalWithPathIndex(tree, pathIndex) as CanonicalBookmarkNode[];
}

export function flattenCanonical(nodes: CanonicalBookmarkNode[]): CanonicalBookmarkNode[] {
  const out: CanonicalBookmarkNode[] = [];
  const walk = (node: CanonicalBookmarkNode): void => {
    out.push(node);
    if (node.type === 'folder') {
      const children = Array.isArray(node.children) ? node.children : [];
      for (const child of children) {
        walk(child);
      }
    }
  };

  for (const node of nodes) {
    walk(node);
  }

  return out;
}
