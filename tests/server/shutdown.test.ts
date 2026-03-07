import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type Listener = (...args: unknown[]) => void;

type FakeSocket = {
  destroy: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
};

type FakeServer = {
  listen: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  emitConnection: (socket: FakeSocket) => void;
};

function createFakeServer(): FakeServer {
  let connectionHandler: ((socket: FakeSocket) => void) | null = null;

  return {
    listen: vi.fn((_port: number, cb?: () => void) => {
      cb?.();
    }),
    close: vi.fn((_cb?: () => void) => {
      // Intentionally never calling callback to simulate hanging keep-alive/SSE.
    }),
    on: vi.fn((event: string, handler: Listener) => {
      if (event === "connection") {
        connectionHandler = handler as (socket: FakeSocket) => void;
      }
      return undefined;
    }),
    off: vi.fn(),
    emitConnection: (socket: FakeSocket) => {
      connectionHandler?.(socket);
    },
  };
}

describe("startServer shutdown", () => {
  let sigintBefore: Set<Listener>;
  let sigtermBefore: Set<Listener>;

  beforeEach(() => {
    vi.useFakeTimers();
    sigintBefore = new Set(process.listeners("SIGINT") as Listener[]);
    sigtermBefore = new Set(process.listeners("SIGTERM") as Listener[]);
  });

  afterEach(() => {
    for (const listener of process.listeners("SIGINT") as Listener[]) {
      if (!sigintBefore.has(listener)) {
        process.removeListener("SIGINT", listener as (...args: any[]) => void);
      }
    }
    for (const listener of process.listeners("SIGTERM") as Listener[]) {
      if (!sigtermBefore.has(listener)) {
        process.removeListener("SIGTERM", listener as (...args: any[]) => void);
      }
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  test("forces exit and destroys sockets when server.close hangs", async () => {
    const fakeServer = createFakeServer();
    const stopEvents = vi.fn();
    const stopWebhookTransport = vi.fn();
    let onDisconnect: ((error: Error) => void) | null = null;

    vi.doMock("node:http", () => ({
      createServer: vi.fn(() => fakeServer),
    }));
    vi.doMock("../../src/cdp/client", () => ({
      createBookmarksGateway: vi.fn(() => ({ call: vi.fn() })),
      startBookmarksEventStream: vi.fn(async (_onEvent, options) => {
        onDisconnect = options.onDisconnect;
        return stopEvents;
      }),
    }));
    vi.doMock("../../src/config/env", () => ({
      resolveStartupConfig: vi.fn(() => ({
        port: 3000,
        chromeProfileDir: "/tmp/chrome-profile",
        auth: { enabled: false },
      })),
    }));
    vi.doMock("../../src/server/app", () => ({
      createApp: vi.fn(() => ({})),
    }));
    vi.doMock("../../src/server/webhook", () => ({
      setupWebhookTransport: vi.fn(() => stopWebhookTransport),
    }));

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { startServer } = await import("../../src/server/index");
    await startServer();

    const socket: FakeSocket = {
      destroy: vi.fn(),
      on: vi.fn(),
    };
    fakeServer.emitConnection(socket);
    const activeSocket: FakeSocket = {
      destroy: vi.fn(),
      on: vi.fn(),
    };
    fakeServer.emitConnection(activeSocket);
    const closeHandler = socket.on.mock.calls.find(
      ([event]) => event === "close",
    )?.[1] as (() => void) | undefined;
    closeHandler?.();

    process.emit("SIGTERM");
    process.emit("SIGTERM");

    expect(stopEvents).toHaveBeenCalledTimes(1);
    expect(stopWebhookTransport).toHaveBeenCalledTimes(1);
    expect(activeSocket.destroy).toHaveBeenCalledTimes(1);
    expect(fakeServer.close).toHaveBeenCalledTimes(1);

    expect(exitSpy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  test("clears reconnect timer on shutdown", async () => {
    const fakeServer = {
      listen: vi.fn((_port: number, cb?: () => void) => cb?.()),
      close: vi.fn((cb?: () => void) => cb?.()),
      on: vi.fn(),
      off: vi.fn(),
    };

    const startEventMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("connect failed"));

    vi.doMock("node:http", () => ({
      createServer: vi.fn(() => fakeServer),
    }));
    vi.doMock("../../src/cdp/client", () => ({
      createBookmarksGateway: vi.fn(() => ({ call: vi.fn() })),
      startBookmarksEventStream: startEventMock,
    }));
    vi.doMock("../../src/config/env", () => ({
      resolveStartupConfig: vi.fn(() => ({
        port: 3010,
        chromeProfileDir: "/tmp/profile",
        auth: { enabled: false },
      })),
    }));
    vi.doMock("../../src/server/app", () => ({
      createApp: vi.fn(() => ({})),
    }));

    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { startServer } = await import("../../src/server/index");
    await startServer();

    process.emit("SIGINT");

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  test("logs auth mode off and exits via close callback", async () => {
    const fakeServer = {
      listen: vi.fn((_port: number, cb?: () => void) => cb?.()),
      close: vi.fn((cb?: () => void) => cb?.()),
      on: vi.fn(),
      off: vi.fn(),
    };

    vi.doMock("node:http", () => ({
      createServer: vi.fn(() => fakeServer),
    }));
    vi.doMock("../../src/cdp/client", () => ({
      createBookmarksGateway: vi.fn(() => ({ call: vi.fn() })),
      startBookmarksEventStream: vi.fn(async () => vi.fn()),
    }));
    vi.doMock("../../src/config/env", () => ({
      resolveStartupConfig: vi.fn(() => ({
        port: 3001,
        chromeProfileDir: "/tmp/profile",
        auth: { enabled: false },
      })),
    }));
    vi.doMock("../../src/server/app", () => ({
      createApp: vi.fn(() => ({})),
    }));

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const { startServer } = await import("../../src/server/index");
    await startServer();
    process.emit("SIGINT");

    expect(logSpy).toHaveBeenCalledWith("service listening on :3001");
    expect(logSpy).toHaveBeenCalledWith("auth mode: off");
    expect(logSpy).toHaveBeenCalledWith("chrome profile dir: /tmp/profile");
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  test("reconnects after event stream failure and logs provided token mode", async () => {
    const fakeServer = {
      listen: vi.fn((_port: number, cb?: () => void) => cb?.()),
      close: vi.fn((_cb?: () => void) => undefined),
      on: vi.fn(),
      off: vi.fn(),
    };

    const startEventMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("first connect failed"))
      .mockResolvedValueOnce(vi.fn());

    vi.doMock("node:http", () => ({
      createServer: vi.fn(() => fakeServer),
    }));
    vi.doMock("../../src/cdp/client", () => ({
      createBookmarksGateway: vi.fn(() => ({ call: vi.fn() })),
      startBookmarksEventStream: startEventMock,
    }));
    vi.doMock("../../src/config/env", () => ({
      resolveStartupConfig: vi.fn(() => ({
        port: 3002,
        chromeProfileDir: "/tmp/profile2",
        auth: { enabled: true, token: "provided", generated: false },
      })),
    }));
    vi.doMock("../../src/server/app", () => ({
      createApp: vi.fn(() => ({})),
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { startServer } = await import("../../src/server/index");
    await startServer();

    expect(startEventMock).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith(
      "bookmark event stream: disconnected (first connect failed)",
    );

    await vi.advanceTimersByTimeAsync(2_000);
    expect(startEventMock).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledWith(
      "auth mode: bearer token (provided via AUTH_TOKEN)",
    );
    expect(logSpy).toHaveBeenCalledWith("bookmark event stream: connected");
  });

  test("logs generated auth token and avoids duplicate reconnect scheduling", async () => {
    const fakeServer = {
      listen: vi.fn((_port: number, cb?: () => void) => cb?.()),
      close: vi.fn((_cb?: () => void) => undefined),
      on: vi.fn(),
      off: vi.fn(),
    };

    let disconnectHandler: ((error: Error) => void) | undefined;
    const startEventMock = vi.fn(
      async (_onEvent, opts: { onDisconnect?: (error: Error) => void }) => {
        disconnectHandler = opts.onDisconnect;
        return vi.fn();
      },
    );

    vi.doMock("node:http", () => ({
      createServer: vi.fn(() => fakeServer),
    }));
    vi.doMock("../../src/cdp/client", () => ({
      createBookmarksGateway: vi.fn(() => ({ call: vi.fn() })),
      startBookmarksEventStream: startEventMock,
    }));
    vi.doMock("../../src/config/env", () => ({
      resolveStartupConfig: vi.fn(() => ({
        port: 3003,
        chromeProfileDir: "/tmp/profile3",
        auth: { enabled: true, token: "generated-token", generated: true },
      })),
    }));
    vi.doMock("../../src/server/app", () => ({
      createApp: vi.fn(() => ({})),
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { startServer } = await import("../../src/server/index");
    await startServer();

    disconnectHandler?.(new Error("detached once"));
    disconnectHandler?.(new Error("detached twice"));

    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("AUTH_TOKEN_GENERATED=generated-token");
  });

  test("publishes bookmark events from stream callback", async () => {
    const fakeServer = {
      listen: vi.fn((_port: number, cb?: () => void) => cb?.()),
      close: vi.fn((_cb?: () => void) => undefined),
      on: vi.fn(),
      off: vi.fn(),
    };

    let streamHandler: ((event: unknown) => void) | undefined;
    const startEventMock = vi.fn(async (onEvent: (event: unknown) => void) => {
      streamHandler = onEvent;
      return vi.fn();
    });

    const publishSpy = vi.fn();
    vi.doMock("node:http", () => ({
      createServer: vi.fn(() => fakeServer),
    }));
    vi.doMock("../../src/cdp/client", () => ({
      createBookmarksGateway: vi.fn(() => ({ call: vi.fn() })),
      startBookmarksEventStream: startEventMock,
    }));
    vi.doMock("../../src/config/env", () => ({
      resolveStartupConfig: vi.fn(() => ({
        port: 3030,
        chromeProfileDir: "/tmp/profile3",
        auth: { enabled: false },
      })),
    }));
    vi.doMock("../../src/server/app", () => ({
      createApp: vi.fn(({ bus }) => {
        vi.spyOn(bus, "publish").mockImplementation(publishSpy);
        return {};
      }),
    }));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { startServer } = await import("../../src/server/index");
    await startServer();

    const eventPayload = {
      ts: "2026-03-06T00:00:00.000Z",
      eventName: "onCreated",
      args: [],
    };
    streamHandler?.(eventPayload);
    expect(publishSpy).toHaveBeenCalledWith(eventPayload);
  });

  test("skips reconnect attempt callback when shutdown happens first", async () => {
    const fakeServer = {
      listen: vi.fn((_port: number, cb?: () => void) => cb?.()),
      close: vi.fn((cb?: () => void) => cb?.()),
      on: vi.fn(),
      off: vi.fn(),
    };

    const startEventMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("connect failed"));

    vi.doMock("node:http", () => ({
      createServer: vi.fn(() => fakeServer),
    }));
    vi.doMock("../../src/cdp/client", () => ({
      createBookmarksGateway: vi.fn(() => ({ call: vi.fn() })),
      startBookmarksEventStream: startEventMock,
    }));
    vi.doMock("../../src/config/env", () => ({
      resolveStartupConfig: vi.fn(() => ({
        port: 3031,
        chromeProfileDir: "/tmp/profile4",
        auth: { enabled: false },
      })),
    }));
    vi.doMock("../../src/server/app", () => ({
      createApp: vi.fn(() => ({})),
    }));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "clearTimeout").mockImplementation(() => undefined);
    vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);

    const { startServer } = await import("../../src/server/index");
    await startServer();
    process.emit("SIGTERM");
    await vi.advanceTimersByTimeAsync(2_000);

    expect(startEventMock).toHaveBeenCalledTimes(1);
  });

  test("string rejections from event stream are stringified in reconnect log", async () => {
    const fakeServer = {
      listen: vi.fn((_port: number, cb?: () => void) => cb?.()),
      close: vi.fn((_cb?: () => void) => undefined),
      on: vi.fn(),
      off: vi.fn(),
    };

    const startEventMock = vi.fn().mockRejectedValueOnce("plain failure");

    vi.doMock("node:http", () => ({
      createServer: vi.fn(() => fakeServer),
    }));
    vi.doMock("../../src/cdp/client", () => ({
      createBookmarksGateway: vi.fn(() => ({ call: vi.fn() })),
      startBookmarksEventStream: startEventMock,
    }));
    vi.doMock("../../src/config/env", () => ({
      resolveStartupConfig: vi.fn(() => ({
        port: 3032,
        chromeProfileDir: "/tmp/profile5",
        auth: { enabled: false },
      })),
    }));
    vi.doMock("../../src/server/app", () => ({
      createApp: vi.fn(() => ({})),
    }));
    const errSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const { startServer } = await import("../../src/server/index");
    await startServer();

    expect(errSpy).toHaveBeenCalledWith(
      "bookmark event stream: disconnected (plain failure)",
    );
  });
});
