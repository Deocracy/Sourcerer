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
declare -a TEMP_PATHS=()
track_temp() { TEMP_PATHS+=("$1"); }
cleanup() {
  if [ -n "$CURRENT_CHECK_PID" ]; then
    kill -- "-$CURRENT_CHECK_PID" 2>/dev/null || kill "$CURRENT_CHECK_PID" 2>/dev/null || true
    wait "$CURRENT_CHECK_PID" 2>/dev/null || true
    CURRENT_CHECK_PID=""
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

# Each entry: "label|command...". Later tasks append here, never as a
# sibling driver script.
declare -a CHECKS=(
  "internals-boundary-self-test|bash $REPO_ROOT/scripts/check-internals-boundary.sh --self-test"
  "internals-boundary|bash $REPO_ROOT/scripts/check-internals-boundary.sh"
)

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
