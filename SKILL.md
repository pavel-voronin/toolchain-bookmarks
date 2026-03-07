---
name: chrome-bookmarks-gateway
description: Operate Chrome bookmarks through a remote JSON-RPC endpoint. Use when the task requires reading/searching/creating/updating/moving/removing bookmarks
---

# Chrome Bookmarks Gateway

## Endpoint

- `POST /rpc`

## RPC Rules

- Send `jsonrpc: "2.0"`.
- Use Chrome Bookmarks API method names.
- Always send `params` as an array in official argument order.
- For destructive operations, do read-first verification (`getTree` / `getSubTree` / `search`).

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

## Ready-to-run curl Commands

Use this wrapper pattern:

```bash
curl -sS -X POST "{{BASE_URL}}/rpc" \
  -H "content-type: application/json" \
  --data '<JSON-RPC payload>'
```

Get full tree:

```bash
curl -sS -X POST "{{BASE_URL}}/rpc" \
  -H "content-type: application/json" \
  --data '{"jsonrpc":"2.0","id":1,"method":"getTree","params":[]}'
```

Search:

```bash
curl -sS -X POST "{{BASE_URL}}/rpc" \
  -H "content-type: application/json" \
  --data '{"jsonrpc":"2.0","id":2,"method":"search","params":["docs"]}'
```

Create bookmark:

```bash
curl -sS -X POST "{{BASE_URL}}/rpc" \
  -H "content-type: application/json" \
  --data '{"jsonrpc":"2.0","id":3,"method":"create","params":[{"parentId":"<folderId>","title":"Example","url":"https://example.com"}]}'
```

Update bookmark:

```bash
curl -sS -X POST "{{BASE_URL}}/rpc" \
  -H "content-type: application/json" \
  --data '{"jsonrpc":"2.0","id":4,"method":"update","params":["<id>",{"title":"New title","url":"https://example.org"}]}'
```

Move bookmark:

```bash
curl -sS -X POST "{{BASE_URL}}/rpc" \
  -H "content-type: application/json" \
  --data '{"jsonrpc":"2.0","id":5,"method":"move","params":["<id>",{"parentId":"<targetFolderId>","index":0}]}'
```

Remove bookmark:

```bash
curl -sS -X POST "{{BASE_URL}}/rpc" \
  -H "content-type: application/json" \
  --data '{"jsonrpc":"2.0","id":6,"method":"remove","params":["<id>"]}'
```

Remove subtree:

```bash
curl -sS -X POST "{{BASE_URL}}/rpc" \
  -H "content-type: application/json" \
  --data '{"jsonrpc":"2.0","id":7,"method":"removeTree","params":["<folderId>"]}'
```

## Large Output Handling (Token Safety)

- RPC responses can be very large. `getTree` may return huge JSON payloads for large bookmark sets.
- Do not paste raw full responses directly into LLM context.
- Save output to files and inspect/filter with shell tools first (`jq`, `rg`, `head`, `wc`).

Examples:

```bash
# Save full response to file
curl -sS -X POST "{{BASE_URL}}/rpc" \
  -H "content-type: application/json" \
  --data '{"jsonrpc":"2.0","id":1,"method":"getTree","params":[]}' \
  > tree.json

# Quick size check
wc -c tree.json

# Extract only the result section
jq '.result' tree.json > tree-result.json

# Show only first part for preview
head -n 80 tree-result.json

# Find folders/bookmarks by keyword without loading full JSON into LLM
rg -n "docs|work|project" tree-result.json
```
