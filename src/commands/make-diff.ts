import { loadConfig, resolvePaths } from '../config/runtime';
import { makeDiff } from '../diff/engine';
import { printOutput } from '../utils/print';

export async function runMakeDiff(options: { json?: boolean } = {}): Promise<void> {
  const paths = resolvePaths();
  const config = await loadConfig(paths);
  const result = makeDiff(paths, config);
  printOutput({ ok: true, ...result }, Boolean(options.json), result.wroteDiff ? `diff ${result.diffId}` : result.reason ?? 'no diff');
}
