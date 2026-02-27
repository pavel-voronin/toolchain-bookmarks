import type { CAC } from "cac";
import { fail } from "../../utils/print";
import { startRepl } from "../../repl";

export default function registerReplCommand(cli: CAC): void {
  cli
    .command("repl", "Start interactive shell")
    .option("-j, --json", "JSON output by default in REPL")
    .option("-H, --human", "Human output by default in REPL")
    .action(async (options: unknown) => {
      try {
        const replOptions = options as {
          json?: boolean;
          human?: boolean;
        };
        await startRepl(cli, {
          defaultJson: replOptions.human ? false : Boolean(replOptions.json),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        fail(message, 2);
      }
    });
}
