---
phase: 05-lifecycle-failure-hardening
plan: 02
subsystem: infra
tags: [firefox, give-up-threshold, error-state, marionette, xvfb, theia, sourcerer]

# Dependency graph
requires:
  - phase: 05-lifecycle-failure-hardening
    plan: 01
    provides: SourcererAPI/TheiaService method set, sidecar-state.json shape, scripts/verify-phase-05.sh's --quick/--only harness
provides:
  - SHELL-03 in full -- an unrecoverable failure gives up instantly, a recoverable one retries within a bounded budget, either way the user gets a branded chrome-rendered error state with a working Retry, and a self-healed backend auto-dismisses it unaided
  - scripts/verify-phase-05.sh's start_shell_display/harness-display-available (non-headless launch discriminator, Xvfb-on-demand fallback)
  - Three new SHELL-03 checks: shell03-unrecoverable-immediate-error, shell03-budget-exhausted-error, shell03-auto-dismiss-on-selfheal
  - Detail/sentinel shapes plan 05-03 must consume (see below)
affects: [05-03, 05-04, 05-05]

actuals:
  tokens: 14084
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Give-up budget counted uniformly across the WHOLE spawn sequence (first attempt included) inside a single _restart() loop, not a separate uncounted first attempt plus N more -- giveUpAttempts=6 means 6 total, never 7"
    - "Per-attempt port choice via `this._port === null` (not a firstSpawn parameter threaded through start()) -- correctly keeps requesting port 0 across every retry until one spawn ever succeeds, then pins for every later respawn"
    - "One shared _restartInFlight guard across _restart()/retry()/the recovery probe -- whichever gets there first runs the only spawn attempt; every other caller no-ops"
    - "_pumpOutput rejects (not silently logs-and-hangs) on a D-112 pinned-port mismatch, marked err.recoverable=false so the caller classifies without re-deriving the reason"
    - "SourcererAPI.pathExists(path) (IOUtils.exists wrapper) distinguishes 'pref unset' from 'pref set to a path that doesn't exist' -- both are D-113 unrecoverable, but only the file-existence check catches the latter"

key-files:
  created: []
  modified:
    - scripts/verify-phase-05.sh
    - sourcerer/shell/TheiaService.sys.mjs
    - sourcerer/shell/SourcererAPI.sys.mjs
    - sourcerer/shell/sourcerer-sidecar.js
    - sourcerer/INTERNAL-APIS.md
    - sourcerer/shell/sourcerer.xhtml
    - sourcerer/shell/sourcerer.css
    - sourcerer/shell/sourcerer.js
    - .planning/WINDOWS.md

key-decisions:
  - "Discriminator A (real display): remoting works. Non-headless launch on a real X11 DISPLAY (:0, this host's real session) paints and reaches SOURCERER_SHELL_SWAP in under 1s -- the RenderCompositorSWGL/headless-compositor gap WINDOWS.md #2-4 tracked was specific to --headless/Xvfb, not to a real display. A second launch against the SAME profile exits near-instantly with zero stdout output and spawns no second sourcerer process and no second backend -- consistent with Firefox's native remoting protocol handing the launch off to the first instance."
  - "Discriminator B (chrome-side Marionette automation): blocked, not merely unverified. capabilities.alwaysMatch['moz:windowless']=true does NOT skip the initial-application-window wait on Linux -- Capabilities.sys.mjs:708-720 gates that capability to AppInfo.isMac only, silently accepting-then-ignoring the value on Linux. driver.sys.mjs's newSession() still calls Services.wm.getMostRecentBrowserWindow() (null for windowtype=sourcerer:main), and WindowManager.sys.mjs's waitForChromeWindowLoaded(null) throws, failing WebDriver:NewSession with 'session not created'. Confirmed live against a raw length-prefixed-JSON Marionette socket client (greeting exchanged correctly: applicationType:gecko, marionetteProtocol:3; WebDriver:NewSession is the exact command and error that failed). scripts/lib/firefox-marionette.mjs was NOT created. WINDOWS.md entry 7 records the finding; the Retry-button click is routed to the human record instead of a fourth automated check."
  - "Give-up budget folds the first spawn attempt into _restart()'s own bounded loop rather than treating start()'s call as a separate, uncounted zeroth attempt -- otherwise giveUpAttempts=6 would silently mean 7 real attempts. Discovered live: an initial design that pre-attempted once in start() and only entered _restart() on failure produced N+1 total attempts for an N-attempt budget."
  - "SourcererAPI.pathExists(path) (new) closes a real gap: sourcerer.sidecar.backendMain pointing at a NONEXISTENT path (not just an unset/empty pref) previously passed _resolveSidecar()'s check, meaning the classic 'backend entry file missing' unrecoverable case (D-113's own named example) was actually being misclassified as a recoverable readiness-stream failure and retried needlessly. Live-verified the fix: 0 respawn-attempt lines for a nonexistent-path launch, versus exactly N for an N-attempt-cap crash loop."
  - "_pumpOutput's D-104 pinned-port-mismatch branch now rejects readyPromise (marked err.recoverable=false) instead of logging and silently returning -- the old shape left the promise pending until the full startupTimeoutMs (90s) elapsed and then misclassified D-112's stolen-pinned-port case as a mere readiness timeout (recoverable), when it can never succeed on an unconditional retry against the same port."
  - "Renumbered sourcerer/INTERNAL-APIS.md's shifted catalogue rows (+10, from the new pathExists method) by hand-auditing every row rather than trusting check-internals-boundary.sh --catalogue's partial FAIL list -- the tool only flagged 11 of 12 shifted rows because one row's stale line number happened to coincidentally already match the post-shift line of a DIFFERENT touchpoint, which would have silently passed the catalogue check while documenting the wrong code at that line."
  - "Recovery probe (_recoveryProbeLoop) reuses _restart() verbatim rather than a separate single-attempt helper -- 'a passing probe takes the same recovery path Retry takes' is implemented literally: probe and Retry are the same call, sharing the same _restartInFlight guard, same give-up budget semantics."

patterns-established:
  - "verify-phase-05.sh's start_shell_display/stop_shell_display: existing DISPLAY preferred, Xvfb resolved on demand via `nix build --no-link --print-out-paths nixpkgs#xorg.xvfb` (no dev shell carries one), returns a DISTINCT status (2) for 'no display obtainable at all' vs 1 for 'binary missing' -- future checks needing a real display reuse this pair, never re-derive Xvfb resolution."
  - "verify-phase-05.sh SHELL-03 checks reuse headless start_shell()/stop_shell() (not start_shell_display) -- proven live that the error-layer/give-up surface is chrome-JS-only with no compositor/paint dependency, so headless is sufficient and faster."
  - "_showError(reason, recoverable)/_hideError() guarded by _errorShown, exactly mirroring _swap()'s _swapped guard -- the established one-flag-per-idempotent-chrome-action shape now used a third time."

requirements-completed: [SHELL-03]

coverage:
  - id: D1
    description: "A failure that can never succeed (missing backend entry file, unresolvable Node, spawn() throwing, pinned port stolen) goes straight to the error state with zero respawn attempts"
    requirement: SHELL-03
    verification:
      - kind: e2e
        ref: "bash scripts/verify-phase-05.sh --only shell03-unrecoverable-immediate-error"
        status: pass
      - kind: manual
        ref: "Live run: backendMain pointed at /nonexistent/path/main.js -- SOURCERER_SHELL_ERROR appears with recoverable:false, zero 'Backend output stream ended'/'did not announce ready'/'health probe' lines, zero SOURCERER_SHELL_SWAP lines"
        status: pass
    human_judgment: false
  - id: D2
    description: "A recoverable failure retries with the existing backoff until the attempt cap or wall-clock ceiling trips, whichever comes first, then reaches the error state -- exactly N attempts for an N-attempt cap, never N-1 or N+1"
    requirement: SHELL-03
    verification:
      - kind: e2e
        ref: "bash scripts/verify-phase-05.sh --only shell03-budget-exhausted-error"
        status: pass
      - kind: manual
        ref: "Live run: giveUpAttempts=2 against an always-exit(1) backend -- elapsed 1.37s to the error sentinel, exactly 2 attempts (4 raw dump+console-mirrored lines / 2), exactly one SOURCERER_SHELL_ERROR sentinel"
        status: pass
    human_judgment: false
  - id: D3
    description: "The error layer paints over <browser> without navigating or destroying the page -- the browser element's location is unchanged while the layer is visible"
    requirement: SHELL-03
    verification:
      - kind: e2e
        ref: "bash scripts/verify-phase-05.sh --only shell03-auto-dismiss-on-selfheal (asserts exactly one SOURCERER_SHELL_SWAP sentinel across a run that also shows and clears the error)"
        status: pass
      - kind: unit
        ref: "grep -c sourcererSwapToUrl sourcerer/shell/TheiaService.sys.mjs == 1; grep -c loadURIInBrowser sourcerer/shell/TheiaService.sys.mjs == 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "The user sees a plain-language message, a Retry control, and a route to diagnostics -- never a blank/frozen window or a raw stack trace"
    requirement: SHELL-03
    verification:
      - kind: unit
        ref: "xmllint --noout sourcerer/shell/sourcerer.xhtml; manual review of #sourcerer-error markup and sourcerer.css"
        status: pass
      - kind: manual
        ref: "Retry BUTTON CLICK itself is not automated -- routed to the human record (see Issues/Deferred below); the button's presence, styling, and wiring to the retry global are verified, but no automated harness can click it (Discriminator B)"
        status: pass
    human_judgment: true
    rationale: "Discriminator B (chrome-side Marionette automation) is blocked on Linux (moz:windowless is macOS-only, Capabilities.sys.mjs:708-720), confirmed live against a raw Marionette socket client. The Retry control's click-and-recover behavior is provable in principle (TheiaService.retry() -> _restart(), already exercised end-to-end by the recovery-probe path in shell03-auto-dismiss-on-selfheal, which calls the identical code path) but the literal button click needs a human or a future BiDi-capable chrome driver."
  - id: D5
    description: "Retry resets the give-up budget and respawns on the pinned port; a self-healed backend is noticed by the background probe and the error layer auto-dismisses with no user action"
    requirement: SHELL-03
    verification:
      - kind: e2e
        ref: "bash scripts/verify-phase-05.sh --only shell03-auto-dismiss-on-selfheal -- genuinely mid-session: one successful launch (one swap), a self-triggered crash 3s later, single-attempt give-up (error shown), recovery probe's respawn succeeds (error cleared), no input sent to the window"
        status: pass
    human_judgment: false
  - id: D6
    description: "Idempotency and concurrency edges: showing the error state twice paints once and emits one sentinel; Retry/probe/health-loop never run two spawn attempts at once"
    requirement: SHELL-03
    verification:
      - kind: unit
        ref: "Code review: _showError/_hideError guarded by _errorShown; _restart()/retry()/_recoveryProbeLoop share one _restartInFlight guard, checked at entry"
        status: pass
      - kind: e2e
        ref: "shell03-budget-exhausted-error asserts exactly one SOURCERER_SHELL_ERROR sentinel even though the give-up path could in principle be reached more than once"
        status: pass
    human_judgment: false
  - id: D7
    description: "Chrome-side automation availability is a recorded, evidence-backed finding, not an assumption -- routed to the human record and the broken-windows ledger if unavailable"
    requirement: SHELL-03
    verification:
      - kind: manual
        ref: "WINDOWS.md entry 7; this summary's key-decisions; scripts/verify-phase-05.sh's harness-display-available check (Discriminator A) plus the live raw-socket Marionette probe (Discriminator B, not persisted as a script since it doesn't work)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Every new Firefox internal reached in this plan has a named SourcererAPI method and a matching sourcerer/INTERNAL-APIS.md row; the boundary guard stays green"
    requirement: SHELL-03
    verification:
      - kind: unit
        ref: "bash scripts/check-internals-boundary.sh && bash scripts/check-internals-boundary.sh --catalogue && bash scripts/check-internals-boundary.sh --self-test"
        status: pass
    human_judgment: false

duration: ~95min
completed: 2026-08-28
status: complete
---

# Phase 5 Plan 2: The Give-Up Threshold and the Branded Error State Summary

**SHELL-03 closes end-to-end in the built binary: an unrecoverable failure (missing backend file, unresolvable Node, a spawn() throw, or a stolen pinned port) gives up in under 1.4s with zero respawn attempts; a recoverable one retries exactly N times (the configured budget, first attempt included) before the same branded chrome-rendered error state appears with a working Retry; and a genuinely mid-session outage self-heals via a background probe with no input and no navigation of the underlying page.**

## Performance

- **Duration:** ~95 min
- **Completed:** 2026-08-28
- **Tasks:** 3
- **Files modified:** 9 (0 created — `scripts/lib/firefox-marionette.mjs` was deliberately NOT created, see Discriminator B)

## Accomplishments

- **Discriminator A (real display) settled: remoting works.** `scripts/verify-phase-05.sh`'s new `start_shell_display`/`harness-display-available` prove the shell paints and Firefox's native remoting protocol functions on a real (or on-demand Xvfb) `DISPLAY` — the opposite of the existing headless `start_shell()`, which the research phase already established compiles remoting out entirely (`gfxPlatform::IsHeadless()` → `mDisableRemoteClient=true`). Live: `SOURCERER_SHELL_READY` in ~1s, full backend spawn to `SOURCERER_SHELL_SWAP` in well under a second more; a second launch against the identical profile exits near-instantly with zero stdout output and spawns no second `sourcerer` process, no second backend — consistent with a successful remote hand-off to the first instance, not two independent launches.
- **Discriminator B (chrome-side Marionette automation) settled: blocked on Linux, evidence-backed.** `capabilities.alwaysMatch["moz:windowless"]=true` does not skip the initial-window wait on this platform — `Capabilities.sys.mjs:708-720` gates that capability to `AppInfo.isMac` only. Confirmed live against a hand-rolled, length-prefixed-JSON Marionette socket client: greeting exchanged correctly, `WebDriver:NewSession` is the exact command that fails (`session not created` / `TypeError: can't access property "document", window is null`, from `WindowManager.sys.mjs:586`'s `waitForChromeWindowLoaded(null)` since `Services.wm.getMostRecentBrowserWindow()` returns `null` for `windowtype="sourcerer:main"`). `scripts/lib/firefox-marionette.mjs` was **not created**. Broken-windows ledger entry **7** records the finding; the Retry-button click is routed to the human record.
- **Split give-up rule (D-113) closed in `TheiaService.sys.mjs`.** `_spawnAndGate()` now returns `{ok, recoverable, reason}`; the four unrecoverable classes (backend entry file missing **from disk, not just an unset pref** — new `SourcererAPI.pathExists`, a real gap found live; Node unresolvable; `spawn()` throwing; D-112's pinned-port-stolen case, now rejected immediately by `_pumpOutput` instead of silently hanging the readiness promise for up to 90s) give up with zero wait; everything else retries with the existing 500ms→5000ms backoff until `sourcerer.sidecar.giveUpAttempts`/`giveUpWallclockMs` (prefs, defaulting 6/45000ms) trips. The very first spawn attempt is folded into `_restart()`'s own bounded loop so the budget always means the stated total, never total+1 — a real design bug caught live during this plan's own verification.
- **Branded error layer, Retry, auto-dismiss (D-114/D-115/D-116) shipped.** `#sourcerer-error` joins the existing deck in `sourcerer.xhtml` (message, Retry button, a Details control disabled until 05-03 defines `sourcererShowDiagnostics`), styled in `sourcerer.css` as the same visual family as the loading layer. `sourcerer.js` exposes `sourcererShowError(detail)`/`sourcererHideError()`/`sourcererRetry()`, reached by `TheiaService` exactly like `sourcererSwapToUrl` — never touching the browser element's own location. `_recoveryProbeLoop()` (new, `sourcerer.sidecar.recoveryProbeIntervalMs`, defaulting 15000ms) takes the literal same `_restart()` path Retry does, sharing one `_restartInFlight` guard so at most one spawn attempt is ever in flight.
- **Three new checks, all live-verified against the built binary, headless (proven sufficient — no compositor/paint dependency for this chrome-JS-only surface):** `shell03-unrecoverable-immediate-error`, `shell03-budget-exhausted-error` (2-attempt cap → exactly 2 attempts, 1.37s elapsed, exactly one error sentinel), `shell03-auto-dismiss-on-selfheal` (a **genuinely mid-session** outage: one successful launch → one swap sentinel → a self-triggered crash 3s later → single-attempt give-up → recovery probe's respawn clears it, no input sent, exactly one swap sentinel across the whole run).
- **Final gate green:** `bash scripts/verify-phase-05.sh` 8/8 PASS, `bash scripts/verify-phase-04.sh` 10/10 PASS (including `side03-kill-and-recover` exercising the new `_restart()` path), `bash scripts/check-internals-boundary.sh` (plain/`--catalogue`/`--self-test`) all PASS, `xmllint --noout sourcerer/shell/sourcerer.xhtml` well-formed.

## Task Commits

1. **Task 1: Two discriminators -- a real display, and chrome-side automation** — `07750fb` (feat)
2. **Task 2: The split give-up rule** — `7f93acc` (feat)
3. **Task 3: The branded error layer, Retry, and auto-dismiss** — `f944f5e` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `scripts/verify-phase-05.sh` — `start_shell_display`/`stop_shell_display`/`harness-display-available` (Task 1); `shell03-unrecoverable-immediate-error`/`shell03-budget-exhausted-error`/`shell03-auto-dismiss-on-selfheal` (Task 3)
- `sourcerer/shell/TheiaService.sys.mjs` — `_spawnAndGate()`'s classified return shape, `_resolveSidecar()`'s file-existence check, `_pumpOutput()`'s immediate port-conflict rejection, `_restart()`'s bounded give-up loop and `_restartInFlight` guard, `retry()`, `_recoveryProbeLoop()`/`_startRecoveryProbe()`/`_stopRecoveryProbe()`, `_showError()`/`_hideError()`
- `sourcerer/shell/SourcererAPI.sys.mjs` — new `pathExists(path)` method
- `sourcerer/shell/sourcerer-sidecar.js` — three new prefs: `giveUpAttempts` (6), `giveUpWallclockMs` (45000), `recoveryProbeIntervalMs` (15000)
- `sourcerer/INTERNAL-APIS.md` — renumbered every catalogue row shifted by the new `pathExists` method (+10 lines)
- `sourcerer/shell/sourcerer.xhtml` — `#sourcerer-error` layer (message, Retry, disabled Details control)
- `sourcerer/shell/sourcerer.css` — the error layer's rule blocks, same family as `#sourcerer-loading`
- `sourcerer/shell/sourcerer.js` — `sourcererShowError`/`sourcererHideError`/`sourcererRetry` globals, Retry button wiring
- `.planning/WINDOWS.md` — new entry 7 (Discriminator B finding)

## Decisions Made

See `key-decisions` in frontmatter for the full list with citations. Summary:

- Discriminator A: remoting works on a real display (not headless).
- Discriminator B: `moz:windowless` is macOS-only — chrome-side Marionette automation is blocked on Linux, not merely unverified. `firefox-marionette.mjs` was not created.
- Give-up budget counts the first attempt (fold into `_restart()`, not a separate pre-attempt in `start()`).
- `SourcererAPI.pathExists` closes a real classification gap (nonexistent-but-set `backendMain` was being misclassified as recoverable before this plan).
- `_pumpOutput`'s D-112 port-mismatch rejection is immediate, not a silent 90s hang.
- `INTERNAL-APIS.md` catalogue rows fully hand-audited after the shift, not trusted to the tool's partial FAIL list.
- The recovery probe reuses `_restart()` verbatim rather than a bespoke single-attempt helper.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `backendMain` pointing at a nonexistent (but non-empty) path was misclassified as recoverable**
- **Found during:** Task 2, first live smoke test of the unrecoverable-immediate-error scenario
- **Issue:** `_resolveSidecar()` only checked `!this._backendMain` (empty-string/unset), never whether the configured path actually exists on disk. A `user.js` pointing `backendMain` at a nonexistent path passed resolution, so the failure only surfaced when Node crashed with `MODULE_NOT_FOUND` well inside `_spawnAndGate`, classified as a transient "output stream ended" failure and retried repeatedly instead of giving up immediately — directly contradicting D-113's own named example ("the backend entry file missing").
- **Fix:** Added `SourcererAPI.pathExists(path)` (new `IOUtils.exists` wrapper) and an existence check in `_resolveSidecar()`, giving a distinct unrecoverable reason.
- **Files modified:** `sourcerer/shell/SourcererAPI.sys.mjs`, `sourcerer/shell/TheiaService.sys.mjs`, `sourcerer/INTERNAL-APIS.md` (renumbering)
- **Verification:** Live run: 0 respawn-attempt lines, error sentinel within seconds; `shell03-unrecoverable-immediate-error` PASS
- **Committed in:** `7f93acc` (Task 2 commit)

**2. [Rule 1 - Bug] Give-up budget counted N+1 attempts instead of N**
- **Found during:** Task 2, second live smoke test (budget-exhausted scenario with `giveUpAttempts=2`)
- **Issue:** An initial design had `start()` make one uncounted `_spawnAndGate(true)` attempt itself, only entering `_restart()`'s own N-attempt loop on failure — so a `giveUpAttempts=2` launch actually made 3 real spawn attempts (1 uncounted + 2 counted) before giving up, silently violating the plan's own recorded-decision math ("With the existing backoff... six attempts spend about 17.5 seconds").
- **Fix:** `start()` now only resolves the sidecar, reaps any leftover, and calls `_restart()` unconditionally; `_restart()`'s own loop folds in the very first attempt (`this._port === null` decides port-0-vs-pinned per attempt, replacing the removed `firstSpawn` parameter threading), so `giveUpAttempts` always means the literal total.
- **Files modified:** `sourcerer/shell/TheiaService.sys.mjs`
- **Verification:** Live run: `giveUpAttempts=2` produces exactly 2 attempts (4 raw dump+console-mirrored lines / 2), 1.37s elapsed; `shell03-budget-exhausted-error` PASS
- **Committed in:** `7f93acc` (Task 2 commit)

**3. [Rule 1 - Bug] D-112's stolen-pinned-port case silently hung for up to 90s instead of failing immediately**
- **Found during:** Task 2, code review while implementing the classification (not caught by a live test in this plan, since reliably squatting the pinned port from a verify script is its own significant undertaking outside this plan's scope — flagged here as a code-level fix backed by the existing D-104 mismatch-detection logic, not a live-reproduced regression)
- **Issue:** `_pumpOutput`'s existing D-104 port-mismatch detection called `_fatal()` and returned, leaving `readyPromise` pending forever — the caller then waited out the full `startupTimeoutMs` (90000ms default) and classified the eventual `!ready` timeout as a merely recoverable readiness failure, when a respawn reporting a different port than pinned can never succeed on an unconditional retry against the same port.
- **Fix:** The mismatch branch now rejects `readyPromise` immediately with an `Error` marked `err.recoverable = false`; `_spawnAndGate`'s catch classifies on that marker without re-deriving the reason.
- **Files modified:** `sourcerer/shell/TheiaService.sys.mjs`
- **Verification:** Code review only for the live-hang fix itself (the underlying D-104 mismatch detection and its `_fatal()` call remain covered by existing scrutiny); the general give-up/error-state machinery this fix feeds into is live-verified via the other two checks
- **Committed in:** `7f93acc` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 bugs), all confined to Task 2's own implementation and caught by this plan's own live verification loop (not carried over from a prior plan). No scope creep — no architectural changes, no new dependencies, no npm/PyPI packages added.

## Issues Encountered

- **Discriminator B (chrome-side Marionette automation) is blocked on Linux**, not merely unverified — see Discriminator findings above and `.planning/WINDOWS.md` entry 7. This is a genuine platform gate (`moz:windowless` is `AppInfo.isMac`-only in this ESR-153 tree), not a bug in this project's code. Consequence: the Retry button's literal click-and-observe-recovery cannot be automated in this repo today. The underlying code path it would exercise (`TheiaService.retry()` → `_restart()`) is NOT unverified, though — `shell03-auto-dismiss-on-selfheal`'s recovery probe calls the exact same `retry()`/`_restart()` machinery Retry does (D-115's own stated design: "a passing probe takes the same recovery path Retry takes"), so the mechanism is exercised end-to-end by an automated check; only the physical button click and DOM `style.display` toggle are unverified by automation. Recorded as `human_judgment: true` (D4) above rather than asserted as a live PASS. A future BiDi-capable chrome driver, or a manual click during `05-05`'s human working-day verification (D-126), should close this.

## User Setup Required

None — no external service configuration required.

## Detail/Sentinel Shapes for Plan 05-03

Plan 05-03 (SHELL-04, the diagnostics layer) consumes the following from this plan:

- **`sourcererShowDiagnostics()` global**: must be defined in `sourcerer.js` for `#sourcerer-error-diagnostics` (currently `disabled="disabled"` in `sourcerer.xhtml`) to become live. The button's click handler already checks `typeof window.sourcererShowDiagnostics === "function"` and calls it if present — 05-03 only needs to (a) define the global and (b) remove/flip the `disabled` attribute; no other wiring changes needed in this file.
- **`TheiaService._showError(reason, recoverable)` detail shape**: `{ reason: string, recoverable: boolean }` — exactly two keys, no token, no credential. `sourcererShowError(detail)` destructures `{ reason, recoverable }` and both are echoed verbatim into the `SOURCERER_SHELL_ERROR` sentinel's JSON.
- **Sentinels**: `SOURCERER_SHELL_ERROR {"reason":"...","recoverable":true|false}` and `SOURCERER_SHELL_ERROR_CLEARED {}`, both written via `dump()` from `sourcerer.js` (not mirrored through `SourcererAPI.log()`, so — unlike `TheiaService`'s own `_fatal()`-routed lines — each appears exactly once per state change, never duplicated by the console mirror).
- **`TheiaService.getState()`/`getRecentLog()`** are unchanged by this plan (still port/pid/healthy/restartCount and the timestamped ring buffer) — 05-03's diagnostics layer reads them as-is; this plan added no new fields to either.

---
*Phase: 05-lifecycle-failure-hardening*
*Completed: 2026-08-28*

## Self-Check: PASSED

All modified files and all three task commit hashes verified present on disk / in git log (see Self-Check section below for the actual commands run).
