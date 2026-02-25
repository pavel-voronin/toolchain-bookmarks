import { describe, expect, test } from "bun:test";
import {
  runBookmarks,
  setupWorkspace,
  writeBookmarksFixture,
} from "../../helpers/workspace";

describe("api methods command", () => {
  test("returns supported methods", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, false);
    const result = runBookmarks(ctx.runDir, ["methods", "-j"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(Array.isArray(payload.result)).toBe(true);
    expect(payload.result.includes("getTree")).toBe(true);
    expect(payload.result.includes("create")).toBe(true);
  });
});
