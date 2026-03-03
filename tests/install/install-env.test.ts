import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import {
  createRepoTarball,
  createTempDir,
  runInstall,
} from "../helpers/workspace";

describe("install env flows", () => {
  test("writes CDP_HTTP override", () => {
    const tmpRoot = createTempDir();
    const tarball = createRepoTarball(tmpRoot);
    const runDir = path.join(tmpRoot, "run");
    fs.mkdirSync(runDir, { recursive: true });

    const result = runInstall(runDir, tarball, {
      CDP_HTTP: "http://127.0.0.1:9333",
    });

    expect(result.code).toBe(0);

    const configPath = path.join(runDir, "config.ts");
    const configText = fs.readFileSync(configPath, "utf8");
    expect(configText.includes('"BOOKMARKS_FILE": "')).toBe(false);
    expect(configText.includes('"CDP_HTTP": "http://127.0.0.1:9333"')).toBe(
      true,
    );
    expect(configText.includes("INBOX_FOLDER_ID")).toBe(false);
  });
});
