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
            parentId?: string;
            title?: string;
            url?: string;
            index?: string;
          },
        ) => {
          if (!options.parentId || !options.title) {
            fail(
              "Usage: bookmarks create --parent-id <id> --title <title> [--url <url>] [--index <n>]",
              2,
            );
          }
          const parsedIndex =
            options.index === undefined
              ? undefined
              : Number.parseInt(options.index, 10);
          if (parsedIndex !== undefined && !Number.isFinite(parsedIndex)) {
            fail("index must be an integer", 2);
          }

          return api.create({
            parentId: options.parentId,
            title: options.title,
            url: options.url,
            ...(parsedIndex !== undefined ? { index: parsedIndex } : {}),
          });
        },
      ),
    );
}
