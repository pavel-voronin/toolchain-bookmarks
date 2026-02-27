import type { CAC } from "cac";
import { withAction } from "../action";
import { fail } from "../../utils/print";

export default function registerCreateCommand(cli: CAC): void {
  cli
    .command("create", "Create bookmark or folder")
    .option("--parent-id <id>", "Parent folder id")
    .option("--title <title>", "Node title")
    .option("--url <url>", "Bookmark URL (omit to create folder)")
    .option("--index <n>", "Child index")
    .option("-j, --json", "JSON output")
    .option("-f, --fields <fields>", "Comma-separated output fields", {
      default: "id,title,type,url,path,parentId,index",
    })
    .action(
      withAction(
        async (
          { api },
          options: {
            parentId?: string | number;
            title?: string | number;
            url?: string | number;
            index?: string | number;
          },
        ) => {
          const parentId =
            options.parentId === undefined ? undefined : String(options.parentId);
          const title = options.title === undefined ? undefined : String(options.title);
          const url = options.url === undefined ? undefined : String(options.url);

          if (!parentId || !title) {
            fail(
              "Usage: bookmarks create --parent-id <id> --title <title> [--url <url>] [--index <n>]",
              2,
            );
          }
          const parsedIndex =
            options.index === undefined
              ? undefined
              : Number.parseInt(String(options.index), 10);
          if (parsedIndex !== undefined && !Number.isFinite(parsedIndex)) {
            fail("index must be an integer", 2);
          }

          return api.create({
            parentId,
            title,
            url,
            ...(parsedIndex !== undefined ? { index: parsedIndex } : {}),
          });
        },
      ),
    );
}
