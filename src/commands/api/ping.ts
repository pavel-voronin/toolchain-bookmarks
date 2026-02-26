import type { CAC } from "cac";
import { withAction } from "../action";

export default function registerPingCommand(cli: CAC): void {
  cli
    .command("ping", "Health check for bridge")
    .option("-j, --json", "JSON output")
    .option("-f, --fields <fields>", "Comma-separated output fields")
    .action(
      withAction(
        async ({ api }) => {
          return api.ping();
        },
        () => "pong",
      ),
    );
}
