import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import { runCmd, setupInstalledWorkspace } from "../helpers/workspace";

describe("runtime root resolution", () => {
  test("uses installed binary directory when current directory has no config.ts", () => {
    const ctx = setupInstalledWorkspace();
    const otherDir = path.join(ctx.tmpRoot, "other-cwd");
    fs.mkdirSync(otherDir, { recursive: true });

    const result = runCmd(
      ctx.bookmarksBin,
      ["inbox-links", "--json"],
      otherDir,
      {
        BOOKMARKS_API_MOCK_FILE: path.join(ctx.runDir, "install-bookmarks.json"),
      },
    );

    expect(result.code).toBe(0);
  });
});
