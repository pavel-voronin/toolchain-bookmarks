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
  test("serves skill file via RFC well-known path", async () => {
    const app = createApp({
      gateway,
      bus: new EventBus(),
      auth: { enabled: true, token: "secret", generated: false },
    });

    const expected = await readFile(
      resolve(process.cwd(), "skills/chrome-bookmarks-gateway/SKILL.md"),
      "utf8",
    );

    const rfcSkill = await request(app).get(
      "/.well-known/skills/chrome-bookmarks-gateway/SKILL.md",
    );

    expect(rfcSkill.status).toBe(200);
    expect(rfcSkill.text).toBe(expected);
  });

  test("serves RFC skills discovery index", async () => {
    const app = createApp({
      gateway,
      bus: new EventBus(),
      auth: { enabled: true, token: "secret", generated: false },
    });

    const res = await request(app).get("/.well-known/skills/index.json");

    expect(res.status).toBe(200);
    expect(res.body.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "chrome-bookmarks-gateway",
          files: ["SKILL.md"],
        }),
      ]),
    );
  });

  test("returns 404 when skills directory is missing in cwd", async () => {
    const prevCwd = process.cwd();
    const dir = await mkdtemp(resolve(tmpdir(), "cbm-skill-missing-"));
    process.chdir(dir);

    try {
      const app = createApp({
        gateway,
        bus: new EventBus(),
        auth: { enabled: false },
      });
      const res = await request(app).get(
        "/.well-known/skills/chrome-bookmarks-gateway/SKILL.md",
      );
      expect(res.status).toBe(404);
    } finally {
      process.chdir(prevCwd);
    }
  });

  test("returns 404 for non-listed RFC skill file", async () => {
    const app = createApp({
      gateway,
      bus: new EventBus(),
      auth: { enabled: false },
    });
    const res = await request(app).get(
      "/.well-known/skills/chrome-bookmarks-gateway/README.md",
    );
    expect(res.status).toBe(404);
  });

  test("returns 404 for removed /skills/<name>/skill.md route", async () => {
    const app = createApp({
      gateway,
      bus: new EventBus(),
      auth: { enabled: false },
    });
    const res = await request(app).get(
      "/skills/chrome-bookmarks-gateway/skill.md",
    );
    expect(res.status).toBe(404);
  });
});
