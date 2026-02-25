import type { CAC } from "cac";
import { withAction } from "../action";

export default function registerGetCommand(cli: CAC): void {
  cli
    .command("get <id...>", "Get bookmarks by id(s)")
    .option("-j, --json", "JSON output")
    .option("-f, --fields <fields>", "Comma-separated output fields", {
      default: "id,title,type,url,path,parentId,index",
    })
    .action(
      withAction(async ({ api }, ids: string | string[]) => {
        return api.get(Array.isArray(ids) ? ids : [ids]);
      }),
    );
}
