import { afterEach, describe, expect, test, vi } from "vitest";

describe("src/index bootstrap", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  test("starts server on module load", async () => {
    const startServer = vi.fn(async () => undefined);
    vi.doMock("../src/server/index", () => ({ startServer }));

    await import("../src/index");

    expect(startServer).toHaveBeenCalledTimes(1);
  });

  test("logs and exits when startServer fails", async () => {
    const err = new Error("boot failed");
    const startServer = vi.fn(async () => {
      throw err;
    });
    vi.doMock("../src/server/index", () => ({ startServer }));
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);

    await import("../src/index");
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledWith(err);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
