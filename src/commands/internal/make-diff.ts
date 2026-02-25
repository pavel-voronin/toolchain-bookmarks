import type { CAC } from "cac";
import { loadConfig, resolvePaths } from "../../config/runtime";
import { makeDiff } from "../../diff/engine";
import { printOutput } from "../../utils/print";

async function runMakeDiff(options: { json?: boolean } = {}): Promise<void> {
  const paths = resolvePaths();
  const config = await loadConfig(paths);
  const result = makeDiff(paths, config);
  printOutput(
    { ok: true, ...result },
    Boolean(options.json),
    result.wroteDiff ? `diff ${result.diffId}` : (result.reason ?? "no diff"),
  );
}

export default function registerMakeDiffCommand(cli: CAC): void {
  cli
    .command("make-diff", "Generate next diff from bookmarks file")
    .option("-j, --json", "JSON output")
    .action(async (options) => runMakeDiff(options));
}
