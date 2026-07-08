---
phase: 02-workspace-core
plan: 02
subsystem: ui
tags: [title-bar, chrome-rework, floating-window, tauri, css-tokens]

# Dependency graph
requires:
  - phase: 02-workspace-core
    plan: 01
    provides: "shellStore/useShellStore (cycleRailMode, railApplet, activeCorpus) + Chrome Rework tokens.css deltas"
provides:
  - "40px title bar with DIVI chip + corpus label + rail-toggle buttons + window controls, single drag region preserved"
  - "Floating rounded window: Tauri transparent:true + radial-backdrop + 10px inner card"
affects: [TitleBar, AppShell, Rail, Dock, DiviChip, RailToggleButtons]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chrome-only stub components (DiviChip) reading a store boolean, console-stub click handler — mirrors LogoCluster's openHome idiom"
    - "Direct shellStore.getState().action() calls for store-driven controls (no withWindow try/catch guard needed, unlike Tauri IPC calls)"
    - "Floating window: outer full-viewport backdrop div (radial gradient + inset padding) wrapping an inner bordered/rounded/shadowed card, both driven entirely by --window-* tokens"

key-files:
  created:
    - src/shell/DiviChip.tsx
    - src/shell/DiviChip.module.css
    - src/shell/RailToggleButtons.tsx
    - src/shell/RailToggleButtons.module.css
    - src/App.module.css
  modified:
    - src/shell/TitleBar.tsx
    - src/shell/TitleBar.module.css
    - src/shell/TitleBar.test.tsx
    - src/App.tsx
    - src-tauri/tauri.conf.json

key-decisions:
  - "LogoCluster.tsx left unmodified (out of this plan's files_modified scope) — its Phase-1 '·'+'Home' crumb still renders alongside the new DIVI chip/corpus label; only TitleBar.test.tsx's assertions were updated per the plan's explicit instruction, not a crumb-removal requirement"
  - "DiviChip's active state reads railApplet === 'Home' as a Phase-2 chrome-only stub — no Home overlay exists yet to actually toggle (D-03 scope boundary)"
  - "Both rail-toggle buttons call the same cycleRailMode() action (two aria-labeled hit targets per the '16x12 SVG buttons, fill to show rail state' spec, not two independent state machines)"

requirements-completed: [RAIL-01]

# Metrics
duration: ~18min
completed: 2026-07-08
---

# Phase 2 Plan 02: Chrome Rework (title bar + floating window) Summary

**Reworked the Phase 1 title bar to the 40px Chrome-Rework layout (DIVI chip, corpus label, rail-toggle SVG buttons around the single drag region) and added the floating rounded window (Tauri `transparent:true` + radial backdrop + 10px inner card).**

## Performance

- **Duration:** ~18 min
- **Completed:** 2026-07-08
- **Tasks:** 3 (all auto)
- **Files modified:** 10 (5 created, 5 modified)

## Accomplishments

- `DiviChip.tsx`/`.module.css`: rectangular chip toggling active (accent border + 14%-tint bg + accent text) vs inactive (`--color-line-2` border + muted text) from a `railApplet === "Home"` store boolean; console-stub click, matching the LogoCluster stub idiom.
- `RailToggleButtons.tsx`/`.module.css`: two aria-labeled 16×12 SVG buttons, each calling `shellStore.getState().cycleRailMode()` directly; SVG fill reflects the current `railMode` selector.
- `TitleBar.tsx` reworked to `LogoCluster -> DiviChip -> corpus label -> spacer(drag region) -> RailToggleButtons -> WindowControls`; `TitleBar.module.css` height already bound to the 40px `--titlebar-h` token from plan 01, added `.corpus` label style.
- `TitleBar.test.tsx` rewritten: DIVI chip + corpus label + both rail-toggle aria-labels asserted; single-drag-region invariant extended to also exclude the chip and both toggle buttons from carrying `data-tauri-drag-region`.
- Floating window: `tauri.conf.json` windows[0] now has `transparent: true` alongside `decorations:false, shadow:false`; `App.tsx` wraps `AppShell` in a `.backdrop` (radial gradient + 20px inset) and `.card` (10px radius, 1px border, drop shadow) — both driven entirely by the `--window-*` tokens plan 01 already added to `tokens.css`.

## Task Commits

1. **Task 1: DiviChip + RailToggleButtons components** — `6bbd7dd` (feat)
2. **Task 2: Rework TitleBar + test** — `bb2aa8d` (feat)
3. **Task 3: Floating rounded window** — `06f27ca` (feat)

**Plan metadata:** see final docs commit.

## Files Created/Modified

- [d:\Vibe Coding\Sourcerer\src\shell\DiviChip.tsx](src/shell/DiviChip.tsx) - DIVI toggle chip, chrome-only stub
- [d:\Vibe Coding\Sourcerer\src\shell\DiviChip.module.css](src/shell/DiviChip.module.css) - chip active/inactive styling
- [d:\Vibe Coding\Sourcerer\src\shell\RailToggleButtons.tsx](src/shell/RailToggleButtons.tsx) - two SVG rail-cycle buttons
- [d:\Vibe Coding\Sourcerer\src\shell\RailToggleButtons.module.css](src/shell/RailToggleButtons.module.css) - toggle button chrome
- [d:\Vibe Coding\Sourcerer\src\shell\TitleBar.tsx](src/shell/TitleBar.tsx) - reworked 40px title-bar composition
- [d:\Vibe Coding\Sourcerer\src\shell\TitleBar.module.css](src/shell/TitleBar.module.css) - 40px height + corpus label style
- [d:\Vibe Coding\Sourcerer\src\shell\TitleBar.test.tsx](src/shell/TitleBar.test.tsx) - updated assertions for new chrome
- [d:\Vibe Coding\Sourcerer\src\App.tsx](src/App.tsx) - floating-window backdrop/card wrapper
- [d:\Vibe Coding\Sourcerer\src\App.module.css](src/App.module.css) - backdrop + card CSS
- [d:\Vibe Coding\Sourcerer\src-tauri\tauri.conf.json](src-tauri/tauri.conf.json) - `transparent: true` added

## Decisions Made

- `LogoCluster.tsx` was left untouched (not in this plan's `files_modified` scope); its Phase-1 "·"+"Home" crumb still renders to the left of the new DIVI chip. Only the test's assertions were updated per the plan's explicit instruction ("replace the Phase-1 crumb assertions", not "remove the crumb"). Flagging this for the next chrome-adjacent plan or a future cleanup pass, since UI-SPEC's title-bar content row does not list the old crumb.
- DiviChip's active/inactive boolean is sourced from `railApplet === "Home"`, a pre-existing session-only store field — no new store field was needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All three tasks' verification gates passed on first attempt: `TitleBar.test.tsx` green (4/4, then full suite 12/12), Task 3's node gate printed `OK`, and `npm run build` succeeded.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 40px/floating-window frame is now correct for Rail (plan 03) and Dock (later plans) to mount into.
- Rail-toggle buttons already wired to `cycleRailMode()` — Rail component just needs to read `railMode`/`railWidth` from the same store to render consistently with the title-bar toggles.
- Known follow-up: `LogoCluster.tsx`'s leftover "·"+"Home" crumb should be reconciled with the UI-SPEC title-bar content row in a later pass (not blocking, cosmetic-only).

## Known Stubs

- `DiviChip`'s click handler is a console-stub — no Home overlay exists yet to toggle (explicitly D-03 chrome-only scope; Phase 6/HOME-01 will wire real behavior).

## Self-Check: PASSED

- Files verified on disk: src/shell/DiviChip.tsx, src/shell/DiviChip.module.css, src/shell/RailToggleButtons.tsx, src/shell/RailToggleButtons.module.css, src/App.module.css, src/App.tsx (modified), src/shell/TitleBar.tsx (modified), src-tauri/tauri.conf.json (modified)
- Commits verified in git log: 6bbd7dd (feat components), bb2aa8d (feat TitleBar rework), 06f27ca (feat floating window)

---
*Phase: 02-workspace-core*
*Completed: 2026-07-08*
