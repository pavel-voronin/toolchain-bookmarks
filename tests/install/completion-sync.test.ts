import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "bun:test";

const REPO_ROOT = path.resolve(import.meta.dir, "../..");
const CLI_PATH = path.join(REPO_ROOT, "src", "cli.ts");
const INSTALL_PATH = path.join(REPO_ROOT, "install.sh");

function extractRegisteredCommandFiles(cliText: string): string[] {
  const importPattern =
    /^import\s+register[A-Za-z0-9_]+\s+from\s+"(\.\/commands\/[^"]+)";$/gm;
  const out: string[] = [];

  for (const match of cliText.matchAll(importPattern)) {
    const rel = match[1];
    if (!rel) {
      continue;
    }
    out.push(path.join(REPO_ROOT, "src", `${rel.slice(2)}.ts`));
  }

  return out;
}

function extractCommandNameFromCommandFile(filePath: string): string {
  const text = fs.readFileSync(filePath, "utf8");
  const match = text.match(/\.command\(\s*"([^"]+)"/m);
  if (!match?.[1]) {
    throw new Error(`failed to extract .command() from ${filePath}`);
  }
  return match[1].trim().split(/\s+/)[0] ?? "";
}

function extractCompletionCommands(installText: string): string[] {
  const blockMatch = installText.match(
    /commands=\(\n([\s\S]*?)\n\s*\)\n\n\s*_arguments/,
  );
  if (!blockMatch?.[1]) {
    throw new Error("failed to extract commands=(...) block from install.sh");
  }

  const entries = blockMatch[1]
    .split("\n")
    .map((line) => line.match(/^\s*'([a-z0-9-]+):/i)?.[1] ?? "")
    .filter((name) => name.length > 0);

  return Array.from(new Set(entries));
}

describe("install zsh completion", () => {
  test("command list matches commands registered in src/cli.ts", () => {
    const cliText = fs.readFileSync(CLI_PATH, "utf8");
    const installText = fs.readFileSync(INSTALL_PATH, "utf8");

    const commandFiles = extractRegisteredCommandFiles(cliText);
    const cliCommands = Array.from(
      new Set(commandFiles.map(extractCommandNameFromCommandFile)),
    ).sort();
    const completionCommands = extractCompletionCommands(installText).sort();

    expect(completionCommands).toEqual(cliCommands);
  });

  test("completion options match current CLI contract", () => {
    const installText = fs.readFileSync(INSTALL_PATH, "utf8");

    expect(installText).not.toContain("--repl-json");
    expect(installText).not.toContain("session-json");

    expect(installText).toContain("'(-j --json)'{-j,--json}'[JSON output]'");
    expect(installText).toContain("'(-H --human)'{-H,--human}'[Human output]'");
    expect(installText).toContain(
      "'(-j --json)'{-j,--json}'[JSON output by default in REPL]'",
    );
    expect(installText).toContain(
      "'(-H --human)'{-H,--human}'[Human output by default in REPL]'",
    );
  });
});
