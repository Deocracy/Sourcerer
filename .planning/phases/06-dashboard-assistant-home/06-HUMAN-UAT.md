---
status: partial
phase: 06-dashboard-assistant-home
source: [06-VERIFICATION.md]
started: 2026-07-14T21:30:00Z
updated: 2026-07-14T21:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Drag a card out of an emptied section, then drop one back in (WR-02)
expected: A section whose last card was dragged away remains a valid drop target — dragging any card over the emptied section highlights it and dropping lands the card there with the FLIP animation.
result: [pending]

### 2. Release a cross-section drag outside any droppable (WR-08)
expected: The in-flight cross-section move settles to its last hovered position and that state persists — restart the app and the card is still in the section where it visually landed (debounced host.storage write fired).
result: [pending]

### 3. Live assistant resize-grip drag through intermediate widths (CR-01)
expected: Dragging the assistant grip resizes fluidly through intermediate widths (not just snapping closed/full); releasing below the close threshold snaps closed with the "LET GO TO SNAP" cue, releasing past the full-zone expands to fullscreen, and the chosen width persists across restart.
result: issue — resize UX does not match the demo prototype: drag is janky and the open/close toggles don't work (reported 2026-07-14, live build)

## Summary

total: 3
passed: 0
issues: 1
pending: 2
skipped: 0
blocked: 0

## Gaps

### GAP-1: Assistant (right rail) resize does not match UX demo
status: failed
severity: major
symptom: Live grip drag is janky (not fluid like the prototype), and the assistant open/close toggle interactions don't work.
expected: Behavior of the right assistant rail in the demo prototype at `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/` — fluid pointer-driven resize with snap cues, working toggle to open/close the panel.
suspects: `src/assistant/useAssistantResize.ts` (CR-01 fix changed hostWidth source to `window.innerWidth` — snap thresholds/clamps may now disagree with the actual host geometry), `src/assistant/assistantSnap.ts` thresholds vs the prototype's `startRightResize`/`startRightPull` logic, missing rAF/transition suppression during drag, closed-strip reopen affordance.

### GAP-2: Left rail resize/toggle also janky vs UX demo
status: failed
severity: major
symptom: Left rail drag is janky and its toggles don't work as in the demo (regression or never matched — surfaced during Phase 6 live testing).
expected: Left rail behavior in the same demo prototype (`useRailDrag.ts`/`railSnap.ts` were modeled on it) — fluid drag, snap modes, working toggle.
suspects: `src/shell/useRailDrag.ts`, `src/shell/railSnap.ts`, CSS transitions fighting pointer-driven width updates during drag.
