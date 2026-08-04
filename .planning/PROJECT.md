# Sourcerer (Desktop Shell)

## What This Is

A Tauri 2 desktop application: a dockable multi-pane research workbench for scholars. The shell hosts **applets** (Library, Wiki, Graph, Chat, Notes, Writing Studio, Power Browser, Kanban, News, KeyPass, Databasise, Applet Builder…) plus a persistent right-hand **Dashboard Assistant** (AI chat panel). Part demo, part working application: every applet not yet built renders as a high-fidelity demo stub, and applets are implemented one at a time by registering into the applet framework, replacing their stub.

As of v1.0 the shell is fully interactive end-to-end: frameless window, dockable workspace, crash-safe persistence, applet framework with Notes as the real proving applet, metro Home dashboard, and a Dashboard Assistant backed by a **real** headless Pi sidecar behind `host.ai()`.

The **Databasise engine** (the existing Cozo+LightRAG wiki source-of-truth project at `D:\Vibe Coding\Databasise`, with REST + MCP surfaces) is a required core component of Sourcerer long-term — it will power the Wiki/Library/Graph applets. Its integration mode is deliberately deferred (see Key Decisions).

## Core Value

A pixel-perfect, fully interactive desktop shell where the applet framework demonstrably works end-to-end — one real applet (Notes) proves the loop (registry → host API → storage → AI seam), and every other applet is a believable stub ready to be replaced.

## Source of Truth (Design)

**`design-sync-setup-guide/design_handoff_bespoke_rails_shell/`** (adopted wholesale 2026-07-07, supersedes the original `design_handoff_sourcerer_tauri/` handoff):
- `Sourcerer Bespoke Rails.dc.html` — the working prototype built around the locked libraries (dockview-core, zustand, dnd-kit); rail/assistant resize + toggle behavior is the UX reference.
- `home-cards.js` etc. — Home dashboard card registry/renderers (ported verbatim in Phase 6).
- Tokens: 40px title bar, green `#86A38C` accent, IBM Plex, 0 border-radius inside, 10px radius on the outer window card only.

## Stack (shipped in v1.0)

- Tauri 2 (Rust backend), single frameless window (`transparent: true`, 10px card), custom title bar wired to window API
- React 18 + Vite + TypeScript; no component library; bespoke styling from design tokens
- dockview-core 2.0.0 (center dock) + dnd-kit (Home cards) + bespoke pointer events (rail/assistant resize)
- zustand 5.0.14 shell store; IBM Plex Sans/Mono/Serif bundled locally (OFL)
- Persistence: `tauri-plugin-store` (workspace.json + applets.json) mapping onto `host.storage`; graduate to SQLite when applets need real data
- `host.ai()` → Rust Tauri command → Node Pi sidecar (`@earendil-works/pi-coding-agent`), NDJSON streaming over a Channel; model zai-glm-4.7

## Current Milestone: v2.0 Container Platform

**Goal:** A non-technical scholar on a clean Windows 11 machine installs Sourcerer from the Microsoft Store (or signed site installer), gets a working NixOS-WSL substrate after at most one reboot, sees engine-backed functionality live (Notes, assistant, first Databasise wiki read-view served from the substrate), installs catalog apps (Collabora, Jupyter) as hardened engine-less OCI units with visible security scores, reverts a bad update with one button, and migrates their whole environment to a second PC via manifest + data export.

**Target features:**
- Flake foundation + CI + binary cache (assurance chain: nothing publishes that CI didn't prove)
- Custom NixOS-WSL substrate: Store/signed-site install flow, ≤1 reboot, kill switch, secrets plumbing, substrate-connection seam (auth surface stubbed)
- Update channel with one-button revert; real `security.csp` (the v1.0 null-CSP acceptance expires here)
- Engine services in substrate (Databasise — LightRAG disassembled into it, no separate dep; OCR deferred to an installable applet) and harness relocation; first engine-backed wiki read-view
- App layer: manifest→NixOS-module compiler, panes via multiwebview, security scores, engine-less OCI units
- Community store pipeline (cosign-signed, CVE-gated, privileged auto-reject) — not publicly opened until P8 passes
- Tools tier + environment export/import ("Move to another PC")
- Permission grants UI + portal file access; hardening close + milestone audit

**Key context:** Two-host milestone — NixOS is the dev host; every WSL-dependent leg executes and UATs on the Windows box; every phase states its execution host. Plan source: `.planning/research/CONTAINER-PLATFORM-PLAN.md` + `CONTAINER-PLATFORM.md` (verifier-revised, spikes 010/011 validated). Wall-clock roughly doubles vs v1.0 (wait-dominated).

**Setup options (delivery channels):**
1. Windows 11 — Microsoft Store install (v2.0)
2. Windows 11 — signed site installer (v2.0)
3. macOS — site DMG (later)
4. Linux — tarball/AppImage + `nix run` (later)
5. Hosted cloud — browser client, per-tenant substrate (committed, own milestone)

## Requirements

### Validated

- ✓ Frameless Tauri window with custom title bar (minimize/maximize/close, drag region, DPI-correct 1px borders, local fonts) — v1.0 Phase 1
- ✓ Left rail: expanded/compact/hidden modes, drag-resize grip, reorder/pin/drag-out-to-dock — v1.0 Phase 2 (+ live-relayout fix in Phase 6 gap closure)
- ✓ Workspace dock tree: tabs, 5-zone docking, splits with resizers, edge-split, multi-instance tabs — v1.0 Phase 2 (dockview-core)
- ✓ Named layouts + full workspace persistence restored on launch, crash-safe, corrupt-fallback — v1.0 Phase 3
- ✓ Applet framework: registry loader, `host` API (storage/ai/open/instanceId/theme), demo stubs for all unbuilt applets — v1.0 Phase 4
- ✓ Notes as the first real applet (persistent notes + AI summarize via the seam) — v1.0 Phase 5
- ✓ Dashboard Assistant panel: sessions, thread, composer, proposals UI (y/d/n), resize/snap — v1.0 Phase 6
- ✓ Home: metro card dashboard with draggable sections, FLIP animation, assistant ＋MAKE CARD mint — v1.0 Phase 6
- ✓ Assistant harness: headless Pi sidecar behind `host.ai()`, streamed replies, honest degrade, history survives restart — v1.0 Phase 7

### Active

(None — define with `/gsd-new-milestone`.)

### Out of Scope

- Databasise engine integration (live Wiki/Library/Graph data) — integration mode undecided; applets stay stubs
- All other applets beyond Notes — stubs only, built one at a time in later milestones
- Installer/packaging polish — later shipping-form milestone

## Context

Shipped v1.0 (2026-07-14): 7 phases, 35 plans, ~15.9k LOC (TS/TSX/Rust/CSS), 203 tests green, 9-day build (2026-07-06 → 2026-07-14).
Recurring lesson (struck in Phases 3, 4, 5, 6): green unit suites hide wiring bugs — the code-review gate catches criticals every phase; live human UAT catches what jsdom can't (pointer/drag feel).
Known debt at close (STATE.md Deferred Items): Phase 5 Notes has 3 never-run human UAT scenarios; v1.0 milestone audit skipped by user; rail-resize polish deferred; Phase 6 Info review findings open; `/gsd-secure-phase 3` outstanding.

- Prior related work: the Databasise engine project (formerly named Sourcerer) at `D:\Vibe Coding\Databasise` — Python/Cozo/LightRAG, 27-tool MCP + REST, v3.0 shipped. This app is its human GUI in the long-term "one server, two clients" vision.
- User owns runtime config (providers/models/keys); don't interrogate runtime choices.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri 2 + React 18 + Vite + TS, no component library | Handoff recommendation; bespoke pixel-perfect design | ✓ Good — shipped v1.0 pixel-faithful |
| Notes is the only real applet in v1 | Proves the whole applet-framework loop with minimal scope | ✓ Good — full loop proven incl. live AI summarize |
| Databasise integration mode (sidecar vs external server vs later) | **Deliberately undecided by user** — decide at its own milestone | — Deferred |
| `host.ai()` backend | Originally "stub in v1" — Phase 7 shipped a real headless Pi sidecar instead | ✓ Good — real streamed replies, honest degrade, history persistence |
| Port prototype dock/rail algorithms near-1:1 | Proven sound in the interactive prototype | ⚠ Revised — center dock adopted dockview-core, Home cards dnd-kit; only rail/assistant stayed bespoke (2026-07-06/07 decision) |
| Adopt `bespoke_rails_shell` handoff wholesale | Working prototype around the locked libraries | ✓ Good — Phase 2 reworked Phase 1 chrome to match |
| Cut the 20px floating-stage inset | Halo/grip/click-eating on a real desktop window | ✓ Good — card fills window, 10px radius at true edge |
| Debug exe must build with `--features tauri/custom-protocol` | Plain `cargo build` loads devUrl → "refused to connect" | ✓ Good — documented launch landmine |
| D-P1: AGPL license | Strong copyleft before any public repo / Store submission | — Decided 2026-08-03 |
| D-P2: privileged/docker-api-class store submissions auto-rejected, no appeal in v1 | Minimize triage burden and attack surface | — Decided 2026-08-03 |
| D-P3: Axis-3 blessed (system-flake + profile-tier split) | As recorded in CONTAINER-PLATFORM.md | — Decided 2026-08-03 |
| D-P4: Determinate Nix pin | Installer reliability, flakes default | — Decided 2026-08-03 |
| D-P5: hosted/cloud committed as its own milestone after Platform v1 | Auth-surface interface lands in P2 (stubbed); business track confirmed | — Decided 2026-08-03 |
| Two-host milestone: NixOS dev host + Windows box for WSL legs/UAT | Dev moved to NixOS; WSL substrate premise stands | — Decided 2026-08-03 |
| Phase numbering continues from 8 | GSD default; globally unique across milestones | — Decided 2026-08-03 |

## Constraints

- **Pixel-perfect fidelity** to the bespoke_rails_shell tokens/metrics (40px title bar, green #86A38C accent, IBM Plex type scale, 0 border-radius inside, 1px borders)
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
*Last updated: 2026-08-03 — milestone v2.0 Container Platform started*
