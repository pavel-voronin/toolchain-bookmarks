import { createServer } from "node:http";
import request from "supertest";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { BookmarksGateway } from "../../src/cdp/client";
import { EventBus } from "../../src/events/bus";
import { createApp } from "../../src/server/app";

const decoder = new TextDecoder();

async function waitForSseChunk(
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

  throw new Error("Timed out waiting for SSE data");
}

describe("SSE", () => {
  const servers: Array<{ close: () => void }> = [];

  afterEach(() => {
    servers.splice(0).forEach((s) => s.close());
  });

  test("requires auth when enabled", async () => {
    const app = createApp({
      gateway: { call: vi.fn(async () => []) },
      bus: new EventBus(),
      auth: { enabled: true, token: "secret", generated: false },
    });

    const denied = await request(app).get("/events/sse");
    expect(denied.status).toBe(401);
  });

  test("broadcasts event to multiple clients", async () => {
    const bus = new EventBus();
    const gateway: BookmarksGateway = { call: vi.fn(async () => []) };
    const app = createApp({
      gateway,
      bus,
      auth: { enabled: false },
    });

    const server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    servers.push(server);

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unexpected server address");
    }

    const url = `http://127.0.0.1:${address.port}/events/sse`;
    const res1 = await fetch(url);
    const res2 = await fetch(url);

    const reader1 = res1.body?.getReader();
    const reader2 = res2.body?.getReader();
    if (!reader1 || !reader2) {
      throw new Error("SSE response body is missing");
    }

    bus.publish({
      ts: "2026-03-06T00:00:00.000Z",
      eventName: "onCreated",
      args: ["10", { id: "10", title: "A" }],
    });

    const [raw1, raw2] = await Promise.all([
      waitForSseChunk(reader1, /data: (.+)\n\n/),
      waitForSseChunk(reader2, /data: (.+)\n\n/),
    ]);

    const payload1 = JSON.parse(raw1) as { method: string };
    const payload2 = JSON.parse(raw2) as { method: string };

    expect(payload1.method).toBe("onCreated");
    expect(payload2.method).toBe("onCreated");

    reader1.cancel();
    reader2.cancel();
  });

  test("sends connected prelude and stream headers", async () => {
    const app = createApp({
      gateway: { call: vi.fn(async () => []) },
      bus: new EventBus(),
      auth: { enabled: false },
    });

    const server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    servers.push(server);

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unexpected server address");
    }

    const res = await fetch(`http://127.0.0.1:${address.port}/events/sse`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error("SSE response body is missing");
    }

    const comment = await waitForSseChunk(reader, /: (.+)\n\n/);
    expect(comment).toBe("connected");

    reader.cancel();
  });

  test("sends keepalive heartbeat frames", async () => {
    vi.useFakeTimers();
    const app = createApp({
      gateway: { call: vi.fn(async () => []) },
      bus: new EventBus(),
      auth: { enabled: false },
    });

    const server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    servers.push(server);

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unexpected server address");
    }

    const res = await fetch(`http://127.0.0.1:${address.port}/events/sse`);
    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error("SSE response body is missing");
    }

    await waitForSseChunk(reader, /: (.+)\n\n/);
    await vi.advanceTimersByTimeAsync(15_000);
    const heartbeat = await waitForSseChunk(reader, /: (.+)\n\n/);
    expect(heartbeat).toBe("keepalive");

    await reader.cancel();
    vi.useRealTimers();
  });
});
