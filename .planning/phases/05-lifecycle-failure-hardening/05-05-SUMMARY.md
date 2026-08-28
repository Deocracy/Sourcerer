---
phase: 05-lifecycle-failure-hardening
plan: 05
subsystem: infra
tags: [verification, ci-gate, broken-windows-ledger, marionette, theia, sourcerer]

# Dependency graph
requires:
  - phase: 05-lifecycle-failure-hardening
    plan: 01
    provides: "scripts/verify-phase-05.sh's --quick/--only harness and its four SIDE-04 checks, which --gate reuses unmodified"
  - phase: 05-lifecycle-failure-hardening
    plan: 02
    provides: "The three SHELL-03 checks and WINDOWS.md entry 7 (Discriminator B, routed to Item B here)"
  - phase: 05-lifecycle-failure-hardening
    plan: 03
    provides: "shell04-diagnostics-with-backend-down and the identity accessor, routed to Item C here"
  - phase: 05-lifecycle-failure-hardening
    plan: 04
    provides: "The two SIDE-05 checks, live-verified on a real display -- confirms no second-launch-focus item is needed here"
provides:
  - "scripts/verify-phase-05.sh --gate -- proves verify-phase-05.sh + verify-phase-04.sh + verify-phase-03.sh all green at one named commit (D-127)"
  - "The Phase 3 endpoint-allowlist failure reported as a named, ledger-guarded known-open exclusion (WINDOWS.md entry 5), never a silent pass"
  - "05-MANUAL-VERIFICATION.md -- the unsigned human record for the daily-drive criterion (D-126) and the two chrome-context hand-offs (05-02's Retry click, 05-03's diagnostics chord)"
  - "05-VALIDATION.md updated with a real measured --gate runtime and validated/wave_0_complete flags"
affects: []

actuals:
  tokens: 7293
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "--gate as one more mode on the phase's own verify script (never a sibling driver): runs this script's full own check set inline, then invokes the two prior phase scripts as external processes under the same setsid discipline every other external invocation in this file already uses"
    - "A known-open exclusion is keyed to a broken-windows ledger id and re-checked LIVE against .planning/WINDOWS.md's own JSON block on every gate run -- never a hardcoded assumption that the ledger entry is still open. The instant the entry stops being 'open' (fixed or waived), the exclusion stops applying and the underlying check must be green."
    - "Failing-check labels for the two external phase scripts are read off their own already-printed summary lines ('  <label>: FAIL'), never re-derived or re-run individually"
    - "05-VALIDATION.md's placeholder Estimated-runtime cell and status/wave_0_complete frontmatter flags are written programmatically by a passing --gate run, not hand-edited -- the document reflects a real measured number, not an assertion"

key-files:
  created:
    - .planning/phases/05-lifecycle-failure-hardening/05-MANUAL-VERIFICATION.md
  modified:
    - scripts/verify-phase-05.sh
    - .planning/phases/05-lifecycle-failure-hardening/05-VALIDATION.md

key-decisions:
  - "The known-open exclusion is keyed to WINDOWS.md ledger entry 5 by id, and guarded LIVE: ledger_entry_is_open() re-reads .planning/WINDOWS.md's JSON block on every --gate run rather than trusting a value baked in at authoring time. Live-verified both directions: temporarily flipping entry 5 to 'fixed' made the gate FAIL naming 'exclusion no longer applies', and restoring it to 'open' returned the gate to PASS."
  - "05-MANUAL-VERIFICATION.md's three items are built with every instruction filled in and every verdict line deliberately left blank ('pending', never 'TBD'/'TODO' so the acceptance criterion's grep stays 0) -- per this plan's own checkpoint_protocol, no human item is ever self-certified by an autonomous session."
  - "Second-launch-focus was NOT added as a fourth human item -- 05-04-SUMMARY.md already recorded side05-second-launch-focuses/side05-no-second-backend passing live against a real display, so there is no display-unavailable gap this plan's own instructions say to route here."
  - "Task 1's deliberate-failure verification (Phase 4 case) used a temporary synthetic always-failing CHECKS entry appended to verify-phase-04.sh, rather than hand-breaking a real passing check -- proves the exact same propagation/naming mechanism with a fully reversible, zero-residue change (confirmed via `git diff --stat` returning empty after revert)."

patterns-established:
  - "Ledger-guarded exclusion: any future --gate-style known-open exclusion should re-read the ledger live on every run (ledger_entry_is_open in scripts/verify-phase-05.sh), never bake in a status at authoring time."

requirements-completed: [SIDE-04, SIDE-05, SHELL-03, SHELL-04]

coverage:
  - id: D1
    description: "A single command runs this phase's checks plus the Phase 3 and Phase 4 gates at one commit and reports one verdict"
    requirement: SIDE-04
    verification:
      - kind: integration
        ref: "bash scripts/verify-phase-05.sh --gate (baseline run: commit 5a9a462, 121s, PASS with 1 named exclusion)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Phase 3 endpoint-allowlist check's failure is reported as a named known-open exclusion (WINDOWS.md entry 5), never silently counted as a pass, and the exclusion stops applying the instant the entry is fixed or waived"
    requirement: SIDE-04
    verification:
      - kind: integration
        ref: "bash scripts/verify-phase-05.sh --gate re-run with WINDOWS.md entry 5 temporarily flipped to 'fixed' -- gate exits non-zero naming 'exclusion no longer applies'; restored to 'open', gate returns to PASS"
        status: pass
    human_judgment: false
  - id: D3
    description: "Any other red check (not the named exclusion) fails the gate outright and names the check"
    requirement: SIDE-04
    verification:
      - kind: integration
        ref: "bash scripts/verify-phase-05.sh --gate re-run with a temporary always-failing synthetic check appended to verify-phase-04.sh's CHECKS array -- gate exits non-zero naming 'deliberate-test-failure'; reverted (git diff --stat empty), gate returns to PASS"
        status: pass
    human_judgment: false
  - id: D4
    description: "--gate rejects combination with --quick/--only with a named error; verify-phase-05.sh with no flags is unaffected"
    requirement: SIDE-04
    verification:
      - kind: integration
        ref: "bash scripts/verify-phase-05.sh --gate --quick (exits 1, names the rejected combination); bash scripts/verify-phase-05.sh with no flags (11/11 PASS, unchanged)"
        status: pass
    human_judgment: false
  - id: D5
    description: "05-VALIDATION.md carries a real measured estimated runtime (no placeholder) and its compliance/wave-zero flags reflect the finished state"
    requirement: SIDE-04
    verification:
      - kind: unit
        ref: "grep -n 'Estimated runtime\\|^status:\\|^wave_0_complete:' .planning/phases/05-lifecycle-failure-hardening/05-VALIDATION.md -- '~121s, measured live by --gate', status: validated, wave_0_complete: true"
        status: pass
    human_judgment: false
  - id: D6
    description: "The developer has used Sourcerer as their primary IDE for a full working day and recorded whether manual cleanup or a forced relaunch was needed"
    requirement: SHELL-03
    verification: []
    human_judgment: true
    rationale: "D-126's own reasoning: a multi-day soak gates the milestone on calendar time and an automated soak does not exercise what 'daily-drivable' means. This requires an actual human using Sourcerer as their real IDE across a real working day -- 05-MANUAL-VERIFICATION.md Item A is built with every instruction filled in and the verdict deliberately left pending, never fabricated."
  - id: D7
    description: "The Retry button's literal click, and the diagnostics chord's literal press with the backend down, are recorded by a human -- their underlying mechanisms are already automated"
    requirement: SHELL-04
    verification:
      - kind: integration
        ref: "shell03-auto-dismiss-on-selfheal (Retry's underlying _restart() path) and shell04-diagnostics-with-backend-down (identity sentinel + markup fallback) both pass in the same --gate run"
        status: pass
    human_judgment: true
    rationale: "Discriminator B (chrome-side Marionette automation) is blocked on Linux (WINDOWS.md #7) -- no automated harness in this repo can click a chrome-window button or press a chord. 05-MANUAL-VERIFICATION.md Items B and C carry the concrete procedures with blank verdict lines, matching 05-02/05-03's own named routing of this gap."

duration: ~25min
completed: 2026-08-28
status: complete
---

# Phase 5 Plan 5: The Single-Commit Combined Gate and the Working-Day Record Summary

**`scripts/verify-phase-05.sh --gate` proves all three phase verification scripts green at one commit, reporting the Phase 3 endpoint-allowlist failure as a named exclusion keyed live to WINDOWS.md entry 5 rather than a silent pass; `05-MANUAL-VERIFICATION.md` carries three unsigned, verdict-blank procedures (the daily-drive criterion, the Retry click, and the diagnostics chord) for the developer to complete.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-28T02:58:00Z (approx, immediately following 05-04's completion commit)
- **Completed:** 2026-08-28T03:14:03Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **`--gate` mode** added to `scripts/verify-phase-05.sh`'s existing argument loop, rejecting any combination with `--quick`/`--only` with a named error rather than silently preferring one. In gate mode the script runs its own full 11-check set inline (factored into `run_own_checks()`, called both directly by normal invocation and by gate mode -- zero behavior change to non-gate runs, confirmed live: 11/11 PASS, unchanged), then invokes `verify-phase-04.sh` and `verify-phase-03.sh` as external processes under the same `setsid` process-group discipline every other external invocation in this file already uses.
- **The one known-open exclusion is ledger-guarded, not hardcoded.** `ledger_entry_is_open()` reads `.planning/WINDOWS.md`'s own fenced JSON block live on every `--gate` run and checks entry 5's current `status` field -- the exclusion (`verify-endpoints`, ledger entry 5, the three newly-resolved hosts Phase 4's working shell surfaces) applies only while that entry reads `"open"`. Live-verified both directions: temporarily flipping entry 5 to `"fixed"` made the gate FAIL with an explicit "exclusion no longer applies" message naming the check; restoring it to `"open"` returned the gate to a clean PASS.
- **Any other red check fails the gate outright**, live-verified with a temporary synthetic always-failing entry appended to `verify-phase-04.sh`'s `CHECKS` array: the gate exited non-zero and named `deliberate-test-failure` in the Phase 4 section; reverted (`git diff --stat` returns empty), the gate returned to PASS.
- **Baseline gate run**: commit `5a9a462`, 121s total runtime, all three sections PASS (Phase 5's own 11/11, Phase 4's 10/10, Phase 3's 13/14-with-1-named-exclusion). Re-confirmed clean at 126s after the deliberate-failure round-trip.
- **`05-VALIDATION.md` updated programmatically by a passing `--gate` run**: the placeholder "Estimated runtime" table cell now reads `~121s, measured live by --gate`; frontmatter `status: draft` → `validated`, `wave_0_complete: false` → `true`. `nyquist_compliant` deliberately stays `false` -- one named exclusion and Task 2's unsigned human items remain, matching `04-VALIDATION.md`'s own honest-PARTIAL precedent.
- **`05-MANUAL-VERIFICATION.md`** (new) carries three items, each with explicit, concrete steps and a blank verdict line: Item A (the D-126 full-working-day criterion, with all five things the checkpoint protocol requires recorded -- what was worked on, manual-cleanup needed or not, forced-relaunch needed or not, error-state count and Retry outcome each time, overall verdict), Item B (the Retry button's literal click, routed here because chrome-side Marionette automation is blocked on Linux -- WINDOWS.md #7 -- even though the underlying `_restart()` recovery path IS already automated via `shell03-auto-dismiss-on-selfheal`'s recovery probe), and Item C (the `Ctrl+Alt+Shift+D` diagnostics chord with the backend down, same routing reason, with the identity sentinel and markup fallback already automated via `shell04-diagnostics-with-backend-down`). A requirement-to-evidence table names, for each of SIDE-04/SIDE-05/SHELL-03/SHELL-04/ROADMAP-criterion-5, the automated check or human item that carries its verdict.
- **No verdict was fabricated anywhere in this plan.** Every outcome block in `05-MANUAL-VERIFICATION.md` reads "pending" (never "TBD"/"TODO" -- `grep -c 'TBD\|TODO'` returns 0 as the plan's own acceptance criterion requires), and nothing in this phase or this SUMMARY claims the daily-drive criterion, the Retry click, or the diagnostics chord have actually been observed by a human.

## Task Commits

1. **Task 1: The single-commit combined gate** - `8afc31f` (feat)
2. **Task 2: The working-day record** - `4044dc6` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `scripts/verify-phase-05.sh` - `--gate` flag, `run_own_checks()` (factored out, unchanged behavior), `ledger_entry_status()`/`ledger_entry_is_open()`, `write_gate_runtime_to_validation()`, `run_external_phase_script()`, `extract_failed_labels()`, `GATE_KNOWN_OPEN_EXCLUSIONS`, `run_gate_mode()`
- `.planning/phases/05-lifecycle-failure-hardening/05-VALIDATION.md` - Estimated-runtime cell filled in; `status`/`wave_0_complete` frontmatter flags flipped by the gate's own successful run
- `.planning/phases/05-lifecycle-failure-hardening/05-MANUAL-VERIFICATION.md` (new) - Items A/B/C, each with explicit steps and a blank verdict line; requirement-to-evidence traceability table

## Decisions Made

See `key-decisions` in frontmatter for the full list with citations. Summary:

- The known-open exclusion is keyed to the ledger entry's id and re-checked live against `.planning/WINDOWS.md` on every gate run -- never a value baked in at authoring time.
- `05-MANUAL-VERIFICATION.md`'s outcome blocks are deliberately "pending", never fabricated, never using the literal strings "TBD"/"TODO" (the acceptance criterion's own grep target).
- Second-launch-focus is not a fourth human item -- 05-04 already proved it automated, live, on a real display.
- The deliberate-failure verification used a temporary synthetic check, not a hand-broken real one, for a fully reversible round-trip.

## Deviations from Plan

None - plan executed exactly as written. All four live round-trip verifications named in Task 1's acceptance criteria (baseline PASS, ledger-fixed FAIL, Phase-4-failure FAIL, both reverts back to PASS, no-flags mode unchanged) were run and confirmed before committing.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. `05-MANUAL-VERIFICATION.md`'s three items require the developer's own future time (a full working day, plus two brief chrome-context checks), not configuration.

## Next Phase Readiness

- `bash scripts/verify-phase-05.sh --gate` proves all three phase verification scripts green at one named commit, with the single deferred exclusion stated out loud (WINDOWS.md #5) rather than hidden.
- Every requirement this phase owns (SIDE-04, SIDE-05, SHELL-03, SHELL-04) has a recorded verdict traceable to a named automated check or a named human-record item -- see the coverage block above and `05-MANUAL-VERIFICATION.md`'s own requirement-to-evidence table.
- This is the last plan of the last phase. What remains before the milestone can be honestly called complete is entirely human: `05-MANUAL-VERIFICATION.md`'s three items (the full working day, the Retry click, the diagnostics chord), plus the pre-existing WINDOWS.md #1 (Phase 2, untouched, still open) and #5 (this phase's own named exclusion, still open by design) and #7 (Discriminator B, the reason Items B/C exist at all). None of these are blockers this session can close -- they are handed to the developer via the artifacts this plan built.

---
*Phase: 05-lifecycle-failure-hardening*
*Completed: 2026-08-28*

## Self-Check: PASSED

All created/modified files and both task commit hashes verified present on disk / in git log (see below).
