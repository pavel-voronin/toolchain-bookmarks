import readline from "node:readline";
import type { CAC, Command } from "cac";
import { logCommandError } from "./utils/errors";
import { CommandFailure, setInteractiveMode } from "./runtime/interactive";

type ReplOptions = {
  defaultJson?: boolean;
};

const REPL_PROMPT = "bookmarks> ";

export function tokenizeReplInput(line: string): string[] {
  const out: string[] = [];
  let token = "";
  let quote: '"' | "'" | null = null;
  let escaped = false;
  let tokenStarted = false;

  const pushToken = () => {
    if (!tokenStarted) {
      return;
    }
    out.push(token);
    token = "";
    tokenStarted = false;
  };

  for (const ch of line) {
    if (escaped) {
      token += ch;
      tokenStarted = true;
      escaped = false;
      continue;
    }

    if (ch === "\\" && quote !== "'") {
      escaped = true;
      tokenStarted = true;
      continue;
    }

    if (quote) {
      if (ch === quote) {
        quote = null;
        tokenStarted = true;
      } else {
        token += ch;
        tokenStarted = true;
      }
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      tokenStarted = true;
      continue;
    }

    if (/\s/.test(ch)) {
      pushToken();
      continue;
    }

    token += ch;
    tokenStarted = true;
  }

  if (escaped) {
    throw new Error("invalid escape sequence at end of line");
  }
  if (quote) {
    throw new Error("unterminated quoted string");
  }

  if (tokenStarted) {
    out.push(token);
  }
  return out;
}

function extractOptionAliases(option: { rawName: string }): string[] {
  const aliases = option.rawName.match(/--?[a-zA-Z0-9][a-zA-Z0-9-]*/g) ?? [];
  return aliases;
}

function getCommandOptionAliases(cli: CAC, commandName: string): string[] {
  const command = cli.commands.find((item) => item.name === commandName);
  if (!command) {
    return [];
  }

  const merged = [...cli.globalCommand.options, ...command.options];
  return [...new Set(merged.flatMap((option) => extractOptionAliases(option)))];
}

function buildCompleter(cli: CAC) {
  const commandNames = cli.commands
    .map((command) => command.name)
    .filter((name) => name.length > 0 && name !== "repl");
  const builtins = ["help", "exit", "quit", "clear"];

  return (line: string): [string[], string] => {
    const endsWithSpace = /\s$/.test(line);
    const parts = line.trim().length === 0 ? [] : line.trim().split(/\s+/);
    const current = endsWithSpace
      ? ""
      : (parts[parts.length - 1] ?? "");

    if (parts.length <= 1) {
      const pool = [...commandNames, ...builtins];
      const matches = pool
        .filter((name) => name.startsWith(current))
        .sort((a, b) => a.localeCompare(b));
      return [matches.length > 0 ? matches : pool, current];
    }

    const commandName = parts[0] ?? "";
    if (!commandNames.includes(commandName) || !current.startsWith("-")) {
      return [[], current];
    }

    const options = getCommandOptionAliases(cli, commandName).sort((a, b) =>
      a.localeCompare(b),
    );
    const matches = options.filter((opt) => opt.startsWith(current));
    return [matches.length > 0 ? matches : options, current];
  };
}

function isPromise(value: unknown): value is Promise<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

async function executeReplCommand(
  cli: CAC,
  commandLine: string,
  defaultJson: boolean,
): Promise<void> {
  const tokens = tokenizeReplInput(commandLine);
  if (tokens.length === 0) {
    return;
  }

  const [head] = tokens;
  if (!head) {
    return;
  }
  if (head === "repl") {
    process.stdout.write("Already in REPL.\n");
    return;
  }

  cli.unsetMatchedCommand();
  cli.parse(["bun", "bookmarks", ...tokens], { run: false });

  if (!cli.matchedCommand) {
    if (cli.options.help || cli.options.version) {
      return;
    }
    const unknown = cli.args[0] ?? head;
    process.stderr.write(`Unknown command: ${unknown}\n`);
    return;
  }

  applyReplOutputMode(cli.options as Record<string, unknown>, defaultJson);

  const output = cli.runMatchedCommand();
  if (isPromise(output)) {
    await output;
  }
}

function clearScreen(): void {
  readline.cursorTo(process.stdout, 0, 0);
  readline.clearScreenDown(process.stdout);
}

export async function startRepl(
  cli: CAC,
  options: ReplOptions = {},
): Promise<void> {
  const defaultJson = Boolean(options.defaultJson);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: REPL_PROMPT,
    completer: buildCompleter(cli),
    historySize: 200,
  });

  setInteractiveMode(true);
  process.stdout.write("Interactive mode. Type 'help' for commands.\n");
  if (defaultJson) {
    process.stdout.write("Default output mode: JSON.\n");
  }

  rl.prompt();

  try {
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) {
        rl.prompt();
        continue;
      }

      if (trimmed === "exit" || trimmed === "quit" || trimmed === ".exit") {
        rl.close();
        break;
      }
      if (trimmed === "clear") {
        clearScreen();
        rl.prompt();
        continue;
      }
      if (trimmed === "help" || trimmed === ".help") {
        process.stdout.write("Use regular bookmarks commands.\n");
        process.stdout.write("Special commands: help, clear, exit, quit.\n");
        rl.prompt();
        continue;
      }

      try {
        await executeReplCommand(cli, line, defaultJson);
      } catch (error) {
        if (error instanceof CommandFailure && error.reported) {
          rl.prompt();
          continue;
        }
        const message = error instanceof Error ? error.message : String(error);
        logCommandError({
          message,
          stack: error instanceof Error ? error.stack : undefined,
        });
        process.stderr.write(`${message}\n`);
      }

      rl.prompt();
    }
  } finally {
    setInteractiveMode(false);
    rl.close();
  }
}

export function parseReplStartupOptions(args: string[]): {
  shouldStartRepl: boolean;
  defaultJson: boolean;
} {
  if (args.length === 0) {
    return { shouldStartRepl: true, defaultJson: false };
  }

  let defaultJson = false;
  let seenHelpOrVersion = false;
  let seenOnlyReplFlags = true;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";

    if (arg === "-h" || arg === "--help" || arg === "-v" || arg === "--version") {
      seenHelpOrVersion = true;
      continue;
    }
    if (arg === "-j" || arg === "--json") {
      defaultJson = true;
      continue;
    }
    if (arg === "-H" || arg === "--human") {
      defaultJson = false;
      continue;
    }
    if (arg.startsWith("-")) {
      seenOnlyReplFlags = false;
      break;
    }
    seenOnlyReplFlags = false;
    break;
  }

  if (seenHelpOrVersion) {
    return { shouldStartRepl: false, defaultJson: false };
  }

  if (seenOnlyReplFlags) {
    return { shouldStartRepl: true, defaultJson };
  }

  return { shouldStartRepl: false, defaultJson: false };
}

export function applyReplOutputMode(
  options: Record<string, unknown>,
  defaultJson: boolean,
): void {
  const human = Boolean(options.human);
  const explicitJson = Boolean(options.json);
  options.json = human ? false : (explicitJson || defaultJson);
}

export function commandNames(cli: CAC): string[] {
  return cli.commands
    .map((command: Command) => command.name)
    .filter((name) => name.length > 0);
}
