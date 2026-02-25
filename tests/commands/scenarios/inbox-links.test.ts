import { describe, expect, test } from "bun:test";
import {
  runBookmarks,
  setupWorkspace,
  writeBookmarksFixture,
} from "../../helpers/workspace";

describe("scenario inbox-links command", () => {
  test("runs successfully", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, true);

    const result = runBookmarks(ctx.runDir, ["inbox-links", "--json"]);
    expect(result.code).toBe(0);
  });
});
