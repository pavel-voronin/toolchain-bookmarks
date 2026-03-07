import { createServer } from "node:http";
import type { Socket } from "node:net";
import {
  createBookmarksGateway,
  startBookmarksEventStream,
} from "../cdp/client";
import { DEFAULT_WEBHOOK_TIMEOUT_MS } from "../config/constants";
import { resolveStartupConfig } from "../config/env";
import { EventBus } from "../events/bus";
import { createApp } from "./app";
import { setupWebhookTransport } from "./webhook";
import { setupWebSocketTransport } from "./ws";

const EVENT_RECONNECT_DELAY_MS = 2_000;

export async function startServer(): Promise<void> {
  const config = resolveStartupConfig(process.env);
  const bus = new EventBus();
  const gateway = createBookmarksGateway();

  const app = createApp({
    gateway,
    bus,
    auth: config.auth,
  });

  const server = createServer(app);
  const stopWebSocketTransport = setupWebSocketTransport({
    server,
    bus,
    gateway,
    auth: config.auth,
  });
  const stopWebhookTransport = setupWebhookTransport({
    bus,
    urls: config.webhooks?.urls ?? [],
    timeoutMs: config.webhooks?.timeoutMs ?? DEFAULT_WEBHOOK_TIMEOUT_MS,
  });
  const sockets = new Set<Socket>();

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => {
      sockets.delete(socket);
    });
  });

  server.listen(config.port, () => {
    console.log(`service listening on :${config.port}`);
    if (config.auth.enabled) {
      if (config.auth.generated) {
        console.log(`AUTH_TOKEN_GENERATED=${config.auth.token}`);
      } else {
        console.log("auth mode: bearer token (provided via AUTH_TOKEN)");
      }
    } else {
      console.log("auth mode: off");
    }
    console.log(`chrome profile dir: ${config.chromeProfileDir}`);
  });

  let shuttingDown = false;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let stopEvents: (() => void) | null = null;

  const scheduleReconnect = (reason: string): void => {
    if (shuttingDown || reconnectTimer) {
      return;
    }

    console.error(`bookmark event stream: disconnected (${reason})`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connectEventStream();
    }, EVENT_RECONNECT_DELAY_MS);
    reconnectTimer.unref();
  };

  const connectEventStream = async (): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    try {
      stopEvents = await startBookmarksEventStream(
        (event) => {
          bus.publish(event);
        },
        {
          onDisconnect: (error) => {
            stopEvents = null;
            scheduleReconnect(error.message);
          },
        },
      );
      console.log("bookmark event stream: connected");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      scheduleReconnect(message);
    }
  };

  await connectEventStream();

  const shutdown = () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (stopEvents) {
      stopEvents();
      stopEvents = null;
    }
    stopWebSocketTransport();
    stopWebhookTransport();

    sockets.forEach((socket) => {
      socket.destroy();
    });

    const forceExitTimer = setTimeout(() => {
      process.exit(0);
    }, 5_000);
    forceExitTimer.unref();

    server.close(() => {
      clearTimeout(forceExitTimer);
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
