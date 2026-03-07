# chrome-bookmarks-manager

Gives your agent a remote capability to read, search, create, update, move, and delete Chrome bookmarks, plus receive bookmark change events.

## What It Does

- Provides a stable remote interface for bookmark operations.
- Wraps Chrome Bookmarks API methods into JSON-RPC procedures.
- Streams bookmark change events to clients in JSON-RPC notification format.

Official Chrome Bookmarks API docs: [Chrome Extensions Bookmarks API](https://developer.chrome.com/docs/extensions/reference/api/bookmarks)

## Why This Exists

Direct access to Google Sync bookmarks data is not available to us from external systems.  
To give agents reliable access to real synced bookmarks, we run a real Chrome instance with a connected user profile and attach to it via CDP.  
We did not find another market-ready approach that provides the same practical access path.

## Quick Start

Docker Hub: [search images](https://hub.docker.com/search?q=chrome-bookmarks-manager)

Run container with mounted Chrome profile directory:

Important: mount an authenticated Chrome profile (signed in to Google, with sync enabled).  
If you use a fresh/empty profile, bookmarks will not be synced and the service will operate on local empty data.

```bash
docker run --rm \
  -p 3000:3000 \
  -e AUTH_TOKEN=off \
  -v /absolute/path/to/chrome-profile:/data/chrome-profile \
  <docker-hub-image>:<tag>
```

## Endpoints

- `POST /rpc` — JSON-RPC 2.0 (`single`, `batch`, `notifications`)
- `GET /events/sse` — live bookmark events as JSON-RPC notifications
- `GET /ws` — WebSocket transport (`RPC requests/notifications` + live events)
- `GET /healthz` — public health endpoint

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

SSE notification payload (`GET /events/sse`):

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
- `AUTH_TOKEN=<token>` — Bearer token required on `/rpc`, `/events/sse`, and `/ws`
- `AUTH_TOKEN` empty or unset — token is auto-generated and printed once in startup logs

Use header:

```http
Authorization: Bearer <token>
```

For WebSocket clients, token can also be passed as query param:

```text
ws://host:port/ws?access_token=<token>
```
