import { afterEach, describe, expect, test, vi } from "vitest";
import { ensureBridgeTarget } from "../../src/cdp/client";

type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function jsonResponse(payload: unknown, status = 200): MockResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

describe("ensureBridgeTarget", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  test("reuses existing bookmarks tab and closes extras", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.endsWith("/json/list")) {
          return jsonResponse([
            {
              id: "tab-1",
              type: "page",
              url: "chrome://bookmarks/",
              webSocketDebuggerUrl: "ws://example/tab-1",
            },
            {
              id: "tab-2",
              type: "page",
              url: "chrome://bookmarks/?q=test",
              webSocketDebuggerUrl: "ws://example/tab-2",
            },
          ]) as unknown as Response;
        }
        if (url.includes("/json/close/tab-2")) {
          return jsonResponse({ ok: true }) as unknown as Response;
        }
        throw new Error(`unexpected fetch url: ${url}`);
      });

    const target = await ensureBridgeTarget();

    expect(target.id).toBe("tab-1");
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes("/json/new?")),
    ).toBe(false);
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("/json/close/tab-2"),
      ),
    ).toBe(true);
  });

  test("creates bookmarks tab when missing", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input);

        if (url.endsWith("/json/list")) {
          if (fetchMock.mock.calls.length === 1) {
            return jsonResponse([]) as unknown as Response;
          }
          return jsonResponse([
            {
              id: "tab-created",
              type: "page",
              url: "chrome://bookmarks/",
              webSocketDebuggerUrl: "ws://example/tab-created",
            },
          ]) as unknown as Response;
        }

        if (url.includes("/json/new?")) {
          expect(init?.method).toBe("PUT");
          return jsonResponse({ id: "tab-created" }) as unknown as Response;
        }

        throw new Error(`unexpected fetch url: ${url}`);
      });

    const target = await ensureBridgeTarget();

    expect(target.id).toBe("tab-created");
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes("/json/new?")),
    ).toBe(true);
  });

  test("uses external Chrome CDP URL from environment", async () => {
    vi.stubEnv("CHROME_CDP_URL", "http://chrome:9222/");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url === "http://chrome:9222/json/list") {
          return jsonResponse([
            {
              id: "tab-1",
              type: "page",
              url: "chrome://bookmarks/",
              webSocketDebuggerUrl: "ws://chrome:9222/devtools/page/tab-1",
            },
          ]) as unknown as Response;
        }
        throw new Error(`unexpected fetch url: ${url}`);
      });

    const target = await ensureBridgeTarget();

    expect(target.id).toBe("tab-1");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://chrome:9222/json/list");
  });

  test("ignores close errors for extra bookmarks tabs", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/json/list")) {
        return jsonResponse([
          {
            id: "tab-1",
            type: "page",
            url: "chrome://bookmarks/",
            webSocketDebuggerUrl: "ws://example/tab-1",
          },
          {
            id: "tab-2",
            type: "page",
            url: "chrome://bookmarks/?q=test",
            webSocketDebuggerUrl: "ws://example/tab-2",
          },
        ]) as unknown as Response;
      }
      if (url.includes("/json/close/tab-2")) {
        throw new Error("close failed");
      }
      throw new Error(`unexpected fetch url: ${url}`);
    });

    const target = await ensureBridgeTarget();
    expect(target.id).toBe("tab-1");
  });
});
