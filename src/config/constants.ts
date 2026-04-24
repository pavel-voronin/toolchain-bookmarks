export const DEFAULT_CDP_HTTP = "http://127.0.0.1:9222";
export const DEFAULT_PORT = 3000;
export const DEFAULT_CHROME_PROFILE_DIR = "/data/chrome-profile";
export const DEFAULT_WEBHOOK_TIMEOUT_MS = 5_000;

export function resolveCdpHttpUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const raw = env.CHROME_CDP_URL?.trim();
  if (!raw) {
    return DEFAULT_CDP_HTTP;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return DEFAULT_CDP_HTTP;
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_CDP_HTTP;
  }
}
