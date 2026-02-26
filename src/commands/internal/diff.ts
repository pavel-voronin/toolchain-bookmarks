import type { CAC } from "cac";
import { resolvePaths } from "../../config/runtime";
import { readNextDiffFromCursor } from "../../diff/engine";
import { renderHuman } from "../../output/render";
import { printOutput } from "../../utils/print";

async function runDiff(options: { json?: boolean } = {}): Promise<void> {
  const paths = resolvePaths();
  const next = readNextDiffFromCursor(paths, paths.diffsDir);

  if (!next) {
    printOutput(
      { ok: true, event: null },
      Boolean(options.json),
      renderHuman({ event: null }),
    );
    return;
  }

  printOutput(
    { ok: true, event: next },
    Boolean(options.json),
    renderHuman(next),
  );
}

export default function registerDiffCommand(cli: CAC): void {
  cli
    .command("diff", "Read diff stream using internal cursor")
    .option("-j, --json", "JSON output")
    .action(async (options) => runDiff(options));
}
