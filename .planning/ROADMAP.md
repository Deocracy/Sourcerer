# Roadmap: Sourcerer (Desktop Shell)

## Overview

Sourcerer is built shell-outward: a pixel-perfect frameless window comes first, then the dockable workspace and left rail (the highest-risk pointer-event port), then the persistence layer that makes layouts survive relaunch, then the applet framework and its demo stubs, then Notes as the one real applet that proves the whole loop, and finally the Dashboard Assistant and metro Home. Phases 1-5 are hard-sequential; the shell cannot dock without a window, cannot persist without a dock tree, cannot host applets without persistence, and cannot prove the loop without the framework. Phase 6 (Assistant + Home) depends only on the framework being in place and rounds out the shell.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Shell Foundation** - Frameless window, custom title bar, window controls, DPI-correct metrics, local fonts
- [ ] **Phase 2: Workspace Core** - Left rail (3 modes) + dock tree (tabs, 5-zone docking, splits, focus, clamps)
- [ ] **Phase 3: Persistence & Layouts** - Crash-safe workspace persistence, schema versioning, named layouts
- [ ] **Phase 4: Applet Framework** - Static registry, host API, high-fidelity demo stubs for every applet
- [ ] **Phase 5: Notes Applet** - First real applet proving registry → host → storage → ai seam
- [ ] **Phase 6: Dashboard Assistant & Home** - Stubbed AI assistant panel + metro Home dashboard

## Phase Details

### Phase 1: Shell Foundation

**Goal**: A frameless single window with a pixel-perfect custom title bar, working window controls, and correct rendering across Windows display scaling — the foundation every other phase mounts into.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04
**Success Criteria** (what must be TRUE):

  1. User sees a frameless single window with the custom 34px title bar (logo, app name, active-applet crumb) matching design tokens.
  2. User can minimize, maximize/restore, and close via the custom controls (wired to the Tauri window API), and drag the window only by the title-bar spacer — no button swallows clicks.
  3. Borders render as crisp 1px and metrics stay correct at 100% / 125% / 150% Windows display scaling.
  4. IBM Plex Sans/Mono/Serif render from locally bundled fonts with no network font loading.

**Plans**: 3 plansPlans:
**Wave 1**

- [ ] 01-01-PLAN.md — Scaffold Tauri+React18 app, frameless/shadowless window, seed tokens.css + fonts + grid, RED test harness

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 01-02-PLAN.md — Title bar + window controls slice (turns SHELL-01/02 specs green, verifies local-only fonts)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-03-PLAN.md — Human-verify checkpoints: real frameless render + drag behavior + 1px/34px crispness at 100/125/150% DPI

**UI hint**: yes

### Phase 2: Workspace Core

**Goal**: A fully interactive dockable workspace — the three-mode left rail and the dock tree with tabs, 5-zone docking, splits, multi-instance, and deterministic focus — ported near-1:1 from the prototype's pointer-event algorithms.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: RAIL-01, RAIL-02, RAIL-03, DOCK-01, DOCK-02, DOCK-03, DOCK-04, DOCK-05, DOCK-06
**Success Criteria** (what must be TRUE):

  1. User can cycle the rail between expanded / compact / hidden via the grip (drag, double-click) and ⌘\, reorder items, pin to the bottom group, and drag an item into the workspace to dock it as a new pane.
  2. User can open applets in tabs (34px bars, "+" to open), drag tabs to reorder within a bar and move between bars, and dock into the 5 zones (center/left/right/top/bottom) plus edge-split with the prototype's preview UI.
  3. User can resize splits via 5px resizers within explicit min/max clamp bounds; closing the last tab of a pane prunes the tree correctly, and an empty tree renders Home.
  4. User can open multiple instances of one applet each with a stable instance id, and keyboard input routes deterministically to the focused pane (click/drag/close set focus predictably).
  5. Active-applet highlighting and per-item badge counts render per the design spec.

**Plans**: TBD
**UI hint**: yes

### Phase 3: Persistence & Layouts

**Goal**: The workspace remembers itself — the whole dock/rail/tab state persists crash-safely, survives schema drift, and users can save and switch named layouts without ever losing or corrupting their workspace.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: PERS-01, PERS-02, PERS-03, PERS-04
**Success Criteria** (what must be TRUE):

  1. The whole workspace (dock tree, rail order/pins, panel widths, open tabs, per-instance state) persists on change and restores on launch.
  2. User can save, apply, and delete named layouts and reset to a single pane via the LAYOUTS menu.
  3. Corrupt or stale persisted state falls back to the default workspace without crashing, and missing applet keys render placeholders.
  4. Writes are debounced and flushed on window close so abrupt termination cannot corrupt the store (schemaVersion + migration path carried).

**Plans**: TBD
**UI hint**: yes

### Phase 4: Applet Framework

**Goal**: The plugin contract that makes Sourcerer "part demo, part working app" — a static registry, the single `host` API seam, and a high-fidelity demo stub for every unbuilt applet, with the module signature finalized before any real applet exists.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: FWK-01, FWK-02, FWK-03, FWK-04
**Success Criteria** (what must be TRUE):

  1. A registered applet key (a TSX module exporting `manifest {key, glyph, code, title, desc}` + `App({host})`) replaces its demo stub, and a new key appends to the rail.
  2. Every unbuilt applet renders its high-fidelity demo stub (glyph tile, code crumb, serif title, demo rows) per spec.
  3. Applets touch the shell only through the `host` API — namespaced `storage` (get/set/remove via tauri-plugin-store), `ai()` (single stubbed seam), `open(appletKey)`, `instanceId`, and `theme` — with no other surface reachable.

**Plans**: TBD
**UI hint**: yes

### Phase 5: Notes Applet

**Goal**: One real applet, Notes, that exercises the entire framework loop end-to-end (registry → host → storage → ai seam) and proves a stub can be replaced by working functionality.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: NOTE-01, NOTE-02
**Success Criteria** (what must be TRUE):

  1. User can create, edit, and delete persistent notes in the Notes applet that survive relaunch (stored via host.storage).
  2. User can invoke AI summarize on a note through host.ai() and receive a stub response — proving the full registry → host → storage → ai loop.

**Plans**: TBD
**UI hint**: yes

### Phase 6: Dashboard Assistant & Home

**Goal**: The shell's two remaining first-class surfaces — the persistent right-hand Dashboard Assistant (against the stubbed AI seam) and the metro Home dashboard — complete the pixel-perfect experience.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: ASST-01, ASST-02, ASST-03, HOME-01, HOME-02
**Success Criteria** (what must be TRUE):

  1. User sees the right-panel assistant (header, session list, message thread, composer) per spec and can send messages (⌘↵) receiving stubbed replies.
  2. Assistant proposals render as serif-italic quote blocks with y/d/n keyboard actions on the focused proposal.
  3. User can resize the assistant via its grip with snap-to-close and expand-to-fullscreen ("LET GO TO SNAP" cue).
  4. Empty workspace renders the metro card dashboard with PINNED / FRESH / LIVING / ARCHIVE sections.
  5. User can drag cards between sections with FLIP animation, and the assistant "＋MAKE CARD" action mints a card.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Shell Foundation | 0/3 | Not started | - |
| 2. Workspace Core | 0/TBD | Not started | - |
| 3. Persistence & Layouts | 0/TBD | Not started | - |
| 4. Applet Framework | 0/TBD | Not started | - |
| 5. Notes Applet | 0/TBD | Not started | - |
| 6. Dashboard Assistant & Home | 0/TBD | Not started | - |
