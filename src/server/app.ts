import express from "express";
import { resolve } from "node:path";
import type { BookmarksGateway } from "../cdp/client";
import type { AuthMode } from "../config/env";
import { EventBus, toJsonRpcNotification } from "../events/bus";
import { handleJsonRpcPayload } from "../rpc/handler";
import { errorResponse, JSON_RPC_ERRORS } from "../rpc/errors";
import { createAuthMiddleware } from "./auth";

type AppOptions = {
  gateway: BookmarksGateway;
  bus: EventBus;
  auth: AuthMode;
};

export function createApp(options: AppOptions) {
  const app = express();
  const authMiddleware = createAuthMiddleware(options.auth);
  const skillFilePath = resolve(process.cwd(), "SKILL.md");

  app.get(/^\/skill\.md$/i, (_req, res, next) => {
    res.sendFile(skillFilePath, (error) => {
      if (error) {
        next(error);
      }
    });
  });

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.post(
    "/rpc",
    authMiddleware,
    express.text({ type: "*/*" }),
    async (req, res) => {
      let payload: unknown;

      try {
        payload = JSON.parse(req.body || "");
      } catch {
        res
          .status(200)
          .json(
            errorResponse(
              null,
              JSON_RPC_ERRORS.PARSE_ERROR.code,
              JSON_RPC_ERRORS.PARSE_ERROR.message,
            ),
          );
        return;
      }

      const result = await handleJsonRpcPayload(options.gateway, payload);
      if (result.kind === "no-content") {
        res.status(204).end();
        return;
      }

      res.status(200).json(result.payload);
    },
  );

  app.get("/events/sse", authMiddleware, (req, res) => {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    res.write(": connected\n\n");

    const unsubscribe = options.bus.subscribe((event) => {
      const payload = toJsonRpcNotification(event);
      res.write(`event: message\ndata: ${payload}\n\n`);
    });

    const heartbeat = setInterval(() => {
      res.write(": keepalive\n\n");
    }, 15_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  return app;
}
