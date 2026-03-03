import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { runBookmarks, setupWorkspace } from "../../helpers/workspace";

describe("internal diff command", () => {
  test("returns event and advances cursor", () => {
    const ctx = setupWorkspace();

    const diffDir = path.join(ctx.runDir, "diffs");
    fs.writeFileSync(
      path.join(diffDir, "000000000001.json"),
      `${JSON.stringify(
        {
          schema_version: 1,
          id: 1,
          ts: new Date().toISOString(),
          event: {
            type: "link_created",
            payload: {
              id: "100",
              type: "link",
              title: "OpenAI",
              url: "https://openai.com",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const diff1 = runBookmarks(ctx.runDir, ["diff", "--json"]);
    expect(diff1.code).toBe(0);
    const payload1 = JSON.parse(diff1.stdout);
    expect(payload1.event).not.toBeNull();

    const diff2 = runBookmarks(ctx.runDir, ["diff", "--json"]);
    expect(diff2.code).toBe(0);
    const payload2 = JSON.parse(diff2.stdout);
    expect(payload2.event).toBeNull();
  });

  test("returns one event per diff file", () => {
    const ctx = setupWorkspace();
    const diffDir = path.join(ctx.runDir, "diffs");

    for (let id = 1; id <= 2; id += 1) {
      fs.writeFileSync(
        path.join(diffDir, `${String(id).padStart(12, "0")}.json`),
        `${JSON.stringify(
          {
            schema_version: 1,
            id,
            ts: new Date().toISOString(),
            event: {
              type: "link_created",
              payload: {
                id: String(100 + id),
                type: "link",
                title: `Item ${id}`,
                url: `https://example.com/${id}`,
              },
            },
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
    }

    const diff1 = JSON.parse(runBookmarks(ctx.runDir, ["diff", "--json"]).stdout);
    const diff2 = JSON.parse(runBookmarks(ctx.runDir, ["diff", "--json"]).stdout);
    const diff3 = JSON.parse(runBookmarks(ctx.runDir, ["diff", "--json"]).stdout);

    expect(diff1.event).not.toBeNull();
    expect(diff2.event).not.toBeNull();
    expect(diff1.event.id).not.toBe(diff2.event.id);
    expect(diff1.event.event.type).toBe("link_created");
    expect(diff2.event.event.type).toBe("link_created");
    expect(diff3.event).toBeNull();
  });

  test("prints human output in human mode", () => {
    const ctx = setupWorkspace();
    const diffDir = path.join(ctx.runDir, "diffs");
    fs.writeFileSync(
      path.join(diffDir, "000000000001.json"),
      `${JSON.stringify(
        {
          schema_version: 1,
          id: 1,
          ts: new Date().toISOString(),
          event: {
            type: "link_created",
            payload: {
              id: "100",
              type: "link",
              title: "OpenAI",
              url: "https://openai.com",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = runBookmarks(ctx.runDir, ["diff"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("schema_version: 1");
    expect(result.stdout).toContain("event:");
    expect(result.stdout).toContain("type: link_created");
  });
});
