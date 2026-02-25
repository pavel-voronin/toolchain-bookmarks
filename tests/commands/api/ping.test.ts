import { describe, expect, test } from "bun:test";
import {
  runBookmarks,
  setupWorkspace,
  writeBookmarksFixture,
} from "../../helpers/workspace";

describe("api ping command", () => {
  test("returns ok", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, false);
    const result = runBookmarks(ctx.runDir, ["ping", "-j"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.ok).toBe(true);
  });
});
