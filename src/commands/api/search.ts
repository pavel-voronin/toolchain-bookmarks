import type { CAC } from "cac";
import { withAction } from "../action";

export default function registerSearchCommand(cli: CAC): void {
  cli
    .command("search <query...>", "Search bookmarks by query")
    .option("-j, --json", "JSON output")
    .option("-f, --fields <fields>", "Comma-separated output fields", {
      default: "id,title,type,url,path,parentId,index",
    })
    .action(
      withAction(async ({ api }, query: string | string[]) => {
        return api.search(Array.isArray(query) ? query.join(" ") : query);
      }),
    );
}
