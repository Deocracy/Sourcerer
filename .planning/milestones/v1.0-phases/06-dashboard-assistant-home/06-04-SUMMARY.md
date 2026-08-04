---
phase: 06-dashboard-assistant-home
plan: 04
subsystem: ui
tags: [react, assistant, resize, pointer-capture, shellStore, asst-03]

requires:
  - phase: 06-dashboard-assistant-home
    provides: "shellStore asstWidth/assistantOpen persisted actions (06-01)"
provides:
  - "assistantSnap.ts: pure snapWidthToAsstMode(raw, hostWidth) -> closed|open|full (D-03)"
  - "useAssistantResize.ts: bespoke pointer-capture resize hook (mirrored right-edge formula)"
  - "AssistantPanel left-edge resize grip, closed strip, LET GO TO SNAP cue"
affects: []

tech-stack:
  added: []
  patterns:
    - "Pure snap-threshold fn (mirrors src/shell/railSnap.ts): module-level constants + discriminated union, no React/DOM import"
    - "Bespoke pointer-capture resize hook (mirrors src/shell/useRailDrag.ts), inverted right-edge formula (hostRect.right - clientX) instead of the rail's left-edge (clientX - navLeft)"

key-files:
  created:
    - src/assistant/assistantSnap.ts
    - src/assistant/assistantSnap.test.ts
    - src/assistant/useAssistantResize.ts
  modified:
    - src/assistant/AssistantPanel.tsx
    - src/assistant/AssistantPanel.module.css

key-decisions:
  - "Reopen-from-closed uses REOPEN_DEFAULT_WIDTH (280) only when the persisted asstWidth is below a sane floor (<44), so reopening a panel that was closed at a wider persisted width restores that width rather than always resetting to 280"
  - "Full-snap width computed as hostWidth - 160 at pointerup time (matches the plan's own worked example), not a separate dedicated full-width constant"

requirements-completed: [ASST-03]

duration: ~20min
completed: 2026-07-14
---

# Phase 06 Plan 04: Assistant Resize Grip (ASST-03) Summary

**Bespoke pointer-capture left-edge resize grip for the Dashboard Assistant panel, reusing the rail's `railSnap.ts`/`useRailDrag.ts` pattern with an inverted right-edge drag formula, driving the persisted `asstWidth`/`assistantOpen` shellStore slice from Plan 06-01.**

## Accomplishments

- `assistantSnap.ts` authored as a pure, synchronous `snapWidthToAsstMode(raw, hostWidth): AsstSnap` mirroring `railSnap.ts`'s pure-fn idiom exactly — module-level `HIDDEN_W`/`CLOSE_AT`/`FULL_AT` constants (6/180/620, recovered from the handoff's `startRightResize`), a 3-state discriminated union (`closed | open | full`), clamping open width to `hostWidth - 160`.
- 9 boundary tests in `assistantSnap.test.ts`: below-`CLOSE_AT`, mid-range open, above-`FULL_AT`, both `CLOSE_AT`/`FULL_AT` boundary pairs, and the `hostWidth - 160` clamp case (using a raw value that stays `<= FULL_AT` so the clamp is actually exercised rather than short-circuited by the full-mode check).
- `useAssistantResize.ts` mirrors `useRailDrag`'s `onResizePointerDown` pointer-capture flow (`setPointerCapture` on the grip element, listeners removed on pointerup, final snap recomputed fresh on release rather than reused from the last live value) but with the MIRRORED formula `hostRect.right - ev.clientX` (the assistant is the right-hand panel, growing leftward) instead of the rail's `ev.clientX - navLeft`. Exposes `{ hostRef, onResizePointerDown, liveSnap, reopen }`.
- `AssistantPanel.tsx` grown: reads `asstWidth`/`assistantOpen` from `shellStore`, applies `asstWidth` as an inline style width, attaches `hostRef` to the panel root. When closed, renders only a `--asst-closed-w` (6px) strip with a click/Enter/Space reopen affordance (the grip stays live on the strip too, so a drag-out reopens without a separate click). While `liveSnap?.mode === "full"`, shows the "LET GO TO SNAP" cue in the `asst-label-mono` role. No shell-layout-component (AppShell) edit — the panel fully self-sizes.
- `AssistantPanel.module.css` grown: `.grip` (absolute left-edge strip, `col-resize` cursor, 0 radius), `.closedStrip` (6px collapsed strip), `.snapCue` (mono-caps overlay, accent-bordered, `pointer-events: none`).

## Task Commits

1. **Task 1: assistantSnap.ts pure snap function + boundary tests** - `b823e1c` (feat, TDD combined — all 9 fixtures passed on first write)
2. **Task 2: useAssistantResize hook + resize grip wired into AssistantPanel** - `c05f518` (feat)

**Plan metadata:** pending (this commit)

## Verification

- `npx vitest run src/assistant/assistantSnap.test.ts` — 9/9 passed.
- `npx vitest run src/assistant` — 33/33 passed (12 pre-existing "Unhandled Rejection" console errors from `window.__TAURI_INTERNALS__.transformCallback` in the jsdom Tauri mock during `AssistantPanel.test.tsx`'s `loadSession` effect — confirmed pre-existing via `git stash` diff-check against the same file before this plan's changes, out of scope per the scope-boundary rule; not a regression).
- `npx vitest run` (full suite) — 25 files, 161/161 passed.
- `npx tsc --noEmit` — clean, no errors.
- Acceptance-criteria greps: `hostRight - ev.clientX` (mirrored formula) present in `useAssistantResize.ts`; `setPointerCapture` present; `setAsstWidth`/`setAssistantOpen` present; `LET GO TO SNAP` present in `AssistantPanel.tsx`; `grep -c "AppShell" src/assistant/AssistantPanel.tsx` returns 0.

## Deviations from Plan

None — plan executed exactly as written. One clarification: the plan's `<interfaces>` worked example ("raw 2000, hostWidth 500 -> width 340, still 'open' unless > FULL_AT") is only satisfiable for a raw value that does not itself exceed `FULL_AT` (2000 > 620 would in fact bucket to `full` per the interface's own given function, since the `raw > FULL_AT` check runs before the clamp). The test for this case uses `raw=600, hostWidth=500` instead, which produces the same clamped width (340) while staying at/under `FULL_AT` so the "open" bucket is actually exercised — this is a test-fixture-value correction, not a deviation from the specified `snapWidthToAsstMode` implementation (which is copied verbatim from the `<interfaces>` block).

## Issues Encountered

None beyond the above test-fixture clarification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ASST-03 fully satisfied: bespoke pointer resize, snap-to-close, expand-to-fullscreen with cue, persisted width/open via the Plan 06-01 shellStore slice.
- No blockers for Plan 06-06 (Home dashboard), which does not depend on this plan's resize mechanics.

## Self-Check: PASSED

- FOUND: src/assistant/assistantSnap.ts (snapWidthToAsstMode + AsstSnap present, no React import)
- FOUND: src/assistant/assistantSnap.test.ts (9 fixtures, all passing)
- FOUND: src/assistant/useAssistantResize.ts (hostRef, onResizePointerDown, liveSnap, reopen; mirrored formula; setPointerCapture; setAsstWidth/setAssistantOpen)
- FOUND: src/assistant/AssistantPanel.tsx (grip, closed strip, LET GO TO SNAP cue, no AppShell import)
- FOUND: src/assistant/AssistantPanel.module.css (.grip/.closedStrip/.snapCue classes)
- FOUND commit b823e1c: feat(06-04): add assistantSnap.ts pure snap function + boundary tests
- FOUND commit c05f518: feat(06-04): add useAssistantResize hook + resize grip in AssistantPanel
- Full suite: 161/161 tests passing (`npx vitest run`); `npx tsc --noEmit` clean

---
*Phase: 06-dashboard-assistant-home*
*Completed: 2026-07-14*
