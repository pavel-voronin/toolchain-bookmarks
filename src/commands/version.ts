import { printOutput } from '../utils/print';

export function runVersion(version: string, options: { json?: boolean } = {}): void {
  printOutput({ ok: true, version }, Boolean(options.json), version);
}
