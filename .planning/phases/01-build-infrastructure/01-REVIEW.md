---
phase: 01-build-infrastructure
reviewed: 2026-08-20T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - flake.nix
  - flake.lock
  - .mozconfig
  - .envrc
  - .gitignore
  - scripts/fetch-upstream.sh
  - scripts/smoke-theia.sh
  - scripts/smoke-firefox.sh
  - scripts/toolchain-baseline.sh
  - toolchain-baseline.txt
  - theia/package.json
  - theia/applications/browser/package.json
  - docs/BUILD.md
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-08-20
**Depth:** standard
**Files Reviewed:** 13 (flake.nix, flake.lock, .mozconfig, .envrc, .gitignore, scripts/fetch-upstream.sh, scripts/smoke-theia.sh, scripts/smoke-firefox.sh, scripts/toolchain-baseline.sh, toolchain-baseline.txt, theia/package.json, theia/applications/browser/package.json, docs/BUILD.md)
**Status:** issues_found

## Summary

The shell scripts are generally well-quoted and use `set -euo pipefail` correctly throughout. The Nix flake's two nontrivial pieces (`stdenv` override for the `firefox` shell, the `AS`/`LD`/etc. unset) are both correct usages backed by detailed inline rationale, and match the real build behavior recorded in the plan summaries. `fetch-upstream.sh`'s commit-SHA-comparison logic correctly solves the `_RELEASE`/`_BUILD1` tag-collision problem it documents.

The one real defect (`smoke-theia.sh`'s server cleanup) is a genuine correctness bug that can cause the smoke gate to silently pass against a stale, orphaned backend rather than the build it just produced — which is the exact "does it prove the real thing or pass vacuously" failure mode this review was asked to hunt for. The rest are gaps against the stated design intent (D-02's reproducibility guarantee, D-09's transitive drift protection) that are low-probability in practice but worth closing before Phase 3 builds on top of them.

## Critical Issues

### CR-01: `smoke-theia.sh` can leave an orphaned backend bound to port 3000, causing a later run to pass against stale state instead of the build under test

**File:** `scripts/smoke-theia.sh:76-95`
**Issue:** The server is started and tracked like this:

```bash
nix develop "$REPO_ROOT#theia" --command yarn --cwd applications/browser start &
SERVER_PID=$!
...
cleanup() { if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" ...; fi }
trap cleanup EXIT
```

`$!` captures the PID of the `nix develop` invocation. Even where `nix develop --command` execs directly into `yarn`, Yarn Classic does not exec-replace itself when running a package script — it forks a child (`sh -c 'theia start'`, then Theia's own backend process) and waits on it, so `theia start`'s actual Node backend is a **grandchild**, not the tracked PID. `kill "$SERVER_PID"` sends `SIGTERM` to yarn only; it is not guaranteed to reach the backend process actually holding port 3000. If the script is killed abnormally (Ctrl-C, CI timeout, an earlier `exit 1` before the trap is even registered doesn't apply here, but any signal that bypasses normal trap delivery does), or if yarn simply doesn't forward the signal to its child before the trap's `wait` gives up, the backend can survive the script as an orphan still bound to `:3000`.

The consequence is worse than a stray process: the **next** run of `smoke-theia.sh` starts a fresh build, launches a fresh server, and polls `curl -sf http://localhost:3000` — but if the old orphan is still listening, `curl` will get a 200 from the *previous* run's stale server almost immediately, and the script will print `PASS` without ever having proven the current build boots. This is precisely a vacuous-pass risk in the one check (D-2 in `01-02-SUMMARY.md`) that's supposed to prove the app actually serves a fresh, working build.

**Fix:** Track and kill the whole process group, and fail fast if the port is already bound before starting (catches leftovers from any prior failed run rather than silently reusing them):

```bash
if curl -sf http://localhost:3000 >/dev/null 2>&1; then
  echo "smoke-theia: FAIL -- something is already listening on :3000 (stale run?). Kill it and re-run." >&2
  exit 1
fi

SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill -- "-$SERVER_PID" 2>/dev/null || kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

setsid nix develop "$REPO_ROOT#theia" --command yarn --cwd applications/browser start &
SERVER_PID=$!
```

`setsid` puts the whole `nix develop -> yarn -> theia start` tree in its own process group; `kill -- "-$SERVER_PID"` signals that entire group instead of just the tracked PID.

## Warnings

### WR-01: `fetch-upstream.sh` treats a dirty `upstream/` as "already correct" — no working-tree cleanliness check

**File:** `scripts/fetch-upstream.sh:13-29`
**Issue:** The re-run path only compares `git rev-parse HEAD` against the pinned tag's resolved commit:

```bash
HEAD_SHA="$(git -C "$UPSTREAM_DIR" rev-parse HEAD 2>/dev/null || true)"
TAG_SHA="$(git -C "$UPSTREAM_DIR" rev-parse "refs/tags/$TAG^{commit}" 2>/dev/null || true)"
if [ -n "$HEAD_SHA" ] && [ "$HEAD_SHA" = "$TAG_SHA" ]; then
  echo "fetch-upstream: upstream/ already at $TAG, nothing to do"
  exit 0
fi
```

`HEAD` matching the tag says nothing about the working tree. If a developer (or a future Phase 3 patch-apply step gone wrong) leaves uncommitted local edits in `upstream/`, this script reports "nothing to do" and a subsequent `./mach build` / `./mach configure` silently builds against modified source. This directly undercuts D-02's stated purpose — "reproducibility is bought instead by a content-addressed pin... which fails loudly on byte drift rather than silently accepting it" — for the one case (local edits) content-addressing by commit hash alone can't catch. This is also explicitly one of the two re-runnability scenarios this review was asked to verify ("Does it handle... a dirty `upstream/`?"), and the answer is no.

**Fix:** Add a cleanliness check before declaring success:

```bash
if [ -n "$HEAD_SHA" ] && [ "$HEAD_SHA" = "$TAG_SHA" ]; then
  if [ -n "$(git -C "$UPSTREAM_DIR" status --porcelain)" ]; then
    echo "fetch-upstream: FAIL -- upstream/ is at $TAG but has local modifications (git status --porcelain is non-empty)" >&2
    exit 1
  fi
  echo "fetch-upstream: upstream/ already at $TAG, nothing to do"
  exit 0
fi
```

### WR-02: `fetch-upstream.sh`'s failure message on a broken/partial `upstream/` gives no remediation step

**File:** `scripts/fetch-upstream.sh:27-28`
**Issue:** If `upstream/` exists but isn't a valid git checkout (e.g. an interrupted `git clone` killed by SIGINT before it finished, leaving a directory with no resolvable `HEAD`), both `HEAD_SHA` and `TAG_SHA` resolve to empty strings via the `|| true` guards, and the script falls through to:

```bash
echo "fetch-upstream: FAIL -- upstream/ exists but HEAD ($HEAD_SHA) is not $TAG ($TAG_SHA)" >&2
exit 1
```

This fails loudly (correct instinct, consistent with the project's stated philosophy), but it doesn't tell the operator what to do next, and for the empty-HEAD case the message ("HEAD () is not TAG (...)") reads like a version mismatch rather than "this checkout is broken and needs to be removed." D-04 frames materialization as "one documented command" — the failure path is effectively undocumented.

**Fix:** Distinguish the two cases and name the fix in the message, e.g.:

```bash
if [ -z "$HEAD_SHA" ]; then
  echo "fetch-upstream: FAIL -- upstream/ exists but is not a valid git checkout (partial/interrupted clone?). Remove it and re-run: rm -rf '$UPSTREAM_DIR'" >&2
else
  echo "fetch-upstream: FAIL -- upstream/ exists but HEAD ($HEAD_SHA) is not $TAG ($TAG_SHA). Remove it and re-run: rm -rf '$UPSTREAM_DIR'" >&2
fi
exit 1
```

### WR-03: `flake.nix`'s `MOZBUILD_STATE_PATH` is anchored to shell-entry `$PWD`, not the flake's own root

**File:** `flake.nix:60`
**Issue:**

```nix
export MOZBUILD_STATE_PATH="$PWD/.mozbuild"
```

This is only correct when `nix develop .#firefox` is invoked from the repo root, which is what `docs/BUILD.md` documents — but nothing enforces it, and Nix flake shells are routinely invoked by path from elsewhere (`nix develop /path/to/sourcerer#firefox`, or from inside `upstream/` after a `cd`). In that case Firefox's build state directory silently lands somewhere other than the `$REPO_ROOT/.mozbuild` that `scripts/smoke-firefox.sh` (`LOG_DIR="$REPO_ROOT/.mozbuild"`) and `docs/BUILD.md`'s toolchain-baseline commands both assume, with no error — just a working directory nobody expects. Every other path in this phase (`fetch-upstream.sh`, `smoke-theia.sh`, `smoke-firefox.sh`) deliberately computes `REPO_ROOT` via `$(dirname "${BASH_SOURCE[0]}")/..` specifically to avoid this class of bug; the flake's shellHook is the one place that didn't get the same treatment.
**Fix:** Anchor to the flake's own source path instead of the invocation-time `$PWD`:

```nix
shellHook = ''
  export MOZBUILD_STATE_PATH="${toString ./.}/.mozbuild"
  ...
'';
```

## Info

### IN-01: `theia/package.json`'s `resolutions` block covers 12 of the 24 `@theia/*` packages actually present in the lockfile

**File:** `theia/package.json:6-19`
**Issue:** `resolutions` pins the 12 directly-depended `@theia/*` packages. `theia/yarn.lock` contains 24 distinct `@theia/*` packages (e.g. `@theia/application-manager`, `@theia/ffmpeg`, `@theia/monaco-editor-core`, `@theia/outline-view`, `@theia/ovsx-client`, `@theia/request`, `@theia/userstorage`, `@theia/variable-resolver` are transitive, not listed). This was a deliberate, documented scope decision in `01-02-SUMMARY.md` ("`resolutions` and `dependencies` only cover `@theia/*` packages"), and today it's low-risk because every install in this workspace runs `--frozen-lockfile`, which reproduces the locked tree regardless of `resolutions`. But D-09's stated rationale — "a `resolutions` block to stop transitive drift" because "Theia has no API stability tier" — is only partially realized: a future non-frozen `yarn install` (e.g. Phase 2 adding a `@sourcerer/*` package that pulls a new transitive `@theia/*` dependency) has no guard stopping those other 12 packages from resolving off `1.74.1`.
**Fix:** Either extend `resolutions` to cover the full `@theia/*` namespace with a glob-equivalent (yarn Classic doesn't support wildcard resolutions keys, so this means enumerating all 24), or note in `theia/package.json`/`docs/BUILD.md` that transitive-drift protection is `--frozen-lockfile`-dependent and revisit before Phase 2 does its first non-frozen install.

### IN-02: `smoke-theia.sh`'s drivelist check only proves the file exists, not that it loads

**File:** `scripts/smoke-theia.sh:39-43`
**Issue:** Unlike the node-pty check a few lines later (a real spawn-and-read proof), the drivelist check is file-existence only:

```bash
if [ ! -f "$DRIVELIST_ARTIFACT" ]; then
  echo "smoke-theia: FAIL -- drivelist native rebuild did not produce $DRIVELIST_ARTIFACT" >&2
  exit 1
fi
```

`01-02-SUMMARY.md`'s own coverage table (D4) records that the plan actually verified this functionally during execution (`node -e 'require("./node_modules/drivelist")'` → `has list(): true`), but that check didn't make it into the persisted gate — only the weaker file-existence check did. A `.node` file built for the wrong ABI/Node version would still pass this check and only surface later, indirectly, if the backend fails to boot.
**Fix:** Promote the functional check into the script:

```bash
nix develop "$REPO_ROOT#theia" --command node -e '
  const dl = require("./node_modules/drivelist");
  if (typeof dl.list !== "function") { console.error("drivelist loaded but list() missing"); process.exit(1); }
  console.log("smoke-theia: drivelist load proof PASS");
'
```

### IN-03: `toolchain-baseline.sh` has two no-op `sed` calls

**File:** `scripts/toolchain-baseline.sh:7-8`
**Issue:**

```bash
rustc --version | grep -oE '^rustc [0-9]+\.[0-9]+\.[0-9]+' | sed 's/^rustc /rustc /'
cargo --version | grep -oE '^cargo [0-9]+\.[0-9]+\.[0-9]+' | sed 's/^cargo /cargo /'
```

Both `grep -oE` patterns already capture the `rustc `/`cargo ` prefix, so the following `sed 's/^rustc /rustc /'` / `sed 's/^cargo /cargo /'` replace the matched text with itself — dead code, almost certainly copy-pasted from line 9's `cbindgen` case, where the `sed 's/^/cbindgen /'` is doing real work (prepending a prefix `grep` didn't capture). Harmless, but confusing to a future editor who might assume the pattern is functional.
**Fix:** Drop the two no-op `sed` invocations:

```bash
rustc --version | grep -oE '^rustc [0-9]+\.[0-9]+\.[0-9]+'
cargo --version | grep -oE '^cargo [0-9]+\.[0-9]+\.[0-9]+'
cbindgen --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | sed 's/^/cbindgen /'
```

---

_Reviewed: 2026-08-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
