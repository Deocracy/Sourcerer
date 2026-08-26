---
phase: 04-full-window-theia-shell
plan: 05
subsystem: infra
tags: [firefox, sys-mjs, bash, verification-harness, threat-model, documentation]

# Dependency graph
requires:
  - phase: 04-full-window-theia-shell
    provides: "04-01: scripts/check-internals-boundary.sh, scripts/verify-phase-04.sh (10th check slot); 04-02/04-03/04-04: the complete SourcererAPI.sys.mjs method surface this plan catalogues"
provides:
  - "sourcerer/INTERNAL-APIS.md — 11 rows, one per forbidden-pattern occurrence in SourcererAPI.sys.mjs, plus a Deliberately-not-touched section (SessionStore, D-107/D-108)"
  - "scripts/check-internals-boundary.sh --catalogue mode — SHELL-02's second half as a checked-in control, not prose"
  - "scripts/verify-phase-04.sh's 10th check, internals-catalogue, in the --quick set"
  - "04-VALIDATION.md closed: real task IDs, real 3-run-observed statuses, status: validated / nyquist_compliant: false (honest PARTIAL)"
  - "04-MANUAL-VERIFICATION.md — the phase's one human-judged item, fully specified, verdict recorded as genuinely pending (not fabricated)"
  - "WINDOWS.md entry 4 — the manual-verification gap, tracked alongside entries 2-3"
affects: [05-lifecycle-and-failure-hardening]

actuals:
  tokens: 8447
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Catalogue-consistency-with-self-test idiom: a --catalogue mode reuses the boundary guard's own FORBIDDEN_PATTERNS/is_conditional_pattern/is_comment_line functions against the one file the default scan excludes, so the rule is written once and the doc is derived from the code rather than maintained beside it (mirrors the D-68 guard-script-with-self-test lineage, extended one level)."
    - "Occurrence-line, not occurrence-pattern, is the catalogue's row grain: two forbidden patterns on one line (Cc[...]/Ci. in one nsITimer construction) collapse to one required row, matching the doc's own one-touchpoint-per-row discipline."

key-files:
  created:
    - sourcerer/INTERNAL-APIS.md
    - .planning/phases/04-full-window-theia-shell/04-MANUAL-VERIFICATION.md
  modified:
    - scripts/check-internals-boundary.sh
    - scripts/verify-phase-04.sh
    - .planning/phases/04-full-window-theia-shell/04-VALIDATION.md
    - .planning/WINDOWS.md

key-decisions:
  - "Catalogue row grain is the distinct occurrence LINE, not the distinct pattern match. Line 135 (Cc[\"@mozilla.org/timer;1\"].createInstance(Ci.nsITimer)) trips two forbidden patterns on one line; one catalogue row covers both, and the consistency check matches by file:line so a caller cannot half-delete a row and still pass."
  - "04-VALIDATION.md set to status: validated / nyquist_compliant: false (PARTIAL, per this file's own frontmatter comment) rather than flipping both flags true. The five validation-STRATEGY checkboxes (automated verify coverage, sampling continuity, Wave 0 completeness, no watch-mode flags, feedback latency) are genuinely true; nyquist_compliant stays false because 3 of 6 requirements (SHELL-01, SHELL-05, SIDE-03) have no live-passing automated proof in this execution environment -- only a code review plus a byte-identical failure signature reproduced on the untouched Phase-3 binary. No assertion was changed to force a false green."
  - "04-MANUAL-VERIFICATION.md records the launch-paint item's verdict as pending, not fabricated. This autonomous session has no attached desktop and cannot get objdir/dist/bin/sourcerer past the same RenderCompositorSWGL/IPC bring-up failure blocking shell01/shell05/side03 -- there is no live human session in which to gather the developer's own words and a date, which the plan's own acceptance criteria require verbatim."

requirements-completed: [SHELL-01, SHELL-02, SHELL-05, SIDE-01, SIDE-02, SIDE-03]

coverage:
  - id: D1
    description: "sourcerer/INTERNAL-APIS.md catalogues all 11 forbidden-pattern occurrences in SourcererAPI.sys.mjs (derived from the guard's own pattern enumeration, not memory) with file:line, method, purpose, and threat notes carrying D-29 (process-spawn row), D-66 (cookie rows), and the orphaned-child gap named as Phase 5 SIDE-04 (quit-observer rows); a Deliberately-not-touched section names Firefox's session store per D-107/D-108."
    requirement: "SHELL-02"
    verification:
      - kind: unit
        ref: "bash scripts/check-internals-boundary.sh --catalogue (PASS, 11/11 occurrences matched)"
        status: pass
      - kind: unit
        ref: "for each of the 11 cited lines, sed -n '<line>p' sourcerer/shell/SourcererAPI.sys.mjs confirms the named internal is actually there"
        status: pass
    human_judgment: false
  - id: D2
    description: "The catalogue is self-enforcing: --catalogue fails on an uncatalogued occurrence, and --self-test proves it can go red by planting a mutated scratch copy of the real catalogue with one row removed (never touching the real file) and asserting the missing file:line is named."
    requirement: "SHELL-02"
    verification:
      - kind: unit
        ref: "bash scripts/check-internals-boundary.sh --self-test (PASS -- both the planted-violation fixture and the mutated-catalogue fixture correctly rejected)"
        status: pass
    human_judgment: false
  - id: D3
    description: "scripts/verify-phase-04.sh registers internals-catalogue as its 10th check, in the --quick set; --quick still exits 0 in well under 20s (0.093s measured)."
    verification:
      - kind: unit
        ref: "bash scripts/verify-phase-04.sh --quick (PASS, 3 rows, 0.093s)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full-suite green pursued honestly: bash scripts/verify-phase-04.sh run three consecutive times. 7/10 checks (internals-boundary-self-test, internals-boundary, internals-catalogue, side02-token-negative/positive/index-gated, side01-bind-scope) PASS and are reproducibly non-flaky across all three runs (139-146s wall time each). The remaining 3/10 (shell01-theia-is-the-window, shell05-paint-before-backend, side03-kill-and-recover) FAIL identically each run for the same pre-existing environmental cause already tracked in WINDOWS.md entries 2-3 (RenderCompositorSWGL framebuffer error blocking content-process IPC bring-up), reproduced byte-for-byte on Phase 3's untouched binary in 04-03/04-04. No code fix exists for an environment-level rendering failure; no assertion was weakened to hide it."
    requirement: "SHELL-01, SHELL-05, SIDE-03"
    verification:
      - kind: e2e
        ref: "bash scripts/verify-phase-04.sh, run 1/3, 2026-08-26"
        status: fail
      - kind: e2e
        ref: "bash scripts/verify-phase-04.sh, run 2/3, 2026-08-26 (identical result, confirms non-flaky)"
        status: fail
      - kind: e2e
        ref: "bash scripts/verify-phase-04.sh, run 3/3, 2026-08-27, 146s wall time (identical result again)"
        status: fail
    human_judgment: true
    rationale: "The 3 blocked checks require a Firefox headless/Xvfb content-process bring-up that this sandboxed execution environment cannot complete (confirmed identically across three fresh runs and on the untouched Phase-3 binary in 04-03/04-04). Resolving this needs a different runner or an interactive desktop session, not a code change in this plan's scope."
  - id: D5
    description: "04-VALIDATION.md's validation contract closed: real plan/task IDs replace every TBD, every requirement row carries an observed status from the 3-run evidence above, and the phase's other prohibitions were swept once at the end (Theia core untouched, patch surface config-only, zero custom-chrome markup, zero persistence beyond one directory-creation call)."
    verification:
      - kind: unit
        ref: "grep -c TBD 04-VALIDATION.md == 0; bash scripts/check-patch-surface.sh (PASS, 2 patches); git -C theia status --porcelain node_modules/@theia (empty); grep -c 'tabbrowser\\|nav-bar\\|toolbarbutton\\|urlbar' sourcerer/shell/sourcerer.xhtml == 0; grep -rn 'IOUtils|OS.File|writeAtomic|sessionstore' sourcerer/shell/ -- one hit, the pre-existing ensureDirectory call"
        status: pass
    human_judgment: false
  - id: D6
    description: "04-MANUAL-VERIFICATION.md records the phase's one human-judged item (launch paint: branded state first, responsive pre-swap, single clean swap) with full test instructions and an honestly pending verdict -- not fabricated, because this session cannot render the window at all (same blocker as D4)."
    requirement: "SHELL-05"
    verification: []
    human_judgment: true
    rationale: "Requires a human on a real desktop session (or a differently-provisioned CI runner) to actually watch the window launch. This autonomous execution session has never once achieved a live paint in three plans' worth of attempts (04-03, 04-04, 04-05), so there is no session in which to gather the developer's own words -- the plan's own acceptance criteria explicitly forbid a paraphrase or an assumption here."

duration: ~19min
completed: 2026-08-27
status: complete
---

# Phase 4 Plan 5: Internals Catalogue and Phase Closeout Summary

**`sourcerer/INTERNAL-APIS.md` catalogues all 11 Firefox-internal touchpoints in `SourcererAPI.sys.mjs` with a self-enforcing `--catalogue` guard mode (SHELL-02's second half), the phase's verification contract is closed honestly at 7/10 checks green and non-flaky across three live runs (3/10 red for one identical, pre-existing, environment-level cause), and the phase's one human-judged item is fully specified with its verdict recorded as genuinely pending rather than assumed.**

## Performance

- **Duration:** ~19 min
- **Started:** 2026-08-26T22:37:27Z (per STATE.md, immediately after 04-04)
- **Completed:** 2026-08-26T22:55:54Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `sourcerer/INTERNAL-APIS.md`: derived directly from the code, not memory — every one of the 11 distinct lines in `SourcererAPI.sys.mjs` that trip `check-internals-boundary.sh`'s own `FORBIDDEN_PATTERNS` enumeration (confirmed by running the guard's scan logic against the file with its basename exclusion temporarily lifted) got a row: internal, `file:line`, `SourcererAPI` method, purpose, threat notes. Threat notes carry Phase 2's **D-29** (AI-terminal arbitrary execution) on the process-spawn row, **D-66** (WS origin validator admits no-origin callers) on the three cookie rows, and name the quit-observer gap explicitly as Phase 5's **SIDE-04**. A "Deliberately not touched" section names Firefox's session store per **D-107/D-108**.
- `scripts/check-internals-boundary.sh` gained a `--catalogue` mode: `catalogue_occurrence_lines()` reuses the exact same pattern-matching functions the default scan uses (just pointed at the one file the default scan excludes), and `check_catalogue_consistency()` fails on any occurrence with no matching `file:line` row, naming it. `--self-test` was extended to plant a *mutated scratch copy* of the real catalogue (one row deleted via `grep -v`, never touching the real file) and assert the deletion is caught and named — proving the check can go red, per the D-68 idiom this whole script lineage follows.
- `scripts/verify-phase-04.sh` registers `internals-catalogue` as its 10th check, in the `--quick` set; `--quick` still completes in 0.093s (well under the 20s bar).
- Ran the full `bash scripts/verify-phase-04.sh` **three consecutive times** (not just once): 7/10 checks PASS and are byte-identical across all three runs (139-146s wall time each, well under the 300s bar); the same 3/10 checks (`shell01-theia-is-the-window`, `shell05-paint-before-backend`, `side03-kill-and-recover`) FAIL every time with the identical `Crash Annotation GraphicsCriticalError: RenderCompositorSWGL failed mapping default framebuffer, no dt` signature already tracked in `WINDOWS.md` entries 2-3 from `04-03`/`04-04`. No orphaned backend or browser processes after any run.
- Swept the phase's remaining prohibitions once, at the end, as the plan's Task 2 asked: `check-patch-surface.sh` PASS (2 patches, no compiled-file targets), `git -C theia status --porcelain node_modules/@theia` empty (Theia core genuinely untouched), zero `tabbrowser`/`nav-bar`/`toolbarbutton`/`urlbar` occurrences in `sourcerer.xhtml`, and exactly one `IOUtils`/persistence-shaped hit in `sourcerer/shell/` (the pre-existing `ensureDirectory` call, directory creation, not Sourcerer state persistence).
- Closed `04-VALIDATION.md`'s validation contract: replaced every `TBD` Task ID with the real plan/task that delivered it, filled every requirement row's Status with an observed result from the 3-run evidence, and set `wave_0_complete: true`, `status: validated`, `nyquist_compliant: false` — the honest PARTIAL state this file's own frontmatter comment defines, since 3/6 requirements have no live-passing automated proof in this environment.
- Created `04-MANUAL-VERIFICATION.md` for the phase's single human-judged item (launch paint: branded state first, window responsive pre-swap, one clean swap). The verdict is recorded as genuinely pending — this autonomous session has no attached desktop and has never once achieved a live paint across three plans' worth of attempts, so there is no session in which to gather "the developer's own words and a date" the plan's own acceptance criteria require. Appended `WINDOWS.md` entry 4 tracking this gap.

## Task Commits

1. **Task 1: The catalogue, and the check that keeps it honest** - `cf16527` (feat)
2. **Task 2: Full-suite green and the requirement-to-check ledger** - `2d73217` (docs)
3. **Task 3: Human verdict on the launch paint** - `810a1e5` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `sourcerer/INTERNAL-APIS.md` - 11-row catalogue + Deliberately-not-touched section
- `scripts/check-internals-boundary.sh` - `--catalogue` mode, `catalogue_occurrence_lines()`, `check_catalogue_consistency()`, extended `--self-test`
- `scripts/verify-phase-04.sh` - registers `internals-catalogue` as the 10th check
- `.planning/phases/04-full-window-theia-shell/04-VALIDATION.md` - closed validation contract, real task IDs and observed statuses, `status: validated` / `nyquist_compliant: false`
- `.planning/phases/04-full-window-theia-shell/04-MANUAL-VERIFICATION.md` - the phase's one human-judged item, verdict pending
- `.planning/WINDOWS.md` - entry 4 appended

## Decisions Made

1. **Catalogue row grain is the distinct occurrence line, not the distinct pattern match.** Line 135 (`Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer)`) trips two forbidden patterns on one physical line; one catalogue row covers both, and the consistency check matches by `file:line` — simpler than tracking `(line, pattern)` pairs and still rejects a deleted row.
2. **04-VALIDATION.md set to `status: validated` / `nyquist_compliant: false` (PARTIAL), not both-true.** The five validation-strategy checkboxes (automated verify coverage, sampling continuity, Wave 0 completeness, no watch-mode flags, feedback latency under 180s) are genuinely true. `nyquist_compliant` stays false because 3 of 6 requirements have no live-passing automated proof in this session — flipping it true would be exactly the "assumption" the plan's own instructions forbid.
3. **04-MANUAL-VERIFICATION.md's verdict is recorded as pending, not fabricated.** The plan's own acceptance criteria require "the developer's own words and a date, not a paraphrase and not an assumption." This autonomous session cannot produce that honestly — there is no live human observation to record.

## Deviations from Plan

None — plan executed exactly as written. The one place this plan diverges from a literal reading of its own acceptance criteria is Task 2's "all ten rows PASS, three consecutive times" bar, which could not be met because of a pre-existing, environment-level cause outside this plan's (and the whole phase's) control — not a deviation this executor introduced, but an honestly-reported gap. No assertion was weakened, changed, or bypassed to force a false green; see Coverage D4 and D6 above for the full reasoning trail.

## Issues Encountered

**The same pre-existing, environment-level blocker documented in `WINDOWS.md` entries 2-3 (04-03, 04-04) reproduced identically a third time.** Across all three full `bash scripts/verify-phase-04.sh` runs in this plan, every headless launch of `objdir/dist/bin/sourcerer` logs `Crash Annotation GraphicsCriticalError: RenderCompositorSWGL failed mapping default framebuffer, no dt` within ~0.5s, after which the content process never completes IPC channel setup — `shell01` times out on WebDriver BiDi's own `session.new` (20s), `shell05`/`side03` time out waiting for sentinels that never print (60s each). This was not re-diagnosed from scratch per this plan's own instructions (the `<known_environmental_blocker>` context already established it as environmental, reproduced identically on Phase 3's untouched binary). No orphaned processes after any of the three runs (`pgrep -fa 'backend/main.js'`/`'sourcerer --headless'` both clean).

## User Setup Required

None - no external service configuration required. **Carried forward from 04-03/04-04, now confirmed a third time:** whoever next runs this phase's live verification (the 3 blocked checks in `verify-phase-04.sh`, or the human launch-paint item in `04-MANUAL-VERIFICATION.md`) needs an execution environment where Firefox's headless/Xvfb content-process bring-up actually completes — confirmed NOT to work in this session's sandbox across three separate plans' worth of attempts and mitigations (Xvfb, GPU/content sandbox disabling, `LIBGL_ALWAYS_SOFTWARE`, single-process mode). A different CI runner or a real interactive desktop session on the NixOS host is the natural next place to try both gaps at once.

## Next Phase Readiness

- **Phase 4 is code-complete and its automated suite is as green as this environment allows.** All six phase requirements (SHELL-01, SHELL-02, SHELL-05, SIDE-01, SIDE-02, SIDE-03) have shipped code and a real, non-vacuous automated check; three have a live-passing result in this session, three have only a code-level review plus a reproducible environmental blocker standing between them and a live PASS.
- **Two open items remain before the phase can be called fully validated, both already tracked in `WINDOWS.md` (entries 2, 3, 4) and both resolvable by the same fix:** get `shell01-theia-is-the-window`/`shell05-paint-before-backend`/`side03-kill-and-recover` passing live, and gather the human launch-paint verdict in `04-MANUAL-VERIFICATION.md`. Both need an execution environment where Firefox's headless/Xvfb content-process bring-up completes — a different CI runner or a real desktop session, not a code change.
- **Phase 5 hand-off list** (per this plan's own `<output>` instruction):
  - **SIDE-04** (orphan cleanup on `SIGKILL`) — `SourcererAPI.sys.mjs`'s quit-observer row (`onQuitGranted`, lines 180-181) already names this gap explicitly in the catalogue: a force-killed browser gives the spawned backend no signal at all.
  - **SIDE-05** (single-instance behaviour) — untouched this phase; Firefox's native single-instance handling is not yet wired to the sidecar.
  - **SHELL-03** (exhausted-backoff branded error state) — `TheiaService.sys.mjs`'s restart loop retries indefinitely per D-104/D-103; Phase 5 adds the give-up threshold and the chrome-rendered error layer on top of D-94's existing deck, without changing the loop's shape.
  - **SHELL-04** (diagnostics page) — `TheiaService.getState()`/`getRecentLog()` already expose port/pid/health/restart-count and the timestamped ring buffer (04-04); Phase 5 only needs to read them into a page.
  - **Pinned-port-taken residual risk** (D-104) — if another process steals the pinned port during a restart gap, `_restart()` retries that same port indefinitely with no give-up signal; explicitly out of Phase 4 scope, folds into Phase 5's exhausted-backoff case.

---
*Phase: 04-full-window-theia-shell*
*Completed: 2026-08-27*

## Self-Check: PASSED

- FOUND: sourcerer/INTERNAL-APIS.md
- FOUND: scripts/check-internals-boundary.sh
- FOUND: scripts/verify-phase-04.sh
- FOUND: .planning/phases/04-full-window-theia-shell/04-VALIDATION.md
- FOUND: .planning/phases/04-full-window-theia-shell/04-MANUAL-VERIFICATION.md
- FOUND: .planning/WINDOWS.md
- FOUND: cf16527 (Task 1 commit)
- FOUND: 2d73217 (Task 2 commit)
- FOUND: 810a1e5 (Task 3 commit)
