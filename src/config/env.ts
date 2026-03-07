import crypto from "node:crypto";
import {
  DEFAULT_CHROME_PROFILE_DIR,
  DEFAULT_PORT,
  DEFAULT_WEBHOOK_TIMEOUT_MS,
} from "./constants";

export type AuthMode =
  | { enabled: false }
  | { enabled: true; token: string; generated: boolean };

export type StartupConfig = {
  port: number;
  chromeProfileDir: string;
  auth: AuthMode;
  webhooks: {
    urls: string[];
    timeoutMs: number;
  };
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

function isHttpUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function parseWebhookUrls(rawUrls: string | undefined): string[] {
  if (!rawUrls) {
    return [];
  }

  return rawUrls
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .filter((entry) => isHttpUrl(entry));
}

function parseWebhookTimeout(input: string | undefined): number {
  const parsed = Number.parseInt(String(input ?? DEFAULT_WEBHOOK_TIMEOUT_MS), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_WEBHOOK_TIMEOUT_MS;
  }
  return parsed;
}

export function resolveStartupConfig(env: NodeJS.ProcessEnv): StartupConfig {
  return {
    port: parsePort(env.PORT),
    chromeProfileDir:
      env.CHROME_PROFILE_DIR?.trim() || DEFAULT_CHROME_PROFILE_DIR,
    auth: resolveAuthMode(env.AUTH_TOKEN),
    webhooks: {
      urls: parseWebhookUrls(env.WEBHOOK_URLS),
      timeoutMs: parseWebhookTimeout(env.WEBHOOK_TIMEOUT_MS),
    },
  };
}
