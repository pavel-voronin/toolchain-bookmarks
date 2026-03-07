import type { BookmarksGateway } from "../cdp/client";
import { JSON_RPC_ERRORS, RpcError } from "./errors";

const METHOD_SPECS: Record<string, { min: number; max: number }> = {
  get: { min: 1, max: 1 },
  getChildren: { min: 1, max: 1 },
  getRecent: { min: 1, max: 1 },
  getSubTree: { min: 1, max: 1 },
  getTree: { min: 0, max: 0 },
  search: { min: 1, max: 1 },
  create: { min: 1, max: 1 },
  update: { min: 2, max: 2 },
  move: { min: 2, max: 2 },
  remove: { min: 1, max: 1 },
  removeTree: { min: 1, max: 1 },
};

function ensureArrayParams(params: unknown): unknown[] {
  if (params === undefined) {
    return [];
  }
  if (!Array.isArray(params)) {
    throw new RpcError(
      JSON_RPC_ERRORS.INVALID_PARAMS.code,
      JSON_RPC_ERRORS.INVALID_PARAMS.message,
      { reason: "params must be an array" },
    );
  }
  return params;
}

export async function dispatchBookmarksMethod(
  gateway: BookmarksGateway,
  method: string,
  params: unknown,
): Promise<unknown> {
  const spec = METHOD_SPECS[method];
  if (!spec) {
    throw new RpcError(
      JSON_RPC_ERRORS.METHOD_NOT_FOUND.code,
      JSON_RPC_ERRORS.METHOD_NOT_FOUND.message,
    );
  }

  const args = ensureArrayParams(params);
  if (args.length < spec.min || args.length > spec.max) {
    const expectedCount = String(spec.min);
    throw new RpcError(
      JSON_RPC_ERRORS.INVALID_PARAMS.code,
      JSON_RPC_ERRORS.INVALID_PARAMS.message,
      {
        reason: `expected ${expectedCount} params, got ${args.length}`,
      },
    );
  }

  try {
    return await gateway.call(method, args);
  } catch (error) {
    throw new RpcError(
      JSON_RPC_ERRORS.SERVER_ERROR.code,
      JSON_RPC_ERRORS.SERVER_ERROR.message,
      {
        source: "chrome.runtime.lastError",
        message: error instanceof Error ? error.message : String(error),
      },
    );
  }
}
