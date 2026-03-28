import request from "supertest";
import { describe, expect, test, vi } from "vitest";
import type { BookmarksGateway } from "../../src/cdp/client";
import { EventBus } from "../../src/events/bus";
import { resolveStartupConfig } from "../../src/config/env";
import { isAuthorizedUpgradeRequest } from "../../src/server/auth";
import { createApp } from "../../src/server/app";

const gateway: BookmarksGateway = {
  call: vi.fn(async () => []),
};

describe("auth", () => {
  test("healthz is public", async () => {
    const app = createApp({
      gateway,
      bus: new EventBus(),
      auth: { enabled: true, token: "secret", generated: false },
    });

    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
  });

  test("syncz is public and reflects sync state", async () => {
    const syncedGateway: BookmarksGateway = {
      call: vi.fn(async () => [{ syncing: true }]),
    };
    const syncedApp = createApp({
      gateway: syncedGateway,
      bus: new EventBus(),
      auth: { enabled: true, token: "secret", generated: false },
    });

    const syncedRes = await request(syncedApp).get("/syncz");
    expect(syncedRes.status).toBe(200);
    expect(syncedRes.body).toEqual({ ok: true });

    const unsyncedGateway: BookmarksGateway = {
      call: vi.fn(async () => [{ syncing: false }]),
    };
    const unsyncedApp = createApp({
      gateway: unsyncedGateway,
      bus: new EventBus(),
      auth: { enabled: true, token: "secret", generated: false },
    });

    const unsyncedRes = await request(unsyncedApp).get("/syncz");
    expect(unsyncedRes.status).toBe(503);
    expect(unsyncedRes.body).toEqual({ ok: false });
  });

  test("syncz returns 503 when gateway check throws", async () => {
    const failingGateway: BookmarksGateway = {
      call: vi.fn(async () => {
        throw new Error("cdp unavailable");
      }),
    };
    const app = createApp({
      gateway: failingGateway,
      bus: new EventBus(),
      auth: { enabled: true, token: "secret", generated: false },
    });

    const res = await request(app).get("/syncz");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false });
  });

  test("requires bearer token when enabled", async () => {
    const app = createApp({
      gateway,
      bus: new EventBus(),
      auth: { enabled: true, token: "secret", generated: false },
    });

    const denied = await request(app)
      .post("/rpc")
      .send({ jsonrpc: "2.0", id: 1, method: "getTree", params: [] });
    expect(denied.status).toBe(401);

    const ok = await request(app)
      .post("/rpc")
      .set("Authorization", "Bearer secret")
      .send({ jsonrpc: "2.0", id: 1, method: "getTree", params: [] });
    expect(ok.status).toBe(200);
  });

  test("accepts lowercase bearer scheme", async () => {
    const app = createApp({
      gateway,
      bus: new EventBus(),
      auth: { enabled: true, token: "secret", generated: false },
    });

    const ok = await request(app)
      .post("/rpc")
      .set("Authorization", "bearer secret")
      .send({ jsonrpc: "2.0", id: 1, method: "getTree", params: [] });

    expect(ok.status).toBe(200);
  });

  test("rejects malformed bearer header", async () => {
    const app = createApp({
      gateway,
      bus: new EventBus(),
      auth: { enabled: true, token: "secret", generated: false },
    });

    const denied = await request(app)
      .post("/rpc")
      .set("Authorization", "Bearer")
      .send({ jsonrpc: "2.0", id: 1, method: "getTree", params: [] });

    expect(denied.status).toBe(401);
  });

  test("AUTH_TOKEN=off disables auth", async () => {
    const cfg = resolveStartupConfig({
      AUTH_TOKEN: "off",
    } as NodeJS.ProcessEnv);
    const app = createApp({
      gateway,
      bus: new EventBus(),
      auth: cfg.auth,
    });

    const res = await request(app)
      .post("/rpc")
      .send({ jsonrpc: "2.0", id: 1, method: "getTree", params: [] });

    expect(res.status).toBe(200);
  });

  test("empty AUTH_TOKEN generates token", async () => {
    const cfg = resolveStartupConfig({} as NodeJS.ProcessEnv);
    expect(cfg.auth.enabled).toBe(true);
    if (cfg.auth.enabled) {
      expect(cfg.auth.generated).toBe(true);
      expect(cfg.auth.token.length).toBeGreaterThan(10);
    }
  });

  test("upgrade auth accepts bearer header, query token, and auth=off", () => {
    const byHeader = isAuthorizedUpgradeRequest(
      {
        url: "/ws",
        headers: { host: "localhost", authorization: "Bearer secret" },
      } as never,
      { enabled: true, token: "secret", generated: false },
    );
    expect(byHeader).toBe(true);

    const byQuery = isAuthorizedUpgradeRequest(
      {
        url: "/ws?access_token=secret",
        headers: { host: "localhost" },
      } as never,
      { enabled: true, token: "secret", generated: false },
    );
    expect(byQuery).toBe(true);

    const authOff = isAuthorizedUpgradeRequest(
      {
        url: "/ws",
        headers: {},
      } as never,
      { enabled: false },
    );
    expect(authOff).toBe(true);
  });

  test("upgrade auth rejects invalid or malformed input", () => {
    const wrongToken = isAuthorizedUpgradeRequest(
      {
        url: "/ws?access_token=wrong",
        headers: { host: "localhost" },
      } as never,
      { enabled: true, token: "secret", generated: false },
    );
    expect(wrongToken).toBe(false);

    const malformedHeader = isAuthorizedUpgradeRequest(
      {
        url: "/ws",
        headers: { host: "localhost", authorization: ["Bearer", "secret"] },
      } as never,
      { enabled: true, token: "secret", generated: false },
    );
    expect(malformedHeader).toBe(false);

    const malformedUrl = isAuthorizedUpgradeRequest(
      {
        url: "http://%",
        headers: {},
      } as never,
      { enabled: true, token: "secret", generated: false },
    );
    expect(malformedUrl).toBe(false);

    const missingUrl = isAuthorizedUpgradeRequest(
      {
        headers: { host: "localhost" },
      } as never,
      { enabled: true, token: "secret", generated: false },
    );
    expect(missingUrl).toBe(false);
  });
});
