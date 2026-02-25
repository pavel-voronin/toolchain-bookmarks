import type { CAC } from "cac";
import { withAction } from "../action";
import { loadConfig, resolvePaths } from "../../config/runtime";
import { fail } from "../../utils/print";

export default function registerInboxLinksCommand(cli: CAC): void {
  cli
    .command("inbox-links", "Get configured inbox subtree")
    .option("-j, --json", "JSON output")
    .option("-f, --fields <fields>", "Comma-separated output fields", {
      default: "id,title,type,url,path,children,parentId,index",
    })
    .action(
      withAction(async ({ api }) => {
        const config = await loadConfig(resolvePaths());
        if (!config.INBOX_FOLDER_ID) {
          fail(
            "Inbox folder is not configured. Run `bookmarks init` and choose an inbox folder.",
            1,
          );
        }
        return api.getSubTree(config.INBOX_FOLDER_ID);
      }),
    );
}
