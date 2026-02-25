import fs from 'node:fs';

type RawNode = {
  id?: string;
  name?: string;
  title?: string;
  url?: string;
  children?: RawNode[];
  parentId?: string;
  index?: number;
  date_added?: string;
};

type ApiNode = {
  id: string;
  title: string;
  url?: string;
  children?: ApiNode[];
  parentId?: string;
  index?: number;
  dateAdded?: number;
};

function parseDate(input: string | undefined): number | undefined {
  if (!input) return undefined;
  const n = Number.parseInt(input, 10);
  return Number.isFinite(n) ? n : undefined;
}

function toApiNode(node: RawNode, parentId: string | undefined, index: number): ApiNode {
  const out: ApiNode = {
    id: node.id ?? '',
    title: node.title ?? node.name ?? '',
    parentId,
    index
  };

  if (typeof node.url === 'string') out.url = node.url;
  const dateAdded = parseDate(node.date_added);
  if (typeof dateAdded === 'number') out.dateAdded = dateAdded;

  const children = Array.isArray(node.children) ? node.children : [];
  if (children.length > 0) {
    out.children = children.map((child, childIndex) => toApiNode(child, out.id, childIndex));
  }

  return out;
}

function loadTree(mockFile: string): ApiNode[] {
  const raw = JSON.parse(fs.readFileSync(mockFile, 'utf8')) as { roots?: Record<string, RawNode> };
  const roots = raw.roots ?? {};

  const rootNode: ApiNode = {
    id: '0',
    title: '',
    children: []
  };

  const rootEntries: Array<[string, RawNode]> = Object.entries(roots);
  for (let i = 0; i < rootEntries.length; i += 1) {
    const [, root] = rootEntries[i];
    const apiRoot = toApiNode(root, '0', i);
    rootNode.children?.push(apiRoot);
  }

  return [rootNode];
}

function flatten(nodes: ApiNode[]): ApiNode[] {
  const out: ApiNode[] = [];
  const walk = (node: ApiNode): void => {
    out.push(node);
    const children = Array.isArray(node.children) ? node.children : [];
    for (const child of children) walk(child);
  };
  for (const node of nodes) walk(node);
  return out;
}

function findNode(nodes: ApiNode[], id: string): ApiNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const children = Array.isArray(node.children) ? node.children : [];
    const found = findNode(children, id);
    if (found) return found;
  }
  return null;
}

export function callMockBookmarksApi(method: string, args: unknown[], mockFile: string): unknown {
  const tree = loadTree(mockFile);

  if (method === '__ping') {
    return { ok: true, service: 'bookmarks-bridge-mock' };
  }

  if (method === '__methods') {
    return [
      'create',
      'get',
      'getChildren',
      'getRecent',
      'getSubTree',
      'getTree',
      'move',
      'remove',
      'removeTree',
      'search',
      'update'
    ];
  }

  if (method === 'getTree') {
    return tree;
  }

  if (method === 'get') {
    const ids = Array.isArray(args[0]) ? (args[0] as string[]) : [];
    const all = flatten(tree);
    return all.filter((node) => ids.includes(node.id)).map((node) => ({ ...node, children: undefined }));
  }

  if (method === 'getChildren') {
    const id = String(args[0] ?? '');
    const parent = findNode(tree, id);
    return Array.isArray(parent?.children) ? parent.children : [];
  }

  if (method === 'getSubTree') {
    const id = String(args[0] ?? '');
    const found = findNode(tree, id);
    return found ? [found] : [];
  }

  if (method === 'getRecent') {
    const count = Number(args[0] ?? 0);
    const links = flatten(tree).filter((node) => typeof node.url === 'string');
    return links.slice(-count).reverse();
  }

  if (method === 'search') {
    const query = String(args[0] ?? '').toLowerCase();
    const all = flatten(tree);
    return all.filter((node) => {
      const inTitle = node.title.toLowerCase().includes(query);
      const inUrl = typeof node.url === 'string' && node.url.toLowerCase().includes(query);
      return inTitle || inUrl;
    });
  }

  throw new Error(`Mock API does not implement method: ${method}`);
}
