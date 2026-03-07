export type BookmarkEvent = {
  ts: string;
  eventName: string;
  args: unknown[];
};

type EventHandler = (event: BookmarkEvent) => void;

export class EventBus {
  private readonly handlers = new Set<EventHandler>();

  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  publish(event: BookmarkEvent): void {
    this.handlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`event handler failed: ${message}`);
      }
    });
  }
}

export function toJsonRpcNotification(event: BookmarkEvent): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    method: event.eventName,
    params: {
      ts: event.ts,
      args: event.args,
    },
  });
}
