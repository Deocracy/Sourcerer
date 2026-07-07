# Requirements — Sourcerer v1

Scope decided at init: pixel-perfect Tauri shell + applet framework + **Notes as the only real applet**. Databasise integration and the real AI backend are deliberately deferred (seams preserved).

## v1 Requirements

### Shell / Window (SHELL)

- [x] **SHELL-01**: User sees a frameless single window with the custom 34px title bar (logo, app name, active applet crumb) matching design tokens
- [ ] **SHELL-02**: User can minimize, maximize/restore, and close via the custom window controls (wired to Tauri window API), and drag the window by the title-bar spacer only — no button swallows clicks
- [x] **SHELL-03**: User sees crisp 1px borders and correct metrics at 100%/125%/150% Windows display scaling
- [x] **SHELL-04**: User sees IBM Plex Sans/Mono/Serif rendered from locally bundled fonts (no network font loading)

### Left Rail (RAIL)

- [ ] **RAIL-01**: User can cycle the rail between expanded / compact / hidden modes via the grip (drag, double-click) and ⌘\
- [ ] **RAIL-02**: User can reorder rail items by drag, pin items to the bottom group, and drag an item into the workspace to dock it as a new pane
- [ ] **RAIL-03**: User sees active-applet highlighting and badge counts per the design spec

### Workspace / Dock Tree (DOCK)

- [ ] **DOCK-01**: User can open applets in tabs; tab bars render per spec (34px, min-width 124px, active accent) with "+" to open an applet
- [ ] **DOCK-02**: User can drag tabs to reorder within a bar, move between bars, dock into 5 zones of a pane (center/left/right/top/bottom), and split the whole workspace at its edges — with the prototype's preview UI
- [ ] **DOCK-03**: User can resize splits via 5px resizers; closing the last tab of a pane prunes the tree correctly; empty tree renders Home
- [ ] **DOCK-04**: User can open multiple instances of one applet, each with a stable instance id
- [ ] **DOCK-05**: Keyboard input routes to the focused pane deterministically (explicit focus model: click/drag/close set focus predictably)
- [ ] **DOCK-06**: All pane/rail/assistant resizes clamp to explicit min/max bounds (values extracted from the prototype)

### Persistence & Layouts (PERS)

- [ ] **PERS-01**: The whole workspace (dock tree, rail order/pins, panel widths, open tabs, per-instance state) persists on change and restores on launch
- [ ] **PERS-02**: User can save, apply, and delete named layouts and reset to single pane via the LAYOUTS menu
- [ ] **PERS-03**: Persisted state carries a schemaVersion with a migration path; corrupt or stale state falls back to the default workspace without crashing (missing applet keys render placeholders)
- [ ] **PERS-04**: Writes are debounced and flushed on window close so abrupt termination cannot corrupt the store

### Applet Framework (FWK)

- [ ] **FWK-01**: Applets are TSX modules exporting `manifest {key, glyph, code, title, desc}` + `App({host})`; a static registry maps keys to modules
- [ ] **FWK-02**: A registered applet key replaces its demo stub; a new key appends to the rail
- [ ] **FWK-03**: Every unbuilt applet renders its high-fidelity demo stub (glyph tile, code crumb, serif title, demo rows) per spec
- [ ] **FWK-04**: `host` API is the only shell surface applets touch: `storage` (namespaced get/set/remove backed by tauri-plugin-store), `ai()` (single AI seam, stubbed v1), `open(appletKey)`, `instanceId`, `theme`

### Notes Applet (NOTE)

- [ ] **NOTE-01**: User can create, edit, and delete persistent notes in the Notes applet (stored via host.storage)
- [ ] **NOTE-02**: User can invoke AI summarize on a note through host.ai() (stub response in v1) — proving the full framework loop

### Dashboard Assistant (ASST)

- [ ] **ASST-01**: User sees the right-panel assistant (header, session list, message thread, composer) per spec and can send messages (⌘↵) receiving stubbed replies
- [ ] **ASST-02**: Assistant proposals render as serif-italic quote blocks with y/d/n keyboard actions on the focused proposal
- [ ] **ASST-03**: User can resize the assistant via its grip with snap-to-close and expand-to-fullscreen ("LET GO TO SNAP" cue)

### Home (HOME)

- [ ] **HOME-01**: Empty workspace renders the metro card dashboard with PINNED/FRESH/LIVING/ARCHIVE sections
- [ ] **HOME-02**: User can drag cards between sections with FLIP animation; assistant "＋MAKE CARD" mints a card

## v2 / Future

- Databasise engine integration (Wiki/Library/Graph applets over the real source-of-truth) — integration mode undecided
- Real AI backend behind host.ai() (provider undecided)
- Additional applets, one per milestone slice, each replacing its stub
- Command palette, multi-window, full a11y pass
- SQLite graduation (tauri-plugin-sql) when an applet needs relational data
- Installer/packaging (shipping-form milestone)

## Out of Scope

- Component libraries / Tailwind / DnD libraries — pixel-perfect bespoke design, prototype algorithms ported directly
- Dynamic/runtime plugin loading — static registry only until an Applet Builder milestone
- React 19 / unverified Vite majors — pin React 18.2.0, use tauri scaffold's Vite
- Google Fonts at runtime — fonts bundled locally

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHELL-01 | Phase 1 | Complete |
| SHELL-02 | Phase 1 | Pending |
| SHELL-03 | Phase 1 | Complete |
| SHELL-04 | Phase 1 | Complete |
| RAIL-01 | Phase 2 | Pending |
| RAIL-02 | Phase 2 | Pending |
| RAIL-03 | Phase 2 | Pending |
| DOCK-01 | Phase 2 | Pending |
| DOCK-02 | Phase 2 | Pending |
| DOCK-03 | Phase 2 | Pending |
| DOCK-04 | Phase 2 | Pending |
| DOCK-05 | Phase 2 | Pending |
| DOCK-06 | Phase 2 | Pending |
| PERS-01 | Phase 3 | Pending |
| PERS-02 | Phase 3 | Pending |
| PERS-03 | Phase 3 | Pending |
| PERS-04 | Phase 3 | Pending |
| FWK-01 | Phase 4 | Pending |
| FWK-02 | Phase 4 | Pending |
| FWK-03 | Phase 4 | Pending |
| FWK-04 | Phase 4 | Pending |
| NOTE-01 | Phase 5 | Pending |
| NOTE-02 | Phase 5 | Pending |
| ASST-01 | Phase 6 | Pending |
| ASST-02 | Phase 6 | Pending |
| ASST-03 | Phase 6 | Pending |
| HOME-01 | Phase 6 | Pending |
| HOME-02 | Phase 6 | Pending |
