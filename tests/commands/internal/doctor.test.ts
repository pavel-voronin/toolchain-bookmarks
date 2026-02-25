import { describe, expect, test } from "bun:test";
import {
  runBookmarks,
  setupWorkspace,
  writeBookmarksFixture,
} from "../../helpers/workspace";

describe("internal doctor command", () => {
  test("returns 0 or 2", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, false);

    const result = runBookmarks(ctx.runDir, ["doctor", "--json"]);
    expect([0, 2]).toContain(result.code);
  });
});
