import { fail } from '../utils/print';
import type { RuntimeConfig } from '../types/config';
import { fetchCanonicalTree, flattenCanonical } from './common';

export async function runInboxLinks(config: RuntimeConfig): Promise<unknown> {
  if (!config.INBOX_FOLDER_ID) {
    fail('Inbox folder is not configured. Run `bookmarks init` and choose an inbox folder.', 1);
  }

  const tree = await fetchCanonicalTree(config);
  const nodes = flattenCanonical(tree);

  return nodes.filter(
    (node) =>
      node.type === 'link' &&
      typeof node.parentId === 'string' &&
      node.parentId === config.INBOX_FOLDER_ID
  );
}
