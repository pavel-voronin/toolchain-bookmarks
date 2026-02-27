#!/usr/bin/env sh
set -eu

# Environment variables:

# REPO_TARBALL: Override source tarball URL/path used by installer.
# BOOKMARKS_WIZARD_INTERACTIVE: Set to 0 to disable interactive prompts.
# CDP_HTTP: Chrome DevTools HTTP endpoint (for example http://127.0.0.1:9222).

# Installation source and defaults.
REPO_TARBALL="${REPO_TARBALL:-https://codeload.github.com/pavel-voronin/toolchain-bookmarks/tar.gz/refs/heads/main}"
DEFAULT_CDP_HTTP="http://127.0.0.1:9222"
DEFAULT_BOOKMARKS_FILE="${HOME:-}/.chrome-headless-profile/Default/Bookmarks"

TARGET_DIR="$(pwd)"
TMP_DIR="$(mktemp -d)"
ARCHIVE="$TMP_DIR/repo.tar.gz"
SRC_DIR=""
STAGED_BIN="$TMP_DIR/bookmarks"
INTERACTIVE="1"
SUPPORTED_COMPLETION_SHELLS="zsh"

RESET_STYLE=""
WHITE_BOLD_STYLE=""
PINK_STYLE=""

# Track env override presence (including explicit empty values).
HAS_ENV_CDP_HTTP="0"
if [ "${CDP_HTTP+x}" = "x" ]; then HAS_ENV_CDP_HTTP="1"; fi

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
  cdp_http="$1"
  bar="▓"

  log ""
  if [ "$INTERACTIVE" = "1" ]; then
    log "$bar ${WHITE_BOLD_STYLE}Configuration preview${RESET_STYLE}"
  else
    log "$bar Configuration preview"
  fi
  log "$bar"
  log "$bar BOOKMARKS_FILE: $DEFAULT_BOOKMARKS_FILE"
  log "$bar CDP_HTTP: $cdp_http"
}

is_cdp_reachable() {
  endpoint="$1"
  curl -fsS --max-time 2 "$endpoint/json/version" >/dev/null 2>&1
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

render_config_ts() {
  cdp="$1"

  cat > "$TARGET_DIR/config.ts" <<EOF
export const config = {
  "BOOKMARKS_FILE": "${DEFAULT_BOOKMARKS_FILE}",
  "CDP_HTTP": "${cdp}"
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

write_zsh_completion_file() {
  completion_dir="$TARGET_DIR/completions"
  completion_file="$completion_dir/_bookmarks"
  mkdir -p "$completion_dir"

  cat > "$completion_file" <<'EOF'
#compdef bookmarks

_bookmarks() {
  local context state line
  local -a commands
  commands=(
    'doctor:verify local runtime and dependencies'
    'skill-update:render local skill files'
    'self-update:update local binary'
    'make-diff:poll Chrome bookmarks and persist snapshots'
    'diff:read next diff event'
    'request:write missing scenario request'
    'repl:start interactive shell'
    'get:get bookmarks by ids'
    'get-children:get direct children of folder'
    'get-recent:get recent bookmarks'
    'get-sub-tree:get folder subtree'
    'get-tree:get full bookmarks tree'
    'search:search bookmarks'
    'create:create bookmark or folder'
    'update:update bookmark'
    'move:move bookmark'
    'remove:remove bookmark'
    'remove-tree:remove folder subtree'
    'ping:check API bridge'
  )

  _arguments -s -C \
    '(-h --help)'{-h,--help}'[show help]' \
    '(-v --version)'{-v,--version}'[show version]' \
    '(-j --json)'{-j,--json}'[JSON output]' \
    '(-H --human)'{-H,--human}'[Human output]' \
    '1:command:->command' \
    '*::args:->args'

  case "$state" in
    command)
      _describe -t commands 'bookmarks command' commands
      return 0
      ;;
    args)
      case "$words[2]" in
        doctor|skill-update|self-update|make-diff|diff)
          _arguments \
            '(-j --json)'{-j,--json}'[JSON output]' \
            '(-H --human)'{-H,--human}'[Human output]'
          ;;
        request)
          _arguments \
            '(-j --json)'{-j,--json}'[JSON output]' \
            '(-H --human)'{-H,--human}'[Human output]' \
            '*::description'
          ;;
        repl)
          _arguments \
            '(-j --json)'{-j,--json}'[JSON output by default in REPL]' \
            '(-H --human)'{-H,--human}'[Human output by default in REPL]'
          ;;
        get-tree|ping)
          _arguments \
            '(-j --json)'{-j,--json}'[JSON output]' \
            '(-H --human)'{-H,--human}'[Human output]' \
            '(-f --fields)'{-f+,--fields+}'[Comma-separated output fields]:fields'
          ;;
        get)
          _arguments \
            '(-j --json)'{-j,--json}'[JSON output]' \
            '(-H --human)'{-H,--human}'[Human output]' \
            '(-f --fields)'{-f+,--fields+}'[Comma-separated output fields]:fields' \
            '*::id'
          ;;
        get-children|get-sub-tree|remove|remove-tree)
          _arguments \
            '(-j --json)'{-j,--json}'[JSON output]' \
            '(-H --human)'{-H,--human}'[Human output]' \
            '(-f --fields)'{-f+,--fields+}'[Comma-separated output fields]:fields' \
            '1:id'
          ;;
        get-recent)
          _arguments \
            '(-j --json)'{-j,--json}'[JSON output]' \
            '(-H --human)'{-H,--human}'[Human output]' \
            '(-f --fields)'{-f+,--fields+}'[Comma-separated output fields]:fields' \
            '1:count'
          ;;
        search)
          _arguments \
            '(-j --json)'{-j,--json}'[JSON output]' \
            '(-H --human)'{-H,--human}'[Human output]' \
            '(-f --fields)'{-f+,--fields+}'[Comma-separated output fields]:fields' \
            '*::query'
          ;;
        create)
          _arguments \
            '(-j --json)'{-j,--json}'[JSON output]' \
            '(-H --human)'{-H,--human}'[Human output]' \
            '(-f --fields)'{-f+,--fields+}'[Comma-separated output fields]:fields' \
            '--parent-id=[parent folder id]:id' \
            '--title=[bookmark or folder title]:title' \
            '--url=[bookmark URL]:url' \
            '--index=[position in folder]:index'
          ;;
        update)
          _arguments \
            '(-j --json)'{-j,--json}'[JSON output]' \
            '(-H --human)'{-H,--human}'[Human output]' \
            '(-f --fields)'{-f+,--fields+}'[Comma-separated output fields]:fields' \
            '--title=[new title]:title' \
            '--url=[new URL]:url' \
            '1:id'
          ;;
        move)
          _arguments \
            '(-j --json)'{-j,--json}'[JSON output]' \
            '(-H --human)'{-H,--human}'[Human output]' \
            '(-f --fields)'{-f+,--fields+}'[Comma-separated output fields]:fields' \
            '--parent-id=[target parent folder id]:id' \
            '--index=[target position in parent]:index' \
            '1:id'
          ;;
      esac
      ;;
  esac
}
EOF
}

detect_invoking_shell() {
  parent_shell="$(ps -p "$PPID" -o comm= 2>/dev/null | awk '{print $1}' | sed 's/^-//')"
  if [ -n "$parent_shell" ]; then
    case "$parent_shell" in
      zsh|bash)
        printf '%s\n' "$parent_shell"
        return 0
        ;;
    esac
  fi

  login_shell="$(basename "${SHELL:-}" 2>/dev/null || true)"
  case "$login_shell" in
    zsh|bash)
      printf '%s\n' "$login_shell"
      return 0
      ;;
  esac

  printf '\n'
}

append_zshrc_completion_block_once() {
  completion_dir="$1"
  zshrc_file="${HOME:-}/.zshrc"
  marker_begin="# >>> bookmarks completions >>>"
  marker_end="# <<< bookmarks completions <<<"

  [ -n "${HOME:-}" ] || return 0
  [ -d "$completion_dir" ] || return 0
  [ -f "$completion_dir/_bookmarks" ] || return 0

  if [ ! -f "$zshrc_file" ]; then
    touch "$zshrc_file"
  fi

  if grep -Fq "$marker_begin" "$zshrc_file"; then
    return 0
  fi

  {
    printf '\n%s\n' "$marker_begin"
    printf 'if [ -d "%s" ]; then\n' "$completion_dir"
    printf '  fpath=("%s" $fpath)\n' "$completion_dir"
    printf '  autoload -Uz compinit\n'
    printf '  compinit -i\n'
    printf 'fi\n'
    printf '%s\n' "$marker_end"
  } >> "$zshrc_file"
}

install_shell_completions() {
  [ "$INTERACTIVE" = "1" ] || return 0

  shell_name="$(detect_invoking_shell)"
  [ -n "$shell_name" ] || return 0

  for supported_shell in $SUPPORTED_COMPLETION_SHELLS; do
    [ "$supported_shell" = "$shell_name" ] || continue

    case "$supported_shell" in
      zsh)
        if ! run_step "Generating zsh completion" write_zsh_completion_file; then
          log "Notice: failed to generate zsh completion; continuing without shell setup."
          return 0
        fi
        if ! run_step "Updating .zshrc completion config" \
          append_zshrc_completion_block_once "$TARGET_DIR/completions"; then
          log "Notice: failed to update ~/.zshrc; add completions directory to fpath manually."
          return 0
        fi
        ;;
    esac
  done
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
  cdp_http="$1"

  run_step "Writing configuration" render_config_ts "$cdp_http"
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
  cdp_http="$1"

  while true; do
    print_preview_block "$cdp_http"

    choice="$(prompt_select "Review setup" \
      "Apply" \
      "Edit CDP_HTTP" \
      "Cancel installation")"

    case "$choice" in
      "Apply")
        apply_install "$cdp_http"
        return 0
        ;;
      "Edit CDP_HTTP")
        cdp_http="$(prompt_input "CDP HTTP endpoint" "$cdp_http")"
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

  if [ "$INTERACTIVE" = "1" ]; then
    confirm_and_apply "$cdp_http"
    return 0
  fi

  apply_install "$cdp_http"
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

  install_shell_completions
  handle_systemd_post_install
  run_step "Update complete" true
  exit 0
fi

run_install_wizard
install_shell_completions
handle_systemd_post_install
run_step "Installation complete" true
