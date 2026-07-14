---
phase: 06-dashboard-assistant-home
plan: 07
subsystem: ui
tags: [zustand, react, dockview, pointer-events, gap-closure]

# Dependency graph
requires:
  - phase: 06-dashboard-assistant-home
    provides: "06-04's assistantSnap.ts thresholds/clamps (CR-01 fixed hostWidth) and 06-01's asstWidth/assistantOpen persisted rail subset"
provides:
  - "shellStore.cycleAssistant() three-state bounce action (closed -> open -> full -> open -> closed) plus a non-persisted assistantFull flag"
  - "RailToggleButtons right button correctly wired to the assistant instead of the left rail"
  - "useAssistantResize.liveWidth surfaced every pointermove so the panel resizes fluidly during a drag"
affects: [06-08, 06-VERIFICATION]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closure-local (non-reactive) zustand state for values that must survive across a store action without ever triggering a re-render or entering getRailSubset's persisted shape (assistantPrevWidth, assistantDir)"
    - "liveWidth pattern for bespoke pointer-driven resize: a separate live-only React state cleared to null in the shared WR-06 teardown, consumed by the panel as `liveWidth ?? persistedWidth`"

key-files:
  created: []
  modified:
    - src/store/shellStore.ts
    - src/shell/RailToggleButtons.tsx
    - src/assistant/useAssistantResize.ts
    - src/assistant/AssistantPanel.tsx
    - src/store/shellStore.test.ts
    - src/shell/RailToggleButtons.test.tsx
    - src/assistant/useAssistantResize.test.tsx
    - src/shell/TitleBar.test.tsx

key-decisions:
  - "assistantFull modeled as a session-only (non-persisted) zustand field, not a new persisted schema value or a third string state — asstWidth still carries the real pixel width, restored from a closure-local prevWidth on exit from full (mirrors the prototype's rightPrev), avoiding a workspace.json schema bump"
  - "Live drag width (liveWidth) added as a second piece of live-only hook state alongside the existing liveSnap, cleared together in the shared WR-06 teardown rather than derived from liveSnap"
  - "Dispatch a window resize event on every pointermove to relayout dockview in step with the drag, since there is no direct relayout() handle to call from useAssistantResize (mirrors the prototype's per-frame this.relayout())"

patterns-established: []

requirements-completed: [ASST-03]

duration: 5min
completed: 2026-07-14
---

# Phase 06 Plan 07: Assistant Right-Rail Toggle + Live Resize (GAP-1) Summary

**Fixed two confirmed root causes of GAP-1: the title-bar right toggle now drives `shellStore.cycleAssistant()` (closed -> open -> full bounce) instead of the left rail's `cycleRailMode()`, and `useAssistantResize` now surfaces a live pixel width on every pointermove so the panel follows the drag in real time instead of snapping to its final width on release.**

## Performance

- **Duration:** ~5 min (14:58:45 -> 15:03:27 across the three task commits)
- **Started:** 2026-07-14T14:58:45-07:00
- **Completed:** 2026-07-14T15:03:27-07:00
- **Tasks:** 3
- **Files modified:** 8 (4 production, 4 test)

## Accomplishments
- `shellStore.cycleAssistant()` implements the prototype's `cycleRight`/`applyRightState` three-state bounce (closed -> open -> full -> open -> closed, never wraps), backed by a non-persisted `assistantFull` flag and closure-local `assistantPrevWidth`/`assistantDir` state.
- `RailToggleButtons`'s right button now calls `cycleAssistant()` (was `cycleRailMode()`); its SVG fill mirrors the prototype's `rightFillX`/`rightFillW` (partial accent bar while open, full-width while full, none while closed). Left button/`railMode` untouched.
- `useAssistantResize` exposes `liveWidth`, recomputed every `pointermove` as the clamped raw drag distance, alongside the existing `liveSnap` cue; `AssistantPanel` renders `liveWidth ?? asstWidth` so the panel follows the pointer fluidly through intermediate widths. A `window` `resize` event dispatches on every move so dockview relayouts in step with the drag. `liveWidth` is cleared alongside `liveSnap` in the existing WR-06 teardown (pointerup/pointercancel), so a cancelled drag never leaves a stale live width.

## Task Commits

Each task was committed atomically:

1. **Task 1: Diagnose right-rail divergences and encode them as failing tests** - `ebf77dc` (test)
2. **Task 2: Wire the assistant open/close/full toggle (store action + right button)** - `062813f` (feat)
3. **Task 3: Make the grip drag resize the panel live (fluid resize + snap cues)** - `28f23f5` (feat)

_No TDD RED/GREEN split per task — Task 1 wrote and confirmed all three failing tests together, then Tasks 2/3 each turned their subset green in one commit._

## Divergence List (Task 1 diagnosis, file:line)

- **(a)** `src/shell/RailToggleButtons.tsx:44` — the right button's `onClick` called `shellStore.getState().cycleRailMode()` (the LEFT rail action), so clicking it cycled the left rail and never touched the assistant.
- **(b)** `src/assistant/useAssistantResize.ts:57-60` (pre-fix) — `handleMove` only called `setLiveSnap(...)`; `AssistantPanel.tsx:418` (pre-fix) rendered `style={{ width: asstWidth }}`, and `asstWidth` was written only in `handleUp` (pointerup). Result: the panel's width never updated during the drag, only snapping to its final value on release.
- **(c)** `src/store/shellStore.ts` had no action mirroring the prototype's `cycleRight`/`applyRightState` three-state bounce (closed -> open -> full, never wraps) — only `setAssistantOpen`/`setAsstWidth` existed as low-level setters, with nothing wiring the title-bar toggle to a cycling behavior.
- **(d)** `src/assistant/AssistantPanel.tsx:396-419` (closed-strip reopen) is a plain click-to-open affordance (`onClick={reopen}`), whereas the prototype's `startRightPull` (handoff lines ~543-575) also lets a drag-out from the closed strip reopen-then-resize in one gesture. This divergence is documented for completeness (informs a possible future refinement) but was not directly tested or changed in this plan — GAP-1's four `must_haves` truths (toggle, live resize, close/full snap+cue, persistence) do not require the drag-to-reopen gesture, and the plan's task list scoped Task 3 to the live-width fix only.

## Files Created/Modified
- `src/store/shellStore.ts` - Added `assistantFull` (session-only field) and `cycleAssistant()` (three-state bounce action); `hydrateFromDisk` resets `assistantFull` to `false` on load.
- `src/shell/RailToggleButtons.tsx` - Right button rewired to `cycleAssistant()`; SVG fill now reflects `assistantOpen`/`assistantFull`; aria-label renamed to "Cycle assistant panel (right)".
- `src/assistant/useAssistantResize.ts` - `handleMove` now computes and exposes `liveWidth` every pointermove (clamped raw drag distance) and dispatches a `window` `resize` event; teardown clears `liveWidth` alongside `liveSnap`.
- `src/assistant/AssistantPanel.tsx` - Panel width style now `liveWidth ?? asstWidth`.
- `src/store/shellStore.test.ts` - New `cycleAssistant()` bounce-transition test.
- `src/shell/RailToggleButtons.test.tsx` - New file: right-toggle-drives-assistant / left-toggle-still-drives-railMode coverage.
- `src/assistant/useAssistantResize.test.tsx` - New live-width-during-drag coverage.
- `src/shell/TitleBar.test.tsx` - Updated aria-label assertions for the right button's rename (downstream fix, see Deviations).

## Decisions Made
- `assistantFull` kept as a non-persisted zustand field rather than adding a third persisted mode or a schema bump — `asstWidth` still carries the real pixel width; a closure-local `assistantPrevWidth` (not part of `ShellState`, so it never widens `getRailSubset` or triggers a re-render) restores the pre-full width on exit, mirroring the prototype's `rightPrev`.
- `liveWidth` implemented as a parallel piece of hook state to `liveSnap` (not derived from it), cleared together in the existing WR-06 teardown — keeps the cancelled-drag guarantee (no stale live value) without touching the teardown's shape.
- A `window` `resize` event dispatch substitutes for the prototype's direct `this.relayout()` call, since `useAssistantResize` has no handle into dockview's `DockviewApi` — bounded to the drag lifetime by the same teardown (threat model T-06g1-02).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `TitleBar.test.tsx` aria-label assertions broken by the Task 2 rename**
- **Found during:** Task 3 (full-suite verification run)
- **Issue:** Task 2 renamed the right button's aria-label from `"Cycle rail mode (right)"` to `"Cycle assistant panel (right)"` (a necessary rename — the button no longer cycles rail mode). This broke two pre-existing `TitleBar.test.tsx` assertions (`getByLabelText("Cycle rail mode (right)")`) that were out of this plan's stated `files_modified` list but were a direct, mechanical consequence of the in-scope rename.
- **Fix:** Updated both assertions in `TitleBar.test.tsx` to the new label.
- **Files modified:** `src/shell/TitleBar.test.tsx`
- **Verification:** `npx vitest run src/shell/TitleBar.test.tsx` — 4/4 green; full suite confirmed 199/199 green afterward.
- **Committed in:** `28f23f5` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary correction of a mechanical downstream break from the plan's own intended rename; no scope creep — no behavior beyond the plan's stated scope was added.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GAP-1's four `must_haves` truths hold structurally (verified by automated tests): working right toggle (cycleAssistant transitions), live fluid resize (liveWidth follows the pointer every pointermove), correct close/full snap thresholds unchanged (`assistantSnap.ts` untouched), and persisted width unchanged (`setAsstWidth`/`setAssistantOpen` still call `scheduleWorkspaceSave`).
- Human verification (per plan's `<verification>` section) still needed at end-of-phase: drag feel, toggle click-through, and cross-restart persistence in the live build — not exercised by this plan's automated jsdom tests.
- `06-08-PLAN.md` (GAP-2: left rail resize/toggle) is the remaining incomplete plan for this phase; no dependency on this plan's changes since it targets `useRailDrag.ts`/`railSnap.ts`, a separate module untouched here.

---
*Phase: 06-dashboard-assistant-home*
*Completed: 2026-07-14*

## Self-Check: PASSED

All claimed files and commit hashes verified present on disk / in git log.
