import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, test } from "bun:test";
import {
  runBookmarks,
  setupInstalledWorkspace,
  writeBookmarksFixture,
} from "./helpers";

let runDir = "";
let tarball = "";

beforeAll(() => {
  const ctx = setupInstalledWorkspace();
  runDir = ctx.runDir;
  tarball = ctx.tarball;
  writeBookmarksFixture(runDir, false);
});

describe("commands", () => {
  test("init is idempotent", () => {
    const result = runBookmarks(runDir, ["init", "--json"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.changed).toBe(false);
  });

  test("version returns version", () => {
    const result = runBookmarks(runDir, ["version"]);
    expect(result.code).toBe(0);
    expect(result.stdout.trim().length).toBeGreaterThan(0);
  });

  test("skill-update rewrites skill", () => {
    const skillPath = path.join(runDir, "skills", "bookmarks", "SKILL.md");
    fs.writeFileSync(skillPath, "broken\n", "utf8");
    const result = runBookmarks(runDir, ["skill-update", "--json"]);
    expect(result.code).toBe(0);
    const rendered = fs.readFileSync(skillPath, "utf8");
    expect(rendered.includes("{{BOOKMARKS_BIN}}")).toBe(false);
    expect(rendered.includes(path.join(runDir, "bookmarks"))).toBe(true);
  });

  test("request logs file in requests/", () => {
    const before = fs.readdirSync(path.join(runDir, "requests")).length;
    const result = runBookmarks(runDir, [
      "request",
      "need",
      "domain",
      "grouping",
      "--json",
    ]);
    expect(result.code).toBe(0);
    const after = fs.readdirSync(path.join(runDir, "requests")).length;
    expect(after).toBeGreaterThan(before);
  });

  test("make-diff baseline writes no diff on first run", () => {
    const result = runBookmarks(runDir, ["make-diff", "--json"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.wroteDiff).toBe(false);
  });

  test("make-diff then diff returns event and advances cursor", () => {
    writeBookmarksFixture(runDir, true);
    const make = runBookmarks(runDir, ["make-diff", "--json"]);
    expect(make.code).toBe(0);

    const diff1 = runBookmarks(runDir, ["diff", "--json"]);
    expect(diff1.code).toBe(0);
    const payload1 = JSON.parse(diff1.stdout);
    expect(payload1.event).not.toBeNull();

    const diff2 = runBookmarks(runDir, ["diff", "--json"]);
    expect(diff2.code).toBe(0);
    const payload2 = JSON.parse(diff2.stdout);
    expect(payload2.event).toBeNull();
  });

  test("scenario commands run", () => {
    const a = runBookmarks(runDir, ["inbox-links", "--json"]);
    const b = runBookmarks(runDir, ["search-url", "openai", "--json"]);
    const c = runBookmarks(runDir, ["search-title", "openai", "--json"]);

    expect(a.code).toBe(0);
    expect(b.code).toBe(0);
    expect(c.code).toBe(0);
  });

  test("doctor returns 0 or 2", () => {
    const result = runBookmarks(runDir, ["doctor", "--json"]);
    expect([0, 2]).toContain(result.code);
  });

  test("unknown command fails and writes errors.log", () => {
    const result = runBookmarks(runDir, ["unknown-command"]);
    expect(result.code).not.toBe(0);
    const errorLog = path.join(runDir, "errors.log");
    expect(fs.existsSync(errorLog)).toBe(true);
    expect(fs.readFileSync(errorLog, "utf8").includes("unknown-command")).toBe(
      true,
    );
  });

  test("update command is available", () => {
    const result = runBookmarks(runDir, ["update", "--help"], {
      BOOKMARKS_INSTALL_SCRIPT_URL: `file://${path.resolve("install.sh")}`,
      REPO_TARBALL: tarball,
    });
    expect(result.code).toBe(0);
    expect(result.stdout.includes("Usage")).toBe(true);
  });
});
