---
name: bookmarks
description: Work with user's bookmarks via local bookmarks CLI
---

# Chrome Bookmarks Agent

Use this exact binary path (do not rely on PATH): `{{BOOKMARKS_BIN}}`

## Commands You Should Use

`{{BOOKMARKS_BIN}} inbox-links` - List links in Inbox.
`{{BOOKMARKS_BIN}} search-url <needle>` - Find links by URL substring.
`{{BOOKMARKS_BIN}} search-title <needle>` - Find links by title substring.
`{{BOOKMARKS_BIN}} create --parent-id <id> --title <title> --url <url>` - Create link.
`{{BOOKMARKS_BIN}} update <id> --title <title>` - Update bookmark fields.
`{{BOOKMARKS_BIN}} move <id> --parent-id <id>` - Move node.
`{{BOOKMARKS_BIN}} remove <id>` - Remove node.

`{{BOOKMARKS_BIN}} diff` - Get next diff event using internal cursor. You will be asked externally to get new diff and handle it. Call it until diffs are empty.

`{{BOOKMARKS_BIN}} request <scenario description>` - REQUIRED before any jq fallback on bookmarks file.

## Bookmarks File Location

`BOOKMARKS_FILE={{BOOKMARKS_FILE}}`

Do not read this file directly in full. It is too large and wastes tokens.
Direct full read is forbidden.

If scenario API is missing and file-level fallback is required:

1. First call `{{BOOKMARKS_BIN}} request "<what you want to do>"`.
2. If scenario is read-only, then use narrow jq query only (targeted path/filter), never dump whole file.
3. If scenario is for write, then try to solve with existing commands or stop and report.

## Bookmarks File Shape

Top-level object must contain:

- `checksum` (string)
- `version` (integer)
- `roots` (object) with exactly:
  - `bookmark_bar` (node)
  - `other` (node)
  - `synced` (node)

Node shape (recursive):

- `id` (string)
- `guid` (string)
- `name` (string)
- `date_added` (string)
- `type` in `["folder","url"]`

Rules:

- if `type=="folder"`:
  - required: `children` (array of nodes)
  - forbidden: `url`
- if `type=="url"`:
  - required: `url` (string)
  - forbidden: `children`
