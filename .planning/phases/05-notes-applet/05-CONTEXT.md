# Phase 5: Notes Applet - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 replaces the Notes templated stub with the first **real** applet: create/edit/delete
persistent notes (`host.storage`, NOTE-01) and AI summarize on a note (`host.ai()`, NOTE-02) —
proving the full registry → host → storage → ai loop end-to-end. One module swapped in
`registry.ts` (FWK-02 literally); the shell, framework, and all other stubs are untouched.

**Explicitly NOT in Phase 5:**
- Any shell/chrome/framework changes — Phase 4 contracts are consumed unchanged.
- Markdown rendering, rich text, tags, search, note linking, "graduate into the corpus" —
  future Notes evolutions, not v1 quick capture.
- Assistant↔applet cross-awareness, corpus tools in `host.ai()` — deferred (Phase 4 D-05/D-08).

**Note on NOTE-02 wording:** the roadmap's "stub response in v1" is superseded by Phase 4
D-01 — `host.ai()` routes to the **real Pi sidecar**. Summarize returns a real completion.

</domain>

<decisions>
## Implementation Decisions

*(User delegated all four discussed areas to Claude's judgment — decisions below are locked
so downstream agents don't re-open them.)*

### List ordering & delete flow
- **D-01: Most-recently-updated first.** Editing a note (title or body) bumps it to the top
  of the list. Standard quick-capture behavior; the relative timestamp in each row (UI-SPEC)
  reads as "last edited".
- **D-02: After delete, select the next note down** (the one that takes the deleted note's
  visual slot); if the deleted note was last, select the new last note; if the list is now
  empty, show the UI-SPEC empty state.

### AI summary persistence
- **D-03: Ephemeral.** The Summarize result is NOT persisted to storage. It renders inline
  (per UI-SPEC), is discarded when the user switches notes or closes the tab, and can be
  regenerated on demand. Keeps the storage schema lean and sidesteps stale-summary states;
  NOTE-02 only requires invoking the loop and rendering the response.

### Multi-tab behavior
- **D-04: Live mirror via one shared in-memory notes store.** The Notes module owns a single
  module-level store (vanilla zustand, matching the shell's established pattern) hydrated
  once from `host.storage` on first mount; every Notes instance subscribes to it. Two open
  Notes tabs mirror each other's edits instantly *by construction* — no polling, no
  refresh-on-focus machinery. Persistence is a debounced write of the store back through
  `host.storage` (host-only seam preserved — the store lives inside `src/applets/Notes/`
  and touches disk exclusively via the `host` API).
- **D-05: Same-note concurrent edits are last-write-wins.** Acceptable for a single-user
  desktop app; not worth conflict machinery.

### Per-tab memory
- **D-06: Selected note ID only** goes in the per-instance state slot (Phase 3 D-10 /
  Phase 4 D-14 surface). No scroll position, no cursor position.
- **D-07: Missing-note fallback is silent.** If the remembered note ID no longer exists
  (deleted from another tab, or GC'd instance state per Phase 4 CR-02), fall back to the
  first note in the list, or the empty state if there are none. Never an error.

### Claude's Discretion
- Notes storage shape under `host.storage` (single array under one key vs per-note keys) —
  planner/executor's call; single-blob is the expected lazy default at this data volume.
- Note ID generation (nanoid per stack doc), timestamp fields (created/updated), relative
  timestamp formatting.
- Untitled-note display label (e.g. "Untitled") in the list row.
- Summarize prompt text sent to `host.ai()`.
- Debounce interval for auto-save (mirror the shell's existing debounced-save pattern).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The locked UI contract (this phase's pixel source of truth)
- `.planning/phases/05-notes-applet/05-UI-SPEC.md` — **locked design contract**: two-pane
  layout (240px list + editor), tokens/typography/color mappings, all copy (empty state,
  errors, delete confirm, Summarize labels), auto-save on blur/debounce with no Save button,
  inline two-step delete confirm, summarize result as inline muted serif-italic block,
  no DEMO chip (Notes is real).

### Framework contracts consumed unchanged
- `.planning/phases/04-applet-framework/04-CONTEXT.md` — host.ai contract D-01..D-09
  (promise+onDelta, stateless one-shots, auto-cancel on unmount, errors reject), storage
  D-14..D-16 (shared applet storage + per-instance slot, async), registry D-17..D-19.
- `src/host/types.ts` — the `Host` / `AppletModule` / `AppletManifest` types Notes implements.
- `src/host/aiComplete.ts` — the promise wrapper Notes calls (120s inactivity timeout).
- `src/host/storage.ts` + `src/host/instanceState.ts` — the two storage surfaces (shared
  notes data vs per-tab selection).
- `src/applets/boundary.test.ts` — the host-only seam enforcement Notes must pass.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §Notes Applet — NOTE-01, NOTE-02 verbatim.
- `.planning/ROADMAP.md` §"Phase 5: Notes Applet" — goal + 2 success criteria (criterion 2's
  "stub response" superseded per Phase 4 D-01).

### Patterns & known caveats
- `.planning/phases/04-applet-framework/04-PATTERNS.md` — codebase patterns mapped for
  applet work.
- Phase 4 review caveat **CR-02**: layout-switch GC of instance state — Notes' selected-note
  restore must tolerate a GC'd/absent slot (covered by D-07's silent fallback).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/host/index.ts` `makeHost(instanceId, appletKey)` — the complete host Notes receives;
  nothing new to build in the framework.
- `src/applets/Wiki/`, `src/applets/Library/` — the two rich applets already registered;
  Notes follows their module/registration/CSS-Modules shape exactly.
- `src/applets/templated.ts` — the stub Notes replaces in the registry.
- `LayoutsMenu.tsx` / `LayoutsMenu.module.css` — the row, active-row, `.nameInput`, and
  `.delete` hover patterns the UI-SPEC explicitly mirrors.
- Vanilla zustand store pattern (`src/store/shellStore.ts`) — template for the Notes
  module-level shared store (D-04).

### Established Patterns
- Best-effort try/catch persistence — storage failures never crash or surface raw errors
  (UI-SPEC's "Not saved — retrying" inline treatment).
- Honest-degrade AI errors (Phase 7 D-06) — exactly one error, never a hang; UI-SPEC's
  summarize error copy implements it.
- CSS Modules + `tokens.css` only — zero new tokens, sizes, weights, or colors (UI-SPEC).

### Integration Points
- `src/applets/registry.ts` — swap Notes from templated stub to the real module (the whole
  point of the phase).
- `host.storage` (`applets.json`, keys `sourcerer:notes:*`) — notes data.
- Instance-state slot — per-tab selected note ID.
- `aiComplete` → Pi sidecar — Summarize.

</code_context>

<specifics>
## Specific Ideas

- Notes is deliberately the framework's proof-of-loop: the executor should change nothing
  outside `src/applets/Notes/` + the one registry line, and the boundary test must stay green.
- "Quick capture — scratch notes that can graduate into the corpus" (appletDefs line) is the
  product framing: fast, frictionless, auto-saving; graduation itself is future work.

</specifics>

<deferred>
## Deferred Ideas

- Markdown/rich-text rendering for note bodies — plain textarea in v1 (UI-SPEC).
- Persisted summaries / summary-staleness UX — revisit if summaries become a real feature
  rather than a loop proof.
- "Graduate note into the corpus" (Databasise ingest) — belongs to a Databasise-integration
  phase.
- Note search/tags/pinning — future Notes evolution if the applet earns it.

</deferred>

---

*Phase: 5-notes-applet*
*Context gathered: 2026-07-12*
