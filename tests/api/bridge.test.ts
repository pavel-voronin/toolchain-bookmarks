import { describe, expect, test } from "bun:test";
import {
  attachBookmarkBindingHandlers,
  waitForBookmarksApiReady,
} from "../../src/api/bridge";

type CdpMessage = {
  method?: string;
  sessionId?: string;
  params?: Record<string, unknown>;
};

class FakeCdp {
  private handlers: Array<(msg: CdpMessage) => void> = [];
  private closeHandlers: Array<() => void> = [];
  private readiness = 0;

  constructor(readinessFalseRounds = 0) {
    this.readiness = readinessFalseRounds;
  }

  async send(method: string): Promise<unknown> {
    if (method !== "Runtime.evaluate") {
      return {};
    }
    if (this.readiness > 0) {
      this.readiness -= 1;
      return { result: { value: false } };
    }
    return { result: { value: true } };
  }

  onEvent(handler: (msg: CdpMessage) => void): void {
    this.handlers.push(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  emit(message: CdpMessage): void {
    this.handlers.forEach((handler) => handler(message));
  }

  close(): void {
    this.closeHandlers.forEach((handler) => handler());
  }
}

describe("api bridge stream helpers", () => {
  test("waitForBookmarksApiReady retries until API becomes available", async () => {
    const cdp = new FakeCdp(2);
    await expect(
      waitForBookmarksApiReady(cdp, "session-1", { timeoutMs: 200, pollMs: 1 }),
    ).resolves.toBeUndefined();
  });

  test("waitForBookmarksApiReady fails on timeout", async () => {
    const cdp = new FakeCdp(1000);
    await expect(
      waitForBookmarksApiReady(cdp, "session-1", { timeoutMs: 5, pollMs: 1 }),
    ).rejects.toThrow("Timed out waiting for chrome.bookmarks API to become ready");
  });

  test("attachBookmarkBindingHandlers propagates async handler errors", async () => {
    const cdp = new FakeCdp();
    const stream = attachBookmarkBindingHandlers(
      cdp,
      "session-1",
      async () => {
        throw new Error("write failed");
      },
    );

    cdp.emit({
      method: "Runtime.bindingCalled",
      sessionId: "session-1",
      params: {
        name: "__cdpBookmarkEvent",
        payload: JSON.stringify({ ts: "2026-03-03T00:00:00.000Z", eventName: "onCreated", args: [] }),
      },
    });

    await expect(stream).rejects.toThrow("write failed");
  });

  test("attachBookmarkBindingHandlers rejects on websocket close", async () => {
    const cdp = new FakeCdp();
    const stream = attachBookmarkBindingHandlers(cdp, "session-1", () => undefined);
    cdp.close();
    await expect(stream).rejects.toThrow("CDP WebSocket closed");
  });
});
