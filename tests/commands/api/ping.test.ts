import { describe, expect, test } from "bun:test";
import {
  runBookmarks,
  setupWorkspace,
  writeBookmarksFixture,
} from "../../helpers/workspace";

describe("api ping command", () => {
  test("returns structured json health payload", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, false);
    const result = runBookmarks(ctx.runDir, ["ping", "-j"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.ok).toBe(true);
    expect(payload.result?.ok).toBe(true);
    expect(payload.result?.service).toBe("bookmarks-bridge-mock");
  });

  test("prints pong in human mode", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, false);
    const result = runBookmarks(ctx.runDir, ["ping"]);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe("pong");
  });
});
