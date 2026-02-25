import type { CAC } from "cac";
import { withAction } from "../action";

export default function registerMethodsCommand(cli: CAC): void {
  cli
    .command("methods", "List supported bridge methods")
    .option("-j, --json", "JSON output")
    .option("-f, --fields <fields>", "Comma-separated output fields")
    .action(
      withAction(async ({ api }) => {
        return api.methods();
      }),
    );
}
