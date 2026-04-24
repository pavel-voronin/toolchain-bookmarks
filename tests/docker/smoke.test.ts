import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const runDockerSmoke = process.env.RUN_DOCKER_SMOKE === "1";
let imageTag: string | null = null;

async function waitForHealth(port: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (res.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Container health check timed out");
}

describe("docker smoke", () => {
  beforeAll(() => {
    if (!runDockerSmoke) {
      return;
    }
    imageTag = `bookmarks-smoke-${Date.now()}`;
    execSync(`docker build -t ${imageTag} .`, { stdio: "inherit" });
  }, 180_000);

  afterAll(() => {
    if (!runDockerSmoke || !imageTag) {
      return;
    }
    spawnSync("docker", ["rmi", "-f", imageTag], { stdio: "inherit" });
  });

  test.skipIf(!runDockerSmoke)(
    "container prints help via --help and exits with code 0",
    () => {
      if (!imageTag) {
        throw new Error("smoke image is not built");
      }

      const run = spawnSync("docker", ["run", "--rm", imageTag, "--help"], {
        encoding: "utf8",
      });

      expect(run.status).toBe(0);
      expect(run.stdout).toContain("Usage:");
      expect(run.stdout).toContain("Environment variables:");
      expect(run.stdout).toContain("CHROME_CDP_URL");
      expect(run.stdout).toContain("CHROME_PROFILE_FORCE_UNLOCK");
    },
    120_000,
  );

  test.skipIf(!runDockerSmoke)(
    "container starts and serves healthz + rpc",
    async () => {
      const hostPort = 39000 + Math.floor(Math.random() * 1000);
      const profileDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "chrome-profile-"),
      );
      if (!imageTag) {
        throw new Error("smoke image is not built");
      }

      const run = spawnSync(
        "docker",
        [
          "run",
          "-d",
          "-p",
          `${hostPort}:3000`,
          "-e",
          "AUTH_TOKEN=off",
          "-v",
          `${profileDir}:/data/chrome-profile`,
          imageTag,
        ],
        { encoding: "utf8" },
      );

      if (run.status !== 0) {
        throw new Error(run.stderr || run.stdout || "docker run failed");
      }

      const containerId = run.stdout.trim();

      try {
        await waitForHealth(hostPort);

        const rpcRes = await fetch(`http://127.0.0.1:${hostPort}/rpc`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTree",
            params: [],
          }),
        });

        expect(rpcRes.ok).toBe(true);
        const payload = (await rpcRes.json()) as {
          jsonrpc: string;
          id: number;
        };
        expect(payload.jsonrpc).toBe("2.0");
        expect(payload.id).toBe(1);
      } finally {
        spawnSync("docker", ["rm", "-f", containerId], { stdio: "inherit" });
      }
    },
    120_000,
  );

  test.skipIf(!runDockerSmoke)(
    "container enforces bearer auth for RPC and SSE",
    async () => {
      const hostPort = 40000 + Math.floor(Math.random() * 1000);
      const profileDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "chrome-profile-"),
      );
      if (!imageTag) {
        throw new Error("smoke image is not built");
      }

      const run = spawnSync(
        "docker",
        [
          "run",
          "-d",
          "-p",
          `${hostPort}:3000`,
          "-e",
          "AUTH_TOKEN=secret",
          "-v",
          `${profileDir}:/data/chrome-profile`,
          imageTag,
        ],
        { encoding: "utf8" },
      );

      if (run.status !== 0) {
        throw new Error(run.stderr || run.stdout || "docker run failed");
      }

      const containerId = run.stdout.trim();

      try {
        await waitForHealth(hostPort);

        const deniedRpc = await fetch(`http://127.0.0.1:${hostPort}/rpc`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTree",
            params: [],
          }),
        });
        expect(deniedRpc.status).toBe(401);

        const okRpc = await fetch(`http://127.0.0.1:${hostPort}/rpc`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer secret",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTree",
            params: [],
          }),
        });
        expect(okRpc.status).toBe(200);

        const deniedSse = await fetch(`http://127.0.0.1:${hostPort}/sse`, {
          redirect: "manual",
        });
        expect(deniedSse.status).toBe(401);

        const okSse = await fetch(`http://127.0.0.1:${hostPort}/sse`, {
          headers: { authorization: "Bearer secret" },
        });
        expect(okSse.status).toBe(200);
        expect(okSse.headers.get("content-type")).toContain(
          "text/event-stream",
        );
        await okSse.body?.cancel();
      } finally {
        spawnSync("docker", ["rm", "-f", containerId], { stdio: "inherit" });
      }
    },
    120_000,
  );
});
