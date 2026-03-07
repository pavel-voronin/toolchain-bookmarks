import type { BookmarksGateway } from "../cdp/client";
import { dispatchBookmarksMethod } from "./dispatcher";
import { errorResponse, JSON_RPC_ERRORS, RpcError } from "./errors";
import type { JsonRpcRequest, JsonRpcResponse } from "./types";

function isJsonRpcId(value: unknown): value is string | number | null {
  return (
    value === null || typeof value === "string" || typeof value === "number"
  );
}

function isValidRequest(value: unknown): value is JsonRpcRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const obj = value as Record<string, unknown>;
  if (obj.jsonrpc !== "2.0") {
    return false;
  }
  if (typeof obj.method !== "string") {
    return false;
  }
  if (obj.id !== undefined && !isJsonRpcId(obj.id)) {
    return false;
  }

  return true;
}

async function handleRequest(
  gateway: BookmarksGateway,
  req: unknown,
): Promise<JsonRpcResponse | null> {
  if (!isValidRequest(req)) {
    return errorResponse(
      null,
      JSON_RPC_ERRORS.INVALID_REQUEST.code,
      JSON_RPC_ERRORS.INVALID_REQUEST.message,
    );
  }

  const request = req as JsonRpcRequest;
  const isNotification = request.id === undefined;
  const responseId = request.id === undefined ? null : request.id;

  try {
    const result = await dispatchBookmarksMethod(
      gateway,
      request.method,
      request.params,
    );

    if (isNotification) {
      return null;
    }

    return {
      jsonrpc: "2.0",
      id: responseId,
      result: result ?? null,
    };
  } catch (error) {
    if (isNotification) {
      return null;
    }

    if (error instanceof RpcError) {
      return errorResponse(responseId, error.code, error.message, error.data);
    }

    return errorResponse(
      responseId,
      JSON_RPC_ERRORS.INTERNAL_ERROR.code,
      JSON_RPC_ERRORS.INTERNAL_ERROR.message,
    );
  }
}

export type JsonRpcHttpResult =
  | { kind: "response"; payload: JsonRpcResponse | JsonRpcResponse[] }
  | { kind: "no-content" };

export async function handleJsonRpcPayload(
  gateway: BookmarksGateway,
  payload: unknown,
): Promise<JsonRpcHttpResult> {
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return {
        kind: "response",
        payload: errorResponse(
          null,
          JSON_RPC_ERRORS.INVALID_REQUEST.code,
          JSON_RPC_ERRORS.INVALID_REQUEST.message,
        ),
      };
    }

    const responses = (
      await Promise.all(payload.map((item) => handleRequest(gateway, item)))
    ).filter(
      (item: JsonRpcResponse | null): item is JsonRpcResponse => item !== null,
    );

    if (responses.length === 0) {
      return { kind: "no-content" };
    }

    return { kind: "response", payload: responses };
  }

  const response = await handleRequest(gateway, payload);
  if (!response) {
    return { kind: "no-content" };
  }
  return { kind: "response", payload: response };
}
