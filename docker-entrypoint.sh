#!/usr/bin/env sh
set -eu

PROFILE_DIR="${CHROME_PROFILE_DIR:-/data/chrome-profile}"
PORT="${PORT:-3000}"
FORCE_UNLOCK="${CHROME_PROFILE_FORCE_UNLOCK:-0}"

mkdir -p "$PROFILE_DIR"

# Chrome can refuse to start when stale singleton lock artifacts are present.
# Keep safe behavior by default; allow explicit override via env.
if [ "$FORCE_UNLOCK" = "1" ]; then
  rm -f \
    "$PROFILE_DIR/SingletonLock" \
    "$PROFILE_DIR/SingletonCookie" \
    "$PROFILE_DIR/SingletonSocket" \
    "$PROFILE_DIR/DevToolsActivePort"
fi

google-chrome-stable \
  --headless \
  --no-sandbox \
  --disable-dev-shm-usage \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --user-data-dir="$PROFILE_DIR" \
  about:blank >/tmp/chrome.log 2>&1 &
CHROME_PID=$!

cleanup() {
  if kill -0 "$CHROME_PID" >/dev/null 2>&1; then
    kill "$CHROME_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "${API_PID:-}" ] && kill -0 "$API_PID" >/dev/null 2>&1; then
    kill "$API_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup INT TERM EXIT

for _ in $(seq 1 60); do
  if curl -fsS --max-time 1 http://127.0.0.1:9222/json/version >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

if ! curl -fsS --max-time 1 http://127.0.0.1:9222/json/version >/dev/null 2>&1; then
  if grep -qi "profile appears to be in use" /tmp/chrome.log 2>/dev/null; then
    echo "Chrome profile is locked by another process." >&2
    echo "Close all Chrome instances that use this profile, then retry." >&2
    echo "If you are sure the lock is stale, run with CHROME_PROFILE_FORCE_UNLOCK=1." >&2
  fi
  echo "CDP endpoint did not become ready" >&2
  tail -n 40 /tmp/chrome.log >&2 || true
  exit 1
fi

PORT="$PORT" node /app/dist/index.js &
API_PID=$!

wait "$API_PID"
