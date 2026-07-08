---
phase: 02-workspace-core
plan: 05
subsystem: ui
tags: [dockview-core, tabs, docking, panel-dispatch, css-tokens, react-dom-client]

# Dependency graph
requires:
  - phase: 02-workspace-core
    provides: "shellStore (plan 02-01): setRailApplet/setActivePaneId session-only actions"
  - phase: 02-workspace-core
    provides: "AppShell body-row structure (plan 02-03/02-04): full-width TitleBar, Rail as left sibling, AssistantPanel as right sibling, .main as the dock-host column"
  - phase: 02-workspace-core
    provides: "Rail.tsx's railDefs map (plan 02-04) — extracted into the shared appletDefs.ts this plan introduces"
provides:
  - "appletDefs.ts: shared {glyph,title,line} applet metadata map, single source of truth for Rail.tsx and Dock/PanelBody"
  - "PanelBody.tsx: generic placeholder body component + makeRenderer dockview content-renderer factory (React root mounted into a plain DOM element)"
  - "Dock.tsx: themed dockview-core mount (.sourcerer-dock --dv-* map), '+' tab-bar action (fresh instance per click, cycles appletDefs keys), canary-guarded restore + Wiki/Library default + 300ms debounced persist, onDidActivePanelChange as sole focus source of truth"
  - "AppShell mounts <Dock /> into .main; .main is now the dock's positioning context (position:relative, overflow:hidden)"
affects: [Rail, appletDefs, PanelBody, Dock, AppShell, plan-02-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "dockview-core mounted imperatively in a useEffect (createDockview + dispose on cleanup), matching the useMaximizedState.ts native-event-bridging idiom already established in this codebase"
    - "createComponent dispatcher returns a plain DOM element with a React root (createRoot) mounted inside it and unmounted on dispose — dockview-core (not the @dockview/react wrapper) only understands raw DOM IContentRenderer objects, so React is bridged manually per panel"
    - "'+' tab-bar action wired via createRightHeaderActionComponent (dockview's own extension point), not a bespoke overlay button"
    - "Canary-key crash-detection + try/catch fromJSON + Wiki/Library default + 300ms debounced onDidLayoutChange persist, ported near-verbatim from the .dc.html prototype's initDock, scoped to D-02 (no schemaVersion/migrations/tauri-plugin-store)"

key-files:
  created:
    - src/shell/appletDefs.ts
    - src/shell/PanelBody.tsx
    - src/shell/PanelBody.module.css
    - src/shell/Dock.tsx
    - src/shell/Dock.module.css
  modified:
    - src/shell/Rail.tsx
    - src/app/AppShell.tsx
    - src/app/AppShell.module.css

key-decisions:
  - "addApplet(key) always creates a fresh `${key}:${nanoid()}` panel instance (no existing-panel-activate check), diverging from the .dc.html prototype's addApplet (which activates an existing same-key panel instead of adding a new one). This directly satisfies DOCK-04's 'multiple instances of one applet coexist' truth and matches the plan Task 2 wording ('Add an addApplet(key) helper using panel id ${key}:${nanoid()} so multiple instances coexist') more literally than the ported prototype's single-instance-per-key behavior."
  - "The '+' tab-bar action has no Applet Catalog picker (that UI is Phase 4 scope, matching Rail.tsx's openCatalog() stub) — it cycles through appletDefs' keys in Object.keys() order on each click. This is a deliberate placeholder interaction that still satisfies UI-SPEC's literal spec ('\"+\" button opens a new applet in the active group') without inventing Phase 4's picker UI early."
  - "No `position` option passed to api.addPanel() calls — confirmed against the installed dockview-core@2.0.0 source (dockviewComponent.js addPanel: omitting `position` defaults `referenceGroup = this.activeGroup` with direction 'within') that this is dockview's own default 'add as a new tab in the active group' behavior, exactly matching DOCK-01's requirement with zero extra config."
  - "PanelBody's makeRenderer mounts a react-dom/client createRoot into a fresh plain DOM element per panel, since dockview-core (the vanilla/framework-agnostic package, not @dockview/react) only accepts IContentRenderer objects with a raw HTMLElement — this is the necessary bridge, not an alternate/simpler option."
  - "Dock's outer .host (position:relative, 100%/100%) wraps an inner .mount (position:absolute, inset:0) that is the actual ref passed to createDockview, per UI-SPEC's literal 'position:absolute; inset:0' requirement; AppShell's .main was given position:relative + overflow:hidden as the positioning/clipping context this wrapper needs."

patterns-established:
  - "Dockview lifecycle fully owned inside one useEffect with a single cleanup function disposing every subscription (layout, focus) and the api itself — mirrors useMaximizedState.ts's try/catch + cleanup-return shape for imperative external-library bridging"
  - "Shared *Defs.ts metadata maps as the canonical way multiple UI surfaces (rail rows, dock panel titles/placeholder bodies) stay in sync on applet glyph/title/description"

requirements-completed: [DOCK-01, DOCK-02, DOCK-03, DOCK-04, DOCK-05, DOCK-06]

# Metrics
duration: ~35min
completed: 2026-07-08
---

# Phase 2 Plan 05: Dockview Center Dock Summary

**Mounted dockview-core as the themed center workspace — `.sourcerer-dock` `--dv-*` overrides on the `dockview-theme-abyss` base, a `+` tab-bar action that opens fresh per-click applet instances via `key:nanoid()` ids, canary-guarded `fromJSON` restore with a Wiki/Library default and 300ms debounced `toJSON()` persist, and `onDidActivePanelChange` as the single focus source of truth feeding `shellStore`.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-08
- **Tasks:** 3 (all `type="auto"`)
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments
- `appletDefs.ts` extracted as the single `{glyph, title, line}` metadata source; `Rail.tsx` now imports/re-exports it (`railDefs = appletDefs`) instead of inlining its own 13-entry map, with identical keys/glyphs preserved.
- `PanelBody.tsx` renders the UI-SPEC generic placeholder (mono "APPLET · {TITLE}" eyebrow, 44px glyph tile + serif title, description line, `1px dashed` note box) via CSS Modules (no inline `cssText`), plus a `makeRenderer(key)` factory bridging dockview's raw-DOM `IContentRenderer` contract to a React root.
- `Dock.tsx` mounts `createDockview` in a `useEffect`, themes it via `dockview-theme-abyss sourcerer-dock`, wires a `+` tab-bar action (`createRightHeaderActionComponent`) that always creates a fresh `${key}:${nanoid()}` panel instance in the active group, restores a canary-guarded saved layout (or defaults to Wiki + Library when missing/corrupt/empty), persists `toJSON()` 300ms-debounced on every layout change, and routes `onDidActivePanelChange` into `shellStore.setRailApplet`/`setActivePaneId`.
- `Dock.module.css` carries the full 19-variable `--dv-*` theme map copied verbatim from UI-SPEC, plus the glyph-only `+` button styling.
- `AppShell.tsx` mounts `<Dock />` into `.main`; `.main` gained `position:relative; overflow:hidden` as Dock's absolute-positioning/clipping context. Full-width `TitleBar`, left `Rail`, and right `AssistantPanel` were untouched per the plan's invariants.

## Task Commits

Each task was committed atomically:

1. **Task 1: appletDefs + PanelBody dispatcher + generic placeholder** - `2de21f6` (feat)
2. **Task 2 + Task 3 combined: Dock mount/theme/+/focus + canary restore/persist** - `f069f0b` (feat) — both tasks landed in the same `Dock.tsx` file edit session (Task 3 extends the exact effect Task 2 created), committed together as one coherent Dock-integration commit rather than an artificial mid-file split.

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- [d:\Vibe Coding\Sourcerer\src\shell\appletDefs.ts](src/shell/appletDefs.ts) - Shared `{glyph,title,line}` applet metadata map (13 entries)
- [d:\Vibe Coding\Sourcerer\src\shell\PanelBody.tsx](src/shell/PanelBody.tsx) - Generic placeholder body component + `makeRenderer` dockview content-renderer factory
- [d:\Vibe Coding\Sourcerer\src\shell\PanelBody.module.css](src/shell/PanelBody.module.css) - Token-driven placeholder styling (eyebrow, glyph tile, serif title, dashed note box)
- [d:\Vibe Coding\Sourcerer\src\shell\Dock.tsx](src/shell/Dock.tsx) - dockview-core mount, theme class, `+` action, canary restore, debounced persist, focus wiring
- [d:\Vibe Coding\Sourcerer\src\shell\Dock.module.css](src/shell/Dock.module.css) - Full `--dv-*` theme map + `.addButton`/`.host`/`.mount` layout classes
- [d:\Vibe Coding\Sourcerer\src\shell\Rail.tsx](src/shell/Rail.tsx) - Refactored to import `appletDefs` instead of inlining its own map
- [d:\Vibe Coding\Sourcerer\src\app\AppShell.tsx](src/app/AppShell.tsx) - Mounts `<Dock />` inside `.main`
- [d:\Vibe Coding\Sourcerer\src\app\AppShell.module.css](src/app/AppShell.module.css) - `.main` gained `position:relative; overflow:hidden`

## Decisions Made
- `addApplet(key)` always creates a fresh instance (no existing-panel-activate short-circuit) — see key-decisions above for the DOCK-04 rationale.
- `+` button cycles `appletDefs` keys rather than opening an Applet Catalog picker (Phase 4 scope).
- Confirmed dockview-core's own `addPanel` default (no `position` supplied) already targets the active group, so no extra positioning logic was needed for "opens in the active group."
- React bridged into dockview's raw DOM renderer via `react-dom/client`'s `createRoot`/`unmount`, since dockview-core (not `@dockview/react`) has no native React integration.

## Deviations from Plan

None — plan executed exactly as written. (Only nuance: Task 2 and Task 3 both edit `Dock.tsx`'s same mount effect and were committed as one commit rather than two, since Task 3 is a direct extension of Task 2's effect body rather than a separable file/feature; this is a commit-grouping choice, not a scope change — both tasks' acceptance criteria are independently verified by their respective automated gates, both of which passed.)

## Issues Encountered
None. `tsc --noEmit` clean; `npx vitest run` passes 24/24 (5 test files, +1 test vs. the 02-04 baseline of 23 — no regressions); `npm run build` succeeds; all three plan verify-script node assertions pass.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Plan 02-06's consolidated human-verify can now exercise real docking: 5-zone drag/drop, tab drag-reorder, the `+` button opening new instances, dockview's native resizers, and a real page-reload restore round-trip against `sourcerer-dockview-bespoke-v2`.
- `makeRenderer`'s `else -> generic placeholder` branch is the proven mounting seam Phase 4 replaces per-key (Wiki -> mountWiki, Library -> mountLibrary, etc.) without touching `Dock.tsx`'s lifecycle/theme/restore code.
- Rail-item drag-out-to-dock (the `.dc.html` reference's high-risk D-01 slice) remains explicitly out of scope for this phase, per `02-PATTERNS.md`'s own flag — Rail and Dock are not yet cross-wired beyond both reading/writing the same `shellStore` fields.

## Known Stubs
- `Dock.tsx`'s `+` action cycles through `appletDefs` keys rather than opening a real Applet Catalog picker — intentional Phase 2 scope limit (Applet Catalog UI is Phase 4), documented above under Decisions Made. Not a regression risk: DOCK-01's literal requirement ("+ opens a new applet in the active group") is satisfied regardless of which key is chosen.
- `PanelBody.tsx`'s placeholder is the only body ever rendered this phase — real Wiki/Library/Notes bodies are Phase 4/5 scope, per UI-SPEC's own note ("Phase 2 only needs the dispatcher and the generic placeholder body").

## Threat Flags

None beyond the plan's own `<threat_model>` register (T-02-01, T-02-08, T-02-09), all of which were mitigated exactly as specified (canary-guarded restore, 300ms debounce, split-on-`:` dispatch fallback). No new network endpoints, auth paths, or trust-boundary-relevant surface was introduced.

## Self-Check: PASSED
- Files verified on disk: src/shell/appletDefs.ts, src/shell/PanelBody.tsx, src/shell/PanelBody.module.css, src/shell/Dock.tsx, src/shell/Dock.module.css, src/shell/Rail.tsx, src/app/AppShell.tsx, src/app/AppShell.module.css
- Commits verified in git log: 2de21f6 (feat, Task 1), f069f0b (feat, Tasks 2+3)

---
*Phase: 02-workspace-core*
*Completed: 2026-07-08*
