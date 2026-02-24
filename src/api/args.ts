import { fail } from '../utils/print';

export function parseApiArgs(command: string, argv: string[]): unknown[] {
  if (command === 'get') {
    if (argv.length === 0) {
      fail('Usage: bookmarks get <id...>', 2);
    }
    return [argv];
  }

  if (command === 'get-children' || command === 'get-sub-tree' || command === 'remove' || command === 'remove-tree') {
    if (argv.length !== 1) {
      fail(`Usage: bookmarks ${command} <id>`, 2);
    }
    return [argv[0]];
  }

  if (command === 'get-recent') {
    if (argv.length !== 1) {
      fail('Usage: bookmarks get-recent <count>', 2);
    }
    const n = Number.parseInt(argv[0] ?? '', 10);
    if (!Number.isFinite(n)) {
      fail('get-recent expects integer count', 2);
    }
    return [n];
  }

  if (command === 'search') {
    if (argv.length === 0) {
      fail('Usage: bookmarks search <query>', 2);
    }
    return [argv.join(' ')];
  }

  if (command === 'create') {
    const parsed = parseFlags(argv);
    const parentId = parsed['parent-id'];
    const title = parsed.title;
    if (!parentId || !title) {
      fail('Usage: bookmarks create --parent-id <id> --title <title> [--url <url>] [--index <n>]', 2);
    }
    const payload: Record<string, unknown> = { parentId, title };
    if (parsed.url) payload.url = parsed.url;
    if (parsed.index) payload.index = Number.parseInt(parsed.index, 10);
    return [payload];
  }

  if (command === 'update') {
    if (argv.length === 0) {
      fail('Usage: bookmarks update <id> [--title <title>] [--url <url>]', 2);
    }
    const [id, ...rest] = argv;
    const parsed = parseFlags(rest);
    const payload: Record<string, unknown> = {};
    if (parsed.title) payload.title = parsed.title;
    if (parsed.url) payload.url = parsed.url;
    return [id, payload];
  }

  if (command === 'move') {
    if (argv.length === 0) {
      fail('Usage: bookmarks move <id> --parent-id <id> [--index <n>]', 2);
    }
    const [id, ...rest] = argv;
    const parsed = parseFlags(rest);
    const parentId = parsed['parent-id'];
    if (!parentId) {
      fail('Usage: bookmarks move <id> --parent-id <id> [--index <n>]', 2);
    }
    const payload: Record<string, unknown> = { parentId };
    if (parsed.index) payload.index = Number.parseInt(parsed.index, 10);
    return [id, payload];
  }

  if (command === 'ping' || command === 'methods' || command === 'get-tree') {
    return [];
  }

  return argv;
}

function parseFlags(args: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    if (!key.startsWith('--')) {
      continue;
    }
    out[key.slice(2)] = args[i + 1] ?? '';
    i += 1;
  }
  return out;
}
