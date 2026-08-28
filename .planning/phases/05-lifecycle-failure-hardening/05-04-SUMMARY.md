---
phase: 05-lifecycle-failure-hardening
plan: 04
subsystem: infra
tags: [firefox, xpcom, command-line-handler, single-instance, theia, sourcerer]

# Dependency graph
requires:
  - phase: 05-lifecycle-failure-hardening
    plan: 02
    provides: "scripts/verify-phase-05.sh's start_shell_display/harness-display-available non-headless launch harness with on-demand Xvfb fallback"
  - phase: 05-lifecycle-failure-hardening
    plan: 03
    provides: "The current state of SourcererAPI.sys.mjs/TheiaService.sys.mjs/verify-phase-05.sh this plan extends"
provides:
  - "SIDE-05 in full -- a second launch against the same profile focuses the existing window and opens no second window; the supervisor's start() is idempotent so no second backend is ever spawned even if some other path ever opens a shell window; a launch naming a different profile still gets its own instance"
  - "sourcerer/shell/components.conf -- the phase's one tier-3 XPCOM_MANIFESTS registration"
  - "SourcererSingleInstanceHandler, SourcererAPI.findShellWindow()/focusWindow()"
  - "TheiaService._started -- the idempotent early-return guard on start()"
  - "Two new checks: side05-second-launch-focuses, side05-no-second-backend"
affects: [05-05]

actuals:
  tokens: 5610
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Static XPCOM manifest (components.conf + XPCOM_MANIFESTS) for a command-line-handler registration, sorted by entry-name prefix (a-sourcerer < m-browser < x-default) -- no dynamic Services.catMan.addCategoryEntry, no new patch hunk (sourcerer/shell was already a DIRS member via patches/020)"
    - "The single-instance handler class lives inside SourcererAPI.sys.mjs itself (a second export beside the frozen object), not a sibling module -- it needs ChromeUtils.generateQI/Ci.nsICommandLineHandler, both Ci.-pattern touches the boundary guard forbids everywhere else under sourcerer/shell/"
    - "TheiaService._started set at the very top of start(), before any other await -- catches both a second call and a re-entrant call racing the first launch's own in-flight async work, mirroring stop()'s _shuttingDown guard"
    - "verify-phase-05.sh's start_shell_display() gained an optional explicit-profile-directory parameter (caller-owned/track_temp'd) rather than a second sibling helper -- SIDE-05's checks need two launches sharing one profile path, since Firefox's remoting is profile-keyed"

key-files:
  created:
    - sourcerer/shell/components.conf
  modified:
    - sourcerer/shell/moz.build
    - sourcerer/shell/SourcererAPI.sys.mjs
    - sourcerer/shell/TheiaService.sys.mjs
    - sourcerer/INTERNAL-APIS.md
    - scripts/verify-phase-05.sh

key-decisions:
  - "Entry name a-sourcerer (not researched alternative naming) -- sorts ahead of the stock browser handler's m-browser and far ahead of x-default (the handler that actually opens a window) under nsCategoryManager's ascending strcmp ordering; this ordering is the entire mechanism, confirmed live."
  - "No Ci.nsICommandLine.STATE_INITIAL_LAUNCH or any other state-inspection constant needed -- the handler never reads the command line at all (D-124: ignore every argument), so its only Ci.-pattern touch is Ci.nsICommandLineHandler inside ChromeUtils.generateQI. No classID field either (05-RESEARCH.md's example carried one; the actual in-tree pattern for an ESM-class component registered via components.conf's own cid, confirmed against upstream/remote/components/Marionette.sys.mjs's MarionetteParentProcess, needs none)."
  - "The handler's whole body is wrapped in try/catch, logging via the existing SourcererAPI.log wrapper on any thrown error and returning -- so a bug here can never break the handlers that run after it in the platform's own enumeration (nsCommandLine::EnumerateHandlers runs every registered handler regardless of preventDefault)."
  - "start_shell_display() gained an optional profile-directory parameter instead of a new sibling helper -- the smallest change that lets SIDE-05's checks control which profile two launches share, with every existing call site (unaffected, defaults to a fresh mktemp -d exactly as before)."

patterns-established:
  - "Reused-profile two-launch check shape (side05-second-launch-focuses/side05-no-second-backend): one shared profile directory, first launch waited to SOURCERER_BACKEND_READY before any assertion, second launch run synchronously with `timeout 30` (never backgrounded) so its own exit code IS the assertion -- future single-instance-adjacent checks should follow this shape rather than re-deriving profile-sharing plumbing."

requirements-completed: [SIDE-05]

coverage:
  - id: D1
    description: "A second launch against the same profile focuses the existing window and opens no second window (no second SOURCERER_SHELL_READY sentinel), whether bare or with a file-path argument"
    requirement: SIDE-05
    verification:
      - kind: e2e
        ref: "bash scripts/verify-phase-05.sh --only side05-second-launch-focuses"
        status: pass
    human_judgment: false
  - id: D2
    description: "No second backend is ever spawned: exactly one SOURCERER_BACKEND_READY sentinel across both launches, the announced backend pid unchanged, exactly one live 'backend/main.js' process"
    requirement: SIDE-05
    verification:
      - kind: e2e
        ref: "bash scripts/verify-phase-05.sh --only side05-no-second-backend"
        status: pass
    human_judgment: false
  - id: D3
    description: "A launch naming a DIFFERENT profile still gets its own window and its own distinct backend pid -- the guard is profile-scoped, not a global second-launch break"
    requirement: SIDE-05
    verification:
      - kind: e2e
        ref: "bash scripts/verify-phase-05.sh --only side05-no-second-backend (positive control, same check)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The supervisor's start() is idempotent by construction -- a second call refuses to start a second time, independent of whether a second window is ever opened by some other path"
    requirement: SIDE-05
    verification:
      - kind: unit
        ref: "Code review: TheiaService._started set before any other work in start(), early-return guard mirrors stop()'s _shuttingDown shape"
        status: pass
    human_judgment: false
  - id: D5
    description: "The very first launch (no existing window) is unaffected -- opens exactly one window and reaches Theia as before"
    requirement: SIDE-05
    verification:
      - kind: e2e
        ref: "Live run: objdir/dist/bin/sourcerer --headless with a fresh profile reaches SOURCERER_SHELL_READY -> SOURCERER_BACKEND_READY -> SOURCERER_SHELL_SWAP unaffected"
        status: pass
    human_judgment: false
  - id: D6
    description: "Registration needed no new patch hunk; the full tier-3 build succeeds and the boundary/patch-surface guards stay green"
    requirement: SIDE-05
    verification:
      - kind: unit
        ref: "git diff --stat patches/ (empty); ./mach build exits 0 (0 compiler warnings, StaticComponents.cpp carries the new component); bash scripts/check-internals-boundary.sh && --catalogue && --self-test; bash scripts/check-patch-surface.sh && --self-test"
        status: pass
    human_judgment: false

duration: ~55min (excluding the ~20min background build)
completed: 2026-08-28
status: complete
---

# Phase 5 Plan 4: The Single-Instance Handler Summary

**A static XPCOM `command-line-handler` registration (`a-sourcerer`, sorted ahead of the stock `m-browser`/`x-default` handlers) plus an idempotent `TheiaService.start()` close SIDE-05: a second launch against the same profile focuses the existing window and spawns no second backend, while a launch naming a different profile still gets its own instance.**

## Performance

- **Duration:** ~55 min of active work (plus a ~20 min backgrounded `./mach build`, the phase's one tier-3 trigger)
- **Completed:** 2026-08-28
- **Tasks:** 2
- **Files modified:** 6 (1 created)

## Accomplishments

- **`sourcerer/shell/components.conf`** (new): registers `SourcererSingleInstanceHandler` under `command-line-handler`, entry name `a-sourcerer` -- confirmed live to sort ahead of `m-browser` (`upstream/browser/components/components.conf`) and `x-default` under `nsCategoryManager`'s ascending-`strcmp` category enumeration. No new patch hunk: `sourcerer/shell` was already a `DIRS` member of `browser/moz.build` via `patches/020-sourcerer-shell.patch` -- `git diff --stat patches/` stays empty.
- **`SourcererSingleInstanceHandler`** (exported from `SourcererAPI.sys.mjs`, the one file permitted the `ChromeUtils.generateQI`/`Ci.nsICommandLineHandler` touches it needs): looks up the shell's existing window via the new `SourcererAPI.findShellWindow()` (by `windowtype="sourcerer:main"`, the exact string `sourcerer.xhtml`'s root element declares). No window found (first launch, or a different-profile launch that never even reaches this process) -> does nothing at all. A window found -> `focusWindow(win)` + `cmdLine.preventDefault = true`, never reading a single command-line argument. The whole body is wrapped so a thrown error is logged and swallowed rather than breaking every handler still due to run after it.
- **`TheiaService._started`**: set at the very top of `start()`, before any other work -- catches both a plain second call and a re-entrant call racing the first launch's own in-flight async work, mirroring `stop()`'s existing `_shuttingDown` guard shape. This is D-121's second, construction-level layer: the supervisor refuses to start twice regardless of whether the command-line handler above ever runs.
- **Full `./mach build`** (the phase's one tier-3 trigger, `XPCOM_MANIFESTS` feeding the generated `StaticComponents.cpp` compiled into `libxul.so`): ~20 min wall time (this build recompiled more than the last incremental sccache-warm delta had, but landed clean -- 0 compiler warnings, exit 0 on a confirmatory no-op re-run). `StaticComponents.cpp` carries the new component (`a-sourcerer`, `@sourcerer.dev/single-instance-clh;1`, `SourcererSingleInstanceHandler`) at the expected byte offsets.
- **Two new `scripts/verify-phase-05.sh` checks**, both launched via `start_shell_display` (never headless -- Firefox's remoting protocol is compiled out under `--headless`, `gfxPlatform::IsHeadless()`, per 05-02's Discriminator A/05-RESEARCH.md Pitfall 1):
  - `side05-second-launch-focuses`: one shared profile, first launch waited to `SOURCERER_BACKEND_READY`, then a bare second launch AND a file-path-argument second launch each assert the second process exits (`timeout 30`, never runs on independently), the first process is still running, and exactly one `SOURCERER_SHELL_READY` sentinel exists in the first process's own log (no second window opened).
  - `side05-no-second-backend`: same two-launch shape asserts exactly one `SOURCERER_BACKEND_READY` sentinel across both launches, the announced backend pid unchanged, and exactly one live process matching `backend/main.js` (`pgrep -fc`). Paired with D-125's positive control in the same check: a THIRD launch against a DIFFERENT profile gets its own window and announces its own distinct backend pid, proving the guard is profile-scoped rather than a global break of second launches.
- **Final gate green:** `bash scripts/verify-phase-05.sh` 11/11 PASS (all four SIDE-04 checks, `harness-display-available`, all three SHELL-03 checks, `shell04-diagnostics-with-backend-down`, and the two new SIDE-05 checks); `bash scripts/verify-phase-04.sh` 10/10 PASS; `bash scripts/check-internals-boundary.sh`/`--catalogue`/`--self-test` and `bash scripts/check-patch-surface.sh`/`--self-test` all PASS.

## Task Commits

1. **Task 1: The single-instance handler and the idempotent supervisor** -- `ee3a4c4` (feat)
2. **Task 2: Prove it on a real display** -- `c3dd54d` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `sourcerer/shell/components.conf` (new) -- one class entry: `cid`, contract id `@sourcerer.dev/single-instance-clh;1`, `esModule` `chrome://sourcerer/content/SourcererAPI.sys.mjs`, constructor `SourcererSingleInstanceHandler`, category `command-line-handler: a-sourcerer`
- `sourcerer/shell/moz.build` -- `XPCOM_MANIFESTS += ["components.conf"]`
- `sourcerer/shell/SourcererAPI.sys.mjs` -- `findShellWindow()`, `focusWindow(win)` added to the frozen object; new exported class `SourcererSingleInstanceHandler`
- `sourcerer/shell/TheiaService.sys.mjs` -- `_started` field and the idempotent early-return guard at the top of `start()`
- `sourcerer/INTERNAL-APIS.md` -- two new catalogue rows (`Services.wm.getMostRecentWindow` at `SourcererAPI.sys.mjs:444`, `Ci.nsICommandLineHandler` at `SourcererAPI.sys.mjs:476`), both under a shared "single-instance-handler row" threat note
- `scripts/verify-phase-05.sh` -- `start_shell_display()`'s new optional profile parameter; `side05-second-launch-focuses`, `side05-no-second-backend`

## Decisions Made

See `key-decisions` in frontmatter for the full list with citations. Summary:

- Entry name `a-sourcerer`, confirmed to sort correctly against the real in-tree `m-browser`/`x-default` handlers.
- No `Ci.nsICommandLine.STATE_INITIAL_LAUNCH` and no `classID` field needed -- both were named as plausible requirements in 05-RESEARCH.md's example, but the actual implementation (never reads the command line; an ESM-class component registered via `components.conf`'s own `cid`, matching the in-tree `Marionette.sys.mjs` pattern) needs neither, keeping the boundary-guard surface smaller than the research example suggested.
- `start_shell_display()` extended with a caller-supplied profile parameter rather than a new sibling helper -- smallest change, zero effect on existing call sites.

## Deviations from Plan

None -- plan executed exactly as written. The build took longer than the 05-03 incremental delta figure (247s) suggested, but this was flagged in the plan's own `recorded_decisions` as expected variance for a tier-3 trigger, not a deviation.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required.

## Threat Flags

None -- the new component reads only already-privileged, already-local state (the shell's own window mediator lookup) and introduces no new network endpoint, auth path, file-access pattern, or schema change at a trust boundary. Its threat model is stated directly in `sourcerer/INTERNAL-APIS.md`'s new rows: it never opens a window, never reads a command-line argument, and acts only when an existing window of this application's own window type is found.

## Next Phase Readiness

- SIDE-05 holds in the built binary: `bash scripts/verify-phase-05.sh` exits 0 (11/11), `bash scripts/verify-phase-04.sh` exits 0 (10/10), both boundary/patch-surface guards exit 0 including `--self-test`.
- This closes the fourth and last requirement this phase assigns (SIDE-04, SHELL-03, SHELL-04, SIDE-05) -- 05-05 is free to focus purely on the phase's closing verification/`--gate` mode work without any remaining functional requirement outstanding.
- `WINDOWS.md` #7 (chrome-context Marionette automation blocked on Linux) remains open and unaffected by this plan -- no check in this plan needed chrome-context driving; every SIDE-05 assertion is stdout-sentinel/process-observation based, as WINDOWS.md #7 requires.

---
*Phase: 05-lifecycle-failure-hardening*
*Completed: 2026-08-28*

## Self-Check: PASSED

All modified/created files and both task commit hashes verified present on disk / in git log (see below).
