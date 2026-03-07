import crypto from "node:crypto";
import { DEFAULT_CHROME_PROFILE_DIR, DEFAULT_PORT } from "./constants";

export type AuthMode =
  | { enabled: false }
  | { enabled: true; token: string; generated: boolean };

export type StartupConfig = {
  port: number;
  chromeProfileDir: string;
  auth: AuthMode;
};

function parsePort(input: string | undefined): number {
  const parsed = Number.parseInt(String(input ?? DEFAULT_PORT), 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65_535) {
    return DEFAULT_PORT;
  }
  return parsed;
}

function resolveAuthMode(rawToken: string | undefined): AuthMode {
  const normalized = rawToken?.trim();

  if (normalized === "off") {
    return { enabled: false };
  }

  if (normalized && normalized.length > 0) {
    return { enabled: true, token: normalized, generated: false };
  }

  return {
    enabled: true,
    token: crypto.randomBytes(24).toString("hex"),
    generated: true,
  };
}

export function resolveStartupConfig(env: NodeJS.ProcessEnv): StartupConfig {
  return {
    port: parsePort(env.PORT),
    chromeProfileDir:
      env.CHROME_PROFILE_DIR?.trim() || DEFAULT_CHROME_PROFILE_DIR,
    auth: resolveAuthMode(env.AUTH_TOKEN),
  };
}
