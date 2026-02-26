import type { CAC } from "cac";
import { withAction } from "../action";

export default function registerRemoveCommand(cli: CAC): void {
  cli
    .command("remove <id>", "Remove a bookmark node")
    .option("-j, --json", "JSON output")
    .option("-f, --fields <fields>", "Comma-separated output fields", {
      default: "id,title,type,url,path",
    })
    .action(
      withAction(
        async ({ api }, id: string) => {
          return api.remove(id);
        },
        ({ positionalArgs }) => {
          const id = positionalArgs?.[0] as string;
          return `Object with ID ${id} was removed successfully.`;
        },
      ),
    );
}
