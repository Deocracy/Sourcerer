---
phase: 03-branded-firefox-fork
fixed_at: 2026-08-22T19:30:34Z
review_path: .planning/phases/03-branded-firefox-fork/03-REVIEW.md
iteration: 1
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-08-22T19:30:34Z
**Source review:** .planning/phases/03-branded-firefox-fork/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 1 (fix_scope: critical_warning — IN-01 excluded, info tier)
- Fixed: 1
- Skipped: 0

Verification ran in the main checkout (`workflow.use_worktrees=false` in
`.planning/config.json` — no isolated worktree was created for this run).

## Fixed Issues

### WR-01: `branding-variant-divergence`'s real check silently requires two full Firefox builds under `--quick`, undocumented and inconsistent with `--quick`'s own stated contract

**Files modified:** `scripts/verify-phase-03.sh`, `docs/BUILD.md`
**Commit:** 5569379
**Applied fix:** Chose option (a) from the review's Fix section (smallest fix
that keeps the check meaningful): moved `check_branding_variant_divergence`
(the real, tree-reading half) out of the base `CHECKS` array and into the
non-`--quick` branch, alongside `verify-branding-identity-dev`/`-release`,
since it shares the same "needs a built tree" cost profile. Its self-test
(`check_branding_variant_divergence_self_test`) stayed in the base array —
it synthesizes its own temp files via `mktemp` and never touches `objdir/`
or `objdir-release/`, so it is genuinely cheap and consistent with every
other `--quick` check.

Updated the `--quick` header comment (`scripts/verify-phase-03.sh:10-24`) to
list the current full set of `--quick` checks (including
`branding-variant-divergence-self-test`) and explicitly state that
`branding-variant-divergence` itself requires a full dev **and** release
build and runs only in full mode, never under `--quick`.

Added a paragraph to `docs/BUILD.md`'s "Telling a dev build from a release
build (BRAND-06)" section stating the same constraint, so the check's real
prerequisites are documented next to its description rather than only in
the script comment. The "Verifying a fresh clone" section was left
unchanged — it never invokes `scripts/verify-phase-03.sh` at all (a
pre-existing gap outside this finding's scope), so it had no incorrect
claim to correct.

**Verification (post-fix, this repo's current tree, which already has both
`objdir/` and `objdir-release/` built):**
- `bash scripts/verify-phase-03.sh --quick` → exit 0, 9 checks, all PASS.
  `branding-variant-divergence` (the real, build-dependent check) no longer
  runs under `--quick`; only its self-test does.
- `bash scripts/verify-phase-03.sh` (full) → exit 0, 14 checks, all PASS,
  including `branding-variant-divergence: PASS`.

Total check count is unchanged (14 in full mode, same as before the fix);
`--quick`'s count dropped from 10 to 9 because the build-dependent check
moved to full-only.

Neither `upstream/` nor `patches/` were touched; no release branding tree
file was modified.

## Skipped Issues

None — the one in-scope finding (WR-01) was fixed. IN-01 was out of scope
for `fix_scope: critical_warning` (info-tier finding) and was not attempted.

---

_Fixed: 2026-08-22T19:30:34Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
