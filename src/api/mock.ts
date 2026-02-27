import fs from "node:fs";

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

function toApiNode(
  node: RawNode,
  parentId: string | undefined,
  index: number,
): ApiNode {
  const out: ApiNode = {
    id: node.id ?? "",
    title: node.title ?? node.name ?? "",
    parentId,
    index,
  };

  if (typeof node.url === "string") out.url = node.url;
  const dateAdded = parseDate(node.date_added);
  if (typeof dateAdded === "number") out.dateAdded = dateAdded;

  const children = Array.isArray(node.children) ? node.children : [];
  if (typeof node.url !== "string") {
    out.children = children.map((child, childIndex) =>
      toApiNode(child, out.id, childIndex),
    );
  }

  return out;
}

function loadTree(mockFile: string): ApiNode[] {
  const raw = JSON.parse(fs.readFileSync(mockFile, "utf8")) as {
    roots?: Record<string, RawNode>;
  };
  const roots = raw.roots ?? {};

  const rootNode: ApiNode = {
    id: "0",
    title: "",
    children: [],
  };

  const rootEntries: Array<[string, RawNode]> = Object.entries(roots);
  for (let i = 0; i < rootEntries.length; i += 1) {
    const [, root] = rootEntries[i];
    const apiRoot = toApiNode(root, "0", i);
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

function findNodeWithParent(
  nodes: ApiNode[],
  id: string,
  parent: ApiNode | null = null,
): { node: ApiNode; parent: ApiNode | null } | null {
  for (const node of nodes) {
    if (node.id === id) {
      return { node, parent };
    }
    const children = Array.isArray(node.children) ? node.children : [];
    const found = findNodeWithParent(children, id, node);
    if (found) {
      return found;
    }
  }
  return null;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readRequiredString(
  payload: Record<string, unknown>,
  field: string,
): string {
  const value = payload[field];
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  return value;
}

function readOptionalString(
  payload: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = payload[field];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  return value;
}

function parseCreatePayload(args: unknown[]): {
  parentId: string;
  title: string;
  url?: string;
  index?: number;
} {
  const payload = (args[0] ?? {}) as Record<string, unknown>;
  const parentId = readRequiredString(payload, "parentId");
  const title = readRequiredString(payload, "title");
  const url = readOptionalString(payload, "url");
  return {
    parentId,
    title,
    ...(url !== undefined ? { url } : {}),
    ...(typeof payload.index === "number" ? { index: payload.index } : {}),
  };
}

function parseUpdatePayload(args: unknown[]): {
  id: string;
  title?: string;
  url?: string;
} {
  const id = String(args[0] ?? "");
  const payload = (args[1] ?? {}) as Record<string, unknown>;
  const title = readOptionalString(payload, "title");
  const url = readOptionalString(payload, "url");
  return {
    id,
    ...(title !== undefined ? { title } : {}),
    ...(url !== undefined ? { url } : {}),
  };
}

function parseMovePayload(args: unknown[]): {
  id: string;
  parentId: string;
  index?: number;
} {
  const id = String(args[0] ?? "");
  const payload = (args[1] ?? {}) as Record<string, unknown>;
  const parentId = readRequiredString(payload, "parentId");
  return {
    id,
    parentId,
    ...(typeof payload.index === "number" ? { index: payload.index } : {}),
  };
}

export function callMockBookmarksApi(
  method: string,
  args: unknown[],
  mockFile: string,
): unknown {
  const tree = loadTree(mockFile);

  if (method === "__ping") {
    return { ok: true, service: "bookmarks-bridge-mock" };
  }

  if (method === "getTree") {
    return tree;
  }

  if (method === "get") {
    const ids = Array.isArray(args[0]) ? (args[0] as string[]) : [];
    const all = flatten(tree);
    return all
      .filter((node) => ids.includes(node.id))
      .map((node) => ({ ...node, children: undefined }));
  }

  if (method === "getChildren") {
    const id = String(args[0] ?? "");
    const parent = findNode(tree, id);
    return Array.isArray(parent?.children) ? parent.children : [];
  }

  if (method === "getSubTree") {
    const id = String(args[0] ?? "");
    const found = findNode(tree, id);
    return found ? [found] : [];
  }

  if (method === "getRecent") {
    const count = Number(args[0] ?? 0);
    const links = flatten(tree).filter((node) => typeof node.url === "string");
    return links.slice(-count).reverse();
  }

  if (method === "search") {
    const query = String(args[0] ?? "").toLowerCase();
    const all = flatten(tree);
    return all.filter((node) => {
      const inTitle = node.title.toLowerCase().includes(query);
      const inUrl =
        typeof node.url === "string" && node.url.toLowerCase().includes(query);
      return inTitle || inUrl;
    });
  }

  if (method === "create") {
    const { parentId, title, url, index } = parseCreatePayload(args);
    const parent = findNode(tree, parentId);
    if (!parent || !Array.isArray(parent.children)) {
      throw new Error(`Parent not found: ${parentId}`);
    }

    const allIds = flatten(tree)
      .map((node) => Number.parseInt(node.id, 10))
      .filter(Number.isFinite);
    const nextId = String((allIds.length > 0 ? Math.max(...allIds) : 1000) + 1);
    const created: ApiNode = {
      id: nextId,
      title,
      parentId,
      index: typeof index === "number" ? index : parent.children.length,
      dateAdded: Date.now(),
      ...(typeof url === "string" ? { url } : {}),
      ...(typeof url !== "string" ? { children: [] as ApiNode[] } : {}),
    };

    const at =
      typeof index === "number"
        ? Math.max(0, Math.min(index, parent.children.length))
        : parent.children.length;
    parent.children.splice(at, 0, created);
    return deepClone(created);
  }

  if (method === "update") {
    const { id, title, url } = parseUpdatePayload(args);
    const found = findNode(tree, id);
    if (!found) {
      throw new Error(`Node not found: ${id}`);
    }
    if (typeof title === "string") {
      found.title = title;
    }
    if (typeof url === "string") {
      found.url = url;
    }
    return deepClone(found);
  }

  if (method === "move") {
    const { id, parentId, index } = parseMovePayload(args);
    const source = findNodeWithParent(tree, id);
    const targetParent = findNode(tree, parentId);
    if (!source || !source.parent || !Array.isArray(source.parent.children)) {
      throw new Error(`Node not found: ${id}`);
    }
    if (!targetParent || !Array.isArray(targetParent.children)) {
      throw new Error(`Parent not found: ${parentId}`);
    }

    source.parent.children = source.parent.children.filter(
      (child) => child.id !== id,
    );
    source.node.parentId = parentId;
    const at =
      typeof index === "number"
        ? Math.max(0, Math.min(index, targetParent.children.length))
        : targetParent.children.length;
    targetParent.children.splice(at, 0, source.node);
    source.node.index = at;
    return deepClone(source.node);
  }

  if (method === "remove") {
    const id = String(args[0] ?? "");
    const found = findNodeWithParent(tree, id);
    if (!found || !found.parent || !Array.isArray(found.parent.children)) {
      throw new Error(`Node not found: ${id}`);
    }
    found.parent.children = found.parent.children.filter(
      (child) => child.id !== id,
    );
    return;
  }

  if (method === "removeTree") {
    const id = String(args[0] ?? "");
    const found = findNodeWithParent(tree, id);
    if (!found || !found.parent || !Array.isArray(found.parent.children)) {
      throw new Error(`Node not found: ${id}`);
    }
    found.parent.children = found.parent.children.filter(
      (child) => child.id !== id,
    );
    return;
  }

  throw new Error(`Mock API does not implement method: ${method}`);
}
