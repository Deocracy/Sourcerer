---
phase: 03-persistence-layouts
plan: 03
subsystem: persistence
tags: [tauri-plugin-store, persistence, crash-recovery, react]

requires:
  - phase: 03-persistence-layouts (03-01)
    provides: "loadWorkspaceRecord/saveWorkspaceRecord over LazyStore(workspace.json), migration runner"
  - phase: 03-persistence-layouts (03-02)
    provides: "Dock/shellStore wired end-to-end into the unified record"
provides:
  - "Corrupt/unmigratable persisted state backed up once to a rolling workspace.json.bak before falling back to DEFAULT_WORKSPACE (D-08)"
  - "resetOccurred()/acknowledgeReset() one-time signal exported from workspaceStore.ts"
  - "console.warn on every fallback — no silent reset (RESEARCH.md anti-pattern closed)"
  - "ResetNotice.tsx — dismissible corrupt-reset banner mounted in AppShell (D-04)"
  - "Missing-applet-key placeholder proven via makeRenderer/PanelBody test (D-06)"
affects: [03-04, 03-05]

tech-stack:
  added: []
  patterns:
    - "rolling single-file backup-before-discard on a SECOND LazyStore sink, wrapped in its own try/catch so backup failure never blocks the DEFAULT_WORKSPACE fallback"
    - "one-time boolean signal (resetOccurred/acknowledgeReset) as the seam between a persistence module and a display-only component, avoiding new event/toast infra"

key-files:
  created:
    - src/shell/ResetNotice.tsx
    - src/shell/ResetNotice.module.css
  modified:
    - src/persistence/workspaceStore.ts
    - src/persistence/workspaceStore.test.ts
    - src/app/AppShell.tsx

key-decisions:
  - "Absent store (first run, raw == null) does NOT trigger the .bak backup or resetOccurred() signal — it's not corrupt, there's nothing to preserve; only isCandidateRecord()==false or migrate()==null (corrupt/unmigratable) trigger the visible fallback path"
  - "The read itself failing (store.get() throwing, e.g. disk/IPC error) also skips the backup — there is no raw value in hand to back up in that branch"
  - "ResetNotice mounts inside AppShell's .main div (already position:relative) as an absolute-positioned overlay so it never shifts the title bar or dock layout"

requirements-completed: [PERS-03]

duration: ~20min
completed: 2026-07-09
---

# Phase 3 Plan 03: Corrupt-State Recovery + ResetNotice Summary

**One-liner:** Corrupt/unmigratable workspace.json state now backs up once to a rolling workspace.json.bak, falls back visibly to the Wiki+Library default with a console warning, and surfaces a one-time dismissible inline banner — closing the Phase-2 silent-swallow anti-pattern.

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 (both auto, task 1 tdd="true")
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- `loadWorkspaceRecord` in `src/persistence/workspaceStore.ts` now copies any corrupt/unmigratable raw value to a second `LazyStore("workspace.json.bak")` sink (rolling, overwritten each reset) before falling back to `DEFAULT_WORKSPACE`, and flips a module-scope `resetOccurred()` signal plus logs `console.warn` — never silent.
- Extended `workspaceStore.test.ts` with three new cases: (e) corrupt input backs up exactly once and flips `resetOccurred()` true, (f) a valid record leaves `resetOccurred()` false with no `.bak` write, (g) a record whose dockTree encodes an unknown applet key loads without throwing and `makeRenderer("NotARealApplet")` renders the `PanelBody` fallback placeholder text.
- Built `src/shell/ResetNotice.tsx` — a minimal, self-contained dismissible banner (local `useState`, no shared toast infra) rendering the exact D-04 copy, wired to `resetOccurred()`/`acknowledgeReset()`. Mounted in `AppShell.tsx` inside `.main` as a non-blocking absolute overlay.

## Task Commits

1. **Task 1: Corrupt/stale fallback — .bak copy + resetOccurred signal + missing-key coverage** - `fb4ad2d` (feat)
2. **Task 2: ResetNotice component + mount in AppShell** - `2a05aaf` (feat)

## Files Created/Modified

- `src/persistence/workspaceStore.ts` - added `backupStore` (second LazyStore sink), `resetOccurred()`/`acknowledgeReset()` exports, `backupAndFallback()` helper wired into the corrupt/unmigratable branches of `loadWorkspaceRecord`
- `src/persistence/workspaceStore.test.ts` - dual-map LazyStore mock (primary + `.bak`), 3 new test cases (e/f/g)
- `src/shell/ResetNotice.tsx` - new dismissible banner component
- `src/shell/ResetNotice.module.css` - token-driven styling, 0 border-radius
- `src/app/AppShell.tsx` - mounts `<ResetNotice />` inside `.main`

## Decisions Made

- Absent-store (first run) is not treated as a "reset" — no `.bak` write, no notice. Only genuinely corrupt/unmigratable persisted values (shape-invalid or no migration path) trigger the visible fallback, matching the plan's "corrupt or unmigratable" framing precisely.
- A failed `store.get()` read (thrown, not just `null`) also skips the backup, since there's no raw value in hand to preserve in that branch — falls back silently-safe to default the same way the pre-existing catch-all did.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PERS-03 fully satisfied: corrupt/stale recovery is visible, recoverable (`.bak`), and non-crashing; missing-applet-key dispatch proven.
- `workspaceStore.ts`'s `savedLayouts` slice (already in the schema, currently `{}`) is ready for 03-04's LAYOUTS ▾ dropdown to read/write through the same `scheduleWorkspaceSave()`/`registerStateSources()` seam.
- No blockers.

---
*Phase: 03-persistence-layouts*
*Completed: 2026-07-09*

## Self-Check: PASSED

- src/persistence/workspaceStore.ts: FOUND
- src/shell/ResetNotice.tsx: FOUND
- src/shell/ResetNotice.module.css: FOUND
- commit fb4ad2d (Task 1): FOUND
- commit 2a05aaf (Task 2): FOUND
