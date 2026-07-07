---
name: spike-findings-sourcerer
description: Implementation blueprint from spike experiments. Requirements, proven patterns, and verified knowledge for building Sourcerer's Dashboard Assistant harness (Pi core, Databasise tools, OMP memory). Auto-loaded during assistant/harness implementation work.
---

<context>
## Project: Sourcerer — Dashboard Assistant harness

Choosing and embedding the assistant harness for Sourcerer's Dashboard Assistant and its
connection to the Databasise engine. Sourcerer is a life-information control hub geared to
PhD-researcher-level work — not primarily a coding agent — so the harness must be lean (load
only what a mode needs) rather than shipping a 22k-token coding prompt. Decision reached:
**lean-Pi (`@earendil-works/pi-coding-agent`) as the core; harvest OMP parts, not its harness;
skip opencode.**

Spike sessions wrapped: 2026-07-06 (spikes 001–005, all VALIDATED).
</context>

<requirements>
## Requirements

Non-negotiable design decisions from the spike sessions. Every reference honors these.

- Harness runs **headless behind `host.ai()`** (Tauri command proxy) — no TUI dependency.
- Baseline system prompt stays **lean (~<5k tokens)**; capability comes from selectable modes, not an always-on mega-prompt.
- Modes toggle per use case or stay always-on by user choice.
- **Databasise (MCP/REST) is the first-class tool surface**, not an afterthought.
- Sourcerer may act as a coding agent when needed, but that is a **mode, not the default identity**.
- The token cost center is **tool schemas, not prose** — mode-gating must gate *tools*; never mount a full coding toolset by default.
- **Control the assistant's `cwd`** and/or set `noContextFiles`: Pi auto-injects the repo's `CLAUDE.md`/`AGENTS.md` as a per-turn token tax.
</requirements>

<findings_index>
## Feature Areas

| Area | Reference | Key Finding |
|------|-----------|-------------|
| Harness embedding & lean modes | references/harness-embedding.md | Pi embeds headless in ~80 lines; lean prompt + mode-gated tools via `DefaultResourceLoader` + `setActiveToolsByName`; ~130–600 tok baseline vs OMP's 16k–35k |
| Databasise tool projection | references/databasise-tools.md | Auto-generate Pi tools from live `/openapi.json` (~60 lines); query-vs-body param mapping; point `WORKING_DIR` at `./rag_storage` |
| Harvesting OMP components | references/omp-components.md | Lift `pi-mnemopi` (MIT) memory as a Bun HTTP sidecar → Pi custom tools; adopt parts, not the harness |

## Source Files

Original spike source files are preserved in `sources/` for complete reference.
</findings_index>

<metadata>
## Processed Spikes

- 001-pi-headless-embed
- 002-databasise-tools-over-pi
- 003-lean-prompt-modes
- 004-omp-component-harvest
- 005-token-baseline-benchmark
</metadata>
