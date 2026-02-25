import { describe, expect, test } from "bun:test";
import {
  runBookmarks,
  setupWorkspace,
  writeBookmarksFixture,
} from "../../helpers/workspace";

describe("api remove command", () => {
  test("removes node", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, true);
    const result = runBookmarks(ctx.runDir, ["remove", "100", "-j"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.ok).toBe(true);
  });
});
