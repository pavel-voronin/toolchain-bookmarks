import type { BookmarksGateway } from "../cdp/client";
import type { BookmarkEvent } from "../events/bus";
import { EventBus } from "../events/bus";

const DEFAULT_SYNC_POLL_INTERVAL_MS = 30_000;

type BookmarkTreeNode = {
  syncing?: unknown;
  children?: unknown;
};

function hasSyncingTrue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasSyncingTrue(item));
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  const node = value as BookmarkTreeNode;
  if (node.syncing === true) {
    return true;
  }

  return hasSyncingTrue(node.children);
}

function toSyncStatusChangedEvent(ok: boolean): BookmarkEvent {
  return {
    ts: new Date().toISOString(),
    eventName: "system.syncStatusChanged",
    args: [{ ok }],
  };
}

export async function isBookmarksSyncEnabled(
  gateway: BookmarksGateway,
): Promise<boolean> {
  const tree = await gateway.call("getTree", []);
  return hasSyncingTrue(tree);
}

export async function startSyncMonitor(options: {
  gateway: BookmarksGateway;
  bus: EventBus;
  intervalMs?: number;
}): Promise<() => void> {
  const intervalMs = Math.max(
    1_000,
    options.intervalMs ?? DEFAULT_SYNC_POLL_INTERVAL_MS,
  );
  let stopped = false;
  let inFlight = false;
  let lastStatus: boolean | null = null;

  const poll = async (): Promise<void> => {
    if (stopped || inFlight) {
      return;
    }
    inFlight = true;

    try {
      const ok = await isBookmarksSyncEnabled(options.gateway);
      if (lastStatus !== ok) {
        lastStatus = ok;
        options.bus.publish(toSyncStatusChangedEvent(ok));
      }
    } catch {
      if (lastStatus !== false) {
        lastStatus = false;
        options.bus.publish(toSyncStatusChangedEvent(false));
      }
    } finally {
      inFlight = false;
    }
  };

  await poll();

  const timer = setInterval(() => {
    void poll();
  }, intervalMs);
  timer.unref?.();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
