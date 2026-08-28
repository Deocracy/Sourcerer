---
phase: 05-lifecycle-failure-hardening
plan: 01
subsystem: infra
tags: [firefox, xpcom, js-ctypes, theia, node, proc-signals, sourcerer]

# Dependency graph
requires:
  - phase: 04-full-window-theia-shell
    provides: SOURCERER_BACKEND_READY sentinel, TheiaService supervisor, SourcererAPI anti-corruption boundary, scripts/verify-phase-04.sh's start_shell/backend helpers
provides:
  - SIDE-04 in full -- backend dies with the browser under SIGKILL, and a leftover from a previous crashed launch is detected and reaped on next startup
  - Backend-side parent-death watchdog (stdin EOF, supervised-only)
  - This project's first persistence: sidecar-state.json, one writer (TheiaService._spawnAndGate), one reader (TheiaService._reapLeftover)
  - Five new SourcererAPI methods (writeStateFile/readStateFile/removeStateFile/readProcessStartTicks/signalBarePid)
  - scripts/verify-phase-05.sh with --quick/--only and the four side04-* checks
affects: [05-02, 05-03, 05-04, 05-05]

actuals:
  tokens: 13921
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Backend-side stdin-EOF watchdog gated on an explicit SOURCERER_SUPERVISED=1 env marker, never armed by default"
    - "js-ctypes libc kill(2) wrapper for signalling a bare pid this process did not spawn"
    - "IOUtils.read() + TextDecoder for procfs files, never IOUtils.readUTF8() (readUTF8 ignores maxBytes and sizes its buffer from stat(), which is always 0 for /proc/<pid>/stat)"
    - "Verified-identity reap: /proc/<pid>/stat start-time ticks compared by exact string equality before ever signalling a recorded pid"

key-files:
  created:
    - theia/extensions/token-gate/src/node/parent-watchdog-backend-contribution.ts
    - scripts/verify-phase-05.sh
  modified:
    - theia/extensions/token-gate/src/node/token-gate-backend-module.ts
    - sourcerer/shell/TheiaService.sys.mjs
    - sourcerer/shell/SourcererAPI.sys.mjs
    - sourcerer/INTERNAL-APIS.md

key-decisions:
  - "Watchdog lives as a second class in the existing @sourcerer/token-gate package, bound alongside the token gate -- no new workspace package, no new build wiring (D-109 discretion, matches the plan)"
  - "SourcererAPI.readProcessStartTicks uses IOUtils.read({maxBytes}) + TextDecoder, not IOUtils.readUTF8() -- a real upstream gotcha found live via xpcshell: readUTF8's ReadUTF8Options has no maxBytes field at all (only ReadOptions does), so IOUtils.readUTF8() always sizes its buffer from the target's stat-reported size, and every procfs file reports st_size 0, making readUTF8() silently return an empty string for any /proc/<pid>/stat read with no thrown error"
  - "verify-phase-05.sh's D-125 controls compare startTicks, not raw pid, when asserting a leftover was reaped -- the freshly-spawned real backend can legitimately recycle the just-vacated planted pid, and a raw pid substring match would false-positive on that healthy, unrelated record"
  - "verify-phase-05.sh's wait_pid_gone_or_zombie now reaps its own planted zombie via `wait \"$pid\"` the instant it observes Z/absent state -- the harness IS the real OS parent of its own planted `sleep 300`, and until it reaps that zombie, SourcererAPI.signalBarePid's kill(pid,0) liveness re-check (same zombie-blind gotcha named in 05-RESEARCH.md Pitfall 3) sees it as 'still alive' from the browser's side, for however long the harness happens to leave it unreaped"
  - "The clean-quit-removes-state-file truth was verified by code review (stop() unconditionally reaches removeStateFile after signalling), not by a live external trigger -- Firefox's nsSigHandlers.cpp explicitly SIG_IGNs SIGINT and installs no SIGTERM handler at all, so an external `kill -TERM`/`kill -INT` never reaches quit-application-granted and is not a valid stand-in for a real clean quit; see Issues Encountered"

patterns-established:
  - "Supervision marker pattern: any future backend-side lifecycle hook that must distinguish supervised-vs-standalone launches reads process.env.SOURCERER_SUPERVISED === '1', set only inside TheiaService._spawnAndGate's environment object"
  - "One-shot procfs read: read via IOUtils.read({maxBytes: N}) + TextDecoder, never IOUtils.readUTF8() -- documented inline at the one call site so a future procfs read doesn't repeat the silent-empty-string bug"

requirements-completed: [SIDE-04]

coverage:
  - id: D1
    description: "SIGKILLing the browser process alone (never its process group) leaves zero surviving backend processes, proven by an automated check that first asserts the backend was alive"
    requirement: SIDE-04
    verification:
      - kind: e2e
        ref: "bash scripts/verify-phase-05.sh --only side04-sigkill-no-orphan"
        status: pass
    human_judgment: false
  - id: D2
    description: "An unsupervised backend (no SOURCERER_SUPERVISED marker, stdin from /dev/null) does not self-terminate -- yarn start, smoke-theia.sh and verify-phase-04.sh's start_backend keep working unchanged"
    requirement: SIDE-04
    verification:
      - kind: e2e
        ref: "bash scripts/verify-phase-05.sh --only side04-unsupervised-backend-survives"
        status: pass
      - kind: integration
        ref: "bash scripts/verify-phase-04.sh (all 10 checks, including side02/side01/shell01/shell05/side03)"
        status: pass
      - kind: integration
        ref: "bash scripts/verify-phase-02.sh (all 5 checks)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A leftover backend recorded by a previous crashed launch is reaped (verified identity, then SIGTERM'd) on the next startup, before any new spawn"
    requirement: SIDE-04
    verification:
      - kind: e2e
        ref: "bash scripts/verify-phase-05.sh --only side04-leftover-reaped (stable across 3 consecutive runs)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A recorded pid whose live start-time ticks do NOT match the state file is never signalled (the recycled-pid footgun, D-111) -- the negative control's planted process stays alive and the launch log carries the mismatch line"
    requirement: SIDE-04
    verification:
      - kind: e2e
        ref: "bash scripts/verify-phase-05.sh --only side04-stale-identity-not-signalled (stable across 3 consecutive runs)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Absent, zero-byte, and malformed state files all produce a normal launch reaching SOURCERER_SHELL_SWAP with no thrown error"
    requirement: SIDE-04
    verification:
      - kind: e2e
        ref: "ad-hoc script launching objdir/dist/bin/sourcerer three times against absent/zero-byte/malformed sidecar-state.json, each reaching SOURCERER_SHELL_SWAP with no uncaught/TypeError/ReferenceError in the log"
        status: pass
    human_judgment: false
  - id: D6
    description: "The state file is removed on a clean stop"
    requirement: SIDE-04
    verification: []
    human_judgment: true
    rationale: "Verified by code review only (TheiaService.stop() unconditionally calls SourcererAPI.removeStateFile after signalling the process, on every path). Could not exercise live: Firefox's nsSigHandlers.cpp explicitly SIG_IGNs SIGINT and installs no SIGTERM handler in this build, so an external kill -TERM/-INT never reaches the quit-application-granted topic stop() is wired to -- there is no signal-based way to trigger a real clean quit from outside this headless harness, and no GUI/window-close path is drivable in this sandboxed session. A human (or a future BiDi browser.close-capable check) should confirm this live."
  - id: D7
    description: "Every new Firefox internal reached in this plan has a named SourcererAPI method and a matching sourcerer/INTERNAL-APIS.md row"
    requirement: SIDE-04
    verification:
      - kind: unit
        ref: "bash scripts/check-internals-boundary.sh && bash scripts/check-internals-boundary.sh --catalogue && bash scripts/check-internals-boundary.sh --self-test"
        status: pass
    human_judgment: false

duration: ~75min
completed: 2026-08-27
status: complete
---

# Phase 5 Plan 1: Backend Dies With the Browser Summary

**Backend-side stdin-EOF watchdog plus a verified-identity /proc-start-time leftover reap close SIDE-04 in both directions: SIGKILL leaves no orphan, and a crash-left leftover is signalled only when its live start time exactly matches the recorded value.**

## Performance

- **Duration:** ~75 min
- **Started:** 2026-08-27T23:47:00Z (approx, from STATE.md session start)
- **Completed:** 2026-08-28T01:02:46Z
- **Tasks:** 2
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `SourcererParentWatchdogContribution` (backend-side): closes on `SOURCERER_SUPERVISED=1` only, self-terminates via SIGTERM on stdin `end`/`close`/`error` so Theia's own `gracefulShutdown()` and every `@preDestroy` hook still run -- measured **~56ms** from browser SIGKILL to backend process exit in a direct timed run, no zombie window observed in that sample (the verify script's own `wait_pid_gone_or_zombie` still treats `Z` state as "gone" defensively, since 05-RESEARCH.md Pitfall 3 says this can vary)
- `sourcerer-state.json` (this project's first persistence): one writer (`TheiaService._spawnAndGate`, every successful spawn), one reader (`TheiaService._reapLeftover`, called before the first spawn), removed on clean stop -- example content from a real run:
  ```json
  {"pid":689743,"port":36245,"startTicks":"7145301","writtenAt":1787878929960}
  ```
- Verified-identity reap: `SourcererAPI.readProcessStartTicks` (last-`)`-then-split field-22 read) compared by exact string equality against the recorded value before `SourcererAPI.signalBarePid` ever fires -- a mismatch is logged and left alone, never signalled
- `scripts/verify-phase-05.sh`: new aggregator (`--quick`, `--only <label>`) with all four SIDE-04 checks green and stable across repeated runs; `scripts/verify-phase-04.sh` (10/10) and `scripts/verify-phase-02.sh` (5/5) both still pass unchanged
- Final `SourcererAPI` method set (for later plans in this phase to consume): `getStringPref`, `getIntPref`, `getEnv`, `ensureDirectory`, `pathSearch`, `setSessionCookie`, `spawnProcess`, `killProcess`, `readPipeChunk`, `sleep`, `probeHealth`, `onQuitGranted`, `log`, `notifyStartupFinished`, `createPermanentKey`, `loadURIInBrowser`, `writeStateFile`, `readStateFile`, `removeStateFile`, `readProcessStartTicks`, `signalBarePid`

## Task Commits

1. **Task 1: SIGKILL the browser, watch the backend die -- end to end** - `2bb7288` (feat)
2. **Task 2: The sidecar state file and the verified-identity leftover reap** - `5f6f185` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `theia/extensions/token-gate/src/node/parent-watchdog-backend-contribution.ts` - Backend-side parent-death watchdog, armed only under `SOURCERER_SUPERVISED=1`
- `theia/extensions/token-gate/src/node/token-gate-backend-module.ts` - Binds the new watchdog contribution alongside the existing token gate
- `sourcerer/shell/TheiaService.sys.mjs` - `SOURCERER_SUPERVISED` env var in `_spawnAndGate`; `_stateFilePath`, state-file write on every successful spawn, removal in `stop()`, new `_reapLeftover()`/`_reapLog()`/`_removeStateFileQuietly()`
- `sourcerer/shell/SourcererAPI.sys.mjs` - `writeStateFile`, `readStateFile`, `removeStateFile`, `readProcessStartTicks`, `signalBarePid`; `ctypes` added to the module-level lazy-getter block
- `sourcerer/INTERNAL-APIS.md` - Renumbered every shifted catalogue row (+1, from the new `ctypes` lazy-getter line); extended the module-level lazy-import row with a named bare-pid-kill threat paragraph
- `scripts/verify-phase-05.sh` - New aggregator; `side04-sigkill-no-orphan`, `side04-unsupervised-backend-survives`, `side04-leftover-reaped`, `side04-stale-identity-not-signalled`

## Decisions Made

- Watchdog stays a second class inside `@sourcerer/token-gate`, not a new sibling package -- zero new build wiring, matches D-109's recorded discretion.
- `readProcessStartTicks` reads via `IOUtils.read({maxBytes})` + `TextDecoder`, never `IOUtils.readUTF8()` -- a genuine upstream gotcha confirmed directly against `IOUtils.cpp` and live via `xpcshell`: `readUTF8()`'s own `ReadUTF8Options` dictionary has no `maxBytes` field (only `ReadOptions`, used by `IOUtils.read()`, does), so `readUTF8()` always sizes its read buffer from `stat()`, and every procfs file reports `st_size` 0 -- silently returning an empty string, never throwing.
- `verify-phase-05.sh`'s D-125 controls compare `startTicks`, not raw `pid`, when asserting a leftover was reaped -- the freshly-spawned real backend can legitimately recycle the just-vacated planted pid, and a pid-substring match would false-positive on that healthy, unrelated record.
- `wait_pid_gone_or_zombie` now reaps its own planted process the instant it observes `Z`/absent state, via a plain `wait "$pid"` -- the harness script IS the real OS parent of the process it plants, and until it reaps the resulting zombie, the browser's own `kill(pid,0)` liveness re-check (same zombie-blind gotcha, 05-RESEARCH.md Pitfall 3) sees it as still alive.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `IOUtils.readUTF8()` silently returns an empty string for procfs files**
- **Found during:** Task 2, first live run of `side04-leftover-reaped` -- the reap logic decided every leftover's start-time ticks were `null`, so it always reported a "mismatch" and never signalled anything (including the intended positive-control case)
- **Issue:** `IOUtils.readUTF8(path, {maxBytes})` ignores `maxBytes` entirely (that option lives on the sibling `ReadOptions` dictionary used by `IOUtils.read()`, not on `ReadUTF8Options`), so `readUTF8()` always sizes its internal buffer from the target's `stat()`-reported size. Every file under `/proc` reports `st_size` 0, so the read buffer is always 0 bytes and the call resolves an empty string with no thrown error
- **Fix:** Diagnosed live via `objdir/dist/bin/xpcshell` (confirmed `file.fileSize` reports 0 for a `/proc/<pid>/stat` path while a raw `ctypes` `open()`+`read()` correctly returns the real content) and by reading `IOUtils::ReadUTF8`/`ReadSync` in `upstream/xpcom/ioutils/IOUtils.cpp`. Switched `readProcessStartTicks` to `IOUtils.read(path, {maxBytes: 4096})` (byte array, which DOES honour `maxBytes`) followed by `new TextDecoder().decode(bytes)`
- **Files modified:** `sourcerer/shell/SourcererAPI.sys.mjs`
- **Verification:** `side04-leftover-reaped` and `side04-stale-identity-not-signalled` both pass, stable across 3 consecutive runs each
- **Committed in:** `5f6f185` (Task 2 commit)

**2. [Rule 3 - Blocking] Zombie-reaping race in the verify harness's own planted process**
- **Found during:** Task 2, after fixing the `IOUtils.readUTF8` bug -- `side04-leftover-reaped` still failed intermittently ("state file still records the reaped leftover's own start ticks")
- **Issue:** `verify-phase-05.sh`'s `plant_leftover` spawns `setsid sleep 300 &` from the harness's own bash process, making that bash process the real OS parent. `SourcererAPI.signalBarePid`'s liveness re-check (`kill(pid, 0)`) cannot distinguish a zombie from a live process (05-RESEARCH.md Pitfall 3) -- until the harness's own bash process reaped the zombie (which it only did at final cleanup, well after the assertion ran), the browser's chrome-side reap logic kept seeing the already-SIGTERM'd leftover as "still alive" for up to its own internal 3-second poll budget, racing the harness's assertion
- **Fix:** `wait_pid_gone_or_zombie` now calls `wait "$pid" 2>/dev/null || true` the instant it observes the pid gone or zombied, reaping it immediately (matches how a real init/systemd parent would behave after a crashed supervisor's leftover gets reparented). Also hardened the state-file assertion itself into a bounded settle-poll (10s, 0.3s granularity) rather than a single point-in-time read, and fixed the D-125 positive control's assertion to compare `startTicks` rather than a raw `pid` substring (pid reuse by the freshly-spawned real backend is expected, not a bug)
- **Files modified:** `scripts/verify-phase-05.sh`
- **Verification:** `side04-leftover-reaped` passes stably across 3 consecutive full runs
- **Committed in:** `5f6f185` (Task 2 commit)

**3. [Rule 1 - Bug] `node -e` argv off-by-one in the D-125 fixture writer**
- **Found during:** Task 2, first attempt at `side04-leftover-reaped` -- the planted state file was never created (`ENOENT` on read)
- **Issue:** The inline `node -e '...' arg1 arg2 arg3` fixture-writer destructured `process.argv` as `const [, , path, pid, ticks] = process.argv`, incorrectly skipping two elements. With `-e`, `node`'s `argv[0]` is the node executable and `argv[1]` is the first real argument -- there is no script-path placeholder to skip a second time
- **Fix:** Corrected to `const [, path, pid, ticks] = process.argv`
- **Files modified:** `scripts/verify-phase-05.sh`
- **Verification:** State file writes and reads correctly in all subsequent runs
- **Committed in:** `5f6f185` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs, 1 Rule 3 blocking issue), all confined to Task 2's implementation and its own verification harness. No scope creep -- no architectural changes, no new dependencies.

## Issues Encountered

- **Clean-quit state-file removal not exercised live.** Attempted to verify "the state file is removed on a clean stop" by sending an external `kill -TERM`/`kill -INT` to the running headless browser process. Confirmed by reading `upstream/toolkit/xre/nsSigHandlers.cpp` that this build explicitly `signal(SIGINT, SIG_IGN)`s and installs **no** `SIGTERM` handler at all -- an external signal never reaches Gecko's `quit-application-granted` topic, which is what `TheiaService.stop()` is wired to (via the pre-existing, unmodified `SourcererAPI.onQuitGranted` call from Phase 4). There is no signal-based or headless-driveable way to trigger a real graceful app quit in this sandboxed session (no GUI/window-close path, and WebDriver BiDi's `browser.close` only closes tabs via `TabManager`, which the Sourcerer shell's custom `sourcerer:main` window doesn't participate in the same way a normal browser window does). Verified this specific truth by code review instead: `stop()`'s new `removeStateFile` call is unconditional, runs after signalling the backend, on every path, with the exact same never-throw-tolerant wrapping every other best-effort cleanup call in that function already uses. Flagged as `human_judgment: true` (D6) above rather than asserting an unproven live PASS.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SIDE-04 holds in both directions in the built binary: `bash scripts/verify-phase-05.sh` exits 0 with all four checks PASS, `bash scripts/verify-phase-04.sh` and `bash scripts/verify-phase-02.sh` both still exit 0, and `bash scripts/check-internals-boundary.sh`/`--catalogue`/`--self-test` all exit 0.
- The final `SourcererAPI` method set (listed above) and the `sidecar-state.json` shape (`{pid, port, startTicks, writtenAt}`) are now available for 05-02 (give-up classification), 05-03 (diagnostics layer), 05-04 (single-instance handler), and 05-05 (`--gate` mode) to consume, as named in this plan's `<artifacts_this_phase_produces>`.
- One open verification gap, not a blocker: D6 (clean-quit state-file removal) needs either a human manual check or a future BiDi-capable graceful-quit driver to close live -- tracked here rather than silently assumed.

---
*Phase: 05-lifecycle-failure-hardening*
*Completed: 2026-08-27*

## Self-Check: PASSED

All created files and both task commit hashes verified present on disk / in git log.
