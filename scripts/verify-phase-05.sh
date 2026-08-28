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
GATE=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --quick) QUICK=1; shift ;;
    --gate) GATE=1; shift ;;
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

# --gate proves every phase gate green at one commit (D-127) -- it always
# runs this script's own FULL check set plus verify-phase-04.sh and
# verify-phase-03.sh in full. Combining it with --quick or --only would
# silently narrow "every phase gate" to a subset, contradicting the flag's
# own purpose, so the combination is a named, loud error rather than one
# flag winning silently.
if [ "$GATE" -eq 1 ] && { [ "$QUICK" -eq 1 ] || [ -n "$ONLY" ]; }; then
  echo "verify-phase-05: FAIL -- --gate cannot be combined with --quick or --only (rejected combination: --gate plus $([ "$QUICK" -eq 1 ] && echo -n '--quick'; [ "$QUICK" -eq 1 ] && [ -n "$ONLY" ] && echo -n ' and '; [ -n "$ONLY" ] && echo -n "--only $ONLY"))" >&2
  exit 1
fi

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
# Set by start_shell_display() to the DISPLAY value it actually used
# (existing $DISPLAY or a freshly-started Xvfb's), so a caller doing a
# manual second/third launch against the same display doesn't have to
# re-derive it.
DISPLAY_IN_USE=""

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

# --- Task 1 (05-02): harness-display-available -----------------------------
#
# Discriminator A (05-02-PLAN.md): a non-headless start_shell variant.
# gfxPlatform::IsHeadless() forces mDisableRemoteClient=true whenever
# MOZ_HEADLESS/--headless is set (05-RESEARCH.md Pitfall 1) -- start_shell()
# above launches headless, so it can never exercise a real paint or Firefox's
# native remoting protocol. This helper drops --headless and supplies a
# DISPLAY: an existing one first, else a freshly-started Xvfb on a free
# display number (resolved on demand via `nix build nixpkgs#xorg.xvfb` --
# none of this repo's dev shells carry an Xvfb binary, since neither the
# Theia nor the Firefox toolchain needs one). Returns 2 (distinct from every
# other helper's 1) specifically for "no display could be obtained at all",
# so the registered check can never silently skip or vacuously pass.
XVFB_SPAWN_PID=""
XVFB_DISPLAY_NUM=""

find_free_display_num() {
  local n
  for n in $(seq 90 199); do
    [ ! -e "/tmp/.X11-unix/X$n" ] && { echo "$n"; return 0; }
  done
  return 1
}

start_virtual_display() {
  local num
  num="$(find_free_display_num)" || return 2

  local xvfb_log
  xvfb_log="$(mktemp)"; track_temp "$xvfb_log"

  local xvfb_bin
  xvfb_bin="$(timeout 60 nix build --no-link --print-out-paths 'nixpkgs#xorg.xvfb' 2>>"$xvfb_log")/bin/Xvfb"
  if [ ! -x "$xvfb_bin" ]; then
    echo "start_virtual_display: FAIL -- Xvfb unavailable on this host (nix resolution failed); see $xvfb_log" >&2
    return 2
  fi

  setsid "$xvfb_bin" ":$num" -screen 0 1280x800x24 >"$xvfb_log" 2>&1 &
  XVFB_SPAWN_PID=$!

  local deadline=$((SECONDS + 10))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if [ -e "/tmp/.X11-unix/X$num" ]; then
      XVFB_DISPLAY_NUM="$num"
      return 0
    fi
    if ! kill -0 "$XVFB_SPAWN_PID" 2>/dev/null; then
      echo "start_virtual_display: FAIL -- Xvfb exited before creating its display socket; log:" >&2
      cat "$xvfb_log" >&2
      return 2
    fi
    sleep 0.2
  done
  echo "start_virtual_display: FAIL -- Xvfb did not create its display socket within 10s" >&2
  return 2
}

stop_virtual_display() {
  if [ -n "$XVFB_SPAWN_PID" ]; then
    kill -- "-$XVFB_SPAWN_PID" 2>/dev/null || kill "$XVFB_SPAWN_PID" 2>/dev/null || true
    wait "$XVFB_SPAWN_PID" 2>/dev/null || true
    XVFB_SPAWN_PID=""
  fi
  XVFB_DISPLAY_NUM=""
}

# The non-headless sibling of start_shell(): same log/profile capture and
# VERIFY05_USER_JS_PROFILE support, but launched against a real DISPLAY
# instead of --headless. Returns 1 for "binary missing" (matches
# start_shell()'s own convention) and 2 for "no display available at all"
# (start_virtual_display()'s propagated code) -- callers must not treat
# either as a skip.
#
# Optional $1: an explicit profile directory to launch against, instead of
# a fresh mktemp -d one. SIDE-05's second-launch checks need this -- two
# launches sharing the identical profile path is the entire mechanism
# under test (nsRemoteService keys remoting on the profile path,
# upstream/toolkit/xre/nsAppRunner.cpp:5342-5358), and the caller (not this
# helper) owns and track_temp's a profile that outlives any single launch.
start_shell_display() {
  local profile_override="${1:-}"
  local display_to_use=""
  if [ -n "${DISPLAY:-}" ]; then
    display_to_use="$DISPLAY"
  else
    start_virtual_display || return $?
    display_to_use=":$XVFB_DISPLAY_NUM"
  fi

  local bin="$REPO_ROOT/objdir/dist/bin/sourcerer"
  if [ ! -x "$bin" ]; then
    echo "start_shell_display: FAIL -- $bin does not exist or is not executable (run the Phase 1 Firefox build first)" >&2
    stop_virtual_display
    return 1
  fi
  local log profile
  log="$(mktemp)"; track_temp "$log"
  if [ -n "$profile_override" ]; then
    profile="$profile_override"
  else
    profile="$(mktemp -d)"; track_temp "$profile"
  fi
  BROWSER_LOG="$log"

  if [ -n "${VERIFY05_USER_JS_PROFILE:-}" ]; then
    mkdir -p "$profile"
    cp "$VERIFY05_USER_JS_PROFILE" "$profile/user.js"
  fi

  setsid env "DISPLAY=$display_to_use" "$bin" --profile "$profile" >"$log" 2>&1 &
  BROWSER_SPAWN_PID=$!
  DISPLAY_IN_USE="$display_to_use"
  return 0
}

stop_shell_display() {
  stop_shell
  stop_virtual_display
}

# Launches through start_shell_display(), asserts SOURCERER_SHELL_READY
# appears within a bounded poll, and stops it -- a display that cannot be
# obtained at all is a named FAIL (start_shell_display's propagated 1/2),
# never a skip and never a pass.
check_harness_display_available() {
  local rc
  start_shell_display
  rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "harness-display-available: FAIL -- SIDE-04 -- no usable display (neither an existing DISPLAY nor a resolvable Xvfb); see helper output above" >&2
    stop_shell_display
    return 1
  fi

  local deadline=$((SECONDS + 30))
  while [ "$SECONDS" -lt "$deadline" ]; do
    sentinel_present 'SOURCERER_SHELL_READY' "$BROWSER_LOG" && { stop_shell_display; return 0; }
    if ! kill -0 "$BROWSER_SPAWN_PID" 2>/dev/null; then
      echo "harness-display-available: FAIL -- browser process exited before SOURCERER_SHELL_READY appeared; log:" >&2
      cat "$BROWSER_LOG" >&2
      stop_shell_display
      return 1
    fi
    sleep 0.5
  done
  echo "harness-display-available: FAIL -- SOURCERER_SHELL_READY did not appear within 30s; log:" >&2
  cat "$BROWSER_LOG" >&2
  stop_shell_display
  return 1
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

# --- Task 3 (05-02): shell03-unrecoverable-immediate-error /
# shell03-budget-exhausted-error / shell03-auto-dismiss-on-selfheal --------
#
# All three drive the built binary headless via start_shell()/stop_shell()
# (Task 1's harness-display-available already proved --headless is not
# needed to exercise this chrome-JS-only surface -- no compositor/paint
# involvement, only stdout sentinels) with a VERIFY05_USER_JS_PROFILE
# forcing a fast give-up/recovery. A fourth check driving the Retry button
# itself does not exist: Task 1's Discriminator B (chrome-side Marionette
# automation) is blocked on Linux (moz:windowless is macOS-only --
# WINDOWS.md entry 7), so the Retry-button click is routed to the human
# record instead (05-02-SUMMARY.md), per the plan's own named fallback.

# D-125-style positive control: the unrecoverable case must show NO
# spawn-attempt-failure line at all, so this can never pass merely because
# the recoverable-failure detection also happens to fire zero times.
SPAWN_ATTEMPT_FAILURE_PATTERN='Backend output stream ended before announcing readiness|did not announce SOURCERER_BACKEND_READY within|Health probe on port .* never returned 200'

check_shell03_unrecoverable_immediate_error() {
  local user_js result=0
  user_js="$(mktemp)"; track_temp "$user_js"
  cat > "$user_js" <<'EOF'
user_pref("sourcerer.sidecar.backendMain", "/nonexistent/sourcerer-verify-05/main.js");
EOF

  export VERIFY05_USER_JS_PROFILE="$user_js"
  start_shell
  local start_rc=$?
  unset VERIFY05_USER_JS_PROFILE
  if [ "$start_rc" -ne 0 ]; then
    echo "shell03-unrecoverable-immediate-error: FAIL -- SHELL-03 -- could not launch the built binary" >&2
    return 1
  fi

  local deadline=$((SECONDS + 15))
  while [ "$SECONDS" -lt "$deadline" ]; do
    sentinel_present 'SOURCERER_SHELL_ERROR ' "$BROWSER_LOG" && break
    if ! kill -0 "$BROWSER_SPAWN_PID" 2>/dev/null; then
      echo "shell03-unrecoverable-immediate-error: FAIL -- SHELL-03 -- browser exited before the error sentinel appeared; log:" >&2
      cat "$BROWSER_LOG" >&2
      stop_shell
      return 1
    fi
    sleep 0.25
  done

  if ! sentinel_present 'SOURCERER_SHELL_ERROR ' "$BROWSER_LOG"; then
    echo "shell03-unrecoverable-immediate-error: FAIL -- SHELL-03 -- SOURCERER_SHELL_ERROR did not appear within 15s; log:" >&2
    cat "$BROWSER_LOG" >&2
    stop_shell
    return 1
  fi

  if sentinel_present 'SOURCERER_SHELL_SWAP ' "$BROWSER_LOG"; then
    echo "shell03-unrecoverable-immediate-error: FAIL -- SHELL-03 -- launch log carries a swap sentinel; an unrecoverable failure must never reach it" >&2
    result=1
  fi

  if grep -qE "$SPAWN_ATTEMPT_FAILURE_PATTERN" "$BROWSER_LOG"; then
    echo "shell03-unrecoverable-immediate-error: FAIL -- SHELL-03 -- launch log shows a spawn-attempt failure; an unrecoverable classification must give up before ever attempting a spawn" >&2
    cat "$BROWSER_LOG" >&2
    result=1
  fi

  stop_shell
  return "$result"
}

# D-113's recoverable-budget-exhausted path: a backend that fails every
# time it is spawned, under a lowered attempt cap, must produce EXACTLY
# that many respawn attempts before giving up -- neither fewer (budget not
# honoured) nor more (budget not enforced).
check_shell03_budget_exhausted_error() {
  local crasher_dir crasher user_js result=0
  crasher_dir="$(mktemp -d)"; track_temp "$crasher_dir"
  crasher="$crasher_dir/main.js"
  echo 'process.exit(1);' > "$crasher"

  user_js="$(mktemp)"; track_temp "$user_js"
  cat > "$user_js" <<EOF
user_pref("sourcerer.sidecar.backendMain", "$crasher");
user_pref("sourcerer.sidecar.giveUpAttempts", 2);
EOF

  export VERIFY05_USER_JS_PROFILE="$user_js"
  start_shell
  local start_rc=$?
  unset VERIFY05_USER_JS_PROFILE
  if [ "$start_rc" -ne 0 ]; then
    echo "shell03-budget-exhausted-error: FAIL -- SHELL-03 -- could not launch the built binary" >&2
    return 1
  fi

  local deadline=$((SECONDS + 30))
  while [ "$SECONDS" -lt "$deadline" ]; do
    sentinel_present 'SOURCERER_SHELL_ERROR ' "$BROWSER_LOG" && break
    if ! kill -0 "$BROWSER_SPAWN_PID" 2>/dev/null; then
      echo "shell03-budget-exhausted-error: FAIL -- SHELL-03 -- browser exited before the error sentinel appeared; log:" >&2
      cat "$BROWSER_LOG" >&2
      stop_shell
      return 1
    fi
    sleep 0.5
  done

  if ! sentinel_present 'SOURCERER_SHELL_ERROR ' "$BROWSER_LOG"; then
    echo "shell03-budget-exhausted-error: FAIL -- SHELL-03 -- SOURCERER_SHELL_ERROR did not appear within 30s; log:" >&2
    cat "$BROWSER_LOG" >&2
    stop_shell
    return 1
  fi

  # Every failed spawn attempt logs one "output stream ended" fatal line
  # via SourcererAPI.log(), which Firefox's own console mirror duplicates
  # onto a second stdout line (dump() + console.error(), the established
  # SourcererAPI.log() shape) -- divide by 2 for the true attempt count.
  local raw_lines attempt_count
  raw_lines="$(grep -cE "$SPAWN_ATTEMPT_FAILURE_PATTERN" "$BROWSER_LOG")"
  attempt_count=$((raw_lines / 2))
  if [ "$attempt_count" -ne 2 ]; then
    echo "shell03-budget-exhausted-error: FAIL -- SHELL-03 -- expected exactly 2 respawn attempts (giveUpAttempts=2), observed $attempt_count ($raw_lines raw log lines); log:" >&2
    cat "$BROWSER_LOG" >&2
    result=1
  fi

  # Exactly one error sentinel even though the give-up path here is
  # reached only once per launch -- guards _showError's _errorShown flag
  # against re-painting/re-emitting for the same state.
  local error_sentinel_count
  error_sentinel_count="$(grep -c 'SOURCERER_SHELL_ERROR ' "$BROWSER_LOG")"
  if [ "$error_sentinel_count" -ne 1 ]; then
    echo "shell03-budget-exhausted-error: FAIL -- SHELL-03 -- expected exactly one SOURCERER_SHELL_ERROR sentinel, found $error_sentinel_count" >&2
    result=1
  fi

  # The sentinel's JSON must carry only reason + classification -- never
  # the per-launch token or any other key.
  if ! grep -qE '^SOURCERER_SHELL_ERROR \{"reason":"[^"]*","recoverable":(true|false)\}$' "$BROWSER_LOG"; then
    echo "shell03-budget-exhausted-error: FAIL -- SHELL-03 -- SOURCERER_SHELL_ERROR sentinel JSON does not match the expected {reason, recoverable} shape" >&2
    result=1
  fi
  if grep 'SOURCERER_SHELL_ERROR ' "$BROWSER_LOG" | grep -qi 'SOURCERER_TOKEN'; then
    echo "shell03-budget-exhausted-error: FAIL -- SHELL-03 -- an error sentinel line mentions the token environment-variable name" >&2
    result=1
  fi

  stop_shell
  return "$result"
}

# D-115's auto-dismiss path, driven as a genuinely MID-SESSION outage (not
# a first-launch failure): the backend succeeds once (one swap sentinel),
# then crashes on its own a few seconds later; the health loop detects it,
# the single-attempt respawn budget is immediately exhausted (error shown),
# and the background recovery probe's next respawn succeeds -- clearing the
# error with no input ever sent to the window.
check_shell03_auto_dismiss_on_selfheal() {
  local wrap_dir marker real_main user_js result=0
  wrap_dir="$(mktemp -d)"; track_temp "$wrap_dir"
  marker="$wrap_dir/count"
  echo 0 > "$marker"
  real_main="$REPO_ROOT/theia/applications/browser/lib/backend/main.js"
  cat > "$wrap_dir/main.js" <<EOF
const fs = require('fs');
const marker = '$marker';
let n = parseInt(fs.readFileSync(marker, 'utf8'), 10);
n += 1;
fs.writeFileSync(marker, String(n));
// Attempt 1: start normally, then self-destruct a few seconds in --
// simulates a real mid-session crash of an already-healthy backend.
// Attempt 2 (the health loop's own single-budget respawn): crash
// immediately, forcing the give-up/error-shown path.
// Attempt 3+ (the recovery probe's respawn): succeed cleanly.
if (n === 2) {
  process.exit(1);
}
if (n === 1) {
  setTimeout(() => process.exit(1), 3000);
}
require('$real_main');
EOF

  user_js="$(mktemp)"; track_temp "$user_js"
  cat > "$user_js" <<EOF
user_pref("sourcerer.sidecar.backendMain", "$wrap_dir/main.js");
user_pref("sourcerer.sidecar.giveUpAttempts", 1);
user_pref("sourcerer.sidecar.healthIntervalSteadyMs", 1000);
user_pref("sourcerer.sidecar.recoveryProbeIntervalMs", 2000);
EOF

  export VERIFY05_USER_JS_PROFILE="$user_js"
  start_shell
  local start_rc=$?
  unset VERIFY05_USER_JS_PROFILE
  if [ "$start_rc" -ne 0 ]; then
    echo "shell03-auto-dismiss-on-selfheal: FAIL -- SHELL-03 -- could not launch the built binary" >&2
    return 1
  fi

  local deadline=$((SECONDS + 40))
  while [ "$SECONDS" -lt "$deadline" ]; do
    sentinel_present 'SOURCERER_SHELL_ERROR_CLEARED' "$BROWSER_LOG" && break
    if ! kill -0 "$BROWSER_SPAWN_PID" 2>/dev/null; then
      echo "shell03-auto-dismiss-on-selfheal: FAIL -- SHELL-03 -- browser exited before the cleared sentinel appeared; log:" >&2
      cat "$BROWSER_LOG" >&2
      stop_shell
      return 1
    fi
    sleep 0.5
  done

  if ! sentinel_present 'SOURCERER_SHELL_ERROR_CLEARED' "$BROWSER_LOG"; then
    echo "shell03-auto-dismiss-on-selfheal: FAIL -- SHELL-03 -- SOURCERER_SHELL_ERROR_CLEARED did not appear within 40s (no input was ever sent to the window); log:" >&2
    cat "$BROWSER_LOG" >&2
    stop_shell
    return 1
  fi

  if ! sentinel_present 'SOURCERER_SHELL_ERROR ' "$BROWSER_LOG"; then
    echo "shell03-auto-dismiss-on-selfheal: FAIL -- SHELL-03 -- cleared sentinel appeared without ever showing the error sentinel first -- this run proves nothing" >&2
    result=1
  fi

  # Mid-session invariant (D-114): the content browser's location never
  # changes while the error layer is visible -- exactly one swap sentinel
  # across the whole session (the original successful launch), never a
  # second one for the recovery.
  local swap_count
  swap_count="$(grep -c 'SOURCERER_SHELL_SWAP ' "$BROWSER_LOG")"
  if [ "$swap_count" -ne 1 ]; then
    echo "shell03-auto-dismiss-on-selfheal: FAIL -- SHELL-03 -- expected exactly one swap sentinel across the whole session, found $swap_count; log:" >&2
    cat "$BROWSER_LOG" >&2
    result=1
  fi

  stop_shell
  return "$result"
}

# --- Task 2 (05-03): shell04-diagnostics-with-backend-down -----------------
#
# SHELL-04's risky edge (this plan's flagged_assumption): the diagnostics
# surface must answer while the backend is dead, not just while it is
# healthy. Launches with backendMain pointed at a nonexistent path (same
# unrecoverable-immediate shape as shell03-unrecoverable-immediate-error --
# no backend spawn is ever attempted, so there is genuinely no backend at
# all), then asserts what this repo can automate without chrome-context
# driving:
#
#   1. The startup identity sentinel (SOURCERER_APP_IDENTITY) is present
#      with all three fields populated -- written unconditionally, right
#      after the sidecar prefs sentinel and BEFORE TheiaService.start(), so
#      it can never depend on a live backend. This is the fully-automated
#      half of "the surface is alive precisely when the backend is not."
#   2. The error layer's details control is present and enabled in the
#      shipped markup (sourcerer.xhtml has no `disabled` attribute on
#      #sourcerer-error-diagnostics) -- the plan's own named fallback for
#      when no chrome-context driver exists.
#
# What this check does NOT do, and why: opening the diagnostics layer
# itself (the chord, or clicking the Details control) is chrome-context
# automation, and Discriminator B (05-02-PLAN.md Task 1, WINDOWS.md #7)
# found that blocked on Linux -- capabilities.alwaysMatch['moz:windowless']
# is silently ignored outside AppInfo.isMac, so WebDriver:NewSession can
# never create a session against the shell's own windowtype="sourcerer:main"
# chrome window. scripts/lib/firefox-marionette.mjs does not exist (05-02
# confirmed it cannot). With no driver, this check cannot click the Details
# control or evaluate the show global, so it cannot produce a live
# SOURCERER_DIAGNOSTICS sentinel to read the rendered health/port/pid
# fields from. That gap is routed to the human record (05-03-SUMMARY.md),
# exactly as 05-02 routed the Retry-button click -- not fabricated as a
# pass.
check_shell04_diagnostics_with_backend_down() {
  local user_js result=0
  user_js="$(mktemp)"; track_temp "$user_js"
  cat > "$user_js" <<'EOF'
user_pref("sourcerer.sidecar.backendMain", "/nonexistent/sourcerer-verify-05/shell04-main.js");
EOF

  export VERIFY05_USER_JS_PROFILE="$user_js"
  start_shell
  local start_rc=$?
  unset VERIFY05_USER_JS_PROFILE
  if [ "$start_rc" -ne 0 ]; then
    echo "shell04-diagnostics-with-backend-down: FAIL -- SHELL-04 -- could not launch the built binary" >&2
    return 1
  fi

  local deadline=$((SECONDS + 15))
  while [ "$SECONDS" -lt "$deadline" ]; do
    sentinel_present 'SOURCERER_SHELL_ERROR ' "$BROWSER_LOG" && break
    if ! kill -0 "$BROWSER_SPAWN_PID" 2>/dev/null; then
      echo "shell04-diagnostics-with-backend-down: FAIL -- SHELL-04 -- browser exited before the error sentinel appeared; log:" >&2
      cat "$BROWSER_LOG" >&2
      stop_shell
      return 1
    fi
    sleep 0.25
  done

  if ! sentinel_present 'SOURCERER_SHELL_ERROR ' "$BROWSER_LOG"; then
    echo "shell04-diagnostics-with-backend-down: FAIL -- SHELL-04 -- SOURCERER_SHELL_ERROR did not appear within 15s (no backend was ever supposed to exist); log:" >&2
    cat "$BROWSER_LOG" >&2
    stop_shell
    return 1
  fi

  # There is genuinely no backend in this run -- confirm the unrecoverable
  # classification, so a later assertion can never be read as "it happened
  # to recover before we checked."
  if ! grep -qE '^(\[SourcererAPI\] [a-z]+: )?SOURCERER_SHELL_ERROR \{"reason":"[^"]*","recoverable":false\}$' "$BROWSER_LOG"; then
    echo "shell04-diagnostics-with-backend-down: FAIL -- SHELL-04 -- error sentinel is not classified recoverable:false; this run does not prove 'no backend at all'; log:" >&2
    cat "$BROWSER_LOG" >&2
    result=1
  fi

  # Identity half: alive independent of the backend, fully automated.
  local identity_line
  identity_line="$(grep -E '^(\[SourcererAPI\] [a-z]+: )?SOURCERER_APP_IDENTITY ' "$BROWSER_LOG" | head -1 | sed -E 's/^(\[SourcererAPI\] [a-z]+: )?SOURCERER_APP_IDENTITY //')"
  if [ -z "$identity_line" ]; then
    echo "shell04-diagnostics-with-backend-down: FAIL -- SHELL-04 -- no SOURCERER_APP_IDENTITY sentinel with the backend unreachable; log:" >&2
    cat "$BROWSER_LOG" >&2
    result=1
  elif ! node -e '
    let s = "";
    process.stdin.on("data", d => (s += d)).on("end", () => {
      let j;
      try { j = JSON.parse(s); } catch { process.exit(1); }
      if (typeof j.name === "string" && j.name && typeof j.vendor === "string" && j.vendor && typeof j.version === "string" && j.version) {
        process.exit(0);
      }
      process.exit(1);
    });
  ' <<<"$identity_line"; then
    echo "shell04-diagnostics-with-backend-down: FAIL -- SHELL-04 -- SOURCERER_APP_IDENTITY sentinel is not populated ($identity_line)" >&2
    result=1
  fi

  stop_shell

  # Fallback half (no chrome-context driver in this repo -- WINDOWS.md #7):
  # the details control is present and enabled in the shipped markup.
  local xhtml="$REPO_ROOT/sourcerer/shell/sourcerer.xhtml"
  if ! grep -q 'id="sourcerer-error-diagnostics"' "$xhtml"; then
    echo "shell04-diagnostics-with-backend-down: FAIL -- SHELL-04 -- #sourcerer-error-diagnostics is not present in sourcerer.xhtml" >&2
    result=1
  elif grep 'id="sourcerer-error-diagnostics"' "$xhtml" | grep -q 'disabled'; then
    echo "shell04-diagnostics-with-backend-down: FAIL -- SHELL-04 -- #sourcerer-error-diagnostics still carries a disabled attribute" >&2
    result=1
  fi

  echo "shell04-diagnostics-with-backend-down: NOTE -- chrome-context driving (the chord, the Details click, and reading the live SOURCERER_DIAGNOSTICS sentinel) is routed to the human record, per WINDOWS.md #7 / Discriminator B; see 05-03-SUMMARY.md" >&2

  return "$result"
}

# --- Task 2 (05-04): side05-second-launch-focuses / side05-no-second-backend
#
# SIDE-05: a second launch against the SAME profile must focus the already-
# open window (never a second one) and never spawn a second backend --
# never headless (05-RESEARCH.md Pitfall 1: gfxPlatform::IsHeadless()
# disables Firefox's native remoting protocol outright, the entire
# mechanism this requirement depends on), and both launches share one
# profile directory because nsRemoteService keys remoting on the profile
# path (upstream/toolkit/xre/nsAppRunner.cpp:5342-5358) -- two different
# profiles would never remote into each other and the check would prove
# nothing. Both checks assert the first launch actually reached readiness
# before drawing any conclusion, so neither can pass vacuously against a
# launch that silently failed.

# Launches the shell twice against ONE shared profile (bare, then with a
# file-path argument -- D-123/D-124's "arguments are ignored" truth), and
# asserts each time: the second process exits (never runs on as an
# independent instance), the first process is still running, and exactly
# one SOURCERER_SHELL_READY sentinel exists in the first process's own log
# (a second window opening would paint and announce its own readiness
# through the SAME process's stdout, since remoting delivers the second
# launch's command line into the first process in-process -- never a
# second OS process's own separate log).
check_side05_second_launch_focuses() {
  local bin profile result=0
  bin="$REPO_ROOT/objdir/dist/bin/sourcerer"
  if [ ! -x "$bin" ]; then
    echo "side05-second-launch-focuses: FAIL -- SIDE-05 -- $bin does not exist or is not executable (run the Phase 1 Firefox build first)" >&2
    return 1
  fi

  profile="$(mktemp -d)"; track_temp "$profile"

  local rc
  start_shell_display "$profile"
  rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "side05-second-launch-focuses: FAIL -- SIDE-05 -- could not launch the first instance (no usable display or missing binary)" >&2
    return "$rc"
  fi
  local first_log="$BROWSER_LOG"
  local first_pid="$BROWSER_SPAWN_PID"
  local display_to_use="$DISPLAY_IN_USE"

  local deadline=$((SECONDS + 60))
  while [ "$SECONDS" -lt "$deadline" ]; do
    sentinel_present 'SOURCERER_BACKEND_READY ' "$first_log" && break
    if ! kill -0 "$first_pid" 2>/dev/null; then
      echo "side05-second-launch-focuses: FAIL -- SIDE-05 -- first launch exited before SOURCERER_BACKEND_READY appeared; log:" >&2
      cat "$first_log" >&2
      stop_shell_display
      return 1
    fi
    sleep 0.5
  done
  if ! sentinel_present 'SOURCERER_BACKEND_READY ' "$first_log"; then
    echo "side05-second-launch-focuses: FAIL -- SIDE-05 -- SOURCERER_BACKEND_READY did not appear within 60s; log:" >&2
    cat "$first_log" >&2
    stop_shell_display
    return 1
  fi

  local round arg_path
  arg_path="$profile/side05-argument-does-not-matter.txt"
  for round in bare argument; do
    local second_log second_rc
    second_log="$(mktemp)"; track_temp "$second_log"

    if [ "$round" = "bare" ]; then
      timeout 30 env "DISPLAY=$display_to_use" "$bin" --profile "$profile" >"$second_log" 2>&1
    else
      timeout 30 env "DISPLAY=$display_to_use" "$bin" --profile "$profile" "$arg_path" >"$second_log" 2>&1
    fi
    second_rc=$?

    if [ "$second_rc" -eq 124 ]; then
      echo "side05-second-launch-focuses: FAIL -- SIDE-05 -- second launch ($round) against the same profile did not exit within 30s -- ran on as an independent instance; log:" >&2
      cat "$second_log" >&2
      result=1
    fi

    if ! kill -0 "$first_pid" 2>/dev/null; then
      echo "side05-second-launch-focuses: FAIL -- SIDE-05 -- first instance is no longer running after the second launch ($round)" >&2
      result=1
    fi

    local ready_count
    ready_count="$(grep -c 'SOURCERER_SHELL_READY' "$first_log")"
    if [ "$ready_count" -ne 1 ]; then
      echo "side05-second-launch-focuses: FAIL -- SIDE-05 -- expected exactly one SOURCERER_SHELL_READY in the first process's log after the second launch ($round), found $ready_count -- a second window opened; log:" >&2
      cat "$first_log" >&2
      result=1
    fi
  done

  stop_shell_display
  return "$result"
}

# D-125's invariant assertion, paired with its own positive control. Does
# its own two-launch-same-profile session (not a reuse of the previous
# check's state -- --only must be able to run this alone) and asserts:
# exactly one SOURCERER_BACKEND_READY sentinel across both launches, the
# announced backend pid unchanged, and exactly one live process matching
# 'backend/main.js'. Then a THIRD launch against a DIFFERENT profile must
# start its own window and its own backend -- proving the guard is scoped
# to the profile, not simply "second launches never work at all."
check_side05_no_second_backend() {
  local bin profile result=0
  bin="$REPO_ROOT/objdir/dist/bin/sourcerer"
  if [ ! -x "$bin" ]; then
    echo "side05-no-second-backend: FAIL -- SIDE-05 -- $bin does not exist or is not executable (run the Phase 1 Firefox build first)" >&2
    return 1
  fi

  profile="$(mktemp -d)"; track_temp "$profile"

  local rc
  start_shell_display "$profile"
  rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "side05-no-second-backend: FAIL -- SIDE-05 -- could not launch the first instance (no usable display or missing binary)" >&2
    return "$rc"
  fi
  local first_log="$BROWSER_LOG"
  local first_pid="$BROWSER_SPAWN_PID"
  local display_to_use="$DISPLAY_IN_USE"

  local deadline=$((SECONDS + 60))
  while [ "$SECONDS" -lt "$deadline" ]; do
    sentinel_present 'SOURCERER_BACKEND_READY ' "$first_log" && break
    if ! kill -0 "$first_pid" 2>/dev/null; then
      echo "side05-no-second-backend: FAIL -- SIDE-05 -- first launch exited before SOURCERER_BACKEND_READY appeared; log:" >&2
      cat "$first_log" >&2
      stop_shell_display
      return 1
    fi
    sleep 0.5
  done
  if ! sentinel_present 'SOURCERER_BACKEND_READY ' "$first_log"; then
    echo "side05-no-second-backend: FAIL -- SIDE-05 -- SOURCERER_BACKEND_READY did not appear within 60s; log:" >&2
    cat "$first_log" >&2
    stop_shell_display
    return 1
  fi

  local first_backend_pid
  first_backend_pid="$(backend_ready_pids "$first_log" | head -1)"
  if [ -z "$first_backend_pid" ]; then
    echo "side05-no-second-backend: FAIL -- SIDE-05 -- could not read a pid from SOURCERER_BACKEND_READY in the first process's log" >&2
    stop_shell_display
    return 1
  fi

  local second_log second_rc
  second_log="$(mktemp)"; track_temp "$second_log"
  timeout 30 env "DISPLAY=$display_to_use" "$bin" --profile "$profile" >"$second_log" 2>&1
  second_rc=$?
  if [ "$second_rc" -eq 124 ]; then
    echo "side05-no-second-backend: FAIL -- SIDE-05 -- second launch against the same profile did not exit within 30s; log:" >&2
    cat "$second_log" >&2
    result=1
  fi

  local ready_pids_after ready_count
  ready_pids_after="$(backend_ready_pids "$first_log")"
  ready_count="$(printf '%s\n' "$ready_pids_after" | grep -c .)"
  if [ "$ready_count" -ne 1 ]; then
    echo "side05-no-second-backend: FAIL -- SIDE-05 -- expected exactly one SOURCERER_BACKEND_READY sentinel across both launches, found $ready_count; log:" >&2
    cat "$first_log" >&2
    result=1
  fi
  if [ "$(printf '%s\n' "$ready_pids_after" | head -1)" != "$first_backend_pid" ]; then
    echo "side05-no-second-backend: FAIL -- SIDE-05 -- announced backend pid changed across the session (was $first_backend_pid)" >&2
    result=1
  fi

  local backend_proc_count
  backend_proc_count="$(pgrep -fc 'backend/main\.js' 2>/dev/null || echo 0)"
  if [ "$backend_proc_count" -ne 1 ]; then
    echo "side05-no-second-backend: FAIL -- SIDE-05 -- expected exactly one process matching 'backend/main.js' while the session is up, found $backend_proc_count:" >&2
    pgrep -af 'backend/main\.js' >&2 || true
    result=1
  fi

  stop_shell_display

  # D-125's positive control: a DIFFERENT profile must get its own window
  # and its own backend.
  local control_profile
  control_profile="$(mktemp -d)"; track_temp "$control_profile"
  start_shell_display "$control_profile"
  local control_rc=$?
  if [ "$control_rc" -ne 0 ]; then
    echo "side05-no-second-backend: FAIL -- SIDE-05 -- positive control (different profile) could not launch" >&2
    return 1
  fi
  local control_log="$BROWSER_LOG"
  local control_pid="$BROWSER_SPAWN_PID"

  local control_deadline=$((SECONDS + 60))
  while [ "$SECONDS" -lt "$control_deadline" ]; do
    sentinel_present 'SOURCERER_BACKEND_READY ' "$control_log" && break
    if ! kill -0 "$control_pid" 2>/dev/null; then
      echo "side05-no-second-backend: FAIL -- SIDE-05 -- positive control exited before SOURCERER_BACKEND_READY appeared; log:" >&2
      cat "$control_log" >&2
      stop_shell_display
      return 1
    fi
    sleep 0.5
  done
  if ! sentinel_present 'SOURCERER_BACKEND_READY ' "$control_log"; then
    echo "side05-no-second-backend: FAIL -- SIDE-05 -- positive control (different profile) never announced its own backend -- the guard is not profile-scoped, it broke second launches globally; log:" >&2
    cat "$control_log" >&2
    result=1
  else
    local control_backend_pid
    control_backend_pid="$(backend_ready_pids "$control_log" | head -1)"
    if [ -z "$control_backend_pid" ] || [ "$control_backend_pid" = "$first_backend_pid" ]; then
      echo "side05-no-second-backend: FAIL -- SIDE-05 -- positive control did not announce a distinct backend pid of its own ($control_backend_pid)" >&2
      result=1
    fi
  fi

  stop_shell_display
  return "$result"
}

# Runs this script's own CHECKS (respecting QUICK/ONLY exactly as before),
# prints the per-check PASS/FAIL summary table, and RETURNS (not exits) the
# aggregate result -- factored out of the former top-level script body so
# --gate mode (below) can call it as "this phase's own section" without a
# second process. Normal (non-gate) invocation calls this once and exits on
# its return value, unchanged from the prior behaviour.
run_own_checks() {
  # Each entry: "label|command...". Later tasks append here, never as a
  # sibling driver script.
  local -a CHECKS=()

  if [ "$QUICK" -eq 0 ]; then
    CHECKS+=(
      "side04-sigkill-no-orphan|check_side04_sigkill_no_orphan"
      "side04-unsupervised-backend-survives|check_side04_unsupervised_backend_survives"
      "side04-leftover-reaped|check_side04_leftover_reaped"
      "side04-stale-identity-not-signalled|check_side04_stale_identity_not_signalled"
      "harness-display-available|check_harness_display_available"
      "shell03-unrecoverable-immediate-error|check_shell03_unrecoverable_immediate_error"
      "shell03-budget-exhausted-error|check_shell03_budget_exhausted_error"
      "shell03-auto-dismiss-on-selfheal|check_shell03_auto_dismiss_on_selfheal"
      "shell04-diagnostics-with-backend-down|check_shell04_diagnostics_with_backend_down"
      "side05-second-launch-focuses|check_side05_second_launch_focuses"
      "side05-no-second-backend|check_side05_no_second_backend"
    )
  fi

  if [ -n "$ONLY" ]; then
    local -a FILTERED=()
    local ONLY_FOUND=0
    for entry in "${CHECKS[@]}"; do
      local label="${entry%%|*}"
      if [ "$label" = "$ONLY" ]; then
        FILTERED+=("$entry")
        ONLY_FOUND=1
      fi
    done
    if [ "$ONLY_FOUND" -eq 0 ]; then
      echo "verify-phase-05: FAIL -- unknown --only label '$ONLY'" >&2
      return 1
    fi
    CHECKS=("${FILTERED[@]}")
  fi

  local FAILED=0
  local -a SUMMARY=()

  for entry in "${CHECKS[@]}"; do
    local label="${entry%%|*}"
    local cmd="${entry#*|}"
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
    return 0
  else
    echo "verify-phase-05: FAIL -- see summary above" >&2
    return 1
  fi
}

# --- --gate mode (D-127, 05-05-PLAN.md Task 1) ------------------------------
#
# Reads the broken-windows ledger's own JSON block (the fenced array at the
# bottom of .planning/WINDOWS.md -- the markdown table above it is the
# human-readable mirror of the same data, not a second source of truth) and
# prints the named entry's current status. Exits 2 (distinct from 0/1, never
# treated as a plain pass/fail) if the ledger or the entry cannot be read at
# all, so a malformed/missing ledger can never be silently read as "open".
ledger_entry_status() {
  local id="$1"
  local windows_md="$REPO_ROOT/.planning/WINDOWS.md"
  node -e '
    const fs = require("fs");
    const path = process.argv[1];
    const id = Number(process.argv[2]);
    let text;
    try { text = fs.readFileSync(path, "utf8"); } catch { process.exit(2); }
    const m = text.match(/````json\n([\s\S]*?)\n````/);
    if (!m) { process.exit(2); }
    let arr;
    try { arr = JSON.parse(m[1]); } catch { process.exit(2); }
    const entry = arr.find((e) => e.id === id);
    if (!entry || typeof entry.status !== "string") { process.exit(2); }
    process.stdout.write(entry.status);
  ' "$windows_md" "$id"
}

# True (exit 0) only when ledger entry <id> is still status "open". A
# "fixed" or "waived" entry (or an unreadable ledger) returns false -- the
# exclusion this backs must stop applying the instant the entry stops being
# open, per D-127's own recorded guard.
ledger_entry_is_open() {
  local id="$1" status
  status="$(ledger_entry_status "$id")" || return 1
  [ "$status" = "open" ]
}

# Replaces 05-VALIDATION.md's placeholder "Estimated runtime" table cell
# with the just-measured --gate wall time, and flips the frontmatter's
# status/wave_0_complete flags to reflect that the script has landed and is
# exercised on every --gate run. nyquist_compliant is deliberately left
# alone (stays false) -- one check runs under a named known-open exclusion
# and Task 2's human items are unsigned, so "finished" here means "the
# validation document reflects reality", not "fully compliant"; matches
# 04-VALIDATION.md's identical honest-PARTIAL precedent.
write_gate_runtime_to_validation() {
  local elapsed="$1"
  local validation_md="$REPO_ROOT/.planning/phases/05-lifecycle-failure-hardening/05-VALIDATION.md"
  node -e '
    const fs = require("fs");
    const path = process.argv[1];
    const elapsed = process.argv[2];
    let text = fs.readFileSync(path, "utf8");
    text = text.replace(
      /(\| \*\*Estimated runtime\*\* \| ).*?( \|)/,
      `$1~${elapsed}s, measured live by --gate$2`
    );
    text = text.replace(/^status: draft$/m, "status: validated");
    text = text.replace(/^wave_0_complete: false$/m, "wave_0_complete: true");
    fs.writeFileSync(path, text);
  ' "$validation_md" "$elapsed"
}

# Runs an external phase script (verify-phase-04.sh / verify-phase-03.sh)
# to completion under setsid (same process-group discipline every other
# external invocation in this file already uses), capturing its combined
# output to a track_temp-registered log and its exit status. Prints the
# captured output so a human reading --gate's own output sees exactly what
# that script printed, not a paraphrase.
GATE_LAST_LOG=""
GATE_LAST_RC=0
run_external_phase_script() {
  local script_path="$1"
  local log
  log="$(mktemp)"; track_temp "$log"
  setsid bash "$script_path" >"$log" 2>&1 &
  CURRENT_CHECK_PID=$!
  local rc=0
  wait "$CURRENT_CHECK_PID" || rc=$?
  CURRENT_CHECK_PID=""
  cat "$log"
  GATE_LAST_LOG="$log"
  GATE_LAST_RC="$rc"
}

# Failing-check labels are read off the target script's OWN printed summary
# lines ("  <label>: FAIL") rather than by re-deriving or re-running
# anything -- exactly the "extract, don't reimplement" instruction the plan
# gives.
extract_failed_labels() {
  grep -E '^  [A-Za-z0-9_.-]+: FAIL$' "$1" | sed -E 's/^  ([A-Za-z0-9_.-]+): FAIL$/\1/'
}

# The known-open exclusion list (D-127): exactly one entry today. Keyed on
# the broken-windows ledger id, never on a bare assertion -- see
# ledger_entry_is_open above. label|ledger_id|reason
declare -a GATE_KNOWN_OPEN_EXCLUSIONS=(
  "verify-endpoints|5|Gecko resolves 3 hosts absent from the BRAND-04 allowlist once the shell actually works (127.0.0.1 the Theia sidecar, ciscobinary.openh264.org the GMP manager, github.com the Theia frontend) -- not a code defect, needs a product/privacy decision this phase's scope explicitly excludes (05-CONTEXT.md <deferred>)"
)

run_gate_mode() {
  local gate_start="$SECONDS"
  local commit
  commit="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo "unknown")"
  echo "verify-phase-05: --gate -- commit $commit"
  echo "verify-phase-05: --gate -- proving verify-phase-05.sh + verify-phase-04.sh + verify-phase-03.sh all green at this one commit (D-127)"
  echo ""

  local overall_failed=0

  echo "=== Section 1/3: verify-phase-05.sh (this script's own full check set) ==="
  local phase5_rc=0
  run_own_checks || phase5_rc=$?
  if [ "$phase5_rc" -ne 0 ]; then
    overall_failed=1
    echo "--- Phase 5 section: FAIL ---"
  else
    echo "--- Phase 5 section: PASS ---"
  fi
  echo ""

  echo "=== Section 2/3: scripts/verify-phase-04.sh (full run) ==="
  run_external_phase_script "$REPO_ROOT/scripts/verify-phase-04.sh"
  local phase4_log="$GATE_LAST_LOG" phase4_rc="$GATE_LAST_RC"
  if [ "$phase4_rc" -ne 0 ]; then
    overall_failed=1
    echo "--- Phase 4 section: FAIL -- failing checks:"
    extract_failed_labels "$phase4_log" | sed 's/^/    /'
    echo "--- Phase 4 section: FAIL ---"
  else
    echo "--- Phase 4 section: PASS ---"
  fi
  echo ""

  echo "=== Section 3/3: scripts/verify-phase-03.sh (full run) ==="
  run_external_phase_script "$REPO_ROOT/scripts/verify-phase-03.sh"
  local phase3_log="$GATE_LAST_LOG" phase3_rc="$GATE_LAST_RC"
  local phase3_section_failed=0
  local excluded_count=0
  if [ "$phase3_rc" -ne 0 ]; then
    while IFS= read -r label; do
      [ -z "$label" ] && continue
      local excused=0
      local matched_known_exclusion=0
      local excl_entry
      for excl_entry in "${GATE_KNOWN_OPEN_EXCLUSIONS[@]}"; do
        local excl_label="${excl_entry%%|*}"
        local rest="${excl_entry#*|}"
        local excl_ledger_id="${rest%%|*}"
        local excl_reason="${rest#*|}"
        if [ "$label" = "$excl_label" ]; then
          matched_known_exclusion=1
          if ledger_entry_is_open "$excl_ledger_id"; then
            echo "  EXCLUDED (known-open): $label -- WINDOWS.md ledger entry $excl_ledger_id -- $excl_reason"
            excused=1
            excluded_count=$((excluded_count + 1))
          else
            echo "  FAIL (exclusion no longer applies): $label -- WINDOWS.md ledger entry $excl_ledger_id is no longer 'open' (fixed or waived); this check must be green now, not silently excused" >&2
            phase3_section_failed=1
          fi
          break
        fi
      done
      if [ "$excused" -ne 1 ] && [ "$matched_known_exclusion" -ne 1 ]; then
        echo "  FAIL (not excluded): $label" >&2
        phase3_section_failed=1
      fi
    done < <(extract_failed_labels "$phase3_log")
  fi
  if [ "$phase3_section_failed" -eq 1 ]; then
    overall_failed=1
    echo "--- Phase 3 section: FAIL ---"
  elif [ "$phase3_rc" -ne 0 ] && [ "$excluded_count" -gt 0 ]; then
    echo "--- Phase 3 section: PASS-WITH-EXCLUSIONS ($excluded_count named known-open exclusion(s)) ---"
  else
    echo "--- Phase 3 section: PASS ---"
  fi
  echo ""

  local gate_elapsed=$((SECONDS - gate_start))
  echo "verify-phase-05: --gate -- total runtime ${gate_elapsed}s"

  if [ "$overall_failed" -eq 0 ]; then
    echo "verify-phase-05: --gate PASS -- commit $commit -- every phase gate is green at this commit"
    write_gate_runtime_to_validation "$gate_elapsed"
    return 0
  else
    echo "verify-phase-05: --gate FAIL -- commit $commit -- see section output above" >&2
    return 1
  fi
}

if [ "$GATE" -eq 1 ]; then
  run_gate_mode
  exit $?
else
  run_own_checks
  exit $?
fi
