import { describe, expect, test } from "bun:test";
import {
  runBookmarks,
  setupWorkspace,
  writeBookmarksFixture,
} from "../helpers/workspace";

describe("cli version behavior", () => {
  test("returns version with --version", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, false);

    const result = runBookmarks(ctx.runDir, ["--version"]);
    expect(result.code).toBe(0);
    expect(result.stdout.trim().length).toBeGreaterThan(0);
  });
});
