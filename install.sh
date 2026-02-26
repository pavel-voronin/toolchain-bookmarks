#!/usr/bin/env sh
set -eu

# Environment variables:

# REPO_TARBALL: Override source tarball URL/path used by installer.
# BOOKMARKS_WIZARD_INTERACTIVE: Set to 0 to disable interactive prompts.
# BOOKMARKS_SKIP_BOOKMARKS_FILE_CHECK: Set to 1 to skip BOOKMARKS_FILE existence checks.
# BOOKMARKS_FILE: Absolute/relative path to Chrome Bookmarks JSON.
# CDP_HTTP: Chrome DevTools HTTP endpoint (for example http://127.0.0.1:9222).
# INBOX_FOLDER_NAME: Folder name used to search Inbox candidates (default: Inbox).
# INBOX_FOLDER_ID: Force Inbox folder ID and skip candidate selection.

# Installation source and defaults.
REPO_TARBALL="${REPO_TARBALL:-https://codeload.github.com/pavel-voronin/toolchain-bookmarks/tar.gz/refs/heads/main}"
DEFAULT_CDP_HTTP="http://127.0.0.1:9222"
DEFAULT_BOOKMARKS_FILE="${HOME:-}/.chrome-headless-profile/Default/Bookmarks"
INBOX_QUERY="Inbox"

TARGET_DIR="$(pwd)"
TMP_DIR="$(mktemp -d)"
ARCHIVE="$TMP_DIR/repo.tar.gz"
SRC_DIR=""
STAGED_BIN="$TMP_DIR/bookmarks"
INTERACTIVE="1"
INBOX_FOLDER_PATH_UI=""

RESET_STYLE=""
WHITE_BOLD_STYLE=""
PINK_STYLE=""

# Track env override presence (including explicit empty values).
HAS_ENV_BOOKMARKS_FILE="0"
HAS_ENV_CDP_HTTP="0"
HAS_ENV_INBOX_FOLDER_ID="0"
HAS_ENV_INBOX_FOLDER_NAME="0"
if [ "${BOOKMARKS_FILE+x}" = "x" ]; then HAS_ENV_BOOKMARKS_FILE="1"; fi
if [ "${CDP_HTTP+x}" = "x" ]; then HAS_ENV_CDP_HTTP="1"; fi
if [ "${INBOX_FOLDER_ID+x}" = "x" ]; then HAS_ENV_INBOX_FOLDER_ID="1"; fi
if [ "${INBOX_FOLDER_NAME+x}" = "x" ]; then HAS_ENV_INBOX_FOLDER_NAME="1"; fi

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT
trap 'cleanup; exit 130' INT TERM

log() {
  # Keep UI output on stderr so stdout can carry function return values.
  printf '%s\n' "$*" >&2
}

log_error() {
  if [ "$INTERACTIVE" = "1" ]; then
    printf '%s%s%s\n' "$PINK_STYLE" "$*" "$RESET_STYLE" >&2
  else
    printf '%s\n' "$*" >&2
  fi
}

step_begin() {
  label="$1"
  if [ "$INTERACTIVE" = "1" ]; then
    printf '%s%s...%s ' "$WHITE_BOLD_STYLE" "$label" "$RESET_STYLE" >/dev/tty
  else
    printf '%s... ' "$label" >&2
  fi
}

step_done() {
  if [ "$INTERACTIVE" = "1" ]; then
    printf '%sDONE%s\n' "$WHITE_BOLD_STYLE" "$RESET_STYLE" >/dev/tty
  else
    printf 'DONE\n' >&2
  fi
}

step_error() {
  if [ "$INTERACTIVE" = "1" ]; then
    printf '%sERROR%s\n' "$PINK_STYLE" "$RESET_STYLE" >/dev/tty
  else
    printf 'ERROR\n' >&2
  fi
}

run_step() {
  label="$1"
  shift
  step_begin "$label"
  if "$@"; then
    step_done
  else
    step_error
    return 1
  fi
}

print_error_log() {
  file="$1"
  if [ "$INTERACTIVE" = "1" ]; then
    while IFS= read -r line; do
      printf '%s%s%s\n' "$PINK_STYLE" "$line" "$RESET_STYLE" >&2
    done <"$file"
  else
    cat "$file" >&2
  fi
}

die() {
  if [ "$INTERACTIVE" = "1" ]; then
    printf '%serror: %s%s\n' "$PINK_STYLE" "$*" "$RESET_STYLE" >&2
  else
    printf 'error: %s\n' "$*" >&2
  fi
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    die "$1 is required but not found in PATH"
  fi
}

trim_spaces() {
  printf '%s' "$1" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

print_prompt_separator() {
  if [ "$INTERACTIVE" = "1" ]; then
    printf '\n' >/dev/tty
  else
    printf '\n' >&2
  fi
}

prompt_input() {
  [ "$INTERACTIVE" = "1" ] || return 1

  prompt="$1"
  default_value="${2:-}"
  print_prompt_separator

  if [ -n "$default_value" ]; then
    printf '%s%s%s [%s]: ' "$WHITE_BOLD_STYLE" "$prompt" "$RESET_STYLE" "$default_value" >/dev/tty
  else
    printf '%s%s%s: ' "$WHITE_BOLD_STYLE" "$prompt" "$RESET_STYLE" >/dev/tty
  fi

  if ! IFS= read -r answer </dev/tty; then
    die "installation canceled by user"
  fi

  answer="$(trim_spaces "$answer")"
  if [ -n "$answer" ]; then
    printf '%s\n' "$answer"
    return 0
  fi

  printf '%s\n' "$default_value"
}

prompt_select() {
  [ "$INTERACTIVE" = "1" ] || return 1

  message="$1"
  shift
  [ "$#" -gt 0 ] || return 1

  while true; do
    print_prompt_separator
    printf '%s%s%s\n' "$WHITE_BOLD_STYLE" "$message" "$RESET_STYLE" >/dev/tty

    idx=1
    for choice in "$@"; do
      printf '  %s) %s\n' "$idx" "$choice" >/dev/tty
      idx=$((idx + 1))
    done

    printf 'Select number: ' >/dev/tty
    if ! IFS= read -r raw_pick </dev/tty; then
      die "installation canceled by user"
    fi
    pick="$(trim_spaces "$raw_pick")"

    if printf '%s' "$pick" | grep -Eq '^[1-9][0-9]*$' && [ "$pick" -le "$#" ]; then
      idx=1
      for choice in "$@"; do
        if [ "$idx" -eq "$pick" ]; then
          printf '%s\n' "$choice"
          return 0
        fi
        idx=$((idx + 1))
      done
    fi

    log "Invalid selection: $pick"
  done
}

print_preview_block() {
  bookmarks_file="$1"
  cdp_http="$2"
  inbox_folder_id="$3"
  inbox_folder_path="$4"
  bar="▓"

  if [ -z "$inbox_folder_path" ] && [ -n "$inbox_folder_id" ] && [ -f "$bookmarks_file" ] && command -v jq >/dev/null 2>&1; then
    # Resolve path lazily for UI preview to avoid subshell state issues.
    inbox_folder_path="$(jq -r --arg id "$inbox_folder_id" '
      def walk($parent):
        . as $n
        | ($n.name // $n.title // "") as $title
        | ($n.id // "") as $nid
        | ($n.url // null) as $url
        | ($parent + "/" + $title) as $path
        | (if ($nid != "" and $title != "" and $url == null) then [{id: $nid, path: $path}] else [] end)
          + ((.children // []) | map(walk($path)) | add // []);
      [
        .roots
        | to_entries[] as $r
        | ($r.key) as $k
        | ($r.value) as $root
        | (if $k == "bookmark_bar" then "Bookmarks Bar"
           elif $k == "other" then "Other Bookmarks"
           elif $k == "synced" then "Mobile Bookmarks"
           else ($root.name // $root.title // $k) end) as $root_title
        | (($root.children // []) | map(walk("/" + $root_title)) | add // [])
      ]
      | add // []
      | map(select(.id == $id))
      | .[0].path // ""
    ' "$bookmarks_file" 2>/dev/null || true)"
  fi

  log ""
  if [ "$INTERACTIVE" = "1" ]; then
    log "$bar ${WHITE_BOLD_STYLE}Configuration preview${RESET_STYLE}"
  else
    log "$bar Configuration preview"
  fi
  log "$bar"
  log "$bar BOOKMARKS_FILE: $bookmarks_file"
  log "$bar CDP_HTTP: $cdp_http"
  if [ -n "$inbox_folder_id" ]; then
    if [ -n "$inbox_folder_path" ]; then
      log "$bar INBOX_FOLDER_ID: $inbox_folder_id ($inbox_folder_path)"
    else
      log "$bar INBOX_FOLDER_ID: $inbox_folder_id"
    fi
  else
    log "$bar INBOX_FOLDER_ID: <empty>"
  fi
}

is_cdp_reachable() {
  endpoint="$1"
  curl -fsS --max-time 2 "$endpoint/json/version" >/dev/null 2>&1
}

is_integer() {
  value="$1"
  printf '%s' "$value" | grep -Eq '^[0-9]+$'
}

should_validate_bookmarks_file() {
  [ "${BOOKMARKS_SKIP_BOOKMARKS_FILE_CHECK:-0}" != "1" ]
}

resolve_bookmarks_file() {
  if [ "$HAS_ENV_BOOKMARKS_FILE" = "1" ]; then
    if should_validate_bookmarks_file && [ ! -f "$BOOKMARKS_FILE" ]; then
      die "BOOKMARKS_FILE does not exist: $BOOKMARKS_FILE"
    fi
    printf '%s\n' "$BOOKMARKS_FILE"
    return 0
  fi

  if [ -f "$DEFAULT_BOOKMARKS_FILE" ]; then
    printf '%s\n' "$DEFAULT_BOOKMARKS_FILE"
    return 0
  fi

  [ "$INTERACTIVE" = "1" ] || die "BOOKMARKS_FILE is required in non-interactive mode"
  while true; do
    picked="$(prompt_input "Path to Bookmarks JSON file" "$DEFAULT_BOOKMARKS_FILE")"
    if [ -f "$picked" ] || ! should_validate_bookmarks_file; then
      printf '%s\n' "$picked"
      return 0
    fi
    log_error "File not found: $picked"
  done
}

resolve_cdp_http() {
  if [ "$HAS_ENV_CDP_HTTP" = "1" ]; then
    printf '%s\n' "$CDP_HTTP"
    return 0
  fi

  if is_cdp_reachable "$DEFAULT_CDP_HTTP"; then
    printf '%s\n' "$DEFAULT_CDP_HTTP"
    return 0
  fi

  [ "$INTERACTIVE" = "1" ] || die "CDP_HTTP is required in non-interactive mode when default endpoint is unreachable"
  while true; do
    picked="$(prompt_input "CDP HTTP endpoint" "$DEFAULT_CDP_HTTP")"
    if [ -n "$picked" ]; then
      printf '%s\n' "$picked"
      return 0
    fi
  done
}

resolve_inbox_folder_name() {
  if [ "$HAS_ENV_INBOX_FOLDER_NAME" = "1" ]; then
    printf '%s\n' "$INBOX_FOLDER_NAME"
    return 0
  fi

  [ "$INTERACTIVE" = "1" ] || {
    printf '%s\n' "$INBOX_QUERY"
    return 0
  }

  prompt_input "Inbox folder name" "$INBOX_QUERY"
}

collect_inbox_candidates() {
  bookmarks_file="$1"
  query="$2"
  query_lc="$(printf '%s' "$query" | tr '[:upper:]' '[:lower:]')"

  jq -r --arg q "$query_lc" '
    def walk($parent):
      . as $n
      | ($n.name // $n.title // "") as $title
      | ($n.id // "") as $id
      | ($n.url // null) as $url
      | ($parent + "/" + $title) as $path
      | (if ($id != "" and $title != "" and $url == null)
           then [{id: $id, title: $title, path: $path, norm: ($title | ascii_downcase)}]
           else [] end)
        + ((.children // []) | map(walk($path)) | add // []);

    [
      .roots
      | to_entries[] as $r
      | ($r.key) as $k
      | ($r.value) as $root
      | (if $k == "bookmark_bar" then "Bookmarks Bar"
         elif $k == "other" then "Other Bookmarks"
         elif $k == "synced" then "Mobile Bookmarks"
         else ($root.name // $root.title // $k) end) as $root_title
      | (($root.children // []) | map(walk("/" + $root_title)) | add // [])
    ]
    | add // []
    | (map(select(.norm == $q)) as $exact
      | if ($exact | length) > 0 then $exact else map(select(.norm | contains($q))) end)
    | .[]
    | [.id, .title, .path]
    | @tsv
  ' "$bookmarks_file" 2>/dev/null || true
}

resolve_inbox_folder_id() {
  bookmarks_file="$1"
  inbox_folder_name="$2"
  INBOX_FOLDER_PATH_UI=""

  candidates_file="$TMP_DIR/inbox_candidates.tsv"
  if [ -f "$bookmarks_file" ]; then
    collect_inbox_candidates "$bookmarks_file" "$inbox_folder_name" > "$candidates_file"
  else
    : > "$candidates_file"
  fi

  if [ ! -f "$bookmarks_file" ]; then
    if [ "$HAS_ENV_INBOX_FOLDER_ID" = "1" ]; then
      is_integer "$INBOX_FOLDER_ID" || die "INBOX_FOLDER_ID must be an integer when bookmarks file is missing"
      printf '%s\n' "$INBOX_FOLDER_ID"
      return 0
    fi

    [ "$INTERACTIVE" = "1" ] || {
      printf '\n'
      return 0
    }

    while true; do
      manual_id="$(prompt_input "INBOX_FOLDER_ID (integer, empty to skip)" "")"
      if [ -z "$manual_id" ]; then
        printf '\n'
        return 0
      fi
      if is_integer "$manual_id"; then
        printf '%s\n' "$manual_id"
        return 0
      fi
      log_error "Invalid INBOX_FOLDER_ID: $manual_id"
    done
  fi

  if [ "$HAS_ENV_INBOX_FOLDER_ID" = "1" ]; then
    INBOX_FOLDER_PATH_UI="$(awk -F "$(printf '\t')" -v id="$INBOX_FOLDER_ID" '$1 == id { print $3; exit }' "$candidates_file" || true)"
    printf '%s\n' "$INBOX_FOLDER_ID"
    return 0
  fi

  count="$(grep -c . "$candidates_file" || true)"

  if [ "$count" -eq 0 ]; then
    printf '\n'
    return 0
  fi

  if [ "$count" -eq 1 ]; then
    INBOX_FOLDER_PATH_UI="$(cut -f3 "$candidates_file")"
    cut -f1 "$candidates_file"
    return 0
  fi

  [ "$INTERACTIVE" = "1" ] || die "multiple Inbox candidates found; set INBOX_FOLDER_ID in non-interactive mode"

  map_file="$TMP_DIR/inbox_map.tsv"
  : > "$map_file"

  # Build human-readable choices and label->id map.
  set --
  while IFS="$(printf '\t')" read -r id title path; do
    label="$path"
    printf '%s\t%s\n' "$label" "$id" >> "$map_file"
    set -- "$@" "$label"
  done < "$candidates_file"
  set -- "$@" "Skip (no Inbox)"

  selected="$(prompt_select "Select Inbox folder" "$@")"
  if [ "$selected" = "Skip (no Inbox)" ]; then
    printf '\n'
    return 0
  fi

  INBOX_FOLDER_PATH_UI="$selected"
  picked_id="$(awk -F "$(printf '\t')" -v key="$selected" '$1 == key { print $2; exit }' "$map_file")"
  [ -n "$picked_id" ] || die "failed to resolve selected Inbox folder"
  printf '%s\n' "$picked_id"
}

render_config_ts() {
  file="$1"
  cdp="$2"
  inbox_id="$3"

  cat > "$TARGET_DIR/config.ts" <<EOF
export const config = {
  "BOOKMARKS_FILE": "${file}",
  "CDP_HTTP": "${cdp}",
  "INBOX_FOLDER_ID": "${inbox_id}"
} as const;

export default config;
EOF
}

escape_sed_replacement() {
  printf '%s' "$1" | sed 's/[&|]/\\&/g'
}

write_systemd_files() {
  systemd_dir="$TARGET_DIR/systemd"
  mkdir -p "$systemd_dir"

  cwd_escaped="$(escape_sed_replacement "$TARGET_DIR")"
  bin_escaped="$(escape_sed_replacement "$TARGET_DIR/bookmarks")"

  sed -e "s|{{BOOKMARKS_CWD}}|$cwd_escaped|g" -e "s|{{BOOKMARKS_BIN}}|$bin_escaped|g" \
    "$SRC_DIR/assets/systemd/bookmarks-make-diff.service" \
    > "$systemd_dir/bookmarks-make-diff.service"

  cp "$SRC_DIR/assets/systemd/bookmarks-make-diff.timer" \
    "$systemd_dir/bookmarks-make-diff.timer"
}

install_binary() {
  next_bin="$TARGET_DIR/.bookmarks.next.$$"
  cp "$STAGED_BIN" "$next_bin"
  chmod +x "$next_bin"
  mv -f "$next_bin" "$TARGET_DIR/bookmarks"
}

ensure_runtime_layout() {
  mkdir -p "$TARGET_DIR/skills"
  mkdir -p "$TARGET_DIR/requests"
  mkdir -p "$TARGET_DIR/snapshots"
  mkdir -p "$TARGET_DIR/diffs"
}

run_skill_update() {
  (cd "$TARGET_DIR" && ./bookmarks skill-update)
}

print_systemd_manual_instructions() {
  log ""
  if [ "$INTERACTIVE" = "1" ]; then
    log "${WHITE_BOLD_STYLE}Systemd setup:${RESET_STYLE}"
  else
    log "Systemd setup:"
  fi
  log "  mkdir -p ~/.config/systemd/user"
  log "  cp ./systemd/bookmarks-make-diff.service ~/.config/systemd/user/"
  log "  cp ./systemd/bookmarks-make-diff.timer ~/.config/systemd/user/"
  log "  systemctl --user daemon-reload"
  log "  systemctl --user enable --now bookmarks-make-diff.timer"
}

systemd_available() {
  command -v systemctl >/dev/null 2>&1
}

user_systemd_available() {
  systemctl --user is-active default.target >/dev/null 2>&1
}

configure_user_systemd() {
  user_unit_dir="$HOME/.config/systemd/user"
  service_name="bookmarks-make-diff.service"
  timer_name="bookmarks-make-diff.timer"
  local_service="$TARGET_DIR/systemd/$service_name"
  local_timer="$TARGET_DIR/systemd/$timer_name"

  [ -f "$local_service" ] || die "missing local systemd service file: $local_service"
  [ -f "$local_timer" ] || die "missing local systemd timer file: $local_timer"

  run_step "Preparing user systemd directory" mkdir -p "$user_unit_dir"
  run_step "Copying user systemd service" cp "$local_service" "$user_unit_dir/$service_name"
  run_step "Copying user systemd timer" cp "$local_timer" "$user_unit_dir/$timer_name"
  run_step "Reloading user systemd" systemctl --user daemon-reload
  run_step "Enabling and starting user timer" systemctl --user enable --now "$timer_name"
  run_step "Restarting user timer" systemctl --user restart "$timer_name"
}

handle_systemd_post_install() {
  user_unit_dir="$HOME/.config/systemd/user"
  user_service="$user_unit_dir/bookmarks-make-diff.service"
  user_timer="$user_unit_dir/bookmarks-make-diff.timer"

  print_systemd_manual_instructions

  if ! systemd_available; then
    log ""
    log "Notice: systemd was not detected. Automatic setup is unavailable on this system."
    return 0
  fi

  if ! user_systemd_available; then
    log ""
    log "Notice: systemd --user is not available in this session. Automatic setup is unavailable right now."
    return 0
  fi

  [ "$INTERACTIVE" = "1" ] || return 0

  if [ -f "$user_service" ] || [ -f "$user_timer" ]; then
    log ""
    log "Notice: user systemd units already exist."
    log "Automatic setup will update unit files and restart the timer."
  fi

  choice="$(prompt_select "Run user systemd setup automatically?" "Yes" "No")"
  if [ "$choice" = "No" ]; then
    return 0
  fi

  configure_user_systemd
}

apply_install() {
  bookmarks_file="$1"
  cdp_http="$2"
  inbox_folder_id="$3"

  run_step "Writing configuration" render_config_ts "$bookmarks_file" "$cdp_http" "$inbox_folder_id"
  run_step "Preparing runtime layout" ensure_runtime_layout
  run_step "Generating systemd files" write_systemd_files
  run_step "Installing binary" install_binary

  skill_log="$TMP_DIR/skill-update.log"
  step_begin "Updating skill files"
  if run_skill_update >"$skill_log" 2>&1; then
    step_done
  else
    step_error
    print_error_log "$skill_log"
    exit 1
  fi
}

confirm_and_apply() {
  bookmarks_file="$1"
  cdp_http="$2"
  inbox_folder_id="$3"

  while true; do
    print_preview_block "$bookmarks_file" "$cdp_http" "$inbox_folder_id" "$INBOX_FOLDER_PATH_UI"

    choice="$(prompt_select "Review setup" \
      "Apply" \
      "Edit BOOKMARKS_FILE" \
      "Edit CDP_HTTP" \
      "Edit INBOX_FOLDER_ID" \
      "Cancel installation")"

    case "$choice" in
      "Apply")
        apply_install "$bookmarks_file" "$cdp_http" "$inbox_folder_id"
        return 0
        ;;
      "Edit BOOKMARKS_FILE")
        bookmarks_file="$(prompt_input "Path to Bookmarks JSON file" "$bookmarks_file")"
        if should_validate_bookmarks_file && [ ! -f "$bookmarks_file" ]; then
          die "BOOKMARKS_FILE does not exist: $bookmarks_file"
        fi
        if [ -f "$bookmarks_file" ]; then
          inbox_folder_name="$(resolve_inbox_folder_name)"
        else
          inbox_folder_name=""
        fi
        inbox_folder_id="$(resolve_inbox_folder_id "$bookmarks_file" "$inbox_folder_name")"
        ;;
      "Edit CDP_HTTP")
        cdp_http="$(prompt_input "CDP HTTP endpoint" "$cdp_http")"
        ;;
      "Edit INBOX_FOLDER_ID")
        HAS_ENV_INBOX_FOLDER_ID="0"
        if [ -f "$bookmarks_file" ]; then
          inbox_folder_name="$(resolve_inbox_folder_name)"
        else
          inbox_folder_name=""
        fi
        inbox_folder_id="$(resolve_inbox_folder_id "$bookmarks_file" "$inbox_folder_name")"
        ;;
      "Cancel installation")
        die "installation canceled by user"
        ;;
      *)
        die "unexpected action: $choice"
        ;;
    esac
  done
}

run_install_wizard() {
  cdp_http="$(resolve_cdp_http)"
  bookmarks_file="$(resolve_bookmarks_file)"
  if [ -f "$bookmarks_file" ]; then
    require_cmd jq
    inbox_folder_name="$(resolve_inbox_folder_name)"
  else
    inbox_folder_name=""
  fi
  inbox_folder_id="$(resolve_inbox_folder_id "$bookmarks_file" "$inbox_folder_name")"

  if [ "$INTERACTIVE" = "1" ]; then
    confirm_and_apply "$bookmarks_file" "$cdp_http" "$inbox_folder_id"
    return 0
  fi

  apply_install "$bookmarks_file" "$cdp_http" "$inbox_folder_id"
}

# Decide whether interactive mode is allowed.
if [ "${BOOKMARKS_WIZARD_INTERACTIVE:-1}" = "0" ]; then
  INTERACTIVE="0"
elif [ ! -t 1 ] || [ ! -e /dev/tty ]; then
  INTERACTIVE="0"
fi

if [ "$INTERACTIVE" = "1" ]; then
  # Use compact ANSI styling for interactive terminals.
  WHITE_BOLD_STYLE="$(printf '\033[1;97m')"
  PINK_STYLE="$(printf '\033[95m')"
  RESET_STYLE="$(printf '\033[0m')"
fi

require_cmd bun
require_cmd curl
require_cmd tar

if [ -f "$REPO_TARBALL" ]; then
  run_step "Downloading source" cp "$REPO_TARBALL" "$ARCHIVE"
else
  fetch_log="$TMP_DIR/fetch.log"
  step_begin "Downloading source"
  if curl -fsSL "$REPO_TARBALL" -o "$ARCHIVE" >"$fetch_log" 2>&1; then
    step_done
  else
    step_error
    print_error_log "$fetch_log"
    exit 1
  fi
fi

extract_log="$TMP_DIR/extract.log"
step_begin "Extracting source"
if tar -xzf "$ARCHIVE" -C "$TMP_DIR" >"$extract_log" 2>&1; then
  step_done
else
  step_error
  print_error_log "$extract_log"
  exit 1
fi

SRC_DIR="$(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
[ -n "${SRC_DIR:-}" ] || die "failed to resolve source directory from tarball"

deps_log="$TMP_DIR/deps.log"
step_begin "Installing dependencies"
if (
  cd "$SRC_DIR"
  bun install --silent >"$deps_log" 2>&1
); then
  step_done
else
  step_error
  print_error_log "$deps_log"
  exit 1
fi

build_log="$TMP_DIR/build.log"
step_begin "Building"
if (
  cd "$SRC_DIR"
  bun run build >"$build_log" 2>&1
); then
  step_done
else
  step_error
  print_error_log "$build_log"
  exit 1
fi

cp "$SRC_DIR/dist/bookmarks" "$STAGED_BIN"
chmod +x "$STAGED_BIN"

if [ -f "$TARGET_DIR/config.ts" ]; then
  run_step "Generating systemd files" write_systemd_files
  run_step "Installing binary" install_binary

  update_skill_log="$TMP_DIR/update-skill.log"
  step_begin "Updating skill files"
  if run_skill_update >"$update_skill_log" 2>&1; then
    step_done
  else
    step_error
    print_error_log "$update_skill_log"
    exit 1
  fi

  handle_systemd_post_install
  run_step "Update complete" true
  exit 0
fi

run_install_wizard
handle_systemd_post_install
run_step "Installation complete" true
