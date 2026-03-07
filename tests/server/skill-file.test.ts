import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import request from "supertest";
import { describe, expect, test, vi } from "vitest";
import type { BookmarksGateway } from "../../src/cdp/client";
import { EventBus } from "../../src/events/bus";
import { createApp } from "../../src/server/app";

const gateway: BookmarksGateway = {
  call: vi.fn(async () => []),
};

describe("skill file endpoint", () => {
  test("serves root SKILL.md for uppercase and lowercase path", async () => {
    const app = createApp({
      gateway,
      bus: new EventBus(),
      auth: { enabled: true, token: "secret", generated: false },
    });

    const expected = await readFile(resolve(process.cwd(), "SKILL.md"), "utf8");

    const upper = await request(app).get("/SKILL.md");
    const lower = await request(app).get("/skill.md");

    expect(upper.status).toBe(200);
    expect(lower.status).toBe(200);
    expect(upper.text).toBe(expected);
    expect(lower.text).toBe(expected);
  });

  test("returns 404 when SKILL.md is missing in cwd", async () => {
    const prevCwd = process.cwd();
    const dir = await mkdtemp(resolve(tmpdir(), "cbm-skill-missing-"));
    process.chdir(dir);

    try {
      const app = createApp({
        gateway,
        bus: new EventBus(),
        auth: { enabled: false },
      });
      const res = await request(app).get("/skill.md");
      expect(res.status).toBe(404);
    } finally {
      process.chdir(prevCwd);
    }
  });
});
