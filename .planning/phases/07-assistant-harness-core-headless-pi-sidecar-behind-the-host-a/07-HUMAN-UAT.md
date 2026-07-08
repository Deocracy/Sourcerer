---
status: partial
phase: 07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a
source: [07-VERIFICATION.md, 07-05-PLAN.md]
started: 2026-07-07
updated: 2026-07-07
---

## Current Test

[awaiting human testing — live end-to-end spine, plan 07-05]

## Pre-requisites (one-time)

- Put a real `CEREBRAS_API_KEY` in `sidecar/.env` (copy from Databasise `runtime/.env` `LLM_BINDING_API_KEY`, per D-08).
- Start Databasise against the POPULATED store from `D:\Vibe Coding\Databasise\runtime`:
  `WORKING_DIR=./rag_storage ../sourcerer-venv/Scripts/python.exe ../sourcerer-lightrag/sourcerer.py`
  Confirm it answers at http://127.0.0.1:9621/openapi.json.
- Launch the app (verify `cargo run` from `src-tauri` vs `cargo tauri dev` — use whichever launches this scaffold reliably, per CLAUDE.md landmine).

## Tests

### 1. Streamed chat (D-01)
expected: Type "hello, who are you?" — the reply streams in token-by-token (not one blocking chunk).
result: [pending]

### 2. Research grounding (D-03)
expected: Turn Research mode ON, ask a question answerable only from your Databasise corpus (a specific entity in the 112-entity wiki). A wiki/kb tool call fires and the answer reflects corpus content, not generic LLM knowledge.
result: [pending]

### 3. Honest degrade (D-06)
expected: Stop the Databasise server, ask another Research question. Reply says the wiki is unavailable AND plain chat still works (ask a general question, get a normal streamed reply). App does NOT crash or hang.
result: [pending]

### 4. History survives restart (D-09)
expected: Note the current conversation, fully close and relaunch the app, reopen the assistant — the prior turns reload from disk.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
