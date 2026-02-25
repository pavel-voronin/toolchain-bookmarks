import type { RuntimeConfig } from '../types/config';
import { callMockBookmarksApi } from './mock';

const API_METHODS = new Set([
  'create',
  'get',
  'getChildren',
  'getRecent',
  'getSubTree',
  'getTree',
  'move',
  'remove',
  'removeTree',
  'search',
  'update',
  '__ping',
  '__methods'
]);

export const API_COMMANDS = [
  'get',
  'get-children',
  'get-recent',
  'get-sub-tree',
  'get-tree',
  'search',
  'create',
  'update',
  'move',
  'remove',
  'remove-tree',
  'ping',
  'methods'
] as const;

export const API_COMMAND_DESCRIPTIONS: Record<(typeof API_COMMANDS)[number], string> = {
  get: 'Get bookmarks by id(s)',
  'get-children': 'Get children of a folder id',
  'get-recent': 'Get N most recent bookmarks',
  'get-sub-tree': 'Get subtree for a node id',
  'get-tree': 'Get full bookmarks tree',
  search: 'Search bookmarks by query',
  create: 'Create bookmark or folder',
  update: 'Update bookmark or folder fields',
  move: 'Move bookmark or folder',
  remove: 'Remove a bookmark node',
  'remove-tree': 'Remove folder subtree',
  ping: 'Health check for bridge',
  methods: 'List supported bridge methods'
};

type CdpTarget = {
  id: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
};

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
    throw new Error('Unexpected CDP /json/list payload');
  }
  return payload as CdpTarget[];
}

function bridgeUrl(config: RuntimeConfig): string {
  return `chrome-extension://${config.BOOKMARKS_EXTENSION_ID}/bridge.html`;
}

async function ensureBridgeTarget(config: RuntimeConfig): Promise<CdpTarget> {
  const url = bridgeUrl(config);
  let targets = await listTargets(config.CDP_HTTP);
  let matches = targets.filter((target) => target.type === 'page' && target.url === url);

  if (matches.length === 0) {
    await fetchJson(`${config.CDP_HTTP}/json/new?${url}`, { method: 'PUT' });
    targets = await listTargets(config.CDP_HTTP);
    matches = targets.filter((target) => target.type === 'page' && target.url === url);
  }

  if (matches.length === 0) {
    throw new Error('Failed to create bridge tab');
  }

  const keep = matches[0];
  await Promise.all(
    matches.slice(1).map((target) => fetch(`${config.CDP_HTTP}/json/close/${target.id}`).catch(() => undefined))
  );

  return keep;
}

async function cdpEvaluate(wsUrl: string, expression: string): Promise<unknown> {
  const ws = new WebSocket(wsUrl);
  const requestId = 1;

  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP Runtime.evaluate timeout'));
    }, 20000);

    ws.addEventListener('open', () => {
      ws.send(
        JSON.stringify({
          id: requestId,
          method: 'Runtime.evaluate',
          params: { expression, awaitPromise: true, returnByValue: true }
        })
      );
    });

    ws.addEventListener('message', (event) => {
      const payload = JSON.parse(String(event.data)) as {
        id?: number;
        error?: { message?: string };
        result?: {
          result?: { value?: unknown };
          exceptionDetails?: { text?: string; exception?: { description?: string } };
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
              'Runtime.evaluate failed'
          )
        );
        return;
      }

      resolve(payload.result?.result?.value);
    });

    ws.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('CDP WebSocket error'));
    });
  });
}

export async function callBookmarksApi(
  config: RuntimeConfig,
  method: string,
  args: unknown[]
): Promise<unknown> {
  const mockFile = process.env.BOOKMARKS_API_MOCK_FILE;
  if (mockFile && mockFile.trim().length > 0) {
    return callMockBookmarksApi(method, args, mockFile);
  }

  if (!API_METHODS.has(method)) {
    throw new Error(`Unsupported API method: ${method}`);
  }

  const target = await ensureBridgeTarget(config);
  const id = `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const payload = { channel: 'cbm-bridge', id, method, args };

  const expression = `(() => {
    const request = ${JSON.stringify(payload)};
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('message', onMessage);
        resolve(JSON.stringify({ ok: false, error: 'Bridge timeout', id: request.id, channel: 'cbm-bridge-response' }));
      }, 15000);

      function onMessage(event) {
        const data = event.data;
        if (!data || data.channel !== 'cbm-bridge-response' || data.id !== request.id) {
          return;
        }
        clearTimeout(timeout);
        window.removeEventListener('message', onMessage);
        resolve(JSON.stringify(data));
      }

      window.addEventListener('message', onMessage);
      window.postMessage(request, '*');
    });
  })()`;

  const raw = await cdpEvaluate(target.webSocketDebuggerUrl, expression);
  const response = (typeof raw === 'string' ? JSON.parse(raw) : raw) as {
    ok: boolean;
    result?: unknown;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(response.error ?? 'Bookmarks API call failed');
  }
  return response.result;
}

export function hasApiCommand(name: string): boolean {
  return API_METHODS.has(aliasToMethod(name));
}

export function aliasToMethod(name: string): string {
  const map: Record<string, string> = {
    ping: '__ping',
    methods: '__methods',
    'get-children': 'getChildren',
    'get-recent': 'getRecent',
    'get-sub-tree': 'getSubTree',
    'get-tree': 'getTree',
    'remove-tree': 'removeTree'
  };
  return map[name] ?? name;
}
