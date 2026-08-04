# Phase 1: Shell Foundation - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the frameless single window and its pixel-perfect **34px custom title bar** — logo/wordmark cluster + "·" + active-applet crumb (left), a flex drag-spacer, and the three native window controls (right) — plus DPI-correct 1px metrics and locally-bundled IBM Plex fonts. Requirements **SHELL-01, SHELL-02, SHELL-03, SHELL-04**.

This is also the project's **first build**: the repo is not yet scaffolded (no `package.json` / `src-tauri`), so Phase 1 stands up the Tauri 2 + React 18 + Vite + TS app from scratch.

**Explicitly NOT in Phase 1** (per UI-SPEC "Phase Boundary Note"): the "◱ LAYOUTS" menu button, the rail-cycle button, and the assistant-toggle button. The spacer's flex-basis simply absorbs the space they will occupy in Phases 2/3/6 — no placeholder chrome. No dock tree, no rail, no applets, no persistence, no state store.
</domain>

<decisions>
## Implementation Decisions

### Foundation depth (discussed — the one gray area not settled by UI-SPEC/CLAUDE.md)
- **D-01:** **Seed the shared foundation now.** Phase 1 builds the title bar + empty body AND establishes (a) the app-shell CSS grid `grid-template-rows: 34px 1fr` that every later phase mounts into, and (b) a full `tokens.css` file exposing *all* UI-SPEC colors, metrics, spacing, and type tokens as CSS custom properties — not just the title-bar subset. Rationale: UI-SPEC already enumerates every token, so authoring `tokens.css` in full is nearly free, avoids a throwaway title bar rebuilt in Phase 2, and gives Phases 2-6 a real foundation. **Discipline holds:** still a thin slice — no logic, no Zustand store, no rail/dock, no applet code in Phase 1.

### State store timing (Claude's discretion — default accepted)
- **D-02:** **Phase 1 stays stateless.** Track maximized/restored state via Tauri's window events (listen for maximize/unmaximize) and drive the maximize↔restore icon + aria-label from actual window state; the crumb is a static "Home" literal. Do **not** introduce Zustand in Phase 1 — defer it to Phase 2 where the dock tree actually needs a shell store. (CLAUDE.md scopes Zustand to `dockTree`/rail/widths, none of which exist yet.)

### Scaffold reconciliation (Claude's discretion — default accepted)
- **D-03:** Scaffold fresh with `npm create tauri-app@latest` (React + TS template). **Keep the generated build/dev-loop wiring** (Vite config, `tauri.conf.json` schema, `beforeDevCommand`) — treat the scaffolder's Vite/plugin-react versions as source of truth, do **not** hand-pick Vite 8. **Delete only** the demo UI (sample `App.tsx`, `greet` command, demo assets). **Explicitly pin `react`/`react-dom` to 18.2.x and `@types/react{,-dom}` to ^18** in `package.json` (do not accept a React 19 default). Bundle `@fontsource/ibm-plex-{sans,mono,serif}` via per-weight subpath imports only (budget: Sans 400/500/600 · Mono 400/500 · Serif 400 + 400-italic); confirm zero runtime requests to `fonts.googleapis.com`/`fonts.gstatic.com`.

### Claude's Discretion
- Window control glyph implementation (`—` / 10×10px 1px-border square div / `✕`), hover color shifts, and the logo circle SVG are fully specified by UI-SPEC — implement as written, no further decision needed.
- Folder structure for the seeded foundation (where `tokens.css`, the app-shell component, and window-control components live) is the planner's call, following CLAUDE.md's CSS-Modules + single-`tokens.css` recommendation.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract (LOCKED — pixel-perfect, recreate exactly)
- `.planning/phases/01-shell-foundation/01-UI-SPEC.md` — the full Phase 1 visual/interaction contract: title-bar tokens, colors, glyphs, hover states, drag-region rule, DPI + font platform notes, and the Phase Boundary Note (which chrome to omit). **Authoritative for every visual/interaction decision in this phase.**
- `design-sync-setup-guide/design_handoff_sourcerer_tauri/README.md` — the LOCKED upstream design handoff (source of truth the UI-SPEC extracts from). Note: folder name contains spaces.
- `reference/design_handoff_sourcerer_tauri/` — handoff assets referenced by UI-SPEC.

### Reference prototype (read-only — port algorithms/metrics, do NOT port its Google Fonts `<helmet>` links)
- `reference/Working Sourcerer UX UI Prototype.dc.html` §lines 26-78 — the `TITLE BAR` block the UI-SPEC's metrics are drawn from.

### Stack & constraints
- `CLAUDE.md` (project root) "Technology Stack" / "What NOT to Use" — Tauri 2.11.x + React 18.2.0 (pinned, NOT 19) + Vite (scaffold's version, NOT hand-picked 8) + TS; `tauri-plugin-store` for later persistence; no component library, no Tailwind, no DnD lib. Also the `tauri dev` vs `cargo run` launch-invocation note.
- `.planning/REQUIREMENTS.md` §SHELL-01..04 — the four requirements this phase closes.
- `.planning/ROADMAP.md` §"Phase 1" — goal + 4 success criteria.

### Open research flags (for gsd-phase-researcher — NOT user decisions)
- `.planning/STATE.md` §Blockers/Concerns:
  - **[Phase 1 verify]** Confirm PerMonitorV2 DPI awareness so crisp 1px borders + 34px bar hold at Windows 100%/125%/150% scaling (verify `tauri.conf.json` does not force `dpiAware: false`; no `0.5px` physical-pixel hacks).
  - **[Scaffold]** Verify the sibling Databasise project's `cargo run` vs `cargo tauri dev` launch landmine does not reproduce in this fresh scaffold; determine the reliable dev-loop invocation early.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **None in-repo yet** — the app is unscaffolded. The reference prototype (`reference/Working Sourcerer UX UI Prototype.dc.html`) provides the title-bar markup/metrics to port, but it is a no-bundler single-file HTML demo, not importable code.

### Established Patterns
- Per CLAUDE.md: **CSS Modules (`*.module.css`) + a single `tokens.css`** for pixel-perfect token-driven styling; **native Pointer Events** (not a DnD library) for later drag work; **static ES-module registry** pattern for later applets. Phase 1 establishes the `tokens.css` half of this (D-01).

### Integration Points
- Phase 1's app-shell grid (`34px 1fr`) is the mount point for Phase 2 (dock tree fills the `1fr` body) and Phase 6 (Home dashboard in the empty body). Keep the body a flat `#0A0A0B` `1fr` row with no border/placeholder — do not render a "coming soon" message.
- Window controls wire directly to the Tauri window API (`appWindow.minimize()` / `toggleMaximize()` / `close()`); `data-tauri-drag-region` on the spacer only.
</code_context>

<specifics>
## Specific Ideas

- Founder confirmed the phase is intentionally spec-cleared and delegated all implementation calls to the builder except foundation depth (D-01, chosen: seed the foundation). No "I want it like X" overrides beyond what UI-SPEC already locks.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (The omitted title-bar chrome — LAYOUTS/rail/assistant buttons — is not deferred *ideation*; it is already scoped to Phases 2/3/6 by the roadmap and UI-SPEC Phase Boundary Note.)
</deferred>

---

*Phase: 1-shell-foundation*
*Context gathered: 2026-07-06*
