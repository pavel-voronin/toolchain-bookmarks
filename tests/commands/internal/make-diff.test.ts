import { describe, expect, test } from "bun:test";
import {
  runBookmarks,
  setupWorkspace,
  writeBookmarksFixture,
} from "../../helpers/workspace";

describe("internal make-diff command", () => {
  test("baseline writes no diff on first run", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, false);

    const result = runBookmarks(ctx.runDir, ["make-diff", "--json"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.wroteDiff).toBe(false);
  });
});
