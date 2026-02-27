import { describe, expect, test } from "bun:test";
import {
  runBookmarksInteractive,
  setupWorkspace,
  writeBookmarksFixture,
} from "../helpers/workspace";

describe("repl integration", () => {
  test("applies -j as default mode and allows -H override per command", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, true);

    const result = runBookmarksInteractive(
      ctx.runDir,
      ["-j"],
      ["get 100", "get 100 -H", "exit", ""].join("\n"),
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Default output mode: JSON.");
    expect(result.stdout.match(/\{\"ok\":true/g)?.length ?? 0).toBe(1);
    expect(result.stdout).toContain("OpenAI");
  });
});
