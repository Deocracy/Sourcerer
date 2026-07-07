# Spike Conventions

Patterns and stack choices established across the harness-selection spikes (001–005).
New spikes follow these unless the question requires otherwise.

## Stack

- **Harness core:** `@earendil-works/pi-coding-agent` (lean upstream Pi, `^0.74.2`) —
  the validated core. Not OMP's `@oh-my-pi/pi-coding-agent` (that's a parts bin, spike 004),
  not opencode (compiled binary, not embeddable, spike 005).
- **Runtime:** Node for the Pi harness; **Bun** only where a component's source entry demands it
  (mnemopi 004, OMP's own scripts 005) — keep Bun-only pieces behind an HTTP/MCP boundary.
- **Model + keys:** read the LLM key from Databasise's `runtime/.env`
  (`LLM_BINDING_API_KEY` → `CEREBRAS_API_KEY`); `getModel("cerebras","gpt-oss-120b")`.
  For prompt-only measurement, a `dummy` key works (no network until a message is sent).

## Structure

- One directory per spike: `NNN-name/` with `server.mjs` (+ `index.html` for browser spikes),
  its own `package.json` + `node_modules`, and `README.md`.
- External services run as small sidecars on `:48xx` ports; the Pi harness proxies them as
  custom tools (the spike-002 projection pattern, reused in 004).

## Patterns

- **Experience the spike:** browser UI + forensic `/log` for interaction spikes (001–004).
  Pure benchmark/fact spikes (005) use stdout + a `results.json` forensic export instead.
- **Tools register once, gate at runtime:** `noTools:"builtin"` + `customTools:[…]` at creation,
  then `setActiveToolsByName(active)` to narrow. A `tools:` allowlist at creation permanently
  filters the registry — never use it if modes toggle later (spike 003).
- **Token accounting:** `session.systemPrompt.length / 4` for quick gauges; a real BPE ruler
  (`gpt-tokenizer`) when a number must be defensible (005). Gate tools, not just prose — tool
  schemas dominate the baseline (005).
- **Control `cwd`:** Pi injects `CLAUDE.md`/`AGENTS.md` found by walking up from `cwd`. Run
  measurement/isolated work from a dir outside the repo to avoid the project-context token tax.

## Tools & Libraries

- `@earendil-works/pi-coding-agent@^0.74.2`, `@earendil-works/pi-ai@^0.74.2` — Pi core + models.
- `@oh-my-pi/pi-mnemopi@^16` — liftable OMP memory engine (MIT); Bun source entry, HTTP boundary.
- `gpt-tokenizer@^2` — pure-JS BPE, no native deps; the token ruler for benchmarks.
- Avoid: importing OMP's Bun-source packages directly from Node; adopting opencode's harness (binary).
