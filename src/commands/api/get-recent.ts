import type { CAC } from "cac";
import { withAction } from "../action";
import { fail } from "../../utils/print";

export default function registerGetRecentCommand(cli: CAC): void {
  cli
    .command("get-recent <count>", "Get N most recent bookmarks")
    .option("-j, --json", "JSON output")
    .option("-f, --fields <fields>", "Comma-separated output fields", {
      default: "id,title,type,url,path,parentId,index",
    })
    .action(
      withAction(async ({ api }, count: string) => {
        const parsedCount = Number.parseInt(count, 10);
        if (!Number.isFinite(parsedCount)) {
          fail("count must be an integer", 2);
        }
        return api.getRecent(parsedCount);
      }),
    );
}
