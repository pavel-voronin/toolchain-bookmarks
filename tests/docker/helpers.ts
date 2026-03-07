import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";

export const runDockerSmoke = process.env.RUN_DOCKER_SMOKE === "1";

export type StartedContainer = {
  containerId: string;
  hostPort: number;
  baseUrl: string;
  stop: () => void;
};

export function buildImage(tagPrefix: string): string {
  const tag = `${tagPrefix}-${Date.now()}`;
  execSync(`docker build -t ${tag} .`, { stdio: "inherit" });
  return tag;
}

export function removeImage(tag: string): void {
  spawnSync("docker", ["rmi", "-f", tag], { stdio: "inherit" });
}

export function startContainer(
  imageTag: string,
  options: { authToken: string; hostPort: number },
): StartedContainer {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-profile-"));
  const run = spawnSync(
    "docker",
    [
      "run",
      "-d",
      "-p",
      `${options.hostPort}:3000`,
      "-e",
      `AUTH_TOKEN=${options.authToken}`,
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
  return {
    containerId,
    hostPort: options.hostPort,
    baseUrl: `http://127.0.0.1:${options.hostPort}`,
    stop: () => {
      spawnSync("docker", ["rm", "-f", containerId], { stdio: "inherit" });
      fs.rmSync(profileDir, { recursive: true, force: true });
    },
  };
}

export async function waitForHealth(baseUrl: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    try {
      const res = await fetch(`${baseUrl}/healthz`);
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

export async function rpcCall<T = unknown>(
  baseUrl: string,
  method: string,
  params: unknown[] = [],
): Promise<T> {
  const res = await fetch(`${baseUrl}/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  if (!res.ok) {
    throw new Error(`RPC ${method} failed with status ${res.status}`);
  }

  const payload = (await res.json()) as {
    result?: T;
    error?: { code: number; message: string };
  };
  if (payload.error) {
    throw new Error(
      `RPC ${method} error ${payload.error.code}: ${payload.error.message}`,
    );
  }
  return payload.result as T;
}

export type BookmarkNode = {
  id: string;
  title: string;
  url?: string;
  parentId?: string;
  index?: number;
  children?: BookmarkNode[];
};

export function pickWritableRootId(tree: BookmarkNode[]): string {
  const root = tree[0];
  if (!root || !Array.isArray(root.children) || root.children.length === 0) {
    throw new Error("Unexpected bookmarks tree root structure");
  }
  return root.children[0].id;
}
