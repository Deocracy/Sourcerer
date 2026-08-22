---
phase: 03-branded-firefox-fork
reviewed: 2026-08-21T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - scripts/apply-patches.sh
  - scripts/check-patch-surface.sh
  - scripts/fetch-upstream.sh
  - scripts/rebase-upstream.sh
  - scripts/verify-endpoints.sh
  - scripts/verify-phase-03.sh
  - scripts/lib/firefox-bidi.mjs
  - scripts/verify-branding-identity.mjs
  - .github/workflows/rebase-upstream.yml
  - .mozconfig
  - flake.nix
  - patches/010-sourcerer-identity.patch
  - sourcerer/endpoint-allowlist.json
  - sourcerer/distribution/policies.json
  - sourcerer/branding/dev/pref/firefox-branding.js
  - sourcerer/branding/release/pref/firefox-branding.js
  - sourcerer/branding/dev/configure.sh
  - sourcerer/branding/release/configure.sh
  - sourcerer/sourcerer.desktop
  - sourcerer/sourcerer-release.desktop
findings:
  critical: 2
  warning: 2
  info: 3
  total: 7
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-08-21
**Depth:** standard
**Files Reviewed:** 18 (plus `sourcerer/branding/{dev,release}/locales/en-US/brand.ftl`, read as evidence for CR-01)
**Status:** issues_found

## Summary

This phase's dominant risk, per its own stated philosophy ("a negative check without a demonstrated-red positive control proves nothing"), is a verification harness that can go green while measuring nothing. Six prior bugs of exactly that shape were found and fixed across plans 03-02/03-03/03-05 (the capture-window/glob/argv bugs documented in the SUMMARYs). This review found **two more of the same class that were not caught**:

1. `verify-branding-identity.mjs`'s "brand-full-name" surface (identity surface 4) is hardcoded to read the **dev** branding tree's `brand.ftl` regardless of the `--bin`/`--desktop`/`--config-status` overrides `verify-phase-03.sh`'s own `verify-branding-identity-release` check passes it. The release build's own `brand.ftl` (which correctly differs, "Sourcerer" vs "Sourcerer Dev") is never read by any code path. This directly contradicts 03-05-SUMMARY.md's claim that "identity surface 4 reads two different real values from the two variants' own `brand.ftl` files" -- as implemented, it reads the same file and the same expected constant every time.
2. `verify-endpoints.sh`'s layer-1 and layer-3 `--positive-control` paths mutate the **real, installed** branding pref file under `objdir/dist/bin/.../firefox-branding.js` (re-enabling OpenH264, restoring the stock GMP-manager URL) and restore it only via a linear post-mutation `cp`, with no SIGINT/TERM-safe path. The script's own top-level `trap cleanup EXIT` / `trap 'cleanup; exit 130' INT TERM` cleans up backgrounded PIDs and `mktemp` scratch paths, but never the pref-file backup. A SIGINT during layer 3's 35-second sleep (a very plausible interactive event) leaves the actual built binary silently running with part of BRAND-04's endpoint lockdown undone, undetected until the next full `./mach build` (measured at 2368s-2822s in this phase, i.e., not something a developer will trigger to "just check").

The remaining findings are lower-severity robustness/quality issues. No secrets, no shell-injection, and no CI-workflow-injection were found beyond what the phase's own SUMMARYs already document as fixed (`.github/workflows/rebase-upstream.yml`'s `env:`-mediated `REBASE_TAG` is correctly non-interpolated).

## Critical Issues

### CR-01: `verify-branding-identity.mjs`'s brand-full-name surface never reads the release variant it is asked to check

**File:** `scripts/verify-branding-identity.mjs:141` (constant), `271-280` (surface), consumed by `scripts/verify-phase-03.sh:149`

**Issue:** `BRAND_FTL_PATH` is a hardcoded constant:

```js
const BRAND_FTL_PATH = join(REPO_ROOT, 'sourcerer', 'branding', 'dev', 'locales', 'en-US', 'brand.ftl');
```

Every other surface in this file is variant-aware: `checkExecutable`/`checkApplicationIni`/`checkVersion` derive their paths from `BIN_PATH` (itself driven by `--bin`), and `checkDesktopEntry` takes `--desktop`/`--config-status` overrides. `checkBrandFullName`, however, takes no override at all and always reads the **dev** tree's `brand.ftl`, always compares against the hardcoded literal `'Sourcerer Dev'`:

```js
function checkBrandFullName() {
    const value = readBrandFullName(BRAND_FTL_PATH);
    const expected = 'Sourcerer Dev';
    ...
```

`scripts/verify-phase-03.sh`'s `verify-branding-identity-release` check invokes this script with `--bin .../objdir-release/dist/bin/sourcerer --desktop .../sourcerer-release.desktop --config-status .../objdir-release/config.status` -- every override this script supports -- and still gets the dev-tree assertion back. Confirmed by reading `sourcerer/branding/release/locales/en-US/brand.ftl:8` directly: it correctly says `-brand-full-name = Sourcerer` (not "Sourcerer Dev"), but no code path in this file ever reads that file. If the release `brand.ftl` were reverted, deleted, or accidentally made identical to dev's, `verify-branding-identity-release` would still report `PASS brand-full-name` every time, because it is checking a file untouched by which variant was requested. This is exactly the failure mode this phase's own validation philosophy targets: a check that stays green if its actual subject changes or disappears. It also invalidates 03-05-SUMMARY.md's D3 claim that this surface is one of BRAND-06's three independently-verified dev-vs-release distinguishing signals -- as implemented, it is not a per-variant signal at all.

**Fix:** Add a `--brand-ftl <path>` override (mirroring `--desktop`/`--config-status`) and thread it through `verify-phase-03.sh`'s release invocation:

```js
const BRAND_FTL_PATH = brandFtlOverride || join(REPO_ROOT, 'sourcerer', 'branding', 'dev', 'locales', 'en-US', 'brand.ftl');
```

```js
const brandFtlOverride = argValue('--brand-ftl');
```

```js
function checkBrandFullName({ expected = 'Sourcerer Dev' } = {}) {
    const value = readBrandFullName(BRAND_FTL_PATH);
    const pass = value === expected;
    ...
```

And in `scripts/verify-phase-03.sh`'s `verify-branding-identity-release` entry, add `--brand-ftl $REPO_ROOT/sourcerer/branding/release/locales/en-US/brand.ftl` (plus an `--expect-brand-full-name Sourcerer` style override, or infer the expectation the same way `checkDesktopEntry` infers `MOZ_APP_DISPLAYNAME` from `--config-status` rather than hardcoding it).

---

### CR-02: Positive controls mutate the real installed branding pref file with no interrupt-safe restore

**File:** `scripts/verify-endpoints.sh:183-214` (layer 1 control), `311-364` (layer 3, `run_layer3_impl`), trap setup at `104-117`

**Issue:** `run_layer1_control` and `run_layer3_impl` (when `control=1`) both back up and then mutate `$BRANDING_PREF_FILE`, which resolves to the **installed, live** pref file the actual built binary reads at startup (`$REPO_ROOT/objdir/dist/bin/browser/defaults/preferences/firefox-branding.js`), not a scratch copy:

```bash
backup="$(mktemp)"
cp "$BRANDING_PREF_FILE" "$backup"
cat >> "$BRANDING_PREF_FILE" <<'PREFEOF'
pref("media.gmp-gmpopenh264.enabled", true);
PREFEOF
```

Restoration (`cp "$backup" "$BRANDING_PREF_FILE"`) only happens on the normal, uninterrupted code path. The file's own top-level trap handlers only manage `ACTIVE_PID` and `TEMP_PATHS` (`cleanup()`, lines 104-115) -- the pref-file `backup` variable is never registered with `track_temp`, and no trap restores it. Layer 3's control runs a real backgrounded `sourcerer` process for a fixed **35-second sleep** (`run_layer3_impl`, line 341) with the mutated pref file already in place; a SIGINT delivered anywhere in that 35-second window (a routine, plausible action for anyone impatiently watching a test run) fires `trap 'cleanup; exit 130' INT TERM`, which kills the backgrounded process and exits -- but the appended `media.gmp-gmpopenh264.enabled=true` / restored stock `media.gmp-manager.url` line is never reverted. The actual built `objdir/dist/bin/sourcerer` binary is then left, silently, with OpenH264's unattended-download path and the stock GMP-manager URL re-enabled -- exactly the two endpoints BRAND-04/D-87 exist to close -- until the next full `./mach build` (measured at 2368s-2822s this phase; not something anyone reruns just to check a pref file). This is a real robustness gap in the tool whose entire purpose is proving those endpoints stay closed.

**Fix:** Register the backup path with the same trap-covered cleanup mechanism the rest of the script already uses, e.g.:

```bash
run_layer3_impl() {
  local control="$1"
  local backup=""
  if [ "$control" -eq 1 ]; then
    backup="$(mktemp)"
    cp "$BRANDING_PREF_FILE" "$backup"
    PREF_BACKUP_SRC="$backup"
    PREF_BACKUP_DST="$BRANDING_PREF_FILE"
    ...
```

and extend `cleanup()`:

```bash
cleanup() {
  if [ -n "${PREF_BACKUP_SRC:-}" ]; then
    cp "$PREF_BACKUP_SRC" "$PREF_BACKUP_DST"
    rm -f "$PREF_BACKUP_SRC"
    PREF_BACKUP_SRC=""
  fi
  ...
```

so a SIGINT/TERM restores the real pref file before the process exits, exactly as it already does for `ACTIVE_PID` and `TEMP_PATHS`.

## Warnings

### WR-01: `readBrandFullName` anchors its regex to the untrimmed line, while its own `.find()` predicate checks the trimmed one

**File:** `scripts/verify-branding-identity.mjs:181-188`

**Issue:**

```js
function readBrandFullName(path) {
    const line = readFileSync(path, 'utf8').split(/\r?\n/).find(l => l.trim().startsWith('-brand-full-name'));
    ...
    const m = line.match(/^-brand-full-name\s*=\s*(.+)$/);
```

`.find()` selects a line based on its **trimmed** content but returns the **original, untrimmed** `l`. `line.match(/^-brand-full-name.../)` then anchors `^` against that untrimmed string. Both current `brand.ftl` files happen to have zero leading whitespace on this line, so this does not currently misfire, but it is one indentation character away from throwing `"... -brand-full-name line has an unexpected or empty shape"` on an otherwise well-formed file -- a latent fragility in a file this harness is supposed to robustly read.

**Fix:** Match against the trimmed line:

```js
const line = readFileSync(path, 'utf8').split(/\r?\n/)
    .map(l => l.trim())
    .find(l => l.startsWith('-brand-full-name'));
```

### WR-02: `verify-phase-03.sh` uses `eval` for statically-known function names

**File:** `scripts/verify-phase-03.sh:180`

**Issue:**

```bash
*)
  if eval "$cmd"; then
```

`$cmd` here is always one of the literal function names in the script's own `CHECKS` array (`check_allowlist_schema`, `check_desktop_entry_quick`) -- not attacker- or user-controlled in this script's current form, so this is not currently exploitable. `eval` is still the wrong tool for "call this function by name"; it invites a real injection bug the day a future plan adds a `CHECKS` entry built from any external input (a CLI flag, an env var, a file read).

**Fix:** Call the function directly rather than through `eval`, since the non-external branch only ever needs to invoke a shell function:

```bash
*)
  if "$cmd"; then
```

(Bash already supports calling a function stored in a plain variable this way; no `eval` needed for a bareword function name.)

## Info

### IN-01: `firefox-bidi.mjs`'s top-of-file header comment is stale

**File:** `scripts/lib/firefox-bidi.mjs:1-20`

**Issue:** The file's opening comment block still describes the driver as being "for `objdir/dist/bin/firefox`, the Firefox build this repo already produces (Phase 1)" and says "this driver spawns it directly" referring to that path. `FIREFOX_BIN` was repointed to `objdir/dist/bin/sourcerer` in this same phase (plan 03-02), and a second comment block further down (lines 32-38) correctly documents the rename -- the top header was never updated to match, so a reader stops at the first (wrong) description before reaching the correct one.

**Fix:** Update the opening comment's binary name to `sourcerer`, or delete the now-redundant restatement and let the lines-32-38 comment be the single source of truth.

### IN-02: `home_count` is not scoped `local`, unlike its sibling `exact_count`

**File:** `scripts/verify-endpoints.sh:260`

**Issue:** In `run_layer2_impl`, `exact_count` is read via a bare assignment without `local` either (line 261 also lacks `local`, only `mozilla_count` at line 247's comment references a variable that isn't actually declared/used at all -- dead reference in the comment). Neither `home_count` nor `exact_count` is declared `local` in this function, unlike `sandbox`/`log`/`shot`/`home_for_run`/`extra_args` in the same function. Harmless today since `run_layer2_impl` only runs once per script invocation, but inconsistent scoping discipline that would leak state if the function were ever called twice in one process (e.g., a future `--layer 2 --layer 2` style loop).

**Fix:** Add `local home_count exact_count` alongside the function's other `local` declarations.

### IN-03: `.github/workflows/rebase-upstream.yml` pins `actions/checkout` by tag, not by commit SHA

**File:** `.github/workflows/rebase-upstream.yml:35`

**Issue:** `uses: actions/checkout@v4` resolves a mutable tag rather than an immutable commit SHA. This is a standard supply-chain hardening recommendation for GitHub Actions (a compromised or re-tagged `v4` would run in this workflow with `workflow_dispatch`'s write-level trigger permissions) -- low practical risk here since `workflow_dispatch` already requires repo write access to trigger at all, but worth noting since this is the phase's only CI workflow.

**Fix:** Pin to a specific commit SHA with a version comment, e.g. `uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2`.

---

_Reviewed: 2026-08-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
