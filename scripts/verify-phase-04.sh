#!/usr/bin/env bash
# scripts/verify-phase-04.sh
#
# The single aggregator for every Phase 4 check, modelled on
# scripts/verify-phase-03.sh: unofficial-mode error handling (deliberately
# no `-e`, only `-u` and `pipefail` -- every check runs even if an earlier
# one failed), a CHECKS array
# later tasks append to rather than forking a sibling driver, and a
# per-check PASS/FAIL summary table with a non-zero exit if anything
# failed. One verification script per phase, extended never sibling'd
# (04-PATTERNS.md).
#
# `--quick` runs only checks needing no browser launch and no built tree.
# Task 1 registers the two boundary-guard checks here, both quick. Task 2
# appends backend-facing checks (token gate, bind scope) outside the quick
# set -- they spawn the Node sidecar. Task 3 appends end-to-end checks
# (shell presence, paint ordering, kill-and-recover) outside the quick set
# -- they launch the built `objdir/dist/bin/sourcerer` binary and reuse
# scripts/lib/firefox-bidi.mjs, never a second driver.
#
# Every external script invocation runs under `setsid`, exactly like
# scripts/verify-phase-02.sh's and scripts/verify-phase-03.sh's own
# pattern: this script is non-interactive so job control is off, and a
# plain `cmd &` would share this script's own process group with every
# descendant a check backgrounds -- setsid makes the check the leader of
# its own new process group so `kill -- "-$PID"` on interrupt reaches the
# whole group in one signal.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

QUICK=0
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=1 ;;
    *)
      echo "verify-phase-04: FAIL -- unknown argument '$arg'" >&2
      exit 1
      ;;
  esac
done

CURRENT_CHECK_PID=""
BACKEND_SPAWN_PID=""
declare -a TEMP_PATHS=()
track_temp() { TEMP_PATHS+=("$1"); }
cleanup() {
  if [ -n "$CURRENT_CHECK_PID" ]; then
    kill -- "-$CURRENT_CHECK_PID" 2>/dev/null || kill "$CURRENT_CHECK_PID" 2>/dev/null || true
    wait "$CURRENT_CHECK_PID" 2>/dev/null || true
    CURRENT_CHECK_PID=""
  fi
  # Safety net for a check-function check (side02-*, side01-bind-scope) that
  # started the sidecar via start_backend() and got interrupted before its
  # own stop_backend() call -- setsid gives the sidecar its own process
  # group, so a plain SIGINT to this script's foreground group would
  # otherwise orphan it.
  if [ -n "$BACKEND_SPAWN_PID" ]; then
    kill -- "-$BACKEND_SPAWN_PID" 2>/dev/null || kill "$BACKEND_SPAWN_PID" 2>/dev/null || true
    wait "$BACKEND_SPAWN_PID" 2>/dev/null || true
    BACKEND_SPAWN_PID=""
  fi
  for p in "${TEMP_PATHS[@]:-}"; do
    [ -n "$p" ] && rm -f "$p"
  done
  TEMP_PATHS=()
}
# EXIT alone is not enough: bash resumes the rest of the script after a
# non-EXIT trap handler returns unless that handler exits itself
# (scripts/verify-phase-02.sh/03.sh's own documented reason for splitting
# this into two traps).
trap cleanup EXIT
trap 'cleanup; exit 130' INT TERM

# --- Task 2: backend-facing checks (SIDE-01, SIDE-02) -----------------------
#
# Every check below is expected to FAIL until plan 04-02 lands the
# @sourcerer/token-gate extension: start_backend spawns the STOCK Theia
# backend (no token gate wired in yet), so SOURCERER_BACKEND_READY never
# appears in its log and every check that depends on it fails via the
# "backend never became ready" branch. That is the correct Wave 0 signal,
# not a broken harness (04-01-PLAN.md must_haves).
#
# start_backend/stop_backend set/clear a shared set of globals
# (BACKEND_TOKEN, BACKEND_PORT, BACKEND_PID, BACKEND_LOG, BACKEND_SPAWN_PID)
# rather than being passed around, mirroring this script's own CURRENT_CHECK_PID
# convention -- each check function calls start_backend, uses the globals,
# and always calls stop_backend before returning, on every path.
BACKEND_TOKEN=""
BACKEND_PORT=""
BACKEND_PID=""
BACKEND_LOG=""

# Spawns theia/applications/browser/lib/backend/main.js directly (D-101,
# Pitfall 2 -- never through the yarn/bash `theia start` wrapper, which
# would make kill() only reach a shell and orphan the real backend), inside
# `nix develop $REPO_ROOT#theia --command` so it gets the pinned Node 22.
# Binds --hostname 127.0.0.1 --port 0 (SIDE-01). Polls BACKEND_LOG for a
# `SOURCERER_BACKEND_READY {"port":N,"pid":N}` line for up to 90s. Returns
# 0 with BACKEND_TOKEN/BACKEND_PORT/BACKEND_PID/BACKEND_SPAWN_PID all set
# on success; on failure/timeout, prints the captured log and returns 1
# with BACKEND_SPAWN_PID left set so the caller's stop_backend still reaps
# whatever did spawn.
start_backend() {
  BACKEND_TOKEN="$(node -e 'console.log(require("crypto").randomBytes(24).toString("hex"))')"
  local log
  log="$(mktemp)"
  track_temp "$log"
  BACKEND_LOG="$log"

  local config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/sourcerer"
  mkdir -p "$config_dir"

  setsid env \
    SOURCERER_TOKEN="$BACKEND_TOKEN" \
    THEIA_CONFIG_DIR="$config_dir" \
    VSX_REGISTRY_URL="https://open-vsx.org" \
    nix develop "$REPO_ROOT#theia" --command \
    node "$REPO_ROOT/theia/applications/browser/lib/backend/main.js" --hostname 127.0.0.1 --port 0 \
    >"$log" 2>&1 &
  BACKEND_SPAWN_PID=$!

  local deadline=$((SECONDS + 90))
  local line json
  while [ "$SECONDS" -lt "$deadline" ]; do
    if line="$(grep -m1 '^SOURCERER_BACKEND_READY ' "$log" 2>/dev/null)"; then
      json="${line#SOURCERER_BACKEND_READY }"
      BACKEND_PORT="$(node -e 'try{const j=JSON.parse(process.argv[1]);if(typeof j.port==="number")console.log(j.port)}catch{}' "$json" 2>/dev/null)"
      BACKEND_PID="$(node -e 'try{const j=JSON.parse(process.argv[1]);if(typeof j.pid==="number")console.log(j.pid)}catch{}' "$json" 2>/dev/null)"
      if [ -n "$BACKEND_PORT" ] && [ -n "$BACKEND_PID" ]; then
        return 0
      fi
    fi
    if ! kill -0 "$BACKEND_SPAWN_PID" 2>/dev/null; then
      echo "start_backend: FAIL -- backend process exited before printing SOURCERER_BACKEND_READY; log:" >&2
      cat "$log" >&2
      return 1
    fi
    sleep 0.5
  done

  echo "start_backend: FAIL -- SOURCERER_BACKEND_READY did not appear within 90s; log:" >&2
  cat "$log" >&2
  return 1
}

stop_backend() {
  if [ -n "$BACKEND_SPAWN_PID" ]; then
    kill -- "-$BACKEND_SPAWN_PID" 2>/dev/null || kill "$BACKEND_SPAWN_PID" 2>/dev/null || true
    wait "$BACKEND_SPAWN_PID" 2>/dev/null || true
    BACKEND_SPAWN_PID=""
  fi
}

# Negative control (SIDE-02, Pitfall 1): a request with no cookie must be
# 403 AND must carry no Set-Cookie header at all -- a 403 that still leaks
# the stock theia-connection-token cookie is a FAIL, not just a status-code
# check.
check_side02_token_negative() {
  if ! start_backend; then
    echo "side02-token-negative: FAIL -- SIDE-02 -- backend never became ready, cannot test the token gate" >&2
    stop_backend
    return 1
  fi
  local headers status result=0
  headers="$(mktemp)"; track_temp "$headers"
  status="$(curl -sS -o /dev/null -w '%{http_code}' -D "$headers" "http://127.0.0.1:$BACKEND_PORT/sourcerer/health")"
  if [ "$status" != "403" ]; then
    echo "side02-token-negative: FAIL -- SIDE-02 -- expected 403 without a token, got $status" >&2
    result=1
  fi
  if grep -qi '^Set-Cookie:' "$headers"; then
    echo "side02-token-negative: FAIL -- SIDE-02 -- 403 response leaked a Set-Cookie header:" >&2
    grep -i '^Set-Cookie:' "$headers" >&2
    result=1
  fi
  stop_backend
  return "$result"
}

# Paired positive control (D-68 idiom): the same route, with the token
# cookie, must be 200 with a JSON body carrying ok:true and a numeric pid
# (D-103 -- one request proves both liveness and enforcement).
check_side02_token_positive() {
  if ! start_backend; then
    echo "side02-token-positive: FAIL -- SIDE-02 -- backend never became ready, cannot test the token gate" >&2
    stop_backend
    return 1
  fi
  local body status result=0
  body="$(mktemp)"; track_temp "$body"
  status="$(curl -sS -o "$body" -w '%{http_code}' -b "SOURCERER_TOKEN=$BACKEND_TOKEN" "http://127.0.0.1:$BACKEND_PORT/sourcerer/health")"
  if [ "$status" != "200" ]; then
    echo "side02-token-positive: FAIL -- SIDE-02 -- expected 200 with a valid token, got $status" >&2
    result=1
  elif ! node -e '
    const fs = require("fs");
    const b = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    process.exit(b.ok === true && typeof b.pid === "number" ? 0 : 1);
  ' "$body" 2>/dev/null; then
    echo "side02-token-positive: FAIL -- SIDE-02 -- 200 response body is not {ok:true, pid:<number>}: $(cat "$body")" >&2
    result=1
  fi
  stop_backend
  return "$result"
}

# D-98's clause that static assets and index.html are gated too (the stock
# Theia token does not do this -- it only enforces on WS upgrade and
# opt-in routes).
check_side02_index_gated() {
  if ! start_backend; then
    echo "side02-index-gated: FAIL -- SIDE-02 -- backend never became ready, cannot test the token gate" >&2
    stop_backend
    return 1
  fi
  local status_no status_yes result=0
  status_no="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$BACKEND_PORT/")"
  if [ "$status_no" != "403" ]; then
    echo "side02-index-gated: FAIL -- SIDE-02 -- expected 403 for / without a token, got $status_no" >&2
    result=1
  fi
  status_yes="$(curl -sS -o /dev/null -w '%{http_code}' -b "SOURCERER_TOKEN=$BACKEND_TOKEN" "http://127.0.0.1:$BACKEND_PORT/")"
  if [ "$status_yes" = "403" ]; then
    echo "side02-index-gated: FAIL -- SIDE-02 -- expected a non-403 for / with a valid token, still got 403" >&2
    result=1
  fi
  stop_backend
  return "$result"
}

# SIDE-01: the announced port must be bound to 127.0.0.1 only (never
# 0.0.0.0/[::]), and must be OS-assigned (port 0 requested), not the fixed
# stock default 3000.
check_side01_bind_scope() {
  if ! start_backend; then
    echo "side01-bind-scope: FAIL -- SIDE-01 -- backend never became ready, cannot inspect its bind scope" >&2
    stop_backend
    return 1
  fi
  local result=0 rows non_loopback_rows
  rows="$(ss -ltnH "sport = :$BACKEND_PORT" 2>/dev/null)"
  if [ -z "$rows" ]; then
    echo "side01-bind-scope: FAIL -- SIDE-01 -- ss found no listening socket on port $BACKEND_PORT" >&2
    result=1
  else
    non_loopback_rows="$(echo "$rows" | awk '{print $4}' | grep -vE '^127\.0\.0\.1:' || true)"
    if [ -n "$non_loopback_rows" ]; then
      echo "side01-bind-scope: FAIL -- SIDE-01 -- a listening row's local address is not 127.0.0.1:*: $non_loopback_rows" >&2
      result=1
    fi
    if echo "$rows" | awk '{print $4}' | grep -qE '^(0\.0\.0\.0:|\[::\]:)'; then
      echo "side01-bind-scope: FAIL -- SIDE-01 -- found a 0.0.0.0/[::] listening row: $rows" >&2
      result=1
    fi
  fi
  if [ "$BACKEND_PORT" = "3000" ]; then
    echo "side01-bind-scope: FAIL -- SIDE-01 -- announced port is the fixed default 3000, not OS-assigned" >&2
    result=1
  fi
  stop_backend
  return "$result"
}

# Each entry: "label|command...". Later tasks append here, never as a
# sibling driver script.
declare -a CHECKS=(
  "internals-boundary-self-test|bash $REPO_ROOT/scripts/check-internals-boundary.sh --self-test"
  "internals-boundary|bash $REPO_ROOT/scripts/check-internals-boundary.sh"
)

if [ "$QUICK" -eq 0 ]; then
  CHECKS+=(
    "side02-token-negative|check_side02_token_negative"
    "side02-token-positive|check_side02_token_positive"
    "side02-index-gated|check_side02_index_gated"
    "side01-bind-scope|check_side01_bind_scope"
  )
fi

FAILED=0
declare -a SUMMARY=()

for entry in "${CHECKS[@]}"; do
  label="${entry%%|*}"
  cmd="${entry#*|}"
  echo "verify-phase-04: running $label..."
  case "$cmd" in
    bash\ */*|node\ */*)
      setsid $cmd &
      CURRENT_CHECK_PID=$!
      if wait "$CURRENT_CHECK_PID"; then
        SUMMARY+=("$label: PASS")
      else
        SUMMARY+=("$label: FAIL")
        FAILED=1
      fi
      CURRENT_CHECK_PID=""
      ;;
    *)
      # Every entry reaching this branch must be a bare, argument-free
      # shell function name -- a command string with arguments needs its
      # own wrapper function instead (mirrors verify-phase-03.sh WR-02).
      if [[ "$cmd" == *[[:space:]]* ]]; then
        echo "verify-phase-04: FAIL -- check '$label' has a non-function-name command ('$cmd'); add a wrapper function instead" >&2
        SUMMARY+=("$label: FAIL")
        FAILED=1
      elif "$cmd"; then
        SUMMARY+=("$label: PASS")
      else
        SUMMARY+=("$label: FAIL")
        FAILED=1
      fi
      ;;
  esac
done

echo ""
echo "verify-phase-04: summary"
for line in "${SUMMARY[@]}"; do
  echo "  $line"
done

if [ "$FAILED" -eq 0 ]; then
  echo "verify-phase-04: PASS -- all checks passed"
  exit 0
else
  echo "verify-phase-04: FAIL -- see summary above" >&2
  exit 1
fi
