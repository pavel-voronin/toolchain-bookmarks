import { loadConfig, resolvePaths, resolveRuntimeDir } from '../config/runtime';
import { readNextDiffFromCursor } from '../diff/engine';
import { printOutput } from '../utils/print';

export async function runDiff(options: { json?: boolean } = {}): Promise<void> {
  const paths = resolvePaths();
  const config = await loadConfig(paths);
  const next = readNextDiffFromCursor(paths, resolveRuntimeDir(paths.cwd, config.DIFFS_DIR));

  if (!next) {
    printOutput({ ok: true, event: null }, Boolean(options.json), 'no new diff');
    return;
  }

  printOutput({ ok: true, event: next }, Boolean(options.json), `diff ${next.id}`);
}
