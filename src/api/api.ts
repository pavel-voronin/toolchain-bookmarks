import { aliasToMethod, callBookmarksApi } from "./bridge";
import { buildPathIndexFromTree, toCanonicalWithPathIndex } from "./canonical";
import { loadConfig, resolvePaths } from "../config/runtime";
import type { RuntimeConfig } from "../types/config";
import type { CanonicalBookmarkNode } from "../types/canonical";

type ApiAlias =
  | "get"
  | "get-children"
  | "get-recent"
  | "get-sub-tree"
  | "get-tree"
  | "search"
  | "create"
  | "update"
  | "move"
  | "remove"
  | "remove-tree"
  | "ping";

export class API {
  private constructor(private readonly config: RuntimeConfig) {}

  static async create(): Promise<API> {
    const config = await loadConfig(resolvePaths());
    return new API(config);
  }

  async get(ids: string[]): Promise<CanonicalBookmarkNode[]> {
    return this.run("get", [ids]) as Promise<CanonicalBookmarkNode[]>;
  }

  async getChildren(id: string): Promise<CanonicalBookmarkNode[]> {
    return this.run("get-children", [id]) as Promise<CanonicalBookmarkNode[]>;
  }

  async getRecent(count: number): Promise<CanonicalBookmarkNode[]> {
    return this.run("get-recent", [count]) as Promise<CanonicalBookmarkNode[]>;
  }

  async getSubTree(id: string): Promise<CanonicalBookmarkNode[]> {
    return this.run("get-sub-tree", [id]) as Promise<CanonicalBookmarkNode[]>;
  }

  async getTree(): Promise<CanonicalBookmarkNode[]> {
    return this.run("get-tree", []) as Promise<CanonicalBookmarkNode[]>;
  }

  async search(query: string): Promise<CanonicalBookmarkNode[]> {
    return this.run("search", [query]) as Promise<CanonicalBookmarkNode[]>;
  }

  async create(payload: {
    parentId: string;
    title: string;
    url?: string;
    index?: number;
  }): Promise<CanonicalBookmarkNode> {
    return this.run("create", [payload]) as Promise<CanonicalBookmarkNode>;
  }

  async update(
    id: string,
    payload: {
      title?: string;
      url?: string;
    },
  ): Promise<CanonicalBookmarkNode> {
    return this.run("update", [id, payload]) as Promise<CanonicalBookmarkNode>;
  }

  async move(
    id: string,
    payload: {
      parentId: string;
      index?: number;
    },
  ): Promise<CanonicalBookmarkNode> {
    return this.run("move", [id, payload]) as Promise<CanonicalBookmarkNode>;
  }

  async remove(id: string): Promise<unknown> {
    return this.run("remove", [id]);
  }

  async removeTree(id: string): Promise<unknown> {
    return this.run("remove-tree", [id]);
  }

  async ping(): Promise<unknown> {
    return this.run("ping", []);
  }

  private async run(alias: ApiAlias, args: unknown[]): Promise<unknown> {
    const method = aliasToMethod(alias);
    const apiResult = await callBookmarksApi(this.config, method, args);
    const rawResult =
      alias === "get" ? await this.hydrateGetWithSubTree(apiResult) : apiResult;
    return this.canonicalizeApiResult(method, rawResult);
  }

  private async hydrateGetWithSubTree(result: unknown): Promise<unknown> {
    if (!Array.isArray(result)) {
      return result;
    }

    const hydrated = await Promise.all(
      result.map(async (item) => {
        if (!item || typeof item !== "object") {
          return item;
        }

        const id = (item as Record<string, unknown>).id;
        if (typeof id !== "string" || id.length === 0) {
          return item;
        }

        try {
          const subtree = await callBookmarksApi(this.config, "getSubTree", [
            id,
          ]);
          if (Array.isArray(subtree) && subtree.length > 0) {
            return subtree[0];
          }
        } catch {
          return item;
        }

        return item;
      }),
    );

    return hydrated;
  }

  private isNodeReturningApiMethod(method: string): boolean {
    return !["__ping", "remove", "removeTree"].includes(method);
  }

  private async canonicalizeApiResult(
    method: string,
    apiResult: unknown,
  ): Promise<unknown> {
    if (!this.isNodeReturningApiMethod(method)) {
      return apiResult;
    }

    const treePayload =
      method === "getTree"
        ? apiResult
        : await callBookmarksApi(this.config, "getTree", []);
    const pathIndex = buildPathIndexFromTree(treePayload);
    return toCanonicalWithPathIndex(apiResult, pathIndex);
  }
}

let apiSingletonPromise: Promise<API> | null = null;

export function getApi(): Promise<API> {
  if (!apiSingletonPromise) {
    apiSingletonPromise = API.create();
  }
  return apiSingletonPromise;
}
