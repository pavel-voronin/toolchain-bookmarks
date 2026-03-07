import { describe, expect, test } from "vitest";
import { DEFAULT_PORT } from "../../src/config/constants";
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
    expect(cfg.auth).toEqual({
      enabled: true,
      token: "my-token",
      generated: false,
    });
  });
});
