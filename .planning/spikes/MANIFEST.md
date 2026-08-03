# Spike Manifest

## Idea

Choose the assistant harness for Sourcerer's Dashboard Assistant and its connection to the Databasise engine: opencode vs Pi vs OMP (Oh-My-Pi). Working hypothesis: Pi as the lean embeddable core, cherry-pick useful OMP components, skip opencode as overkill. Sourcerer is not primarily a coding agent — it is a life-information control hub geared to PhD-researcher-level work for everyone — so the harness must be lean (load only what a mode needs) rather than shipping a 22k-token coding prompt.

## Requirements

- Harness must run headless behind `host.ai()` (Tauri command proxy) — no TUI dependency.
- Baseline system prompt stays lean (~<5k tokens); capability comes from selectable modes, not an always-on mega-prompt.
- Modes can be toggled per use case or kept always-on by user choice.
- Databasise (MCP/REST) is the first-class tool surface, not an afterthought.
- Sourcerer may act as a coding agent when needed, but that is a mode, not the default identity.
- The token cost center is **tool schemas, not prose** (spike 005): OMP's 22k+ is ~13k of 17 always-on tool schemas. Mode-gating must gate *tools*, not just prompt fragments — never mount a full coding toolset by default.
- Control the assistant's `cwd` deliberately: Pi auto-injects the repo's `CLAUDE.md`/`AGENTS.md` as project context (a per-turn token tax that dwarfs the harness), and `noContextFiles` did not gate it in pi 0.74.2 (spike 005).
- The sidecar protocol stays **transport-agnostic**: stdio today, WebSocket (or any stream) tomorrow — nothing in the request/event contract may assume a local parent process. Mobile is a thin remote client of the same sidecar; Pi never runs on-device (no Node on iOS/Android). (Emerged 2026-07-07; validated later by spike 009.)

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | pi-headless-embed | standard | Given Pi's agent core in a Node sidecar (no TUI), when a message is sent programmatically, then streamed text + tool calls come back over an API Tauri can proxy | VALIDATED | pi, embedding, rpc, sidecar, sse |
| 002 | databasise-tools-over-pi | standard | Given Databasise's MCP/REST surface, when its tools are registered in the Pi harness, then a chat turn resolves a real wiki/search query end-to-end | VALIDATED | pi, databasise, openapi, tools, rest |
| 003 | lean-prompt-modes | standard | Given a mode registry, when a mode is toggled, then only that mode's prompt+tools load and baseline stays under ~5k tokens | VALIDATED | modes, prompt-budget, architecture |
| 004 | omp-component-harvest | standard | Given OMP's codebase, when one useful component is extracted and run under plain Pi, then it works standalone — plus liftable-components list with license/coupling notes | VALIDATED | omp, extensions, harvest, mnemopi, memory |
| 005 | token-baseline-benchmark | comparison | Given the same trivial task, when run under lean-Pi vs OMP vs opencode, then measured prompt-token baselines confirm or refute the "22k is overkill" claim | VALIDATED | benchmark, tokens, comparison |
| 006 | integrated-assistant-core | standard | Given ONE Pi session with the full mode registry (Research=Databasise, Memory=mnemopi, Notes), when a user drives real mixed conversations, then everything composes in one live harness with no tool-confusion/token/contention surprises — a usable chat product over the real wiki | PARKED | integration, pi, databasise, mnemopi, modes |
| 007 | session-persistence | standard | Given the integrated harness, when the process restarts, then conversations + memory survive and resume (file-backed SessionManager vs in-memory) | PARKED | persistence, sessions, pi |
| 008 | tauri-hostai-seam | standard | Given a minimal Tauri 2 window, when the webview calls host.ai(msg), then the Rust command proxies to the Pi sidecar and streams deltas back into the page | PARKED | tauri, host-ai, seam, sidecar |
| 009 | ws-transport-remote-client | standard | Given the sidecar's stdio protocol loop (readRequests/writeEvent), when wrapped behind a WebSocket server and driven by a remote browser client (e.g. a phone on the LAN), then one real prompt turn streams text_delta/tool_start/done events and the Databasise tools work unchanged — proving the protocol is transport-agnostic so a future mobile thin-client talks to the same desktop/server-side sidecar. OUT OF SCOPE: mobile shell UI, nodejs-mobile embedding (rejected — no Node runtime on iOS/Android), auth hardening (a LAN token is enough for the spike) | PARKED | transport, websocket, mobile, sidecar, remote, host-ai |
| 010 | nixos-wsl-substrate | standard | Given the prebuilt NixOS-WSL 2605.7.2 image, when imported as a private custom-named WSL distro and driven entirely via wsl.exe, then it boots, applies a config change with nixos-rebuild switch, and reverts with --rollback (Container Platform plan P0 "spike A-lite"; Podman/Collabora/pane legs descoped by user — guess-with-fallbacks) | VALIDATED | nixos-wsl, substrate, updater, rollback, container-platform |
| 011 | tauri-multiwebview | standard | Given a Tauri 2 window with the `unstable` feature, when a full-size shell webview + two external-origin child webviews are composed Sourcerer-style and one child's bounds are animated, then children render above the shell at DOM-aligned coords without jank and the shell stays healthy (Container Platform plan P0 "spike E") | VALIDATED | tauri, multiwebview, panes, webview2, container-platform |
