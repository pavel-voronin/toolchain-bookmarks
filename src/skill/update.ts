import fs from "node:fs";
import path from "node:path";
import { REQUIRED_SKILL_KEYS } from "../config/defaults";
import { loadSkillTemplateFiles } from "./template";
import { ensureDir, rmDirContents } from "../utils/fs";
import type { AppPaths, RuntimeConfig } from "../types/config";

function applyPlaceholders(input: string, cwd: string): string {
  const mapping: Record<string, string> = {
    BOOKMARKS_BIN: path.join(cwd, "bookmarks"),
  };

  for (const key of REQUIRED_SKILL_KEYS) {
    if (!mapping[key] || mapping[key].trim().length === 0) {
      throw new Error(`Missing required value for skill placeholder: ${key}`);
    }
  }

  return input.replace(
    /\{\{([A-Z0-9_]+)\}\}/g,
    (_, key: string) => mapping[key] ?? "",
  );
}

export function updateSkill(
  paths: AppPaths,
  config: RuntimeConfig,
): { updatedFiles: number } {
  ensureDir(paths.skillDir);
  rmDirContents(paths.skillDir);

  const files = loadSkillTemplateFiles();
  for (const file of files) {
    const target = path.join(paths.skillDir, file.relativePath);
    ensureDir(path.dirname(target));
    fs.writeFileSync(
      target,
      applyPlaceholders(file.content, paths.cwd),
      "utf8",
    );
  }

  return { updatedFiles: files.length };
}
