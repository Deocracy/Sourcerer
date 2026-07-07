---
spike: 003
name: lean-prompt-modes
type: standard
validates: "Given a mode registry, when a mode is toggled, then only that mode's prompt+tools load and baseline stays under ~5k tokens"
verdict: VALIDATED
related: [001, 002]
tags: [modes, prompt-budget, architecture, pi]
---

# Spike 003: Lean Prompt Modes

## What This Validates

Given a mode registry (Research / Notes / Coding), when a mode is toggled at runtime, then only that mode's prompt fragment + tool pack are live — and the total system prompt stays far under the ~5k-token budget even with every mode on.

## Research

No external research needed beyond Pi's own source: `AgentSession` exposes `setActiveToolsByName(names)` (swaps active tools AND rebuilds the system prompt) and `reload()` (re-runs the resource loader, re-invoking `systemPromptOverride`). Read `dist/core/agent-session.js` directly to get the semantics right — the docs don't cover the interaction between the two.

## How to Run

```bash
# Databasise up first (WORKING_DIR=./rag_storage — see spike 002)
cd .planning/spikes/003-lean-prompt-modes
node server.mjs
# open http://localhost:4803 — toggle mode checkboxes in the top bar, watch the token gauge
node mode-test.mjs    # scripted: baseline + research-off behavior
node mode-test2.mjs   # scripted: toggle-on, all-modes ceiling, coding mode, all-off
```

## What to Expect

- Top bar: three mode checkboxes + a live prompt-token gauge that updates on every toggle.
- Research OFF: asking for `wiki_resolve` → model says the tool doesn't exist (no hallucinated call).
- Toggle Research ON (no restart): same question → `wiki_resolve` fires, canonical view returned.
- All modes ON: 6 tools, prompt ~156 tokens. All OFF: 0 tools, ~71 tokens. Budget check trivially passes.
- Coding mode: "which file defines MODES?" → `grep` runs → "server.mjs".

## Observability

`/log` forensic log (mode changes recorded with resulting toolset + prompt size), `/state` shows modes/tools/prompt live. Scripted tests print tools-used per turn from the SSE stream.

## Investigation Trail

1. Built the mode registry as a plain object + active-`Set` — each mode = `{prompt fragment, tool pack}`; compose on demand. No plugin framework.
2. **First toggle run failed silently:** after `POST /modes`, the model still saw only the boot tools (looped `list_notes` 31 times hunting for `grep`, claimed `wiki_resolve` unavailable). Reading `agent-session.js` revealed why: a `tools:` allowlist at `createAgentSession` time becomes a **persistent registry filter** — `setActiveToolsByName` silently drops any name outside it, forever.
3. Fix: register everything at creation (`noTools: "builtin"` + all mode tools in `customTools` — "builtin" keeps custom tools, unlike the `"all"` landmine from spike 001), then narrow with `setActiveToolsByName(active)` immediately after creation.
4. Toggle order matters: `await session.reload()` first (re-reads `systemPromptOverride` → new mode fragments), **then** `setActiveToolsByName` (rebuilds prompt with the new toolset). Reverse order gets clobbered.
5. Re-ran all scenarios: gating, mid-session enable, all-on ceiling, coding mode, all-off. All correct.
6. Measurement quirk: the boot prompt reports ~410 tokens (pi's initial template wraps the custom prompt with guidelines); after the first `setActiveToolsByName` rebuild it reports the raw composed prompt (~131–156 tokens). Both are 30–150× under OMP-class baselines.

## Results

**VALIDATED.** Modes are cheap and native on Pi:

- Runtime toggling works without restarting the session or losing conversation state.
- Capability is provably gated: tools outside active modes don't exist for the model (it says so rather than hallucinating).
- Token budget is a non-issue: ~71 tokens (no modes) to ~156 tokens (all modes) vs the 5k ceiling — the "load only what you need" harness is real.
- "Sourcerer can be a coding agent when it needs to be" is literally a checkbox (Coding mode = pi's own read/grep tools).

**Landmines for the build:**
- Never pass a `tools:` allowlist at session creation if modes will toggle later — it permanently filters the registry. Use `noTools: "builtin"` + `customTools` + `setActiveToolsByName`.
- Toggle order: `reload()` then `setActiveToolsByName()`.
- Prompt-size telemetry should read `session.systemPrompt` *after* a `setActiveToolsByName` rebuild for consistent numbers.
