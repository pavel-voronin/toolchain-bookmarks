import { resolvePaths } from '../config/runtime';
import { readNextDiffFromCursor } from '../diff/engine';
import { printOutput } from '../utils/print';

export async function runDiff(options: { json?: boolean } = {}): Promise<void> {
  const paths = resolvePaths();
  const next = readNextDiffFromCursor(paths, paths.diffsDir);

  if (!next) {
    printOutput({ ok: true, event: null }, Boolean(options.json), 'no new diff');
    return;
  }

  printOutput({ ok: true, event: next }, Boolean(options.json), `diff ${next.id}`);
}
