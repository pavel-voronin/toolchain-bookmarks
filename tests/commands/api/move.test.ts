import { describe, expect, test } from "bun:test";
import {
  runBookmarks,
  setupWorkspace,
  writeBookmarksFixture,
} from "../../helpers/workspace";

describe("api move command", () => {
  test("moves node", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, true);
    const result = runBookmarks(ctx.runDir, [
      "move",
      "100",
      "--parent-id",
      "2",
      "--index",
      "0",
      "-j",
    ]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.result?.id).toBe("100");
    expect(payload.result?.parentId).toBe("2");
  });

  test("coerces numeric parentId option to string", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, true);
    const result = runBookmarks(ctx.runDir, [
      "move",
      "100",
      "--parentId",
      "2",
      "-j",
    ]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.result?.id).toBe("100");
    expect(payload.result?.parentId).toBe("2");
  });
});
