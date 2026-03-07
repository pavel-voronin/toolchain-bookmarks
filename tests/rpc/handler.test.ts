import { describe, expect, test, vi } from "vitest";
import { handleJsonRpcPayload } from "../../src/rpc/handler";

describe("handleJsonRpcPayload", () => {
  test("returns INVALID_REQUEST for malformed request object", async () => {
    const gateway = { call: vi.fn() };

    const result = await handleJsonRpcPayload(gateway, {
      jsonrpc: "2.0",
      id: true,
      method: "getTree",
      params: [],
    });

    expect(result.kind).toBe("response");
    if (result.kind === "response" && !Array.isArray(result.payload)) {
      expect("error" in result.payload).toBe(true);
      if (!("error" in result.payload)) {
        throw new Error("Expected JSON-RPC error response");
      }
      expect(result.payload.error.code).toBe(-32600);
      expect(gateway.call).not.toHaveBeenCalled();
    }
  });

  test("returns INVALID_REQUEST for non-object payload", async () => {
    const gateway = { call: vi.fn() };
    const result = await handleJsonRpcPayload(gateway, 123);

    expect(result.kind).toBe("response");
    if (result.kind === "response" && !Array.isArray(result.payload)) {
      expect("error" in result.payload).toBe(true);
      if (!("error" in result.payload)) {
        throw new Error("Expected JSON-RPC error response");
      }
      expect(result.payload.error.code).toBe(-32600);
    }
  });

  test("returns INVALID_REQUEST when jsonrpc version is invalid", async () => {
    const gateway = { call: vi.fn() };
    const result = await handleJsonRpcPayload(gateway, {
      jsonrpc: "1.0",
      id: 1,
      method: "getTree",
      params: [],
    });

    expect(result.kind).toBe("response");
    if (result.kind === "response" && !Array.isArray(result.payload)) {
      expect("error" in result.payload).toBe(true);
      if (!("error" in result.payload)) {
        throw new Error("Expected JSON-RPC error response");
      }
      expect(result.payload.error.code).toBe(-32600);
    }
  });

  test("returns INVALID_REQUEST when method is not a string", async () => {
    const gateway = { call: vi.fn() };
    const result = await handleJsonRpcPayload(gateway, {
      jsonrpc: "2.0",
      id: 1,
      method: 100,
      params: [],
    });

    expect(result.kind).toBe("response");
    if (result.kind === "response" && !Array.isArray(result.payload)) {
      expect("error" in result.payload).toBe(true);
      if (!("error" in result.payload)) {
        throw new Error("Expected JSON-RPC error response");
      }
      expect(result.payload.error.code).toBe(-32600);
    }
  });

  test("returns INVALID_REQUEST for empty batch", async () => {
    const gateway = { call: vi.fn() };
    const result = await handleJsonRpcPayload(gateway, []);

    expect(result.kind).toBe("response");
    if (result.kind === "response" && !Array.isArray(result.payload)) {
      expect("error" in result.payload).toBe(true);
      if (!("error" in result.payload)) {
        throw new Error("Expected JSON-RPC error response");
      }
      expect(result.payload.error.code).toBe(-32600);
    }
  });

  test("returns no-content for batch with notifications only", async () => {
    const gateway = { call: vi.fn(async () => undefined) };
    const result = await handleJsonRpcPayload(gateway, [
      { jsonrpc: "2.0", method: "remove", params: ["10"] },
      { jsonrpc: "2.0", method: "removeTree", params: ["11"] },
    ]);

    expect(result).toEqual({ kind: "no-content" });
    expect(gateway.call).toHaveBeenCalledTimes(2);
  });

  test("returns SERVER_ERROR for gateway failures on normal requests", async () => {
    const gateway = {
      call: vi.fn(async () => {
        throw new TypeError("boom");
      }),
    };

    const result = await handleJsonRpcPayload(gateway, {
      jsonrpc: "2.0",
      id: 42,
      method: "getTree",
      params: [],
    });

    expect(result.kind).toBe("response");
    if (result.kind === "response" && !Array.isArray(result.payload)) {
      expect(result.payload.id).toBe(42);
      expect("error" in result.payload).toBe(true);
      if (!("error" in result.payload)) {
        throw new Error("Expected JSON-RPC error response");
      }
      expect(result.payload.error.code).toBe(-32000);
    }
  });

  test("notification with error still returns no-content", async () => {
    const gateway = {
      call: vi.fn(async () => {
        throw new Error("ignored for notifications");
      }),
    };

    const result = await handleJsonRpcPayload(gateway, {
      jsonrpc: "2.0",
      method: "getTree",
      params: [],
    });

    expect(result).toEqual({ kind: "no-content" });
  });

  test("keeps null id in successful responses", async () => {
    const gateway = {
      call: vi.fn(async () => ["ok"]),
    };

    const result = await handleJsonRpcPayload(gateway, {
      jsonrpc: "2.0",
      id: null,
      method: "getTree",
      params: [],
    });

    expect(result.kind).toBe("response");
    if (result.kind === "response" && !Array.isArray(result.payload)) {
      expect(result.payload.id).toBe(null);
    }
  });

  test("normalizes undefined gateway result to null for JSON-RPC success", async () => {
    const gateway = {
      call: vi.fn(async () => undefined),
    };

    const result = await handleJsonRpcPayload(gateway, {
      jsonrpc: "2.0",
      id: 7,
      method: "remove",
      params: ["10"],
    });

    expect(result.kind).toBe("response");
    if (result.kind === "response" && !Array.isArray(result.payload)) {
      expect(result.payload).toEqual({
        jsonrpc: "2.0",
        id: 7,
        result: null,
      });
    }
  });

  test("normalizes undefined result to null in batch responses", async () => {
    const gateway = {
      call: vi.fn(async (method: string) => {
        if (method === "remove") {
          return undefined;
        }
        return ["ok"];
      }),
    };

    const result = await handleJsonRpcPayload(gateway, [
      { jsonrpc: "2.0", id: 1, method: "remove", params: ["100"] },
      { jsonrpc: "2.0", id: 2, method: "getTree", params: [] },
    ]);

    expect(result.kind).toBe("response");
    if (result.kind === "response" && Array.isArray(result.payload)) {
      expect(result.payload).toEqual([
        { jsonrpc: "2.0", id: 1, result: null },
        { jsonrpc: "2.0", id: 2, result: ["ok"] },
      ]);
    }
  });
});
