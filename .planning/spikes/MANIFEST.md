# Spike Manifest

## Idea

Choose the assistant harness for Sourcerer's Dashboard Assistant and its connection to the Databasise engine: opencode vs Pi vs OMP (Oh-My-Pi). Working hypothesis: Pi as the lean embeddable core, cherry-pick useful OMP components, skip opencode as overkill. Sourcerer is not primarily a coding agent — it is a life-information control hub geared to PhD-researcher-level work for everyone — so the harness must be lean (load only what a mode needs) rather than shipping a 22k-token coding prompt.

## Requirements

- Harness must run headless behind `host.ai()` (Tauri command proxy) — no TUI dependency.
- Baseline system prompt stays lean (~<5k tokens); capability comes from selectable modes, not an always-on mega-prompt.
- Modes can be toggled per use case or kept always-on by user choice.
- Databasise (MCP/REST) is the first-class tool surface, not an afterthought.
- Sourcerer may act as a coding agent when needed, but that is a mode, not the default identity.

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | pi-headless-embed | standard | Given Pi's agent core in a Node sidecar (no TUI), when a message is sent programmatically, then streamed text + tool calls come back over an API Tauri can proxy | VALIDATED | pi, embedding, rpc, sidecar, sse |
| 002 | databasise-tools-over-pi | standard | Given Databasise's MCP/REST surface, when its tools are registered in the Pi harness, then a chat turn resolves a real wiki/search query end-to-end | PENDING | pi, databasise, mcp, tools |
| 003 | lean-prompt-modes | standard | Given a mode registry, when a mode is toggled, then only that mode's prompt+tools load and baseline stays under ~5k tokens | PENDING | modes, prompt-budget, architecture |
| 004 | omp-component-harvest | standard | Given OMP's codebase, when one useful component is extracted and run under plain Pi, then it works standalone — plus liftable-components list with license/coupling notes | PENDING | omp, extensions, harvest |
| 005 | token-baseline-benchmark | comparison | Given the same trivial task, when run under lean-Pi vs OMP vs opencode, then measured prompt-token baselines confirm or refute the "22k is overkill" claim | PENDING | benchmark, tokens, comparison |
