# Phase 3: Branded Firefox Fork - Pattern Map

**Mapped:** 2026-08-21
**Files analyzed:** 13 (7 new shell/node scripts, 1 modified script, 1 modified flake, 1 modified mozconfig, 1 modified fetch-upstream.sh, 1 modified docs/BUILD.md, N new non-script files)
**Analogs found:** 11 / 13 (with the branding overlay treated as a group)

This is build-infrastructure, not application code: no controllers/components/
services/models. Roles here are **shell script**, **node verification script**,
**Nix devShell config**, **Gecko build config file**, **doc**. Data flow is
mostly **batch** (one-shot CLI invocation, exit code + stdout) or
**request-response** (BiDi driver talking to a spawned Firefox process).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/check-patch-surface.sh` | shell script (guard) | batch | `scripts/toolchain-baseline.sh` (structure), `scripts/smoke-firefox.sh` (fail-loud style) | role-match |
| `scripts/apply-patches.sh` | shell script (idempotent mutator) | batch | `scripts/fetch-upstream.sh` | exact |
| `scripts/rebase-upstream.sh` | shell script (orchestrator) | batch | `scripts/fetch-upstream.sh` + `scripts/apply-patches.sh` composed | role-match |
| `scripts/verify-phase-03.sh` | shell script (aggregator/driver) | batch | `scripts/verify-phase-02.sh` | exact |
| `scripts/verify-branding-identity.mjs` | node verification script | request-response (drives spawned Firefox via BiDi) | `scripts/verify-branding.mjs` (coverage-guard shape), `scripts/verify-dev-flag-off.mjs` (`--expect-bound` positive-control inversion) | exact |
| `scripts/lib/firefox-bidi.mjs` (modified) | utility/driver library | request-response | itself (Phase 2) | exact — modification, not new file |
| `flake.nix` `firefox` devShell (modified) | Nix config | config | itself (Phase 1) | exact — modification |
| `.mozconfig` (modified) | Gecko build config | config | itself (Phase 1) | exact — modification |
| `scripts/fetch-upstream.sh` (modified) | shell script | batch | itself (Phase 1) | exact — modification |
| `docs/BUILD.md` (modified) | doc | — | itself | exact — modification |
| `upstream/browser/moz.configure` (patched via `patches/*.patch`, never edited directly) | Gecko build config | config | quoted diff already in 03-RESEARCH.md Code Examples | exact (research-provided, not repo-analog) |
| `sourcerer/branding/{dev,release}/*` | Gecko build config tree (branding overlay) | file-I/O (static files installed by build) | `upstream/browser/branding/unofficial/` | role-match (upstream template, read-only) |
| `.github/workflows/rebase-upstream.yml` | CI config | event-driven (`workflow_dispatch`) | no in-repo analog — `.github/workflows/` does not exist yet this phase creates it first | no analog (external precedent only: `zen-browser/desktop` `sync-upstream.yml`, per D-77/CONTEXT.md) |
| `sourcerer/sourcerer.desktop` | OS integration file | static | no in-repo analog | no analog (template: `upstream/taskcluster/docker/ubuntu2404-test/firefox.desktop`, read-only reference inside `upstream/`) |
| `distribution/policies.json` | Gecko runtime config | config | no in-repo analog | no analog |

## Pattern Assignments

### `scripts/apply-patches.sh` (shell script, batch)

**Analog:** `scripts/fetch-upstream.sh` — this is the single best template in the repo per phase guidance. Study it closely.

**Shebang + strict mode + REPO_ROOT idiom** (`scripts/fetch-upstream.sh` lines 1-10):
```bash
#!/usr/bin/env bash
# D-04: the one documented command that materializes upstream/ from a clean
# checkout. Safely re-runnable -- if upstream/ already exists, verifies its
# HEAD is the pinned tag instead of re-cloning.
set -euo pipefail

TAG="FIREFOX_153_1_0esr_RELEASE"
REMOTE="https://github.com/mozilla-firefox/firefox.git"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM_DIR="$REPO_ROOT/upstream"
```

**Re-runnable / idempotent check pattern with fail-loud remediation** (lines 11-24):
```bash
if [ -d "$UPSTREAM_DIR" ]; then
  if ! git -C "$UPSTREAM_DIR" rev-parse --git-dir >/dev/null 2>&1; then
    echo "fetch-upstream: FAIL -- $UPSTREAM_DIR exists but is not a git checkout." >&2
    echo "  Most likely an interrupted clone. Remove it and re-run:" >&2
    echo "    rm -rf '$UPSTREAM_DIR' && '${BASH_SOURCE[0]}'" >&2
    exit 1
  fi
```
Copy this exact shape for `apply-patches.sh`: `FAIL --` prefix on stderr, one-line cause, then an indented exact remediation command the developer can copy-paste. `scripts/name: FAIL -- <cause>` is the repo-wide error convention — reuse verbatim.

**Non-vacuous-check pattern (comparing before/after state, not just exit code)** (lines 39-45, the dirty-tree gate):
```bash
  if [ -n "$(git -C "$UPSTREAM_DIR" status --porcelain 2>/dev/null)" ]; then
    echo "fetch-upstream: FAIL -- upstream/ is at $TAG but its working tree is dirty." >&2
    echo "  Gecko source must never be modified. Inspect with:" >&2
    echo "    git -C '$UPSTREAM_DIR' status --porcelain" >&2
    echo "  Then discard the changes, or remove upstream/ and re-run this script." >&2
    exit 1
  fi
```
`apply-patches.sh` needs the analogous move but inverted: capture `git hash-object` per touched file **before** `git apply --3way`, compare **after** — exit-code-0-but-unchanged is exactly the D-75 silent-adopt failure mode this shape is built to catch (concrete sketch already in `03-RESEARCH.md` Architecture Patterns § Patch stack mechanics — quote it directly, it is a full working draft, not a stub).

**Timing pattern for the final success line** (lines 55-58):
```bash
SECONDS=0
git clone --depth 1 --branch "$TAG" "$REMOTE" "$UPSTREAM_DIR"
ELAPSED=$SECONDS
echo "fetch-upstream: cloned $TAG in ${ELAPSED}s"
```
Reuse for `apply-patches.sh`'s final `"apply-patches: all N patches applied and verified non-vacuous"` line — same `scripts/name: <verb-past-tense> <result>` success-message convention.

---

### `scripts/verify-phase-03.sh` (shell script, batch aggregator)

**Analog:** `scripts/verify-phase-02.sh`

**Header + REPO_ROOT + `--build` flag parsing** (lines 1-23):
```bash
#!/usr/bin/env bash
# scripts/verify-phase-02.sh
#
# Sequencing driver for every phase-02 check. Owns the app's lifecycle so no
# individual check has to: ... Later plans append their own checks to
# the CHECKS list below rather than adding a sibling driver.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
THEIA_DIR="$REPO_ROOT/theia"
APP_URL="http://localhost:3000"
DO_BUILD=0

for arg in "$@"; do
  case "$arg" in
    --build) DO_BUILD=1 ;;
    *)
      echo "verify-phase-02: FAIL -- unknown argument '$arg' (only --build is accepted)" >&2
      exit 1
      ;;
  esac
done
```
Note: `set -uo pipefail` here, **not** `-e` — the aggregator deliberately does not `set -e` because it needs to run every check and only fail at the end; `apply-patches.sh`/`fetch-upstream.sh` use `-euo pipefail` because they're linear mutators, not aggregators. Match this distinction in `verify-phase-03.sh`.

**Critical detail to carry across verbatim — the split-trap idiom** (lines 40-54, quoted in full because getting this wrong silently breaks INT/TERM handling):
```bash
SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill -- "-$SERVER_PID" 2>/dev/null || kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
# EXIT alone is not enough: bash resumes the *rest of the script* after a
# non-EXIT trap handler returns, unless that handler explicitly exits -- so
# INT/TERM must each call `exit` themselves. Discovered live: a bare
# `trap cleanup EXIT INT TERM` let a SIGINT delivered early ... run
# cleanup() as a no-op and then continue straight through the rest of the
# script as if uninterrupted, leaving the backend it eventually started
# orphaned ... `exit` here still fires the EXIT trap once more afterwards
# (harmless -- cleanup is idempotent against an empty/already-dead PID).
trap cleanup EXIT
trap 'cleanup; exit 130' INT TERM
```
Phase 3's `verify-phase-03.sh` has no long-running app to supervise (D-88's checks spawn/kill the branded Firefox binary per-layer, not once for the whole aggregator run) but if it wraps any backgrounded process (e.g. the `MOZ_LOG` network-layer check's `objdir/dist/bin/sourcerer &`), this exact split must be reused — `03-VALIDATION.md` Wave 0 explicitly calls this out by file and line, quote it, do not paraphrase it.

---

### `scripts/check-patch-surface.sh` (shell script, guard)

**Analog:** `scripts/toolchain-baseline.sh` (minimal single-purpose guard shape) + `scripts/smoke-firefox.sh` (fail-loud-with-context message style).

`toolchain-baseline.sh` in full (13 lines) — the minimal shape to imitate for a script that does one check and exits:
```bash
#!/usr/bin/env bash
# D-13 baseline. Assumes it is already running inside the `firefox` dev
# shell -- it does not enter that shell itself, so Phase 3's CI can invoke
# it from whatever shell context CI already has.
set -euo pipefail

rustc --version | grep -oE '^rustc [0-9]+\.[0-9]+\.[0-9]+' | sed 's/^rustc /rustc /'
```

`smoke-firefox.sh`'s fail-loud pattern for a check with a hard-coded, testable condition (lines 30-34):
```bash
BOOTSTRAP_COUNT="$(grep -cE 'mach[[:space:]]+bootstrap' "$LOG_FILE" || true)"
if [ "$BOOTSTRAP_COUNT" -ne 0 ]; then
  echo "smoke-firefox: FAIL -- build log invoked 'mach bootstrap' ($BOOTSTRAP_COUNT times), which D-18 forbids" >&2
  exit 1
fi
```
`check-patch-surface.sh` grep-scans `patches/*.patch` for the compiled-suffix set (`.c .cc .cxx .cpp .h .hh .hpp .inc .m .mm .rs .s .S .asm .webidl .idl .ipdl .ipdlh Cargo.*`, exact set cited in CONTEXT.md D-72 from `upstream/python/mozbuild/mozbuild/frontend/emitter.py:1126-1133`) — same `COUNT -ne 0 → FAIL` shape, count-based not boolean, so the message can report how many.

---

### `scripts/verify-branding-identity.mjs` (node verification script, request-response)

**Analogs:** `scripts/verify-branding.mjs` (coverage-guard pattern) and `scripts/verify-dev-flag-off.mjs` (`--expect-bound` positive-control inversion).

**Header/imports convention** (`scripts/verify-branding.mjs` lines 1-33, condensed):
```javascript
#!/usr/bin/env node
// scripts/verify-branding.mjs
//
// [purpose paragraph explaining WHY, not just what]
//
// Usage: node scripts/verify-branding.mjs [url]   (default http://localhost:3000)
//
// Later plans extend this same file rather than adding sibling scripts.

import { withFirefoxPage } from './lib/firefox-bidi.mjs';

const url = process.argv[2] || 'http://localhost:3000';
```
Every node script in this repo imports only `./lib/firefox-bidi.mjs` and Node built-ins — zero npm dependency (D-69, restated for Phase 3 in `03-VALIDATION.md` Test Infrastructure). `verify-branding-identity.mjs` must follow suit and, per Wave 0, call `withFirefoxPage`/`captureScreenshot` with the new `binPath` option (see firefox-bidi.mjs section below) since the binary is no longer `objdir/dist/bin/firefox`.

**`--expect-bound` positive-control inversion, quoted in full** (`scripts/verify-dev-flag-off.mjs` lines 1-45) — this is the shape every one of D-88's negative assertions (BRAND-04 layers, BRAND-01 checklist items) must copy:
```javascript
// Default mode asserts the binding is ABSENT (exit 0 when isBound() ===
// false). `--expect-bound` inverts the assertion (exit 0 when isBound() ===
// true) -- the positive control the Assumptions Log demands: a script that
// can only ever report "not bound" would pass vacuously against an app that
// never defined the token at all.
//
// Usage:
//   node scripts/verify-dev-flag-off.mjs [url] [--expect-bound]
//   node scripts/verify-dev-flag-off.mjs --help

const HELP = `Usage: node scripts/verify-dev-flag-off.mjs [url] [--expect-bound]
...
  [url]            App URL to check (default http://localhost:3000)
  --expect-bound   Assert the binding is PRESENT instead of absent
  --help           Print this message and exit 0
`;

const args = process.argv.slice(2);
if (args.includes('--help')) { ... }
```
For BRAND-01's six-surface checklist, the same `--restore-<surface>` (or generic `--positive-control`) flag pattern applies: default mode asserts the branded identity is correct; the inverted flag mode reverts one surface and asserts the check goes red, satisfying `03-VALIDATION.md`'s "every negative assertion ships with a working positive control" table.

**Coverage-guard pattern** (`scripts/verify-branding.mjs`'s design note, lines 3-9) — worth carrying into `verify-branding-identity.mjs`'s doc comment: track which of the six D-79 surfaces actually ran an assertion and fail loudly if one was silently skipped, exactly as `verify-branding.mjs` fails loudly if a branding surface silently never rendered.

---

### `scripts/lib/firefox-bidi.mjs` (modified — utility/driver library)

**This is a modification, not a new file — read before editing (already done).**

Current hardcoded module-level constant (line 32):
```javascript
export const FIREFOX_BIN = join(REPO_ROOT, 'objdir', 'dist', 'bin', 'firefox');
```

Functions that consume it, and their current signatures:
```javascript
// line 166
export async function captureScreenshot(url, outputPath, { windowSize = '800,600', timeoutMs = 15000 } = {}) {
    if (!existsSync(FIREFOX_BIN)) { ... }
    const child = spawn(FIREFOX_BIN, [ ... ]);

// line 247
export async function withFirefoxPage(url, callback) {
    if (!existsSync(FIREFOX_BIN)) { ... }
    const child = spawn(FIREFOX_BIN, [ ... ]);
```

**Required change (03-VALIDATION.md Wave 0, exact instruction):** add `binPath = FIREFOX_BIN` to each function's options object, keep `export const FIREFOX_BIN` as the default so Phase 2's existing callers (which pass no override) are unaffected:
```javascript
export async function captureScreenshot(url, outputPath, { windowSize = '800,600', timeoutMs = 15000, binPath = FIREFOX_BIN } = {}) {
    if (!existsSync(binPath)) { ... }
    const child = spawn(binPath, [ ... ]);

export async function withFirefoxPage(url, callback, { binPath = FIREFOX_BIN } = {}) {
    if (!existsSync(binPath)) { ... }
    const child = spawn(binPath, [ ... ]);
```
`withFirefoxPage` currently takes no options object at all (`(url, callback)`) — this is a signature addition, not just a default-value change; existing Phase 2 callers passing exactly two positional args remain unaffected. `verify-branding-identity.mjs` then calls `withFirefoxPage(url, cb, { binPath: join(REPO_ROOT, 'objdir', 'dist', 'bin', 'sourcerer') })`.

---

### `flake.nix` `firefox` devShell (modified — Nix config)

**Exact current block to extend, quoted in full** (lines 48-73):
```nix
        firefox =
          # `inputsFrom` only copies `nativeBuildInputs`/`buildInputs` from the
          # referenced derivation -- it does NOT copy the derivation's own
          # `stdenv`. `firefox-esr-153-unwrapped` (buildMozillaMach) builds under
          # `buildStdenv = overrideCC llvmPackages.stdenv (...)` -- i.e. clang,
          # not the default gcc `pkgs.mkShell` would otherwise use. Without this
          # override `./mach build` fails immediately with "Could not find
          # clang to generate run bindings for C/C++" even though rustc/cargo/
          # cbindgen are all present and correct. Match the real build's stdenv.
          (pkgs.mkShell.override { stdenv = pkgs.llvmPackages.stdenv; }) {
            inputsFrom = [ pkgs.firefox-esr-153-unwrapped ];
            shellHook = ''
              export MOZBUILD_STATE_PATH="$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")/.mozbuild"
              # nixpkgs' bintools-wrapper setup hook exports AS/LD/NM/AR/RANLIB/
              # OBJDUMP/OBJCOPY/READELF/SIZE/STRINGS/STRIP as bare tool names...
              unset AS LD NM AR RANLIB OBJDUMP OBJCOPY READELF SIZE STRINGS STRIP
              echo "Sourcerer firefox shell ready. ..." >&2
            '';
          };
```
D-71's sccache lands here: add `pkgs.sccache` to the derivation this `inputsFrom` composes with (e.g. an added `buildInputs = [ pkgs.sccache ];` alongside `inputsFrom`), and `export RUSTC_WRAPPER=sccache` in the same `shellHook` block, right after the existing `unset AS LD ...` line — **not** before it, since sccache wrapping must see the already-corrected toolchain env. Do not touch the `stdenv` override or the `unset` line; D-71's own risk note says sccache "sits in that same fragile path" — extend the shellHook additively, don't restructure it.

---

### `.mozconfig` (modified — Gecko build config)

**Current file, quoted in full:**
```
mk_add_options MOZ_OBJDIR=@TOPSRCDIR@/../objdir
ac_add_options --enable-application=browser
ac_add_options --disable-updater
ac_add_options --without-wasm-sandboxed-libraries
ac_add_options --with-libclang-path="$LIBCLANG_PATH"
```
Add (per CONTEXT.md's zero-patch list and D-84): `--with-app-basename=Sourcerer`, `--with-distribution-id=org.deocracy`, `--with-branding=sourcerer/branding/dev` (or `/release`), `--disable-crashreporter`, and `MOZ_APP_REMOTINGNAME=sourcerer` (this one is an exported env var per the moz.configure `option(env=...)` declaration quoted in 03-RESEARCH.md, not an `ac_add_options` line — do not conflate the two mechanisms). And D-71's `--with-ccache=sccache`. One line per option, same `ac_add_options`/`mk_add_options` style as the existing five lines — no reformatting of the existing lines.

---

### `scripts/fetch-upstream.sh` (modified — the D-76 clean-tree gate)

**Exact block that changes, quoted (lines 39-45):**
```bash
  if [ -n "$(git -C "$UPSTREAM_DIR" status --porcelain 2>/dev/null)" ]; then
    echo "fetch-upstream: FAIL -- upstream/ is at $TAG but its working tree is dirty." >&2
    echo "  Gecko source must never be modified. Inspect with:" >&2
    echo "    git -C '$UPSTREAM_DIR' status --porcelain" >&2
    echo "  Then discard the changes, or remove upstream/ and re-run this script." >&2
    exit 1
  fi
```
D-76 requires this become a filtered comparison: `git status --porcelain` output must be checked against an "expected dirt" set (the patch-stack diff + the `?? sourcerer/` symlink entry, cleared by `.git/info/exclude` per 03-RESEARCH.md's overlay-mechanism finding) rather than requiring the working tree to be byte-identical to a fresh clone. The unconditional-hard-fail branch above becomes conditional on whatever remains **after** subtracting expected dirt — same `FAIL -- <cause>` message convention, same indented remediation lines.

---

## Shared Patterns

### `scripts/name: FAIL -- <cause>` error convention
**Source:** every script in `scripts/` (`fetch-upstream.sh`, `smoke-firefox.sh`, `verify-phase-02.sh`)
**Apply to:** every new script in this phase
```bash
echo "check-patch-surface: FAIL -- <one-line cause>" >&2
echo "  <indented remediation command, copy-pastable>" >&2
exit 1
```

### `REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"`
**Source:** `scripts/fetch-upstream.sh` line 9, `scripts/verify-phase-02.sh` line 10, `scripts/smoke-firefox.sh` line 9
**Apply to:** every new shell script — never hardcode a repo-relative path, never rely on invocation-time `$PWD`.

### Zero-npm-dependency node scripts
**Source:** `scripts/verify-branding.mjs`, `scripts/verify-dev-flag-off.mjs` (D-69, restated for Phase 3 in `03-VALIDATION.md`)
**Apply to:** `scripts/verify-branding-identity.mjs` — only `import { withFirefoxPage } from './lib/firefox-bidi.mjs'` and Node built-ins.

### Positive control for every negative assertion
**Source:** `scripts/verify-dev-flag-off.mjs`'s `--expect-bound` flag; `02-LEARNINGS.md` (cited directly in `03-VALIDATION.md`)
**Apply to:** all of D-88's BRAND-04 layers and BRAND-01's six-item checklist — every "must be absent" check ships an inverted-flag or restore-and-confirm-red mode.

### `set -euo pipefail` for linear mutators, `set -uo pipefail` for aggregators
**Source:** `fetch-upstream.sh`/`smoke-firefox.sh` (`-e`) vs `verify-phase-02.sh` (no `-e`, runs every check regardless of individual failure)
**Apply to:** `apply-patches.sh`/`check-patch-surface.sh`/`rebase-upstream.sh` use `-euo pipefail`; `verify-phase-03.sh` uses `-uo pipefail`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `.github/workflows/rebase-upstream.yml` | CI config | event-driven | `.github/workflows/` does not exist in this repo yet — this phase creates the directory for the first time (D-77). Use the external precedent named in CONTEXT.md/RESEARCH.md instead: `zen-browser/desktop`'s `sync-upstream.yml`, adapted to `workflow_dispatch`-only (no cron). |
| `sourcerer/sourcerer.desktop` | OS integration file | static | No `.desktop` file exists anywhere under repo control (the build itself emits none, confirmed by research). The only in-tree reference is inside the read-only `upstream/` tree: `upstream/taskcluster/docker/ubuntu2404-test/firefox.desktop` — a Mozilla CI fixture, not a shippable template, but the closest real example of the `[Desktop Entry]` key set. A full draft is already quoted in `03-RESEARCH.md` Code Examples § The `.desktop` file — use that directly. |
| `distribution/policies.json` | Gecko runtime config | config | No existing `policies.json` in this repo. No close analog; author from Mozilla's documented policy schema per D-84/D-85's allowlist, keeping it minimal per CONTEXT.md's discretion leaning. |
| `sourcerer/branding/{dev,release}/*` (per-file, beyond the directory-level role-match) | Gecko build config tree | file-I/O | Directory-level analog exists (`upstream/browser/branding/unofficial/`, read-only reference — do not copy Windows/macOS/MSIX files per the (c)-classification table in `03-RESEARCH.md`), but there is no in-repo (non-`upstream/`) precedent for a Sourcerer-authored branding tree since this is the first one. |

## Metadata

**Analog search scope:** `scripts/`, `scripts/lib/`, `flake.nix`, `.mozconfig`, `upstream/browser/branding/unofficial/` (read-only reference, verified via `find`, no writes)
**Files scanned:** `scripts/fetch-upstream.sh`, `scripts/verify-phase-02.sh`, `scripts/toolchain-baseline.sh`, `scripts/smoke-firefox.sh`, `scripts/verify-branding.mjs`, `scripts/verify-dev-flag-off.mjs`, `scripts/lib/firefox-bidi.mjs`, `flake.nix`, `.mozconfig`
**Pattern extraction date:** 2026-08-21
**Read-only verification:** `git -C /home/chris/coding/sourcerer/upstream status --porcelain` confirmed empty before finishing; no file under `upstream/` was modified.
