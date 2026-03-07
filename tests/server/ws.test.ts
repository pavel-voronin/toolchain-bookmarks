import { createServer } from "node:http";
import type { ClientRequest, IncomingMessage } from "node:http";
import request from "supertest";
import { afterEach, describe, expect, test, vi } from "vitest";
import { WebSocket, type RawData } from "ws";
import type { BookmarksGateway } from "../../src/cdp/client";
import { EventBus } from "../../src/events/bus";
import { createApp } from "../../src/server/app";
import { setupWebSocketTransport } from "../../src/server/ws";

const decoder = new TextDecoder();

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

async function waitForSseFrame(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  matcher: RegExp,
  timeoutMs = 2_000,
): Promise<string> {
  const started = Date.now();
  let buffer = "";

  while (Date.now() - started < timeoutMs) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const match = buffer.match(matcher);
    if (match) {
      return match[1];
    }
  }

  throw new Error("Timed out waiting for sse frame");
}

describe("WebSocket transport", () => {
  const servers: Array<{
    close: (cb?: (err?: Error) => void) => void;
  }> = [];
  const stopFns: Array<() => void> = [];
  const clients: WebSocket[] = [];

  afterEach(async () => {
    clients.splice(0).forEach((client) => client.close());
    stopFns.splice(0).forEach((stop) => stop());
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => resolve());
          }),
      ),
    );
  });

  test("requires auth for websocket upgrade when enabled", async () => {
    const app = createApp({
      gateway: { call: vi.fn(async () => []) },
      bus: new EventBus(),
      auth: { enabled: true, token: "secret", generated: false },
    });
    const server = createServer(app);
    stopFns.push(
      setupWebSocketTransport({
        server,
        bus: new EventBus(),
        gateway: { call: vi.fn(async () => []) },
        auth: { enabled: true, token: "secret", generated: false },
      }),
    );

    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    servers.push(server);
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unexpected server address");
    }

    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
    clients.push(ws);
    const unexpected = await new Promise<number>((resolve, reject) => {
      ws.once(
        "unexpected-response",
        (_req: ClientRequest, res: IncomingMessage) =>
          resolve(res.statusCode ?? 0),
      );
      ws.once("open", () => reject(new Error("ws must not open without auth")));
      ws.once("error", () => undefined);
    });

    expect(unexpected).toBe(401);
  });

  test("accepts bearer header and query token for websocket upgrade", async () => {
    const bus = new EventBus();
    const gateway: BookmarksGateway = { call: vi.fn(async () => []) };
    const app = createApp({
      gateway,
      bus,
      auth: { enabled: true, token: "secret", generated: false },
    });
    const server = createServer(app);
    stopFns.push(
      setupWebSocketTransport({
        server,
        bus,
        gateway,
        auth: { enabled: true, token: "secret", generated: false },
      }),
    );

    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    servers.push(server);
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unexpected server address");
    }

    const viaHeader = new WebSocket(`ws://127.0.0.1:${address.port}/ws`, {
      headers: { Authorization: "Bearer secret" },
    });
    clients.push(viaHeader);
    await waitForWsOpen(viaHeader);

    const viaQuery = new WebSocket(
      `ws://127.0.0.1:${address.port}/ws?access_token=secret`,
    );
    clients.push(viaQuery);
    await waitForWsOpen(viaQuery);
  });

  test("handles rpc requests and notifications over websocket", async () => {
    const gateway: BookmarksGateway = {
      call: vi.fn(async (method: string) => {
        if (method === "getTree") {
          return [{ id: "0", title: "" }];
        }
        return undefined;
      }),
    };
    const bus = new EventBus();
    const app = createApp({
      gateway,
      bus,
      auth: { enabled: false },
    });
    const server = createServer(app);
    stopFns.push(
      setupWebSocketTransport({
        server,
        bus,
        gateway,
        auth: { enabled: false },
      }),
    );

    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    servers.push(server);
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unexpected server address");
    }

    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
    clients.push(ws);
    await waitForWsOpen(ws);

    ws.send(
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTree", params: [] }),
    );
    const response = await waitForWsMessage<{ id: number; result: unknown }>(
      ws,
    );
    expect(response.id).toBe(1);
    expect(response.result).toEqual([{ id: "0", title: "" }]);

    ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "remove",
        params: ["100"],
      }),
    );
    const voidResponse = await waitForWsMessage<{
      id: number;
      result: unknown;
    }>(ws);
    expect(voidResponse).toEqual({
      jsonrpc: "2.0",
      id: 2,
      result: null,
    });

    ws.send(
      JSON.stringify({ jsonrpc: "2.0", method: "remove", params: ["100"] }),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(gateway.call).toHaveBeenCalledWith("remove", ["100"]);
  });

  test("returns parse error and batch response over websocket", async () => {
    const gateway: BookmarksGateway = {
      call: vi.fn(async (method: string) => {
        if (method === "getTree") {
          return [{ id: "0", title: "" }];
        }
        return undefined;
      }),
    };
    const bus = new EventBus();
    const app = createApp({
      gateway,
      bus,
      auth: { enabled: false },
    });
    const server = createServer(app);
    stopFns.push(
      setupWebSocketTransport({
        server,
        bus,
        gateway,
        auth: { enabled: false },
      }),
    );

    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    servers.push(server);
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unexpected server address");
    }

    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
    clients.push(ws);
    await waitForWsOpen(ws);

    ws.send("{bad-json");
    const parseError = await waitForWsMessage<{ error: { code: number } }>(ws);
    expect(parseError.error.code).toBe(-32700);

    ws.send(
      JSON.stringify([
        { jsonrpc: "2.0", id: 1, method: "getTree", params: [] },
        { jsonrpc: "2.0", method: "remove", params: ["100"] },
        { jsonrpc: "2.0", id: 2, method: "nope", params: [] },
      ]),
    );
    const batch =
      await waitForWsMessage<Array<{ id: number } & Record<string, unknown>>>(
        ws,
      );
    expect(Array.isArray(batch)).toBe(true);
    expect(batch).toHaveLength(2);
    expect(batch[0].id).toBe(1);
    expect(batch[1].id).toBe(2);
  });

  test("fans out cdp events to websocket and sse clients", async () => {
    const bus = new EventBus();
    const gateway: BookmarksGateway = { call: vi.fn(async () => []) };
    const app = createApp({
      gateway,
      bus,
      auth: { enabled: false },
    });
    const server = createServer(app);
    stopFns.push(
      setupWebSocketTransport({
        server,
        bus,
        gateway,
        auth: { enabled: false },
      }),
    );

    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    servers.push(server);
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unexpected server address");
    }

    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
    clients.push(ws);
    await waitForWsOpen(ws);

    const sseRes = await fetch(`http://127.0.0.1:${address.port}/sse`);
    const reader = sseRes.body?.getReader();
    if (!reader) {
      throw new Error("SSE response body is missing");
    }
    await waitForSseFrame(reader, /: (.+)\n\n/);

    bus.publish({
      ts: "2026-03-07T00:00:00.000Z",
      eventName: "onCreated",
      args: ["10", { id: "10", title: "A" }],
    });

    const wsPayload = await waitForWsMessage<{ method: string }>(ws);
    expect(wsPayload.method).toBe("onCreated");

    const raw = await waitForSseFrame(reader, /data: (.+)\n\n/);
    const ssePayload = JSON.parse(raw) as { method: string };
    expect(ssePayload.method).toBe("onCreated");
    await reader.cancel();
  });

  test("ignores non-target upgrade path and keeps http routes working", async () => {
    const bus = new EventBus();
    const gateway: BookmarksGateway = { call: vi.fn(async () => []) };
    const app = createApp({
      gateway,
      bus,
      auth: { enabled: false },
    });
    const server = createServer(app);
    stopFns.push(
      setupWebSocketTransport({
        server,
        bus,
        gateway,
        auth: { enabled: false },
      }),
    );

    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    servers.push(server);

    const res = await request(server).get("/healthz");
    expect(res.status).toBe(200);

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unexpected server address");
    }
    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/not-ws`);
    clients.push(ws);

    await new Promise<void>((resolve) => {
      ws.once("error", () => resolve());
      ws.once("open", () => resolve());
    });
    expect(ws.readyState).not.toBe(WebSocket.OPEN);
  });

  test("handles upgrade request with missing url", () => {
    const fakeServer = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (event !== "upgrade") return;
      }),
      off: vi.fn(),
    };

    const stop = setupWebSocketTransport({
      server: fakeServer as never,
      bus: new EventBus(),
      gateway: { call: vi.fn(async () => []) },
      auth: { enabled: false },
    });

    const socket = { destroy: vi.fn(), write: vi.fn() };
    const upgradeHandler = fakeServer.on.mock.calls.find(
      ([event]) => event === "upgrade",
    )?.[1] as
      | ((req: IncomingMessage, socket: any, head: Buffer) => void)
      | undefined;
    if (!upgradeHandler) {
      throw new Error("upgrade handler is not registered");
    }
    upgradeHandler({ headers: {} } as IncomingMessage, socket, Buffer.alloc(0));
    expect(socket.destroy).toHaveBeenCalledTimes(1);

    stop();
    expect(fakeServer.off).toHaveBeenCalled();
  });

  test("skips closed websocket clients during event fan-out", async () => {
    const bus = new EventBus();
    const gateway: BookmarksGateway = { call: vi.fn(async () => []) };
    const app = createApp({
      gateway,
      bus,
      auth: { enabled: false },
    });
    const server = createServer(app);
    stopFns.push(
      setupWebSocketTransport({
        server,
        bus,
        gateway,
        auth: { enabled: false },
      }),
    );

    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    servers.push(server);
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unexpected server address");
    }

    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
    clients.push(ws);
    await waitForWsOpen(ws);
    ws.close();
    await new Promise<void>((resolve) => ws.once("close", () => resolve()));

    bus.publish({
      ts: "2026-03-07T00:00:00.000Z",
      eventName: "onCreated",
      args: ["10", { id: "10", title: "A" }],
    });

    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });
});
