# Sourcerer (Desktop Shell)

## What This Is

A Tauri 2 desktop application: a dockable multi-pane research workbench for scholars. The shell hosts **applets** (Library, Wiki, Graph, Chat, Notes, Writing Studio, Power Browser, Kanban, News, KeyPass, Databasise, Applet Builder…) plus a persistent right-hand **Dashboard Assistant** (AI chat panel). Part demo, part working application: every applet not yet built renders as a high-fidelity demo stub, and applets are implemented one at a time by registering into the applet framework, replacing their stub.

The **Databasise engine** (the existing Cozo+LightRAG wiki source-of-truth project at `D:\Vibe Coding\Databasise`, with REST + MCP surfaces) is a required core component of Sourcerer long-term — it will power the Wiki/Library/Graph applets. Its integration mode is deliberately deferred (see Key Decisions).

## Core Value

A pixel-perfect, fully interactive desktop shell where the applet framework demonstrably works end-to-end — one real applet (Notes) proves the loop (registry → host API → storage → AI seam), and every other applet is a believable stub ready to be replaced.

## Source of Truth (Design)

`Design sync setup guide/design_handoff_sourcerer_tauri/` — high-fidelity handoff:
- `reference/Working Sourcerer UX UI Prototype.dc.html` + `support.js` — interactive behavioral spec (open in browser). Dock-tree/rail/drag algorithms are plain React inside the file; port near-1:1.
- `reference/applets/README.md` — the applet framework contract (authoritative): `manifest {key, glyph, code, title, desc}` + `App({React, host})`; `registry.js` keys replace stubs.
- README.md — tokens, metrics, interactions. **Fidelity: pixel-perfect. Colors/type/spacing final. border-radius 0 everywhere.**

## Stack (from handoff, accepted)

- Tauri 2 (Rust backend), single frameless window (`decorations: false`), custom title bar wired to window API
- React 18 + Vite + TypeScript; no component library; bespoke styling from design tokens
- IBM Plex Sans/Mono/Serif bundled locally (OFL)
- Persistence: `tauri-plugin-store` (JSON) mapping onto `host.storage`; graduate to SQLite (`tauri-plugin-sql`) when applets need real data
- `host.ai()` implemented as a Tauri command proxy — the single AI seam; backend TBD

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Frameless Tauri window with custom title bar (minimize/maximize/close wired to window API, drag region)
- [ ] Left rail: expanded/compact/hidden modes, drag-resize grip, reorder/pin/drag-out-to-dock
- [ ] Workspace dock tree: tabs, 5-zone docking, splits with resizers, edge-split, multi-instance tabs
- [ ] Dashboard Assistant panel: sessions, thread, composer, proposals UI, resize/snap (against stubbed AI seam)
- [ ] Home: metro card dashboard with draggable sections and FLIP animation
- [ ] Named layouts + full workspace persistence (dock tree, rail order/pins, widths, open tabs) restored on launch
- [ ] Applet framework: registry loader, `host` API (storage/ai/open/instanceId/theme), demo stubs for all unbuilt applets
- [ ] Notes as the first real applet (persistent notes + AI summarize via the seam)

### Out of Scope (v1)

- Databasise engine integration (live Wiki/Library/Graph data) — integration mode undecided; applets stay stubs
- Real AI backend behind `host.ai()` — undecided; stub responses in v1, seam kept intact
- All other applets beyond Notes — stubs only, built one at a time in later milestones
- Installer/packaging polish — later shipping-form milestone

## Context

- Greenfield repo; only the design handoff exists in the folder.
- Prior related work: the Databasise engine project (formerly named Sourcerer) at `D:\Vibe Coding\Databasise` — Python/Cozo/LightRAG, 27-tool MCP + REST, v3.0 shipped. This app is its human GUI in the long-term "one server, two clients" vision.
- User owns runtime config (providers/models/keys); don't interrogate runtime choices.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri 2 + React 18 + Vite + TS, no component library | Handoff recommendation; bespoke pixel-perfect design | — Pending |
| Notes is the only real applet in v1 | Proves the whole applet-framework loop with minimal scope | — Pending |
| Databasise integration mode (sidecar vs external server vs later) | **Deliberately undecided by user** — decide at its own milestone | — Deferred |
| `host.ai()` backend | **Deliberately undecided by user** — stub in v1, seam preserved | — Deferred |
| Port prototype dock/rail algorithms near-1:1 | Proven sound in the interactive prototype | — Pending |

## Constraints

- **Pixel-perfect fidelity** to the handoff tokens/metrics (colors, IBM Plex type scale, 34px bars, 0 border-radius, 1px borders)
- No Google Fonts at runtime — bundle fonts locally
- Applets never bypass the `host` API; `host.ai()` is the only AI seam
- Demo stubs must persist for every unbuilt applet (the "part demo" half is a feature, not debt)

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-06 after initialization*
