---
phase: 07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a
plan: 06
subsystem: ai
tags: [tauri, react, node, sidecar, session-persistence, restart-reload]

# Dependency graph
requires:
  - phase: 07-02
    provides: File-backed FileSessionManager / SessionManager persistence engine (D-09 on-disk storage)
  - phase: 07-03
    provides: SidecarProcess relay (register/unregister/write_line, pump_stdout id-dispatch), host_ai degrade pattern
  - phase: 07-04
    provides: AssistantPanel minimal chat UI, host.ai() seam, AssistantEvent union
provides:
  - loadSession request + history event on the sidecar stdio contract
  - entriesToTurns() pure replay mapper (SessionEntry[] -> {role,text}[])
  - load_session Tauri command mirroring host_ai's relay/degrade shape
  - host.loadSession() frontend seam
  - AssistantPanel sessionId persistence (localStorage) + mount-time history reload
affects: [07-05, 07-human-uat, future-applet-persistence-migrations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Four-layer request/event relay (webview invoke -> Rust Channel relay -> sidecar stdin/stdout) reused verbatim for a second request type (loadSession) alongside the original prompt type"
    - "Every new sidecar request type gets its own honest-degrade wrapper (try/catch -> error+done) mirroring runPrompt's D-06 contract"
    - "localStorage under sourcerer:<appletKey>:<key> as the interim persistence store ahead of tauri-plugin-store adoption"

key-files:
  created: []
  modified:
    - sidecar/src/protocol.ts
    - sidecar/src/sessions.ts
    - sidecar/src/index.ts
    - sidecar/test/sessions.test.mjs
    - src-tauri/src/commands/ai.rs
    - src-tauri/src/lib.rs
    - src/host/ai.ts
    - src/assistant/AssistantPanel.tsx
    - src/assistant/AssistantPanel.test.tsx

key-decisions:
  - "sessionId persists via localStorage under sourcerer:assistant:sessionId (namespaced per CLAUDE.md applet convention) rather than adopting tauri-plugin-store now — that migration is deferred until a real host.storage seam exists in-repo"
  - "load_session reuses host_ai's exact relay/degrade/timeout shape in Rust rather than a generic abstraction, keeping the two commands independently readable and consistent with the existing degrade_events/send_degrade helpers"
  - "entriesToTurns() is a pure function in sessions.ts (not inlined in index.ts) so it round-trips under a plain unit test without spawning a session or a live turn"

patterns-established:
  - "New sidecar request/event pairs are added without disturbing prior union members - protocol.ts's SidecarRequest/SidecarEvent stay additive across plans"

requirements-completed: [D-09]

# Metrics
duration: ~50min
completed: 2026-07-08
---

# Phase 07 Plan 06: D-09 Gap Closure — History Reload on Restart Summary

**Added a four-layer loadSession/history replay path (sidecar protocol -> Node sidecar -> Rust Tauri command -> AssistantPanel) plus localStorage sessionId persistence, closing GAP-07-D09 so chat history survives an app restart.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-07-08T03:31:43Z
- **Tasks:** 3 (Task 3 was TDD: RED -> GREEN)
- **Files modified:** 9

## Accomplishments
- Sidecar stdio contract gained a `loadSession` request + `history` event, additive to the existing `prompt`/`setModes`/seven-event contract (protocol.ts unchanged shapes preserved).
- `entriesToTurns()` pure mapper in sessions.ts converts Pi's raw `SessionEntry[]` into flat `{role,text}[]` replay turns, unit-tested for order-preservation and content-shape handling (string user content, array-of-parts assistant content).
- `load_session` Tauri command mirrors `host_ai`'s exact relay/timeout/degrade shape (TURN_TIMEOUT-bounded, `send_degrade` on any failure, always `Ok(())`).
- `host.loadSession()` frontend seam added to `src/host/ai.ts`, and `AssistantPanel.tsx` now persists its sessionId under `sourcerer:assistant:sessionId` and reloads/renders the prior session's turns on mount via a `history` event branch.
- All three automated suites pass: `cd sidecar && npm test` (17/17), `cd src-tauri && cargo test` (4/4 + build), `npm test -- src/assistant/AssistantPanel.test.tsx` (8/8, including 4 new D-09 tests).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add loadSession request + history event + replay mapper (sidecar)** - `1617ded` (feat)
2. **Task 2: Add load_session Tauri command relaying history+done (Rust)** - `5224395` (feat)
3. **Task 3: Persist sessionId + reload prior turns on mount (frontend)** - RED `4bd21ed` (test) -> GREEN `984d409` (feat); no refactor commit needed (implementation was already minimal/clean, no cleanup pass required)

**Plan metadata:** (this commit, following SUMMARY.md creation)

## Files Created/Modified
- `sidecar/src/protocol.ts` - `LoadSessionRequest`/`HistoryEvent` added to the `SidecarRequest`/`SidecarEvent` unions; `isSidecarRequest` extended
- `sidecar/src/sessions.ts` - `entriesToTurns()` pure replay mapper exported
- `sidecar/src/index.ts` - `loadSession` branch in `handleRequest`, `ensureFileSessionManager()` helper shared with `buildSession`, `loadSessionHistory()` honest-degrade wrapper
- `sidecar/test/sessions.test.mjs` - `entriesToTurns` round-trip unit test
- `src-tauri/src/commands/ai.rs` - `load_session` command mirroring `host_ai`'s relay/degrade shape
- `src-tauri/src/lib.rs` - registers `load_session` in `generate_handler!`
- `src/host/ai.ts` - `HistoryEvent` added to `AssistantEvent`; `host.loadSession()` seam
- `src/assistant/AssistantPanel.tsx` - `SESSION_STORAGE_KEY`/`loadOrMintSessionId()`, mount `useEffect` calling `host.loadSession()`, `history` event branch replacing `messages`
- `src/assistant/AssistantPanel.test.tsx` - 4 new D-09 tests (reload-history render, sessionId reuse across mounts, fresh-mint-and-persist, empty-turns no-crash)

## Decisions Made
- Kept `load_session` as a hand-mirrored sibling of `host_ai` in Rust rather than extracting a shared relay-loop helper — both commands are small, independently readable, and any future third command can decide then whether extraction pays for itself.
- Left `entriesToTurns` un-exported from any public package boundary beyond `sessions.ts` (sidecar-internal only) since only `index.ts` and its own test consume it.
- No `refactor` commit was needed for Task 3 — the GREEN implementation was already minimal (no duplicated logic, no dead code) so a separate cleanup pass would have been a no-op commit.

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria and interface contracts from `07-06-PLAN.md` were followed verbatim; no Rule 1-4 auto-fixes were needed.

## TDD Gate Compliance

Task 3 (`tdd="true"`) followed the required gate sequence:
1. RED: `4bd21ed` `test(07-06): add failing test for restart-reload of prior turns (D-09)` — verified 3/8 new-area tests failed before implementation (host.loadSession did not exist).
2. GREEN: `984d409` `feat(07-06): persist sessionId + reload prior turns on mount (frontend)` — verified 8/8 tests pass after implementation.
3. REFACTOR: not needed (implementation already minimal); documented rather than skipped silently.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- D-09 gap is closed end-to-end (protocol -> sidecar -> Rust -> panel); the 07-HUMAN-UAT.md Test 4 manual retest (send a turn, close/relaunch, confirm prior turns render) can now be run to confirm the observable truth live.
- No blockers for 07-05 (the remaining wave 3 human-verify checkpoint) or for Phase 07 close-out.

---
*Phase: 07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a*
*Completed: 2026-07-08*

## Self-Check: PASSED

All 9 modified files confirmed present on disk; all 4 task commit hashes (1617ded, 5224395, 4bd21ed, 984d409) confirmed in `git log --oneline --all`.
