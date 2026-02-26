import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {
  runBookmarks,
  setupWorkspace,
  writeBookmarksFixture,
} from "../../helpers/workspace";

describe("internal diff command", () => {
  test("returns event and advances cursor", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, false);
    runBookmarks(ctx.runDir, ["make-diff", "--json"]);

    writeBookmarksFixture(ctx.runDir, true);
    const make = runBookmarks(ctx.runDir, ["make-diff", "--json"]);
    expect(make.code).toBe(0);

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
    writeBookmarksFixture(ctx.runDir, false);
    runBookmarks(ctx.runDir, ["make-diff", "--json"]);

    fs.writeFileSync(
      path.join(ctx.runDir, "bookmarks.json"),
      `${JSON.stringify(
        {
          checksum: "v3",
          version: 1,
          roots: {
            bookmark_bar: {
              id: "1",
              guid: "g1",
              name: "bookmark_bar",
              date_added: "1",
              type: "folder",
              children: [
                {
                  id: "10",
                  guid: "g10",
                  name: "Inbox",
                  date_added: "1",
                  type: "folder",
                  children: [
                    {
                      id: "100",
                      guid: "g100",
                      name: "OpenAI",
                      date_added: "2",
                      type: "url",
                      url: "https://openai.com",
                    },
                    {
                      id: "101",
                      guid: "g101",
                      name: "Bun",
                      date_added: "3",
                      type: "url",
                      url: "https://bun.sh",
                    },
                  ],
                },
              ],
            },
            other: {
              id: "2",
              guid: "g2",
              name: "other",
              date_added: "1",
              type: "folder",
              children: [],
            },
            synced: {
              id: "3",
              guid: "g3",
              name: "synced",
              date_added: "1",
              type: "folder",
              children: [],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    runBookmarks(ctx.runDir, ["make-diff", "--json"]);

    const diff1 = JSON.parse(
      runBookmarks(ctx.runDir, ["diff", "--json"]).stdout,
    );
    const diff2 = JSON.parse(
      runBookmarks(ctx.runDir, ["diff", "--json"]).stdout,
    );
    const diff3 = JSON.parse(
      runBookmarks(ctx.runDir, ["diff", "--json"]).stdout,
    );

    expect(diff1.event).not.toBeNull();
    expect(diff2.event).not.toBeNull();
    expect(diff1.event.id).not.toBe(diff2.event.id);
    expect(diff1.event.event.type).toBe("link_created_in_inbox");
    expect(diff2.event.event.type).toBe("link_created_in_inbox");
    expect(diff1.event.event.payload.type).toBe("link");
    expect(diff2.event.event.payload.type).toBe("link");
    expect(diff3.event).toBeNull();
  });

  test("prints human output in human mode", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, false);
    runBookmarks(ctx.runDir, ["make-diff"]);
    writeBookmarksFixture(ctx.runDir, true);
    runBookmarks(ctx.runDir, ["make-diff"]);

    const result = runBookmarks(ctx.runDir, ["diff"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("schema_version: 1");
    expect(result.stdout).toContain("event:");
    expect(result.stdout).toContain("type: link_created_in_inbox");
  });
});
