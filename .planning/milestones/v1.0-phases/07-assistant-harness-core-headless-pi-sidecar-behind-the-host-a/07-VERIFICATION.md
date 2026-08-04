---
phase: 07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a
verified: 2026-07-08T21:00:00Z
status: passed
score: 18/18 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: "14/14 code-level (4 items deferred to human_verification)"
  gaps_closed:
    - "D-01: live streamed chat — human-run in 07-05, PASS (07-HUMAN-UAT.md Test 1)"
    - "D-03: Research-mode grounding against live Databasise — human-run in 07-05, PASS on zai-glm-4.7 (07-HUMAN-UAT.md Test 2)"
    - "D-06: live honest degrade with Databasise killed — human-run in 07-05, PASS after strengthening WIKI_UNAVAILABLE_MESSAGE (07-HUMAN-UAT.md Test 3)"
    - "D-09: history survives app restart — FAILED on first live attempt (GAP-07-D09), closed by gap-closure plan 07-06 (loadSession protocol + history event + load_session Rust command + panel sessionId persistence/replay), retested live on a rebuilt release exe — PASS (07-HUMAN-UAT.md Test 4)"
  gaps_remaining: []
  regressions: []
---

# Phase 07: Assistant Harness Core Verification Report

**Phase Goal:** A real, headless AI backend for the Dashboard Assistant — lean-Pi (`@earendil-works/pi-coding-agent`) embedded as a Node sidecar behind the `host.ai()` Tauri seam, with a lean baseline prompt, mode-gated tools (Notes/Research/Coding/Memory), Databasise REST tool projection, and file-backed sessions. Standalone: no dependency on the shell's Phases 2-5.

**Verified:** 2026-07-08
**Status:** passed
**Re-verification:** Yes — after gap closure (GAP-07-D09, plan 07-06) and live human UAT retest

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | D-10: Lean baseline prompt via `DefaultResourceLoader` | VERIFIED | `sidecar/src/index.ts` constructs `DefaultResourceLoader({noContextFiles:true, ...})`, passed into `createAgentSession` (unchanged since initial verification, re-confirmed on disk) |
| 2 | D-08: Sidecar reads provider/model/key from its own `sidecar/.env` | VERIFIED | `sidecar/.env.example`; `index.ts` calls `process.loadEnvFile()` guarded by `existsSync` (fix committed `8423441` during the 07-05 UAT gate, closing a false-green where unit tests set env vars directly); default model promoted to `zai-glm-4.7` (commit `06c2e2e`) after live D-03 testing showed `gpt-oss-120b` mis-selected tools |
| 3 | D-02/D-04: Mode registry + runtime `setModes()`, notes/coding/memory empty-tool seams, research has the 4 Databasise tools | VERIFIED | `sidecar/src/modes.ts` — unchanged, re-confirmed |
| 4 | Sidecar reads/writes NDJSON stdio protocol; now additionally supports `loadSession`/`history` | VERIFIED | `sidecar/src/protocol.ts:22` (`LoadSessionRequest`), `:72` (`HistoryEvent`), `:115` (`isSidecarRequest` loadSession branch) — additive to the original prompt/setModes/7-event contract, no existing shapes altered |
| 5 | D-03: Research's 4 tools auto-generated from live `/openapi.json` | VERIFIED | `sidecar/src/tools/databasise.ts` unchanged; live-confirmed in 07-05 UAT — `kb_query` fired against the 112-entity Deocracy corpus and the reply was grounded in corpus content (not generic knowledge) |
| 6 | D-06: Databasise unreachable -> honest "wiki unavailable" everywhere, never an unhandled throw | VERIFIED | All 4 layers unchanged + `WIKI_UNAVAILABLE_MESSAGE` strengthened from a soft hint to an explicit instruction (commit `158de39`) after the 07-05 gate found the disclosure was non-deterministic; live-retested PASS |
| 7 | D-07: Databasise calls are guest-mode/unauthenticated | VERIFIED | `databasise.ts` unchanged; sidecar test 17/17 (`no Authorization header is ever set`) |
| 8 | D-09: File-backed sessions — JSONL per conversation, listed on boot | VERIFIED | `sidecar/src/sessions.ts` `FileSessionManager` unchanged; `entriesToTurns()` added (`sessions.ts:121`) as the pure replay mapper consumed by the new loadSession path |
| 9 | D-09: **the panel actually reuses the persisted sessionId and renders prior turns on mount** (the gap closed by 07-06) | VERIFIED | `src/assistant/AssistantPanel.tsx:34` `SESSION_STORAGE_KEY = "sourcerer:assistant:sessionId"`; lazy `useRef` initializer reads/writes localStorage (no more `useRef(newSessionId())` minting a fresh id every mount); mount `useEffect` (`:82`) calls `host.loadSession(sessionId.current, onEvent)`; `history` event branch maps `turns` into rendered `ChatMessage[]`. Live-retested in 07-05/07-06: closed and relaunched the built exe, prior turns rendered on open |
| 10 | Four-layer load/replay path is wired end-to-end: panel -> host.loadSession() -> load_session Tauri command -> sidecar loadSession request -> history event -> panel render | VERIFIED | `src/host/ai.ts:126` `loadSession()` (Channel + invoke("load_session", ...), never-throw degrade mirroring `ai()`); `src-tauri/src/commands/ai.rs:77` `load_session` command (mirrors `host_ai`'s register/relay/TURN_TIMEOUT/send_degrade shape exactly); `src-tauri/src/lib.rs:14` registers `commands::ai::load_session` in `generate_handler!`; `sidecar/src/index.ts:202-218` `loadSession` branch -> `loadSessionHistory()` -> `writeEvent({type:"history",...})` then `done`, wrapped so failures degrade instead of throwing |
| 11 | If the sidecar/backend is unavailable, load degrades honestly (empty panel, no crash/hang) | VERIFIED | `AssistantPanel.test.tsx:241` "an empty-turns history event leaves the panel empty and usable, no crash"; Rust `load_session` reuses `send_degrade`/`TURN_TIMEOUT` — same honest-degrade contract as `host_ai` |
| 12 | D-01: Real `host_ai` Tauri command streams assistant events over a Channel | VERIFIED | `src-tauri/src/commands/ai.rs` unchanged core relay; live-confirmed streaming in 07-05 UAT ("hi" -> incremental "Hello! How can I assist you today?") |
| 13 | Rust spawns/owns the Node sidecar for app lifetime | VERIFIED | `src-tauri/src/lib.rs`/`sidecar.rs` unchanged, re-confirmed present |
| 14 | D-06 (Rust layer): dead/missing sidecar -> honest error+done, never hang/panic | VERIFIED | `cargo test` 4/4 pass including `degrade_events_yields_exactly_one_error_then_one_done`, `write_line_on_absent_child_returns_err_not_panic` |
| 15 | `set_modes` command reachable from webview | VERIFIED | `lib.rs` registers `host_ai`, `set_modes`, `load_session` — all three in `generate_handler!` |
| 16 | Frontend `host.ai()`/`host.setModes()`/`host.loadSession()` typed wrapper is the ONLY AI surface | VERIFIED | `src/host/ai.ts:145` `export const host = { ai, setModes, loadSession }`; `AssistantPanel.tsx` imports only from `../host/ai`, no direct `@tauri-apps/api/core` invoke calls |
| 17 | All four end-to-end truths (D-01, D-03, D-06, D-09) pass live, human-verified, with the app actually running against a real Cerebras key and a live Databasise instance | VERIFIED | `07-HUMAN-UAT.md`: status complete, 4/4 passed, 0 issues, 0 pending — D-09 initially failed as GAP-07-D09, closed by 07-06, retested to PASS on a rebuilt release exe |
| 18 | GAP-07-D09 closure did not regress the existing chat/mode/degrade behavior | VERIFIED | `AssistantPanel.test.tsx` still contains and passes the pre-existing streaming/CR-01/error-degrade/mode-toggle tests alongside the 4 new D-09 tests (8/8 in that file; 37/37 across the whole frontend vitest run) |

**Score:** 18/18 truths verified. Unlike the prior verification run (which correctly deferred D-01/D-03/D-06/D-09 to `human_verification` because no live session had been run yet), all four have now been executed live by the user per `07-HUMAN-UAT.md` and `07-05-SUMMARY.md`/`07-06-SUMMARY.md`, closing every previously-open item. No outstanding human verification items remain.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `sidecar/src/protocol.ts` | Pi embed protocol + now `loadSession`/`history` | VERIFIED | `LoadSessionRequest` (line 22), `HistoryEvent` (line 72), `isSidecarRequest` extended (line 115) — additive, no drift on existing shapes |
| `sidecar/src/sessions.ts` | File-backed sessions + `entriesToTurns()` | VERIFIED | `entriesToTurns` exported at line 121 |
| `sidecar/src/index.ts` | stdio loop + `loadSession` branch | VERIFIED | `loadSession` branch (line 202), `loadSessionHistory()` honest-degrade wrapper (line 214) |
| `src-tauri/src/commands/ai.rs` | `host_ai` + `set_modes` + `load_session` | VERIFIED | `load_session` command at line 77, mirrors `host_ai`'s relay/degrade shape |
| `src-tauri/src/lib.rs` | command registration | VERIFIED | `generate_handler!` includes `host_ai`, `set_modes`, `load_session` |
| `src/host/ai.ts` | typed `host.ai()`/`host.setModes()`/`host.loadSession()` | VERIFIED | `HistoryEvent` in `AssistantEvent` union (line 54), `loadSession()` (line 126), exported in `host` object (line 145) |
| `src/assistant/AssistantPanel.tsx` | persisted sessionId + mount reload + render | VERIFIED | `SESSION_STORAGE_KEY` (line 34), lazy-init reads/writes localStorage (lines 37-40), mount effect calls `host.loadSession` (line 82) |
| `src/assistant/AssistantPanel.test.tsx` | streamed/degrade/mode + 4 new D-09 tests | VERIFIED | `describe("AssistantPanel (D-09 restart-reload)"` (line 169) — reload-render, sessionId reuse, fresh-mint-and-persist, empty-turns-no-crash |
| `sidecar/test/sessions.test.mjs` | `entriesToTurns` round-trip unit test | VERIFIED | "entriesToTurns round-trips a session's prior turns in order (D-09 replay)" — passes as test 13/17 |
| `07-HUMAN-UAT.md` | live 4-truth UAT record | VERIFIED | status: complete, 4/4 passed, 0 issues; includes the GAP-07-D09 record (CLOSED) and live fixes applied during the gate |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/assistant/AssistantPanel.tsx` | `src/host/ai.ts` | `host.loadSession(sessionId.current, onEvent)` in a mount effect | WIRED | Confirmed `AssistantPanel.tsx:82` |
| `src/host/ai.ts` | `invoke("load_session")` + Channel | mirrors `ai()`'s pattern | WIRED | Confirmed `ai.ts:126` |
| `src-tauri/src/commands/ai.rs` | sidecar stdin/stdout (loadSession) | write `{"type":"loadSession",...}` line, relay id-matched history+done | WIRED | Confirmed `ai.rs:77` onward |
| `sidecar/src/index.ts` | `FileSessionManager.open` + `entriesToTurns` | replay mapper feeding `history` event | WIRED | Confirmed `index.ts:202-218` |
| `src-tauri/src/lib.rs` | `commands::ai::load_session` | `generate_handler!` registration | WIRED | Confirmed `lib.rs:14` |
| (carried over, unchanged from prior verification) all 10 links for prompt/setModes/streaming spine | — | — | WIRED | Re-confirmed present, no regressions found in grep re-scan |

### Data-Flow Trace (Level 4)

- History replay data flows from real on-disk JSONL (`FileSessionManager.open` -> `SessionManager.getEntries()`) through the pure `entriesToTurns()` mapper into the `history` event turns — not a hardcoded/static array. Confirmed by the sidecar unit test (order-preserving round-trip) AND by the live UAT retest (actual prior conversation turns rendered after a real app restart, not a canned fixture).
- The empty-turns case (fresh session / no history yet) is the only static value (`turns: []`), which is the correct and intentional behavior, not a stub bug.
- Status: FLOWING.

### Behavioral Spot-Checks / Automated Test Runs (independently re-run by this verifier)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Sidecar unit tests (harness/tools/sessions/loadSession replay) | `cd sidecar && npm test` | 17/17 pass | PASS |
| Frontend unit tests (Vitest, whole suite) | `npx vitest run` | 6 files, 37/37 tests pass | PASS |
| Rust unit tests | `cd src-tauri && cargo test` | 4/4 pass, build clean (incl. new `load_session` command compiling) | PASS |
| Live human UAT (D-01/D-03/D-06/D-09) | manual, recorded in `07-HUMAN-UAT.md` | 4/4 pass, 0 issues, 0 pending | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention exists in this project; verification relies on the sidecar/frontend/Rust automated suites plus the recorded live human UAT, all independently re-run/re-read by this verifier. SKIPPED — no probe scripts declared or discovered (unchanged from prior verification).

### Requirements Coverage

Phase 07 tracks decisions D-01..D-10 (no `ASST-HARNESS-*` IDs minted, per CONTEXT.md). All ten:

| Decision | Description | Status | Evidence |
|----------|-------------|--------|----------|
| D-01 | host_ai streamed chat backend, minimal panel | SATISFIED — live-verified | 07-HUMAN-UAT.md Test 1 PASS |
| D-02 | Mode registry + runtime toggle plumbing | SATISFIED | `modes.ts` (unchanged) |
| D-03 | Research mode live Databasise tools | SATISFIED — live-verified | 07-HUMAN-UAT.md Test 2 PASS (on zai-glm-4.7) |
| D-04 | Notes/Coding/Memory deferred, empty seam | SATISFIED | `modes.ts:25-39` (unchanged) |
| D-05 | mnemopi deferred (informational) | N/A | — |
| D-06 | Assume-running + honest degrade | SATISFIED — live-verified | 07-HUMAN-UAT.md Test 3 PASS (after strengthening the disclosure message) |
| D-07 | Guest-mode/unauthenticated | SATISFIED | `databasise.ts` (unchanged), sidecar test 17 |
| D-08 | Sidecar-owned `.env` config | SATISFIED | `.env` load fix (`8423441`) confirmed live during the gate |
| D-09 | File-backed sessions + restart-survives-history | SATISFIED — live-verified (gap closed) | GAP-07-D09 -> plan 07-06 -> 07-HUMAN-UAT.md Test 4 PASS |
| D-10 | Lean baseline prompt via DefaultResourceLoader | SATISFIED | `index.ts` (unchanged) |

No orphaned requirements.

### Anti-Patterns Found

None. Re-ran grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` across all files modified by plan 07-06 (`sidecar/src/protocol.ts`, `sidecar/src/sessions.ts`, `sidecar/src/index.ts`, `src-tauri/src/commands/ai.rs`, `src-tauri/src/lib.rs`, `src/host/ai.ts`, `src/assistant/AssistantPanel.tsx`) — zero matches.

**Known deferred warnings (unchanged from prior verification, still open by explicit user choice, non-blocking):**

| ID | File | Issue | Severity |
|----|------|-------|----------|
| WR-03 | `src-tauri/src/commands/ai.rs` | `fresh_request_id()` uses `SystemTime` nanos, not collision-free under concurrent calls | Warning — deferred |
| WR-04 | `sidecar/src/tools/databasise.ts` vs `ai.rs` | Sidecar fetch timeout (240s) exceeds Rust turn timeout (120s) | Warning — deferred |
| WR-05 | `src-tauri/src/sidecar.rs` + `lib.rs` | Node child process never killed on app shutdown | Warning — deferred |
| WR-06 | `src/host/ai.ts` + `AssistantPanel.tsx` | `host.setModes()` throws past its boundary when sidecar is down | Warning — deferred |
| WR-07 | `sidecar/src/tools/databasise.ts` + `modes.ts` | Boot-time Databasise outage permanently degrades research tools for process lifetime | Warning — deferred |

These are the same pre-existing, user-accepted technical-debt items carried over unchanged; none of them touch the D-09 gap-closure code paths and none block phase goal achievement.

### Human Verification Required

None. All four items previously listed as `human_verification` in the prior verification run (D-01, D-03, D-06, D-09) have since been executed live by the user and recorded with PASS results in `07-HUMAN-UAT.md` and cross-confirmed in `07-05-SUMMARY.md`/`07-06-SUMMARY.md`. No new human-only checks were introduced by the D-09 gap-closure work — its own acceptance criteria are fully covered by the automated sidecar/Rust/Vitest suites plus the completed live retest already on record.

### Gaps Summary

No gaps. The single gap from the prior verification cycle (GAP-07-D09 — chat history did not reload/render on app restart) was root-caused precisely as diagnosed (frontend + protocol, not the file-backed persistence engine), closed by plan 07-06 across all four layers (protocol -> sidecar -> Rust -> panel), and retested live on a rebuilt release executable with a PASS result. All three automated suites (sidecar 17/17, frontend 37/37, Rust 4/4) were independently re-run by this verifier, not trusted from SUMMARY.md narration, and all pass. The four previously-open end-to-end truths (D-01, D-03, D-06, D-09) now all carry live human-verified PASS results in `07-HUMAN-UAT.md`. Phase 07's goal — a real, headless AI backend for the Dashboard Assistant with mode-gated tools, Databasise projection, and file-backed sessions that actually survive an app restart — is achieved and observably true in the running application, not just in code.

---

_Verified: 2026-07-08_
_Verifier: Claude (gsd-verifier)_
