import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { runBookmarks, setupWorkspace } from "../../helpers/workspace";

describe("internal health command", () => {
  test("fails on invalid stale-seconds", () => {
    const ctx = setupWorkspace();
    const result = runBookmarks(ctx.runDir, ["health", "--stale-seconds", "abc", "--json"]);
    expect(result.code).toBe(1);
    const errorLog = fs.readFileSync(path.join(ctx.runDir, "errors.log"), "utf8");
    expect(errorLog).toContain("stale-seconds must be a positive number");
  });
});
