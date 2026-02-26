import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import {
  createRepoTarball,
  createTempDir,
  runInstall,
} from "../helpers/workspace";

describe("install env flows", () => {
  test("accepts missing BOOKMARKS_FILE when BOOKMARKS_SKIP_BOOKMARKS_FILE_CHECK=1", () => {
    const tmpRoot = createTempDir();
    const tarball = createRepoTarball(tmpRoot);
    const runDir = path.join(tmpRoot, "run");
    fs.mkdirSync(runDir, { recursive: true });

    const missingBookmarks = path.join(runDir, "does-not-exist.json");
    const result = runInstall(runDir, tarball, {
      BOOKMARKS_FILE: missingBookmarks,
      BOOKMARKS_SKIP_BOOKMARKS_FILE_CHECK: "1",
      INBOX_FOLDER_ID: "777",
      CDP_HTTP: "http://127.0.0.1:9333",
    });

    expect(result.code).toBe(0);

    const configPath = path.join(runDir, "config.ts");
    const configText = fs.readFileSync(configPath, "utf8");
    expect(
      configText.includes(`\"BOOKMARKS_FILE\": \"${missingBookmarks}\"`),
    ).toBe(true);
    expect(configText.includes('"CDP_HTTP": "http://127.0.0.1:9333"')).toBe(
      true,
    );
    expect(configText.includes('"INBOX_FOLDER_ID": "777"')).toBe(true);
  });
});
