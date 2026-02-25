import fs from "node:fs";
import path from "node:path";
import type { CAC } from "cac";
import { resolvePaths } from "../../config/runtime";
import { ensureDir } from "../../utils/fs";
import { fail, printOutput } from "../../utils/print";

function fileName(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(16).slice(2, 8);
  return `${ts}-${rand}.txt`;
}

function runRequest(
  descriptionParts: string[] | string,
  options: { json?: boolean } = {},
): void {
  const description = Array.isArray(descriptionParts)
    ? descriptionParts.join(" ").trim()
    : String(descriptionParts).trim();
  if (!description) {
    fail("Usage: bookmarks request <scenario description>", 2);
  }

  const paths = resolvePaths();
  ensureDir(paths.requestsDir);
  const target = path.join(paths.requestsDir, fileName());
  fs.writeFileSync(
    target,
    [
      `ts=${new Date().toISOString()}`,
      `cwd=${paths.cwd}`,
      `description=${description}`,
    ].join("\n") + "\n",
    "utf8",
  );

  printOutput(
    { ok: true, requestFile: target },
    Boolean(options.json),
    `request logged: ${target}`,
  );
}

export default function registerRequestCommand(cli: CAC): void {
  cli
    .command(
      "request <description...>",
      "Log scenario request before jq fallback",
    )
    .option("-j, --json", "JSON output")
    .action((description, options) => runRequest(description, options));
}
