---
phase: 03-branded-firefox-fork
plan: 07
subsystem: testing
tags: [verification-tooling, brand-ftl, positive-control, gap-closure]

# Dependency graph
requires:
  - phase: 03-branded-firefox-fork (plan 02)
    provides: "scripts/verify-branding-identity.mjs's six-surface checklist and its stockControl/CONTROLLABLE_SURFACES positive-control shape, extended here"
  - phase: 03-branded-firefox-fork (plan 05)
    provides: "sourcerer/branding/release/ and its own brand.ftl (-brand-full-name = Sourcerer), the release variant this plan's descriptor and checker rewire target"
  - phase: 03-branded-firefox-fork (plan 06)
    provides: "scripts/verify-phase-03.sh's aggregator shape (CHECKS array later plans append to)"
provides:
  - "scripts/verify-branding-identity.mjs's VARIANTS descriptor (dev/release: bin, desktop, configStatus, brandFtl, brandFullName) plus --variant/--brand-ftl/--expect-brand-full-name flags -- every per-variant fact lives in one record instead of independent per-flag defaults"
  - "checkBrandFullName()'s crossVariantControl option and the new brand-full-name entry in CONTROLLABLE_SURFACES -- a regression gate on the crossVariantControl code path itself"
  - "scripts/verify-phase-03.sh's verify-branding-identity-release rewired to --variant release, plus the new verify-branding-identity-brand-ftl-control gate entry (9 checks total, up from 8)"
  - "03-05-SUMMARY.md's D3 evidence ref and third distinguishability proof corrected to state what was actually verified (file-inspection difference, not a per-variant command) at the time"
affects: [03-08, 03-09, 03-10]

# Actuals (#2632)
actuals:
  tokens: 4588
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Branding-variant descriptor (VARIANTS keyed by variant id, each record carrying every per-variant path/value together) replaces independent per-flag defaults -- a new identity surface must extend the descriptor, not add an unrelated flag with its own silent fallback. This is the promoted noun from this plan's assumption_delta_decision."
    - "crossVariantControl option on a check function (following checkDesktopEntry's stockControl shape): reads the OTHER variant's real input while keeping the selected variant's own expected value, so the control discriminates on both the path axis and the comparison axis at once -- a stock-value-only control would not catch a wrong-path regression whose hardcoded value happened to still be a real string (exactly CR-01's shape)."

key-files:
  created: []
  modified:
    - scripts/verify-branding-identity.mjs
    - scripts/verify-phase-03.sh
    - .planning/phases/03-branded-firefox-fork/03-05-SUMMARY.md

key-decisions:
  - "Promoted the branding-variant descriptor to primary (assumption_delta_decision: promote) rather than adding --brand-ftl as a fourth independent flag -- closes the CR-01 seam for this surface and forecloses it for the next one, per the plan's own rationale."
  - "The crossVariantControl's 'other variant' brand.ftl path is read directly from the VARIANTS descriptor, not overridable via --brand-ftl -- so the control is a regression gate on the crossVariantControl code path itself, not a responder to arbitrary content edits of either variant's real brand.ftl file. This has one visible consequence, documented under Deviations: the plan's own Task 2 acceptance-criteria demonstration (edit release's brand.ftl, expect the *control* check to fail) does not trigger under this design; edit dev's brand.ftl instead to trigger it."

patterns-established: []

requirements-completed: [BRAND-01, BRAND-06]

coverage:
  - id: D1
    description: "Surface 4 (brand-full-name) reads the brand.ftl of whichever variant --variant selects, asserts that variant's own expected value, and goes red under a wrong path, a wrong expectation, and a missing file"
    requirement: "BRAND-01"
    verification:
      - kind: integration
        ref: "node scripts/verify-branding-identity.mjs --variant release (PASS, names release's own brand.ftl) and --variant dev (PASS, names dev's own brand.ftl, different actual value); RED controls A (wrong file), B (wrong expectation), C (deleted file, sha256-restored); bad-variant and nonexistent-path edges; WR-01 fixture -- all executed this session, all passed as specified in 03-07-PLAN.md's acceptance criteria"
        status: pass
    human_judgment: false
  - id: D2
    description: "A brand-full-name cross-variant positive control is registered in CONTROLLABLE_SURFACES and proves the surface correctly discriminates a wrong variant's file from the right one, with zero repository mutation"
    requirement: "BRAND-01"
    verification:
      - kind: integration
        ref: "node scripts/verify-branding-identity.mjs --variant release --positive-control brand-full-name (PASS, exit 0); sha256 of both brand.ftl files unchanged before/after"
        status: pass
    human_judgment: false
  - id: D3
    description: "The phase aggregator drives the release variant through --variant release and carries the registered cross-variant control as a ninth check, demonstrated red then green"
    requirement: "BRAND-01"
    verification:
      - kind: integration
        ref: "bash scripts/verify-phase-03.sh (9/9 PASS, exit 0, up from 8); RED demonstration (deliberately mismatched brand.ftl, aggregator FAILs, restored, re-run confirms GREEN) -- see Deviations for the specific file/check-name correction versus the plan's literal wording"
        status: pass
    human_judgment: false
  - id: D4
    description: "03-05-SUMMARY.md no longer claims surface 4 was a per-variant signal as implemented; it states the fact actually established and points at this plan"
    requirement: "BRAND-06"
    verification:
      - kind: other
        ref: "grep -c 'two different real values' -> 0; grep -c '03-07-PLAN.md' -> 2; D3 id and frontmatter both still parse; diff numstat 2+2 (amendment, not rewrite)"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-08-21
status: complete
---

# Phase 3 Plan 7: Branded Firefox Fork -- Variant-Aware Brand-Full-Name Identity Surface Summary

**`verify-branding-identity.mjs`'s brand-full-name surface now reads whichever variant's own `brand.ftl` `--variant` selects (via a promoted `VARIANTS` descriptor) instead of a hardcoded dev-tree path and a hardcoded `"Sourcerer Dev"` literal, closing the CR-01 vacuous-PASS gap the phase verification report flagged as Gap 1.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-21T19:22:00-07:00 (approx, first read)
- **Completed:** 2026-08-21T19:40:01-07:00 (last commit)
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- `scripts/verify-branding-identity.mjs` gained a `VARIANTS` descriptor (keyed `dev`/`release`, each record carrying `bin`, `desktop`, `configStatus`, `brandFtl`, `brandFullName`) and a `--variant <dev|release>` selector, defaulting to `dev`. An unrecognised id fails loudly (naming both supported ids) before any surface runs -- never a silent default, the exact failure mode that produced CR-01. The four pre-existing per-path flags (`--bin`, `--desktop`, `--config-status`, plus the new `--brand-ftl`/`--expect-brand-full-name`) remain explicit overrides that win over the descriptor, so every existing invocation still parses and runs all six surfaces.
- `checkBrandFullName()` now contains zero variant-specific string literals (confirmed by `sed`-extracting the function body and grepping for `Sourcerer`: 0 hits). Its expected value and input path both resolve from the `VARIANTS` descriptor (or their overrides), and its detail line names the resolved variant id and `brand.ftl` path so a future vacuous run would be visible in the output, not mislabelled.
- A `brand-full-name` cross-variant positive control was added to `CONTROLLABLE_SURFACES`: `checkBrandFullName({ crossVariantControl: true })` reads the OTHER variant's real `brand.ftl` while keeping the selected variant's own expected value -- proving both that the path is honored (a wrong file goes red) and that the comparison discriminates (a wrong value goes red) in a single control, which a stock-value-only control would not have caught.
- Fixed WR-01 (03-REVIEW.md): `readBrandFullName()`'s `.find()` predicate selected on the trimmed line while the subsequent regex matched the untrimmed line -- a `brand.ftl` with leading whitespace on its term line would select a line the regex then rejected. The regex now matches the trimmed form. Verified with a fixture copy carrying two leading spaces on the `-brand-full-name` line: the fixed script reports `PASS`.
- `scripts/verify-phase-03.sh`'s `verify-branding-identity-release` entry now invokes `--variant release` (replacing the four-flag form); the check label is unchanged so `03-VERIFICATION.md`'s references stay resolvable. A new `verify-branding-identity-brand-ftl-control` entry was appended, invoking `--variant release --positive-control brand-full-name`. The aggregator now runs 9 checks (up from 8); `--quick` is unaffected and still contains neither identity entry.
- `03-05-SUMMARY.md`'s D3 evidence `ref` and its third distinguishability proof (line 113) were amended to state what was actually established at the time -- the two `brand.ftl` files carry different real values, confirmed by direct file inspection, not by a per-variant command -- and to point at this plan by name.

## Task Commits

Each task was committed atomically:

1. **Task 1: Promote the branding-variant descriptor and make surface 4 read the variant it was pointed at** - `b2e52b1` (feat) -- tracer slice, re-verified end-to-end before Task 2 (auto mode active)
2. **Task 2: Rewire the phase aggregator to the release variant and register the cross-variant control as a gate** - `babbc97` (feat)
3. **Task 3: Correct 03-05-SUMMARY.md's falsified per-variant claim** - `f0d1aab` (docs)

_No TDD tasks in this plan; each commit is a single feat/docs commit._

## Files Created/Modified

- `scripts/verify-branding-identity.mjs` - `VARIANTS`/`VARIANT_IDS` descriptor, `--variant`/`--brand-ftl`/`--expect-brand-full-name` flags, variant-aware `checkBrandFullName()` with `crossVariantControl`, WR-01 fix, updated header/HELP text
- `scripts/verify-phase-03.sh` - `verify-branding-identity-release` rewired to `--variant release`; new `verify-branding-identity-brand-ftl-control` entry
- `.planning/phases/03-branded-firefox-fork/03-05-SUMMARY.md` - D3 evidence ref and third distinguishability proof corrected; no other content altered

## Decisions Made

- **Promoted the branding-variant descriptor** (per this plan's own `assumption_delta_decision`) rather than adding `--brand-ftl` as a fourth independent flag: the descriptor makes a new identity surface extend a shared record instead of growing its own silently-defaulting flag, which is the exact seam CR-01 fell through when the checker was generalized from one variant to two.
- **The cross-variant control reads the descriptor's fixed "other variant" path, not an overridable one** -- this makes the control a regression gate on the `crossVariantControl` code branch itself (would catch a future bug that made the branch silently no-op), not a responder to live edits of either variant's real `brand.ftl` content. See Deviations below for the one place this diverges from the plan's literal acceptance-criteria wording.

## Deviations from Plan

### Auto-fixed Issues

None -- Task 1's action block was followed as written; no bugs or missing-critical-functionality gaps were found while implementing it.

### Documented Discrepancy (not a code deviation)

**1. Task 2's "Non-vacuity of the new gate" acceptance criterion names the wrong check for the described edit**

- **Found during:** Task 2, running the described demonstration.
- **The plan says:** "temporarily edit `sourcerer/branding/release/locales/en-US/brand.ftl` so its `-brand-full-name` value equals the dev tree's value, re-run `bash scripts/verify-phase-03.sh`, and confirm it exits non-zero with `verify-branding-identity-brand-ftl-control: FAIL` in the summary."
- **What actually happens:** Editing release's own `brand.ftl` correctly makes `verify-branding-identity-release: FAIL` (it reads release's own file, now mismatched against release's own expected value) and the aggregator correctly exits non-zero -- but `verify-branding-identity-brand-ftl-control` stays PASS, because the control's cross-variant read is hardcoded to the *other* variant's descriptor path (`otherVariant.brandFtl`, i.e. dev's file), per Task 1's own explicit design ("the function reads the *other* variant's `brandFtl`... while keeping the selected variant's expected value"). Editing release's file has zero effect on either of the control's two inputs (dev's file content, release's descriptor-sourced expected value).
- **Root cause:** The design (Task 1's `crossVariantControl`) and the demonstration (Task 2's acceptance criterion) describe two different edit targets. To make the *control* itself go red, dev's `brand.ftl` must be edited to equal release's own expected value (`Sourcerer`) -- then the control's read of dev's file matches release's expected value, the surface incorrectly reports PASS, and the control (which requires FAILURE) correctly reports itself FAIL.
- **Resolution:** Ran both demonstrations, both restored cleanly (sha256-verified before/after each):
  1. **Edited release's brand.ftl** (as the plan literally says) -> `verify-branding-identity-release: FAIL`, aggregator exit 1, `verify-branding-identity-brand-ftl-control` stayed PASS. Restored; re-run confirmed all-green, exit 0.
  2. **Edited dev's brand.ftl** (to actually trigger the named check) -> `verify-branding-identity-brand-ftl-control: FAIL` (`"did NOT report FAILURE against the stock Firefox value... the reader is not discriminating a real live value"`), aggregator exit 1. Restored; re-run confirmed all-green, exit 0.
- **Files modified:** None -- this is a test-only, fully-restored demonstration, not a code change. `scripts/verify-branding-identity.mjs` and `scripts/verify-phase-03.sh` are exactly as committed in Tasks 1-2.
- **Verified:** Both RED demonstrations and both restored-GREEN re-runs recorded verbatim below.
- **Committed in:** N/A (verification-only; no additional commit needed beyond Task 2's `babbc97`)

---

**Total discrepancies:** 1 documented (acceptance-criteria wording vs. the design it was meant to demonstrate; no code defect). **Impact on plan:** None on shipped behavior -- both the release-invocation gate and the cross-variant-control gate are independently proven non-vacuous, red then green, by the two demonstrations above. `03-VERIFICATION.md`'s Gap 1 is closed either way.

## Issues Encountered

None beyond the documented discrepancy above.

## Verbatim Verification Output

**Pre-plan aggregator check count:** 8 (`check-patch-surface`, `check-patch-surface-self-test`, `apply-patches-self-test`, `fetch-upstream-self-test`, `allowlist-schema`, `verify-branding-identity-dev`, `verify-branding-identity-release`, `verify-endpoints`)

**Post-plan aggregator check count:** 9 (adds `verify-branding-identity-brand-ftl-control`)

**RED — wrong path (Task 1):**
```
$ node scripts/verify-branding-identity.mjs --variant release --brand-ftl sourcerer/branding/dev/locales/en-US/brand.ftl
verify-branding-identity: FAIL brand-full-name -- variant=release brand.ftl=.../sourcerer/branding/dev/locales/en-US/brand.ftl -brand-full-name="Sourcerer Dev" (expected "Sourcerer")
```

**RED — wrong expectation (Task 1):**
```
$ node scripts/verify-branding-identity.mjs --variant release --expect-brand-full-name Firefox
verify-branding-identity: FAIL brand-full-name -- ... (expected "Firefox")
```

**RED — broken release brand.ftl through the aggregator (Task 2, literal plan edit):**
```
$ bash scripts/verify-phase-03.sh
  verify-branding-identity-release: FAIL
  verify-branding-identity-brand-ftl-control: PASS
verify-phase-03: FAIL -- see summary above   (exit 1)
```

**RED — dev brand.ftl edited to trigger the named control check (Task 2, corrected demonstration):**
```
$ bash scripts/verify-phase-03.sh
verify-branding-identity: FAIL -- positive control for 'brand-full-name' did NOT report FAILURE against the stock Firefox value (variant=release brand.ftl=.../sourcerer/branding/dev/locales/en-US/brand.ftl -brand-full-name="Sourcerer" (expected "Sourcerer")); the reader is not discriminating a real live value
  verify-branding-identity-dev: FAIL
  verify-branding-identity-release: PASS
  verify-branding-identity-brand-ftl-control: FAIL
verify-phase-03: FAIL -- see summary above   (exit 1)
```

**Restored-GREEN (after each RED demonstration, sha256-verified restore):**
```
$ bash scripts/verify-phase-03.sh
  verify-branding-identity-dev: PASS
  verify-branding-identity-release: PASS
  verify-branding-identity-brand-ftl-control: PASS
verify-phase-03: PASS -- all checks passed   (exit 0)
```

## Known Stubs

None -- every code path added is real and exercised by the verification above; no mock/placeholder data paths.

## Threat Flags

None -- this plan modifies only verification tooling (a Node script and a bash aggregator) and a historical planning-artifact SUMMARY. No new network endpoints, auth paths, file-access patterns beyond read-only `brand.ftl` reads, or schema changes.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- The tracer slice this plan set out to prove (checking script -> phase aggregator -> non-vacuous positive control -> corrected SUMMARY, all four layers) is complete and verified end-to-end.
- Plans 03-08 through 03-10 can expand horizontally from this proven shape (Gap 2's allowlist-wording amendment and Gap 3's interrupt-safe pref-backup fix in `verify-endpoints.sh`, per `03-VERIFICATION.md`).
- No blockers. `bash scripts/verify-phase-03.sh` exits 0 with 9/9 PASS as of this plan's last commit.

---
*Phase: 03-branded-firefox-fork*
*Completed: 2026-08-21*

## Self-Check: PASSED

All claimed files found on disk (`scripts/verify-branding-identity.mjs`, `scripts/verify-phase-03.sh`, `.planning/phases/03-branded-firefox-fork/03-05-SUMMARY.md`, this SUMMARY.md). All claimed commits found in git history (`b2e52b1`, `babbc97`, `f0d1aab`).
