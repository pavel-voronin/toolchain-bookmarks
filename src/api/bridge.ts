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
