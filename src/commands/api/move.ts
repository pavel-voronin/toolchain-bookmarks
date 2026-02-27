import type { CAC } from "cac";
import { withAction } from "../action";
import { fail } from "../../utils/print";

export default function registerMoveCommand(cli: CAC): void {
  cli
    .command("move <id>", "Move bookmark or folder")
    .option("--parent-id <id>", "Target parent folder id")
    .option("--index <n>", "Target index")
    .option("-j, --json", "JSON output")
    .option("-f, --fields <fields>", "Comma-separated output fields", {
      default: "id,title,type,url,path,parentId,index",
    })
    .action(
      withAction(
        async (
          { api },
          id: string,
          options: { parentId?: string | number; index?: string | number },
        ) => {
          const parentId =
            options.parentId === undefined ? undefined : String(options.parentId);
          if (!parentId) {
            fail(
              "Usage: bookmarks move <id> --parent-id <id> [--index <n>]",
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

          return api.move(id, {
            parentId,
            ...(parsedIndex !== undefined ? { index: parsedIndex } : {}),
          });
        },
      ),
    );
}
