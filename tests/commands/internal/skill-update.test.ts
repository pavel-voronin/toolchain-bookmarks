import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import {
  runBookmarks,
  setupWorkspace,
  writeBookmarksFixture,
} from "../../helpers/workspace";

describe("internal skill-update command", () => {
  test("rewrites skill", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, false);

    const skillPath = path.join(ctx.runDir, "skills", "bookmarks", "SKILL.md");
    fs.writeFileSync(skillPath, "broken\n", "utf8");

    const result = runBookmarks(ctx.runDir, ["skill-update", "--json"]);
    expect(result.code).toBe(0);

    const rendered = fs.readFileSync(skillPath, "utf8");
    expect(rendered.includes("{{BOOKMARKS_BIN}}")).toBe(false);
    expect(rendered.includes(path.join(ctx.runDir, "bookmarks"))).toBe(true);
  });
});
