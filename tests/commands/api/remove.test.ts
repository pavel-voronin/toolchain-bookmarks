import { describe, expect, test } from "bun:test";
import {
  runBookmarks,
  setupWorkspace,
  writeBookmarksFixture,
} from "../../helpers/workspace";

describe("api remove command", () => {
  test("returns structured json contract", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, true);
    const result = runBookmarks(ctx.runDir, ["remove", "100", "-j"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.ok).toBe(true);
    expect(payload.result).toBeUndefined();
  });

  test("prints human confirmation message", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, true);
    const result = runBookmarks(ctx.runDir, ["remove", "100"]);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe("Object with ID 100 was removed successfully.");
  });
});
