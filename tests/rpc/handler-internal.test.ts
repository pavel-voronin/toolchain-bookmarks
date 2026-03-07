import { afterEach, describe, expect, test, vi } from "vitest";

describe("handleJsonRpcPayload internal error branch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  test("returns INTERNAL_ERROR when dispatcher throws non-RpcError", async () => {
    vi.doMock("../../src/rpc/dispatcher", () => ({
      dispatchBookmarksMethod: vi.fn(async () => {
        throw new Error("unexpected failure");
      }),
    }));

    const { handleJsonRpcPayload } = await import("../../src/rpc/handler");
    const result = await handleJsonRpcPayload(
      { call: vi.fn() },
      { jsonrpc: "2.0", id: 7, method: "getTree", params: [] },
    );

    expect(result.kind).toBe("response");
    if (result.kind === "response" && !Array.isArray(result.payload)) {
      expect("error" in result.payload).toBe(true);
      if (!("error" in result.payload)) {
        throw new Error("Expected JSON-RPC error response");
      }
      expect(result.payload.error.code).toBe(-32603);
    }
  });
});
