# Chrome Bookmarks Gateway

[![Docker Image](https://img.shields.io/badge/docker-pvoronin%2Fchrome--bookmarks--manager-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/r/pvoronin/chrome-bookmarks-manager)
![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](./LICENSE)

Gives your agent a remote capability to read, search, create, update, move, and delete **your synced Chrome bookmarks**, plus receive bookmark change events.

## What It Does

- Provides a stable remote interface for bookmark operations.
- Wraps Chrome Bookmarks API methods into JSON-RPC procedures.
- Streams bookmark change events to clients in JSON-RPC notification format.
- Delivers bookmark change events to webhook endpoints via outgoing HTTP POST.

Official Chrome Bookmarks API docs: [Chrome Extensions Bookmarks API](https://developer.chrome.com/docs/extensions/reference/api/bookmarks)

## Why This Exists

Direct access to Google Sync bookmarks data is not available to us from external systems.  
To give agents reliable access to real synced bookmarks, we run a real Chrome instance with a connected user profile and attach to it via CDP.  
We did not find another market-ready approach that provides the same practical access path.

## Quick Start

Pull image:

```bash
docker pull pvoronin/chrome-bookmarks-manager:0.1.0
```

Run container with mounted Chrome profile directory:

> IMPORTANT: mount an authenticated Chrome profile (signed in to Google, with sync enabled).  
> If you use a fresh/empty profile, bookmarks will not be synced and the service will operate on local empty data.

```bash
docker run --rm \
  -p 3000:3000 \
  -e AUTH_TOKEN=off \
  -v /absolute/path/to/chrome-profile:/data/chrome-profile \
  pvoronin/chrome-bookmarks-manager:0.1.0
```

## Endpoints

- `POST /rpc` — JSON-RPC 2.0 (`single`, `batch`, `notifications`)
- `GET /sse` — live bookmark events as JSON-RPC notifications
- `GET /ws` — WebSocket transport (`RPC requests/notifications` + live events)
- `GET /.well-known/skills/index.json` — skills discovery index (RFC)
- `GET /.well-known/skills/<skill-name>/<file>` — skill file fetch (RFC), e.g. `SKILL.md`
- `GET /healthz` — public health endpoint

Webhook transport:

- `WEBHOOK_URLS` — comma-separated HTTP(S) URLs for outgoing event delivery
- `WEBHOOK_TIMEOUT_MS` — request timeout in milliseconds (default `5000`)

## RPC Mapping Principles

- `method` is the Chrome Bookmarks API method name (for example, `getTree`, `search`, `create`).
- `params` must be an array and must match the official API argument order.
- `result` is returned as-is from Chrome Bookmarks API.
- JSON-RPC notifications are requests without `id`; server responds with `204 No Content`.

## Examples

Single request:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getTree",
  "params": []
}
```

Single response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": [{ "id": "0", "title": "", "children": [] }]
}
```

Batch request (mixed calls + notification):

```json
[
  { "jsonrpc": "2.0", "id": 1, "method": "getTree", "params": [] },
  { "jsonrpc": "2.0", "method": "remove", "params": ["100"] },
  { "jsonrpc": "2.0", "id": 2, "method": "search", "params": ["docs"] }
]
```

Batch response (only items with `id` are returned):

```json
[
  { "jsonrpc": "2.0", "id": 1, "result": [{ "id": "0", "title": "" }] },
  { "jsonrpc": "2.0", "id": 2, "result": [{ "id": "42", "title": "Docs" }] }
]
```

SSE notification payload (`GET /sse`):

```json
{
  "jsonrpc": "2.0",
  "method": "onCreated",
  "params": {
    "ts": "2026-03-06T12:00:00.000Z",
    "args": ["123", { "id": "123", "title": "New Bookmark" }]
  }
}
```

WebSocket event frame (`GET /ws`):

```json
{
  "jsonrpc": "2.0",
  "method": "onMoved",
  "params": {
    "ts": "2026-03-07T12:00:00.000Z",
    "args": [
      "123",
      { "parentId": "2", "index": 0 },
      { "parentId": "1", "index": 3 }
    ]
  }
}
```

WebSocket RPC request frame (`GET /ws`):

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "getTree",
  "params": []
}
```

## Auth (`AUTH_TOKEN`)

- `AUTH_TOKEN=off` — auth disabled
- `AUTH_TOKEN=<token>` — Bearer token required on `/rpc`, `/sse`, and `/ws`
- `AUTH_TOKEN` empty or unset — token is auto-generated and printed once in startup logs
- `WEBHOOK_URLS` unset/empty — webhook transport disabled
- `WEBHOOK_URLS=<url1>,<url2>` — send every event to each configured URL
- `WEBHOOK_TIMEOUT_MS=<ms>` — webhook request timeout (fallback: `5000`)

Use header:

```http
Authorization: Bearer <token>
```

For WebSocket clients, token can also be passed as query param:

```text
ws://host:port/ws?access_token=<token>
```

Webhook payload (`WEBHOOK_URLS`):

```json
{
  "jsonrpc": "2.0",
  "method": "onCreated",
  "params": {
    "ts": "2026-03-07T12:00:00.000Z",
    "args": ["123", { "id": "123", "title": "New Bookmark" }]
  }
}
```

## Testing

Run fast tests (typecheck + unit/integration):

```bash
npm run test:fast
```

Run full suite (includes Docker smoke tests):

```bash
npm test
```

Coverage thresholds are enforced at `100%` for statements, branches, functions, and lines.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR.

## License

This project is licensed under the [MIT License](./LICENSE).
