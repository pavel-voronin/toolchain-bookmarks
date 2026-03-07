import { describe, expect, test, vi } from "vitest";
import { dispatchBookmarksMethod } from "../../src/rpc/dispatcher";
import { JSON_RPC_ERRORS } from "../../src/rpc/errors";

describe("dispatchBookmarksMethod", () => {
  test("passes empty params array when params are omitted", async () => {
    const gateway = { call: vi.fn(async () => ["ok"]) };

    await expect(
      dispatchBookmarksMethod(gateway, "getTree", undefined),
    ).resolves.toEqual(["ok"]);
    expect(gateway.call).toHaveBeenCalledWith("getTree", []);
  });

  test("throws METHOD_NOT_FOUND for unsupported method", async () => {
    const gateway = { call: vi.fn() };

    await expect(
      dispatchBookmarksMethod(gateway, "unknownMethod", []),
    ).rejects.toMatchObject({
      code: JSON_RPC_ERRORS.METHOD_NOT_FOUND.code,
      message: JSON_RPC_ERRORS.METHOD_NOT_FOUND.message,
    });
  });

  test("throws INVALID_PARAMS for non-array params", async () => {
    const gateway = { call: vi.fn() };

    await expect(
      dispatchBookmarksMethod(gateway, "getTree", { bad: true }),
    ).rejects.toMatchObject({
      code: JSON_RPC_ERRORS.INVALID_PARAMS.code,
      data: { reason: "params must be an array" },
    });
  });

  test("throws INVALID_PARAMS when params count does not match method spec", async () => {
    const gateway = { call: vi.fn() };

    await expect(
      dispatchBookmarksMethod(gateway, "update", ["1"]),
    ).rejects.toMatchObject({
      code: JSON_RPC_ERRORS.INVALID_PARAMS.code,
      data: { reason: "expected 2 params, got 1" },
    });
  });

  test("wraps gateway errors into SERVER_ERROR", async () => {
    const gateway = {
      call: vi.fn(async () => {
        throw new Error("chrome runtime failed");
      }),
    };

    await expect(
      dispatchBookmarksMethod(gateway, "getTree", []),
    ).rejects.toMatchObject({
      code: JSON_RPC_ERRORS.SERVER_ERROR.code,
      message: JSON_RPC_ERRORS.SERVER_ERROR.message,
      data: {
        source: "chrome.runtime.lastError",
        message: "chrome runtime failed",
      },
    });
  });

  test("wraps non-Error gateway throws into SERVER_ERROR", async () => {
    const gateway = {
      call: vi.fn(async () => {
        throw "plain failure";
      }),
    };

    await expect(
      dispatchBookmarksMethod(gateway, "getTree", []),
    ).rejects.toMatchObject({
      code: JSON_RPC_ERRORS.SERVER_ERROR.code,
      data: {
        source: "chrome.runtime.lastError",
        message: "plain failure",
      },
    });
  });
});
