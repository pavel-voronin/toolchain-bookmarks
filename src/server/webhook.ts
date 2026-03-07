import { EventBus, toJsonRpcNotification } from "../events/bus";

const DEFAULT_WEBHOOK_MAX_CONCURRENCY = 8;

type WebhookTransportOptions = {
  bus: EventBus;
  urls: string[];
  timeoutMs: number;
  maxConcurrency?: number;
};

type WebhookJob = {
  url: string;
  payload: string;
};

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function setupWebhookTransport(
  options: WebhookTransportOptions,
): () => void {
  if (options.urls.length === 0) {
    return () => undefined;
  }

  const maxConcurrency = Math.max(
    1,
    options.maxConcurrency ?? DEFAULT_WEBHOOK_MAX_CONCURRENCY,
  );

  let stopped = false;
  let active = 0;
  const queue: WebhookJob[] = [];
  const inflight = new Set<AbortController>();

  const sendJob = async (job: WebhookJob): Promise<void> => {
    const controller = new AbortController();
    inflight.add(controller);

    const timeout = setTimeout(() => {
      controller.abort();
    }, options.timeoutMs) as NodeJS.Timeout;
    timeout.unref();

    try {
      await fetch(job.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: job.payload,
        signal: controller.signal,
      });
      // Intentionally fire-and-forget: non-2xx responses are not treated as delivery
      // failures in this transport. We only log network/timeout-level errors.
    } catch (error) {
      console.error(
        `webhook delivery failed (${job.url}): ${toErrorMessage(error)}`,
      );
    } finally {
      clearTimeout(timeout);
      inflight.delete(controller);
    }
  };

  const drainQueue = (): void => {
    while (!stopped && active < maxConcurrency && queue.length > 0) {
      const next = queue.shift() as WebhookJob;
      active += 1;
      void sendJob(next).finally(() => {
        active -= 1;
        drainQueue();
      });
    }
  };

  const unsubscribe = options.bus.subscribe((event) => {
    const payload = toJsonRpcNotification(event);
    options.urls.forEach((url) => {
      queue.push({ url, payload });
    });
    drainQueue();
  });

  return () => {
    if (stopped) {
      return;
    }
    stopped = true;
    queue.length = 0;
    unsubscribe();
    inflight.forEach((controller) => {
      controller.abort();
    });
    inflight.clear();
  };
}
