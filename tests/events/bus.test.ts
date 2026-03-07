import { describe, expect, test, vi } from "vitest";
import { EventBus, toJsonRpcNotification } from "../../src/events/bus";

describe("EventBus", () => {
  test("continues fanout when one subscriber throws", () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const bus = new EventBus();
    const healthyHandler = vi.fn();

    bus.subscribe(() => {
      throw new Error("subscriber failed");
    });
    bus.subscribe(healthyHandler);

    expect(() =>
      bus.publish({
        ts: "2026-03-06T00:00:00.000Z",
        eventName: "onCreated",
        args: [],
      }),
    ).not.toThrow();

    expect(healthyHandler).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  test("logs non-Error throw values", () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const bus = new EventBus();

    bus.subscribe(() => {
      throw "string-failure";
    });
    bus.publish({
      ts: "2026-03-06T00:00:00.000Z",
      eventName: "onCreated",
      args: [],
    });

    expect(errorSpy).toHaveBeenCalledWith(
      "event handler failed: string-failure",
    );
  });

  test("unsubscribe stops receiving events", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    const unsubscribe = bus.subscribe(handler);
    unsubscribe();

    bus.publish({
      ts: "2026-03-06T00:00:00.000Z",
      eventName: "onRemoved",
      args: ["10"],
    });

    expect(handler).not.toHaveBeenCalled();
  });

  test("formats JSON-RPC notifications from bookmark events", () => {
    const raw = toJsonRpcNotification({
      ts: "2026-03-06T00:00:00.000Z",
      eventName: "onChanged",
      args: ["10", { title: "Updated" }],
    });

    expect(JSON.parse(raw)).toEqual({
      jsonrpc: "2.0",
      method: "onChanged",
      params: {
        ts: "2026-03-06T00:00:00.000Z",
        args: ["10", { title: "Updated" }],
      },
    });
  });
});
