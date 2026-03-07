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

describe("docker rpc e2e", () => {
  let imageTag: string | null = null;

  beforeAll(() => {
    if (!runDockerSmoke) {
      return;
    }
    imageTag = buildImage("bookmarks-e2e-rpc");
  }, 180_000);

  afterAll(() => {
    if (!runDockerSmoke || !imageTag) {
      return;
    }
    removeImage(imageTag);
  });

  test.skipIf(!runDockerSmoke)(
    "creates, updates, moves and removes bookmarks in real chrome profile",
    async () => {
      if (!imageTag) {
        throw new Error("e2e image is not built");
      }

      const hostPort = 41000 + Math.floor(Math.random() * 1000);
      const container = startContainer(imageTag, {
        authToken: "off",
        hostPort,
      });

      try {
        await waitForHealth(container.baseUrl);

        const tree = await rpcCall<BookmarkNode[]>(
          container.baseUrl,
          "getTree",
        );
        const rootFolderId = pickWritableRootId(tree);

        const folderA = await rpcCall<BookmarkNode>(
          container.baseUrl,
          "create",
          [{ parentId: rootFolderId, title: "E2E Folder A" }],
        );
        expect(folderA.id).toBeTruthy();

        const link = await rpcCall<BookmarkNode>(container.baseUrl, "create", [
          {
            parentId: folderA.id,
            title: "E2E Link",
            url: "https://example.com/one",
          },
        ]);
        expect(link.url).toBe("https://example.com/one");

        const folderAChildren = await rpcCall<BookmarkNode[]>(
          container.baseUrl,
          "getChildren",
          [folderA.id],
        );
        expect(folderAChildren.some((node) => node.id === link.id)).toBe(true);

        const updated = await rpcCall<BookmarkNode>(
          container.baseUrl,
          "update",
          [
            link.id,
            { title: "E2E Link Updated", url: "https://example.com/two" },
          ],
        );
        expect(updated.title).toBe("E2E Link Updated");
        expect(updated.url).toBe("https://example.com/two");

        const folderB = await rpcCall<BookmarkNode>(
          container.baseUrl,
          "create",
          [{ parentId: rootFolderId, title: "E2E Folder B" }],
        );
        expect(folderB.id).toBeTruthy();

        const moved = await rpcCall<BookmarkNode>(container.baseUrl, "move", [
          link.id,
          { parentId: folderB.id, index: 0 },
        ]);
        expect(moved.parentId).toBe(folderB.id);

        const subtree = await rpcCall<BookmarkNode[]>(
          container.baseUrl,
          "getSubTree",
          [folderB.id],
        );
        expect(JSON.stringify(subtree)).toContain(link.id);

        const searchHits = await rpcCall<BookmarkNode[]>(
          container.baseUrl,
          "search",
          ["E2E Link Updated"],
        );
        expect(searchHits.some((node) => node.id === link.id)).toBe(true);

        await rpcCall(container.baseUrl, "remove", [link.id]);
        await rpcCall(container.baseUrl, "removeTree", [folderA.id]);
        await rpcCall(container.baseUrl, "removeTree", [folderB.id]);

        const searchAfterDelete = await rpcCall<BookmarkNode[]>(
          container.baseUrl,
          "search",
          ["E2E Link Updated"],
        );
        expect(searchAfterDelete.some((node) => node.id === link.id)).toBe(
          false,
        );
      } finally {
        container.stop();
      }
    },
    180_000,
  );
});
