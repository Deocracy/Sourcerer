---
phase: 03-persistence-layouts
plan: 04
subsystem: persistence + shell
tags: [tauri-plugin-store, persistence, zustand, dockview, react, tdd]

requires:
  - phase: 03-persistence-layouts (03-01)
    provides: "WorkspaceRecordV1 schema, savedLayouts slice, scheduleWorkspaceSave/loadWorkspaceRecord"
  - phase: 03-persistence-layouts (03-02)
    provides: "Dock/shellStore wired end-to-end into workspaceStore; registerStateSources seam"
provides:
  - "layouts.ts: saveLayout/applyLayout/deleteLayout/resetToDefault over the savedLayouts slice (PERS-02)"
  - "LayoutsMenu.tsx: LAYOUTS ▾ title-bar dropdown, mounted before RailToggleButtons (D-01)"
  - "workspaceStore.ts: getCurrentRecord/setSavedLayouts/restoreDockTree accessors + getSavedLayouts/subscribeSavedLayouts reactive seam"
  - "Dock.tsx: restoreDockTree StateSources hook reusing the mount-effect's try/catch-guarded api.fromJSON + Wiki/Library-default fallback (T-03-01)"
affects: [05-instance-state]

tech-stack:
  added: []
  patterns:
    - "mutate-then-persist idiom: every layouts.ts op mutates the in-memory record (or triggers a live restore) then calls the single scheduleWorkspaceSave() writer — never an inline disk write per action"
    - "useSyncExternalStore + a bare listener Set as the minimal reactive seam for a non-Zustand slice (savedLayouts), avoiding a second store"
    - "optional StateSources field (restoreDockTree?) so a plan that widens the registration seam doesn't need to touch the prior plan's registerStateSources call signature"

key-files:
  created:
    - src/persistence/layouts.ts
    - src/persistence/layouts.test.ts
    - src/shell/LayoutsMenu.tsx
    - src/shell/LayoutsMenu.module.css
    - src/shell/LayoutsMenu.test.tsx
  modified:
    - src/persistence/workspaceStore.ts
    - src/shell/Dock.tsx
    - src/shell/TitleBar.tsx

key-decisions:
  - "restoreDockTree implemented as an OPTIONAL field on StateSources (not a signature change to registerStateSources) so 03-02's existing Dock.tsx registration call keeps type-checking without modification to its shape — only Dock.tsx's registerStateSources call site itself was edited to add the new field"
  - "getCurrentRecord() reads the LIVE dockTree/rail getters when a consumer (Dock.tsx) is registered, falling back to the in-memory mirror otherwise — guarantees saveLayout() never captures a stale pre-debounce snapshot"
  - "List order is most-recently-saved-first via Object.values(savedLayouts).reverse() — savedLayouts is a plain insertion-ordered Record (no timestamp field needed), matching 03-UI-SPEC.md's discretion default"
  - "Per-row delete is an immediate click (no two-click confirm) — the plan's Task 2 <action> text specifies a direct onClick calling deleteLayout(id); 03-UI-SPEC.md's two-click alternative is explicitly conditional ('if the checker requires') and not exercised here"
  - "resetToDefault() restores dock/rail but leaves savedLayouts entirely untouched (D-03) — it never calls setSavedLayouts"

requirements-completed: [PERS-02]

duration: ~40min
completed: 2026-07-09
---

# Phase 3 Plan 04: Named Layouts (LAYOUTS ▾ dropdown) Summary

**One-liner:** A `LAYOUTS ▾` title-bar dropdown backed by `layouts.ts`'s save/apply/delete/reset operations over the unified `workspace.json` record's `savedLayouts` slice — the phase's one net-new UI surface, live end-to-end.

## What Was Built

- **Task 1 (RED `f7f970d`, GREEN `73d9279`):** `src/persistence/layouts.ts` exporting `saveLayout(name)`, `applyLayout(id)`, `deleteLayout(id)`, `resetToDefault()`. Each mutates the in-memory record (via new `workspaceStore.ts` accessors `getCurrentRecord()`/`setSavedLayouts()`) or triggers a live dock restore (via a new `restoreDockTree()` seam), then calls the single `scheduleWorkspaceSave()` writer — never an inline disk write. `applyLayout` restores BOTH the dock tree (through `restoreDockTree`, which delegates to a hook Dock.tsx registers) and the rail subset (`shellStore.setState`). `resetToDefault` reuses `DEFAULT_WORKSPACE` and never touches `savedLayouts` (D-03). Wired `Dock.tsx`'s `registerStateSources` call with a `restoreDockTree` hook that reuses the exact try/catch-guarded `api.fromJSON` + Wiki/Library-default fallback shape already proven in the mount-effect restore (T-03-01) — required for `applyLayout`/`resetToDefault` to functionally restore the live dock, not just type-check. `layouts.test.ts` (6 tests) mocks the workspaceStore seam and proves all four behaviors, including that `resetToDefault` leaves `savedLayouts` intact and `applyLayout` rehydrates rail state.
- **Task 2 (`4ed86e9`):** `src/shell/LayoutsMenu.tsx` — a `useState`-driven open/closed dropdown (no popover library, net-new UI per 03-PATTERNS.md/03-UI-SPEC.md). Trigger `LAYOUTS ▾` (aria-label "Layouts menu") styled like `DiviChip`'s chip. Panel: one row per saved layout (most-recently-saved-first, hover-revealed delete "×", active-layout accent left-border + label), "No saved layouts yet" empty state, and a footer with `Save current…` (inline text input, Enter confirms/Escape cancels) and `Reset`. Dismiss via click-outside, Escape, or re-clicking the trigger. Keyboard: arrow up/down moves row focus, Enter applies the focused row, Delete/Backspace deletes it. Mounted in `TitleBar.tsx` between the drag spacer and `<RailToggleButtons />` (D-01), without disturbing the single-drag-region invariant `TitleBar.test.tsx` asserts. Added a minimal `getSavedLayouts()`/`subscribeSavedLayouts()` pub/sub seam to `workspaceStore.ts` (Rule 2 — LayoutsMenu needs to reactively pick up saves/deletes AND the boot-time disk-load resolution, and no existing store binding covers the non-Zustand `savedLayouts` slice) consumed via `useSyncExternalStore`.

## Verification Evidence

- `npm test -- --run src/persistence/layouts.test.ts` → 6/6 passed
- `npm test -- --run src/shell/LayoutsMenu.test.tsx` → 7/7 passed
- Full suite → 9 files / 60 tests passed (no regressions; `TitleBar.test.tsx`'s single-drag-region assertion still passes)
- `npx tsc --noEmit` → exit 0
- `npm run build` → exit 0
- `grep -c "scheduleWorkspaceSave" src/persistence/layouts.ts` → 6 (>= 4 floor)
- `grep -q "data-tauri-drag-region" src/shell/LayoutsMenu.tsx` → no match (trigger is not a drag region)
- `grep -c "No saved layouts yet" src/shell/LayoutsMenu.tsx` → 1 (empty-state copy verbatim)
- `<LayoutsMenu />` appears exactly once in `TitleBar.tsx`'s JSX, before `<RailToggleButtons />`

## Deviations from Plan

**1. [Rule 2 - missing critical functionality] Extended `workspaceStore.ts` beyond the plan's `files_modified` list.** The plan's Task 1 action explicitly anticipated this ("add a small `getCurrentRecord()`/`setSavedLayouts()` accessor to workspaceStore.ts if one is not already exported") and Task 2's action anticipated the dock-restore seam ("if Dock exposes a `restoreDockTree(json)` function use it; otherwise add a minimal exported restore hook in Dock and register it through workspaceStore, interface-first"). Implemented: `getCurrentRecord()`, `setSavedLayouts()`, `restoreDockTree()` (delegating export) plus the `StateSources.restoreDockTree` optional field, and — for Task 2 — `getSavedLayouts()`/`subscribeSavedLayouts()` so `LayoutsMenu.tsx` re-renders on save/delete/disk-load without a manual refresh (not explicitly named in the plan's action text, but required for the plan's own "read savedLayouts reactively so new saves appear without a manual refresh" instruction).

**2. [Rule 2 - missing critical functionality] Modified `src/shell/Dock.tsx`, not listed in this plan's `files_modified`.** The plan's Task 1 action explicitly sanctions this ("otherwise add a minimal exported restore hook in Dock and register it through workspaceStore, interface-first") as the fallback when Dock has no existing `restoreDockTree(json)` export (it didn't). Added a `restoreDockTree` field to Dock's `registerStateSources({ getDockTree, getRail })` call, implemented by reusing the mount-effect's existing try/catch `api.fromJSON` + `api.clear()` + Wiki/Library-default-open logic verbatim (same shape, not a new mechanism) — required for `applyLayout`/`resetToDefault` to actually restore the live dockview instance; without it `tsc` would still pass (the seam degrades to a safe no-op returning `false`) but the dropdown's apply/reset actions would silently fail to affect the dock.

**3. [Rule 1 - bug] Fixed a `vi.hoisted` ordering bug in `layouts.test.ts` after the RED commit.** The first draft declared a top-level `const DEFAULT_WORKSPACE` outside the `vi.hoisted(() => ...)` block that also backed the `vi.mock` factory; since `vi.mock` factories are hoisted above all other top-level statements, this threw `ReferenceError: Cannot access 'DEFAULT_WORKSPACE' before initialization` on the first GREEN run. Fixed by moving `DEFAULT_WORKSPACE` inside the same `vi.hoisted()` call as the other mock fns. This fix was folded into the Task 2 commit (`4ed86e9`) since it was caught while re-running the suite after Task 1's GREEN commit had already landed.

## Threat Flags

None — the one new trust boundary (a saved layout's `dockTree`/`rail` is untrusted-on-restore JSON, same shape as the primary record) was already in this plan's own threat model (T-03-01) and mitigated exactly as specified: `restoreDockTree`'s Dock.tsx implementation reuses the try/catch-guarded `api.fromJSON` path with the Wiki+Library default fallback, never crashing the dock on a bad saved layout.

## Known Stubs

None — both `layouts.ts` and `LayoutsMenu.tsx` are fully wired end-to-end (save/apply/delete/reset all persist through the unified record; the dropdown reads `savedLayouts` reactively, not from mock/placeholder data).

## TDD Gate Compliance

- Task 1 (`tdd="true"`): RED gate `f7f970d` (`test(03-04): ...` — layouts.ts absent, confirmed import-resolution failure); GREEN gate `73d9279` (`feat(03-04): ...` — 6/6 passing). REFACTOR: not needed, implementation landed clean.
- Task 2 (`type="auto"`, no `tdd="true"`): not subject to the RED/GREEN gate; `LayoutsMenu.test.tsx` was written alongside the implementation in the same commit (`4ed86e9`), consistent with this plan's non-TDD mode for that task.

## Next

Phase 3 (persistence-layouts) has PERS-01/02/03/04 all live. Per the phase's plan sequence, 03-05 is the remaining wave — check `.planning/phases/03-persistence-layouts/` for its scope before starting.

## Self-Check: PASSED

- src/persistence/layouts.ts: FOUND
- src/persistence/layouts.test.ts: FOUND
- src/shell/LayoutsMenu.tsx: FOUND
- src/shell/LayoutsMenu.module.css: FOUND
- src/shell/LayoutsMenu.test.tsx: FOUND
- commit f7f970d (Task 1 RED): FOUND
- commit 73d9279 (Task 1 GREEN): FOUND
- commit 4ed86e9 (Task 2): FOUND
