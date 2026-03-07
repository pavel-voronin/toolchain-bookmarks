import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type ListenerEntry = {
  cb: (event?: any) => void;
  once: boolean;
};

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static onSend: ((ws: FakeWebSocket, payload: any) => void) | null = null;

  url: string;
  sent: string[] = [];
  closed = false;
  private listeners = new Map<string, ListenerEntry[]>();

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(
    event: string,
    cb: (event?: any) => void,
    opts?: { once?: boolean },
  ): void {
    const entries = this.listeners.get(event) ?? [];
    entries.push({ cb, once: Boolean(opts?.once) });
    this.listeners.set(event, entries);
  }

  send(raw: string): void {
    this.sent.push(raw);
    if (FakeWebSocket.onSend) {
      FakeWebSocket.onSend(this, JSON.parse(raw));
    }
  }

  close(): void {
    this.closed = true;
    this.emit("close", {});
  }

  emit(event: string, payload: any): void {
    const entries = [...(this.listeners.get(event) ?? [])];
    entries.forEach((entry) => {
      entry.cb(payload);
      if (entry.once) {
        const current = this.listeners.get(event) ?? [];
        this.listeners.set(
          event,
          current.filter((item) => item.cb !== entry.cb),
        );
      }
    });
  }
}

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

function reply(ws: FakeWebSocket, id: number, result: unknown): void {
  ws.emit("message", { data: JSON.stringify({ id, result }) });
}

describe("cdp client", () => {
  async function waitForWs(index = 0): Promise<FakeWebSocket> {
    for (let i = 0; i < 20; i += 1) {
      const ws = FakeWebSocket.instances[index];
      if (ws) {
        return ws;
      }
      await Promise.resolve();
    }
    throw new Error(`WebSocket instance #${index} was not created`);
  }

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    FakeWebSocket.instances = [];
    FakeWebSocket.onSend = null;
    vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test("ensureBridgeTarget fails when /json/list payload is not an array", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ bad: true }),
    );

    const { ensureBridgeTarget } = await import("../../src/cdp/client");
    await expect(ensureBridgeTarget()).rejects.toThrow(
      "Unexpected CDP /json/list payload",
    );
  });

  test("ensureBridgeTarget fails when CDP endpoint returns non-ok status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}, 500));

    const { ensureBridgeTarget } = await import("../../src/cdp/client");
    await expect(ensureBridgeTarget()).rejects.toThrow("HTTP 500");
  });

  test("ensureBridgeTarget fails when tab cannot be created", async () => {
    let listCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/json/list")) {
        listCalls += 1;
        return jsonResponse([]);
      }
      if (url.includes("/json/new?")) {
        return jsonResponse({});
      }
      throw new Error(`unexpected url ${url}`);
    });

    const { ensureBridgeTarget } = await import("../../src/cdp/client");
    await expect(ensureBridgeTarget()).rejects.toThrow(
      "Failed to create chrome://bookmarks tab",
    );
    expect(listCalls).toBe(2);
  });

  test("callBookmarksApi rejects unsupported methods", async () => {
    const { callBookmarksApi } = await import("../../src/cdp/client");
    await expect(callBookmarksApi("unknown", [])).rejects.toThrow(
      "Unsupported API method: unknown",
    );
  });

  test("callBookmarksApi returns parsed result on successful evaluate", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([
        {
          id: "tab-1",
          type: "page",
          url: "chrome://bookmarks/",
          webSocketDebuggerUrl: "ws://target",
        },
      ]),
    );

    const { callBookmarksApi } = await import("../../src/cdp/client");
    const promise = callBookmarksApi("getTree", []);

    const ws = await waitForWs();
    ws.emit("open", {});
    ws.emit("message", {
      data: JSON.stringify({
        id: 2,
        result: { result: { value: "ignored" } },
      }),
    });
    ws.emit("message", {
      data: JSON.stringify({
        id: 1,
        result: {
          result: {
            value: JSON.stringify({ ok: true, result: [{ id: "0" }] }),
          },
        },
      }),
    });

    await expect(promise).resolves.toEqual([{ id: "0" }]);
  });

  test("callBookmarksApi surfaces evaluate protocol error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([
        {
          id: "tab-1",
          type: "page",
          url: "chrome://bookmarks/",
          webSocketDebuggerUrl: "ws://target",
        },
      ]),
    );

    const { callBookmarksApi } = await import("../../src/cdp/client");
    const promise = callBookmarksApi("getTree", []);

    const ws = await waitForWs();
    ws.emit("open", {});
    ws.emit("message", {
      data: JSON.stringify({ id: 1, error: { message: "eval failed" } }),
    });

    await expect(promise).rejects.toThrow("eval failed");
  });

  test("callBookmarksApi surfaces evaluate exception details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([
        {
          id: "tab-1",
          type: "page",
          url: "chrome://bookmarks/",
          webSocketDebuggerUrl: "ws://target",
        },
      ]),
    );

    const { callBookmarksApi } = await import("../../src/cdp/client");
    const promise = callBookmarksApi("getTree", []);

    const ws = await waitForWs();
    ws.emit("open", {});
    ws.emit("message", {
      data: JSON.stringify({
        id: 1,
        result: {
          exceptionDetails: {
            exception: { description: "boom in bookmarks api" },
          },
        },
      }),
    });

    await expect(promise).rejects.toThrow("boom in bookmarks api");
  });

  test("callBookmarksApi uses exception text when description is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([
        {
          id: "tab-1",
          type: "page",
          url: "chrome://bookmarks/",
          webSocketDebuggerUrl: "ws://target",
        },
      ]),
    );

    const { callBookmarksApi } = await import("../../src/cdp/client");
    const promise = callBookmarksApi("getTree", []);

    const ws = await waitForWs();
    ws.emit("open", {});
    ws.emit("message", {
      data: JSON.stringify({
        id: 1,
        result: {
          exceptionDetails: {
            text: "runtime explode",
          },
        },
      }),
    });

    await expect(promise).rejects.toThrow("runtime explode");
  });

  test("callBookmarksApi falls back to generic evaluate error message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([
        {
          id: "tab-1",
          type: "page",
          url: "chrome://bookmarks/",
          webSocketDebuggerUrl: "ws://target",
        },
      ]),
    );

    const { callBookmarksApi } = await import("../../src/cdp/client");
    const promise = callBookmarksApi("getTree", []);

    const ws = await waitForWs();
    ws.emit("open", {});
    ws.emit("message", {
      data: JSON.stringify({
        id: 1,
        result: {
          exceptionDetails: {},
        },
      }),
    });

    await expect(promise).rejects.toThrow("Runtime.evaluate failed");
  });

  test("callBookmarksApi handles WebSocket error in evaluate", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([
        {
          id: "tab-1",
          type: "page",
          url: "chrome://bookmarks/",
          webSocketDebuggerUrl: "ws://target",
        },
      ]),
    );

    const { callBookmarksApi } = await import("../../src/cdp/client");
    const promise = callBookmarksApi("getTree", []);

    const ws = await waitForWs();
    ws.emit("error", {});
    await expect(promise).rejects.toThrow("CDP WebSocket error");
  });

  test("callBookmarksApi times out evaluate requests", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([
        {
          id: "tab-1",
          type: "page",
          url: "chrome://bookmarks/",
          webSocketDebuggerUrl: "ws://target",
        },
      ]),
    );

    const { callBookmarksApi } = await import("../../src/cdp/client");
    const promise = callBookmarksApi("getTree", []);
    const ws = await waitForWs();
    ws.emit("open", {});

    const rejection = expect(promise).rejects.toThrow(
      "CDP Runtime.evaluate timeout",
    );
    await vi.advanceTimersByTimeAsync(8_000);
    await rejection;
    vi.useRealTimers();
  });

  test("callBookmarksApi throws when evaluate response indicates failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([
        {
          id: "tab-1",
          type: "page",
          url: "chrome://bookmarks/",
          webSocketDebuggerUrl: "ws://target",
        },
      ]),
    );

    const { callBookmarksApi } = await import("../../src/cdp/client");
    const promise = callBookmarksApi("getTree", []);

    const ws = await waitForWs();
    ws.emit("open", {});
    ws.emit("message", {
      data: JSON.stringify({
        id: 1,
        result: {
          result: {
            value: JSON.stringify({ ok: false, error: "chrome api failed" }),
          },
        },
      }),
    });

    await expect(promise).rejects.toThrow("chrome api failed");
  });

  test("callBookmarksApi uses default failure message when error is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([
        {
          id: "tab-1",
          type: "page",
          url: "chrome://bookmarks/",
          webSocketDebuggerUrl: "ws://target",
        },
      ]),
    );

    const { callBookmarksApi } = await import("../../src/cdp/client");
    const promise = callBookmarksApi("getTree", []);

    const ws = await waitForWs();
    ws.emit("open", {});
    ws.emit("message", {
      data: JSON.stringify({
        id: 1,
        result: {
          result: {
            value: { ok: false },
          },
        },
      }),
    });

    await expect(promise).rejects.toThrow("Bookmarks API call failed");
  });

  test("createBookmarksGateway delegates to callBookmarksApi", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([
        {
          id: "tab-1",
          type: "page",
          url: "chrome://bookmarks/",
          webSocketDebuggerUrl: "ws://target",
        },
      ]),
    );
    const { createBookmarksGateway } = await import("../../src/cdp/client");

    const promise = createBookmarksGateway().call("getTree", []);
    const ws = await waitForWs();
    ws.emit("open", {});
    ws.emit("message", {
      data: JSON.stringify({
        id: 1,
        result: {
          result: {
            value: JSON.stringify({ ok: true, result: [] }),
          },
        },
      }),
    });

    await expect(promise).resolves.toEqual([]);
  });

  test("startBookmarksEventStream wires events and disconnect callbacks", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/json/version")) {
        return jsonResponse({ webSocketDebuggerUrl: "ws://browser" });
      }
      if (url.endsWith("/json/list")) {
        return jsonResponse([
          {
            id: "tab-1",
            type: "page",
            url: "chrome://bookmarks/",
            webSocketDebuggerUrl: "ws://target",
          },
        ]);
      }
      throw new Error(`unexpected url ${url}`);
    });

    let readyProbeCount = 0;
    FakeWebSocket.onSend = (ws, payload) => {
      const method = payload.method as string;
      if (method === "Target.attachToTarget") {
        reply(ws, payload.id, { sessionId: "session-1" });
        return;
      }
      if (method === "Runtime.enable" || method === "Page.enable") {
        reply(ws, payload.id, {});
        return;
      }
      if (method === "Runtime.evaluate") {
        const expression = String(payload.params?.expression ?? "");
        if (expression.includes("Boolean(globalThis.chrome")) {
          readyProbeCount += 1;
          reply(ws, payload.id, {
            result: { value: readyProbeCount > 1 },
          });
          return;
        }
        reply(ws, payload.id, {
          result: { value: { ok: true } },
        });
        return;
      }
      if (method === "Runtime.addBinding") {
        reply(ws, payload.id, {});
      }
    };

    const onEvent = vi.fn();
    const onDisconnect = vi.fn();
    const { startBookmarksEventStream } = await import("../../src/cdp/client");
    const promise = startBookmarksEventStream(onEvent, { onDisconnect });

    const ws = await waitForWs();
    ws.emit("open", {});

    const stop = await promise;

    ws.emit("message", { data: "not-json" });
    ws.emit("message", {
      data: JSON.stringify({
        method: "Page.frameStoppedLoading",
        sessionId: "session-1",
      }),
    });
    ws.emit("message", {
      data: JSON.stringify({
        id: 999,
        result: {},
      }),
    });
    ws.emit("message", {
      data: JSON.stringify({
        method: "Runtime.bindingCalled",
        sessionId: "another-session",
        params: {
          name: "__cdpBookmarkEvent",
          payload: "{}",
        },
      }),
    });
    ws.emit("message", {
      data: JSON.stringify({
        method: "Runtime.bindingCalled",
        sessionId: "session-1",
        params: undefined,
      }),
    });
    ws.emit("message", {
      data: JSON.stringify({
        method: "Runtime.bindingCalled",
        sessionId: "session-1",
        params: {
          name: "__wrongBinding",
          payload: "{}",
        },
      }),
    });
    ws.emit("message", {
      data: JSON.stringify({
        method: "Runtime.bindingCalled",
        sessionId: "session-1",
        params: {
          name: "__cdpBookmarkEvent",
        },
      }),
    });
    ws.emit("message", {
      data: JSON.stringify({
        method: "Runtime.bindingCalled",
        sessionId: "session-1",
        params: {
          name: "__cdpBookmarkEvent",
          payload: "{bad",
        },
      }),
    });
    ws.emit("message", {
      data: JSON.stringify({
        method: "Runtime.bindingCalled",
        sessionId: "session-1",
        params: {
          name: "__cdpBookmarkEvent",
          payload: JSON.stringify({
            ts: "2026-03-06T00:00:00.000Z",
            eventName: "onCreated",
            args: ["1", { id: "1" }],
          }),
        },
      }),
    });
    expect(onEvent).toHaveBeenCalledTimes(1);

    ws.emit("message", {
      data: JSON.stringify({
        method: "Inspector.detached",
        sessionId: "session-1",
      }),
    });
    ws.emit("close", {});
    expect(onDisconnect).toHaveBeenCalledTimes(1);

    stop();
  });

  test("startBookmarksEventStream throws when attach response has no sessionId", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/json/version")) {
        return jsonResponse({ webSocketDebuggerUrl: "ws://browser" });
      }
      if (url.endsWith("/json/list")) {
        return jsonResponse([
          {
            id: "tab-1",
            type: "page",
            url: "chrome://bookmarks/",
            webSocketDebuggerUrl: "ws://target",
          },
        ]);
      }
      throw new Error(`unexpected url ${url}`);
    });

    FakeWebSocket.onSend = (ws, payload) => {
      if (payload.method === "Target.attachToTarget") {
        reply(ws, payload.id, {});
      }
    };

    const { startBookmarksEventStream } = await import("../../src/cdp/client");
    const promise = startBookmarksEventStream(vi.fn());
    const ws = await waitForWs();
    ws.emit("open", {});

    await expect(promise).rejects.toThrow("Failed to attach bookmarks target");
    expect(ws.closed).toBe(true);
  });

  test("startBookmarksEventStream handles empty CDP response payload objects", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/json/version")) {
        return jsonResponse({ webSocketDebuggerUrl: "ws://browser" });
      }
      if (url.endsWith("/json/list")) {
        return jsonResponse([
          {
            id: "tab-1",
            type: "page",
            url: "chrome://bookmarks/",
            webSocketDebuggerUrl: "ws://target",
          },
        ]);
      }
      throw new Error(`unexpected url ${url}`);
    });

    FakeWebSocket.onSend = (ws, payload) => {
      if (payload.method === "Target.attachToTarget") {
        ws.emit("message", { data: JSON.stringify({ id: payload.id }) });
      }
    };

    const { startBookmarksEventStream } = await import("../../src/cdp/client");
    const promise = startBookmarksEventStream(vi.fn());
    const ws = await waitForWs();
    ws.emit("open", {});

    await expect(promise).rejects.toThrow("Failed to attach bookmarks target");
  });

  test("startBookmarksEventStream surfaces protocol error from pending command", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/json/version")) {
        return jsonResponse({ webSocketDebuggerUrl: "ws://browser" });
      }
      if (url.endsWith("/json/list")) {
        return jsonResponse([
          {
            id: "tab-1",
            type: "page",
            url: "chrome://bookmarks/",
            webSocketDebuggerUrl: "ws://target",
          },
        ]);
      }
      throw new Error(`unexpected url ${url}`);
    });

    FakeWebSocket.onSend = (ws, payload) => {
      if (payload.method === "Target.attachToTarget") {
        ws.emit("message", {
          data: JSON.stringify({
            id: payload.id,
            error: { message: "attach exploded" },
          }),
        });
      }
    };

    const { startBookmarksEventStream } = await import("../../src/cdp/client");
    const promise = startBookmarksEventStream(vi.fn());
    const ws = await waitForWs();
    ws.emit("open", {});

    await expect(promise).rejects.toThrow("attach exploded");
  });

  test("startBookmarksEventStream throws when bindings install fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/json/version")) {
        return jsonResponse({ webSocketDebuggerUrl: "ws://browser" });
      }
      if (url.endsWith("/json/list")) {
        return jsonResponse([
          {
            id: "tab-1",
            type: "page",
            url: "chrome://bookmarks/",
            webSocketDebuggerUrl: "ws://target",
          },
        ]);
      }
      throw new Error(`unexpected url ${url}`);
    });

    FakeWebSocket.onSend = (ws, payload) => {
      if (payload.method === "Target.attachToTarget") {
        reply(ws, payload.id, { sessionId: "session-1" });
        return;
      }
      if (
        payload.method === "Runtime.enable" ||
        payload.method === "Page.enable" ||
        payload.method === "Runtime.addBinding"
      ) {
        reply(ws, payload.id, {});
        return;
      }
      if (payload.method === "Runtime.evaluate") {
        const expression = String(payload.params?.expression ?? "");
        if (expression.includes("Boolean(globalThis.chrome")) {
          reply(ws, payload.id, { result: { value: true } });
          return;
        }
        reply(ws, payload.id, { result: { value: { ok: false } } });
      }
    };

    const { startBookmarksEventStream } = await import("../../src/cdp/client");
    const promise = startBookmarksEventStream(vi.fn());
    const ws = await waitForWs();
    ws.emit("open", {});

    await expect(promise).rejects.toThrow(
      "Failed to install bookmarks listeners: unknown error",
    );
  });

  test("startBookmarksEventStream times out waiting for bookmarks api readiness", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/json/version")) {
        return jsonResponse({ webSocketDebuggerUrl: "ws://browser" });
      }
      if (url.endsWith("/json/list")) {
        return jsonResponse([
          {
            id: "tab-1",
            type: "page",
            url: "chrome://bookmarks/",
            webSocketDebuggerUrl: "ws://target",
          },
        ]);
      }
      throw new Error(`unexpected url ${url}`);
    });

    FakeWebSocket.onSend = (ws, payload) => {
      if (payload.method === "Target.attachToTarget") {
        reply(ws, payload.id, { sessionId: "session-1" });
        return;
      }
      if (
        payload.method === "Runtime.enable" ||
        payload.method === "Page.enable"
      ) {
        reply(ws, payload.id, {});
        return;
      }
      if (payload.method === "Runtime.evaluate") {
        reply(ws, payload.id, { result: { value: false } });
      }
    };

    const { startBookmarksEventStream } = await import("../../src/cdp/client");
    const promise = startBookmarksEventStream(vi.fn());
    const ws = await waitForWs();
    ws.emit("open", {});

    const rejection = expect(promise).rejects.toThrow(
      "Timed out waiting for chrome.bookmarks API to become ready",
    );
    await vi.advanceTimersByTimeAsync(10_000);
    await rejection;
    vi.useRealTimers();
  });

  test("startBookmarksEventStream propagates browser websocket close for pending call", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/json/version")) {
        return jsonResponse({ webSocketDebuggerUrl: "ws://browser" });
      }
      if (url.endsWith("/json/list")) {
        return jsonResponse([
          {
            id: "tab-1",
            type: "page",
            url: "chrome://bookmarks/",
            webSocketDebuggerUrl: "ws://target",
          },
        ]);
      }
      throw new Error(`unexpected url ${url}`);
    });

    FakeWebSocket.onSend = (ws, payload) => {
      if (payload.method === "Target.attachToTarget") {
        ws.emit("close", {});
      }
    };

    const { startBookmarksEventStream } = await import("../../src/cdp/client");
    const promise = startBookmarksEventStream(vi.fn());
    const ws = await waitForWs();
    ws.emit("open", {});

    await expect(promise).rejects.toThrow(
      "CDP browser WebSocket closed for request id=1",
    );
  });

  test("startBookmarksEventStream fails when browser websocket URL is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/json/version")) {
        return jsonResponse({});
      }
      throw new Error(`unexpected url ${url}`);
    });

    const { startBookmarksEventStream } = await import("../../src/cdp/client");
    await expect(startBookmarksEventStream(vi.fn())).rejects.toThrow(
      "CDP webSocketDebuggerUrl missing",
    );
  });

  test("startBookmarksEventStream fails when browser websocket emits open error", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/json/version")) {
        return jsonResponse({ webSocketDebuggerUrl: "ws://browser" });
      }
      throw new Error(`unexpected url ${url}`);
    });

    const { startBookmarksEventStream } = await import("../../src/cdp/client");
    const promise = startBookmarksEventStream(vi.fn());
    const ws = await waitForWs();
    ws.emit("error", {});

    await expect(promise).rejects.toThrow("CDP WebSocket error");
  });
});
