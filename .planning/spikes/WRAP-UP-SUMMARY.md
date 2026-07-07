# Spike Wrap-Up Summary

**Date:** 2026-07-06
**Spikes processed:** 5
**Feature areas:** Harness embedding & lean modes · Databasise tool projection · OMP component harvesting
**Skill output:** `./.claude/skills/spike-findings-sourcerer/`

## Processed Spikes

| # | Name | Type | Verdict | Feature Area |
|---|------|------|---------|--------------|
| 001 | pi-headless-embed | standard | VALIDATED | Harness embedding & lean modes |
| 002 | databasise-tools-over-pi | standard | VALIDATED | Databasise tool projection |
| 003 | lean-prompt-modes | standard | VALIDATED | Harness embedding & lean modes |
| 004 | omp-component-harvest | standard | VALIDATED | OMP component harvesting |
| 005 | token-baseline-benchmark | comparison | VALIDATED | Harness embedding & lean modes |

## Key Findings

- **Decision reached:** lean-Pi (`@earendil-works/pi-coding-agent@0.74.2`) is the harness core. Harvest OMP *parts* (memory), not its harness. Skip opencode (not embeddable — ships a compiled binary).
- **Pi embeds headless in ~80 lines** — programmatic prompt in, streamed `text_delta`/`thinking_delta`/tool events out over SSE (the shape a Tauri `host.ai()` proxy needs). Custom tools via `defineTool`.
- **Lean baseline is real and cheap:** ~130–600 tokens with mode-gated tools, vs OMP's 16,189-token minimal wire baseline (→ ~35k with orchestration notices). The "22k is overkill" hypothesis is CONFIRMED — and the bloat is **tool schemas (13,205 tok / 17 tools), not prose**. Sourcerer's mode-gating attacks exactly the right cost center.
- **Databasise projects in cleanly:** auto-generate Pi tools from the live `/openapi.json` (~60 lines), query-vs-body param mapping, honest empty-result reporting. Point `WORKING_DIR=./rag_storage`.
- **OMP memory lifts cleanly:** `pi-mnemopi` (MIT) runs as a Bun HTTP sidecar → Pi custom tools, same projection pattern as Databasise.

### Top landmines carried into the build

- `noTools:"all"` suppresses custom tools; use `noTools:"builtin"`.
- A `tools:` allowlist at creation permanently filters the registry — register all via `customTools`, narrow with `setActiveToolsByName`.
- Set lean prompt + `noContextFiles` via `DefaultResourceLoader`, not bare `createAgentSession` opts (ignored in 0.74.2).
- Pi auto-injects the repo `CLAUDE.md` as project context — control `cwd` / `noContextFiles`.
- Databasise defaults to an empty `./sourcerer_data` store; guest-mode auth is wide open locally.
- `pi-mnemopi` is Bun-only at source entry; `recall()` is async; `getStats()` not `stats()`.
