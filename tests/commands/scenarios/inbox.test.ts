import { describe, expect, test } from "bun:test";
import {
  runBookmarks,
  setupWorkspace,
  writeBookmarksFixture,
} from "../../helpers/workspace";

describe("scenario inbox command", () => {
  test("runs successfully", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, true);

    const result = runBookmarks(ctx.runDir, ["inbox", "--json"]);
    expect(result.code).toBe(0);
  });
});
