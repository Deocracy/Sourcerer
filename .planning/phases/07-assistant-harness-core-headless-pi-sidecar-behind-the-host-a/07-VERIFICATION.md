---
phase: 07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a
verified: 2026-07-07T19:00:00Z
status: human_needed
score: 14/14 code-level must-haves verified
overrides_applied: 0
human_verification:
  - test: "D-01: With the app running (real Cerebras key in sidecar/.env, `node`/npm deps installed), type a message in the assistant panel and confirm a real Pi reply streams in token by token in the rail."
    expected: "Assistant message box fills incrementally with text_delta content and settles to done status."
    why_human: "Requires a live Cerebras API key, a running app instance, and observing real-time streaming behavior — not verifiable from static code."
  - test: "D-03: With Databasise running against the populated 112-entity rag_storage (WORKING_DIR=./rag_storage), toggle Research mode and ask a corpus-grounded question."
    expected: "A wiki_resolve/kb_query tool call fires (visible as a 'searching …' notice) and the reply is grounded in/cites the user's Databasise corpus rather than generic knowledge."
    why_human: "Requires a live external Databasise server process and judging whether the reply content is actually grounded — not statically verifiable."
  - test: "D-06: Kill the Databasise process mid-session and send another Research-mode message."
    expected: "The tool call returns the honest 'wiki unavailable' text, the assistant continues answering from general knowledge, and the app does not crash or hang."
    why_human: "Requires live process manipulation timing and observing runtime behavior."
  - test: "D-09: Restart the whole app (close and relaunch) after a conversation."
    expected: "The prior session's turns reload into the panel from the file-backed JSONL store instead of starting blank."
    why_human: "Requires an actual app restart and observing persisted UI state — not verifiable from source alone."
---

# Phase 07: Assistant Harness Core Verification Report

**Phase Goal:** A real, headless AI backend for the Dashboard Assistant — lean-Pi (`@earendil-works/pi-coding-agent`) embedded as a Node sidecar behind the `host.ai()` Tauri seam, with a lean baseline prompt, mode-gated tools (Notes/Research/Coding/Memory), Databasise REST tool projection, and file-backed sessions. Standalone: no dependency on the shell's Phases 2-5.

**Verified:** 2026-07-07
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (code-level, verified against actual source)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | D-10: Lean baseline prompt (~130 tok target) composed via `DefaultResourceLoader` with `noContextFiles:true`, not bare `createAgentSession` options | VERIFIED | `sidecar/src/index.ts:60-73` constructs `DefaultResourceLoader({ noContextFiles: true, noExtensions/noSkills/noPromptTemplates/noThemes: true, systemPromptOverride: () => composePrompt() })`, calls `resourceLoader.reload()`, then passes it (not raw options) into `createAgentSession` |
| 2 | D-08: Sidecar reads provider/model/key from its own `sidecar/.env`, defaults to `cerebras/gpt-oss-120b` | VERIFIED | `index.ts:29-30` (`PI_PROVIDER`/`PI_MODEL` env defaults `"cerebras"`/`"gpt-oss-120b"`); `sidecar/.env.example` documents `CEREBRAS_API_KEY`, `PI_PROVIDER=cerebras`, `PI_MODEL=gpt-oss-120b`; `.gitignore` excludes `.env` |
| 3 | D-02: Mode registry (plain object + active-key `Set`) + runtime `setModes()` reloads session before narrowing tools | VERIFIED | `sidecar/src/modes.ts` — `MODES` record + `active: Set<string>`; `setModes()` (lines 98-106) calls `boundSession.reload()` THEN `setActiveToolsByName()` in that order, matching the spike-003 ordering constraint |
| 4 | D-04: notes/coding/memory registered with empty tool lists (real seam, not omitted keys); research is the only mode with tool names | VERIFIED | `modes.ts:25-39` — all three keys present in `MODES` with `tools: []`; `research.tools` = the 4 Databasise tool names |
| 5 | Sidecar reads NDJSON on stdin, emits NDJSON on stdout per protocol | VERIFIED | `sidecar/src/protocol.ts` — `readRequests()` uses `readline` line iteration + defensive `JSON.parse`/type-guard; `writeEvent()` writes `JSON.stringify(evt) + "\n"` |
| 6 | D-03: Research's 4 tools (`wiki_resolve`, `wiki_unresolved`, `wiki_unplaced`, `kb_query`) auto-generated from live `/openapi.json`, registered as Pi `customTools` | VERIFIED | `sidecar/src/tools/databasise.ts:42-47` (`OP_SPECS`), `toolFromSpec()` builds a `defineTool` per spec from the fetched spec's `paths`/`components.schemas`; `modes.ts:122-127` (`allModeTools`) feeds `allDatabasiseTools()` into `index.ts:87` `customTools:` |
| 7 | D-06: Databasise unreachable → honest "wiki unavailable" everywhere, never an unhandled throw; plain chat continues | VERIFIED at all 4 layers — spec-fetch fallback (`databasise.ts:157-171` `unavailableTool`), per-call fetch failure (`databasise.ts:141-145` catch → `WIKI_UNAVAILABLE_MESSAGE`), sidecar turn-level (`index.ts:137-147` `runPrompt` catches and emits `error`+`done`), Rust relay (`ai.rs:41-65` `send_degrade` on write failure / channel close / timeout), frontend (`AssistantPanel.tsx:78-84` renders inline "assistant unavailable" text, composer stays enabled) |
| 8 | D-07: Databasise calls are guest-mode/unauthenticated | VERIFIED | `databasise.ts:126-133` fetch sets only `content-type` header, no `Authorization`; sidecar test 16 explicitly asserts "no Authorization header is ever set" |
| 9 | D-09: File-backed sessions — JSONL per conversation, dir listed on boot, active session's turns reload, survives restart | VERIFIED | `sidecar/src/sessions.ts` — `FileSessionManager` wraps Pi's own `SessionManager` (JSONL, append-only), `listSessions()`/`open()` implement list-on-boot + create-or-resume; `index.ts:55-58` wires it as `sessionManager:` into `createAgentSession`, replacing `SessionManager.inMemory()` |
| 10 | D-01: Real `host_ai` Tauri command streams assistant events over a Channel — the real backend behind `host.ai()` | VERIFIED | `src-tauri/src/commands/ai.rs:21-70` — writes a `prompt` line to sidecar stdin, relays every event tagged with the request id to `on_event: Channel<Value>` until `done` |
| 11 | On startup Rust spawns/owns the Node sidecar, holds stdin/stdout, manages state for app lifetime | VERIFIED | `src-tauri/src/lib.rs:15-21` (`app.manage(SidecarProcess::spawn())` in `.setup()`); `sidecar.rs:36-79` (`SidecarProcess::spawn` spawns `node --experimental-strip-types src/index.ts`, holds `Child`/`ChildStdin`, pumps stdout/stderr on background threads) |
| 12 | D-06 (Rust layer): dead/missing sidecar → honest `error`+`done` pair, never hang/panic | VERIFIED | `ai.rs:41-65` covers write failure, channel-closed (`Ok(None)`), and `TURN_TIMEOUT` (120s) paths, all routing to `send_degrade`; unit-tested (`degrade_events_yields_exactly_one_error_then_one_done`, `write_line_on_absent_child_returns_err_not_panic`) |
| 13 | `set_modes` command forwards mode toggle to sidecar, reachable from webview | VERIFIED | `ai.rs:72-75` `set_modes` command; `lib.rs:11-14` registers both `host_ai` and `set_modes` in `generate_handler!` |
| 14 | Frontend `host.ai()`/`host.setModes()` typed wrapper is the ONLY AI surface; panel renders streamed reply + error degrade + mode toggle | VERIFIED | `src/host/ai.ts` — sole `invoke()` call site for AI, wraps `Channel`; `src/assistant/AssistantPanel.tsx` imports only from `../host/ai`, never `@tauri-apps/api/core` directly; mounted in `src/app/AppShell.tsx:28`; renders inline error text (`errorText` style) on `error` events, composer never disabled by an error |

**Score:** 14/14 code-level truths verified. The 4 live end-to-end truths from plan 07-05 (D-01 streamed chat with a real key, D-03 Research grounding against a live Databasise, D-06 live degrade, D-09 restart-survives-history) are inherently human-only and are listed under Human Verification Required, not scored as gaps (per verification task scope).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `sidecar/src/index.ts` | Pi embed + stdio loop + streaming fan-out | VERIFIED | Contains `DefaultResourceLoader`, wires `customTools`, `sessionManager`, `setActiveToolsByName` |
| `sidecar/src/modes.ts` | Mode registry, composePrompt, activeToolNames, setModes | VERIFIED | Contains `setActiveToolsByName`, all 4 modes present |
| `sidecar/src/protocol.ts` | Typed request/event shapes | VERIFIED | Full discriminated unions both directions |
| `sidecar/.env.example` | Config template | VERIFIED | Contains `cerebras/gpt-oss-120b` equivalent (`PI_PROVIDER=cerebras`, `PI_MODEL=gpt-oss-120b`) |
| `sidecar/src/tools/databasise.ts` | openapi→tool generator + whitelist + degrade wrapper | VERIFIED | Contains `openapi.json` fetch, 4-tool whitelist, honest-degrade catch |
| `sidecar/src/sessions.ts` | File-backed SessionManager | VERIFIED | Contains `jsonl`-backing via Pi's `SessionManager`, list/open/create |
| `src-tauri/src/sidecar.rs` | Node process spawn/own + stdio pump | VERIFIED | Contains `Command`, stdin writer, stdout pump thread, listener registry |
| `src-tauri/src/commands/ai.rs` | `host_ai` + `set_modes` commands with Channel streaming | VERIFIED | Contains `Channel<Value>`, degrade paths, unit tests |
| `src-tauri/src/lib.rs` | `invoke_handler` registration + sidecar spawn in setup | VERIFIED | `generate_handler![commands::ai::host_ai, commands::ai::set_modes]`, `app.manage(SidecarProcess::spawn())` |
| `src/host/ai.ts` | Typed `host.ai()`/`host.setModes()` over invoke+Channel | VERIFIED | Contains `Channel`, sole `invoke()` call site for AI |
| `src/assistant/AssistantPanel.tsx` | Composer + streamed list + mode toggle | VERIFIED | Contains `host.ai`/`host.setModes` calls, error rendering, mode toggle button |
| `src/assistant/AssistantPanel.test.tsx` | mockIPC streamed-reply + degrade test | VERIFIED | 4 test cases: streaming, CR-01 sessionId validity, error degrade, mode toggle |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `sidecar/src/index.ts` | `DefaultResourceLoader` | `resourceLoader` passed to `createAgentSession`; `systemPromptOverride` for reload() | WIRED | Confirmed lines 60-90 |
| `sidecar/src/index.ts` | `sidecar/src/modes.ts` | `customTools` from mode defs; `setActiveToolsByName(activeToolNames())` | WIRED | Confirmed lines 87, 95 |
| `sidecar/src/index.ts` | `sidecar/src/sessions.ts` | `sessionManager` option set to file-backed variant | WIRED | Confirmed line 88 |
| `sidecar/src/tools/databasise.ts` | `http://127.0.0.1:9621` | fetch `/openapi.json` + per-op REST calls | WIRED | Confirmed lines 17, 124, 160 |
| `sidecar/src/modes.ts` | `sidecar/src/tools/databasise.ts` | research tool names resolved via `allDatabasiseTools()` | WIRED | Confirmed line 8, 124 |
| webview `invoke("host_ai")` | `src-tauri/src/commands/ai.rs` | `generate_handler!` in lib.rs | WIRED | Confirmed lib.rs:11-14 |
| `src-tauri/src/commands/ai.rs` | sidecar stdin/stdout | write prompt line, relay id-matched events to Channel | WIRED | Confirmed ai.rs:39-66 |
| `src/assistant/AssistantPanel.tsx` | `src/host/ai.ts` | `host.ai(request, onEvent)` | WIRED | Confirmed AssistantPanel.tsx:100-103 |
| `src/host/ai.ts` | `invoke('host_ai')` + Channel | `@tauri-apps/api/core` | WIRED | Confirmed ai.ts:1, 84-104 |
| `src/app/AppShell.tsx` | `AssistantPanel` | mounted in shell body | WIRED | Confirmed AppShell.tsx:4, 28 |

### Data-Flow Trace (Level 4)

Not applicable in the traditional DB-query sense (no persisted app database this phase), but the equivalent trace — chat reply text flowing from a real backend rather than a static/mock value — was confirmed:
- `text_delta` deltas originate from Pi's own `AgentSessionEvent` stream (`handleAgentEvent`, `index.ts:105-130`), not a hardcoded string.
- Databasise tool results come from a live `fetch()` response body (`databasise.ts:126-140`), truncated but not fabricated; only the unreachable-fallback path returns a static string, and that path is explicitly the D-06 contract, not a stub bug.
- Session history reload flows through Pi's own `SessionManager.open`/`buildSessionContext` (delegated, not reimplemented) — `sessions.ts:95-107`.

Status: FLOWING (with an explicit, intentional STATIC fallback only on the honest-degrade path, which is correct per D-06).

### Behavioral Spot-Checks / Automated Test Runs

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Sidecar unit tests (harness/tools/sessions) | `npm test` in `sidecar/` | 16/16 pass | PASS |
| Frontend unit tests (Vitest) | `npx vitest run` | 5 files, 24/24 tests pass | PASS |
| Rust unit tests | `cargo test` in `src-tauri/` | 4/4 pass (`sidecar::tests` x3, `commands::ai::tests` x1) | PASS |
| Fix commits present in history | `git show ef5ad1f / 6040401 / 186b18c` | All 3 commits exist with matching diffs (CR-01, WR-01, WR-02) | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention or explicit probe scripts are used by this project/phase; verification relied on the sidecar/frontend/Rust test suites above, run directly by the verifier (not sourced from SUMMARY.md claims). SKIPPED — no probe scripts declared or discovered.

### Requirements Coverage

Phase 07 has no minted `ASST-HARNESS-*` requirement IDs; it is tracked via CONTEXT.md decisions D-01..D-10 per the phase's own framing. All ten decisions were traced above:

| Decision | Description | Status | Evidence |
|----------|-------------|--------|----------|
| D-01 | host_ai streamed chat backend, minimal panel | SATISFIED (code) / human_needed (live E2E) | Rust command + frontend panel wired; live streaming needs a real key/app run |
| D-02 | Mode registry + runtime toggle plumbing | SATISFIED | `modes.ts` |
| D-03 | Research mode live Databasise tools | SATISFIED (code) / human_needed (grounding quality) | `tools/databasise.ts` |
| D-04 | Notes/Coding/Memory deferred, empty seam | SATISFIED | `modes.ts:25-39` |
| D-05 | mnemopi deferred (informational) | N/A — informational, no code required | — |
| D-06 | Assume-running + honest degrade | SATISFIED (all 4 layers) | see truth #7 |
| D-07 | Guest-mode/unauthenticated | SATISFIED | `databasise.ts` |
| D-08 | Sidecar-owned `.env` config | SATISFIED | `index.ts`, `.env.example` |
| D-09 | File-backed sessions | SATISFIED (code) / human_needed (restart persistence) | `sessions.ts` |
| D-10 | Lean baseline prompt via DefaultResourceLoader | SATISFIED | `index.ts:60-73` |

No orphaned requirements — CONTEXT.md explicitly states no `ASST-HARNESS-*` IDs were minted for this phase.

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|not available|coming soon` across all phase-modified files (`sidecar/src/**`, `src-tauri/src/sidecar.rs`, `src-tauri/src/commands/ai.rs`, `src-tauri/src/lib.rs`, `src/host/ai.ts`, `src/assistant/AssistantPanel.tsx`) returned zero matches.

**Known deferred warnings (by user choice, per 07-REVIEW.md — not phase-blocking):**

| ID | File | Issue | Severity |
|----|------|-------|----------|
| WR-03 | `src-tauri/src/commands/ai.rs:94-101` | `fresh_request_id()` uses `SystemTime` nanos, not collision-free under concurrent calls | Warning — deferred |
| WR-04 | `sidecar/src/tools/databasise.ts:23` vs `ai.rs:19` | Sidecar fetch timeout (240s) exceeds Rust turn timeout (120s), can wedge queued turns | Warning — deferred |
| WR-05 | `src-tauri/src/sidecar.rs` + `lib.rs` | Node child process never killed on app shutdown (orphaned process) | Warning — deferred |
| WR-06 | `src/host/ai.ts:108-110` + `AssistantPanel.tsx:107-111` | `host.setModes()` throws past its boundary (unhandled promise rejection) when sidecar is down — confirmed still present in current code (`setModes()` returns bare `invoke(...)`, `toggleResearch` has no try/catch) | Warning — deferred |
| WR-07 | `sidecar/src/tools/databasise.ts` + `modes.ts` | Boot-time Databasise outage permanently degrades research tools for process lifetime (memoized `cachedModeTools`, no invalidation) | Warning — deferred |
| WR-08 | `sidecar/src/index.ts` | (Actually addressed alongside CR-01 fix — `getOrCreateSession` now deletes rejected promises on catch, `index.ts:165`) | Resolved incidentally by the CR-01 fix, contrary to REVIEW's original open listing |
| IN-01..IN-04 | various | Info-level, not evaluated further — non-blocking by definition | Info |

CR-01 (blocker) and WR-01/WR-02 (warnings) were confirmed FIXED via commits `ef5ad1f`, `6040401`, `186b18c` — diffs read directly and match the claimed fix descriptions.

### Human Verification Required

See YAML frontmatter `human_verification` for the structured list. Narrative summary:

#### 1. D-01 — Live streamed chat

**Test:** With a real `CEREBRAS_API_KEY` in `sidecar/.env` and the app running, type a message in the assistant panel.
**Expected:** A real Pi reply streams in token by token; message settles to "done".
**Why human:** Needs a live LLM key and observing real-time UI behavior.

#### 2. D-03 — Research mode grounding

**Test:** With Databasise running against the populated `rag_storage`, toggle Research and ask a corpus question.
**Expected:** A tool call fires and the reply is grounded in the user's Databasise corpus, not generic knowledge.
**Why human:** Needs a live external server and judgment about answer grounding quality.

#### 3. D-06 — Live honest degrade

**Test:** Kill Databasise mid-session and send another Research-mode message.
**Expected:** Honest "wiki unavailable" text, plain chat keeps working, app doesn't crash.
**Why human:** Requires live process manipulation and runtime observation.

#### 4. D-09 — History survives restart

**Test:** Restart the app after a conversation.
**Expected:** Prior session's turns reload from the file-backed JSONL store.
**Why human:** Requires an actual app restart and observing persisted state.

These four items are exactly the plan 07-05 checkpoint task's scope; no `07-05-SUMMARY.md` or human-UAT record exists yet, confirming this checkpoint has not been run.

### Gaps Summary

No code-level gaps found. All 14 derived observable truths (D-01 through D-10, mapped across sidecar/Rust/frontend layers) are backed by real, substantive, wired code — not stubs or placeholders. All automated test suites are green (sidecar 16/16, frontend 24/24, Rust 4/4), matching the SUMMARY.md claims, independently re-run by this verifier rather than trusted from narration. The one BLOCKER (CR-01) and two WARNINGs (WR-01, WR-02) raised by the prior code review were independently confirmed fixed by reading the actual diffs. Six lower-severity warnings (WR-03 through WR-08, minus WR-08 which appears incidentally resolved) remain open by explicit user choice and are documented above as non-blocking technical debt, not phase gaps.

The phase cannot be marked fully `passed` because its own plan (07-05) designates four end-to-end truths as requiring a live human-run session (real API key + running Databasise + launched app) — these were correctly anticipated as human-only in the verification task scope and are surfaced as `human_verification` items rather than fabricated as pass/fail from static analysis.

---

_Verified: 2026-07-07_
_Verifier: Claude (gsd-verifier)_
