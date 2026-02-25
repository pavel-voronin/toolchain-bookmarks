import { describe, expect, test } from "bun:test";
import {
  runBookmarks,
  setupWorkspace,
  writeBookmarksFixture,
} from "../../helpers/workspace";

describe("internal update command", () => {
  test("shows help", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, false);

    const result = runBookmarks(ctx.runDir, ["update", "--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout.includes("Usage")).toBe(true);
  });
});
