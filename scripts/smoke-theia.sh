#!/usr/bin/env bash
# Wave 0 gate for BUILD-01. Run from the repo root, no arguments.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
THEIA_DIR="$REPO_ROOT/theia"

if [ ! -f "$THEIA_DIR/package.json" ]; then
  echo "smoke-theia: FAIL -- $THEIA_DIR/package.json does not exist yet (Theia workspace not created)" >&2
  exit 1
fi

cd "$THEIA_DIR"

INSTALL_CMD="yarn install"
if [ -f yarn.lock ]; then
  INSTALL_CMD="yarn install --frozen-lockfile"
fi

nix develop "$REPO_ROOT#theia" --command bash -c "
  set -euo pipefail
  $INSTALL_CMD
  yarn theia rebuild:browser --cacheRoot .
  yarn theia build --app-target=browser --mode development
"

PTY_ARTIFACT="$THEIA_DIR/node_modules/node-pty/build/Release/pty.node"
if [ ! -f "$PTY_ARTIFACT" ]; then
  echo "smoke-theia: FAIL -- native rebuild did not produce $PTY_ARTIFACT" >&2
  exit 1
fi

SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

nix develop "$REPO_ROOT#theia" --command yarn theia start &
SERVER_PID=$!

DEADLINE=$((SECONDS + 60))
until curl -sf http://localhost:3000 >/dev/null 2>&1; do
  if [ "$SECONDS" -ge "$DEADLINE" ]; then
    echo "smoke-theia: FAIL -- localhost:3000 did not answer within 60s" >&2
    exit 1
  fi
  sleep 1
done

echo "smoke-theia: PASS"
