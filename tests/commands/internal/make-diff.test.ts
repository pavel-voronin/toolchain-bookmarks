import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {
  runBookmarks,
  setupWorkspace,
  writeBookmarksFixture,
} from "../../helpers/workspace";

describe("internal make-diff command", () => {
  test("baseline writes no diff on first run", () => {
    const ctx = setupWorkspace();
    writeBookmarksFixture(ctx.runDir, false);

    const result = runBookmarks(ctx.runDir, ["make-diff", "--json"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.wroteDiff).toBe(false);
  });

  test("writes one diff file per creation event", () => {
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
                    {
                      id: "102",
                      guid: "g102",
                      name: "Reading",
                      date_added: "4",
                      type: "folder",
                      children: [],
                    },
                  ],
                },
                {
                  id: "11",
                  guid: "g11",
                  name: "Outside",
                  date_added: "1",
                  type: "folder",
                  children: [
                    {
                      id: "200",
                      guid: "g200",
                      name: "Ignored",
                      date_added: "2",
                      type: "url",
                      url: "https://example.com",
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

    const result = runBookmarks(ctx.runDir, ["make-diff", "--json"]);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.wroteDiff).toBe(true);
    expect(payload.eventCount).toBe(5);

    const diffFiles = fs
      .readdirSync(path.join(ctx.runDir, "diffs"))
      .filter((name) => name.endsWith(".json"))
      .sort();
    expect(diffFiles).toEqual([
      "000000000001.json",
      "000000000002.json",
      "000000000003.json",
      "000000000004.json",
      "000000000005.json",
    ]);

    const eventTypes = new Set<string>();
    for (const file of diffFiles) {
      const doc = JSON.parse(
        fs.readFileSync(path.join(ctx.runDir, "diffs", file), "utf8"),
      ) as { event: { type: string; payload: { type: string } } };
      eventTypes.add(doc.event.type);
      expect(["link", "folder"]).toContain(doc.event.payload.type);
    }
    expect(eventTypes.has("link_created")).toBe(true);
    expect(eventTypes.has("folder_created")).toBe(true);
  });
});
