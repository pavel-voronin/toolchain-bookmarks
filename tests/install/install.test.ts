import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import {
  createRepoTarball,
  createTempDir,
  runInstall,
} from "../helpers/workspace";

describe("install", () => {
  test("installs binary and initializes runtime layout", () => {
    const tmpRoot = createTempDir();
    const tarball = createRepoTarball(tmpRoot);
    const runDir = path.join(tmpRoot, "run");
    fs.mkdirSync(runDir, { recursive: true });

    const result = runInstall(runDir, tarball);
    expect(result.code).toBe(0);

    expect(fs.existsSync(path.join(runDir, "bookmarks"))).toBe(true);
    expect(fs.existsSync(path.join(runDir, "config.ts"))).toBe(true);
    expect(fs.existsSync(path.join(runDir, "extension", "manifest.json"))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(runDir, "extension", "icons", "icon48.png")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(runDir, "extension", "icons", "icon128.png")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(runDir, "skills", "bookmarks", "SKILL.md")),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(runDir, "systemd", "bookmarks-make-diff.service"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(runDir, "systemd", "bookmarks-make-diff.timer")),
    ).toBe(true);
    expect(fs.existsSync(path.join(runDir, "requests"))).toBe(true);
    expect(fs.existsSync(path.join(runDir, "snapshots"))).toBe(true);
    expect(fs.existsSync(path.join(runDir, "diffs"))).toBe(true);
  });
});
