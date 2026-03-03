# toolchain-bookmarks

TypeScript CLI for Chrome bookmarks, built with `bun`, with runtime initialization and live event tracking via CDP.

## Requirements

- `bun` must be installed and available in `PATH`
- Chrome/Chromium with CDP endpoint enabled (default: `http://127.0.0.1:9222`)

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/pavel-voronin/toolchain-bookmarks/main/install.sh | sh
```

`install.sh` does:

1. fail-fast check for `bun`
2. download repository tarball
3. build `bookmarks`
4. copy binary into current directory
5. run interactive runtime setup

## Commands

- `./bookmarks` (starts interactive REPL)
- `./bookmarks repl`
- `./bookmarks doctor`
- `./bookmarks skill-update`
- `./bookmarks self-update`
- `./bookmarks service`
- `./bookmarks health`
- `./bookmarks diff`
- `./bookmarks request <scenario description>`

Output mode:

- default: human
- JSON: `-j` or `--json`
- field selection (scenario/API): `-f id,title,url` or `--fields id,title,url`

REPL defaults:

- `./bookmarks -j` (start REPL with JSON output by default)
- `./bookmarks repl -j`
- inside REPL: add `-H` or `--human` on a command to force human output

## Tests

```bash
bun test
```

### API aliases (simplified)

- `./bookmarks get <id...>`
- `./bookmarks get-children <id>`
- `./bookmarks get-recent <n>`
- `./bookmarks get-sub-tree <id>`
- `./bookmarks get-tree`
- `./bookmarks search <query>`
- `./bookmarks create --parent-id <id> --title <title> [--url <url>] [--index <n>]`
- `./bookmarks update <id> [--title <title>] [--url <url>]`
- `./bookmarks move <id> --parent-id <id> [--index <n>]`
- `./bookmarks remove <id>`
- `./bookmarks remove-tree <id>`
- `./bookmarks ping`

## Runtime layout (current directory)

- `./bookmarks`
- `./config.ts`
- `./skills/bookmarks/`
- `./systemd/`
- `./diffs/`
- `./baseline.json`
- `./state.json`
- `./requests/`

## Event stream cursor

`bookmarks diff` uses internal cursor state in `./state.json`.

- agent repeatedly calls `./bookmarks diff`
- cursor advances automatically when an event is returned

## Service mode

`bookmarks service`:

- does startup reconciliation using current `get-tree` vs `./baseline.json`
- emits domain events to `./diffs/*.json`
- subscribes to live `chrome.bookmarks` API events via CDP
- writes heartbeat fields into `./state.json`

`bookmarks health` checks heartbeat freshness.

## Request log

Before requesting a missing scenario, the agent must run:

```bash
./bookmarks request "what scenario is missing and why"
```

Request files are written to `./requests/*.txt`.

## Error log

All command errors are written to:

- `./errors.log`

## Systemd (Ubuntu, user service)

`install.sh` generates:

- `./systemd/bookmarks.service`

Install into user systemd:

```bash
mkdir -p ~/.config/systemd/user
cp ./systemd/bookmarks.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now bookmarks.service
```

## Skill placeholders

`skill-update` renders values into `assets/bookmarks/*`:

- `{{BOOKMARKS_BIN}}`
