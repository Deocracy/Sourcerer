---
phase: 02-workspace-core
plan: 06
subsystem: ui
tags: [rail-drag-out, dockview-core, pointer-events, drop-zones, d-01, d-03-revision, human-verify]

# Dependency graph
requires:
  - phase: 02-workspace-core
    provides: "Rail.tsx + useRailDrag.ts (plan 02-04): row pointer-drag pattern (5px threshold, setPointerCapture), getVisualRailOrder"
  - phase: 02-workspace-core
    provides: "Dock.tsx (plan 02-05): the single dockview-core instance, addApplet `${key}:${nanoid()}` panel-id convention, appletDefs"
provides:
  - "dockZones.ts: pure resolveDropZone(point, groupRects) — 28% edge bands -> left/right/above/below split, 44% center -> tab-join, outside -> null; deterministic corner precedence"
  - "useRailDragOut.ts: bespoke pointer drag-out bridging rail rows -> dockview api.addPanel (via addAppletToDock), with within-rail reorder retained and a guaranteed new-tab fallback"
  - "RailDragGhost.tsx: floating cursor ghost (glyph+title, #131418/#26272B) + DropZoneOverlay (green 28%/44% zone preview, rgba(134,163,140,0.18) fill, #86A38C border)"
  - "Dock.tsx module-scope seam: getDockGroupRects() (live group bounding rects) + addAppletToDock(key, position?) over the one dockview instance"
  - "D-03 REVISED (UAT-gate user decision): card fills the OS window — 20px floating inset CUT; 10px radius + 1px border at the true window edge (windowed), square edge-to-edge when maximized"
affects: [Rail, Dock, App-window-chrome, phase-03-persistence, phase-04-applets]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure zone-math module (dockZones.ts) takes precomputed rects, never DOM — same testability split as railSnap.ts vs useRailDrag.ts"
    - "Module-scope api handle (dockApiRef) as the seam between bespoke pointer logic and the single dockview instance — no second dockview, no prop/context threading for a singleton"
    - "position:fixed pointer-events:none ghost/overlay layers rendered from Rail's fragment, tracking the viewport independent of pane transforms"
    - "Rust on_window_event set_resizable(false) in place while maximized (never un/re-maximize — tao maximize() no-ops on non-resizable windows); useMaximizedState sequences async isMaximized() queries so stale answers can't overwrite newer state"

key-files:
  created:
    - src/shell/dockZones.ts
    - src/shell/dockZones.test.ts
    - src/shell/useRailDragOut.ts
    - src/shell/RailDragGhost.tsx
    - src/shell/RailDragGhost.module.css
  modified:
    - src/shell/Dock.tsx
    - src/shell/Rail.tsx
    - src/App.tsx
    - src/App.module.css
    - src-tauri/src/lib.rs
    - src-tauri/capabilities/default.json

key-decisions:
  - "D-03 REVISED at the UAT gate (user decision, orchestrator-committed): the 20px floating-window inset is CUT. Systematic bisection proved the reported 'maximize halo' was the D-03 design itself in WINDOWED mode (transparent margin = dark halo, resize grips 20px outside the visible card, click-through band). The card now IS the window: 10px radius + 1px border at the true window edge windowed; square edge-to-edge maximized. Doc: 02-06-BUG-maximize-halo.md."
  - "Drop-zone corner precedence: closest-edge distance wins, ties break left/right before above/below (stable array order) — deterministic and unit-tested rather than prototype-copied."
  - "Dock exposes its api via a module-scope ref (getDockGroupRects/addAppletToDock) instead of React context — the shell has exactly one dockview instance, and the drag-out hook reuses the same addPanel path as the '+' button (no second panel-creation codepath)."
  - "useRailDragOut supersedes useRailDrag's row-drag surface (reorder logic reimplemented over the same shared getVisualRailOrder) while useRailDrag keeps resize/keyboard-cycling/pin — one gesture owner per row, no double pointer-capture."
  - "Exact 28% band boundary classifies as center (strict less-than), locked by a unit test."

patterns-established:
  - "resolveLiveZone wraps live-rect resolution in try/catch returning null — any zone-computation failure degrades to the new-tab fallback (T-02-10), never a blocked drop"
  - "Overlay geometry mirrors the same 28%/44% band fractions resolveDropZone classified with, so preview and drop always agree"

requirements-completed: [RAIL-02, DOCK-02]

# Metrics
duration: ~40min (code tasks) + UAT gate session (halo bisection + D-03 revision, orchestrator)
completed: 2026-07-08
---

# Phase 2 Plan 06: Rail Drag-Out to Dock (D-01) Summary

**Rail rows now drag out past the rail's right edge into dockview as new panels with the full bespoke preview — floating glyph+title ghost, green 28%-edge/44%-center drop overlay resolved by a pure unit-tested `resolveDropZone`, dockview `api.addPanel({position:{referenceGroup,direction}})` on drop, and a guaranteed new-tab fallback — verified by the consolidated Phase 2 human UAT (PASSED), during which the D-03 floating inset was cut by user decision.**

## Performance

- **Duration:** ~40 min for Tasks 1–2; Task 3 (human-verify) spanned a UAT session including the maximize-halo bisection and D-03 revision
- **Completed:** 2026-07-08
- **Tasks:** 3 (2 auto — one TDD, 1 checkpoint:human-verify)
- **Files modified:** 7 planned + 4 during the UAT-gate design revision

## Accomplishments

- `dockZones.ts` — pure `resolveDropZone(point, groupRects)`: finds the containing group rect, classifies the point into an outer 28% edge band (→ `left`/`right`/`above`/`below`) or the center 44% region (→ tab-join, `direction: undefined`); returns `null` outside all rects. Deterministic corner precedence (closest edge, stable tie-break). 9 unit tests green, no DOM access.
- `useRailDragOut.ts` — extends the rail row gesture (5px threshold, `setPointerCapture`): crossing past the rail's right edge switches into docking mode (ghost + overlay); `pointerup` in a resolved zone calls `addAppletToDock(key, {referenceGroup, direction})`; unresolved zone or any thrown error during zone computation falls back to a plain new-tab `addAppletToDock(key)` (T-02-10). Within-rail reorder retained via the shared `getVisualRailOrder`.
- `RailDragGhost.tsx` + module.css — `position:fixed` cursor ghost (`#131418` bg, `#26272B` border, glyph+title) and `DropZoneOverlay` (fill `rgba(134,163,140,0.18)`, border `#86A38C`) whose geometry mirrors the same 28%/44% fractions the resolver used.
- `Dock.tsx` — module-scope seam over the single dockview instance: `getDockGroupRects()` (live `api.groups` → `element.getBoundingClientRect()`) and `addAppletToDock(key, position?)`; the `+` button now delegates to the same helper. Ref cleared on dispose.
- `Rail.tsx` — wires `useRailDragOut` as the row-drag owner (merged nav refs with `useRailDrag`, which keeps resize/keyboard/pin), renders ghost + overlay from a fragment.
- **Consolidated human-verify PASSED** — all nine workspace checks (rail modes/resize/reorder/pin, dock tabs/5-zone docking/splits, rail drag-out ghost + green overlay + fallback, multi-instance/focus, prune, persistence + corruption fallback). Persistence-corruption fallback (#9) and the `+` action were additionally auto-verified in-browser by the orchestrator before the human pass.

## Task Commits

1. **Task 1: Pure drop-zone math (28%/44%) + tests** — `c294243` (test, TDD)
2. **Task 2: Drag-out hook + ghost + green overlay + addPanel (with fallback)** — `fd366fb` (feat)
3. **Task 3: Human-verify** — PASSED (no code commit; see UAT-gate revision commits below)

**UAT-gate design-revision commits** (orchestrator, already on master — recorded here, not redone):
- `8ea7423` fix(02-06): collapse floating-window chrome when maximized
- `6c2aa57` fix(02-06): disable window resizability while maximized (kills WS_THICKFRAME edge)
- `1de91d3` fix(02-06): grant `core:window:allow-set-resizable` capability
- `07212cc` fix(02-06): native maximize-kick + sequenced isMaximized queries (kick later reverted)
- `03eb0e4` fix(02-06): drop resize frame in place on maximize — no un/re-maximize kick
- `52e371e` fix(02-06): card fills window — cut the 20px floating inset (user decision)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- [d:\Vibe Coding\Sourcerer\src\shell\dockZones.ts](src/shell/dockZones.ts) - Pure `resolveDropZone` zone math (28% edges / 44% center / null)
- [d:\Vibe Coding\Sourcerer\src\shell\dockZones.test.ts](src/shell/dockZones.test.ts) - 9 boundary/corner/multi-group unit tests
- [d:\Vibe Coding\Sourcerer\src\shell\useRailDragOut.ts](src/shell/useRailDragOut.ts) - Drag-out gesture hook bridging rail rows → dockview addPanel, with reorder + fallback
- [d:\Vibe Coding\Sourcerer\src\shell\RailDragGhost.tsx](src/shell/RailDragGhost.tsx) - Floating ghost + green drop-zone overlay components
- [d:\Vibe Coding\Sourcerer\src\shell\RailDragGhost.module.css](src/shell/RailDragGhost.module.css) - Fixed-position ghost/overlay styling (D-01 colors)
- [d:\Vibe Coding\Sourcerer\src\shell\Dock.tsx](src/shell/Dock.tsx) - Exposes `getDockGroupRects` + `addAppletToDock` seam over the one dockview instance
- [d:\Vibe Coding\Sourcerer\src\shell\Rail.tsx](src/shell/Rail.tsx) - Wires useRailDragOut; renders ghost/overlay
- [d:\Vibe Coding\Sourcerer\src\App.tsx](src/App.tsx) + [d:\Vibe Coding\Sourcerer\src\App.module.css](src/App.module.css) - D-03 revision: card fills the window (orchestrator commits)
- [d:\Vibe Coding\Sourcerer\src-tauri\src\lib.rs](src-tauri/src/lib.rs) - on_window_event in-place set_resizable toggling on maximize/restore (orchestrator commits)
- [d:\Vibe Coding\Sourcerer\src-tauri\capabilities\default.json](src-tauri/capabilities/default.json) - `core:window:allow-set-resizable` (orchestrator commits)

## Decisions Made

- **D-03 revision (user decision at the UAT gate):** the floating 20px inset is cut — card fills the OS window (10px radius + 1px border at the true window edge windowed; square edge-to-edge maximized). See key-decisions and `02-06-BUG-maximize-halo.md`.
- Corner precedence = closest-edge distance with a stable left/right-before-above/below tie-break; exact 28% boundary classifies as center.
- Dock's api exposed as a module-scope handle (not context) since the shell has exactly one dockview instance; drag-out reuses the `+` button's panel-creation path.
- `useRailDragOut` owns the row gesture end-to-end (reorder + drag-out); `useRailDrag` keeps resize/keyboard/pin — one pointer-capture owner per row.

## Deviations from Plan

### Design revision during Task 3 (human-verify gate)

**1. [User decision — D-03 revised] The 20px floating-window inset was cut after the "maximize halo" bug hunt closed as a design root cause**
- **Found during:** Task 3 consolidated human-verify (Phase 2 UAT gate)
- **Issue:** The reported "halo + odd edge-resize" was the D-03 floating-stage design itself in WINDOWED mode — the transparent 20px margin rendered as a dark halo, put resize grips 20px outside the visible card edge, and ate clicks aimed at windows behind. Systematic component bisection (React fully off → lime page proved native innocent; on-screen DEV state badge proved isMaximized/CSS correct) forced the reframe from "maximize bug" to "windowed-mode design defect." Full chain: [d:\Vibe Coding\Sourcerer\.planning\phases\02-workspace-core\](.planning/phases/02-workspace-core/) → 02-06-BUG-maximize-halo.md.
- **Resolution:** User decision — card fills the window (inset removed; 10px radius + 1px border at the true window edge; maximized collapses square edge-to-edge). Kept supporting fixes: Rust `on_window_event` drops WS_THICKFRAME in place while maximized (never un/re-maximize — tao `maximize()` no-ops on non-resizable windows) + `core:window:allow-set-resizable` capability; `useMaximizedState` sequences async `isMaximized()` queries.
- **Files modified:** src/App.tsx, src/App.module.css, src-tauri/src/lib.rs, src-tauri/capabilities/default.json
- **Commits:** `8ea7423`..`52e371e` (orchestrator; listed above)
- **Downstream impact:** CLAUDE.md's "floating rounded window (20px inset + radial backdrop)" constraint is now superseded by this decision; Phase 1's D-03 chrome spec is historical.

Code tasks 1–2 themselves executed exactly as written — no auto-fix deviations.

## Issues Encountered

- Task 2's node verify-gate requires the literal string `addPanel` in `useRailDragOut.ts`; the hook calls it via the `addAppletToDock` wrapper, so the doc comment explicitly names the wrapped `api.addPanel({position:{referenceGroup,direction}})` call. Cosmetic; gate passes.

## User Setup Required

None.

## Next Phase Readiness

- Phase 2 (workspace-core) is functionally complete pending phase-level verification: all 6 plans executed, consolidated UAT passed.
- Phase 3 (persistence) inherits the `sourcerer-dockview-bespoke-v2` localStorage scaffolding (canary + debounce) to replace with the real crash-safe/versioned `tauri-plugin-store` contract.
- Phase 4 applets replace `PanelBody`'s generic placeholder per-key; the `+` button gains the Applet Catalog picker.
- The D-03 revision means any future chrome work targets the card-fills-window model, not the floating inset.

## Known Stubs

- Carried from 02-04/02-05 (unchanged): `openCatalog()`/`openSettings()` console stubs; `+` cycles appletDefs keys (Applet Catalog picker is Phase 4); `PanelBody` generic placeholder is the only panel body.

## Threat Flags

None beyond the plan's own register. T-02-10 mitigated exactly as specified (pure unit-tested `resolveDropZone`; live-rect resolution wrapped in try/catch → new-tab fallback). T-02-07 accepted as planned (single captured pointer, bounded overlay redraw, listeners removed on pointerup). No new network/auth/trust-boundary surface.

## Self-Check: PASSED

- Files verified on disk: src/shell/dockZones.ts, src/shell/dockZones.test.ts, src/shell/useRailDragOut.ts, src/shell/RailDragGhost.tsx, src/shell/RailDragGhost.module.css, src/shell/Dock.tsx, src/shell/Rail.tsx
- Commits verified in git log: c294243 (test, Task 1), fd366fb (feat, Task 2), 8ea7423/6c2aa57/1de91d3/07212cc/03eb0e4/52e371e (UAT-gate revision, orchestrator)
- Gates: `npx vitest run` 33/33 → 37/37 after orchestrator commits; `tsc --noEmit` clean; `npm run build` succeeds; Task 2 node string-gate OK

---
*Phase: 02-workspace-core*
*Completed: 2026-07-08*
