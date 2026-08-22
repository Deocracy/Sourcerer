---
phase: 03-branded-firefox-fork
reviewed: 2026-08-22T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - scripts/verify-phase-03.sh
  - scripts/verify-branding-identity.mjs
  - sourcerer/branding/dev/locales/en-US/brand.properties
  - sourcerer/branding/dev/pref/firefox-branding.js
  - docs/BUILD.md
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 3: Code Review Report (incremental re-review, gap-closure 03-11)

**Reviewed:** 2026-08-22
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

This is a scoped re-review of commits `5cd7293` and `6590b1d` (plan `03-11`),
which close BRAND-06's variant-distinguishability gap: `brand.properties`
`brandFullName` now diverges per variant (`Sourcerer Dev` vs `Sourcerer`,
fixing the previously-reported `03-REVIEW.md` WR-01), a dev-only
`browser.tabs.inTitlebar = 0` default was added, `verify-branding-identity.mjs`'s
brand-full-name surface now reads and cross-checks `brand.properties` in
addition to `brand.ftl`, a new `branding-variant-divergence` check (+
self-test) was added to `verify-phase-03.sh`, and `docs/BUILD.md` gained a
section documenting the divergence.

Direct inspection of the diff (`git diff 5cd7293^ 6590b1d`) confirms all of
the claimed behavior: the two data files changed exactly as described, the
new `readBrandPropertiesFullName` reader mirrors the existing
`readBrandFullName`'s trimmed-selection/trimmed-matching contract (correctly
avoiding a reintroduction of the original WR-01 mismatch), and running
`bash scripts/verify-phase-03.sh --quick` against the current tree
confirms `branding-variant-divergence: PASS` and
`branding-variant-divergence-self-test: PASS` alongside every pre-existing
check. No Critical issues were found in the reviewed diff.

One Warning was found: the new `branding-variant-divergence` check was
placed in `verify-phase-03.sh`'s CHECKS array unconditionally (so it also
runs under `--quick`), but unlike its self-test and unlike every other
`--quick` check, its non-self-test half reads from `objdir/dist/bin/...`
and `objdir-release/dist/bin/...` — i.e. it requires **both** the dev and
the release variant to already have been fully compiled (each a ~40-47
minute Tier-3 build per this same `docs/BUILD.md`) before `--quick` can
pass. It happens to pass in this repo's current state because both
`objdir/` and `objdir-release/` already exist here, but the script's own
`--quick` header comment (lines 10-17) was not updated to reflect this new,
heavy prerequisite, and `docs/BUILD.md`'s own "Verifying a fresh clone"
section never builds `objdir-release` at all — so a contributor following
the documented fresh-clone path who then runs `--quick` as a lightweight
sanity check would hit an unexplained hard FAIL naming a missing
`objdir-release` path, not a documented limitation.

## Warnings

### WR-01: `branding-variant-divergence`'s real check silently requires two full Firefox builds under `--quick`, undocumented and inconsistent with `--quick`'s own stated contract

**File:** `scripts/verify-phase-03.sh:10-17` (the `--quick` header comment), `scripts/verify-phase-03.sh:365-375` (`check_branding_variant_divergence`), `scripts/verify-phase-03.sh:442-452` (CHECKS array)

**Issue:** `check_branding_variant_divergence` (lines 369-375) feeds `_branding_variant_divergence_impl` four paths under `objdir/dist/bin/...` and `objdir-release/dist/bin/...`. `_branding_variant_divergence_impl`'s readers (`readPropsFullName`, `readTitlebarPref`) both `process.exit(1)` with `does not exist` if any of the four paths is absent (lines 283-286, 315-318) — there is no skip path, only FAIL. This check (and its self-test, which is cheap and synthesizes its own temp files) was added to the base `CHECKS` array (lines 450-451), which is composed *before* the `if [ "$QUICK" -eq 1 ]` branch, so it runs in both `--quick` and full mode.

This means `--quick` — whose entire documented purpose (lines 10-17) is to avoid expensive prerequisites ("runs only the checks that need no browser launch") — now also silently requires that `objdir-release/` has been fully built at least once (a ~47-minute Tier-3 compile per this same file's "Tier 3" section, `docs/BUILD.md:257-275`), in addition to `objdir/` (the dev build most workflows already produce). No comment in `verify-phase-03.sh`'s header, and no text in `docs/BUILD.md`, states this new prerequisite. Worse, `docs/BUILD.md`'s own "Verifying a fresh clone" section (lines 502-545) — the document's canonical description of what a clean checkout needs to reach a working, verified state — only ever builds `objdir` (via a bare `./mach build`); it never builds `objdir-release`, and it never even invokes `scripts/verify-phase-03.sh`. A contributor who follows that section and then separately runs `bash scripts/verify-phase-03.sh --quick` (a reasonable thing to do, since `--quick` is billed as the fast/no-browser check) gets a hard, unexplained FAIL naming a nonexistent `objdir-release/dist/bin/...` path, with nothing in the docs warning them a second full build is now a precondition of `--quick`.

Confirmed in this repo: `--quick` currently passes only because `objdir/` and `objdir-release/` both already exist here from earlier phase work (verified by running `bash scripts/verify-phase-03.sh --quick`, which reports `branding-variant-divergence: PASS`) — the defect is latent, not currently manifesting as a failure in this environment, but it is a real regression in `--quick`'s documented contract and in "verify a fresh clone" completeness.

**Fix:** Either (a) move `branding-variant-divergence` (the real check only — its self-test is genuinely cheap and can stay in the base list) into the non-`--quick` branch alongside `verify-branding-identity-dev`/`-release`, since it shares the same "needs a built tree" cost profile as those; or (b) if it must stay in `--quick` for parity with `allowlist-doc-consistency`, update the header comment (lines 10-17) to name the new prerequisite explicitly, and add an existence pre-check in `check_branding_variant_divergence` that reports a distinct, actionable message ("objdir-release not built — run `SOURCERER_OBJDIR=objdir-release ... ./mach build` first") rather than falling through to the generic `_branding_variant_divergence_impl` "does not exist" FAIL. Either way, add the `objdir-release` build (or an explicit call-out that it's skipped) to `docs/BUILD.md`'s "Verifying a fresh clone" section so the fresh-clone recipe and `--quick`'s actual prerequisites stay in sync.

## Info

### IN-01: `checkBrandFullName`'s failure detail doesn't distinguish which of `brand.ftl`/`brand.properties` diverged when only one does

**File:** `scripts/verify-branding-identity.mjs:375-380`

**Issue:** `pass = ftlValue === EXPECTED_BRAND_FULL_NAME && propsValue === EXPECTED_BRAND_FULL_NAME` correctly fails if either file disagrees (closing WR-01 from the prior review), but the single `detail` string always reports both values against one shared "(both expected ...)" suffix. If only `brand.properties` regresses (the exact WR-01 scenario), a reader has to mentally diff `ftlValue`/`propsValue` against the expected string themselves rather than the tool naming which file is wrong. Low impact since both raw values are printed, but a one-line improvement would save a step during triage.

**Fix:** Optionally split the failure message, e.g. append `ftl-mismatch` / `properties-mismatch` markers when `ftlValue !== EXPECTED_BRAND_FULL_NAME` or `propsValue !== EXPECTED_BRAND_FULL_NAME` individually, mirroring the itemized-failure style already used in `verify-phase-03.sh`'s `_branding_variant_divergence_impl` (which does report each of its four assertions independently).

---

_Reviewed: 2026-08-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
