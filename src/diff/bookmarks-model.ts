import fs from 'node:fs';
import type { BookmarkNode, FlatNode } from '../types/bookmarks';
import type { RuntimeConfig } from '../types/config';

const ROOT_NAMES: Record<string, string> = {
  bookmark_bar: 'Bookmarks Bar',
  other: 'Other Bookmarks',
  synced: 'Mobile Bookmarks'
};

function getRoots(input: unknown): Record<string, BookmarkNode> {
  const roots = (input as { roots?: Record<string, BookmarkNode> }).roots;
  if (!roots || typeof roots !== 'object') {
    throw new Error('Bookmarks file has no roots');
  }
  return roots;
}

export function readBookmarksJson(config: RuntimeConfig): unknown {
  return JSON.parse(fs.readFileSync(config.BOOKMARKS_FILE, 'utf8'));
}

export function normalizeBookmarks(input: unknown): Map<string, FlatNode> {
  const roots = getRoots(input);
  const out = new Map<string, FlatNode>();

  for (const [rootKey, rootNode] of Object.entries(roots)) {
    const rootName = ROOT_NAMES[rootKey] ?? rootNode.name ?? rootKey;
    const rootPath = `/${rootName}`;
    const children = Array.isArray(rootNode.children) ? rootNode.children : [];

    children.forEach((child, index) => {
      walk(child, {
        parentId: rootNode.id ?? null,
        parentPath: rootPath,
        parentName: rootName,
        parentFolderId: rootNode.id ?? null,
        index
      });
    });
  }

  function walk(
    node: BookmarkNode,
    ctx: {
      parentId: string | null;
      parentPath: string;
      parentName: string;
      parentFolderId: string | null;
      index: number;
    }
  ): void {
    if (!node.id) {
      return;
    }

    const id = node.id;
    const title = node.name ?? node.title ?? '';
    const index = Number.isInteger(node.index) ? (node.index as number) : ctx.index;
    const isLink = typeof node.url === 'string' && node.url.length > 0;

    if (isLink) {
      out.set(id, {
        id,
        nodeType: 'link',
        title,
        url: node.url ?? null,
        parentId: node.parentId ?? ctx.parentId,
        index,
        path: `${ctx.parentPath}/${title}`,
        folderId: ctx.parentFolderId,
        folderName: ctx.parentName,
        folderPath: ctx.parentPath
      });
      return;
    }

    const folderPath = `${ctx.parentPath}/${title}`;
    out.set(id, {
      id,
      nodeType: 'folder',
      title,
      url: null,
      parentId: node.parentId ?? ctx.parentId,
      index,
      path: folderPath,
      folderId: node.parentId ?? ctx.parentId,
      folderName: ctx.parentName,
      folderPath: ctx.parentPath
    });

    const children = Array.isArray(node.children) ? node.children : [];
    children.forEach((child, childIndex) => {
      walk(child, {
        parentId: id,
        parentPath: folderPath,
        parentName: title,
        parentFolderId: id,
        index: childIndex
      });
    });
  }

  return out;
}

export function isInboxNode(node: FlatNode, config: RuntimeConfig): boolean {
  return Boolean(config.INBOX_FOLDER_ID) && node.folderId === config.INBOX_FOLDER_ID;
}
