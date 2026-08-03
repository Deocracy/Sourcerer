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
- **Port map:** Pi harness on `:480N` (001→4801, 002→4802, 003→4803, 004→4804); external
  component sidecars on `:489x` (mnemopi→4899). The harness proxies sidecars as custom tools
  (the spike-002 projection pattern, reused in 004).
- Spike-local agent state in `.pi-agent/` + `SessionManager.inMemory()` — never touch `~/.pi`.

## Patterns

- **Experience the spike:** browser UI + forensic `/log` for interaction spikes (001–004).
  Pure benchmark/fact spikes (005) use stdout + a `results.json` forensic export instead.
- **Configure prompt + context via `DefaultResourceLoader`**, not bare `createAgentSession` opts
  (`systemPrompt`/`noContextFiles` were ignored as top-level opts in 0.74.2, spike 005; the loader
  path is proven in spike 001).
- **Tools register once, gate at runtime:** `noTools:"builtin"` + `customTools:[…]` at creation,
  then `setActiveToolsByName(active)` to narrow. A `tools:` allowlist at creation permanently
  filters the registry — never use it if modes toggle later (spike 003).
- **Token accounting:** `session.systemPrompt.length / 4` for quick gauges; a real BPE ruler
  (`gpt-tokenizer`) when a number must be defensible (005). Gate tools, not just prose — tool
  schemas dominate the baseline (005).
- **Control `cwd`:** Pi injects `CLAUDE.md`/`AGENTS.md` found by walking up from `cwd`. Run
  measurement/isolated work from a dir outside the repo to avoid the project-context token tax.

## System-level spikes (Windows host, established in 010/011)

- Drive WSL only via `wsl.exe` with `WSL_UTF8=1` exported (raw output is UTF-16 in Git Bash).
- Wrap absolute Linux paths in `sh -c '...'` when invoking through Git Bash — MSYS path
  conversion silently rewrites direct `/etc/...`-style args into `C:/Program Files/Git/...`.
- Never trust `cmd | tail`'s exit code — check `PIPESTATUS[0]`.
- Timed, tee-logged driver scripts (`run.sh` → `run.log`) are the forensic layer for
  host-mutating spikes; log every attempt, keep failed-attempt logs in the README trail.
- Tauri scratch apps: own crate inside the spike dir (never the main app tree), `icons/icon.ico`
  copied from src-tauri (tauri-build hard-requires it on Windows even with bundling off),
  detached launch + PowerShell `CopyFromScreen` screenshots as visual evidence.

## Tools & Libraries

- `@earendil-works/pi-coding-agent@^0.74.2`, `@earendil-works/pi-ai@^0.74.2` — Pi core + models.
- `@oh-my-pi/pi-mnemopi@^16` — liftable OMP memory engine (MIT); Bun source entry, HTTP boundary.
- `gpt-tokenizer@^2` — pure-JS BPE, no native deps; the token ruler for benchmarks.
- Avoid: importing OMP's Bun-source packages directly from Node; adopting opencode's harness (binary).
