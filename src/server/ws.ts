import type { IncomingMessage, Server } from "node:http";
import type { Socket } from "node:net";
import type { BookmarksGateway } from "../cdp/client";
import { EventBus, toJsonRpcNotification } from "../events/bus";
import { errorResponse, JSON_RPC_ERRORS } from "../rpc/errors";
import { handleJsonRpcPayload } from "../rpc/handler";
import type { AuthMode } from "../config/env";
import { isAuthorizedUpgradeRequest } from "./auth";
import { WebSocket, WebSocketServer, type RawData } from "ws";

type WebSocketTransportOptions = {
  server: Server;
  bus: EventBus;
  gateway: BookmarksGateway;
  auth: AuthMode;
  path?: string;
};

function sendJson(ws: WebSocket, payload: unknown): void {
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // Ignore write errors for closed/closing sockets.
  }
}

function sendRaw(ws: WebSocket, payload: string): void {
  try {
    ws.send(payload);
  } catch {
    // Ignore write errors for closed/closing sockets.
  }
}

async function handleIncomingMessage(
  ws: WebSocket,
  gateway: BookmarksGateway,
  data: RawData,
): Promise<void> {
  let payload: unknown;

  try {
    payload = JSON.parse(String(data));
  } catch {
    sendJson(
      ws,
      errorResponse(
        null,
        JSON_RPC_ERRORS.PARSE_ERROR.code,
        JSON_RPC_ERRORS.PARSE_ERROR.message,
      ),
    );
    return;
  }

  try {
    const result = await handleJsonRpcPayload(gateway, payload);
    if (result.kind === "no-content") {
      return;
    }
    sendJson(ws, result.payload);
  } catch {
    sendJson(
      ws,
      errorResponse(
        null,
        JSON_RPC_ERRORS.INTERNAL_ERROR.code,
        JSON_RPC_ERRORS.INTERNAL_ERROR.message,
      ),
    );
  }
}

function isTargetPath(req: IncomingMessage, path: string): boolean {
  const baseUrl = "http://localhost";
  const parsed = new URL(req.url ?? "/", baseUrl);
  return parsed.pathname === path;
}

function writeUnauthorizedAndClose(socket: Socket): void {
  socket.write(
    "HTTP/1.1 401 Unauthorized\r\n" +
      "Connection: close\r\n" +
      "Content-Type: application/json\r\n\r\n" +
      JSON.stringify({ error: "Unauthorized" }),
  );
  socket.destroy();
}

export function setupWebSocketTransport(
  options: WebSocketTransportOptions,
): () => void {
  const path = options.path ?? "/ws";
  const wss = new WebSocketServer({ noServer: true });

  const unsubscribe = options.bus.subscribe((event) => {
    const payload = toJsonRpcNotification(event);
    wss.clients.forEach((client: WebSocket) => {
      sendRaw(client, payload);
    });
  });

  wss.on("connection", (ws: WebSocket) => {
    ws.on("message", (data: RawData) => {
      void handleIncomingMessage(ws, options.gateway, data);
    });
  });

  const onUpgrade = (req: IncomingMessage, socket: Socket, head: Buffer) => {
    if (!isTargetPath(req, path)) {
      socket.destroy();
      return;
    }

    if (!isAuthorizedUpgradeRequest(req, options.auth)) {
      writeUnauthorizedAndClose(socket);
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      wss.emit("connection", ws, req);
    });
  };

  options.server.on("upgrade", onUpgrade);

  return () => {
    options.server.off("upgrade", onUpgrade);
    unsubscribe();
    wss.clients.forEach((client: WebSocket) => {
      client.close();
    });
    wss.close();
  };
}
