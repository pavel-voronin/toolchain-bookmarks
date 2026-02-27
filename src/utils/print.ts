import { logCommandError } from "./errors";
import { CommandFailure, isInteractiveMode } from "../runtime/interactive";

export function printOutput(
  payload: unknown,
  json: boolean,
  text: string,
): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
    return;
  }
  process.stdout.write(`${text}\n`);
}

export function fail(message: string, code = 1): never {
  logCommandError({ message, code });
  process.stderr.write(`${message}\n`);
  if (isInteractiveMode()) {
    throw new CommandFailure(message, code, true);
  }
  process.exit(code);
}
