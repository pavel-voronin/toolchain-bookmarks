import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import {
  runBookmarks,
  setupWorkspace,
  writeBookmarksFixture,
} from "../helpers/workspace";

describe("cli meta behavior", () => {
  test("unknown command fails without writing errors.log", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, false);

    runBookmarks(ctx.runDir, ["unknown-command"]);
    const errorLog = path.join(ctx.runDir, "errors.log");
    expect(fs.existsSync(errorLog)).toBe(false);
  });
});
