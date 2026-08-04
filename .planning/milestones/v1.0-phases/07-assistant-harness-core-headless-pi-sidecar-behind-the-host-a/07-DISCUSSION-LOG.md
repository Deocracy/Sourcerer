# Phase 07: Assistant Harness Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-07
**Phase:** 07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a
**Areas discussed:** Mode roster & defaults, Memory scope, Databasise availability, Config source & sidecar wiring, Session history

---

## Scope reframe (drove everything below)

The user re-scoped the phase away from the roadmap's "build all four modes + mnemopi" goal:
> *"non, I want to wire as we go, I only want to wire pi into the rail and make the messaging system work."*

This narrowed Phase 7 to: real Pi behind `host.ai()` + streamed chat in the rail + mode plumbing with one live proof mode; other modes deferred.

---

## Mode Roster & Defaults

| Option | Description | Selected |
|--------|-------------|----------|
| Build all of Notes/Research/Coding/Memory | Full mode toolset | |
| Wire as we go — Pi into rail + messaging only | Chat first, tools incremental | ✓ |

**User's choice:** Wire Pi into the rail, make messaging work; tools later. Also asked "what is this wired to the wiki do?" — answered: Research/Databasise tools give grounded, cited answers over the user's own corpus vs generic chat.

## End State

| Option | Description | Selected |
|--------|-------------|----------|
| Real chat in the rail | Minimal panel; type + watch streamed reply (couples to some Phase 6 UI) | ✓ |
| Backend + seam only | Stay headless, prove via test harness/CLI | |
| Least work to a live reply | Shortest path, ignore phase purity | |

**User's choice:** Real chat in the rail.

## Mode Seam

| Option | Description | Selected |
|--------|-------------|----------|
| Empty seam, add later | Registry + toggle plumbing, zero tools | |
| One proof mode (Research) | Plumbing + Research/Databasise wired live | ✓ |
| No mode plumbing yet | Just Pi chat, no registry | |

**User's choice:** One proof mode (Research). Notes/Coding/Memory deferred to empty seam.

## Memory Scope (mnemopi)

**User's choice:** Deferred (Memory mode not selected in roster; no Bun sidecar this phase). Noted as documented next mode.

## Databasise Availability

| Option | Description | Selected |
|--------|-------------|----------|
| Assume running + degrade | Harness doesn't manage the process; Research tools fail honestly when down | ✓ |
| Harness auto-starts it | Sidecar spawns the Databasise python server | |
| Hard-require it | Refuse Research mode unless server answers | |

**User's choice:** Assume running + graceful degrade.

## Config Source

| Option | Description | Selected |
|--------|-------------|----------|
| Own .env in sidecar dir | Self-contained; cerebras/gpt-oss-120b default | ✓ |
| Reuse Databasise runtime/.env | Zero new config, couples to Databasise path | |
| Wait for Sourcerer settings UI | Doesn't exist yet | |

**User's choice:** Own `.env` in the sidecar dir. User owns the key.

## Session History

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory now, file-backed later | History resets on restart | |
| File-backed now | Conversations survive restart | ✓ |

**User's choice:** File-backed now. User: "how would we wire history as that is something I want working." Explained: each conversation = a JSONL file in an app-data session dir, listed on boot, current session's turns render on open (folds parked spike 007).

---

## Claude's Discretion

- Minimal rail chat UI shape (composer/message list); full ASST-01/02/03 polish stays Phase 6.
- Render vs suppress `thinking_delta` in the minimal panel.
- Dev sidecar launch mechanism (spawn `node` from Rust); bundled binary deferred with packaging.
- App-data session dir path; per-tool result truncation limits.

## Deferred Ideas

- Notes / Coding / Memory modes (plumbing ships, tools added incrementally).
- mnemopi durable memory (Bun sidecar) — next mode.
- Full multi-session switcher UI (ASST-01/02/03) — Phase 6.
- Bundled Tauri sidecar binary / packaging.
- Deliberate Databasise auth beyond local guest-mode.
