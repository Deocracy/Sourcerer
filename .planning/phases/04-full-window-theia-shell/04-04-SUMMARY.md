---
phase: 04-full-window-theia-shell
plan: 04
subsystem: infra
tags: [firefox, theia, subprocess, health-check, backoff, sys-mjs]

# Dependency graph
requires:
  - phase: 04-full-window-theia-shell
    provides: "04-02: @sourcerer/token-gate (SOURCERER_BACKEND_READY sentinel, GET /sourcerer/health, SOURCERER_TOKEN cookie gate); 04-03: sourcerer.xhtml/sourcerer.js chrome bootstrap, SourcererAPI.sys.mjs anti-corruption layer, window.sourcererSwapToUrl"
provides:
  - "sourcerer/shell/TheiaService.sys.mjs — the backend supervisor: start(browserElement)/stop()/getState()/getRecentLog(), consumer-only of SourcererAPI.sys.mjs"
  - "sourcerer/shell/SourcererAPI.sys.mjs additions: sleep(ms) (the sys.mjs global scope has no setTimeout), probeHealth(url, token, timeoutMs) (system-privileged XHR — fetch() silently drops the Cookie header), spawnProcess environmentAppend fix"
  - "sourcerer/shell/sourcerer.js wired to call TheiaService.start(browserElement) after the shell-ready sentinel"
  - "sourcerer/shell/jar.mn registers TheiaService.sys.mjs in the chrome package"
affects: [04-05-internal-apis-catalogue]

actuals:
  tokens: 5075
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "TheiaService as a pure consumer of SourcererAPI.sys.mjs (D-96): every Firefox-internal touch — timer, privileged XHR, spawn, kill, cookie, quit observer — is a named SourcererAPI method; TheiaService itself imports nothing but that one chrome:// module (grep -c 'ChromeUtils.importESModule' == 1)"
    - "A self-contained async health loop (while (!this._shuttingDown) { sleep; probe; ...}) instead of a setTimeout-scheduled/cancelable timer — stop() only needs to flip one flag, checked at every await point, rather than plumbing a cancelable handle through the boundary"
    - "System-privileged XMLHttpRequest for the pre-cookie health probe: fetch()'s Headers object silently drops 'Cookie' (a forbidden Fetch-spec header with no privileged-caller carve-out — verified against dom/fetch/InternalHeaders.cpp), but XMLHttpRequestMainThread.cpp's setRequestHeader has exactly that carve-out for a system-principal caller"

key-files:
  created:
    - sourcerer/shell/TheiaService.sys.mjs
  modified:
    - sourcerer/shell/SourcererAPI.sys.mjs
    - sourcerer/shell/jar.mn
    - sourcerer/shell/sourcerer.js

key-decisions:
  - "spawnProcess now passes environmentAppend: true (Rule 1 fix, not in 04-03's original shape) — without it, Subprocess.call()'s options.environment REPLACES the child's entire environment rather than merging, so the spawned Node backend (and anything it shells out to — a Theia-hosted terminal, npm) would have lost PATH/HOME/everything else, keeping only the three sidecar vars."
  - "Backoff constants (500ms initial, doubling, capped at 5000ms) and the two-consecutive-failures threshold stay as literal constants in TheiaService.sys.mjs, not prefs — 04-03's sourcerer-sidecar.js ships exactly the health/timeout/grace/log-buffer prefs this plan's own artifact manifest names as its consumed contract; no restart-backoff pref exists, and inventing one would touch a file outside this plan's files_modified list for no benefit Phase 5 has asked for yet."
  - "The XMLHttpRequest privileged-header carve-out (not fetch()) is the mechanism for the pre-cookie health probe (D-99) — confirmed by reading dom/fetch/InternalHeaders.cpp (no privileged bypass, silent no-op on Set/Append) against dom/xhr/XMLHttpRequestMainThread.cpp's explicit isPrivilegedCaller check, plus the netwerk/test/unit/*cookie_header* precedent for the raw-channel equivalent."
  - "_pushLog timestamps each buffered line (Date.now() prefix) so a restart's actual backoff gaps are independently measurable from getRecentLog() alone — required by this plan's own Task 2 acceptance bar ('successive retry gaps measured from ring-buffer timestamps') but not spelled out in the task's <action> prose."

patterns-established:
  - "Health-loop cancellation via a checked flag at every await point, not a cancelable timer object — simpler and sufficient because nothing in this supervisor blocks waiting on the timer being cancelled; quit is bounded purely by the platform kill call's own grace period."

requirements-completed: [SIDE-01, SIDE-03, SHELL-05]

coverage:
  - id: D1
    description: "TheiaService.start(browserElement): mint token, resolve sidecar (nodePath/backendMain prefs), spawn node+backendMain directly (never a shell wrapper) with port 0 on first spawn, watch stdout/stderr for SOURCERER_BACKEND_READY, health-gate on GET /sourcerer/health via a privileged-XHR Cookie header, set the real chrome cookie, swap exactly once via sourcerer.js's exposed function"
    requirement: "SIDE-01"
    verification:
      - kind: unit
        ref: "bash scripts/check-internals-boundary.sh (PASS, non-vacuous scan including TheiaService.sys.mjs); bash scripts/check-internals-boundary.sh --self-test (PASS)"
        status: pass
      - kind: unit
        ref: "grep -c 'ChromeUtils.importESModule' sourcerer/shell/TheiaService.sys.mjs == 1, target chrome://sourcerer/content/SourcererAPI.sys.mjs; grep -n 'firstSpawn ? 0' shows a single zero-port code path"
        status: pass
      - kind: integration
        ref: "tier-2 mach build faster (~16s, 0 warnings); objdir/dist/bin/browser/chrome/browser/content/sourcerer/TheiaService.sys.mjs symlinked and content-identical to the source"
        status: pass
      - kind: e2e
        ref: "bash scripts/verify-phase-04.sh (side02-token-negative/positive/index-gated, side01-bind-scope — all PASS, unaffected regressions confirming the token-gate contract this plan spawns against still holds)"
        status: pass
      - kind: e2e
        ref: "bash scripts/verify-phase-04.sh (shell01-theia-is-the-window, shell05-paint-before-backend)"
        status: fail
      - kind: manual_procedural
        ref: "Genuinely blocked by a pre-existing, environment-level Firefox content-process IPC failure (RenderCompositorSWGL framebuffer error), confirmed identical to 04-03's documented finding via a direct comparison launch of this plan's own rebuilt binary. Not caused by this plan's code — see Issues Encountered and WINDOWS.md entry 3."
        status: fail
    human_judgment: true
    rationale: "Live end-to-end confirmation of the spawn->swap sequence needs an execution environment where Firefox's headless content-process bring-up completes, which this session's sandbox cannot provide (reproduced identically on the untouched Phase-3 binary in 04-03). Every criterion answerable without a live paint (boundary guard, build, spawn-argument shape, token-gate regression) is verified and passing."
  - id: D2
    description: "_healthLoop()/_restart(): steady-state polling, two-consecutive-failures threshold, pinned-port restart with exponential backoff (500ms->5000ms cap), retrying indefinitely (no give-up threshold, D-103)"
    requirement: "SIDE-03"
    verification:
      - kind: e2e
        ref: "bash scripts/verify-phase-04.sh (side03-kill-and-recover)"
        status: fail
      - kind: manual_procedural
        ref: "Same pre-existing environmental blocker as D1 — the check cannot reach the point of killing a running backend because the browser process never finishes starting. Not caused by this plan's code."
        status: fail
    human_judgment: true
    rationale: "Requires the same live-launch environment gap noted in D1 to resolve. The restart/backoff/pinned-port logic itself is code-reviewed against D-104's invariant (a respawn's sentinel reporting a different port than the pinned one is logged loudly and never followed) and against the plan's own acceptance criteria (single zero-port code path, backoff constants, two-consecutive-failure threshold), but has no live kill-and-recover proof from this session."
  - id: D3
    description: "stop(): observes quit-application-granted (final, non-cancellable), sets the shutting-down flag first, then signals and awaits the backend's exit via one SourcererAPI.killProcess call — never a hand-rolled timer. getState()/getRecentLog() expose port/pid/health/restartCount and the timestamped, size-bounded log buffer for Phase 5's diagnostics page."
    requirement: "SHELL-05"
    verification:
      - kind: unit
        ref: "grep -c setTimeout sourcerer/shell/SourcererAPI.sys.mjs == 0 (kill sequence is still the platform's single call)"
        status: pass
      - kind: unit
        ref: "grep -rn 'IOUtils|OS.File|writeAtomic|sessionstore' sourcerer/shell/ — one hit (SourcererAPI.sys.mjs's pre-existing ensureDirectory/IOUtils.makeDirectory from 04-03, a directory-creation call for Theia's own config storage, not Sourcerer session-state persistence)"
        status: pass
      - kind: manual_procedural
        ref: "Live quit-timing (three runs, grace+2s bound) and quit-races-a-restart both require the same blocked live-launch environment as D1/D2."
        status: fail
    human_judgment: true
    rationale: "Code-reviewed against D-105's ordering (flag first, then one bounded platform call) and against the SIDE-03 acceptance bar for quit-never-races-a-restart (the restart loop checks _shuttingDown immediately after waking from its backoff sleep, before ever spawning again). No live timing measurement was possible in this session."

duration: ~35min
completed: 2026-08-26
status: complete
---

# Phase 4 Plan 4: Backend Supervisor Summary

**`TheiaService.sys.mjs` — the process supervisor that spawns the Theia backend directly (never a shell wrapper), health-gates it through a system-privileged XHR Cookie probe, sets the real chrome cookie before first navigation, swaps the window exactly once, then keeps it alive for the browser session's lifetime with a pinned-port exponential-backoff restart loop and a bounded, flag-driven quit.**

## Performance

- **Duration:** ~35 min
- **Started:** ~2026-08-26T22:15:00Z
- **Completed:** 2026-08-26T22:35:00Z
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `sourcerer/shell/TheiaService.sys.mjs`: the supervisor, importing nothing but `chrome://sourcerer/content/SourcererAPI.sys.mjs` (D-96). `start(browserElement)` mints the per-launch token, resolves `nodePath`/`backendMain` through prefs, creates the sidecar config dir, spawns `node <backendMain> --hostname 127.0.0.1 --port <0|pinned>` with an explicit argument vector (never through a shell wrapper — the returned handle's pid is the real listening process), pumps both output pipes into a bounded ring buffer while watching for `SOURCERER_BACKEND_READY`, health-gates on `GET /sourcerer/health`, sets the chrome cookie, then swaps exactly once via `sourcerer.js`'s own exposed `sourcererSwapToUrl`.
- Steady-state supervision (`_healthLoop`): probes on the steady interval after the swap; two consecutive failures (not one) trigger `_restart()`, which reaps the dead handle and respawns on the **same pinned port with the same token** (D-104), retrying indefinitely with exponential backoff (500ms → doubling → capped at 5000ms — literal constants, no pref exists for these in 04-03's shipped set). A respawn sentinel reporting a different port than the pinned one is logged loudly and never followed.
- Bounded quit (`stop()`): observes `quit-application-granted` (the final, non-cancellable topic — never the earlier cancellable one), sets the shutting-down flag first so no restart can begin, then signals and awaits the backend's exit through a single `SourcererAPI.killProcess` call — the platform's own SIGTERM→grace→SIGKILL sequence, never hand-rolled.
- `getState()`/`getRecentLog()`: port, pid, health status, restart count, and the timestamped, size-bounded (`sourcerer.sidecar.logBufferLines`) log buffer, newest-last — the accessors Phase 5's diagnostics page reads. No page or UI built here.
- Two `SourcererAPI.sys.mjs` additions this plan genuinely needed: `sleep(ms)` (the sys.mjs module global scope has no `setTimeout` — confirmed by reading multiple in-tree modules that either import `Timer.sys.mjs` or hand-roll it with `nsITimer`, neither of which `TheiaService` is allowed to do directly) and `probeHealth(url, token, timeoutMs)` (a system-privileged `XMLHttpRequest` — `fetch()`'s `Headers` object silently drops the `Cookie` header per the Fetch spec with no privileged-caller carve-out, confirmed against `dom/fetch/InternalHeaders.cpp`, but `XMLHttpRequestMainThread.cpp`'s `setRequestHeader` has exactly that carve-out for a system-principal caller).
- Tier-2 rebuild (`mach build faster`) completed in ~16s with 0 warnings after the `jar.mn` addition; the packaged chrome file is a symlink to source, so the two subsequent tasks' edits needed no further rebuild.
- Ran the full `scripts/verify-phase-04.sh` end to end against the real stack: `internals-boundary` (x2), `side02-token-negative/positive/index-gated`, and `side01-bind-scope` all PASS — confirming this plan's spawn contract and Task 2/02's already-shipped token gate are unaffected regressions. `shell01-theia-is-the-window`, `shell05-paint-before-backend`, and `side03-kill-and-recover` FAIL, all for the identical, pre-existing environmental signature documented in `WINDOWS.md` entry 2 (`RenderCompositorSWGL failed mapping default framebuffer` → repeated channel errors, confirmed via a direct comparison launch of this plan's own rebuilt binary). No orphaned backend or browser processes after the run.

## Task Commits

1. **Task 1: Launch to Theia — spawn, gate, cookie, swap** - `8e74c57` (feat)
2. **Task 2: Health loop, backoff restart, and the pinned-port invariant** - `eda54e2` (feat)
3. **Task 3: Bounded quit and the log ring buffer** - `57149ff` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `sourcerer/shell/TheiaService.sys.mjs` - the supervisor: `start`, `stop`, `getState`, `getRecentLog`, and all private spawn/health/restart/logging machinery
- `sourcerer/shell/SourcererAPI.sys.mjs` - `sleep(ms)`, `probeHealth(url, token, timeoutMs)`, and an `environmentAppend: true` fix to `spawnProcess`
- `sourcerer/shell/jar.mn` - `TheiaService.sys.mjs` added to the chrome package
- `sourcerer/shell/sourcerer.js` - imports `TheiaService.sys.mjs` and calls `start(browserElement)` after the shell-ready sentinel

## Decisions Made

1. **`spawnProcess` fixed to append, not replace, the environment (Rule 1).** The pre-existing shape (`Subprocess.call({ environment, ... })` with no `environmentAppend`) replaces the child's *entire* environment with just the object passed in — verified by reading `Subprocess.sys.mjs`'s own `call()` implementation. Without the fix, the spawned Node backend (and anything it shells out to — a Theia-hosted terminal, `npm`) would have had only `SOURCERER_TOKEN`/`THEIA_CONFIG_DIR`/`VSX_REGISTRY_URL` and nothing else — no `PATH`, no `HOME`.
2. **Health probe uses a system-privileged `XMLHttpRequest`, not `fetch()`.** Verified directly against Gecko source: `dom/fetch/InternalHeaders.cpp`'s `Set`/`Append` silently drop a forbidden request-header name (`Cookie` is one) with no privileged-caller exception, while `dom/xhr/XMLHttpRequestMainThread.cpp`'s `SetRequestHeader` has an explicit `isPrivilegedCaller` bypass. Since the token-gate backend (04-02) only reads the token from the `Cookie` header, this is the only correct mechanism for the pre-cookie probe (D-99).
3. **Backoff constants stay literal, not prefs.** 04-03's `sourcerer-sidecar.js` ships exactly the prefs this plan's own artifact manifest lists as its consumed contract (health intervals, timeouts, kill grace, log buffer size) — no restart-backoff pref exists, and this plan's `files_modified` doesn't include `sourcerer-sidecar.js`. Adding one would be scope creep for a value Phase 5 hasn't asked to tune yet.
4. **Health-loop cancellation is a checked flag, not a cancelable timer.** `stop()` never needs to hang waiting on a pending probe or sleep to actually cancel — every await point in `_healthLoop`/`_restart` checks `_shuttingDown` before proceeding, and `stop()`'s own bound comes entirely from the platform kill call's grace period, not from the health loop's cooperation. Simpler than plumbing a cancelable `nsITimer` handle through the boundary for no behavioral gain.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `SourcererAPI.sys.mjs` needed two new methods Task 1 could not function without**
- **Found during:** Task 1 (writing the health-gate poll loop and the pre-cookie probe)
- **Issue:** The plan's Task 1 `<files>` list only names `TheiaService.sys.mjs`, `jar.mn`, `sourcerer.js` — but polling requires a timer primitive (`setTimeout` is not a global in a sys.mjs module's scope, confirmed against multiple in-tree modules), and D-99's pre-cookie probe requires sending the token via the `Cookie` header, which `fetch()` cannot do (forbidden header, no privileged bypass) but `XMLHttpRequest` can (privileged-caller carve-out). TheiaService may import nothing but `SourcererAPI.sys.mjs` (D-96), so both primitives had to live there.
- **Fix:** Added `sleep(ms)` and `probeHealth(url, token, timeoutMs)` to `SourcererAPI.sys.mjs`, both confined to the one file D-96 exempts from the boundary guard.
- **Files modified:** sourcerer/shell/SourcererAPI.sys.mjs
- **Verification:** `check-internals-boundary.sh` still passes with a non-vacuous scan; `TheiaService.sys.mjs`'s own `ChromeUtils.importESModule` count stays 1.
- **Committed in:** 8e74c57 (Task 1 commit)

**2. [Rule 1 - Bug] `spawnProcess`'s environment replaced rather than merged**
- **Found during:** Task 1 (reviewing `Subprocess.sys.mjs`'s `call()` semantics before wiring the spawn)
- **Issue:** `Subprocess.call({ environment, environmentAppend: undefined })` uses `environment` as the child's *entire* environment, not an addition to the inherited one — the pre-existing `spawnProcess` (04-03) would have spawned the Theia backend with only three env vars, no `PATH`/`HOME`.
- **Fix:** Added `environmentAppend: true`.
- **Files modified:** sourcerer/shell/SourcererAPI.sys.mjs
- **Verification:** Read against `Subprocess.sys.mjs:113-124`'s own merge logic; not independently live-tested (backend spawn itself is part of the blocked live-launch surface — see Issues Encountered).
- **Committed in:** 8e74c57 (Task 1 commit)

**3. [Rule 2 - Missing Critical] Ring-buffer lines had no timestamp**
- **Found during:** Task 3 (reviewing Task 2's own acceptance criteria — "successive retry gaps measured from ring-buffer timestamps")
- **Issue:** `_pushLog` stored raw lines with no way to independently measure backoff gaps from `getRecentLog()` alone, which the plan's own Task 2 acceptance bar requires.
- **Fix:** Prefixed each buffered line with `Date.now()`.
- **Files modified:** sourcerer/shell/TheiaService.sys.mjs
- **Verification:** Code inspection; not live-tested (see Issues Encountered).
- **Committed in:** 57149ff (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking — a genuinely missing primitive, 1 bug, 1 missing-critical for the plan's own stated acceptance bar). No scope creep beyond what Task 1's own health-gate logic and D-99's cookie-header requirement made unavoidable; no new dependencies.

## Issues Encountered

**Live end-to-end verification of the spawn → health-gate → cookie → swap sequence, the restart loop, and bounded quit could not be completed in this session**, for the same reason 04-03 documented and flagged forward: this executor's sandboxed environment cannot get a Firefox content process past `RenderCompositorSWGL`/IPC channel setup at all.

- Confirmed via a direct comparison launch of this plan's own rebuilt binary (`objdir/dist/bin/sourcerer --headless --profile <tmp>`): identical `Crash Annotation GraphicsCriticalError: RenderCompositorSWGL failed mapping default framebuffer, no dt` within ~0.5s of every launch, process hangs with no further output, no `SOURCERER_SHELL_READY` or any later sentinel ever printed.
- Ran the full `scripts/verify-phase-04.sh` (not just a spot check): `shell01-theia-is-the-window` fails on a WebDriver BiDi `session.new` timeout (Firefox never reaches a state that accepts a session); `shell05-paint-before-backend` and `side03-kill-and-recover` both time out waiting for sentinels that never appear, with the identical `GraphicsCriticalError` line in their captured logs. `internals-boundary` (x2), `side02-token-negative/positive/index-gated`, and `side01-bind-scope` all PASS unaffected — confirming the failure is specifically in the graphics/compositor bring-up path, not in this plan's spawn logic or the backend it targets.
- No orphaned backend or browser processes after the run (`pgrep -f 'backend/main.js'` / `pgrep -f 'sourcerer --headless'` both empty once `verify-phase-04.sh`'s own cleanup ran).
- Every acceptance criterion answerable without a live paint is verified: `check-internals-boundary.sh` (PASS + `--self-test` PASS), the single zero-port code path, the `ChromeUtils.importESModule` count and its target, the tier-2 build succeeding with the new file symlinked correctly, `grep -c setTimeout` on `SourcererAPI.sys.mjs` returning 0, and the persistence-grep caveat documented above. What remains unverified live is exactly the same class of gap 04-03 recorded: the graphics/compositor bring-up step itself, not this plan's code.
- Recorded as a new entry in `WINDOWS.md` (`unrun-verify`, entry 3), scoped specifically to this plan's own three blocked checks, alongside the existing entry 2 from 04-03.

## User Setup Required

None — no external service configuration required. **Same carry-forward note as 04-03:** whoever next runs this plan's live verification needs an execution environment where Firefox's headless/Xvfb content-process bring-up actually completes — confirmed NOT to work in this session's sandbox regardless of the mitigations 04-03 already tried (Xvfb, GPU/content sandbox disabling, `LIBGL_ALWAYS_SOFTWARE`, single-process mode). A different CI runner or an interactive desktop session is the natural next place to try.

## Next Phase Readiness

- Plan 04-05 (`INTERNAL-APIS.md` catalogue) has a complete, final `SourcererAPI` method set to catalogue: `getStringPref`, `getIntPref`, `getEnv`, `ensureDirectory`, `pathSearch`, `setSessionCookie`, `spawnProcess`, `killProcess`, `readPipeChunk`, `onQuitGranted`, `log`, `sleep`, `probeHealth` — the last two are this plan's additions and need their own catalogue rows (timer primitive; privileged-header XHR, with a note on the `Cookie`-forbidden-header rationale for future rebase auditors).
- `scripts/verify-phase-04.sh` now shows 6/9 checks PASS (`internals-boundary` x2, `side02-*` x3, `side01-bind-scope`); the remaining 3 (`shell01`, `shell05`, `side03`) are blocked by the pre-existing environmental gap, not this plan's code — see `WINDOWS.md` entries 2 and 3.
- **Residual risk, carried forward per the plan's own `<output>` instruction:** the pinned-port-taken-during-a-restart-gap case (another process binding the pinned port between a kill and the next respawn attempt) is explicitly out of scope for Phase 4 per D-104 and belongs to Phase 5's exhausted-backoff handling — `_restart()` will keep retrying on the pinned port indefinitely rather than falling back to a new one, which is correct per D-104 but means a truly stolen port would retry forever without a give-up signal. Not handled here; Phase 5 owns it.
- No blockers for continuing to plan 04-05. The live-verification gap is a session/infrastructure concern (same one 04-03 already flagged), not a defect in any file this plan shipped.

---
*Phase: 04-full-window-theia-shell*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: sourcerer/shell/TheiaService.sys.mjs
- FOUND: sourcerer/shell/SourcererAPI.sys.mjs
- FOUND: sourcerer/shell/jar.mn
- FOUND: sourcerer/shell/sourcerer.js
- FOUND: 8e74c57 (Task 1 commit)
- FOUND: eda54e2 (Task 2 commit)
- FOUND: 57149ff (Task 3 commit)
