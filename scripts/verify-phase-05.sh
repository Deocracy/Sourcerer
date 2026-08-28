#!/usr/bin/env bash
# scripts/verify-phase-05.sh
#
# The single aggregator for every Phase 5 check, modelled on
# scripts/verify-phase-04.sh: unofficial-mode error handling (deliberately
# no `-e`, only `-u` and `pipefail` -- every check runs even if an earlier
# one failed), a CHECKS array later tasks append to rather than forking a
# sibling driver, and a per-check PASS/FAIL summary table with a non-zero
# exit if anything failed. One verification script per phase, extended
# never sibling'd (05-PATTERNS.md).
#
# `--quick` runs only checks needing no browser launch and no built tree.
# `--only <label>` runs exactly one named check and nothing else -- per-task
# sampling depends on it.
#
# Task 1 registers side04-sigkill-no-orphan and
# side04-unsupervised-backend-survives, both outside --quick (they launch
# the built objdir/dist/bin/sourcerer binary or spawn the Node backend
# directly). Task 2 appends side04-leftover-reaped and
# side04-stale-identity-not-signalled, also outside --quick.
#
# Every external script invocation runs under `setsid`, exactly like
# scripts/verify-phase-02.sh's/03.sh's/04.sh's own pattern: this script is
# non-interactive so job control is off, and a plain `cmd &` would share
# this script's own process group with every descendant a check
# backgrounds -- setsid makes the check the leader of its own new process
# group so `kill -- "-$PID"` on interrupt reaches the whole group in one
# signal.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

QUICK=0
ONLY=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --quick) QUICK=1; shift ;;
    --only)
      if [ "$#" -lt 2 ]; then
        echo "verify-phase-05: FAIL -- --only requires a label argument" >&2
        exit 1
      fi
      ONLY="$2"
      shift 2
      ;;
    *)
      echo "verify-phase-05: FAIL -- unknown argument '$1'" >&2
      exit 1
      ;;
  esac
done

CURRENT_CHECK_PID=""
BACKEND_SPAWN_PID=""
BROWSER_SPAWN_PID=""
declare -a TEMP_PATHS=()
track_temp() { TEMP_PATHS+=("$1"); }
cleanup() {
  if [ -n "$CURRENT_CHECK_PID" ]; then
    kill -- "-$CURRENT_CHECK_PID" 2>/dev/null || kill "$CURRENT_CHECK_PID" 2>/dev/null || true
    wait "$CURRENT_CHECK_PID" 2>/dev/null || true
    CURRENT_CHECK_PID=""
  fi
  if [ -n "$BACKEND_SPAWN_PID" ]; then
    kill -- "-$BACKEND_SPAWN_PID" 2>/dev/null || kill "$BACKEND_SPAWN_PID" 2>/dev/null || true
    wait "$BACKEND_SPAWN_PID" 2>/dev/null || true
    BACKEND_SPAWN_PID=""
  fi
  if [ -n "$BROWSER_SPAWN_PID" ]; then
    kill -- "-$BROWSER_SPAWN_PID" 2>/dev/null || kill "$BROWSER_SPAWN_PID" 2>/dev/null || true
    wait "$BROWSER_SPAWN_PID" 2>/dev/null || true
    BROWSER_SPAWN_PID=""
  fi
  # -rf (not -f): TEMP_PATHS also carries throwaway profile/config directories.
  for p in "${TEMP_PATHS[@]:-}"; do
    [ -n "$p" ] && rm -rf "$p"
  done
  TEMP_PATHS=()
}
# EXIT alone is not enough: bash resumes the rest of the script after a
# non-EXIT trap handler returns unless that handler exits itself
# (scripts/verify-phase-02.sh/03.sh/04.sh's own documented reason for
# splitting this into two traps).
trap cleanup EXIT
trap 'cleanup; exit 130' INT TERM

# --- shared helpers, ported from verify-phase-04.sh (one-self-contained-
# script-per-phase idiom -- never sourced from that file) ------------------

BROWSER_LOG=""

# Spawns the built binary headless with a throwaway profile, capturing its
# combined stdout+stderr to a track_temp-registered log file. Callers poll
# BROWSER_LOG for whatever sentinel they need; stop_shell() always tears the
# process (and setsid process group) down. A missing/non-executable binary
# is a named FAIL, not a skip.
start_shell() {
  local bin="$REPO_ROOT/objdir/dist/bin/sourcerer"
  if [ ! -x "$bin" ]; then
    echo "start_shell: FAIL -- $bin does not exist or is not executable (run the Phase 1 Firefox build first)" >&2
    return 1
  fi
  local log profile
  log="$(mktemp)"; track_temp "$log"
  profile="$(mktemp -d)"; track_temp "$profile"
  BROWSER_LOG="$log"

  local -a env_args=()
  if [ -n "${VERIFY05_XDG_CONFIG_HOME:-}" ]; then
    env_args+=(env "XDG_CONFIG_HOME=$VERIFY05_XDG_CONFIG_HOME")
  fi
  if [ -n "${VERIFY05_USER_JS_PROFILE:-}" ]; then
    mkdir -p "$profile"
    cp "$VERIFY05_USER_JS_PROFILE" "$profile/user.js"
  fi

  setsid "${env_args[@]}" "$bin" --headless --profile "$profile" >"$log" 2>&1 &
  BROWSER_SPAWN_PID=$!
  return 0
}

stop_shell() {
  if [ -n "$BROWSER_SPAWN_PID" ]; then
    kill -- "-$BROWSER_SPAWN_PID" 2>/dev/null || kill "$BROWSER_SPAWN_PID" 2>/dev/null || true
    wait "$BROWSER_SPAWN_PID" 2>/dev/null || true
    BROWSER_SPAWN_PID=""
  fi
}

# Byte offset (not line number) of the first line beginning with the given
# literal prefix, or empty if absent. Tolerates the SourcererAPI.log()
# mirror prefix "[SourcererAPI] <level>: " exactly like verify-phase-04.sh's
# own helper.
first_byte_offset() {
  grep -abom1 -E "^(\\[SourcererAPI\\] [a-z]+: )?$1" "$2" 2>/dev/null | cut -d: -f1
}

# True (exit 0) when <log> contains a line beginning with the literal
# prefix <1>, tolerating the same "[SourcererAPI] <level>: " mirror prefix
# first_byte_offset does.
sentinel_present() {
  grep -qE "^(\\[SourcererAPI\\] [a-z]+: )?$1" "$2" 2>/dev/null
}

# Every pid announced by a SOURCERER_BACKEND_READY sentinel in <log>, oldest
# first, one per line.
backend_ready_pids() {
  sed -E 's/^\[SourcererAPI\] [a-z]+: //' "$1" 2>/dev/null \
    | grep -E '^SOURCERER_BACKEND_READY ' \
    | sed -E 's/^SOURCERER_BACKEND_READY //' \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const l of s.split("\n")){if(!l.trim())continue;try{const j=JSON.parse(l);if(typeof j.pid==="number")console.log(j.pid)}catch{}}})' 2>/dev/null
}

# --- Task 1: side04-sigkill-no-orphan / side04-unsupervised-backend-survives

# Poll /proc/<pid>/status's State: line for up to 15s, treating Z (zombie)
# as "as good as gone" (05-RESEARCH.md Pitfall 3 -- a recently-SIGKILLed
# child that hasn't been reaped yet still answers a bare-existence check).
# Returns 0 once the pid is gone or zombied, 1 on timeout.
#
# Reaps <pid> the instant it goes zombie, IF this script happens to be its
# real parent (plant_leftover's own `setsid sleep ... &`) -- `wait` on an
# already-terminated child returns immediately rather than blocking, so
# this never stalls. Without this, D-125's own planted process would sit
# as an unreaped zombie until this script's unplant_leftover() finally
# calls `wait` at cleanup time, and kill(pid,0) (SourcererAPI.signalBarePid's
# liveness re-check, same zombie-blind gotcha) would see it as "still
# alive" from the browser's side for however long that takes -- exactly
# the false-alive race this helper exists to avoid. `wait` on a pid this
# script did NOT fork (the SIGKILL-orphan check's real backend pid, a
# grandchild of the killed browser) harmlessly fails with "not a child of
# this shell"; `|| true` absorbs that.
wait_pid_gone_or_zombie() {
  local pid="$1" deadline=$((SECONDS + 15)) state
  while [ "$SECONDS" -lt "$deadline" ]; do
    if [ ! -e "/proc/$pid" ]; then
      return 0
    fi
    state="$(awk '/^State:/{print $2}' "/proc/$pid/status" 2>/dev/null)"
    if [ "$state" = "Z" ] || [ -z "$state" ]; then
      wait "$pid" 2>/dev/null || true
      return 0
    fi
    sleep 0.5
  done
  return 1
}

# D-125's headline check (SIDE-04). Launches the shell, reads the announced
# backend pid from the sentinel, asserts it is ALIVE (never pass vacuously
# on a launch that silently failed), SIGKILLs the browser process ALONE
# (never its process group -- the backend is a member of that same group,
# so a group kill would make the assertion prove nothing), then asserts
# both that the announced pid disappears within a bounded poll and that no
# process whose command line contains the backend entry file remains.
check_side04_sigkill_no_orphan() {
  if ! start_shell; then
    echo "side04-sigkill-no-orphan: FAIL -- SIDE-04 -- could not launch the built binary" >&2
    return 1
  fi

  local deadline=$((SECONDS + 60))
  while [ "$SECONDS" -lt "$deadline" ]; do
    sentinel_present 'SOURCERER_BACKEND_READY ' "$BROWSER_LOG" && break
    if ! kill -0 "$BROWSER_SPAWN_PID" 2>/dev/null; then
      echo "side04-sigkill-no-orphan: FAIL -- SIDE-04 -- browser process exited before SOURCERER_BACKEND_READY appeared; log:" >&2
      cat "$BROWSER_LOG" >&2
      stop_shell
      return 1
    fi
    sleep 0.5
  done
  if ! sentinel_present 'SOURCERER_BACKEND_READY ' "$BROWSER_LOG"; then
    echo "side04-sigkill-no-orphan: FAIL -- SIDE-04 -- SOURCERER_BACKEND_READY did not appear within 60s; log:" >&2
    cat "$BROWSER_LOG" >&2
    stop_shell
    return 1
  fi

  local backend_pid
  backend_pid="$(backend_ready_pids "$BROWSER_LOG" | head -1)"
  if [ -z "$backend_pid" ]; then
    echo "side04-sigkill-no-orphan: FAIL -- SIDE-04 -- could not read a pid from SOURCERER_BACKEND_READY in the browser log" >&2
    stop_shell
    return 1
  fi

  # Must be alive BEFORE the kill, or "no orphan found" passes vacuously on
  # a launch that silently failed.
  if [ ! -e "/proc/$backend_pid" ]; then
    echo "side04-sigkill-no-orphan: FAIL -- SIDE-04 -- announced backend pid $backend_pid is not running before the kill; the check cannot prove anything" >&2
    stop_shell
    return 1
  fi

  local result=0

  # Signal the browser process alone. BROWSER_SPAWN_PID is the setsid
  # leader wrapping "$bin" directly (start_shell's exec chain has no
  # intermediate shell), so it IS the browser pid. Signal only that pid --
  # never "-$BROWSER_SPAWN_PID" (the process-group form) -- because the
  # backend is a member of the same setsid-created group and a group kill
  # would kill it directly, making the "the watchdog did it" assertion
  # vacuous.
  if ! kill -9 "$BROWSER_SPAWN_PID" 2>/dev/null; then
    echo "side04-sigkill-no-orphan: FAIL -- SIDE-04 -- could not SIGKILL the browser pid $BROWSER_SPAWN_PID" >&2
    result=1
  fi

  if ! wait_pid_gone_or_zombie "$backend_pid"; then
    echo "side04-sigkill-no-orphan: FAIL -- SIDE-04 -- backend pid $backend_pid was still alive 15s after SIGKILLing the browser alone" >&2
    result=1
  fi

  if pgrep -f 'backend/main\.js' >/dev/null 2>&1; then
    echo "side04-sigkill-no-orphan: FAIL -- SIDE-04 -- a process matching 'backend/main.js' is still running after the browser was SIGKILLed:" >&2
    pgrep -af 'backend/main\.js' >&2 || true
    result=1
  fi

  BROWSER_SPAWN_PID=""
  wait "$backend_pid" 2>/dev/null || true
  return "$result"
}

# D-109's negative control: a backend started directly (no supervisor, no
# SOURCERER_SUPERVISED marker) with stdin redirected from /dev/null must
# NOT self-terminate. Proves the watchdog cannot break yarn start,
# smoke-theia.sh, or verify-phase-04.sh's own start_backend.
check_side04_unsupervised_backend_survives() {
  local token log result=0
  token="$(node -e 'console.log(require("crypto").randomBytes(24).toString("hex"))')"
  log="$(mktemp)"; track_temp "$log"

  setsid env \
    SOURCERER_TOKEN="$token" \
    THEIA_CONFIG_DIR="$(mktemp -d)" \
    VSX_REGISTRY_URL="https://open-vsx.org" \
    nix develop "$REPO_ROOT#theia" --command \
    node "$REPO_ROOT/theia/applications/browser/lib/backend/main.js" --hostname 127.0.0.1 --port 0 \
    <"/dev/null" >"$log" 2>&1 &
  BACKEND_SPAWN_PID=$!

  sleep 3
  if ! kill -0 "$BACKEND_SPAWN_PID" 2>/dev/null; then
    echo "side04-unsupervised-backend-survives: FAIL -- SIDE-04 -- an unsupervised backend with /dev/null stdin exited within 3s; log:" >&2
    cat "$log" >&2
    result=1
  fi

  kill -- "-$BACKEND_SPAWN_PID" 2>/dev/null || kill "$BACKEND_SPAWN_PID" 2>/dev/null || true
  wait "$BACKEND_SPAWN_PID" 2>/dev/null || true
  BACKEND_SPAWN_PID=""
  return "$result"
}

# --- Task 2: side04-leftover-reaped / side04-stale-identity-not-signalled

# /proc/<pid>/stat field 22 (starttime), via the last-')'-then-split rule
# (05-RESEARCH.md Pattern 2 / Pitfall 2) -- must match TheiaService's own
# reader exactly, since the two are compared for exact string equality.
read_start_ticks() {
  awk '{
    line=$0
    idx=match(line, /\)[^)]*$/)
    rest=substr(line, idx+2)
    n=split(rest, f, " ")
    print f[20]
  }' "/proc/$1/stat" 2>/dev/null
}

# Plants a long-sleeping process under setsid and writes a state file into
# a throwaway config directory in the same JSON shape TheiaService writes
# (pid, port, startTicks, writtenAt). Sets PLANTED_PID/PLANTED_CONFIG_DIR/
# PLANTED_STATE_FILE for the caller.
PLANTED_PID=""
PLANTED_TICKS=""
PLANTED_CONFIG_DIR=""
PLANTED_STATE_FILE=""
plant_leftover() {
  local start_ticks="$1" # "" means read the real value; anything else overrides it (negative control)
  setsid sleep 300 &
  PLANTED_PID=$!
  # Let /proc/<pid>/stat settle before reading starttime.
  sleep 0.2

  local ticks
  if [ -n "$start_ticks" ]; then
    ticks="$start_ticks"
  else
    ticks="$(read_start_ticks "$PLANTED_PID")"
  fi
  PLANTED_TICKS="$ticks"

  local parent
  parent="$(mktemp -d)"; track_temp "$parent"
  PLANTED_CONFIG_DIR="$parent/sourcerer"
  mkdir -p "$PLANTED_CONFIG_DIR"
  PLANTED_STATE_FILE="$PLANTED_CONFIG_DIR/sidecar-state.json"

  node -e '
    const fs = require("fs");
    const [, path, pid, ticks] = process.argv;
    fs.writeFileSync(path, JSON.stringify({
      pid: Number(pid), port: 65000, startTicks: ticks, writtenAt: Date.now()
    }));
  ' "$PLANTED_STATE_FILE" "$PLANTED_PID" "$ticks"

  export VERIFY05_XDG_CONFIG_HOME="$parent"
}

unplant_leftover() {
  if [ -n "$PLANTED_PID" ]; then
    kill -9 "$PLANTED_PID" 2>/dev/null || true
    wait "$PLANTED_PID" 2>/dev/null || true
    PLANTED_PID=""
  fi
  PLANTED_TICKS=""
  unset VERIFY05_XDG_CONFIG_HOME
}

# D-125 positive control: a state file naming a real, verified-identity
# leftover must be reaped (SIGTERM'd and removed from the state file)
# before the next startup's first spawn.
check_side04_leftover_reaped() {
  plant_leftover ""
  local result=0

  if ! start_shell; then
    echo "side04-leftover-reaped: FAIL -- SIDE-04 -- could not launch the built binary" >&2
    unplant_leftover
    return 1
  fi

  if ! wait_pid_gone_or_zombie "$PLANTED_PID"; then
    echo "side04-leftover-reaped: FAIL -- SIDE-04 -- planted leftover pid $PLANTED_PID was still alive after startup; log:" >&2
    cat "$BROWSER_LOG" >&2
    result=1
  fi

  # Compare startTicks, not pid: by the time this runs, TheiaService's own
  # first spawn has already written a NEW state-file record for the real
  # backend it just started, and Linux is free to recycle the
  # just-vacated PLANTED_PID onto that very process -- a raw pid substring
  # match would then false-positive on a perfectly healthy, unrelated
  # record. startTicks is what actually distinguishes "the same process"
  # from "a different process that happens to share a pid number", and is
  # exactly the identity signal D-111 itself relies on.
  #
  # Bounded settle poll, not a point-in-time read: _reapLeftover's own
  # internal poll (checking liveness every 100ms) and this script's
  # wait_pid_gone_or_zombie poll (checking every 500ms) run independently,
  # so a single read taken the instant wait_pid_gone_or_zombie returns can
  # race the browser's own removeStateFile()/re-write still landing.
  local settle_deadline=$((SECONDS + 10)) current_ticks=""
  while [ "$SECONDS" -lt "$settle_deadline" ]; do
    if [ -e "$PLANTED_STATE_FILE" ]; then
      current_ticks="$(node -e '
        try {
          const j = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
          if (typeof j.startTicks === "string") process.stdout.write(j.startTicks);
        } catch {}
      ' "$PLANTED_STATE_FILE" 2>/dev/null)"
    else
      current_ticks=""
    fi
    [ "$current_ticks" != "$PLANTED_TICKS" ] && break
    sleep 0.3
  done
  if [ -n "$current_ticks" ] && [ "$current_ticks" = "$PLANTED_TICKS" ]; then
    echo "side04-leftover-reaped: FAIL -- SIDE-04 -- state file still records the reaped leftover's own start ticks ($PLANTED_TICKS) after startup" >&2
    result=1
  fi

  stop_shell
  unplant_leftover
  return "$result"
}

# D-125 negative control: a state file whose recorded start-time ticks do
# NOT match the live process's actual start-time must NEVER be signalled
# (the recycled-pid footgun, D-111) -- the planted process must still be
# alive, and the launch log must carry the mismatch line (so the check
# cannot pass merely because the shell never reached the reap decision).
check_side04_stale_identity_not_signalled() {
  plant_leftover "999999999"
  local result=0

  if ! start_shell; then
    echo "side04-stale-identity-not-signalled: FAIL -- SIDE-04 -- could not launch the built binary" >&2
    unplant_leftover
    return 1
  fi

  # Give startup's reap decision time to run before asserting.
  local deadline=$((SECONDS + 20))
  while [ "$SECONDS" -lt "$deadline" ]; do
    grep -qi 'startTicks' "$BROWSER_LOG" 2>/dev/null && break
    sentinel_present 'SOURCERER_BACKEND_READY ' "$BROWSER_LOG" && break
    sleep 0.5
  done

  if ! kill -0 "$PLANTED_PID" 2>/dev/null; then
    echo "side04-stale-identity-not-signalled: FAIL -- SIDE-04 -- planted process with a MISMATCHED recorded start time was signalled (it is no longer alive)" >&2
    result=1
  fi

  if ! grep -qi 'mismatch\|recycled\|stale' "$BROWSER_LOG" 2>/dev/null; then
    echo "side04-stale-identity-not-signalled: FAIL -- SIDE-04 -- launch log carries no mismatch line -- cannot confirm the reap decision was actually reached; log:" >&2
    cat "$BROWSER_LOG" >&2
    result=1
  fi

  stop_shell
  unplant_leftover
  return "$result"
}

# Each entry: "label|command...". Later tasks append here, never as a
# sibling driver script.
declare -a CHECKS=()

if [ "$QUICK" -eq 0 ]; then
  CHECKS+=(
    "side04-sigkill-no-orphan|check_side04_sigkill_no_orphan"
    "side04-unsupervised-backend-survives|check_side04_unsupervised_backend_survives"
    "side04-leftover-reaped|check_side04_leftover_reaped"
    "side04-stale-identity-not-signalled|check_side04_stale_identity_not_signalled"
  )
fi

if [ -n "$ONLY" ]; then
  declare -a FILTERED=()
  ONLY_FOUND=0
  for entry in "${CHECKS[@]}"; do
    label="${entry%%|*}"
    if [ "$label" = "$ONLY" ]; then
      FILTERED+=("$entry")
      ONLY_FOUND=1
    fi
  done
  if [ "$ONLY_FOUND" -eq 0 ]; then
    echo "verify-phase-05: FAIL -- unknown --only label '$ONLY'" >&2
    exit 1
  fi
  CHECKS=("${FILTERED[@]}")
fi

FAILED=0
declare -a SUMMARY=()

for entry in "${CHECKS[@]}"; do
  label="${entry%%|*}"
  cmd="${entry#*|}"
  echo "verify-phase-05: running $label..."
  # Every check here is a bare, argument-free shell function name -- the
  # function itself is responsible for using setsid on whatever it spawns
  # (start_shell/start_backend already do). setsid cannot exec a shell
  # function directly (it needs an executable file), so the function is
  # called directly, mirroring verify-phase-04.sh's own bare-function-name
  # branch.
  if [[ "$cmd" == *[[:space:]]* ]]; then
    echo "verify-phase-05: FAIL -- check '$label' has a non-function-name command ('$cmd'); add a wrapper function instead" >&2
    SUMMARY+=("$label: FAIL")
    FAILED=1
    continue
  fi
  if "$cmd"; then
    SUMMARY+=("$label: PASS")
  else
    SUMMARY+=("$label: FAIL")
    FAILED=1
  fi
done

echo ""
echo "verify-phase-05: summary"
for line in "${SUMMARY[@]}"; do
  echo "  $line"
done

if [ "$FAILED" -eq 0 ]; then
  echo "verify-phase-05: PASS -- all checks passed"
  exit 0
else
  echo "verify-phase-05: FAIL -- see summary above" >&2
  exit 1
fi
