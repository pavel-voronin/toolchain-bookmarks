import { describe, expect, test } from "bun:test";
import {
  applyReplOutputMode,
  parseReplStartupOptions,
  tokenizeReplInput,
} from "../../src/repl";

describe("repl helpers", () => {
  test("tokenizes quoted command line", () => {
    const tokens = tokenizeReplInput(
      `create --title "Hello world" --url 'https://example.com'`,
    );
    expect(tokens).toEqual([
      "create",
      "--title",
      "Hello world",
      "--url",
      "https://example.com",
    ]);
  });

  test("parses no-args startup as repl", () => {
    expect(parseReplStartupOptions([])).toEqual({
      shouldStartRepl: true,
      defaultJson: false,
    });
  });

  test("parses startup json default mode", () => {
    expect(parseReplStartupOptions(["-j"])).toEqual({
      shouldStartRepl: true,
      defaultJson: true,
    });
    expect(parseReplStartupOptions(["--json"])).toEqual({
      shouldStartRepl: true,
      defaultJson: true,
    });
  });

  test("does not force repl for regular commands or help", () => {
    expect(parseReplStartupOptions(["get", "1"])).toEqual({
      shouldStartRepl: false,
      defaultJson: false,
    });
    expect(parseReplStartupOptions(["--help"])).toEqual({
      shouldStartRepl: false,
      defaultJson: false,
    });
  });

  test("applies repl default output with human override", () => {
    const defaultJsonOptions: Record<string, unknown> = {};
    applyReplOutputMode(defaultJsonOptions, true);
    expect(defaultJsonOptions.json).toBe(true);

    const explicitJsonOptions: Record<string, unknown> = { json: true };
    applyReplOutputMode(explicitJsonOptions, false);
    expect(explicitJsonOptions.json).toBe(true);

    const humanOptions: Record<string, unknown> = { human: true };
    applyReplOutputMode(humanOptions, true);
    expect(humanOptions.json).toBe(false);
  });
});
