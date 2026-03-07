---
name: chrome-bookmarks-manager
description: Remote Chrome bookmarks access. Use when a task needs real bookmark data from a synced Chrome browser: read/search/create/update/move/delete bookmarks
---

# Chrome Bookmarks Manager

Use this skill when the user asks to work with Chrome bookmarks stored in a real synced Chrome profile.

## When To Use

Use this skill for tasks like:

- Reading bookmark tree or specific nodes.
- Searching bookmarks by query.
- Creating folders/bookmarks.
- Updating bookmark title or URL.
- Moving bookmarks/folders.
- Removing a bookmark or a subtree.

Do not use this skill for unrelated browser automation tasks outside bookmarks.

## Available Transports

- `POST /rpc`:
  JSON-RPC 2.0 over HTTP for bookmark operations.
- `GET /events/sse`:
  Server-Sent Events stream with JSON-RPC notifications from bookmark events.
- `GET /ws`:
  WebSocket transport: accepts JSON-RPC requests/notifications and emits bookmark event notifications.
- `WEBHOOK_URLS`:
  Outgoing webhook transport: sends bookmark event notifications as JSON-RPC payloads via HTTP POST.
- `GET /healthz`:
  Service health check.

## Auth

- If auth is enabled, send `Authorization: Bearer <token>` for `/rpc`, `/events/sse`, and `/ws`.
- For `/ws`, token can also be sent as query param: `?access_token=<token>`.
- If auth is disabled (`AUTH_TOKEN=off`), no bearer token is required.

## RPC Method Mapping

`method` must match a supported Chrome Bookmarks API method name and `params` must be an array in official argument order.

Supported methods:

- `get`
- `getChildren`
- `getRecent`
- `getSubTree`
- `getTree`
- `search`
- `create`
- `update`
- `move`
- `remove`
- `removeTree`

## Usage Notes

- Prefer read-first flow (`getTree`, `getSubTree`, `search`) before destructive changes (`remove`, `removeTree`).
- For write operations, confirm target IDs and parent IDs from a fresh read to avoid accidental edits.
