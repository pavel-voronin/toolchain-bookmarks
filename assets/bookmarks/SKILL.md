---
name: bookmarks
description: Work with user's bookmarks only through the local bookmarks CLI
---

# Bookmarks Skill

Use this exact binary path (do not rely on PATH): `{{BOOKMARKS_BIN}}`
Run all commands below as: `{{BOOKMARKS_BIN}} <command> [args]`.

## Rules

- Do not access Chrome Bookmarks file directly.
- Use CLI commands only.
- If required scenario is missing, log request with `request "<scenario description>"`

## Output modes

- Default: YAML (human-readable)
- JSON: `-j`
- Custom fields: `-f id,title,url`
  - folder fields: id, type, title, path, parentId, index, children, dateAdded, dateGroupModified, folderType, syncing, unmodifiable
  - link fields: id, type, title, url, path, parentId, index, dateAdded, dateLastUsed, syncing

## Commands

Scenarios:

- `inbox-links` - List links from configured inbox folder.
- `search-url <needle>` - Find links by URL substring.
- `search-title <needle>` - Find links by title substring.

API:

- `get <id...>` - Get nodes by one or more ids.
- `get-children <id>` - Get direct children for folder id.
- `get-recent <count>` - Get most recent bookmarks.
- `get-sub-tree <id>` - Get subtree for node id.
- `get-tree` - Get full bookmarks tree.
- `search <query>` - Search bookmarks by query text.
- `create --parent-id <id> --title <title> [--url <url>] [--index <n>]` - Create folder or link.
- `update <id> [--title <title>] [--url <url>]` - Update bookmark fields.
- `move <id> --parent-id <id> [--index <n>]` - Move node.
- `remove <id>` - Remove node.
- `remove-tree <id>` - Remove subtree.

## Diff stream

- Sometimes you will be asked to process the changes in bookmarks. You can take those changes piece by piece with a command:
- `diff` - read next event using internal cursor.
- If no event is returned, stop polling until external trigger or heartbeat.
