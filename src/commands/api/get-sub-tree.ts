import type { CAC } from "cac";
import { withAction } from "../action";

export default function registerGetSubTreeCommand(cli: CAC): void {
  cli
    .command("get-sub-tree <id>", "Get subtree for a node id")
    .option("-j, --json", "JSON output")
    .option("-f, --fields <fields>", "Comma-separated output fields", {
      default: "id,title,type,url,path,children,parentId,index",
    })
    .action(
      withAction(async ({ api }, id: string) => {
        return api.getSubTree(id);
      }),
    );
}
