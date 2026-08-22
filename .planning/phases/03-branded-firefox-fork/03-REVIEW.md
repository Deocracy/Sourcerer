---
phase: 03-branded-firefox-fork
reviewed: 2026-08-22T00:00:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - docs/BUILD.md
  - flake.nix
  - .github/workflows/rebase-upstream.yml
  - .gitignore
  - .mozconfig
  - patches/010-sourcerer-identity.patch
  - README.md
  - scripts/apply-patches.sh
  - scripts/check-patch-surface.sh
  - scripts/fetch-upstream.sh
  - scripts/lib/firefox-bidi.mjs
  - scripts/rebase-upstream.sh
  - scripts/verify-branding-identity.mjs
  - scripts/verify-endpoints.sh
  - scripts/verify-phase-03.sh
  - sourcerer/branding/dev/configure.sh
  - sourcerer/branding/dev/content/jar.mn
  - sourcerer/branding/dev/content/aboutDialog.css
  - sourcerer/branding/dev/locales/en-US/brand.ftl
  - sourcerer/branding/dev/locales/en-US/brand.properties
  - sourcerer/branding/dev/moz.build
  - sourcerer/branding/dev/pref/firefox-branding.js
  - sourcerer/branding/release/configure.sh
  - sourcerer/branding/release/content/aboutDialog.css
  - sourcerer/branding/release/content/jar.mn
  - sourcerer/branding/release/content/moz.build
  - sourcerer/branding/release/locales/en-US/brand.ftl
  - sourcerer/branding/release/locales/en-US/brand.properties
  - sourcerer/branding/release/locales/jar.mn
  - sourcerer/branding/release/locales/moz.build
  - sourcerer/branding/release/moz.build
  - sourcerer/branding/release/pref/firefox-branding.js
  - sourcerer/distribution/policies.json
  - sourcerer/endpoint-allowlist.json
  - sourcerer/sourcerer.desktop
  - sourcerer/sourcerer-release.desktop
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-08-22
**Depth:** standard
**Files Reviewed:** 34
**Status:** issues_found

## Summary

This is a re-review of a phase that already went through one review cycle
(`03-REVIEW.md`, 2026-08-21) and two gap-closure plans. Both previously-found
Critical issues were verified fixed by direct inspection of the current
source, not taken on trust:

- **CR-01** (`verify-branding-identity.mjs`'s brand-full-name surface always
  reading the dev tree's `brand.ftl`) is fixed: the file now has a
  `VARIANTS` descriptor (`scripts/verify-branding-identity.mjs:95-110`) with
  a per-variant `brandFtl`/`brandFullName` pair, a `--variant`/`--brand-ftl`
  override, and `checkBrandFullName` reads `BRAND_FTL_PATH`, which is
  variant-derived. `verify-phase-03.sh` now runs both
  `verify-branding-identity-dev` and `verify-branding-identity-release` plus
  a dedicated `--variant release --positive-control brand-full-name`
  cross-variant control (`scripts/verify-phase-03.sh:279-281`).
- **CR-02** (positive controls mutating the real installed pref file with no
  interrupt-safe restore) is fixed: `scripts/verify-endpoints.sh` now has
  `track_pref_backup`/`restore_pref_backup` (lines 118-143) registered
  against the script's top-level `cleanup()` (called from both `trap cleanup
  EXIT` and `trap 'cleanup; exit 130' INT TERM`, lines 160-161), and a
  dedicated `--interrupt-self-test` mode (lines 465-566) that sends a real
  SIGINT into a real running layer-3 control and asserts the pref file
  survives byte-identical. This is a genuine, demonstrated-red-capable
  regression test, not just a code-shape argument.

Of the prior review's four lower-severity findings, three (WR-02's `eval`,
WR-01's untrimmed-line regex mismatch, IN-02's unscoped `home_count`/
`exact_count`, IN-03's tag-pinned `actions/checkout`) are also fixed and
verified in the current source. **IN-01 (stale header comment in
`firefox-bidi.mjs`) is not fixed** — re-reported below, unchanged.

This pass also found three new issues, all in the branding data itself
rather than the verification harness: one confirms and localizes a gap
already flagged in project context (BRAND-06, `brand.properties` byte-identical
across variants), and two are newly found — an unpackaged `aboutDialog.css`
shipped in both branding trees, and `distribution/policies.json` having no
automated build-time or verify-time proof it ever lands in a built objdir.
None of these are crashes or security issues; all are real behavior/coverage
gaps, hence Warning, not Critical.

## Warnings

### WR-01: `brand.properties` is byte-identical between dev and release, defeating BRAND-06's per-variant distinguishability

**File:** `sourcerer/branding/dev/locales/en-US/brand.properties:7`, `sourcerer/branding/release/locales/en-US/brand.properties:7`

**Issue:** Both variants' `brand.properties` set `brandFullName=Sourcerer` — the files are byte-identical (confirmed via diff). Meanwhile the two variants' `brand.ftl` correctly diverge: dev's `-brand-full-name = Sourcerer Dev` (`sourcerer/branding/dev/locales/en-US/brand.ftl:8`) vs. release's `-brand-full-name = Sourcerer` (`sourcerer/branding/release/locales/en-US/brand.ftl:8`). Any UI surface in this Firefox version that still reads the legacy non-Fluent `brand.properties` string bundle (rather than the Fluent `-brand-full-name` term) — the properties file is still packaged via `locales/jar.mn`'s `locale/branding/brand.properties (en-US/brand.properties)` mapping in both trees — renders "Sourcerer" for both dev and release, identical to each other, defeating the entire point of shipping two branding variants (BRAND-06's stated purpose). `verify-branding-identity.mjs`'s brand-full-name surface (correctly fixed for CR-01) only reads `brand.ftl`, so this divergence is invisible to the phase's own automated checks — a green `verify-phase-03` run does not prove the two variants are visually distinguishable everywhere the requirement needs them to be.

**Fix:** Make `brand.properties` per-variant, matching `brand.ftl`:

```properties
# sourcerer/branding/dev/locales/en-US/brand.properties
brandShorterName=Sourcerer
brandShortName=Sourcerer
brandFullName=Sourcerer Dev
```

and add a `brand-properties`-equivalent surface (or extend the existing
brand-full-name surface) to `verify-branding-identity.mjs` so this file is
asserted per-variant the same way `brand.ftl` now is — otherwise this exact
regression can recur silently.

### WR-02: `aboutDialog.css` is shipped in both branding trees but never packaged — dead file, unreachable at the `chrome://branding/content/aboutDialog.css` URI upstream's own `aboutDialog.xhtml` requests

**File:** `sourcerer/branding/dev/content/aboutDialog.css`, `sourcerer/branding/release/content/aboutDialog.css` (byte-identical, confirmed via diff); `sourcerer/branding/dev/content/jar.mn:6-9`, `sourcerer/branding/release/content/jar.mn:6-9`

**Issue:** Both trees' `content/jar.mn` is a deliberate stub that maps only the five `icon*.png` entries into `content/branding/` and explicitly documents, in its own header comment, that it does **not** reference `aboutDialog.css`, `about-logo*`, or `about-wordmark.svg`. Yet `content/aboutDialog.css` exists as a real, non-trivial file (dark-theme `#aboutDialogContainer`/`#bottomBox`/`#rightBox` rules) in both trees. Since neither `jar.mn` maps it into `browser.jar`, it is never installed under `chrome://branding/content/` — it is dead source, unreachable at runtime. This matters beyond simple dead-code: Firefox's own `browser/base/content/aboutDialog.xhtml` unconditionally links `chrome://branding/content/aboutDialog.css`, so the About dialog will resolve that chrome URI to nothing and silently render without the intended dark background/logo sizing — compounding the already-known gap that `chrome://branding/content/about-logo@2x.png` is also unshipped. The file's presence gives the false impression this styling is live.

**Fix:** Either wire it in —

```
# content/jar.mn
  content/branding/aboutDialog.css              (aboutDialog.css)
```

— or delete the file from both trees if the dark-theme About dialog was intentionally descoped for this phase (matching the jar.mn comment's own stated intent), so the tree doesn't carry a plausible-looking file that silently does nothing.

### WR-03: `sourcerer/distribution/policies.json` has no build-time wiring and no verify-time coverage proving it reaches a built objdir

**File:** `sourcerer/distribution/policies.json`; documented manual step at `docs/BUILD.md:380-387`

**Issue:** `policies.json` carries `DisableAppUpdate`, `DisableTelemetry`, and `DisableFirefoxStudies` — three of this phase's own BRAND-04 lockdown guarantees. No `moz.build` anywhere in the tree references `sourcerer/distribution/` (confirmed: no `moz.build` file under `sourcerer/distribution/`, and no other `moz.build` in the repo mentions `distribution`), so the only path that ever installs this file into a built tree is the manual command `docs/BUILD.md` documents: `cp sourcerer/distribution/policies.json objdir/dist/bin/distribution/policies.json`, which the doc itself says "must be re-copied after any clobber." Neither `scripts/verify-phase-03.sh` nor `scripts/verify-endpoints.sh` asserts that `objdir/dist/bin/distribution/policies.json` exists or matches the source file in a built tree — the three policies it encodes have zero automated coverage. A developer (or CI, once it builds Firefox) who clobbers `objdir/` and rebuilds without remembering the manual copy ships a binary with `DisableAppUpdate`/`DisableTelemetry`/`DisableFirefoxStudies` silently reverted to unset, and nothing in this phase's verification suite would catch it.

**Fix:** At minimum, add a quick check (in `verify-phase-03.sh --quick`, since it needs no browser launch) asserting `objdir/dist/bin/distribution/policies.json` exists and its content matches `sourcerer/distribution/policies.json` byte-for-byte. Longer-term, wire the copy into the build itself via a `moz.build` `FINAL_TARGET_FILES.distribution` rule (or an equivalent packaging hook) so the manual step is not a standing operational risk.

## Info

### IN-01: `firefox-bidi.mjs`'s header comment is still stale (unfixed since 03-REVIEW.md)

**File:** `scripts/lib/firefox-bidi.mjs:1-3`

**Issue:** The file's opening comment still reads "Zero-dependency WebDriver BiDi driver for `objdir/dist/bin/firefox`, the Firefox build this repo already produces (Phase 1)." `FIREFOX_BIN` was repointed to `objdir/dist/bin/sourcerer` in this same phase (`scripts/lib/firefox-bidi.mjs:39`), and a second, correct comment block further down (lines 32-38) already documents the rename — the top header was never updated to match. This was flagged in the prior review (IN-01) and is still present verbatim; it was evidently out of scope for the two gap-closure plans that addressed CR-01/CR-02.

**Fix:** Update the opening comment's binary name to `sourcerer`, or delete the now-redundant restatement and let the lines-32-38 comment be the single source of truth.

---

_Reviewed: 2026-08-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
