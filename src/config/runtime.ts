import fs from "node:fs";
import path from "node:path";
import { DEFAULT_CONFIG } from "./defaults";
import type { AppPaths, RuntimeConfig } from "../types/config";

export function resolvePaths(): AppPaths {
  const runtimeRoot = path.dirname(process.execPath);
  return {
    cwd: runtimeRoot,
    configPath: path.join(runtimeRoot, "config.ts"),
    skillDir: path.join(runtimeRoot, "skills", "bookmarks"),
    systemdDir: path.join(runtimeRoot, "systemd"),
    snapshotsDir: path.join(runtimeRoot, "snapshots"),
    diffsDir: path.join(runtimeRoot, "diffs"),
    stateDir: runtimeRoot,
    stateFile: path.join(runtimeRoot, "state.json"),
    requestsDir: path.join(runtimeRoot, "requests"),
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
