---
phase: 03-branded-firefox-fork
plan: 10
subsystem: build
tags: [branding, trademark, manual-verification, gap-closure]

requires:
  - phase: 03-branded-firefox-fork
    provides: "Both branding variants (dev/release) built, verify-phase-03.sh aggregator at 12 checks (03-06 through 03-09)"
provides:
  - "Durable manual-verification record (03-MANUAL-VERIFICATION.md) for both of Phase 3's human-only checkpoints"
  - "Item A (dev-vs-release distinguishable at a glance): PERFORMED, FAILED -- gap open"
  - "Item B (branding-tree trademark-asset review): PERFORMED, PASSED -- 0 Mozilla marks found"
  - "03-VALIDATION.md's BRAND-06 and BRAND-02 Manual-Only rows cross-referenced to the record"
affects: [phase-04-planning, any-future-branding-work]

actuals:
  tokens: 7633
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Manual-verification worksheet pattern: generate a deterministic three-tree file-comparison table via find+sort, leave verdict column empty for a human, record findings without editing the branding tree inside the checkpoint itself"

key-files:
  created:
    - .planning/phases/03-branded-firefox-fork/03-MANUAL-VERIFICATION.md
  modified:
    - .planning/phases/03-branded-firefox-fork/03-VALIDATION.md

key-decisions:
  - "Item A's outcome is recorded as observed (FAILED) and not re-run to match the expected outcome, per the plan's explicit prohibition against editing checkpoint findings to agree with expectations"
  - "Item B's per-row table tally (6 neutral / 9 Sourcerer-authored / 0 Mozilla-mark) is treated as authoritative over the reviewer's dictated summary counts (7/8), which don't match their own itemised file lists; the discrepancy is recorded, not silently resolved -- the Mozilla-mark count (0) is identical under either reading"
  - "Plan closes as status: halted, not complete -- Item A's FAILED verdict means the phase's human-verification gate is not satisfied even though the automated aggregator (verify-phase-03.sh) is green"

patterns-established:
  - "N/A -- see tech-stack.patterns"

requirements-completed: []

coverage:
  - id: D1
    description: "Item A (BRAND-06 human_verification): dev vs release branding distinguishable at a glance on a real desktop"
    requirement: BRAND-06
    verification:
      - kind: manual_procedural
        ref: "03-MANUAL-VERIFICATION.md Item A outcome block"
        status: fail
    human_judgment: true
    rationale: "Perceptual distinguishability judgment; a human performed it on a real desktop session and the observed result was FAILED, not the expected PASS -- recorded as observed per the plan's non-adjustment rule"
  - id: D2
    description: "Item B (BRAND-02 human_verification): branding trees carry no unrecognised Mozilla trademark asset"
    requirement: BRAND-02
    verification:
      - kind: manual_procedural
        ref: "03-MANUAL-VERIFICATION.md Item B outcome block"
        status: pass
    human_judgment: true
    rationale: "Recognising an unknown-shaped trademark asset is a human judgment the filename-pattern automated guard cannot perform; a human reviewed all 15 carried-forward files (opened, not judged by name) in both variants and found zero Mozilla marks"

duration: "~13 hours wall-clock (spans a checkpoint pause for human review of Item B between the Task-2 and Task-3 commits); active executor task time is small, most elapsed time is the human's own review session"
completed: 2026-08-22
status: halted
---

# Phase 3 Plan 10: Manual Verification Record Summary

**Both of Phase 3's human-only checkpoints were performed and durably recorded: Item A (dev-vs-release distinguishable at a glance) FAILED on a real desktop session; Item B (trademark-asset review) PASSED with zero Mozilla marks found across 15 files. The plan closes as halted, not complete -- Phase 3's human-verification gate is NOT satisfied despite the automated 12/12 aggregator staying green.**

## Item A FAILED -- this is the headline finding

Item A's expected outcome ("dev shows 'Sourcerer Dev' in the title, release shows 'Sourcerer'; the two icon sets are visually distinguishable at a glance") did **not** hold when actually tested on a real desktop session (2026-08-22, observer Christopher Colantuono, both variants launched concurrently side by side on Wayland). Neither variant's window title was even visible -- both `sourcerer` builds draw client-side decorations (tabs-in-titlebar), so no WM-rendered title bar exists to carry the display name in normal use. The icon badge (an orange corner dot on the dev variant) was reported as "inconclusive" by the observer, who could not tell whether it was intentional or a rendering artifact, and stated plainly: "I dont really see a diffrece."

Root-cause evidence gathered after the verdict (documented in the record, not used to override the human judgment): `brand.properties` is byte-identical between variants (`brandFullName=Sourcerer` in both -- unsuffixed), contradicting dev's own `brand.ftl` (`-brand-full-name = Sourcerer Dev`). The automated 12/12 gate stayed green throughout because `verify-branding-identity-brand-ftl-control` (added 03-07) reads only `brand.ftl`; nothing in the automated suite reads `brand.properties`, checks short/shorter-name divergence, or judges perceptual icon distinctiveness or whether a title even renders on this desktop environment -- exactly why this item was designated human-only.

This is a real, unresolved gap in the branding tree, not an artifact of how the verification was run (the side-by-side concurrent launch used is a *stricter* test than the plan's sequential-launch instructions, and the result was still a failure). It requires a follow-up plan to fix `brand.properties`, and/or address client-side decorations hiding the title bar, and/or make the icon badge more perceptible, then re-run Item A.

## Item B PASSED

All 15 files carried forward into `sourcerer/branding/{dev,release}` (every file present in either Sourcerer tree, compared against `upstream/browser/branding/unofficial/`) were reviewed in both variant copies -- opened and read, not judged by filename. Zero files classified as a Mozilla trademark asset. 6 files are neutral scaffolding (`moz.build`, `content/moz.build`, `locales/moz.build`, `locales/jar.mn`, `configure.sh`, `content/aboutDialog.css`); 9 are Sourcerer-authored (`content/jar.mn`, `pref/firefox-branding.js`, the 5 icon PNGs, `brand.ftl`, `brand.properties`). One recognised and deliberate textual use of "Firefox" exists (`-brand-product-name = Firefox` in `brand.ftl`, per decision D-78's UA-parity rationale) -- a textual product-name reference, not a carried-forward trademark asset, and not counted toward the Mozilla-mark tally. All upstream trademark assets (`Assets.car`, `about-logo*`, wordmark SVGs, `.icns`/`.ico` files, etc.) are confirmed present only in the upstream unofficial-branding tree and absent from both Sourcerer trees.

**Discrepancy recorded, not silently resolved:** the reviewer's dictated summary stated category counts as "Neutral scaffolding (7)" and "Sourcerer-authored (8)," but the reviewer's own itemised file lists under each label total only 6 and 7 respectively, leaving `brand.ftl` and `brand.properties` uncovered by the itemised lists. The worksheet's per-row table tally (6 neutral / 9 Sourcerer-authored / 0 Mozilla-mark, summing to all 15 rows) is what the record treats as authoritative. The Mozilla-mark count -- the fact this checkpoint exists to establish -- is zero under either reading, so the discrepancy does not affect Item B's PASS verdict.

## Performance

- **Tasks:** 3/3 completed
- **Commits:** 3 (`80e479e`, `d7efd32`, `b8dba92`)
- **Files modified:** 2 (`03-MANUAL-VERIFICATION.md` created, `03-VALIDATION.md` cross-referenced)

## Task Commits

1. **Task 1: Build the manual-verification worksheet and record the final phase gate** - `80e479e` (docs) -- worksheet scaffolding, deterministic 64-row three-tree comparison table, live 12/12 `verify-phase-03.sh` run recorded verbatim
2. **Task 2: Human verification A** - `d7efd32` (docs) -- Item A outcome recorded as observed: **FAILED**
3. **Task 3: Human verification B** - `b8dba92` (docs) -- Item B outcome recorded as observed: **PASSED**; both relevant `03-VALIDATION.md` Manual-Only rows cross-referenced; `verify-phase-03.sh` re-run after the edit, exit 0, 12/12 unchanged

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `.planning/phases/03-branded-firefox-fork/03-MANUAL-VERIFICATION.md` -- durable record: both items' verbatim test/expected/why-human text, launch commands, outcome blocks with literal observations, the 64-row file-comparison table with per-row verdicts, and the final phase-gate output
- `.planning/phases/03-branded-firefox-fork/03-VALIDATION.md` -- BRAND-06 and BRAND-02 Manual-Only rows now point at the record with date performed and result; the other two Manual-Only rows (tiered-loop timings, live chrome window title) are untouched, as scoped

## Decisions Made

- Item A's FAILED result stands as observed; it was not re-run, softened, or edited to match the plan's expected outcome. This is a real defect, not a false negative -- see Root-cause evidence above.
- Item B's per-row table verdicts are treated as authoritative over the reviewer's dictated summary counts, since the two disagree by exactly the two brand.ftl/brand.properties files and the table is the version every row was individually adjudicated against.
- This plan closes with `status: halted`, not `complete`, in the SUMMARY frontmatter, because a plan whose designed checkpoint recorded a FAILED verification is not a clean completion -- consistent with the frontmatter guidance's definition of `halted` ("a gate failure... any other intentional non-completion").

## Deviations from Plan

None in the mechanical sense -- both checkpoints were performed by a human on a real desktop session exactly as the plan required, and neither was auto-approved or satisfied by a script. The deviation is in the *outcome*: Item A's real-world result did not match its expected outcome. Per the plan's own prohibition ("A checkpoint whose observation contradicts its expected outcome is recorded as observed and escalated; it is not re-run until it agrees"), this is recorded as a finding, not fixed inline, and not treated as a Rule 1/2/3 auto-fixable bug within this plan's scope -- fixing the underlying `brand.properties`/title-bar/icon-badge defects is out of scope for a plan whose own `must_haves.prohibitions` states "No source file, script, or requirement document is modified by this plan -- it records evidence, it does not change behavior."

## Issues Encountered

**Item A failure (open gap):** dev and release branding are not distinguishable at a glance on this desktop. Root causes identified but not fixed (out of scope for this evidence-only plan): (1) `brand.properties` is byte-identical between variants despite `brand.ftl` differing -- an internal contradiction within the dev variant; (2) both builds use client-side window decorations, so no WM title bar renders in normal use on this desktop environment; (3) the icon badge (small orange corner dot) is not confidently perceptible at typical taskbar/favicon sizes. A follow-up plan is needed to address these and re-run Item A before Phase 3's human-verification gate can be considered satisfied.

**Reviewer count discrepancy (Item B, non-blocking):** see Decisions Made above -- recorded, does not affect the PASS verdict.

## Next Phase Readiness

**Phase 3's human-verification gate is NOT satisfied.** The automated `bash scripts/verify-phase-03.sh` aggregator is green (12/12, re-confirmed twice in this plan), and Item B (trademark-asset review) passed cleanly, but Item A (dev-vs-release distinguishable at a glance) is an open, unresolved gap. Phase 4 planning or any milestone-close activity that treats Phase 3 as fully verified should account for this: either a follow-up gap-closure plan fixes the `brand.properties` mismatch and title/icon distinguishability and re-runs Item A, or the gap is explicitly accepted and documented as a known limitation before Phase 3 is considered closed.

---
*Phase: 03-branded-firefox-fork*
*Completed: 2026-08-22*
