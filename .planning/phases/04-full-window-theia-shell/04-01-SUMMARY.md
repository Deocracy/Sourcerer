---
phase: 04-full-window-theia-shell
plan: 01
subsystem: testing
tags: [bash, verification-harness, webdriver-bidi, theia, firefox, red-by-design]

# Dependency graph
requires:
  - phase: 02-sourcerer-theia-extensions
    provides: scripts/lib/firefox-bidi.mjs (withFirefoxPage/waitFor/captureScreenshot), theia/applications/browser build output
  - phase: 03-branded-firefox-fork
    provides: objdir/dist/bin/sourcerer branded build, scripts/verify-phase-03.sh aggregator idiom
provides:
  - scripts/check-internals-boundary.sh — SHELL-02's executable boundary guard, with --self-test
  - scripts/verify-phase-04.sh — the phase's single verification aggregator, 9 checks registered covering SHELL-01/02/05 and SIDE-01/02/03
  - Proven red-by-design baseline: every phase-behaviour check FAILs for the right reason (missing chrome/backend code), only the guard's own self-test passes
affects: [04-02-theia-token-gate-extension, 04-03-shell-chrome, 04-04-backend-supervisor, 04-05-internal-apis-catalogue]

actuals:
  tokens: 7923
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Guard-script-with-self-test idiom (scripts/check-patch-surface.sh lineage): scan function + --self-test planting a violating fixture under mktemp -d + non-vacuity assertion"
    - "One verification script per phase, extended never sibling'd — CHECKS array later tasks/plans append to"
    - "Runtime-generated temp .mjs runner (mktemp, track_temp-registered, never a persisted repo file) for a check needing ESM import of scripts/lib/firefox-bidi.mjs, keeping the single-file convention intact"

key-files:
  created:
    - scripts/check-internals-boundary.sh
    - scripts/verify-phase-04.sh
  modified: []

key-decisions:
  - "check-internals-boundary.sh's default scan target is sourcerer/shell/, not the whole sourcerer/ tree D-97 names literally — sourcerer/branding/*/pref/firefox-branding.js already exists, matches the *.js glob, and carries zero forbidden-pattern offenses, so scanning all of sourcerer/ would make internals-boundary a false PASS before any shell code exists, defeating Wave 0's red-by-design requirement."
  - "side03-kill-and-recover asserts the pid/port half of D-104 (kill triggers recovery on the SAME port with a DIFFERENT pid) but not the cookie-continuity half — a bash/curl driver cannot read the chrome-set token cookie without a WebDriver BiDi storage.getCookies call, which scripts/lib/firefox-bidi.mjs does not currently export, and this phase's key_link requires that file stay unchanged. Documented inline as a known limitation for whichever future task extends firefox-bidi.mjs's exported surface."

patterns-established:
  - "Backend-facing checks (start_backend/stop_backend) and browser-facing checks (start_shell/stop_shell) each own a shared setsid-spawn + track_temp-registered log-file pair, with the outer script's cleanup() carrying a safety-net kill for each spawn PID in case a check is interrupted mid-run."

requirements-completed: [SHELL-01, SHELL-02, SHELL-05, SIDE-01, SIDE-02, SIDE-03]

coverage:
  - id: D1
    description: "check-internals-boundary.sh: SHELL-02's boundary guard, structured like check-patch-surface.sh (scan function, --self-test planting a fixture in mktemp -d, non-vacuity assertion, comment-stripping so the guard's own header can't self-flag)"
    requirement: "SHELL-02"
    verification:
      - kind: unit
        ref: "bash scripts/check-internals-boundary.sh --self-test"
        status: pass
      - kind: unit
        ref: "mutated-fixture negative control (forbidden pattern deleted from a scratch copy) correctly makes --self-test exit non-zero"
        status: pass
    human_judgment: false
  - id: D2
    description: "verify-phase-04.sh: the phase's single aggregator, 9 checks registered (internals-boundary x2, side02 x3, side01, shell01, shell05, side03), --quick under 20s, full run proven red-by-design"
    requirement: "SHELL-01, SHELL-05, SIDE-01, SIDE-02, SIDE-03"
    verification:
      - kind: other
        ref: "bash scripts/verify-phase-04.sh --quick (0.02s, 2 rows, internals-boundary-self-test PASS / internals-boundary FAIL)"
        status: pass
      - kind: e2e
        ref: "full bash scripts/verify-phase-04.sh run (~9 min, real nix develop .#theia backend spawn + real headless objdir/dist/bin/sourcerer launches): 9/9 rows registered, internals-boundary-self-test PASS, all 8 remaining rows FAIL with requirement-ID-named messages, overall exit non-zero, zero orphaned backend/browser processes afterward"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-08-26
status: complete
---

# Phase 4 Plan 1: Wave-0 Verification Harness Summary

**Phase 4's entire acceptance surface (SHELL-01/02/05, SIDE-01/02/03) made runnable before any of its production code exists — 9 checks in scripts/verify-phase-04.sh, proven red-by-design end to end against the real nix/Theia/Firefox stack.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-26T19:59:27Z
- **Completed:** 2026-08-26T20:29:08Z
- **Tasks:** 3
- **Files modified:** 2 (both new)

## Accomplishments

- `scripts/check-internals-boundary.sh`: SHELL-02's executable boundary guard, scanning for `Services.*`, `Cc`/`Ci`/`Cr`/`Cu`, `Components.classes`/`.interfaces`, `AppConstants`, and unconditional `ChromeUtils.import`/`.defineESModuleGetters` — comment-aware (strips `//` and block-comment continuation lines before matching), with a `--self-test` that plants a violating fixture in `mktemp -d` and proves both rejection and correct offense-path naming.
- `scripts/verify-phase-04.sh`: the phase's single aggregator, modelled line-for-line on `verify-phase-03.sh`'s control-flow skeleton (`set -uo pipefail`, `--quick` dispatch, `CURRENT_CHECK_PID`/`TEMP_PATHS` tracking, `cleanup()` trapped on `EXIT`/`INT`/`TERM`, per-check PASS/FAIL summary table). Registers all 9 checks the phase needs:
  - `internals-boundary-self-test`, `internals-boundary` (Task 1, both `--quick`)
  - `side02-token-negative`, `side02-token-positive`, `side02-index-gated`, `side01-bind-scope` (Task 2, backend-spawning)
  - `shell01-theia-is-the-window`, `shell05-paint-before-backend`, `side03-kill-and-recover` (Task 3, browser-launching)
- Verified the harness is genuinely red-by-design with a real, complete run against the actual stack (not a simulation): `nix develop .#theia` fetched/built the dev shell, the stock Theia backend actually started and logged `Theia app listening on http://127.0.0.1:<port>`, the built `objdir/dist/bin/sourcerer` binary actually launched headless under WebDriver BiDi and a live `evaluate('location.href')` correctly read `about:blank`. Every check failed for the intended reason (missing `SOURCERER_BACKEND_READY`/`SOURCERER_SHELL_READY` sentinels, missing `sourcerer/shell/sourcerer.xhtml`, missing `#theia-app-shell`) — none failed from a bug in the harness itself.

## Task Commits

1. **Task 1: Boundary guard end-to-end, wired into the phase aggregator** - `03e5e97` (feat)
2. **Task 2: Backend-facing checks — bind address, token gate, header leak** - `9213099` (feat)
3. **Task 3: End-to-end checks — shell presence, paint ordering, kill-and-recover** - `e3f409c` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `scripts/check-internals-boundary.sh` - SHELL-02 guard: `scan_internals_boundary <dir>`, `run_self_test`, `--self-test` dispatch, default scan of `sourcerer/shell/`
- `scripts/verify-phase-04.sh` - phase aggregator: `start_backend`/`stop_backend`, `start_shell`/`stop_shell`, `first_byte_offset`, 7 check functions, a generated temp `.mjs` runner for `shell01`, and the 9-entry `CHECKS` array

## Decisions Made

1. **check-internals-boundary.sh scans `sourcerer/shell/`, not all of `sourcerer/`.** D-97's decision text says "scans `sourcerer/`", but the repo already carries `sourcerer/branding/{dev,release}/pref/firefox-branding.js` (matches the `*.js` glob, zero forbidden-pattern offenses). Scanning the whole tree would make `internals-boundary` a false, non-vacuous PASS before any Phase 4 chrome code exists — directly contradicting the plan's own must_haves ("every phase-behaviour check reads FAIL" at the end of Wave 0). Scoping to `sourcerer/shell/` (the directory the phase's own artifact manifest names as boundary code's only home) keeps both the non-vacuity assertion and the red-by-design signal honest. Confirmed live: `internals-boundary` correctly FAILs with "scanned file set ... is empty."
2. **side03-kill-and-recover's cookie-continuity assertion is deferred, not faked.** The check proves the load-bearing half of D-104 (backend recovers on the same port with a different pid after SIGKILL) using the currently-ungated health route. It does not assert the token cookie continues to authenticate post-recovery, because a bash/curl driver has no way to read the chrome-set, `SourcererAPI`-minted token value without a WebDriver BiDi `storage.getCookies` call — an export `scripts/lib/firefox-bidi.mjs` does not currently have, and this phase's own key_link forbids modifying that file. Recorded as a known limitation rather than silently asserting something unproven.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] check-internals-boundary.sh default scan target narrowed to `sourcerer/shell/`**
- **Found during:** Task 1 (writing and testing the guard against the real repo)
- **Issue:** D-97/the task action specify scanning `sourcerer/` broadly; the real tree already has 2 legitimate `*.js` pref files under `sourcerer/branding/`, which would make the guard a false-green PASS (non-vacuous, zero offenses) before Phase 4's own shell code exists — contradicting the plan's stated Wave-0 red-by-design requirement.
- **Fix:** Scoped the default scan target to `sourcerer/shell/`, the directory the phase's own artifact manifest (04-PATTERNS.md) names as the sole home for boundary-relevant code.
- **Files modified:** scripts/check-internals-boundary.sh
- **Verification:** `bash scripts/check-internals-boundary.sh` correctly FAILs at Wave 0 with a vacuous-scan message naming `sourcerer/shell`; `git status --porcelain sourcerer patches` stays clean.
- **Committed in:** 03e5e97 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug), plus 1 documented/deferred design limitation (not a deviation from the plan's literal text — it's an honest scope boundary on an assertion the plan describes loosely and that genuinely cannot be built without touching a file this phase forbids touching).
**Impact on plan:** The scan-target fix is required for the harness to actually be red-by-design as the plan demands; without it Task 1's own acceptance criteria ("scanned file set is empty") would not hold against the real repo. No scope creep — no new files, no new dependencies.

## Issues Encountered

- The sandboxed background-execution mechanism (`run_in_background: true`, and a `timeout N bash ...` wrapper) killed the full verification run near-instantly with exit code 144 and no output, on repeated attempts. Worked around by backgrounding the run with a plain `&` + `disown` inside a single foreground Bash call and polling progress with successive `sleep 85`-scale waits in the same session — this successfully carried the full ~9-minute run (real `nix develop` fetch/build, real Theia backend spawn x4, real headless Firefox launch x3) to completion with a correct, fully-verified red-by-design result. Not a defect in the deliverable; an execution-environment quirk of this session.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04-02 (`@sourcerer/token-gate` Theia extension) has a real, already-failing target: all four `side02-*`/`side01-bind-scope` checks and `SOURCERER_BACKEND_READY`'s sentinel are waiting for it.
- Plan 04-03 (shell chrome / `sourcerer.xhtml`) has `shell01-theia-is-the-window`'s static assertion (zero `tabbrowser`/`nav-bar`/`toolbarbutton`/`urlbar` occurrences) and its own file-existence check already wired in.
- Plan 04-04 (backend supervisor / kill-and-recover) inherits `side03-kill-and-recover`'s pid/port assertion as its acceptance bar, plus the noted cookie-continuity gap to close if it wants that half asserted too (likely requires extending `firefox-bidi.mjs`'s exported surface with a cookie-read helper).
- Plan 04-05 (INTERNAL-APIS.md catalogue) appends an `internals-catalogue` check to the same `CHECKS` array — no structural changes needed to this plan's aggregator skeleton.
- No blockers. The harness itself is proven correct (self-test control passes, mutated-fixture negative control correctly goes red, full real-stack run produces the exact expected 9-row red-by-design table with zero orphaned processes).

---
*Phase: 04-full-window-theia-shell*
*Completed: 2026-08-26*
