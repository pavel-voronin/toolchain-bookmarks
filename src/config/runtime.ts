import fs from "node:fs";
import path from "node:path";
import { DEFAULT_CONFIG } from "./defaults";
import type { AppPaths, RuntimeConfig } from "../types/config";

export function resolvePaths(cwd = process.cwd()): AppPaths {
  return {
    cwd,
    configPath: path.join(cwd, "config.ts"),
    skillDir: path.join(cwd, "skills", "bookmarks"),
    systemdDir: path.join(cwd, "systemd"),
    snapshotsDir: path.join(cwd, "snapshots"),
    diffsDir: path.join(cwd, "diffs"),
    stateDir: cwd,
    stateFile: path.join(cwd, "state.json"),
    requestsDir: path.join(cwd, "requests"),
  };
}

export async function loadConfig(paths: AppPaths): Promise<RuntimeConfig> {
  if (!fs.existsSync(paths.configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  const mod = await import(`${paths.configPath}?t=${Date.now()}`);
  const loaded = (mod.default ?? mod.config ?? {}) as Partial<RuntimeConfig>;
  return {
    ...DEFAULT_CONFIG,
    ...loaded,
  };
}

export function renderConfigTs(config: RuntimeConfig): string {
  return `export const config = ${JSON.stringify(config, null, 2)} as const;\n\nexport default config;\n`;
}
