import fs from 'node:fs';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { RuntimeConfig } from '../types/config';

type PromptIo = {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
  close: () => void;
};

function getPromptIo(): PromptIo | null {
  if (input.isTTY && output.isTTY) {
    return { input, output, close: () => undefined };
  }

  try {
    const fd = fs.openSync('/dev/tty', 'r+');
    fs.closeSync(fd);
    const ttyIn = fs.createReadStream('/dev/tty');
    const ttyOut = fs.createWriteStream('/dev/tty');
    return {
      input: ttyIn,
      output: ttyOut,
      close: () => {
        ttyIn.close();
        ttyOut.end();
      }
    };
  } catch {
    return null;
  }
}

async function ask(rl: readline.Interface, label: string, fallback: string): Promise<string> {
  const suffix = fallback ? ` [${fallback}]` : '';
  const answer = (await rl.question(`${label}${suffix}: `)).trim();
  return answer.length > 0 ? answer : fallback;
}

export async function promptConfig(
  base: RuntimeConfig
): Promise<RuntimeConfig> {
  const promptIo = getPromptIo();
  if (!promptIo) {
    return base;
  }

  const rl = readline.createInterface({ input: promptIo.input, output: promptIo.output });
  try {
    return {
      BOOKMARKS_FILE: await ask(rl, 'BOOKMARKS_FILE', base.BOOKMARKS_FILE),
      CDP_HTTP: await ask(rl, 'CDP_HTTP', base.CDP_HTTP),
      BOOKMARKS_EXTENSION_ID: await ask(rl, 'BOOKMARKS_EXTENSION_ID', base.BOOKMARKS_EXTENSION_ID),
      INBOX_FOLDER_ID: await ask(rl, 'INBOX_FOLDER_ID', base.INBOX_FOLDER_ID)
    };
  } catch {
    return base;
  } finally {
    rl.close();
    promptIo.close();
  }
}
