import { afterEach, describe, expect, test, vi } from "vitest";
import type { BookmarksGateway } from "../../src/cdp/client";
import { EventBus } from "../../src/events/bus";
import {
  isBookmarksSyncEnabled,
  startSyncMonitor,
} from "../../src/domain/sync";

describe("sync domain", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("reports true when at least one bookmark node is syncing", async () => {
    const gateway: BookmarksGateway = {
      call: vi.fn(async () => [
        {
          id: "0",
          syncing: false,
          children: [
            { id: "1", title: "Bookmarks bar", syncing: true, children: [] },
          ],
        },
      ]),
    };

    await expect(isBookmarksSyncEnabled(gateway)).resolves.toBe(true);
  });

  test("reports false when tree contains no syncing nodes", async () => {
    const gateway: BookmarksGateway = {
      call: vi.fn(async () => [
        {
          id: "0",
          syncing: false,
          children: [{ id: "1", title: "Bookmarks bar", syncing: false }],
        },
      ]),
    };

    await expect(isBookmarksSyncEnabled(gateway)).resolves.toBe(false);
  });

  test("publishes only when sync status changes", async () => {
    vi.useFakeTimers();

    const gateway: BookmarksGateway = {
      call: vi
        .fn()
        .mockResolvedValueOnce([{ syncing: false }])
        .mockResolvedValueOnce([{ syncing: false }])
        .mockResolvedValueOnce([{ syncing: true }])
        .mockResolvedValue([{ syncing: true }]),
    };
    const bus = new EventBus();
    const handler = vi.fn();
    bus.subscribe(handler);

    const stop = await startSyncMonitor({
      gateway,
      bus,
      intervalMs: 5_000,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventName: "system.syncStatusChanged",
        args: [{ ok: false }],
      }),
    );

    await vi.advanceTimersByTimeAsync(5_000);
    expect(handler).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventName: "system.syncStatusChanged",
        args: [{ ok: true }],
      }),
    );

    await vi.advanceTimersByTimeAsync(5_000);
    expect(handler).toHaveBeenCalledTimes(2);

    stop();
  });

  test("publishes false when sync poll throws", async () => {
    vi.useFakeTimers();

    const gateway: BookmarksGateway = {
      call: vi.fn(async () => {
        throw new Error("cdp offline");
      }),
    };
    const bus = new EventBus();
    const handler = vi.fn();
    bus.subscribe(handler);

    const stop = await startSyncMonitor({
      gateway,
      bus,
      intervalMs: 5_000,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventName: "system.syncStatusChanged",
        args: [{ ok: false }],
      }),
    );

    await vi.advanceTimersByTimeAsync(5_000);
    expect(handler).toHaveBeenCalledTimes(1);

    stop();
  });

  test("skips overlapping polls while the previous one is still running", async () => {
    vi.useFakeTimers();

    let releaseSecondPoll: (() => void) | null = null;
    const gateway: BookmarksGateway = {
      call: vi
        .fn()
        .mockResolvedValueOnce([{ syncing: false }])
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              releaseSecondPoll = () => resolve([{ syncing: true }]);
            }),
        )
        .mockResolvedValue([{ syncing: true }]),
    };
    const bus = new EventBus();

    const stop = await startSyncMonitor({
      gateway,
      bus,
      intervalMs: 5_000,
    });

    expect(gateway.call).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(gateway.call).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(gateway.call).toHaveBeenCalledTimes(2);

    if (releaseSecondPoll !== null) {
      (releaseSecondPoll as () => void)();
    }
    await vi.advanceTimersByTimeAsync(1);

    stop();
  });
});
