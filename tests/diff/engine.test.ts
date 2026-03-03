import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import { appendDiffEvent } from "../../src/diff/engine";
import type { AppPaths } from "../../src/types/config";
import { setupWorkspace } from "../helpers/workspace";

function makePaths(runDir: string): AppPaths {
  return {
    cwd: runDir,
    configPath: path.join(runDir, "config.ts"),
    skillDir: path.join(runDir, "skills", "bookmarks"),
    systemdDir: path.join(runDir, "systemd"),
    diffsDir: path.join(runDir, "diffs"),
    stateDir: runDir,
    stateFile: path.join(runDir, "state.json"),
    baselineFile: path.join(runDir, "baseline.json"),
    requestsDir: path.join(runDir, "requests"),
  };
}

describe("diff engine", () => {
  test("appendDiffEvent uses monotonic id based on existing files and cursor", () => {
    const ctx = setupWorkspace();
    const paths = makePaths(ctx.runDir);

    fs.writeFileSync(
      paths.stateFile,
      `${JSON.stringify(
        {
          lastSeq: 3,
          lastDeliveredDiffId: 9,
          initializedAt: "",
          lastHeartbeatAt: "",
          lastEventAt: "",
          lastError: "",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    for (const id of [4, 5, 6, 7, 8, 9]) {
      fs.writeFileSync(
        path.join(paths.diffsDir, `${String(id).padStart(12, "0")}.json`),
        `${JSON.stringify({ schema_version: 1, id, ts: "", event: null }, null, 2)}\n`,
        "utf8",
      );
    }

    const doc = appendDiffEvent(paths, {
      type: "link_created",
      payload: {
        id: "100",
        type: "link",
        title: "OpenAI",
        url: "https://openai.com",
      },
    });

    expect(doc.id).toBe(10);
    expect(fs.existsSync(path.join(paths.diffsDir, "000000000010.json"))).toBe(true);
  });
});
