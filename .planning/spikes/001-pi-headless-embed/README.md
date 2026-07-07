---
spike: 001
name: pi-headless-embed
type: standard
validates: "Given Pi's agent core in a Node sidecar (no TUI), when a message is sent programmatically, then streamed text + tool calls come back over an API Tauri can proxy"
verdict: VALIDATED
related: []
tags: [pi, embedding, rpc, sidecar, sse]
---

# Spike 001: pi-headless-embed

## What This Validates

Given Pi's agent core running headless in a Node sidecar, when Sourcerer sends a message programmatically, then streamed assistant text and tool calls come back over an HTTP/SSE API — the exact shape a Tauri `host.ai()` command proxy needs.

## Research

- Pi lives in the `badlogic/pi-mono` monorepo but is now **published under the `@earendil-works` npm scope** (pi.dev). Installed `@earendil-works/pi-coding-agent@0.74.2`.
- Pi has four official modes: interactive TUI, print/JSON, **RPC (JSONL over stdin/stdout)**, and an **SDK** (`createAgentSession`). For Node hosts the docs explicitly recommend the SDK over spawning an RPC subprocess.
- Package split: `pi-ai` (unified LLM API, 30+ providers), `pi-agent-core` (agent loop), `pi-coding-agent` (SDK + CLI), `pi-tui` (terminal UI — not needed).
- System prompt is fully replaceable via `DefaultResourceLoader({ systemPrompt, noExtensions, noSkills, noPromptTemplates, noThemes, noContextFiles })`.
- `getModel("cerebras", "gpt-oss-120b")` resolves (api=`openai-completions`) even though it isn't in the static `getModels()` list; key read from `CEREBRAS_API_KEY` env.

| Approach | Pros | Cons | Status |
|----------|------|------|--------|
| SDK `createAgentSession` in Node sidecar | In-process, typed, no subprocess plumbing, full control of tools/prompt | Ties sidecar to Node | **Chosen** |
| `pi --mode rpc` subprocess | Language-agnostic (Rust could spawn it directly) | JSONL plumbing, process lifecycle management | Viable fallback |
| opencode client/server | Full server exists | Heavy; whole app, not a library | Rejected for this question |

## How to Run

```bash
cd .planning/spikes/001-pi-headless-embed
node server.mjs
# open http://localhost:4801  — chat UI
# http://localhost:4801/state — model, prompt size, notebook
# http://localhost:4801/log   — forensic event log (JSON export)
```

Uses the Cerebras key from `D:\Vibe Coding\Databasise\runtime\.env` (loaded in-process, never printed). Model: `cerebras/gpt-oss-120b`.

## What to Expect

- Chat page streams tokens live; asking it to "remember X" fires the custom `save_note` tool (visible as an orange chip), and the note lands in `/state`'s notebook.
- Status bar shows the whole system prompt is **1,641 chars (~410 tokens)** — the lean-harness premise, live.
- Multi-turn memory: ask "what notes do I have?" in a later turn and it recalls them.

## Observability

Forensic log at `/log`: every boot/user/tool/agent event with ISO timestamps, plus a category-count summary. `sse-check.mjs` is a standalone SSE client that prints the event-type histogram for one turn.

## Investigation Trail

1. Installed the SDK, confirmed exports (`createAgentSession`, `defineTool`, `SessionManager.inMemory`, `DefaultResourceLoader`) from the shipped `.d.ts` files rather than trusting docs.
2. Built `server.mjs` (HTTP + SSE + one custom life-hub tool) and `index.html` chat page.
3. **First live turn: tool never fired.** `probe-events.mjs` isolated it — with `noTools: "all"`, custom tools are suppressed too, despite being passed in `customTools`. The model simply never saw the tool.
4. Fix: explicit allowlist `tools: ["save_note"]` (or `noTools: "builtin"`). Tool then fired: `assistant → toolCall → execute → toolResult → assistant confirmation`, notebook populated.
5. SSE verified with a real streaming client (`sse-check.mjs`): `agent_start, turn_start, thinking_delta ×15, text_delta ×9, turn_end, agent_end, done`. (An in-sandbox fetch had shown zero events — sandbox buffering artifact, not a server bug.)
6. Confirmed `tool_execution_start` / `tool_execution_end` are the real event names via the forensic log.

## Results

**VALIDATED.** Pi embeds headless in ~80 lines of glue:

- Programmatic prompt in, streamed `text_delta`/`thinking_delta`/tool events out — everything a Tauri SSE/channel proxy needs.
- Custom tools via `defineTool` (TypeBox schemas) work against a live OpenAI-compatible provider (Cerebras gpt-oss-120b).
- System prompt fully replaced: **~410 tokens** baseline vs the ~22k-token prompts that motivated rejecting OMP/opencode as defaults.
- `SessionManager.inMemory()` + spike-local `agentDir` = zero pollution of `~/.pi` or the repo.
- Session state (multi-turn memory) held across turns in one process.

**Landmines for the build:**
- `noTools: "all"` kills `customTools` too — always pass an explicit `tools` allowlist (or `noTools: "builtin"`).
- npm scope is `@earendil-works/*`, not `@mariozechner/*` (older docs/posts point at the dead scope).
- `package.json` of pi-coding-agent doesn't export `./package.json` — read version via fs, not `require`.
- Thinking deltas arrive interleaved (`thinking_delta`) — the GUI will want to render or suppress them deliberately.
