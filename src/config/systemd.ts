import fs from "node:fs";
import path from "node:path";
import serviceTemplate from "../../assets/systemd/bookmarks.service" with { type: "text" };
import { ensureDir } from "../utils/fs";

function render(content: string, cwd: string): string {
  return content
    .replaceAll("{{BOOKMARKS_CWD}}", cwd)
    .replaceAll("{{BOOKMARKS_BIN}}", path.join(cwd, "bookmarks"));
}

export function writeSystemdFiles(
  systemdDir: string,
  cwd: string,
): { files: string[] } {
  ensureDir(systemdDir);
  const servicePath = path.join(systemdDir, "bookmarks.service");

  fs.writeFileSync(servicePath, render(String(serviceTemplate), cwd), "utf8");

  return { files: [servicePath] };
}
