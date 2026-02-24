'use strict';

/**
 * Optional shared secret. If non-empty, every request must include `token`.
 * Keep empty for trusted local-only automation.
 */
const SHARED_SECRET = '';

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

function normalizeRequest(payload) {
  if (!isObject(payload)) {
    throw new Error('Payload must be an object');
  }

  const id = payload.id ?? null;
  const method = payload.method;
  const args = payload.args ?? [];
  const token = payload.token ?? '';

  if (typeof method !== 'string' || method.length === 0) {
    throw new Error('`method` must be a non-empty string');
  }

  if (!Array.isArray(args)) {
    throw new Error('`args` must be an array');
  }

  if (SHARED_SECRET && token !== SHARED_SECRET) {
    throw new Error('Unauthorized');
  }

  return { id, method, args };
}

function errorToMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function invokeBookmarksMethod(method, args) {
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
    // Callback-style fallback for Chromium variants that do not expose Promise wrappers.
    return await new Promise((resolve, reject) => {
      fn(...args, (result) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }
        resolve(result);
      });
    });
  }
}

function buildSuccessResponse(id, result) {
  return { ok: true, id, result };
}

function buildErrorResponse(id, error) {
  return { ok: false, id, error: errorToMessage(error) };
}

function createMessageHandler(source) {
  return (payload, sender, sendResponse) => {
    let request;

    try {
      request = normalizeRequest(payload);
    } catch (error) {
      sendResponse(buildErrorResponse(null, error));
      return false;
    }

    invokeBookmarksMethod(request.method, request.args)
      .then((result) => {
        sendResponse(buildSuccessResponse(request.id, result));
      })
      .catch((error) => {
        console.error(`[${source}] request failed`, {
          method: request.method,
          sender,
          error
        });
        sendResponse(buildErrorResponse(request.id, error));
      });

    return true;
  };
}

chrome.runtime.onMessage.addListener(createMessageHandler('internal'));
chrome.runtime.onMessageExternal.addListener(createMessageHandler('external'));

console.log('Bookmarks API bridge service worker loaded');
