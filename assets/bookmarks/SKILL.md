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

- Update this section in every session when new stable findings appear.
- Save every user-important folder that was discovered during work (not only inbox).
- Reuse saved folder ids first to avoid repeated search and extra token/time cost.

Fields:

- `inbox_required`: `yes` or `no` or `unknown`
- `inbox_folder_name`: user-provided name or `none`
- `inbox_folder_id`: selected folder id or `none`
- `important_folders`: list of objects with:
  - `purpose`: why user needs this folder (for example `articles`, `reading_queue`, `work_docs`)
  - `folder_id`
  - `folder_title`
  - `folder_path`
  - `confidence`: `high` or `medium` (based on explicit user confirmation)
  - `last_confirmed_at`: ISO timestamp
- `notes`: short context and last check result

Update policy:

1. Before searching folders, check whether `important_folders` already has a matching purpose.
2. When you discover a new important folder (for move/create/find tasks), add it immediately.
3. When user corrects mapping, overwrite previous record and mark old value as obsolete in `notes`.
4. Keep only relevant current mappings; remove stale or ambiguous entries.
5. Never leave this section outdated after task completion.

### Inbox setup flow

1. Ask user: does inbox workflow exist, and what is the actual folder name (if any)?
2. If user says there is no inbox workflow, set:
   - `inbox_required: no`
   - `inbox_folder_name: none`
   - `inbox_folder_id: none`
3. If user needs inbox workflow:
   - ask for expected inbox folder name;
   - search by that name (`search <name>`);
   - if name is unknown, ask whether to try common names and then search.
4. If multiple candidates are found, show options with `id` and `path`, then ask user to choose one.
5. If no candidate is found, ask whether to create inbox folder now:
   - if yes, create it in user-chosen parent and save new id;
   - if no, mark inbox as unresolved in `notes`.
6. Save confirmed inbox folder in both:
   - `inbox_folder_*` fields;
   - `important_folders` with purpose `inbox`.
7. One-time rule: after inbox setup is finished and values are persisted, delete this `Inbox setup flow` section from the skill so it no longer appears in future prompts.
