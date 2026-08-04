---
status: complete
phase: 07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a
source: [07-VERIFICATION.md, 07-05-PLAN.md]
started: 2026-07-07
updated: 2026-07-07
---

## Current Test

[all tests complete — 4/4 pass; D-09 gap closed by plan 07-06 and retested live]

## Environment used

- Model: `zai-glm-4.7` on Cerebras (switched from `gpt-oss-120b` via `sidecar/.env` during the run — see Notes).
- Databasise: live against the populated store (`WORKING_DIR=./rag_storage`), 112-entity corpus (Deocracy document).
- App launched detached via the built `sourcerer.exe` (see fixes below).

## Tests

### 1. Streamed chat (D-01)
expected: reply streams token-by-token.
result: PASS — "hi" → "Hello! How can I assist you today?" streamed incrementally.

### 2. Research grounding (D-03)
expected: Research ON, corpus question fires a wiki/kb tool and answer reflects corpus content.
result: PASS (on `zai-glm-4.7`) — "what is deocracy?" → `kb_query` fired and the reply was grounded in the Deocracy corpus (citizen-led decentralization, blockchain/DAOs, "governance secured by math"). NOTE: failed on `gpt-oss-120b`, which mis-selected empty graph query modes (local/global/hybrid) and the empty wiki_* resolver tools; switching to GLM 4.7 resolved it.

### 3. Honest degrade (D-06)
expected: with Databasise killed, the reply says the wiki is unavailable AND plain chat still works, no crash/hang.
result: PASS (after fix) — app did not crash/hang and plain chat worked from the start; the honest "wiki unavailable" disclosure was initially non-deterministic (model discretion), fixed by strengthening `WIKI_UNAVAILABLE_MESSAGE` into an explicit instruction (commit). Re-tested: disclosure now shows reliably.

### 4. History survives restart (D-09)
expected: after app restart, the prior session's turns reload into the panel from the JSONL store.
result: PASS (after gap closure, retested 2026-07-07) — plan 07-06 added the loadSession protocol path (sidecar `history` event, Rust `load_session` command, panel sessionId persistence + replay on mount). Rebuilt release exe, sent messages, closed, relaunched: prior turns rendered in the panel on open. Initial ISSUE record preserved below in Gaps (now CLOSED).

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

### GAP-07-D09 (CLOSED 2026-07-07 by plan 07-06): chat history does not reload/render on app restart
- **Decision:** D-09 — CONTEXT: "the current session's turns render on open, so history survives restart." User explicitly wants chat history working.
- **Observed:** After closing and relaunching the app, the assistant panel opens empty. Prior turns are safely on disk (JSONL, file-backed sessions) and reload into the model's context if the same sessionId is reused (verified with a two-process test), but the UI never reopens or renders them.
- **Root cause (two-fold, both frontend/protocol — engine is fine):**
  1. `src/assistant/AssistantPanel.tsx` uses `useRef(newSessionId())` — a fresh sessionId every mount; it never persists or reopens the prior session.
  2. `sidecar/src/protocol.ts` has only `prompt`/`setModes` request types — there is no "load session" / "list sessions" / "fetch history" path to stream prior turns back to the panel for rendering.
- **Scope of fix (multi-layer):**
  - Protocol: add a request to load a session's prior turns (and optionally list sessions); the sidecar already exposes `FileSessionManager.listSessions()` / `open(sessionId)`.
  - Sidecar: on load, replay the opened session's stored turns back as events the panel can render.
  - Rust (`commands/ai.rs`): forward the new request over the existing Channel plumbing.
  - Panel: persist the current sessionId across restarts (localStorage or tauri-store), and on mount reopen it + render the returned turns.
  - Tests: a two-process/session-reload test asserting rendered history.
- **Not affected:** D-01/D-03/D-06 (all pass); the file-backed persistence engine (07-02) is solid.
- **Next:** `/gsd-plan-phase 7 --gaps`

## Notes (fixes applied live during the gate — the gate did its job)

1. **D-08 `.env` never loaded** (committed `8423441`): the sidecar declared `CEREBRAS_API_KEY` but nothing loaded `sidecar/.env` (Node doesn't auto-load it). Caused "No API key found for cerebras." Fixed with `process.loadEnvFile()` guarded by existsSync. False-green: unit tests set env vars directly.
2. **D-06 disclosure non-determinism** (committed): `WIKI_UNAVAILABLE_MESSAGE` was a soft hint ("...answering from general knowledge"); rewritten as an explicit instruction so the model reliably tells the user the wiki is down.
3. **Model swap** (runtime, `sidecar/.env`, gitignored): `PI_MODEL=zai-glm-4.7` — fixes D-03 tool selection. Committed default is still `gpt-oss-120b`; promote to committed default (index.ts fallback + .env.example) if desired.
4. **Launch method** (env note, not code): the Tauri app must be launched detached (Start-Process on the built exe); a backgrounded `cargo run` bash task gets reaped ~30-60s after boot (exit 0xffffffff) — not an app crash.
