import type { RuntimeConfig } from "../types/config";
import { callMockBookmarksApi } from "./mock";

const API_METHODS = new Set([
  "create",
  "get",
  "getChildren",
  "getRecent",
  "getSubTree",
  "getTree",
  "move",
  "remove",
  "removeTree",
  "search",
  "update",
  "__ping",
]);

const CDP_EVAL_TIMEOUT_MS = 8000;

type CdpTarget = {
  id: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
};

type CdpMessage = {
  id?: number;
  method?: string;
  sessionId?: string;
  result?: Record<string, unknown>;
  params?: Record<string, unknown>;
  error?: { message?: string };
};

export type BookmarksApiStreamEvent = {
  ts: string;
  eventName: string;
  args: unknown[];
};

const BOOKMARKS_PAGE_URL = "chrome://bookmarks/";

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

async function listTargets(cdpHttp: string): Promise<CdpTarget[]> {
  const payload = await fetchJson(`${cdpHttp}/json/list`);
  if (!Array.isArray(payload)) {
    throw new Error("Unexpected CDP /json/list payload");
  }
  return payload as CdpTarget[];
}

function isBookmarksPageTarget(target: CdpTarget): boolean {
  return (
    target.type === "page" &&
    (target.url === BOOKMARKS_PAGE_URL ||
      target.url.startsWith("chrome://bookmarks"))
  );
}

async function ensureBridgeTarget(config: RuntimeConfig): Promise<CdpTarget> {
  let targets = await listTargets(config.CDP_HTTP);
  let matches = targets.filter(isBookmarksPageTarget);

  if (matches.length === 0) {
    await fetchJson(
      `${config.CDP_HTTP}/json/new?${encodeURIComponent(BOOKMARKS_PAGE_URL)}`,
      { method: "PUT" },
    );
    targets = await listTargets(config.CDP_HTTP);
    matches = targets.filter(isBookmarksPageTarget);
  }

  if (matches.length === 0) {
    throw new Error("Failed to create chrome://bookmarks tab");
  }

  const keep = matches[0];
  await Promise.all(
    matches
      .slice(1)
      .map((target) =>
        fetch(`${config.CDP_HTTP}/json/close/${target.id}`).catch(
          () => undefined,
        ),
      ),
  );

  return keep;
}

async function cdpEvaluate(
  wsUrl: string,
  expression: string,
): Promise<unknown> {
  const ws = new WebSocket(wsUrl);
  const requestId = 1;

  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("CDP Runtime.evaluate timeout"));
    }, CDP_EVAL_TIMEOUT_MS);

    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify({
          id: requestId,
          method: "Runtime.evaluate",
          params: { expression, awaitPromise: true, returnByValue: true },
        }),
      );
    });

    ws.addEventListener("message", (event) => {
      const payload = JSON.parse(String(event.data)) as {
        id?: number;
        error?: { message?: string };
        result?: {
          result?: { value?: unknown };
          exceptionDetails?: {
            text?: string;
            exception?: { description?: string };
          };
        };
      };

      if (payload.id !== requestId) {
        return;
      }

      clearTimeout(timeout);
      ws.close();

      if (payload.error?.message) {
        reject(new Error(payload.error.message));
        return;
      }
      if (payload.result?.exceptionDetails) {
        reject(
          new Error(
            payload.result.exceptionDetails.exception?.description ??
              payload.result.exceptionDetails.text ??
              "Runtime.evaluate failed",
          ),
        );
        return;
      }

      resolve(payload.result?.result?.value);
    });

    ws.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("CDP WebSocket error"));
    });
  });
}

class BrowserCdp {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private eventHandlers: Array<(msg: CdpMessage) => void> = [];
  private closeHandlers: Array<() => void> = [];

  private constructor(ws: WebSocket) {
    this.ws = ws;
  }

  static async connect(cdpHttp: string): Promise<BrowserCdp> {
    const version = (await fetchJson(`${cdpHttp}/json/version`)) as {
      webSocketDebuggerUrl?: string;
    };
    if (!version.webSocketDebuggerUrl) {
      throw new Error("CDP webSocketDebuggerUrl missing");
    }

    const ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve(), { once: true });
      ws.addEventListener("error", () => reject(new Error("CDP WebSocket error")), {
        once: true,
      });
    });

    const client = new BrowserCdp(ws);
    ws.addEventListener("message", (event) => {
      let payload: CdpMessage;
      try {
        payload = JSON.parse(String(event.data)) as CdpMessage;
      } catch {
        return;
      }

      if (typeof payload.id === "number") {
        const pending = client.pending.get(payload.id);
        if (!pending) {
          return;
        }
        client.pending.delete(payload.id);
        if (payload.error?.message) {
          pending.reject(new Error(payload.error.message));
          return;
        }
        pending.resolve(payload.result ?? {});
        return;
      }

      client.eventHandlers.forEach((handler) => handler(payload));
    });

    ws.addEventListener("close", () => {
      client.pending.forEach((item, id) => {
        item.reject(new Error(`CDP browser WebSocket closed for request id=${id}`));
      });
      client.pending.clear();
      client.closeHandlers.forEach((handler) => handler());
    });

    return client;
  }

  onEvent(handler: (msg: CdpMessage) => void): void {
    this.eventHandlers.push(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  send(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const payload: Record<string, unknown> = { id, method, params };
      if (sessionId) {
        payload.sessionId = sessionId;
      }
      this.ws.send(JSON.stringify(payload));
    });
  }
}

function toBindingExpression(): string {
  return `
(() => {
  if (!globalThis.chrome || !chrome.bookmarks) {
    return {
      ok: false,
      reason: "chrome.bookmarks unavailable",
      hasChrome: !!globalThis.chrome,
      chromeKeys: globalThis.chrome ? Object.keys(globalThis.chrome) : []
    };
  }

  const safe = (value) => {
    try { return JSON.parse(JSON.stringify(value)); }
    catch { return String(value); }
  };

  const emit = (eventName, args) => {
    const payload = {
      ts: new Date().toISOString(),
      eventName,
      args: safe(args),
    };
    globalThis.__cdpBookmarkEvent(JSON.stringify(payload));
  };

  const events = [
    "onCreated",
    "onRemoved",
    "onChanged",
    "onMoved",
    "onChildrenReordered",
    "onImportBegan",
    "onImportEnded"
  ];

  for (const name of events) {
    if (chrome.bookmarks[name] && chrome.bookmarks[name].addListener) {
      chrome.bookmarks[name].addListener((...args) => emit(name, args));
    }
  }

  return { ok: true, installed: true, events };
})();
`;
}

export async function streamBookmarksApiEvents(
  config: RuntimeConfig,
  onEvent: (event: BookmarksApiStreamEvent) => Promise<void> | void,
): Promise<never> {
  const cdp = await BrowserCdp.connect(config.CDP_HTTP);
  const createTarget = (await cdp.send("Target.createTarget", {
    url: BOOKMARKS_PAGE_URL,
  })) as { targetId?: string };

  if (!createTarget.targetId) {
    throw new Error("Failed to create bookmarks target");
  }

  const attach = (await cdp.send("Target.attachToTarget", {
    targetId: createTarget.targetId,
    flatten: true,
  })) as { sessionId?: string };

  if (!attach.sessionId) {
    throw new Error("Failed to attach bookmarks target");
  }
  const sessionId = attach.sessionId;

  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.addBinding", { name: "__cdpBookmarkEvent" }, sessionId);

  const installed = (await cdp.send(
    "Runtime.evaluate",
    {
      expression: toBindingExpression(),
      returnByValue: true,
      awaitPromise: true,
    },
    sessionId,
  )) as {
    result?: {
      value?: {
        ok?: boolean;
        reason?: string;
      };
    };
  };

  const installValue = installed.result?.value;
  if (!installValue?.ok) {
    throw new Error(`Failed to install bookmarks listeners: ${installValue?.reason ?? "unknown error"}`);
  }

  return await new Promise((_, reject) => {
    cdp.onEvent((payload) => {
      if (payload.method !== "Runtime.bindingCalled" || payload.sessionId !== sessionId) {
        return;
      }

      const params = payload.params ?? {};
      if (params.name !== "__cdpBookmarkEvent") {
        return;
      }

      try {
        const raw = String(params.payload ?? "");
        const parsed = JSON.parse(raw) as BookmarksApiStreamEvent;
        void onEvent(parsed);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    cdp.onEvent((payload) => {
      if (payload.method === "Inspector.detached") {
        reject(new Error("CDP inspector detached"));
      }
    });
    cdp.onClose(() => reject(new Error("CDP WebSocket closed")));
  });
}

export async function callBookmarksApi(
  config: RuntimeConfig,
  method: string,
  args: unknown[],
): Promise<unknown> {
  const mockFile = process.env.BOOKMARKS_API_MOCK_FILE;
  if (mockFile && mockFile.trim().length > 0) {
    return callMockBookmarksApi(method, args, mockFile);
  }

  if (!API_METHODS.has(method)) {
    throw new Error(`Unsupported API method: ${method}`);
  }

  const target = await ensureBridgeTarget(config);
  const payload = { method, args };

  const expression = `(() => {
    const request = ${JSON.stringify(payload)};
    return new Promise((resolve) => {
      try {
        if (request.method === '__ping') {
          resolve(JSON.stringify({ ok: true, result: { ok: true, service: 'bookmarks-bridge' } }));
          return;
        }

        const fn = chrome.bookmarks?.[request.method];
        if (typeof fn !== 'function') {
          resolve(JSON.stringify({ ok: false, error: 'chrome.bookmarks.' + request.method + ' is not available' }));
          return;
        }

        fn(...request.args, (result) => {
          const err = chrome.runtime?.lastError;
          if (err) {
            resolve(JSON.stringify({ ok: false, error: err.message ?? String(err) }));
            return;
          }
          resolve(JSON.stringify({ ok: true, result }));
        });
      } catch (error) {
        resolve(JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    });
  })()`;

  const raw = await cdpEvaluate(target.webSocketDebuggerUrl, expression);
  const response = (typeof raw === "string" ? JSON.parse(raw) : raw) as {
    ok: boolean;
    result?: unknown;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(response.error ?? "Bookmarks API call failed");
  }
  return response.result;
}

export function aliasToMethod(name: string): string {
  const map: Record<string, string> = {
    ping: "__ping",
    "get-children": "getChildren",
    "get-recent": "getRecent",
    "get-sub-tree": "getSubTree",
    "get-tree": "getTree",
    "remove-tree": "removeTree",
  };
  return map[name] ?? name;
}
