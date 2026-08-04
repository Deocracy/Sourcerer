# Phase 07: Assistant Harness Core - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

A real, headless lean-Pi AI backend embedded as a **Node sidecar behind the `host.ai()` Tauri seam**, surfaced through a **minimal live chat panel in the rail** so the user can type a message and watch a real Pi reply stream in.

**This phase deliberately narrows the original roadmap goal** (which listed all four modes + mnemopi). The user re-scoped it to: *"wire Pi in and make the messaging system work; wire the individual tool modes as we go."* So the phase delivers the harness + streaming chat + the mode-toggle plumbing, with exactly **one live proof mode (Research/Databasise)** and everything else deferred to an empty seam.

**In scope:**
- lean-Pi embedded headless (`@earendil-works/pi-coding-agent`) as a Node sidecar
- `host.ai()` Tauri command proxy + streaming (Tauri Channel) from sidecar → webview
- A **minimal assistant chat panel in the rail**: type a message, watch a real streamed reply (couples to some Phase 6 UI, accepted)
- Mode registry + runtime toggle plumbing (spike 003 pattern), shipped with tools gated
- **Research mode** wired live (Databasise REST tools auto-generated from `/openapi.json`) as the one proof that tool-gating works end-to-end
- **File-backed sessions** (persistent chat history reloaded on boot)
- Own `.env` config in the sidecar dir

**Out of scope (deferred to empty seam / later phases):**
- Notes, Coding, Memory modes (plumbing present, tools added later "as we go")
- mnemopi durable memory (no Bun sidecar this phase)
- Full multi-session switcher UI (session list per ASST-01 is Phase 6 polish; only underlying persisted sessions here)
- Databasise process management (assume-running, not auto-start)

</domain>

<decisions>
## Implementation Decisions

### Deliverable / End State
- **D-01:** Phase 7 delivers **real streamed chat visible in the rail**, not just a headless backend. A minimal assistant panel is stood up here (accepted coupling to some Phase 6 UI work) so the messaging loop is demonstrably working end-to-end.

### Mode Roster & Seam
- **D-02:** Build the **mode registry + toggle plumbing** (plain object + active-key `Set`, `session.reload()` → `setActiveToolsByName`, per spike 003). Ship it as a real seam, not a stub.
- **D-03:** Wire **exactly one live proof mode: Research (Databasise tools)** — `wiki_resolve`, `kb_query`, `wiki_unresolved`, `wiki_unplaced` auto-generated from `/openapi.json` (spike 002). This is the one end-to-end proof that mode-gating works.
- **D-04:** **Notes, Coding, Memory modes are deferred** to the empty seam — registered/added incrementally in later work. No tools built for them this phase.
- **D-05 [informational]:** **mnemopi memory is deferred** (no Bun HTTP sidecar this phase) — nothing to implement this phase; recorded as the documented next mode to add via the same sidecar-projection pattern (spike 004).

### Databasise Availability
- **D-06:** **Assume-running + graceful degrade.** The harness does NOT manage the Databasise process. If the server at `127.0.0.1:9621` is down, Research tool calls return an honest "wiki unavailable" and plain chat continues to work. Keeps Phase 7 decoupled from Databasise's venv/paths/lifecycle.
- **D-07:** Databasise local auth is **guest-mode / unauthenticated** for the local sidecar wiring (guest `combined_auth` passes locally per spike 002). Revisit auth deliberately if/when it ships beyond local dev.

### Config Source
- **D-08:** The sidecar reads provider/model/API key from its **own `.env` in the sidecar dir** (self-contained, no coupling to Databasise install). User owns the key (may copy the Cerebras key from Databasise's `runtime/.env`). Default model: `cerebras/gpt-oss-120b` per spike baselines.

### Session History
- **D-09:** **File-backed sessions** (NOT in-memory). Each conversation is a file (JSONL of turns) in an app-data session dir owned by the sidecar; the dir is listed on boot and the current session's turns render on open, so history survives restart. Swap Pi's `SessionManager.inMemory()` for the file-backed variant (folds parked spike 007).

### Lean Prompt Baseline (locked by spikes — not re-discussed)
- **D-10:** Lean baseline prompt (~130 tok target) composed via `DefaultResourceLoader` with `noContextFiles: true` (kills the `CLAUDE.md`/`AGENTS.md` auto-inject tax), `noTools: "builtin"`, all mode tools registered via `customTools` then narrowed with `setActiveToolsByName`. The cost center is tool schemas, not prose.

### Claude's Discretion
- Minimal rail chat UI shape (composer, message list styling) — planner/UI may choose the leanest thing that renders a streamed reply; full ASST-01/02/03 polish stays Phase 6.
- Whether `thinking_delta` events are rendered or suppressed in the minimal panel.
- Sidecar launch mechanism for dev (spawn `node` from Rust on startup is fine; **bundled Tauri sidecar binary is deferred** with the milestone-wide packaging deferral — don't build production bundling here).
- Exact app-data session dir path and per-tool result truncation limits.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spike findings (primary — this phase IS these spikes' build-out)
- `.claude/skills/spike-findings-sourcerer/SKILL.md` — index + non-negotiable requirements
- `.claude/skills/spike-findings-sourcerer/references/harness-embedding.md` — Pi headless embed, `DefaultResourceLoader` gate, mode registry + runtime toggle, streaming events, token baselines, "what to avoid" (spikes 001/003/005)
- `.claude/skills/spike-findings-sourcerer/references/databasise-tools.md` — auto-generate Pi tools from live `/openapi.json`, query-vs-body split, `WORKING_DIR=./rag_storage`, whitelist the read surface (spike 002)
- `.claude/skills/spike-findings-sourcerer/references/omp-components.md` — mnemopi harvest pattern (deferred, but the pattern for adding Memory mode later)

### Parked spikes folding in as build work
- `.planning/spikes/MANIFEST.md` — spikes **006** (integrated-assistant-core), **007** (session-persistence → D-09), **008** (tauri-hostai-seam → the `host.ai()` proxy + streaming) are PARKED and fold into this phase as build work, not throwaway experiments.

### Databasise engine (external dependency)
- `D:\Vibe Coding\Databasise\runtime` — server launch: `WORKING_DIR=./rag_storage ../sourcerer-venv/Scripts/python.exe ../sourcerer-lightrag/sourcerer.py` (assume-running, D-06)
- Databasise REST lives in the fork's `version_routes.py`; read surface via `http://127.0.0.1:9621/openapi.json`

### Project docs
- `.planning/ROADMAP.md` §Phase 7 — original goal (this CONTEXT narrows it; see Phase Boundary)
- `.planning/REQUIREMENTS.md` — note: new `ASST-HARNESS-*` reqs are TBD; distinct from Phase 6's stub-based ASST-01/02/03
- `CLAUDE.md` §Constraints — `host.ai()` is the only AI seam; applets never bypass `host`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Tauri 2 + React 18 scaffold already shipped (Phase 1) — `src-tauri/` (Cargo, `tauri.conf.json`, capabilities) and the Vite/React front end exist. Phase 7 adds a **new sidecar dir** (none exists yet: no `sidecar/`, `assistant/`, `src-tauri/binaries/`).
- `@tauri-apps/api` already a dependency — use its Channel API for streaming deltas.

### Established Patterns
- `host.ai()` is the mandated single AI seam (CLAUDE.md / FWK-04). Phase 7 implements the real backend behind it; it must remain the only surface the webview uses to reach AI.
- No Node runtime is wired into the app yet — the Pi sidecar introduces the first Node process; Rust must spawn/own it and proxy `host.ai()` calls to it.

### Integration Points
- **Webview → Rust command (`host.ai()`) → Node Pi sidecar → stream back via Tauri Channel.** This is the spine (parked spike 008).
- **Node Pi sidecar → Databasise REST** at `127.0.0.1:9621` for Research mode tools (spike 002).
- Rail assistant panel (minimal, this phase) → `host.ai()`. Phase 6 later swaps its stubbed panel to the same seam.

</code_context>

<specifics>
## Specific Ideas

- User's framing verbatim: *"I want to wire as we go — I only want to wire Pi into the rail and make the messaging system work."* → chat-first, tools incremental.
- User explicitly wants **chat history working** ("how would we wire history as that is something I want working") → drove D-09 file-backed sessions.
- Research/wiki wiring explained and understood as the payoff: grounded, cited answers over the user's own 112-entity Databasise corpus vs. generic LLM chat.
- Default model from spikes: `cerebras/gpt-oss-120b` (resolves via `getModel("cerebras","gpt-oss-120b")`, api `openai-completions`).

</specifics>

<deferred>
## Deferred Ideas

- **Notes / Coding / Memory modes** — plumbing ships, tools added incrementally later ("as we go"). Not this phase.
- **mnemopi durable memory** (Bun HTTP sidecar) — the documented next mode; deferred to avoid the Bun runtime + optional native deps this phase.
- **Full multi-session switcher UI** (ASST-01 session list, proposals ASST-02, resize/snap ASST-03) — Phase 6. Phase 7 only persists sessions + renders the current one in a minimal panel.
- **Bundled Tauri sidecar binary / packaging** — dev-spawn now; production bundling folds into the milestone-wide packaging deferral.
- **Deliberate auth** for the Databasise sidecar beyond local guest-mode — revisit when shipping past local dev.

</deferred>

---

*Phase: 07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a*
*Context gathered: 2026-07-07*
