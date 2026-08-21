#!/usr/bin/env bash
# scripts/verify-endpoints.sh
#
# D-88: BRAND-04's two negative assertions ("updates disabled", "no
# unlisted endpoint contacted") get three proof layers, each with a working
# positive control that has been observed going red -- a negative check
# without a demonstrated-red positive control proves nothing (Phase 2's own
# lesson, restated for this phase).
#
#   Layer 1 -- static prefs. Reads the effective installed default-pref
#     value for every key in sourcerer/endpoint-allowlist.json's `prefs`
#     array (greprefs.js, then browser/defaults/preferences/firefox.js, then
#     .../firefox-branding.js, later file wins) and compares to `expect`. A
#     pref that cannot be found at all is a FAILURE, not a skip.
#   Layer 2 -- filesystem, exact-path strace (BRAND-03). A bare `.mozilla`
#     substring match would false-fail a correct build: nsXREDirProvider.cpp
#     hardcodes a `.mozilla` path COMPONENT on every build (the parent of the
#     extensions/compat-mode directory), which is why layer 2 asserts a
#     positive `.mozilla` observation AND a negative exact-prefix
#     `$HOME/.mozilla/firefox` match, never a bare substring.
#   Layer 3 -- network, host resolution via MOZ_LOG=nsHostResolver:5. Reads
#     `<MOZ_LOG_FILE>.moz_log` and its `.child-N` siblings (Logging.cpp
#     appends `.moz_log`; GeckoChildProcessHost.cpp appends `.child-N` per
#     content process -- a literal $MOZ_LOG_FILE read finds nothing).
#     Extracts hostnames only from the anchored `Resolving host [...]`
#     pattern (nsHostResolver.cpp:455) -- an unanchored whole-log grep also
#     matches zero-network-activity names (the TRR URI, the confirmation NS,
#     localhost) that a real 35s run emits even with TRR disabled, which
#     would corrupt the allowlist with hosts that never had real traffic.
#     Matching is exact-host, or a suffix match only when the allowlist
#     entry begins with a literal dot -- a host that merely contains an
#     allowlisted string does not match.
#
# `--layer 1|2|3` runs one layer; no flag runs all three. `--positive-control`
# runs each selected layer's control instead of its assertion and exits 0
# only if the control went red. Idempotent: a fresh mktemp -d log directory
# per run, removed on exit; no layer mutates or deletes anything under the
# developer's real $HOME except the sandboxed layer-2 control, which never
# touches the real ~/.mozilla tree.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$REPO_ROOT/objdir/dist/bin"
BIN_PATH="$BIN_DIR/sourcerer"
ALLOWLIST="$REPO_ROOT/sourcerer/endpoint-allowlist.json"
BRANDING_PREF_FILE="$BIN_DIR/browser/defaults/preferences/firefox-branding.js"

HELP="Usage: verify-endpoints.sh [--layer 1|2|3] [--positive-control] [--help]

Runs BRAND-04's three endpoint/telemetry proof layers against the built
binary. No flag runs all three layers' real assertions.

  --layer 1|2|3       Run only the named layer
  --positive-control  Run the selected layer(s)' positive control instead of
                       their real assertion; exits 0 only if the control(s)
                       correctly went red
  --help              Print this message and exit 0
"

LAYER_ARG=""
DO_CONTROL=0

args=("$@")
i=0
while [ "$i" -lt "${#args[@]}" ]; do
  arg="${args[$i]}"
  case "$arg" in
    --layer)
      i=$((i + 1))
      LAYER_ARG="${args[$i]:-}"
      case "$LAYER_ARG" in
        1|2|3) ;;
        *)
          echo "verify-endpoints: FAIL -- --layer requires 1, 2, or 3" >&2
          exit 1
          ;;
      esac
      ;;
    --positive-control) DO_CONTROL=1 ;;
    --help)
      echo "$HELP"
      exit 0
      ;;
    *)
      echo "verify-endpoints: FAIL -- unknown argument '$arg'" >&2
      exit 1
      ;;
  esac
  i=$((i + 1))
done

# ---------------------------------------------------------------------------
# Process/temp-file hygiene, shared by every layer. Split trap: EXIT alone is
# not enough -- bash resumes the rest of the script after a non-EXIT trap
# handler returns unless that handler exits itself (scripts/verify-phase-02.sh
# lines 50-58, quoted in 03-PATTERNS.md).
# ---------------------------------------------------------------------------
ACTIVE_PID=""
declare -a TEMP_PATHS=()

cleanup() {
  if [ -n "$ACTIVE_PID" ]; then
    kill "$ACTIVE_PID" 2>/dev/null || true
    wait "$ACTIVE_PID" 2>/dev/null || true
    ACTIVE_PID=""
  fi
  local p
  for p in "${TEMP_PATHS[@]:-}"; do
    [ -n "$p" ] && [ -e "$p" ] && find "$p" -delete 2>/dev/null
  done
  TEMP_PATHS=()
}
trap cleanup EXIT
trap 'cleanup; exit 130' INT TERM

track_temp() { TEMP_PATHS+=("$1"); }

# ---------------------------------------------------------------------------
# Layer 1 -- static prefs
# ---------------------------------------------------------------------------
layer1_check() {
  node -e '
    const fs = require("fs");
    const path = require("path");
    const [, binDir, allowlistPath] = process.argv;
    const allow = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
    const files = [
      path.join(binDir, "greprefs.js"),
      path.join(binDir, "browser", "defaults", "preferences", "firefox.js"),
      path.join(binDir, "browser", "defaults", "preferences", "firefox-branding.js"),
    ];
    const prefRe = /pref\(\s*"([^"]+)"\s*,\s*(.+?)\s*(?:,\s*[A-Za-z_][A-Za-z0-9_]*\s*)?\)\s*;/g;
    const values = new Map();
    for (const file of files) {
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, "utf8");
      let m;
      prefRe.lastIndex = 0;
      while ((m = prefRe.exec(text))) values.set(m[1], m[2]);
    }
    function parseRaw(raw) {
      if (raw === "true") return true;
      if (raw === "false") return false;
      if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
      if (raw.startsWith("\"") && raw.endsWith("\"")) {
        try { return JSON.parse(raw); } catch { return raw; }
      }
      return raw;
    }
    let failures = 0;
    for (const p of allow.prefs) {
      const raw = values.get(p.name);
      if (raw === undefined) {
        console.error(`  FAIL ${p.name} -- pref not found in any installed pref file (${p.reason})`);
        failures++;
        continue;
      }
      const actual = parseRaw(raw);
      if (actual !== p.expect) {
        console.error(`  FAIL ${p.name} -- actual=${JSON.stringify(actual)} expected=${JSON.stringify(p.expect)} (${p.reason})`);
        failures++;
      } else {
        console.log(`  PASS ${p.name}`);
      }
    }
    process.exit(failures > 0 ? 1 : 0);
  ' "$BIN_DIR" "$ALLOWLIST"
}

run_layer1() {
  echo "verify-endpoints: layer 1 (static prefs)..."
  if layer1_check; then
    echo "verify-endpoints: layer 1 PASS"
    return 0
  fi
  echo "verify-endpoints: layer 1 FAIL -- see pref mismatch(es) above" >&2
  return 1
}

run_layer1_control() {
  echo "verify-endpoints: layer 1 positive control..."
  if [ ! -f "$BRANDING_PREF_FILE" ]; then
    echo "verify-endpoints: layer 1 positive control FAIL -- $BRANDING_PREF_FILE does not exist" >&2
    return 1
  fi
  local backup
  backup="$(mktemp)"
  cp "$BRANDING_PREF_FILE" "$backup"
  # Restore even on failure -- this is the whole point of the control.
  # firefox-branding.js is the unpreprocessed JS_PREFERENCE_FILES branch
  # (branding-common.mozbuild), read directly at browser startup with no
  # `mach build` step in between -- appending to it and immediately
  # re-running layer1_check is sufficient, no rebuild required.
  cat >> "$BRANDING_PREF_FILE" <<'PREFEOF'

pref("media.gmp-manager.url", "https://aus5.mozilla.org/update/3/GMP/%VERSION%/%BUILD_ID%/%BUILD_TARGET%/%LOCALE%/%CHANNEL%/%OS_VERSION%/%DISTRIBUTION%/%DISTRIBUTION_VERSION%/update.xml");
PREFEOF

  local rc=0
  layer1_check >/dev/null 2>&1 || rc=1

  cp "$backup" "$BRANDING_PREF_FILE"
  rm -f "$backup"

  if [ "$rc" -ne 0 ]; then
    echo "verify-endpoints: layer 1 positive control PASS -- restoring the stock media.gmp-manager.url correctly went red"
    return 0
  fi
  echo "verify-endpoints: layer 1 positive control FAIL -- restoring the stock URL did NOT go red" >&2
  return 1
}

# ---------------------------------------------------------------------------
# Layer 2 -- filesystem, exact-path strace (BRAND-03)
# ---------------------------------------------------------------------------
run_layer2_impl() {
  local control="$1"
  local home_for_run="$HOME"
  local extra_args=()
  local sandbox=""

  if [ "$control" -eq 1 ]; then
    sandbox="$(mktemp -d)"
    track_temp "$sandbox"
    mkdir -p "$sandbox/.mozilla/firefox/control-profile"
    home_for_run="$sandbox"
    extra_args=(--profile "$sandbox/.mozilla/firefox/control-profile")
  fi

  local log shot
  log="$(mktemp)"
  track_temp "$log"
  shot="$(mktemp)"
  track_temp "$shot"

  HOME="$home_for_run" strace -f -e trace=openat,open,stat,access -o "$log" \
    "$BIN_PATH" --headless "${extra_args[@]}" --screenshot "$shot" about:blank >/dev/null 2>&1 || true

  if [ ! -s "$log" ]; then
    echo "verify-endpoints: layer 2 FAIL -- strace log is empty; the check never ran" >&2
    return 1
  fi

  local mozilla_count exact_count
  mozilla_count="$(grep -cF '.mozilla' "$log" || true)"
  exact_count="$(grep -cF "\"$home_for_run/.mozilla/firefox" "$log" || true)"

  if [ "$control" -eq 1 ]; then
    if [ "$exact_count" -gt 0 ]; then
      echo "verify-endpoints: layer 2 positive control PASS -- sandboxed \$HOME/.mozilla/firefox path was correctly observed ($exact_count access(es))"
      return 0
    fi
    echo "verify-endpoints: layer 2 positive control FAIL -- sandboxed \$HOME/.mozilla/firefox path was NOT observed" >&2
    return 1
  fi

  if [ "$mozilla_count" -eq 0 ]; then
    echo "verify-endpoints: layer 2 FAIL -- zero .mozilla path components observed; the check did not capture real filesystem activity" >&2
    return 1
  fi
  if [ "$exact_count" -gt 0 ]; then
    echo "verify-endpoints: layer 2 FAIL -- $exact_count access(es) to \$HOME/.mozilla/firefox (real Firefox's profile tree)" >&2
    return 1
  fi
  echo "verify-endpoints: layer 2 PASS -- .mozilla path component observed ($mozilla_count line(s)), zero touches to \$HOME/.mozilla/firefox"
  return 0
}

run_layer2() {
  echo "verify-endpoints: layer 2 (filesystem, strace)..."
  run_layer2_impl 0
}

run_layer2_control() {
  echo "verify-endpoints: layer 2 positive control..."
  run_layer2_impl 1
}

# ---------------------------------------------------------------------------
# Layer 3 -- network, host resolution
# ---------------------------------------------------------------------------
allowlist_host_allowed() {
  node -e '
    const fs = require("fs");
    const [, host, allowlistPath] = process.argv;
    const allow = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
    const match = allow.hosts.find(h => {
      if (h.host === host) return true;
      if (h.host.startsWith(".") && host.endsWith(h.host)) return true;
      return false;
    });
    process.exit(match && match.disposition === "allow" ? 0 : 1);
  ' "$1" "$ALLOWLIST"
}

run_layer3_impl() {
  local control="$1"
  local backup=""

  if [ "$control" -eq 1 ]; then
    backup="$(mktemp)"
    cp "$BRANDING_PREF_FILE" "$backup"
    cat >> "$BRANDING_PREF_FILE" <<'PREFEOF'

pref("media.gmp-gmpopenh264.enabled", true);
PREFEOF
  fi

  local log_base profile_dir
  log_base="$(mktemp -u "${TMPDIR:-/tmp}/sourcerer-hostresolver-XXXXXX")"
  profile_dir="$(mktemp -d)"
  track_temp "$profile_dir"

  MOZ_LOG=nsHostResolver:5 MOZ_LOG_FILE="$log_base" \
    "$BIN_PATH" --headless --profile "$profile_dir" "https://firefox.settings.services.mozilla.com/" &
  ACTIVE_PID=$!
  sleep 20
  kill "$ACTIVE_PID" 2>/dev/null || true
  wait "$ACTIVE_PID" 2>/dev/null || true
  ACTIVE_PID=""

  local extracted
  extracted="$(cat "${log_base}.moz_log" "${log_base}.moz_log.child-"* 2>/dev/null \
    | grep -oE 'Resolving host \[[^]]+\]' \
    | sed -E 's/Resolving host \[([^]]+)\]/\1/' \
    | sort -u)"

  rm -f "${log_base}.moz_log" "${log_base}.moz_log.child-"* 2>/dev/null

  if [ "$control" -eq 1 ]; then
    cp "$backup" "$BRANDING_PREF_FILE"
    rm -f "$backup"
  fi

  if [ -z "$extracted" ]; then
    echo "verify-endpoints: layer 3 FAIL -- empty extracted host set; the check never ran" >&2
    return 1
  fi

  # Positive observation: a controlled probe, not a count. Zero-network
  # nsHostResolver activity (TRR URI, confirmation NS, localhost) is emitted
  # even on a run with no real traffic, so an "at least one hostname" gate
  # would pass vacuously if the capture silently broke. The URL navigated to
  # above is a deliberately allowlisted host; require it specifically.
  if ! grep -qxF "firefox.settings.services.mozilla.com" <<< "$extracted"; then
    echo "verify-endpoints: layer 3 FAIL -- controlled probe host firefox.settings.services.mozilla.com never resolved (capture may be broken)" >&2
    return 1
  fi

  local violations=""
  while IFS= read -r host; do
    [ -z "$host" ] && continue
    if ! allowlist_host_allowed "$host"; then
      violations="${violations}${host}"$'\n'
    fi
  done <<< "$extracted"

  if [ "$control" -eq 1 ]; then
    if [ -n "$violations" ]; then
      echo "verify-endpoints: layer 3 positive control PASS -- re-enabling OpenH264 correctly surfaced a violation"
      return 0
    fi
    echo "verify-endpoints: layer 3 positive control FAIL -- re-enabling OpenH264 did NOT surface a violation" >&2
    return 1
  fi

  if [ -n "$violations" ]; then
    echo "verify-endpoints: layer 3 FAIL -- unlisted or denied host(s) resolved:" >&2
    sort -u <<< "$violations" | sed '/^$/d;s/^/  /' >&2
    return 1
  fi
  echo "verify-endpoints: layer 3 PASS -- all resolved hosts are allowlisted"
  return 0
}

run_layer3() {
  echo "verify-endpoints: layer 3 (network, MOZ_LOG)..."
  run_layer3_impl 0
}

run_layer3_control() {
  echo "verify-endpoints: layer 3 positive control..."
  run_layer3_impl 1
}

# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------
LAYERS_TO_RUN=(1 2 3)
if [ -n "$LAYER_ARG" ]; then
  LAYERS_TO_RUN=("$LAYER_ARG")
fi

FAILED=0
for layer in "${LAYERS_TO_RUN[@]}"; do
  if [ "$DO_CONTROL" -eq 1 ]; then
    case "$layer" in
      1) run_layer1_control || FAILED=1 ;;
      2) run_layer2_control || FAILED=1 ;;
      3) run_layer3_control || FAILED=1 ;;
    esac
  else
    case "$layer" in
      1) run_layer1 || FAILED=1 ;;
      2) run_layer2 || FAILED=1 ;;
      3) run_layer3 || FAILED=1 ;;
    esac
  fi
done

if [ "$FAILED" -eq 0 ]; then
  echo "verify-endpoints: PASS"
  exit 0
else
  echo "verify-endpoints: FAIL -- see above" >&2
  exit 1
fi
