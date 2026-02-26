import { spawnSync } from "node:child_process";
import type { CAC } from "cac";
import { fail, printOutput } from "../../utils/print";

const DEFAULT_INSTALL_URL =
  "https://raw.githubusercontent.com/pavel-voronin/toolchain-bookmarks/main/install.sh";

function runUpdate(options: { json?: boolean } = {}): void {
  const installUrl =
    process.env.BOOKMARKS_INSTALL_SCRIPT_URL ?? DEFAULT_INSTALL_URL;
  const cmd = `BOOKMARKS_INSTALL_SKIP_INIT=1 curl -fsSL ${installUrl} | sh && ./bookmarks init && ./bookmarks skill-update`;
  const result = spawnSync("sh", ["-c", cmd], { stdio: "inherit" });

  if (result.status !== 0) {
    fail("update failed", 1);
  }

  printOutput({ ok: true, updated: true }, Boolean(options.json), "updated");
}

export default function registerUpdateCommand(cli: CAC): void {
  cli
    .command("self-update", "Reinstall CLI via install script")
    .option("-j, --json", "JSON output")
    .action((options) => runUpdate(options));
}
