'use strict';

const CHANNEL = 'cbm-bridge';
const RESPONSE_CHANNEL = 'cbm-bridge-response';

const BOOKMARKS_METHODS = new Set([
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
  'update'
]);

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function parsePayload(data) {
  if (!isObject(data) || data.channel !== CHANNEL) {
    return null;
  }

  const id = data.id ?? null;
  const method = data.method;
  const args = data.args ?? [];

  if (typeof method !== 'string' || method.length === 0) {
    throw new Error('`method` must be a non-empty string');
  }

  if (!Array.isArray(args)) {
    throw new Error('`args` must be an array');
  }

  return { id, method, args };
}

async function invoke(method, args) {
  if (method === '__ping') {
    return { ok: true, service: 'bookmarks-bridge' };
  }

  if (method === '__methods') {
    return Array.from(BOOKMARKS_METHODS.values()).sort();
  }

  if (!BOOKMARKS_METHODS.has(method)) {
    throw new Error(`Unsupported method: ${method}`);
  }

  const fn = chrome.bookmarks?.[method];
  if (typeof fn !== 'function') {
    throw new Error(`chrome.bookmarks.${method} is not available`);
  }

  try {
    return await fn(...args);
  } catch (error) {
    return await new Promise((resolve, reject) => {
      fn(...args, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result);
      });
    });
  }
}

function reply(targetWindow, targetOrigin, message) {
  targetWindow.postMessage(message, targetOrigin);
}

window.addEventListener('message', (event) => {
  let request;

  try {
    request = parsePayload(event.data);
  } catch (error) {
    if (event.source && typeof event.source.postMessage === 'function') {
      reply(event.source, event.origin || '*', {
        channel: RESPONSE_CHANNEL,
        ok: false,
        id: event.data?.id ?? null,
        error: toErrorMessage(error)
      });
    }
    return;
  }

  if (!request || !event.source || typeof event.source.postMessage !== 'function') {
    return;
  }

  invoke(request.method, request.args)
    .then((result) => {
      reply(event.source, event.origin || '*', {
        channel: RESPONSE_CHANNEL,
        ok: true,
        id: request.id,
        result
      });
    })
    .catch((error) => {
      reply(event.source, event.origin || '*', {
        channel: RESPONSE_CHANNEL,
        ok: false,
        id: request.id,
        error: toErrorMessage(error)
      });
    });
});
