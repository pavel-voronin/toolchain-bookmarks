import { describe, expect, test } from "bun:test";
import {
  runBookmarks,
  setupWorkspace,
  writeBookmarksFixture,
} from "../../helpers/workspace";

describe("api update command", () => {
  test("updates node", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, true);
    const result = runBookmarks(ctx.runDir, [
      "update",
      "100",
      "--title",
      "Updated title",
      "-j",
    ]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.result?.id).toBe("100");
    expect(payload.result?.title).toBe("Updated title");
  });
});
