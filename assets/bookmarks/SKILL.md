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
- Keep `Findings & Settings` section up to date before the main task.

## Output modes

- Default: YAML (human-readable)
- JSON: `-j`
- Custom fields: `-f id,title,url`
  - folder fields: id, type, title, path, parentId, index, children, dateAdded, dateGroupModified, folderType, syncing, unmodifiable
  - link fields: id, type, title, url, path, parentId, index, dateAdded, dateLastUsed, syncing

## Commands

API:

- `get <id...>` - Get nodes by one or more ids.
- `get-children <id>` - Get direct children for folder id.
- `get-recent <count>` - Get most recent bookmarks.
- `get-sub-tree <id>` - Get subtree for node id.
- `get-tree` - Get full bookmarks tree. Always prefer other methods, use it as a last call!
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

## Findings & Settings (must update)

- `inbox_required`: `yes` or `no`
- `inbox_folder_id`: selected folder id or `none`
- `notes`: short context and last check result

### Inbox setup flow

1. Ask user whether an `inbox` folder is needed for this workflow.
2. If user says `no`, set `inbox_required: no` and `inbox_folder_id: none`.
3. If user says `yes`, find candidates with:
   - `search Inbox`
   - `search inbox`
   - optional fallback: `get-tree` only if search is ambiguous.
4. If multiple candidates are found, show options with `id` and `path`, then ask user to choose one.
5. Save the chosen id in this section as `inbox_folder_id`.
