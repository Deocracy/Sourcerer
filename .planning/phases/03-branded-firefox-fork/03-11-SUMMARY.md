---
phase: 03-branded-firefox-fork
plan: 11
subsystem: infra
tags: [firefox, branding, fluent, verification-harness, gap-closure]

requires:
  - phase: 03-branded-firefox-fork
    provides: dev/release branding trees, verify-phase-03.sh aggregator, verify-branding-identity.mjs six-surface identity checklist (03-01..03-10)
provides:
  - "branding-variant-divergence check + self-test in verify-phase-03.sh, proving dev/release brand-string and title-bar divergence machine-side"
  - "dev brand.properties brandFullName suffixed to agree with dev brand.ftl (WR-01 closed)"
  - "dev-only browser.tabs.inTitlebar=0 default, painting a real title bar on the dev variant"
  - "verify-branding-identity.mjs brand-full-name surface extended to read brand.properties alongside brand.ftl"
  - "human re-verification of BRAND-06 recorded PASS 2026-08-22"
affects: [phase-4-shell-work-that-references-branding, any-future-icon-rebadge-plan]

actuals:
  tokens: 8800
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "branding-variant-divergence follows the allowlist-doc-consistency trio shape exactly: one parameterised _impl taking file paths, one argument-free CHECKS-array wrapper feeding real installed paths, one self-test synthesising its own quartet in mktemp files"
    - "verify-branding-identity.mjs's per-surface identity checks now read every file that carries the same logical value (brand.ftl AND brand.properties) rather than trusting one file to represent both -- the WR-01 failure mode (two files silently disagreeing within one variant) is now structurally impossible to reintroduce for brand-full-name"

key-files:
  created:
    - .planning/phases/03-branded-firefox-fork/COVERAGE.md
  modified:
    - scripts/verify-phase-03.sh
    - scripts/verify-branding-identity.mjs
    - sourcerer/branding/dev/locales/en-US/brand.properties
    - sourcerer/branding/dev/pref/firefox-branding.js
    - docs/BUILD.md
    - .planning/phases/03-branded-firefox-fork/03-MANUAL-VERIFICATION.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "Fixed dev brand.properties brandFullName to match dev brand.ftl's suffixed value, rather than touching brand.ftl -- brand.ftl was already correct (03-REVIEW.md WR-01 identified brand.properties as the file that silently disagreed)"
  - "Dev-only browser.tabs.inTitlebar=0 default added via the existing branding-pref-file mechanism (D-84), not a chrome/XHTML change -- keeps the phase's zero-chrome-touch constraint intact"
  - "Icon badge deliberately NOT re-generated -- no image tooling on this host, and Criterion 5 is a disjunction (title suffix OR icon badge); the title-bar fix alone was sufficient and the human verdict confirmed it"
  - "verify-branding-identity.mjs's brand-full-name surface was extended in place (reads brand.properties in addition to brand.ftl) rather than adding a seventh surface, to avoid renumbering churn against BRAND-01's six-surface checklist"

patterns-established: []

requirements-completed: [BRAND-06, BRAND-01]

coverage:
  - id: D1
    description: "branding-variant-divergence check lands red against the real unfixed tree, then flips to PASS once the divergence is fixed; its self-test proves both directions (green on synthesised correct quartet, red on each of two planted mutations)"
    requirement: BRAND-01
    verification:
      - kind: unit
        ref: "bash scripts/verify-phase-03.sh --quick (Task 1, red-as-designed capture)"
        status: pass
      - kind: unit
        ref: "bash scripts/verify-phase-03.sh (Task 2, full 14-check green run)"
        status: pass
    human_judgment: false
  - id: D2
    description: "verify-branding-identity.mjs brand-full-name surface reads both brand.ftl and brand.properties per variant, and its cross-variant positive control still discriminates correctly"
    requirement: BRAND-01
    verification:
      - kind: unit
        ref: "node scripts/verify-branding-identity.mjs && node scripts/verify-branding-identity.mjs --variant release && node scripts/verify-branding-identity.mjs --variant release --positive-control brand-full-name"
        status: pass
    human_judgment: false
  - id: D3
    description: "A human, on a real desktop session with both variants launched side by side, confirms the dev and release builds are tellable apart at a glance without opening about:support"
    requirement: BRAND-06
    verification:
      - kind: manual_procedural
        ref: "03-MANUAL-VERIFICATION.md, 'Item A — re-verification after 03-11 gap closure' outcome block"
        status: pass
    human_judgment: true
    rationale: "'Distinguishable at a glance' is inherently a human perceptual judgment -- WebDriver BiDi cannot read the chrome window's title bar, and no xprop/xdotool/wmctrl exists on this host, exactly as the original Item A record already established."

duration: 65min
completed: 2026-08-22
status: complete
---

# Phase 3 Plan 11: BRAND-06 Gap Closure Summary

**Dev variant now diverges from release in a real window title bar (`browser.tabs.inTitlebar=0`) and a corrected `brand.properties`/`brand.ftl` agreement, closing the human-verified FAILED gap from 03-10 with a re-verification PASS.**

## Performance

- **Duration:** 65 min
- **Tasks:** 3 (all completed)
- **Files modified:** 9 (plus this SUMMARY)
- **Commits:** 4

## Accomplishments

- Landed `branding-variant-divergence` (+ self-test) in `verify-phase-03.sh`, observed genuinely red against the real unfixed tree before any branding file was touched, then green after the fix — self-test proves the comparator in both directions (D-88).
- Fixed the root cause 03-REVIEW.md WR-01 identified: dev's `brand.properties` `brandFullName` was byte-identical to release's; it now reads `Sourcerer Dev`, matching dev's own `brand.ftl`. Release tree byte-unchanged.
- Added a dev-only `browser.tabs.inTitlebar=0` default so the dev window gives up tabs-in-titlebar (client-side decorations) and paints a real title bar — the actual mechanism a person can see, since neither variant rendered any window title before this fix.
- Extended `verify-branding-identity.mjs`'s `brand-full-name` surface to read `brand.properties` as well as `brand.ftl`, so the two can never silently disagree again within one variant.
- Human re-verification (2026-08-22): **PASS**. Dev window title read literally "Sourcerer Dev" with a real title bar painted; release painted no title bar; the two were immediately tellable apart at a glance without `about:support`. BRAND-06 flipped from Gap back to Complete in `REQUIREMENTS.md`.

## Task Commits

1. **Task 1: Land the divergence check red against the unfixed tree** - `5cd7293` (test)
2. **Task 2: Diverge the dev variant end-to-end — brand string, title bar, docs** - `6590b1d` (feat)
3. **Task 3 pause bookkeeping (checkpoint stop, pre-verdict)** - `34d2174` (docs)

**Plan metadata:** (this commit) - `docs(03-11): complete plan`

_Note: Task 3 is a `checkpoint:human-verify` gate. The plan's Tasks 1-2 landed in one execution pass; the session then paused and returned a structured checkpoint. The human verdict (PASS) was relayed by the orchestrator in a follow-up turn, and this SUMMARY documents the completed plan including that verdict._

## Files Created/Modified

- `scripts/verify-phase-03.sh` - added `branding-variant-divergence` + self-test to the base CHECKS array
- `scripts/verify-branding-identity.mjs` - `brand-full-name` surface now reads `brand.properties` alongside `brand.ftl`; added `readBrandPropertiesFullName`, `--brand-properties` override, `BRAND_PROPERTIES_PATH`
- `sourcerer/branding/dev/locales/en-US/brand.properties` - `brandFullName` suffixed to `Sourcerer Dev`
- `sourcerer/branding/dev/pref/firefox-branding.js` - added dev-only `browser.tabs.inTitlebar=0` default
- `docs/BUILD.md` - new "Telling a dev build from a release build (BRAND-06)" section
- `.planning/phases/03-branded-firefox-fork/03-MANUAL-VERIFICATION.md` - new Item A re-verification section, outcome filled PASS, frontmatter status updated
- `.planning/phases/03-branded-firefox-fork/COVERAGE.md` - required one-line no-external-API declaration
- `.planning/REQUIREMENTS.md` - BRAND-06 flipped Gap → Complete, status table row, footer note
- `.planning/STATE.md` - blocker entries for this gap removed, position updated
- `.planning/ROADMAP.md` - plan progress row updated (10/11 → 11/11 pending this commit)

## Decisions Made

See `key-decisions` in frontmatter. Summary: fixed `brand.properties` (not `brand.ftl`, which was already correct); added the titlebar default through the existing branding-pref-file mechanism rather than any chrome/XHTML change; deliberately left the icon set un-rebadged (Criterion 5 is a disjunction, and the title-bar fix alone proved sufficient); extended the existing six-surface identity checklist's `brand-full-name` surface in place rather than adding a seventh.

## Deviations from Plan

None — plan executed exactly as written. Task 3's checkpoint pause and later resolution followed the plan's own designed gate (`gate="blocking"`, `checkpoint:human-verify`): the executor could not perform a human perceptual judgment on a real desktop session, stopped, and resumed once the orchestrator relayed the actual human's verdict.

## Issues Encountered

None. All three `verify-branding-identity.mjs` invocations, and the full 14-check `verify-phase-03.sh` aggregator, passed on the first run after Task 2's edits — no debugging cycle needed.

## Next Phase Readiness

Phase 3's human-verification gate is now fully satisfied: Item A (BRAND-06, this plan) PASS, Item B (BRAND-02, trademark-asset review, 03-10) PASS. `bash scripts/verify-phase-03.sh` exits 0 at 14 checks. No Gecko file, patch, browser chrome file, or icon asset was modified by this plan — the phase's build-cycle budget (two full builds) remains fully preserved, since every edit reached the built tree through existing `dist/bin` symlinks (D-70 tier 1) with no rebuild.

The icon badge remains the one known-weak cue (a few pixels at 16-32px, not independently distinguishable) — recorded here as a deliberate, not-yet-acted-on decision. If Phase 4 or a later phase ever needs a stronger icon-level cue (e.g., before a real packaged release ships), re-badging `sourcerer/branding/{dev,release}/default*.png` is the next lever; it was out of scope here because this host has no image-editing tooling and the title-bar fix already satisfied the requirement.

---
*Phase: 03-branded-firefox-fork*
*Completed: 2026-08-22*
