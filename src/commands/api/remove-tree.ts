import type { CAC } from "cac";
import { withAction } from "../action";

export default function registerRemoveTreeCommand(cli: CAC): void {
  cli
    .command("remove-tree <id>", "Remove folder subtree")
    .option("-j, --json", "JSON output")
    .option("-f, --fields <fields>", "Comma-separated output fields", {
      default: "id,title,type,url,path",
    })
    .action(
      withAction(
        async ({ api }, id: string) => {
          return api.removeTree(id);
        },
        ({ positionalArgs }) => {
          const id = positionalArgs?.[0] as string;
          return `Tree rooted at ID ${id} was removed successfully.`;
        },
      ),
    );
}
