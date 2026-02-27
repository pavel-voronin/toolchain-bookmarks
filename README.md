# toolchain-bookmarks

TypeScript CLI for Chrome bookmarks, built with `bun`, with runtime initialization and skill lifecycle.

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
- `./bookmarks make-diff`
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
- `./snapshots/`
- `./diffs/`
- `./state.json`
- `./requests/`

## Diff cursor

`bookmarks diff` uses internal cursor state in `./state.json`.

- agent repeatedly calls `./bookmarks diff`
- cursor advances automatically when an event is returned

## Request log

Before requesting a missing scenario, the agent must run:

```bash
./bookmarks request "what scenario is missing and why"
```

Request files are written to `./requests/*.txt`.

## Error log

All command errors are written to:

- `./errors.log`

## Systemd (Ubuntu, every 5 seconds)

`install.sh` generates:

- `./systemd/bookmarks-make-diff.service`
- `./systemd/bookmarks-make-diff.timer`

Install into system:

```bash
sudo cp ./systemd/bookmarks-make-diff.service /etc/systemd/system/
sudo cp ./systemd/bookmarks-make-diff.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bookmarks-make-diff.timer
```

## Skill placeholders

`skill-update` renders values into `assets/bookmarks/*`:

- `{{BOOKMARKS_BIN}}`
