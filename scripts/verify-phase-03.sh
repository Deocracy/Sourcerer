#!/usr/bin/env bash
# scripts/verify-phase-03.sh
#
# The single aggregator for every Phase 3 check, modelled on
# scripts/verify-phase-02.sh: set -uo pipefail (deliberately not -e -- every
# check runs even if an earlier one failed), a CHECKS list later plans
# append to rather than forking a sibling driver, and a per-check PASS/FAIL
# summary table with a non-zero exit if anything failed.
#
# `--quick` runs only the checks that need no browser launch: the patch
# surface guard, its self-test, the apply-patches self-test, the allowlist
# schema check, and the .desktop/config.status string equalities (BRAND-01
# surface 5, duplicated here in miniature rather than invoking
# verify-branding-identity.mjs's full six-surface run, since that run's
# about-support surface launches a real browser session -- exactly what
# --quick exists to avoid). No flag runs everything, including
# verify-branding-identity.mjs and verify-endpoints.sh.
#
# verify-endpoints.sh's layers 2 and 3 background a `sourcerer` process of
# their own (with their own split trap). Every external-script check runs
# under `setsid`, exactly like scripts/verify-phase-02.sh's own SERVER_PID
# pattern: since this script is non-interactive, job control is off and a
# plain `cmd &` would share THIS script's own process group with every
# descendant, including the browser verify-endpoints.sh backgrounds two
# layers deep -- killing only the immediate child PID on interrupt would
# leave that browser (and its content processes) orphaned, reparented and
# still running, because killing a parent process does not kill its
# children. `setsid` makes the external check the leader of its own new
# process group (PGID == its own PID), so `kill -- "-$PID"` on interrupt
# reaches the whole group -- the check script itself and everything it
# spawned -- in one signal, the same idiom verify-phase-02.sh's cleanup()
# already uses for its own backgrounded dev server.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

QUICK=0
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=1 ;;
    *)
      echo "verify-phase-03: FAIL -- unknown argument '$arg'" >&2
      exit 1
      ;;
  esac
done

CURRENT_CHECK_PID=""
cleanup() {
  if [ -n "$CURRENT_CHECK_PID" ]; then
    kill -- "-$CURRENT_CHECK_PID" 2>/dev/null || kill "$CURRENT_CHECK_PID" 2>/dev/null || true
    wait "$CURRENT_CHECK_PID" 2>/dev/null || true
    CURRENT_CHECK_PID=""
  fi
}
# EXIT alone is not enough: bash resumes the rest of the script after a
# non-EXIT trap handler returns unless that handler exits itself
# (scripts/verify-phase-02.sh lines 50-58, quoted in 03-PATTERNS.md).
trap cleanup EXIT
trap 'cleanup; exit 130' INT TERM

# --- --quick's standalone .desktop/config.status equality check ---
check_desktop_entry_quick() {
  node -e '
    const fs = require("fs");
    const path = require("path");
    const repoRoot = process.argv[1];
    const desktopPath = path.join(repoRoot, "sourcerer", "sourcerer.desktop");
    const configStatusPath = path.join(repoRoot, "objdir", "config.status");

    if (!fs.existsSync(desktopPath)) {
      console.error(`check-desktop-entry-quick: FAIL -- ${desktopPath} does not exist`);
      process.exit(1);
    }
    if (!fs.existsSync(configStatusPath)) {
      console.error(`check-desktop-entry-quick: FAIL -- ${configStatusPath} does not exist`);
      process.exit(1);
    }

    const configText = fs.readFileSync(configStatusPath, "utf8");
    function readVar(name) {
      const re = new RegExp("\x27" + name + "\x27:\\s*\x27([^\x27]*)\x27");
      const m = configText.match(re);
      return m ? m[1] : undefined;
    }
    const expectedName = readVar("MOZ_APP_DISPLAYNAME");
    const expectedWmClass = readVar("MOZ_APP_REMOTINGNAME");

    const lines = fs.readFileSync(desktopPath, "utf8").split(/\r?\n/);
    const nameLine = lines.find(l => l.startsWith("Name="));
    const wmClassLine = lines.find(l => l.startsWith("StartupWMClass="));
    const name = nameLine !== undefined ? nameLine.slice("Name=".length) : undefined;
    const wmClass = wmClassLine !== undefined ? wmClassLine.slice("StartupWMClass=".length) : undefined;

    if (expectedName && expectedWmClass && name === expectedName && wmClass === expectedWmClass) {
      console.log(`check-desktop-entry-quick: PASS -- Name=${name}, StartupWMClass=${wmClass}`);
      process.exit(0);
    }
    console.error(`check-desktop-entry-quick: FAIL -- Name=${JSON.stringify(name)} (expected ${JSON.stringify(expectedName)}), StartupWMClass=${JSON.stringify(wmClass)} (expected ${JSON.stringify(expectedWmClass)})`);
    process.exit(1);
  ' "$REPO_ROOT"
}

# --- the allowlist schema check ---
check_allowlist_schema() {
  node -e '
    const fs = require("fs");
    const allowlistPath = process.argv[1];
    if (!fs.existsSync(allowlistPath)) {
      console.error(`allowlist-schema: FAIL -- ${allowlistPath} does not exist`);
      process.exit(1);
    }
    const a = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
    if (!Array.isArray(a.hosts) || !Array.isArray(a.prefs)) {
      console.error("allowlist-schema: FAIL -- hosts/prefs are not both arrays");
      process.exit(1);
    }
    for (const h of a.hosts) {
      if (!h.host || !["allow", "deny"].includes(h.disposition) || !h.reason) {
        console.error(`allowlist-schema: FAIL -- malformed host entry: ${JSON.stringify(h)}`);
        process.exit(1);
      }
    }
    for (const p of a.prefs) {
      if (!p.name || p.expect === undefined || !p.reason) {
        console.error(`allowlist-schema: FAIL -- malformed pref entry: ${JSON.stringify(p)}`);
        process.exit(1);
      }
    }
    console.log(`allowlist-schema: PASS -- ${a.hosts.length} host(s), ${a.prefs.length} pref(s)`);
  ' "$REPO_ROOT/sourcerer/endpoint-allowlist.json"
}

# Each entry: "label|command...". Later plans append here, not as a sibling
# driver script.
declare -a CHECKS=(
  "check-patch-surface|bash $REPO_ROOT/scripts/check-patch-surface.sh"
  "check-patch-surface-self-test|bash $REPO_ROOT/scripts/check-patch-surface.sh --self-test"
  "apply-patches-self-test|bash $REPO_ROOT/scripts/apply-patches.sh --self-test"
  "fetch-upstream-self-test|bash $REPO_ROOT/scripts/fetch-upstream.sh --self-test"
  "allowlist-schema|check_allowlist_schema"
)

if [ "$QUICK" -eq 1 ]; then
  CHECKS+=("desktop-entry-quick|check_desktop_entry_quick")
else
  CHECKS+=(
    "verify-branding-identity-dev|node $REPO_ROOT/scripts/verify-branding-identity.mjs"
    "verify-branding-identity-release|node $REPO_ROOT/scripts/verify-branding-identity.mjs --variant release"
    "verify-branding-identity-brand-ftl-control|node $REPO_ROOT/scripts/verify-branding-identity.mjs --variant release --positive-control brand-full-name"
    "verify-endpoints|bash $REPO_ROOT/scripts/verify-endpoints.sh"
  )
fi

FAILED=0
declare -a SUMMARY=()

for entry in "${CHECKS[@]}"; do
  label="${entry%%|*}"
  cmd="${entry#*|}"
  echo "verify-phase-03: running $label..."
  # External bash/node script invocations get their own process group via
  # setsid, so an interrupt's group-kill in cleanup() can reach whatever
  # they background (verify-endpoints.sh's own sourcerer child, two layers
  # deep). Plain function calls (allowlist-schema, desktop-entry-quick) are
  # synchronous, spawn no children of their own, and run inline -- no
  # process-group indirection needed or possible for a shell function.
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
      if eval "$cmd"; then
        SUMMARY+=("$label: PASS")
      else
        SUMMARY+=("$label: FAIL")
        FAILED=1
      fi
      ;;
  esac
done

echo ""
echo "verify-phase-03: summary"
for line in "${SUMMARY[@]}"; do
  echo "  $line"
done

if [ "$FAILED" -eq 0 ]; then
  echo "verify-phase-03: PASS -- all checks passed"
  exit 0
else
  echo "verify-phase-03: FAIL -- see summary above" >&2
  exit 1
fi
