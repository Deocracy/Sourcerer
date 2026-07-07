# Harness Embedding & Lean Prompt/Mode Architecture

How to run Pi headless behind `host.ai()` with a lean baseline and mode-gated tools.
Proven end-to-end in spikes 001 (embed), 003 (modes), 005 (token proof).

## Requirements (non-negotiable — from MANIFEST)

- Harness runs **headless behind `host.ai()`** (Tauri command proxy) — no TUI dependency.
- Baseline system prompt stays **lean (~<5k tokens)**; capability comes from selectable modes, not an always-on mega-prompt.
- Modes toggle per use case or stay always-on by user choice.
- Sourcerer may act as a coding agent, but that is a **mode, not the default identity**.
- The cost center is **tool schemas, not prose** — mode-gating must gate *tools*, never mount a full coding toolset by default.
- Control the assistant's `cwd`: Pi auto-injects the repo's `CLAUDE.md`/`AGENTS.md` as project context (a per-turn token tax).

## How to Build It

**Stack:** `@earendil-works/pi-coding-agent@^0.74.2` + `@earendil-works/pi-ai@^0.74.2`, Node. Key from Databasise `runtime/.env` (`LLM_BINDING_API_KEY` → `CEREBRAS_API_KEY`), model `getModel("cerebras","gpt-oss-120b")`.

**1. Configure the prompt + context through `DefaultResourceLoader` — NOT bare `createAgentSession` opts.** This is the reliable gate (spike 001). Passing `systemPrompt`/`noContextFiles` directly to `createAgentSession` was silently ignored in spike 005.

```js
import { createAgentSession, DefaultResourceLoader, SessionManager, defineTool } from "@earendil-works/pi-coding-agent";
import { getModel } from "@earendil-works/pi-ai";

const agentDir = path.join(cwd, ".pi-agent");          // spike-local; never touch ~/.pi
const resourceLoader = new DefaultResourceLoader({
  cwd, agentDir,
  systemPrompt: composePrompt(),   // your lean base (or a function via systemPromptOverride, see modes)
  noExtensions: true, noSkills: true, noPromptTemplates: true,
  noThemes: true, noContextFiles: true,   // <-- kills the CLAUDE.md/AGENTS.md auto-inject
});

const { session } = await createAgentSession({
  cwd, agentDir,
  model: getModel("cerebras", "gpt-oss-120b"),
  noTools: "builtin",                       // keep custom tools, drop built-in read/bash/edit/write
  customTools: [ ...allModeTools ],         // register EVERYTHING that any mode may need
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
});
session.setActiveToolsByName(activeToolNames());  // narrow to the active modes' tools + rebuild prompt
```

**2. Mode registry = a plain object + a `Set` of active keys (spike 003). No plugin framework.**

```js
const MODES = {
  notes:    { label: "Notes",    prompt: "...", tools: ["save_note","list_notes"] },
  research: { label: "Research", prompt: "...", tools: ["wiki_resolve","kb_query"] },
  coding:   { label: "Coding",   prompt: "...", tools: ["read","grep"] },
};
const active = new Set(["notes"]);
const composePrompt   = () => [BASE_PROMPT, ...[...active].map(k => MODES[k].prompt), `Today: ${today}`].join("\n\n");
const activeToolNames = () => [...active].flatMap(k => MODES[k].tools);
```

**3. Toggle at runtime WITHOUT restarting the session — order matters:**

```js
async function setModes(keys) {
  active.clear(); for (const k of keys) if (MODES[k]) active.add(k);
  await session.reload();                        // 1. re-reads systemPromptOverride → new mode fragments
  session.setActiveToolsByName(activeToolNames()); // 2. THEN narrow tools + rebuild prompt
}
```
Register the compose fn as `systemPromptOverride: () => composePrompt()` on the session so `reload()` re-reads it.

**4. Stream to the proxy.** Session emits `agent_start, turn_start, thinking_delta, text_delta, tool_execution_start, tool_execution_end, turn_end, agent_end, done`. Fan out over SSE (spike) or a Tauri Channel (real build). Render or deliberately suppress `thinking_delta`.

**5. Custom tools via `defineTool` (TypeBox schemas).** See databasise-tools.md and omp-components.md for the two proven tool sources.

### Measured token baselines (spike 005, one ruler)

| Config | tokens | note |
|---|---:|---|
| Pi out-of-box (builtin tools) | 597 | already lean |
| Pi stock template, tools off | 410 | harness floor |
| Sourcerer lean (template replaced + modes) | ~130 | the target |
| OMP minimal wire baseline | 16,189 | text 2,802 + **17 tool schemas 13,205** |
| OMP + workflow/plan-mode notices | ~35,000 | where "22k+" lives |

The baseline is trivial; the whole budget goes to tools. Gate tools per mode and you pay ~130–600 tokens, not 16k+.

## What to Avoid

- **`noTools: "all"` kills `customTools` too** (spike 001) — the model never sees your tools. Use `noTools: "builtin"` or an explicit `tools: [...]` allowlist.
- **A `tools:` allowlist at creation permanently filters the registry** (spike 003) — `setActiveToolsByName` can never re-enable a name outside it. If modes toggle, register everything via `customTools` and narrow afterward.
- **Don't set the lean prompt / `noContextFiles` as bare `createAgentSession` options** — ignored in spike 005 (0.74.2). Route them through `DefaultResourceLoader`.
- **Toggle order reversed** (setActiveToolsByName before reload) gets the prompt clobbered — reload first.
- **Reading `session.systemPrompt` before the first `setActiveToolsByName` rebuild** reports Pi's boot template wrapper (~410), not your composed prompt. Read after.
- **Don't run the assistant from inside a repo with a large `CLAUDE.md`** unless you want it injected every turn — control `cwd` or set `noContextFiles`.
- npm scope is **`@earendil-works/*`**, not the dead `@mariozechner/*`. `pi-coding-agent`'s `package.json` doesn't export `./package.json` — read version via fs.

## Constraints

- Pi 0.74.2, Node. `getModel("cerebras","gpt-oss-120b")` resolves (api=`openai-completions`) even though absent from the static `getModels()` list.
- Pi has **no built-in MCP** — tools come from `defineTool` adapters (see databasise-tools.md).
- Prompt-only measurement needs no live key (`CEREBRAS_API_KEY=dummy`); a real turn needs the real key.

## Origin

Synthesized from spikes: 001, 003, 005
Source files: sources/001-pi-headless-embed/, sources/003-lean-prompt-modes/, sources/005-token-baseline-benchmark/
