---
phase: 06-dashboard-assistant-home
plan: 08
subsystem: ui
tags: [pointer-events, dockview, gap-closure]

# Dependency graph
requires:
  - phase: 06-dashboard-assistant-home
    provides: "06-07's WR-06 teardown + window-resize-relayout pattern (useAssistantResize), used here as the reference to bring useRailDrag to parity"
provides:
  - "useRailDrag pointercancel teardown (WR-06 parity): clears liveSnap and removes listeners without committing a snap"
  - "Left-rail grip drag dispatches a window resize event on every pointermove so dockview reflows in step with the drag"
  - "Regression coverage confirming the left-rail toggle cycle (double-click, Cmd/Ctrl-\\, RailToggleButtons' left button) already worked correctly"
affects: [06-VERIFICATION]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared teardown() closure (mirrors useAssistantResize) invoked from both handleUp and a new pointercancel handler, so drag interruption and normal release can never diverge in listener/state cleanup"
    - "window.dispatchEvent(new Event('resize')) as the substitute for a direct dockview relayout() handle during a bespoke pointer drag — now applied identically to both rail-resize hooks (left rail here, assistant in 06-07)"

key-files:
  created: []
  modified:
    - src/shell/useRailDrag.ts
    - src/shell/useRailDrag.test.tsx

key-decisions:
  - "railSnap.ts thresholds confirmed matching the prototype 1:1 (no changes) — the jank was entirely a missing live-relayout-during-drag, not a threshold divergence"
  - "Rail.module.css has no width transition to suppress (no data-dragging attribute added) — confirmed via grep, recorded rather than adding a speculative no-op guard"
  - "All three toggle paths (grip double-click, Cmd/Ctrl-\\, RailToggleButtons' left button per 06-07) were already wired correctly; no production handler change was needed in Task 3 — the reported 'toggle doesn't work' symptom is attributed to the Task 2 drag-feel fix making mode changes feel unresponsive amid the dock-lag jank"

patterns-established: []

requirements-completed: [RAIL-01, ASST-03]

duration: 8min
completed: 2026-07-14
---

# Phase 06 Plan 08: Left-Rail Drag Jank + Toggle Verification (GAP-2) Summary

**Closed GAP-2 by giving the left-rail grip drag the same live-relayout + WR-06 pointercancel-teardown fix 06-07 shipped for the assistant panel, and confirmed (rather than needed to fix) that all three rail-toggle paths already cycled correctly.**

## Performance

- **Duration:** ~8 min (task 1 diagnosis/test through task 3 verification)
- **Tasks:** 3
- **Files modified:** 2 (1 production, 1 test)

## Accomplishments
- `useRailDrag.onResizePointerDown`'s `handleMove` now dispatches a `window` `resize` event on every `pointermove`, matching the prototype's `startRailResize` per-frame `relayout()` call — removes the dock-lags-rail jank (the primary suspect confirmed in diagnosis).
- Added a shared `teardown()` (mirrors `useAssistantResize`'s WR-06 fix exactly): `releasePointerCapture` in a try/catch, removes `pointermove`/`pointerup`/`pointercancel` listeners, clears `liveSnap`. Invoked from both `handleUp` (which additionally commits the snap) and a new `handleCancel` bound to `pointercancel` (which does not commit a snap).
- Confirmed via diagnosis and regression tests that the grip double-click, `Cmd`/`Ctrl`-`\`, and (per 06-07) the title-bar left button all correctly call `cycleRailMode()` and bounce `expanded -> compact -> hidden -> expanded` — no production fix required for toggling itself.

## Task Commits

Each task was committed atomically:

1. **Task 1: Diagnose left-rail divergences and encode the testable one as a failing test** - `fadbe97` (test)
2. **Task 2: Fix drag jank — live workspace relayout in step + pointercancel teardown** - `3098236` (feat)
3. **Task 3: Verify the left-rail toggle paths** - `664f276` (test)

## Divergence List (Task 1 diagnosis, file:line)

- **(a)** `src/shell/useRailDrag.ts:51-54` (pre-fix) — `handleMove` only called `setLiveSnap(...)`; no relayout signal was ever sent to dockview during the drag, so the center workspace's dock panels stayed at their pre-drag size until `pointerup` while the rail itself resized live (`Rail.tsx:55-66` already applied `liveSnap` width) — confirming the reported jank was the WORKSPACE lagging the rail, not the rail lagging the pointer. Fixed in Task 2 by dispatching a `window` `resize` event each move (mirrors 06-07's identical fix for the assistant panel).
- **(b)** `src/shell/useRailDrag.ts:42-69` (pre-fix) — no `pointercancel` listener existed at all. An interrupted drag (window blur, OS gesture, touch cancel) left the `pointermove`/`pointerup` listeners permanently attached to the grip element and `liveSnap` pinned at its last live value, since nothing ever called `setLiveSnap(null)` or removed the listeners outside a normal `pointerup`. This is the WR-06 parity gap `useAssistantResize` already closed for the assistant grip. Fixed in Task 2 via a shared `teardown()` invoked from a new `handleCancel`.
- **(c)** `src/shell/railSnap.ts` — compared 1:1 against the prototype's `effLeftW`/`startRailResize` thresholds (`HIDDEN_W=6`, `COMPACT_W=56`, `CLOSE_AT=44`, `COMPACT_AT=132`, `EXPANDED_MAX=520`) and `tokens.css`. **No divergence found** — `railSnap.test.ts`'s existing 8 boundary tests were unchanged and stayed green throughout. No threshold was touched in this plan.
- **(d)** Toggle-handler verification: `src/shell/useRailDrag.ts` — grip `onResizeDoubleClick` (line ~71) calls `cycleRailMode()`; the global `keydown` effect (lines ~77-86) calls `cycleRailMode()` on `Cmd`/`Ctrl`-`\`; `src/shell/Rail.tsx`'s hidden-strip `onClick` (line ~74, visible only when `mode === "hidden"`) also calls `cycleRailMode()` directly via `shellStore.getState()`. All three fire correctly — confirmed by the new Task 3 tests. The grip itself (the resize handle, `Rail.tsx:203-208`) intentionally has no single-click handler (only `onPointerDown` for drag and `onDoubleClick` for cycling), matching its `title="Drag to resize · double-click to cycle"` affordance — this is correct, not a bug. Combined with 06-07's confirmation that the title-bar left button already called `cycleRailMode()` correctly, the "toggle doesn't work" report is attributed to Task 2's drag-feel fix: with the dock visibly lagging the rail during any interaction, a toggle click landing mid-jank likely read as unresponsive even though the underlying state transition fired immediately. No handler was broken; no handler was changed.

## Files Created/Modified
- `src/shell/useRailDrag.ts` - `handleMove` dispatches a `window` `resize` event each pointermove; new shared `teardown()` clears `liveSnap` and removes all three listeners (`pointermove`/`pointerup`/`pointercancel`); new `handleCancel` bound to `pointercancel` applies no snap. `railSnap` thresholds and `Rail.module.css` untouched (no width transition existed to suppress).
- `src/shell/useRailDrag.test.tsx` - New file: pointercancel-teardown test (Task 1, fail-pre-fix -> green after Task 2), plus toggle-cycling regression tests (Task 3: double-click one-step, Cmd/Ctrl-\ one-step, double-click full bounce).

## Decisions Made
- Reused the exact `window.dispatchEvent(new Event("resize"))` + shared-`teardown()` pattern 06-07 established for `useAssistantResize`, rather than inventing a rail-specific variant — keeps the two bespoke-pointer resize hooks (left rail, right assistant) structurally identical, which was already flagged as the shared ASST-03 seam in this plan's frontmatter.
- Did not add a `data-dragging` CSS guard to `Rail.module.css` since `.rail`/`.handle` have no width `transition` rule to fight the live drag (confirmed via grep) — recorded as "no divergence" per the plan's explicit instruction not to add a speculative no-op.
- Left Task 3's toggle-handler code untouched entirely; the task's own acceptance criteria anticipated this ("if all handlers are already correct, record that and rely on the Task 2 drag-feel fix") and diagnosis confirmed no handler bug existed.

## Deviations from Plan

None - plan executed exactly as written. All three tasks matched their diagnosis-first, fail-then-fix TDD structure; no Rule 1-4 auto-fixes were needed since Task 1's diagnosis correctly predicted the single real bug (missing relayout + missing pointercancel) and Task 3 confirmed no further handler bug existed.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GAP-2's three `must_haves` truths hold structurally (verified by automated tests): fluid in-step resize (relayout dispatched every move), working expanded/compact/hidden cycling across double-click/Cmd-\/title-bar-button, and clean pointercancel teardown (WR-06 parity, mirrors 06-07's assistant fix).
- Files stayed fully disjoint from plan 06-07 (`RailToggleButtons.tsx` and `shellStore.ts` were never opened for edit) and `railSnap.ts` thresholds are unchanged, satisfying the plan's stated success criteria.
- Human verification (per plan's `<verification>` section) still needed at end-of-phase: drag feel (rail AND center workspace resizing together with no lag/tearing), all three toggle paths, and an interrupted-drag settle check (e.g. Alt-Tab mid-drag) in the live build — not exercised by jsdom's automated pointer simulation.
- This was the last remaining incomplete plan for Phase 06 (`06-07-SUMMARY.md` flagged `06-08-PLAN.md` as the sole remaining item); both GAP-1 and GAP-2 from `06-HUMAN-UAT.md` are now structurally closed pending the end-of-phase live UAT pass.

---
*Phase: 06-dashboard-assistant-home*
*Completed: 2026-07-14*

## Self-Check: PASSED

All claimed files and commit hashes verified present on disk / in git log.
