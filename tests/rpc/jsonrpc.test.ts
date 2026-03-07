import request from "supertest";
import { describe, expect, test, vi } from "vitest";
import type { BookmarksGateway } from "../../src/cdp/client";
import { EventBus } from "../../src/events/bus";
import { createApp } from "../../src/server/app";

function createTestApp(gateway: BookmarksGateway) {
  return createApp({
    gateway,
    bus: new EventBus(),
    auth: { enabled: false },
  });
}

describe("JSON-RPC endpoint", () => {
  test("returns parse error on invalid JSON", async () => {
    const gateway: BookmarksGateway = {
      call: vi.fn(),
    };

    const res = await request(createTestApp(gateway))
      .post("/rpc")
      .set("content-type", "application/json")
      .send("{bad");

    expect(res.status).toBe(200);
    expect(res.body.error.code).toBe(-32700);
  });

  test("returns parse error on empty body", async () => {
    const gateway: BookmarksGateway = {
      call: vi.fn(),
    };

    const res = await request(createTestApp(gateway))
      .post("/rpc")
      .set("content-type", "application/json")
      .send("");

    expect(res.status).toBe(200);
    expect(res.body.error.code).toBe(-32700);
  });

  test("handles single request", async () => {
    const gateway: BookmarksGateway = {
      call: vi.fn(async () => [{ id: "0", title: "" }]),
    };

    const res = await request(createTestApp(gateway))
      .post("/rpc")
      .send({ jsonrpc: "2.0", id: 1, method: "getTree", params: [] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: [{ id: "0", title: "" }],
    });
  });

  test("returns method not found", async () => {
    const gateway: BookmarksGateway = {
      call: vi.fn(),
    };

    const res = await request(createTestApp(gateway))
      .post("/rpc")
      .send({ jsonrpc: "2.0", id: 10, method: "unknown", params: [] });

    expect(res.status).toBe(200);
    expect(res.body.error.code).toBe(-32601);
  });

  test("returns invalid params for non-array params", async () => {
    const gateway: BookmarksGateway = {
      call: vi.fn(),
    };

    const res = await request(createTestApp(gateway))
      .post("/rpc")
      .send({ jsonrpc: "2.0", id: 10, method: "getTree", params: {} });

    expect(res.status).toBe(200);
    expect(res.body.error.code).toBe(-32602);
  });

  test("supports notifications without response body", async () => {
    const gateway: BookmarksGateway = {
      call: vi.fn(async () => undefined),
    };

    const res = await request(createTestApp(gateway))
      .post("/rpc")
      .send({ jsonrpc: "2.0", method: "remove", params: ["100"] });

    expect(res.status).toBe(204);
    expect(gateway.call).toHaveBeenCalledWith("remove", ["100"]);
  });

  test("returns null result for methods without payload", async () => {
    const gateway: BookmarksGateway = {
      call: vi.fn(async () => undefined),
    };

    const res = await request(createTestApp(gateway))
      .post("/rpc")
      .send({ jsonrpc: "2.0", id: 2, method: "remove", params: ["100"] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      jsonrpc: "2.0",
      id: 2,
      result: null,
    });
  });

  test("supports mixed batch requests", async () => {
    const gateway: BookmarksGateway = {
      call: vi.fn(async (method: string) => {
        if (method === "getTree") {
          return [{ id: "0", title: "" }];
        }
        return undefined;
      }),
    };

    const res = await request(createTestApp(gateway))
      .post("/rpc")
      .send([
        { jsonrpc: "2.0", id: 1, method: "getTree", params: [] },
        { jsonrpc: "2.0", method: "remove", params: ["100"] },
        { jsonrpc: "2.0", id: 2, method: "nope", params: [] },
      ]);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe(1);
    expect(res.body[1].id).toBe(2);
    expect(res.body[1].error.code).toBe(-32601);
  });

  test("returns invalid request for empty batch payload", async () => {
    const gateway: BookmarksGateway = {
      call: vi.fn(),
    };

    const res = await request(createTestApp(gateway)).post("/rpc").send([]);

    expect(res.status).toBe(200);
    expect(res.body.error.code).toBe(-32600);
    expect(gateway.call).not.toHaveBeenCalled();
  });

  test("returns 204 for batch notifications only", async () => {
    const gateway: BookmarksGateway = {
      call: vi.fn(async () => undefined),
    };

    const res = await request(createTestApp(gateway))
      .post("/rpc")
      .send([
        { jsonrpc: "2.0", method: "remove", params: ["100"] },
        { jsonrpc: "2.0", method: "removeTree", params: ["101"] },
      ]);

    expect(res.status).toBe(204);
    expect(gateway.call).toHaveBeenCalledTimes(2);
  });
});
