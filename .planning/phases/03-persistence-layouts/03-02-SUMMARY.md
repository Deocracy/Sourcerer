---
phase: 03-persistence-layouts
plan: 02
subsystem: persistence
tags: [tauri-plugin-store, persistence, dockview, zustand, crash-guard]
requires: ["03-01"]
provides:
  - "PERS-01 live end-to-end: whole workspace (dock tree + rail subset) persists on change and restores on launch via workspace.json"
  - "shellStore.hydrateFromDisk() + getRailSubset() — the rail half of the unified registerStateSources seam"
  - "Dock.tsx's single registerStateSources call site merging dock-tree + rail getters"
  - "restoreCanary crash-guard re-homed onto the workspace.json record (no localStorage)"
affects: [03-03, 03-04, 05-instance-state]
tech-stack:
  added: []
  patterns:
    - "seed-then-hydrate: shellStore seeds synchronously from DEFAULT_WORKSPACE.rail, then hydrateFromDisk() overwrites once the async load resolves"
    - "single registration call site (Dock.tsx) merges both getDockTree and getRail into one registerStateSources call so neither getter clobbers the other"
    - "async-restore-races-cleanup guard: dockApiRef identity check inside the mount effect's async IIFE and the 4s canary-clear timeout"
key-files:
  created:
    - src/store/shellStore.test.ts (rewritten — was Phase-2 localStorage suite)
  modified:
    - src/store/shellStore.ts
    - src/shell/Dock.tsx
key-decisions:
  - "Single registerStateSources call site lives in Dock.tsx's mount effect (not shellStore.ts) — shellStore.ts exports a getRailSubset() getter that Dock.tsx passes in alongside its own getDockTree, avoiding any change to workspaceStore.ts's registerStateSources signature (kept the file out of this plan's scope)"
  - "Canary clear at the 4s mark uses a direct saveWorkspaceRecord({...,restoreCanary:false}) call, not scheduleWorkspaceSave() — the debounced writer only ever copies the last-saved restoreCanary value from workspaceStore's in-memory mirror, so it cannot itself flip the flag from true to false"
  - "Effect cleanup sets a cancelled flag and every async continuation (the restore IIFE, the 4s canary-clear timeout) checks `dockApiRef.current === api` before touching the api or disk — prevents a raced unmount from restoring into a disposed dockview instance"
metrics:
  duration: ~25 min
  tasks: 2 (both auto)
  completed: 2026-07-09
---

# Phase 3 Plan 02: Wire Dock + shellStore into workspaceStore Summary

**One-liner:** Re-homed both Phase-2 localStorage scaffolds (`sourcerer-dockview-bespoke-v2` in Dock.tsx, `sourcerer-shell-store-v1` in shellStore.ts) onto 03-01's unified `workspace.json` record — dock tree and rail order/pins/mode/width now persist and restore through one debounced writer, with the crash-on-restore canary living on the record instead of a localStorage key.

## What Was Built

- **Task 1 (`568aa23`):** `src/store/shellStore.ts` — removed `LS_KEY`, `load()`, `persist()`, and the module-init `const saved = load()`. The store now seeds its persisted fields synchronously from `DEFAULT_WORKSPACE.rail` (imported from `../persistence/workspaceStore`) so first render is valid before disk hydration. Every rail-mutating action (`setRailMode`, `cycleRailMode`, `setRailWidth`, `reorderRail`, `togglePin`) now calls `scheduleWorkspaceSave()` instead of `persist(get)`. Added two new exports: `getRailSubset()` (a pure getter reading `shellStore.getState()`, handed to Dock.tsx's single registration call) and `hydrateFromDisk()` (an async function that awaits `loadWorkspaceRecord()` and `setState()`s the rail subset, including recomputing `railOpen`). Session-only fields (`activeCorpus`/`activePaneId`/`railApplet`/`badges`) stay untouched by both paths, exactly as the prior D-02 subset excluded them. Rewrote `shellStore.test.ts` (previously a Phase-2 localStorage-assertion suite) to mock `../persistence/workspaceStore` and cover: existing rail-action behavior (cycle/reorder/pin/badge, unchanged), `hydrateFromDisk()` restoring railMode/railWidth/railOrder/leftRailPinned (and railOpen) from a mocked record, and `setRailMode` triggering the `scheduleWorkspaceSave` spy exactly once.
- **Task 2 (`786769a`):** `src/shell/Dock.tsx` — removed `LAYOUT_KEY`/`CANARY_KEY` and the entire localStorage canary/restore/save block. Registers the single `registerStateSources({ getDockTree, getRail: getRailSubset })` call inside the mount effect, merging Dock's dock-tree snapshot getter with shellStore's rail getter at one call site so neither clobbers the other. Replaced the synchronous canary-guarded restore with an async IIFE: `await loadWorkspaceRecord()`, then if `record.restoreCanary` is already `true` the persisted `dockTree` is treated as poisoned and dropped (never re-applied); otherwise, if `dockTree` is non-null, `api.fromJSON(dockTree)` runs inside a try/catch, and success is judged by `api.panels.length > 0`. On successful restore, `saveWorkspaceRecord({...record, restoreCanary: true})` sets the crash guard immediately, and a `setTimeout` ~4s later clears it with a fresh `saveWorkspaceRecord({...,restoreCanary: false})` built from the *live* getters (`dockApiRef.current.toJSON()` / `getRailSubset()`) so a layout change during the 4s window isn't clobbered. On any failure/null/empty-panels path, `api.clear()` + `addApplet("Wiki")` + `addApplet("Library")` (D-05 default) runs, followed by one `scheduleWorkspaceSave()` to persist the freshly-opened default. `shellStore`'s `hydrateFromDisk()` is called from the same async IIFE so rail and dock tree hydrate together from one load. `onDidLayoutChange` now calls the single `scheduleWorkspaceSave()` writer — the old inline 300ms debounce timer is gone; the debounce now lives entirely in `workspaceStore.ts`. Effect cleanup sets a `cancelled` flag and every async continuation checks `dockApiRef.current === api` before touching disk or the dockview instance, guarding against the restore or canary-clear racing an unmount.

## Verification Evidence

- `npm test -- --run` → 7 files / 44 tests passed (no regressions; shellStore.test.ts rewritten and green)
- `npx tsc --noEmit` → exit 0
- `npm run build` (tsc + vite build) → exit 0
- `grep -q "localStorage" src/store/shellStore.ts` → no match (removed)
- `grep -q "localStorage" src/shell/Dock.tsx` → no match (removed)
- `grep -c "scheduleWorkspaceSave" src/store/shellStore.ts` → 7 (import + 5 action call sites + hydrate-adjacent context; exceeds the >=5 floor)
- `shellStore.ts` exports `hydrateFromDisk` and `getRailSubset`
- Wiki+Library default branch preserved verbatim in `Dock.tsx`'s failure/null path

## Deviations from Plan

**1. [Rule 3 - blocking] Single `registerStateSources` call site placed in Dock.tsx, not split across both files.** The plan's Task 1 action anticipated possibly needing `workspaceStore.registerStateSources` to accept a partial/mergeable shape ("simplest: workspaceStore.registerStateSources accepts a partial and merges"). Rather than widen `workspaceStore.ts`'s registration API (which is outside this plan's `files_modified` list), `shellStore.ts` instead exports a pure `getRailSubset()` getter and Dock.tsx — which already imports `shellStore` — makes the one `registerStateSources({ getDockTree, getRail: getRailSubset })` call inside its mount effect. This satisfies the plan's own fallback guidance ("pick one registration call site so neither getter clobbers the other") without touching `workspaceStore.ts`.

**2. [Rule 1 - bug] Canary clear-at-4s uses a direct `saveWorkspaceRecord` call, not a bare `scheduleWorkspaceSave()`.** The plan's Task 2 action says to clear the canary "via scheduleWorkspaceSave" — but `scheduleWorkspaceSave()`'s debounced flush rebuilds its record from `sources.getDockTree()`/`sources.getRail()` plus `workspaceStore`'s in-memory `restoreCanary`, which is whatever was last explicitly saved (`true`, set moments earlier). Calling only `scheduleWorkspaceSave()` at the 4s mark would therefore re-persist `restoreCanary: true` forever, defeating the crash-guard's whole purpose. Fixed by having the 4s timeout call `saveWorkspaceRecord({...,restoreCanary: false})` directly, using the live dock/rail getters so any layout change during the 4s window is preserved rather than overwritten with the stale `record` snapshot.

**3. [Rule 1 - bug] Guarded the async restore + canary-clear timeout against a raced unmount.** The plan flagged this risk explicitly ("guard against the effect cleanup racing the async restore"). Implemented via a `cancelled` flag plus `dockApiRef.current === api` identity checks at both the top of the async IIFE (after `await loadWorkspaceRecord()`) and inside the 4s canary-clear `setTimeout` callback, so a component unmount between scheduling and firing never touches a disposed dockview instance or writes stale state to disk.

## Threat Flags

None — the one new surface (`workspace.json` dockTree → `api.fromJSON` hydrate) was already in 03-02's threat model (T-03-01) and mitigated exactly as specified: the restoreCanary crash-guard plus try/catch around `fromJSON` with the Wiki+Library default fallback.

## Known Stubs

None — both consumers (Dock.tsx, shellStore.ts) are fully wired into the unified record; no placeholder or mock data paths remain in this slice.

## TDD Gate Compliance

Not applicable — this plan's tasks are `type="auto"` (not `tdd="true"`); no RED/GREEN gate sequence was required. `shellStore.test.ts` was rewritten alongside the implementation in the same commit (Task 1), consistent with the plan's non-TDD execution mode for this wave.

## Next

03-03 (per ROADMAP) is expected to build the LayoutsMenu UI (named layouts, save/apply/delete) and ResetNotice component over the `savedLayouts` slice this plan's writer already persists — both `Dock.tsx` and `shellStore.ts` are now clean of localStorage and ready for that slice to read/write through the same `workspaceStore.ts` seam.

## Self-Check: PASSED

- src/store/shellStore.ts: FOUND
- src/store/shellStore.test.ts: FOUND
- src/shell/Dock.tsx: FOUND
- commit 568aa23 (Task 1): FOUND
- commit 786769a (Task 2): FOUND
