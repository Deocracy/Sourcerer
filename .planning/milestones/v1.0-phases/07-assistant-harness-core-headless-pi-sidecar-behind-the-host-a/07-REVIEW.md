---
phase: 07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a
reviewed: 2026-07-07T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - sidecar/src/index.ts
  - sidecar/src/modes.ts
  - sidecar/src/protocol.ts
  - sidecar/src/tools/databasise.ts
  - sidecar/src/sessions.ts
  - sidecar/test/harness.test.mjs
  - sidecar/test/tools.test.mjs
  - sidecar/test/sessions.test.mjs
  - src-tauri/src/sidecar.rs
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/commands/ai.rs
  - src-tauri/src/lib.rs
  - src/host/ai.ts
  - src/assistant/AssistantPanel.tsx
  - src/assistant/AssistantPanel.test.tsx
findings:
  critical: 1
  warning: 8
  info: 4
  total: 13
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-07-07
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

The assistant harness spine (webview `host.ai()` → Rust relay → Node Pi sidecar → Rust → webview) is well-structured and the D-06 honest-degrade contract is threaded carefully through most layers. The stdio protocol is defensively parsed on both ends, path-traversal is guarded, and the degrade/timeout paths in `commands/ai.rs` are clean and unit-tested.

However, adversarial tracing surfaced one **BLOCKER**: the session-ID generator the panel uses (`nanoid()`) produces IDs that the sidecar's own `SESSION_ID_PATTERN` validator rejects ~6% of the time (empirically measured: 1223/20000), and because the failed session promise is cached, this permanently breaks the assistant for those launches. Several WARNING-level issues undermine the mode contract (the per-prompt `modes` field is silently ignored, and the sidecar's default mode desyncs from the UI), the degrade contract (`host.setModes()` throws past its boundary when the sidecar is down), and process hygiene (the Node child is never killed on shutdown; a boot-time Databasise outage permanently degrades research tools for the process lifetime).

## Critical Issues

### CR-01: `nanoid()` session IDs are rejected by the sidecar validator ~6% of the time, permanently breaking the assistant

**File:** `src/assistant/AssistantPanel.tsx:32` (generation) + `sidecar/src/sessions.ts:30-34` (validation) + `sidecar/src/index.ts:158-165` (rejection caching)
**Issue:** `AssistantPanel` seeds `const sessionId = useRef(nanoid())`. Default `nanoid()` draws 21 chars from the URL-safe alphabet `A-Za-z0-9_-`, so an ID can legally start or end with `_` or `-`. But `SESSION_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/` requires the first **and** last character to be alphanumeric. Measured rejection rate: **6.12% (1223/20000)**.

When a rejected ID is used, `buildSession()` → `fileSessionManager.open()` throws `Invalid sessionId`, the rejected promise is cached in `sessionsById` (`index.ts:161-162`), and **every** subsequent turn for that browser session returns the same cached rejection. The panel renders `assistant unavailable: Invalid sessionId ...` for the entire session — the core D-01 feature is dead for ~6% of app launches, with a misleading message, until the page is reloaded and a new nanoid happens to be valid.

**Fix:** Generate IDs from an alphabet the validator accepts, e.g.:
```ts
import { customAlphabet } from "nanoid";
const newSessionId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 21);
const sessionId = useRef(newSessionId());
```
Alternatively (defense in depth) relax the validator to permit leading/trailing `_`/`-` while still blocking separators and `..`, and stop caching rejected build promises (see WR-08) so a transient failure can recover.

## Warnings

### WR-01: `PromptRequest.modes` is silently ignored by the sidecar

**File:** `sidecar/src/index.ts:167-174`
**Issue:** `handleRequest` for `type: "prompt"` calls `runPrompt(session, req)`, and `runPrompt` (`index.ts:137`) only reads `req.id` and `req.message`. The `modes` field carried on every `PromptRequest` (protocol.ts:13, populated by the panel at `AssistantPanel.tsx:93` as `modes: researchMode ? [RESEARCH_MODE] : []`) is never applied. Per-turn mode selection is dead protocol surface; modes only ever change via the separate `setModes` path. A future maintainer will reasonably assume per-prompt modes work and ship a bug.
**Fix:** Either apply `req.modes` before the turn (`await setModes(req.modes)` inside the prompt branch) or remove `modes` from `PromptRequest` and the panel's `host.ai()` call so the contract reflects reality. Add a test asserting per-prompt modes take effect (none currently does).

### WR-02: Default mode desync — sidecar boots with `research` active, panel shows it OFF

**File:** `sidecar/src/modes.ts:46` vs `src/assistant/AssistantPanel.tsx:31`
**Issue:** `modes.ts` seeds `const active = new Set(["research"])`, so research tools + prompt fragment are active from the first turn. The panel initializes `researchMode = false` and does **not** call `setModes` on mount. Until the user toggles, the assistant actually has research enabled while the UI claims it is off — a real state divergence affecting which tools/prompt the very first message runs against.
**Fix:** Make the two agree: either seed `active` to `[]` (matching the panel default) or have the panel call `host.setModes([])` on mount, or drive the initial mode from a single shared source.

### WR-03: `fresh_request_id()` can collide under concurrent `host_ai` calls and cross-wire event streams

**File:** `src-tauri/src/commands/ai.rs:94-101`
**Issue:** IDs are `turn-{SystemTime nanos}`. `SystemTime` is not monotonic (can move backward on NTP adjust) and, on Windows especially, has coarse resolution. Two concurrent `host_ai` invocations (the seam is generic — future applets, not just the single panel) can produce the same id. `register()` (`sidecar.rs:107-113`) then overwrites the first turn's sender; the first turn's `rx` receives `Ok(None)` and degrades, and both turns' sidecar events (tagged with the shared id) route to the second listener. Event streams get cross-wired.
**Fix:** Use a collision-free id — a process-wide `AtomicU64` counter, or `uuid`, optionally combined with the timestamp: `format!("turn-{}", COUNTER.fetch_add(1, Ordering::Relaxed))`.

### WR-04: Sidecar fetch timeout (240s) exceeds the Rust turn timeout (120s), wedging subsequent turns

**File:** `sidecar/src/tools/databasise.ts:23` vs `src-tauri/src/commands/ai.rs:19`
**Issue:** `FETCH_TIMEOUT_MS = 240_000` but `TURN_TIMEOUT = 120s`. If a Databasise call hangs, the Rust side degrades and unregisters at 120s while the sidecar stays blocked on the fetch for up to another 120s. Because the sidecar's request loop is strictly sequential (`for await (const req of readRequests())` awaits `handleRequest` fully — `index.ts:182`), it is **not reading stdin** during that window, so the next user turn queues behind the stuck one and is likely to time out too. One slow dependency call can wedge the assistant well past the point the user was told it degraded.
**Fix:** Set the sidecar fetch timeout below the Rust turn timeout (e.g. 90s < 120s) so the sidecar always emits `done` before Rust gives up, and consider decoupling stdin reads from turn execution so a stuck turn cannot block queued requests.

### WR-05: Node sidecar child is never killed — orphaned process on app shutdown

**File:** `src-tauri/src/sidecar.rs:23-30, 63-67` + `src-tauri/src/lib.rs:19`
**Issue:** The comment claims the child is held "so the child is not dropped (and killed)." Rust's `std::process::Child` has **no** `Drop` that kills the process — dropping the handle leaves the OS process running. There is no explicit `kill()` on app exit anywhere. Every app launch spawns a `node` sidecar that is orphaned when the app closes, accumulating stray Node processes across restarts (particularly visible on Windows).
**Fix:** Kill the child on shutdown — hook Tauri's `RunEvent::Exit`/`ExitRequested` (or implement `Drop for SidecarProcess` that calls `child.kill()`), and correct the misleading comment.

### WR-06: `host.setModes()` throws past its boundary when the sidecar is down (D-06 gap)

**File:** `src/host/ai.ts:108-110` + `src-tauri/src/commands/ai.rs:72-75` + `src/assistant/AssistantPanel.tsx:99-103`
**Issue:** Unlike `ai()`, which catches `invoke()` rejection and degrades to an `error`+`done` pair, `setModes()` returns `invoke("set_modes", ...)` bare. When the sidecar is absent, `set_modes_line` returns `Err` (`sidecar.rs:96`), the command returns `Err`, `invoke` rejects, and `toggleResearch`'s `await host.setModes(...)` (fired via `() => void toggleResearch()`) rejects with no catch → unhandled promise rejection. The mode toggle also leaves `researchMode` flipped in the UI even though the backend never accepted it. This is the same dead-dependency-throws-past-boundary shape D-06 forbids.
**Fix:** Give `setModes()` the same swallow-and-degrade treatment as `ai()` (catch and resolve, optionally returning a status), or wrap `toggleResearch` in try/catch and revert the toggle on failure.

### WR-07: Boot-time Databasise outage permanently degrades research tools for the process lifetime

**File:** `sidecar/src/tools/databasise.ts:55-66, 157-172` + `sidecar/src/modes.ts:102-121`
**Issue:** If `/openapi.json` is unreachable at generation time, `allDatabasiseTools()` returns `unavailableTool(...)` stubs whose `execute()` **always** returns `WIKI_UNAVAILABLE_MESSAGE` with no retry. `allModeTools()` then memoizes that result in `cachedModeTools` for the whole process. So a Databasise instance that is merely late to start (fully expected under D-06 "assume-running, not managed") leaves research tools as permanent dead stubs even after Databasise comes up — the honest-degrade becomes per-process, contradicting the module's own "a down wiki degrades a chat turn, it never crashes one" intent (databasise.ts:9-10).
**Fix:** Have `unavailableTool.execute()` attempt a live per-call fetch (mirroring `toolFromSpec`) so recovery is possible, or invalidate `cachedModeTools` when the boot spec fetch failed so a later session rebuild can pick up a now-running Databasise.

### WR-08: `getOrCreateSession` caches rejected build promises — no recovery from a transient failure

**File:** `sidecar/src/index.ts:158-165`
**Issue:** `sessionsById.set(sessionId, sessionPromise)` stores the promise **before** it resolves, and it is never removed on rejection. Any `buildSession` failure (the CR-01 invalid-id case, a bad `PI_PROVIDER`/`PI_MODEL`, a transient FS error) is cached, so every future turn for that sessionId replays the same rejection with no retry.
**Fix:** On rejection, delete the entry so the next request rebuilds:
```ts
sessionPromise = buildSession(sessionId).then(({ session }) => session);
sessionPromise.catch(() => sessionsById.delete(sessionId));
sessionsById.set(sessionId, sessionPromise);
```

## Info

### IN-01: Blocking pipe write inside async `host_ai`

**File:** `src-tauri/src/commands/ai.rs:41` + `src-tauri/src/sidecar.rs:84-98`
**Issue:** `write_line` performs synchronous blocking `writeln!` + `flush` on the child's stdin pipe while holding the `stdin` mutex, called from the async `host_ai`. If the sidecar stops reading stdin (e.g. mid a long sequential turn — see WR-04) and the OS pipe buffer fills, this blocks a tokio executor thread and serializes other `host_ai`/`set_modes` callers on the mutex. Small prompts won't fill a 64KB pipe, so impact is low today.
**Fix:** Offload the write via `tokio::task::spawn_blocking`, or use an async stdin writer.

### IN-02: Poisoned `listeners` mutex silently halts all event dispatch

**File:** `src-tauri/src/sidecar.rs:145-149`
**Issue:** `pump_stdout` uses `if let Ok(map) = listeners.lock()`. If any holder panics while holding the lock, it becomes poisoned, every subsequent `lock()` returns `Err`, dispatch silently stops, and all in-flight turns hang until the 120s timeout with no diagnostic.
**Fix:** Recover the poisoned guard (`.lock().unwrap_or_else(|e| e.into_inner())`) or log on the `Err` branch so the failure is observable.

### IN-03: `boundSession` single module slot is incorrect for multi-session (D-09)

**File:** `sidecar/src/modes.ts:73-99` + `sidecar/src/index.ts:95-98`
**Issue:** `bindSession` overwrites one module-level slot on every `buildSession`, so `setModes` only drives `reload()`/`setActiveToolsByName()` on the most-recently-built session; other cached sessions keep stale active tools until they independently reload. The code comments acknowledge this holds only because one prompt is in flight at a time — a latent hazard as D-09 multi-session usage grows.
**Fix:** Track per-session bindings (e.g. a map keyed by sessionId) and drive mode changes across all live sessions, or document the single-session constraint as enforced.

### IN-04: `TURN_TIMEOUT` is a per-event gap, not a per-turn budget

**File:** `src-tauri/src/commands/ai.rs:18-19, 46-47`
**Issue:** The comment calls it a "bounded per-turn wait," but `timeout` wraps each `rx.recv()`, so it bounds the gap between events, not total turn duration. A turn streaming a delta every <120s can run unbounded. Not a bug, but the comment misleads about the DoS guarantee (T-07-12).
**Fix:** Clarify the comment, or add a separate overall-turn deadline if a hard per-turn cap is intended.

---

_Reviewed: 2026-07-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
