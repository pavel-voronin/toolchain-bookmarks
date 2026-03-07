import { createServer } from "node:http";
import { WebSocket, type RawData } from "ws";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createApp } from "../../src/server/app";
import { EventBus } from "../../src/events/bus";
import { setupWebhookTransport } from "../../src/server/webhook";
import { setupWebSocketTransport } from "../../src/server/ws";

const EVENT_PAYLOAD = {
  ts: "2026-03-07T00:00:00.000Z",
  eventName: "onCreated",
  args: ["10", { id: "10", title: "A" }],
};

async function waitFor(assertion: () => void, timeoutMs = 2_000): Promise<void> {
  const started = Date.now();
  let lastError: unknown;

  while (Date.now() - started < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw lastError ?? new Error("Timed out");
}

function waitForWsOpen(ws: WebSocket, timeoutMs = 2_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for ws open")), timeoutMs);
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
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for ws message")),
      timeoutMs,
    );
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
  const decoder = new TextDecoder();
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

describe("Webhook transport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test("fans out events to all configured urls", async () => {
    const bus = new EventBus();
    const fetchMock = vi.fn(async () => new Response("ok", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const stop = setupWebhookTransport({
      bus,
      urls: ["https://hooks.example/a", "https://hooks.example/b"],
      timeoutMs: 1_000,
    });

    bus.publish(EVENT_PAYLOAD);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const firstRequest = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(firstRequest.method).toBe("POST");
    expect(firstRequest.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(firstRequest.body))).toMatchObject({
      jsonrpc: "2.0",
      method: "onCreated",
    });

    stop();
  });

  test("logs network errors and continues delivery", async () => {
    const bus = new EventBus();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (input: string | URL | RequestInfo) => {
      if (String(input).includes("/a")) {
        throw new Error("network down");
      }
      return new Response("ok", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const stop = setupWebhookTransport({
      bus,
      urls: ["https://hooks.example/a", "https://hooks.example/b"],
      timeoutMs: 1_000,
    });

    bus.publish(EVENT_PAYLOAD);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    stop();
  });

  test("string rejections are logged without crashing", async () => {
    const bus = new EventBus();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async () => {
      throw "plain failure";
    });
    vi.stubGlobal("fetch", fetchMock);

    const stop = setupWebhookTransport({
      bus,
      urls: ["https://hooks.example/a"],
      timeoutMs: 1_000,
    });

    bus.publish(EVENT_PAYLOAD);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        "webhook delivery failed (https://hooks.example/a): plain failure",
      );
    });

    stop();
  });

  test("aborts in-flight requests on timeout", async () => {
    vi.useFakeTimers();
    const bus = new EventBus();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const fetchMock = vi.fn(
      (_input: string | URL | RequestInfo, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const stop = setupWebhookTransport({
      bus,
      urls: ["https://hooks.example/slow"],
      timeoutMs: 100,
    });

    bus.publish(EVENT_PAYLOAD);
    await vi.advanceTimersByTimeAsync(100);

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    stop();
  });

  test("does not deliver after stop", async () => {
    const bus = new EventBus();
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const stop = setupWebhookTransport({
      bus,
      urls: ["https://hooks.example/a"],
      timeoutMs: 1_000,
    });
    stop();

    bus.publish(EVENT_PAYLOAD);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("is a no-op when urls are empty", async () => {
    const bus = new EventBus();
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const stop = setupWebhookTransport({
      bus,
      urls: [],
      timeoutMs: 1_000,
    });

    bus.publish(EVENT_PAYLOAD);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(fetchMock).not.toHaveBeenCalled();
    stop();
  });

  test("abort is triggered for in-flight requests on stop and stop is idempotent", async () => {
    const bus = new EventBus();
    let aborted = false;
    const fetchMock = vi.fn(
      (_input: string | URL | RequestInfo, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            aborted = true;
            reject(new Error("aborted by stop"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const stop = setupWebhookTransport({
      bus,
      urls: ["https://hooks.example/slow"],
      timeoutMs: 10_000,
    });

    bus.publish(EVENT_PAYLOAD);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    stop();
    stop();

    await waitFor(() => {
      expect(aborted).toBe(true);
    });
  });

  test("fans out one event to websocket, sse, and webhook", async () => {
    const bus = new EventBus();
    const realFetch = globalThis.fetch;
    const gateway = { call: vi.fn(async () => []) };
    const app = createApp({
      gateway,
      bus,
      auth: { enabled: false },
    });
    const server = createServer(app);
    const stopWsTransport = setupWebSocketTransport({
      server,
      bus,
      gateway,
      auth: { enabled: false },
    });

    const fetchMock = vi.fn(async () => new Response("ok", { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const stopWebhookTransport = setupWebhookTransport({
      bus,
      urls: ["https://hooks.example/a"],
      timeoutMs: 1_000,
    });

    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unexpected server address");
    }

    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
    await waitForWsOpen(ws);
    const sseRes = await realFetch(`http://127.0.0.1:${address.port}/events/sse`);
    const reader = sseRes.body?.getReader();
    if (!reader) {
      throw new Error("SSE response body is missing");
    }
    await waitForSseFrame(reader, /: (.+)\n\n/);

    bus.publish(EVENT_PAYLOAD);

    const wsPayload = await waitForWsMessage<{ method: string }>(ws);
    const sseRaw = await waitForSseFrame(reader, /data: (.+)\n\n/);
    const ssePayload = JSON.parse(sseRaw) as { method: string };

    expect(wsPayload.method).toBe("onCreated");
    expect(ssePayload.method).toBe("onCreated");
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await reader.cancel();
    ws.close();
    stopWebhookTransport();
    stopWsTransport();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
