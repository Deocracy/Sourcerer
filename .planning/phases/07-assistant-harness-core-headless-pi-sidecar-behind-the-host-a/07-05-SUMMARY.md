---
phase: 07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a
plan: 05
subsystem: live-uat-gate
tags: [uat, human-verify, end-to-end, cerebras, databasise]

# Dependency graph
requires:
  - "Streamed chat spine from 07-01..07-04 (sidecar, sessions, Rust commands, panel)"
  - "D-09 gap closure from 07-06 (loadSession protocol path + panel session persistence)"
  - "Live Cerebras API key + running Databasise server (127.0.0.1:9621)"
provides:
  - "Human sign-off on all four end-to-end truths: D-01, D-03, D-06, D-09 (4/4 PASS)"
  - "07-HUMAN-UAT.md — the live test record, including fixes applied during the gate"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live UAT gate as a checkpoint plan: automated per-plan tests mock IPC and the model; only a live run with the real key, real sidecar process, and live Databasise proves the integration"
    - "App must be launched detached (Start-Process on built sourcerer.exe); a backgrounded cargo run gets reaped ~30-60s after boot"

key-files:
  created: []
  modified:
    - .planning/phases/07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a/07-HUMAN-UAT.md

key-decisions:
  - "Model for live runs is zai-glm-4.7 on Cerebras — gpt-oss-120b mis-selected empty graph-query tools for D-03 grounding; GLM 4.7 fired kb_query correctly (committed as default in 06c2e2e)."
  - "D-06 honest degrade was made deterministic during the gate by rewriting WIKI_UNAVAILABLE_MESSAGE from a soft hint into an explicit instruction (158de39)."
  - "D-09 initially FAILED (panel minted a fresh sessionId per mount, no protocol path to fetch history) — filed as GAP-07-D09, closed by gap plan 07-06, then retested live on a rebuilt release exe: prior turns render on relaunch. 4/4 truths now pass."

requirements-completed: [D-01, D-03, D-06, D-09]

# Metrics
duration: "live gate run + D-09 retest across 2026-07-07"
completed: 2026-07-07
---

# Phase 07 Plan 05: Live End-to-End UAT Gate Summary

**Human-verified the whole spine live — webview → host.ai() → Rust → Node Pi sidecar → Databasise REST — with all four end-to-end truths passing: streamed chat (D-01), Research grounding (D-03), honest degrade (D-06), and history-survives-restart (D-09, after the 07-06 gap closure).**

## Test Results (see 07-HUMAN-UAT.md for the full record)

| # | Truth | Result |
|---|-------|--------|
| 1 | D-01 streamed chat | PASS — reply streamed token-by-token |
| 2 | D-03 Research grounding | PASS — kb_query fired, reply grounded in the 112-entity Deocracy corpus (on zai-glm-4.7) |
| 3 | D-06 honest degrade | PASS — Databasise killed: honest "wiki unavailable" disclosure, plain chat kept working, no crash/hang |
| 4 | D-09 history reload | PASS (retest) — rebuilt release exe with 07-06 fix; closed app, relaunched, prior turns rendered in the panel |

## Fixes applied live during the gate (the gate did its job)

- D-08 `.env` never loaded — sidecar now calls `process.loadEnvFile()` guarded by existsSync (8423441); unit tests had set env vars directly (false-green).
- D-06 disclosure non-determinism — `WIKI_UNAVAILABLE_MESSAGE` rewritten as an explicit instruction (158de39).
- Default model promoted to `zai-glm-4.7` after D-03 failed on `gpt-oss-120b` (06c2e2e).
- GAP-07-D09 filed and closed via gap plan 07-06 (loadSession request, history event, load_session Rust command, panel sessionId persistence + replay).

## Deviations

- The original single-session gate run found D-09 broken; per the checkpoint contract this produced a concrete defect record (GAP-07-D09) instead of sign-off, a gap-closure plan (07-06) executed, and the failing scenario was retested to PASS before this summary was written.

## Self-Check: PASSED

- 07-HUMAN-UAT.md status: complete, 4/4 passed, 0 issues
- All four must_haves.truths verified live by the user
