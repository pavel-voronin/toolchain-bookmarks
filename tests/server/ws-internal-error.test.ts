import { createServer } from "node:http";
import { afterEach, describe, expect, test, vi } from "vitest";
import { WebSocket, type RawData } from "ws";
import { EventBus } from "../../src/events/bus";
import { createApp } from "../../src/server/app";

function waitForWsOpen(ws: WebSocket, timeoutMs = 2_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timed out waiting for ws open"));
    }, timeoutMs);

    ws.once("open", () => {
      clearTimeout(timer);
      resolve();
    });
    ws.once("error", (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function waitForWsMessage<T = unknown>(
  ws: WebSocket,
  timeoutMs = 2_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timed out waiting for ws message"));
    }, timeoutMs);

    ws.once("message", (data: RawData) => {
      clearTimeout(timer);
      resolve(JSON.parse(String(data)) as T);
    });
    ws.once("error", (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

describe("WebSocket transport internal error fallback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  test("returns INTERNAL_ERROR when shared json-rpc handler throws", async () => {
    vi.doMock("../../src/rpc/handler", () => ({
      handleJsonRpcPayload: vi.fn(async () => {
        throw new Error("unexpected");
      }),
    }));

    const { setupWebSocketTransport } = await import("../../src/server/ws");

    const bus = new EventBus();
    const gateway = { call: vi.fn(async () => []) };
    const app = createApp({
      gateway,
      bus,
      auth: { enabled: false },
    });
    const server = createServer(app);
    const stop = setupWebSocketTransport({
      server,
      bus,
      gateway,
      auth: { enabled: false },
    });

    try {
      await new Promise<void>((resolve) => server.listen(0, () => resolve()));
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Unexpected server address");
      }

      const ws = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
      await waitForWsOpen(ws);
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTree",
          params: [],
        }),
      );

      const payload = await waitForWsMessage<{ error: { code: number } }>(ws);
      expect(payload.error.code).toBe(-32603);
      ws.close();
    } finally {
      stop();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
