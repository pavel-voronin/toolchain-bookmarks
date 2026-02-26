import { describe, expect, test } from "bun:test";
import {
  runBookmarks,
  setupWorkspace,
  writeBookmarksFixture,
} from "../../helpers/workspace";

describe("api remove-tree command", () => {
  test("returns structured json contract", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, true);
    const result = runBookmarks(ctx.runDir, ["remove-tree", "10", "-j"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.ok).toBe(true);
    expect(payload.result).toBeUndefined();
  });

  test("prints human confirmation message", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, true);
    const result = runBookmarks(ctx.runDir, ["remove-tree", "10"]);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe("Tree rooted at ID 10 was removed successfully.");
  });
});
