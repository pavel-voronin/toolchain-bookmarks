import { describe, expect, test } from "bun:test";
import {
  runBookmarks,
  setupWorkspace,
  writeBookmarksFixture,
} from "../../helpers/workspace";

describe("api create command", () => {
  test("creates a link", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, true);
    const result = runBookmarks(ctx.runDir, [
      "create",
      "--parent-id",
      "10",
      "--title",
      "Created by test",
      "--url",
      "https://example.com",
      "-j",
    ]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.result?.title).toBe("Created by test");
    expect(payload.result?.type).toBe("link");
  });
});
