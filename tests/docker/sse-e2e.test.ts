import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  buildImage,
  pickWritableRootId,
  removeImage,
  rpcCall,
  runDockerSmoke,
  startContainer,
  waitForHealth,
  type BookmarkNode,
} from "./helpers";

const decoder = new TextDecoder();

async function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  return await Promise.race([
    reader.read(),
    new Promise<never>((_resolve, reject) => {
      setTimeout(
        () => reject(new Error("Timed out waiting for SSE frame")),
        timeoutMs,
      );
    }),
  ]);
}

async function waitForSseMethods(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  expected: string[],
  timeoutMs = 20_000,
): Promise<Set<string>> {
  const seen = new Set<string>();
  const wanted = new Set(expected);
  const started = Date.now();
  let buffer = "";

  while (Date.now() - started < timeoutMs && seen.size < wanted.size) {
    const { done, value } = await readWithTimeout(reader, 2_000);
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    while (buffer.includes("\n\n")) {
      const boundary = buffer.indexOf("\n\n");
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const dataLine = frame
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (!dataLine) {
        continue;
      }

      try {
        const payload = JSON.parse(dataLine.slice(6)) as { method?: string };
        if (payload.method && wanted.has(payload.method)) {
          seen.add(payload.method);
        }
      } catch {
        // ignore malformed event payloads in collector
      }
    }
  }

  return seen;
}

describe("docker sse e2e", () => {
  let imageTag: string | null = null;

  beforeAll(() => {
    if (!runDockerSmoke) {
      return;
    }
    imageTag = buildImage("bookmarks-e2e-sse");
  }, 180_000);

  afterAll(() => {
    if (!runDockerSmoke || !imageTag) {
      return;
    }
    removeImage(imageTag);
  });

  test.skipIf(!runDockerSmoke)(
    "emits bookmark lifecycle events over SSE for real RPC operations",
    async () => {
      if (!imageTag) {
        throw new Error("e2e image is not built");
      }

      const hostPort = 42000 + Math.floor(Math.random() * 1000);
      const container = startContainer(imageTag, {
        authToken: "off",
        hostPort,
      });

      try {
        await waitForHealth(container.baseUrl);

        const sseRes = await fetch(`${container.baseUrl}/sse`);
        expect(sseRes.status).toBe(200);
        const reader = sseRes.body?.getReader();
        if (!reader) {
          throw new Error("SSE response body is missing");
        }

        const tree = await rpcCall<BookmarkNode[]>(
          container.baseUrl,
          "getTree",
        );
        const rootFolderId = pickWritableRootId(tree);

        const folderA = await rpcCall<BookmarkNode>(
          container.baseUrl,
          "create",
          [{ parentId: rootFolderId, title: "SSE E2E Folder A" }],
        );
        const link = await rpcCall<BookmarkNode>(container.baseUrl, "create", [
          {
            parentId: folderA.id,
            title: "SSE E2E Link",
            url: "https://example.com/sse-one",
          },
        ]);
        const folderB = await rpcCall<BookmarkNode>(
          container.baseUrl,
          "create",
          [{ parentId: rootFolderId, title: "SSE E2E Folder B" }],
        );

        await rpcCall(container.baseUrl, "update", [
          link.id,
          { title: "SSE E2E Link Updated", url: "https://example.com/sse-two" },
        ]);
        await rpcCall(container.baseUrl, "move", [
          link.id,
          { parentId: folderB.id, index: 0 },
        ]);
        await rpcCall(container.baseUrl, "remove", [link.id]);
        await rpcCall(container.baseUrl, "removeTree", [folderA.id]);
        await rpcCall(container.baseUrl, "removeTree", [folderB.id]);

        const seen = await waitForSseMethods(reader, [
          "onCreated",
          "onChanged",
          "onMoved",
          "onRemoved",
        ]);

        expect(seen.has("onCreated")).toBe(true);
        expect(seen.has("onChanged")).toBe(true);
        expect(seen.has("onMoved")).toBe(true);
        expect(seen.has("onRemoved")).toBe(true);

        await reader.cancel();
      } finally {
        container.stop();
      }
    },
    180_000,
  );
});
