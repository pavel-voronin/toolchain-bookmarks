import type { CAC } from "cac";
import { withAction } from "../action";

export default function registerGetChildrenCommand(cli: CAC): void {
  cli
    .command("get-children <id>", "Get children of a folder id")
    .option("-j, --json", "JSON output")
    .option("-f, --fields <fields>", "Comma-separated output fields", {
      default: "id,title,type,url,path,parentId,index",
    })
    .action(
      withAction(async ({ api }, id: string) => {
        return api.getChildren(id);
      }),
    );
}
