import type { CAC } from "cac";
import { withAction } from "../action";

export default function registerGetTreeCommand(cli: CAC): void {
  cli
    .command("get-tree", "Get full bookmarks tree")
    .option("-j, --json", "JSON output")
    .option("-f, --fields <fields>", "Comma-separated output fields", {
      default: "id,title,type,url,path,children,parentId,index",
    })
    .action(
      withAction(async ({ api }) => {
        return api.getTree();
      }),
    );
}
