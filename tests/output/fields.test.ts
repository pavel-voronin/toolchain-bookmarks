import { describe, expect, test } from "bun:test";
import { applyFields, applyModelDefaults } from "../../src/output/fields";
import type { CanonicalBookmarkNode } from "../../src/types/canonical";

describe("output fields", () => {
  test("applyFields filters nested children recursively", () => {
    const input = {
      id: "795",
      children: [
        {
          id: "796",
          title: "Your Repositories",
          url: "https://github.com/pavel-voronin?tab=repositories",
          index: 0,
          parentId: "795",
        },
      ],
    };

    const out = applyFields(input, ["id", "children"]) as {
      id: string;
      children: Array<Record<string, unknown>>;
    };

    expect(out.id).toBe("795");
    expect(out.children.length).toBe(1);
    expect(out.children[0]).toEqual({ id: "796" });
  });

  test("applyModelDefaults applies defaults recursively for subtree children", () => {
    const input: CanonicalBookmarkNode = {
      id: "795",
      title: "Folder",
      type: "folder",
      children: [
        {
          id: "796",
          title: "Your Repositories",
          type: "link",
          url: "https://github.com/pavel-voronin?tab=repositories",
          index: 0,
          parentId: "795",
        },
      ],
    };

    const out = applyModelDefaults(input) as {
      id: string;
      title: string;
      type: string;
      path?: string;
      parentId?: string;
      index?: number;
      children?: Array<Record<string, unknown>>;
    };

    expect(out.id).toBe("795");
    expect(out.title).toBe("Folder");
    expect(out.type).toBe("folder");
    expect(out.children).toBeUndefined();
  });
});
