---
phase: 07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a
plan: 02
subsystem: ai
tags: [pi-coding-agent, node, typescript, databasise, sessions, tool-adapter]

# Dependency graph
requires: ["07-01"]
provides:
  - "sidecar/src/tools/databasise.ts: D-03 four-tool openapi->Pi tool generator with D-06 honest-degrade + D-07 guest-mode"
  - "sidecar/src/sessions.ts: FileSessionManager (D-09) wrapping Pi's SessionManager, per-sessionId JSONL persistence"
  - "index.ts createAgentSession wired to both: allModeTools() awaited into customTools, sessionManager is file-backed keyed on sessionId"
affects: [07-03, 07-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pi's SessionManager only flushes to disk once a real assistant-role message entry exists (lazy-flush design in _persist()); tests exercising round-trip persistence must append a genuine assistant message, not just custom/user entries"
    - "AgentSession construction is now per-sessionId and lazy: index.ts caches a Map<sessionId, Promise<AgentSession>> and builds on first prompt referencing that id, rather than eagerly at boot"
    - "modes.ts setModes() tolerates being called before any session is bound (updates the active-mode Set for the next session build instead of throwing)"

key-files:
  created:
    - sidecar/test/tools.test.mjs
    - sidecar/test/sessions.test.mjs
  modified:
    - sidecar/src/index.ts
    - sidecar/src/modes.ts
    - sidecar/package.json
    - sidecar/test/harness.test.mjs
  preserved-from-wip:
    - sidecar/src/tools/databasise.ts
    - sidecar/src/sessions.ts

key-decisions:
  - "Session construction deferred from boot to first prompt, keyed by the sessionId carried on each PromptRequest (protocol.ts), because FileSessionManager.open() needs a concrete sessionId and the stdio protocol only supplies one per-request, not at process start."
  - "buildSession(sessionId = \"default\") keeps the default parameter so pre-existing harness.test.mjs calls (buildSession() with no args) continue to compile and pass unchanged."
  - "setModes() no longer throws when no session is bound yet (Rule 3 fix, self-caused by deferring session build) — the active-mode Set still updates correctly for whatever session gets built next; only the live reload()/setActiveToolsByName() step is skipped when there's nothing to drive yet."

requirements-completed: [D-03, D-06, D-07, D-09]

# Metrics
duration: ~55min
completed: 2026-07-08
---

# Phase 07 Plan 02: Databasise Research Tools + File-Backed Sessions Summary

**Finished a prior session's in-progress work: wired the already-written D-03 Databasise tool adapter and D-09 FileSessionManager into `index.ts`'s `createAgentSession` call (which no longer compiled), and authored the two missing offline test suites the plan required.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2 (both pre-implemented by a prior session at the adapter level; this execution fixed the broken integration point and added the missing tests)
- **Files modified:** 8 (2 created new test files, 4 modified, 2 preserved as-is from WIP)

## Accomplishments

- **Fixed the broken `index.ts` integration** left by the prior session: `createAgentSession`'s `customTools` now `await`s `allModeTools()` (previously passed the async function reference itself, which would have silently registered zero tools — `ToolDefinition[]` cast was hiding a real type mismatch until compiled), and `sessionManager` is now the file-backed `FileSessionManager`-derived `SessionManager` for the request's `sessionId`, replacing the removed `SessionManager.inMemory()` placeholder.
- **Session lifecycle re-architected around per-sessionId, lazy construction**: since `sessionManager` must be a concrete `SessionManager` instance for one conversation (not a manager-of-managers), and the stdio protocol's `sessionId` only arrives per-`prompt`-request (not at boot), `index.ts`'s `main()` now caches `AgentSession`s in a `Map<sessionId, Promise<AgentSession>>`, building lazily on first use per id rather than eagerly at startup. `writeEvent({type:"ready"})` now fires immediately without waiting on any session build.
- **Preserved all prior-session WIP files unmodified**: `sidecar/src/tools/databasise.ts` (the D-03/D-06/D-07 tool generator) and `sidecar/src/sessions.ts` (`FileSessionManager`, D-09, T-07-08 guard) needed no changes — both were already correct.
- **`sidecar/test/tools.test.mjs`** (new, 4 tests): whitelist is exactly the four D-03 tools with `/wiki/preview` absent; spec-fetch failure still yields four tools (D-06 offline boot); every tool's `execute()` degrades to the honest `WIKI_UNAVAILABLE_MESSAGE` text and never throws when Databasise is unreachable (pointed at a closed loopback port, no live server needed); no `Authorization` header is ever set in a `fetch()` `headers:` literal (D-07).
- **`sidecar/test/sessions.test.mjs`** (new, 5 tests): appended turns round-trip across a freshly reconstructed `FileSessionManager` instance (simulated restart, D-09); a malformed JSONL line is skipped rather than fatal; turns are appended (never full-file rewrites); path-traversal-shaped sessionIds are rejected (T-07-08, both via `isValidSessionId()` and `FileSessionManager.open()` itself); a fresh session directory lists as empty.
- **`npm test` now runs all three suites** (`harness.test.mjs` + `tools.test.mjs` + `sessions.test.mjs`) — 15/15 green. `npx tsc --noEmit` clean.

## Task Commits

1. **Task 1 + 2 integration fix (index.ts/modes.ts) + preserved adapters (databasise.ts/sessions.ts)** — `60d76f2` (feat)
2. **Task 1 + 2 test suites (tools.test.mjs/sessions.test.mjs) + test-harness wiring (package.json/harness.test.mjs)** — `0bad148` (test)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP update)

## Files Created/Modified

- `sidecar/src/tools/databasise.ts` — **preserved unmodified** from prior WIP: D-03 four-tool generator (`wiki_resolve`, `wiki_unresolved`, `wiki_unplaced`, `kb_query`) from live `/openapi.json`, D-06 honest-degrade on both spec-fetch and every `execute()`, D-07 guest-mode (no auth header), 4000-char truncation, 240s timeout.
- `sidecar/src/sessions.ts` — **preserved unmodified** from prior WIP: `FileSessionManager` wrapping Pi's own `SessionManager` class, resolving an OS app-data session dir, listing/opening/creating per-sessionId JSONL conversations, `isValidSessionId()`/`SESSION_ID_PATTERN` guard (T-07-08).
- `sidecar/src/index.ts` — fixed: `buildSession(sessionId = "default")` now opens the matching file-backed `SessionManager` via a module-level `FileSessionManager` and awaits `allModeTools()` for `customTools`; `main()` defers `AgentSession` construction to first `prompt` per `sessionId`, cached in `sessionsById`; emits `ready` immediately.
- `sidecar/src/modes.ts` — `setModes()` now returns early (no-op on the session-driving half) instead of throwing when called before any session is bound, since session-build is now deferred; the active-mode `Set` update still happens unconditionally.
- `sidecar/package.json` — `test` script now runs `harness.test.mjs test/tools.test.mjs test/sessions.test.mjs`.
- `sidecar/test/harness.test.mjs` — pins `SOURCERER_SESSION_DIR` to a temp dir so this suite (which calls `buildSession()`, now file-session-backed) never writes into the real per-OS Sourcerer app-data directory.
- `sidecar/test/tools.test.mjs` — new, 4 offline tests (see Accomplishments).
- `sidecar/test/sessions.test.mjs` — new, 5 offline tests (see Accomplishments).

## Decisions Made

- **Session construction is per-`sessionId` and lazy**, not eager-at-boot as 07-01 originally sketched — a direct consequence of `sessionManager:` needing one concrete `SessionManager` per conversation while `sessionId` only arrives with each `prompt` request. `sessionsById: Map<string, Promise<AgentSession>>` in `index.ts` caches each conversation's `AgentSession` for the process lifetime once built.
- **`buildSession()` keeps a default `sessionId` parameter ("default")** specifically so the pre-existing `harness.test.mjs` (calls `buildSession()` with no arguments, twice) needed zero changes to its call sites — only an env var addition to avoid touching real app-data during tests.
- **`setModes()` early-return instead of throw when unbound** — this is a deviation caused by the index.ts lazy-build change itself (see Deviations below), not a pre-existing bug.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `index.ts` did not compile: `customTools` passed the async function reference, `sessionManager` referenced a removed import**
- **Found during:** Task 1/2 integration (this was the primary blocker this execution was spawned to fix)
- **Issue:** A prior session had changed `modes.ts`'s `allModeTools` to an async function and swapped the `index.ts` import from `SessionManager` to `FileSessionManager`, but never updated the `createAgentSession({...})` call body — `customTools: allModeTools as ToolDefinition[]` cast the function itself (not its resolved array) to the tools type, and `sessionManager: SessionManager.inMemory()` referenced a name no longer imported.
- **Fix:** `customTools: (await allModeTools()) as ToolDefinition[]`; `sessionManager` now comes from `fileSessionManager.open(sessionId)` (a real `SessionManager` instance Pi's SDK expects).
- **Files modified:** sidecar/src/index.ts
- **Verification:** `npx tsc --noEmit` clean; `npm test` 15/15.
- **Committed in:** 60d76f2

**2. [Rule 3 - Blocking] `setModes()` would throw on an early `setModes` request now that session-build is deferred**
- **Found during:** Task 1 integration, reasoning through the new lazy-session-build architecture
- **Issue:** `index.ts` previously built one `AgentSession` eagerly at boot, before the stdio request loop started, so `modes.ts`'s `bindSession()` was always called before any `setModes` request could arrive. Deferring session construction to the first `prompt` (per sessionId) means a `setModes` request could now legitimately arrive with no session bound yet, and the old code threw in that case (`"modes.setModes() called before bindSession()"`).
- **Fix:** `setModes()` still updates the `active` mode `Set` unconditionally (this already happened before the throw), then returns early instead of throwing if no session is bound — the next session built reads the already-updated `active` Set via `composePrompt()`/`activeToolNames()`, so mode changes made before the first turn are not lost, just not live-reloaded onto a session that doesn't exist yet.
- **Files modified:** sidecar/src/modes.ts
- **Verification:** `harness.test.mjs`'s existing "setModes toggles activeToolNames deterministically" test (which calls `buildSession()` first, binding a session) still passes unchanged; reasoned through the unbound case manually since no test currently drives `setModes` before any `prompt` (out of this plan's stated task scope — flagging as a Known Stub-adjacent gap below).
- **Committed in:** 60d76f2

**3. [Rule 1 - Bug] Test-suite side effect: `buildSession()` writes into the real user AppData directory**
- **Found during:** authoring `harness.test.mjs`'s existing calls to `buildSession()` no longer being a no-op with respect to disk
- **Issue:** Once `sessionManager` became file-backed, every `buildSession()` call (including the two pre-existing ones in `harness.test.mjs`) resolves `FileSessionManager`'s default session directory, which is the real OS per-user app-data path (`%APPDATA%\sourcerer\assistant-sessions` on Windows) when `SOURCERER_SESSION_DIR` isn't set — polluting the real user's profile on every test run.
- **Fix:** Added `process.env.SOURCERER_SESSION_DIR ||= path.join(os.tmpdir(), "sourcerer-sidecar-harness-test-sessions")` at the top of `harness.test.mjs`, before the module under test is imported.
- **Files modified:** sidecar/test/harness.test.mjs
- **Verification:** `npm test` green; manually confirmed no new files under the real `%APPDATA%\sourcerer\` after a test run.
- **Committed in:** 0bad148

**4. [Rule 1 - Bug] Initial `tools.test.mjs` D-07 auth-header assertion false-positived on the module's own doc comments**
- **Found during:** first `npm test` run while authoring the new test file
- **Issue:** A naive `!/authorization/i.test(src)` check on the whole `databasise.ts` source matched the file's own `// D-07 (guest-mode): no Authorization header is ever set` comment, failing a test that should pass.
- **Fix:** Narrowed the regex to match only a `headers: { ... authorization ... }` object-literal shape, so it fails loudly only if an actual header assignment is added, not on prose discussing the guest-mode contract.
- **Files modified:** sidecar/test/tools.test.mjs
- **Verification:** `npm test` — this test now passes; manually re-verified it would still fail if a real `Authorization:` header line were inserted into the `headers:` object.
- **Committed in:** 0bad148

**5. [Rule 1 - Bug] Initial `sessions.test.mjs` round-trip tests failed: Pi's own `SessionManager` lazily withholds the file write**
- **Found during:** first `npm test` run — 3 of the 5 new session tests failed (listSessions didn't see the session; entry counts were 0; the "appended" file didn't exist on disk at all)
- **Issue:** Reading `session-manager.js` (the installed `@earendil-works/pi-coding-agent` package) revealed `_persist()` deliberately does **not** write anything to disk until at least one real assistant-role `message` entry exists in the session — appending only `custom_message` entries (my first test draft's approach) never triggers the on-disk flush at all, so nothing could round-trip.
- **Fix:** Rewrote the three affected tests to append a genuine minimal `{role:"user",...}` + `{role:"assistant",...}` turn pair (`appendTurn()` helper) matching the real `AssistantMessage`/`UserMessage` shape from `@earendil-works/pi-ai`'s types, which triggers Pi's real flush path.
- **Files modified:** sidecar/test/sessions.test.mjs
- **Verification:** `npm test` — all 5 session tests pass; this also more faithfully exercises D-09 (a real conversation turn, not a synthetic entry type the production code path never actually appends).
- **Committed in:** 0bad148

---

**Total deviations:** 5 auto-fixed (2 blocking/Rule 3, 3 bug/Rule 1)
**Impact on plan:** Deviations #1 and #2 were required for the sidecar to compile and boot at all — this plan could not have been completed without them, since they were the exact broken integration point this execution was spawned to fix. Deviations #3-5 were all discovered while authoring the two required test files and are scoped entirely to test correctness/hygiene; no production code outside `index.ts`/`modes.ts` was touched beyond what deviation #1/#2 required. No scope creep beyond `sidecar/**`.

## Known Gap (not a stub, flagging for a future plan)

`setModes()`'s unbound-session early-return path (deviation #2) has no direct automated test — `harness.test.mjs`'s existing `setModes` test always calls `buildSession()` first. This is exercised implicitly (the sidecar would emit a caught, non-fatal `error` event rather than throwing past `main()`'s try/catch either way, so there is no crash risk), but a future plan touching `modes.ts` or the stdio loop should consider adding a direct assertion that a `setModes` request arriving before any `prompt` neither throws nor is silently dropped.

## Issues Encountered

None beyond the deviations documented above. `npx tsc --noEmit` was clean on the first attempt after the `index.ts`/`modes.ts` fixes (both were pure interface fixes, no cascading type errors).

## User Setup Required

None new. Per 07-01's SUMMARY, a real `CEREBRAS_API_KEY` in `sidecar/.env` is still only needed for a live streamed turn (07-04 territory), not for this plan's offline verification. A running Databasise instance at `127.0.0.1:9621` is optional for manual smoke-testing research mode — its absence is exactly the D-06 honest-degrade path this plan's tests exercise, not a blocker.

## Next Phase Readiness

- The stdio protocol contract is unchanged (per the plan's acceptance criteria) — 07-03 (Rust relay) and 07-04 (frontend Channel types) can proceed against `protocol.ts` exactly as locked in 07-01, with no drift introduced by this plan.
- `index.ts`'s per-sessionId lazy `AgentSession` caching is a new architectural detail 07-03/07-04 should be aware of: the Rust relay must ensure every `prompt` request it forwards carries a stable, real `sessionId` (already required by `protocol.ts`'s `PromptRequest` type) since that id now directly selects/creates the JSONL conversation file and its in-memory `AgentSession`, not just a session's turn.
- No blockers carried forward. The one open item is the Known Gap above (untested `setModes`-before-any-session path) — low risk (caught, non-fatal either way) but worth a direct test if a future plan touches this seam.

## Self-Check: PASSED

All created/modified files verified present on disk; both task commits (60d76f2, 0bad148) verified present in git log.

---
*Phase: 07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a*
*Completed: 2026-07-08*
