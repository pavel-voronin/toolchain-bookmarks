import { describe, expect, test } from "bun:test";
import {
  runBookmarks,
  setupWorkspace,
  writeBookmarksFixture,
} from "../../helpers/workspace";

describe("api get command", () => {
  test("returns node by id", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, true);
    const result = runBookmarks(ctx.runDir, ["get", "100", "-j"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(Array.isArray(payload.result)).toBe(true);
    expect(payload.result[0]?.id).toBe("100");
  });
});
