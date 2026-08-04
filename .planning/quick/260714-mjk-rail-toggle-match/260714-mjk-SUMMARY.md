---
status: complete
phase: quick-260714-mjk-rail-toggle-match
plan: 01
tags: [shell, title-bar, design-match]
requirements: [MATCH-01]
key-files:
  modified:
    - src/shell/RailToggleButtons.tsx
    - src/shell/RailToggleButtons.module.css
commits:
  - 2c1e591
metrics:
  duration: "~10 minutes"
  completed: 2026-07-14
---

# Quick Task: Rail Toggle Icon Design Match Summary

Rewrote both title-bar toggle SVGs (`RailToggleButtons.tsx`) to use the design reference's single fill-bar language and neutral (never-accent) coloring, replacing the LEFT toggle's outdated two-independent-rect "split panel" metaphor and both toggles' incorrect accent-green fill.

## What Changed

**`src/shell/RailToggleButtons.tsx`:**
- LEFT toggle: replaced the two separate rects (widths 6 and 7, each independently fill-lit with `var(--color-accent)`) with exactly two rects — one outline (`fill=none stroke=currentColor`) and one growing fill bar (`fill=currentColor`, `width={leftColW}`), matching the RIGHT toggle's existing fill-bar pattern.
- Added `leftColW` derivation: 6 when `railMode === "expanded"`, 3 when `"compact"`, 0 when `"hidden"`.
- RIGHT toggle: changed `stroke="var(--color-line-2)"` → `stroke="currentColor"` and `fill="var(--color-accent)"` → `fill="currentColor"` on the fill rect. Geometry (`x`/`width` driven by `assistantFull`/`assistantOpen`) unchanged.
- Both buttons' `className` now composes `styles.toggle` with a new `styles.toggleDim` / `styles.toggleLit` modifier:
  - LEFT: `toggleDim` when `railMode === "hidden"`, else `toggleLit`.
  - RIGHT: `toggleLit` when `(assistantOpen || assistantFull)`, else `toggleDim`.
- Updated the top JSDoc comment to describe the new fill-bar/currentColor language instead of the old two-rect/accent description.
- `onClick` handlers (`cycleRailMode`, `cycleAssistant`) and `aria-label`s untouched.

**`src/shell/RailToggleButtons.module.css`:**
- Added `.toggleDim { color: var(--color-faint); }` and `.toggleLit { color: var(--color-fg); }` modifier classes, composed alongside `.toggle` to drive `currentColor` in the SVGs.

## Verification

- `npx vitest run src/shell/RailToggleButtons.test.tsx` → 3/3 tests pass unmodified (click-wiring assertions for railMode and assistant cycling, unaffected by the visual-only change).
- Grep confirms no remaining `var(--color-accent)` reference in `RailToggleButtons.tsx`.
- `Rail.tsx` / `Rail.module.css` untouched (out of scope, confirmed via `git status`).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- FOUND: src/shell/RailToggleButtons.tsx (modified, contains `currentColor`, no `color-accent`)
- FOUND: src/shell/RailToggleButtons.module.css (modified, contains `.toggleDim`/`.toggleLit`)
- FOUND: commit 2c1e591 in `git log --oneline`

## Self-Check: PASSED
