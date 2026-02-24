import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { RuntimeConfig } from '../types/config';

function hasTty(): boolean {
  return Boolean(input.isTTY && output.isTTY);
}

async function ask(rl: readline.Interface, label: string, fallback: string): Promise<string> {
  const suffix = fallback ? ` [${fallback}]` : '';
  const answer = (await rl.question(`${label}${suffix}: `)).trim();
  return answer.length > 0 ? answer : fallback;
}

export async function promptConfig(base: RuntimeConfig): Promise<RuntimeConfig> {
  if (!hasTty()) {
    return base;
  }

  const rl = readline.createInterface({ input, output });
  try {
    return {
      BOOKMARKS_FILE: await ask(rl, 'BOOKMARKS_FILE', base.BOOKMARKS_FILE),
      CDP_HTTP: await ask(rl, 'CDP_HTTP', base.CDP_HTTP),
      BOOKMARKS_EXTENSION_ID: await ask(rl, 'BOOKMARKS_EXTENSION_ID', base.BOOKMARKS_EXTENSION_ID),
      INBOX_FOLDER_ID: await ask(rl, 'INBOX_FOLDER_ID', base.INBOX_FOLDER_ID),
      INBOX_FOLDER_NAME: await ask(rl, 'INBOX_FOLDER_NAME', base.INBOX_FOLDER_NAME),
      SNAPSHOTS_DIR: await ask(rl, 'SNAPSHOTS_DIR', base.SNAPSHOTS_DIR),
      DIFFS_DIR: await ask(rl, 'DIFFS_DIR', base.DIFFS_DIR)
    };
  } finally {
    rl.close();
  }
}
