import { describe, expect, test } from "vitest";
import {
  DEFAULT_CDP_HTTP,
  DEFAULT_PORT,
  DEFAULT_WEBHOOK_TIMEOUT_MS,
} from "../../src/config/constants";
import { resolveStartupConfig } from "../../src/config/env";

describe("resolveStartupConfig", () => {
  test("falls back to default port when PORT is above 65535", () => {
    const cfg = resolveStartupConfig({
      PORT: "65536",
    } as NodeJS.ProcessEnv);

    expect(cfg.port).toBe(DEFAULT_PORT);
  });

  test("falls back to default port when PORT is not a number", () => {
    const cfg = resolveStartupConfig({
      PORT: "abc",
    } as NodeJS.ProcessEnv);

    expect(cfg.port).toBe(DEFAULT_PORT);
  });

  test("uses provided valid port and chrome profile dir", () => {
    const cfg = resolveStartupConfig({
      PORT: "3010",
      CHROME_PROFILE_DIR: " /tmp/profile ",
      AUTH_TOKEN: "  my-token ",
    } as NodeJS.ProcessEnv);

    expect(cfg.port).toBe(3010);
    expect(cfg.chromeProfileDir).toBe("/tmp/profile");
    expect(cfg.cdpHttpUrl).toBe(DEFAULT_CDP_HTTP);
    expect(cfg.auth).toEqual({
      enabled: true,
      token: "my-token",
      generated: false,
    });
    expect(cfg.webhooks.urls).toEqual([]);
    expect(cfg.webhooks.timeoutMs).toBe(DEFAULT_WEBHOOK_TIMEOUT_MS);
  });

  test("parses webhook urls and timeout", () => {
    const cfg = resolveStartupConfig({
      WEBHOOK_URLS:
        " https://hooks.example/a, http://hooks.example/b ,not-a-url,ftp://invalid ",
      WEBHOOK_TIMEOUT_MS: "7000",
    } as NodeJS.ProcessEnv);

    expect(cfg.webhooks.urls).toEqual([
      "https://hooks.example/a",
      "http://hooks.example/b",
    ]);
    expect(cfg.webhooks.timeoutMs).toBe(7000);
  });

  test("uses normalized external Chrome CDP URL", () => {
    const cfg = resolveStartupConfig({
      CHROME_CDP_URL: " http://chrome:9222/ ",
    } as NodeJS.ProcessEnv);

    expect(cfg.cdpHttpUrl).toBe("http://chrome:9222");
  });

  test("falls back to default Chrome CDP URL when invalid", () => {
    const cfg = resolveStartupConfig({
      CHROME_CDP_URL: "ws://chrome:9222",
    } as NodeJS.ProcessEnv);

    expect(cfg.cdpHttpUrl).toBe(DEFAULT_CDP_HTTP);
  });

  test("falls back to default Chrome CDP URL when malformed", () => {
    const cfg = resolveStartupConfig({
      CHROME_CDP_URL: "not-a-url",
    } as NodeJS.ProcessEnv);

    expect(cfg.cdpHttpUrl).toBe(DEFAULT_CDP_HTTP);
  });

  test("falls back to default webhook timeout when invalid", () => {
    const cfg = resolveStartupConfig({
      WEBHOOK_URLS: "https://hooks.example/a",
      WEBHOOK_TIMEOUT_MS: "-1",
    } as NodeJS.ProcessEnv);

    expect(cfg.webhooks.urls).toEqual(["https://hooks.example/a"]);
    expect(cfg.webhooks.timeoutMs).toBe(DEFAULT_WEBHOOK_TIMEOUT_MS);
  });
});
