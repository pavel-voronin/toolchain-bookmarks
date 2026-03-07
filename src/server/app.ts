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

type SkillManifest = {
  name: string;
  description: string;
  files: string[];
};

const WELL_KNOWN_SKILLS: { skills: SkillManifest[] } = {
  skills: [
    {
      name: "chrome-bookmarks-gateway",
      description:
        "Operate Chrome bookmarks through a remote JSON-RPC endpoint. Use when the task requires reading/searching/creating/updating/moving/removing bookmarks",
      files: ["SKILL.md"],
    },
  ],
};

const SKILL_FILE_SET = new Map(
  WELL_KNOWN_SKILLS.skills.map((skill) => [skill.name, new Set(skill.files)]),
);

export function createApp(options: AppOptions) {
  const app = express();
  const authMiddleware = createAuthMiddleware(options.auth);
  const skillsRootPath = resolve(process.cwd(), "skills");

  app.get("/.well-known/skills/index.json", (_req, res) => {
    res.status(200).json(WELL_KNOWN_SKILLS);
  });

  app.get(/^\/\.well-known\/skills\/([a-z0-9-]+)\/(.+)$/, (req, res, next) => {
    const skillName = req.params[0];
    const filePath = req.params[1];
    const allowedFiles = SKILL_FILE_SET.get(skillName);

    if (!allowedFiles || !allowedFiles.has(filePath)) {
      res.status(404).end();
      return;
    }

    const absolutePath = resolve(skillsRootPath, skillName, filePath);
    res.sendFile(absolutePath, (error) => {
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

  app.get("/sse", authMiddleware, (req, res) => {
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
