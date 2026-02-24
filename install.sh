#!/usr/bin/env sh
set -eu

REPO_TARBALL="${REPO_TARBALL:-https://codeload.github.com/pavel-voronin/toolchain-bookmarks/tar.gz/refs/heads/main}"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required but not found in PATH."
  echo "Install bun first: https://bun.sh/docs/installation"
  exit 1
fi

TARGET_DIR="$(pwd)"
TMP_DIR="$(mktemp -d)"
ARCHIVE="$TMP_DIR/repo.tar.gz"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

if [ -f "$REPO_TARBALL" ]; then
  cp "$REPO_TARBALL" "$ARCHIVE"
else
  curl -fsSL "$REPO_TARBALL" -o "$ARCHIVE"
fi
tar -xzf "$ARCHIVE" -C "$TMP_DIR"
SRC_DIR="$(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"

if [ -z "${SRC_DIR:-}" ]; then
  echo "failed to resolve source directory from tarball"
  exit 1
fi

cd "$SRC_DIR"
bun install --silent
bun run build

cp "$SRC_DIR/dist/bookmarks" "$TARGET_DIR/bookmarks"
chmod +x "$TARGET_DIR/bookmarks"

cd "$TARGET_DIR"
if [ "${BOOKMARKS_INSTALL_SKIP_INIT:-0}" != "1" ]; then
  ./bookmarks init
  echo ""
  echo "Install completed."
  echo "Next steps:"
  echo "1) Install and start systemd timer:"
  echo "   sudo cp ./systemd/bookmarks-make-diff.service /etc/systemd/system/"
  echo "   sudo cp ./systemd/bookmarks-make-diff.timer /etc/systemd/system/"
  echo "   sudo systemctl daemon-reload"
  echo "   sudo systemctl enable --now bookmarks-make-diff.timer"
fi
