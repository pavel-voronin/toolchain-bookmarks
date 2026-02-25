import fs from "node:fs";
import path from "node:path";

type ErrorLogPayload = {
  message: string;
  code?: number;
  stack?: string;
};

export function logCommandError(payload: ErrorLogPayload): void {
  try {
    const file = path.join(process.cwd(), "errors.log");
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      argv: process.argv.slice(2),
      message: payload.message,
      code: payload.code ?? null,
      stack: payload.stack ?? null,
    });
    fs.appendFileSync(file, `${line}\n`, "utf8");
  } catch {
    // Logging must never break command execution.
  }
}
