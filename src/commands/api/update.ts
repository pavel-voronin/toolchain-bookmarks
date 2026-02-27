import type { CAC } from "cac";
import { withAction } from "../action";
import { fail } from "../../utils/print";

export default function registerUpdateCommand(cli: CAC): void {
  cli
    .command("update <id>", "Update bookmark or folder fields")
    .option("--title <title>", "New title")
    .option("--url <url>", "New URL")
    .option("-j, --json", "JSON output")
    .option("-f, --fields <fields>", "Comma-separated output fields", {
      default: "id,title,type,url,path,parentId,index",
    })
    .action(
      withAction(
        async (
          { api },
          id: string,
          options: { title?: string | number; url?: string | number },
        ) => {
          const title =
            options.title === undefined ? undefined : String(options.title);
          const url = options.url === undefined ? undefined : String(options.url);

          if (!title && !url) {
            fail(
              "Usage: bookmarks update <id> [--title <title>] [--url <url>]",
              2,
            );
          }

          return api.update(id, {
            ...(title ? { title } : {}),
            ...(url ? { url } : {}),
          });
        },
      ),
    );
}
