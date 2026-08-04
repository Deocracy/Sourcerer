---
phase: 02-workspace-core
plan: 01
subsystem: ui
tags: [zustand, dockview-core, nanoid, css-tokens, chrome-rework, shell-store]

# Dependency graph
requires:
  - phase: 01-shell-foundation
    provides: "tokens.css :root token set + CSS-Modules convention that Phase 2 extends additively"
provides:
  - "zustand 5.0.14, nanoid ^5, dockview-core 2.0.0 installed behind an approved legitimacy gate"
  - "Chrome Rework token deltas in tokens.css: 40px titlebar, green accent #86A38C, --window-*/--rail-*/--tab-bar-h groups (D-03)"
  - "Typed Zustand shell store (shellStore + useShellStore) with cycleRailMode/reorderRail/togglePin/badges + D-02 persistence subset"
affects: [Rail, Dock, TitleBar, DiviChip, RailToggleButtons, AppShell, persistence]

# Tech tracking
tech-stack:
  added: [zustand@5.0.14, nanoid@^5.1.16, dockview-core@2.0.0]
  patterns:
    - "Zustand vanilla store + load()/persist() localStorage round-trip, scoped to a D-02 subset"
    - "useShellStore(selector) React binding over the vanilla store (useStore from zustand)"
    - "Additive tokens.css edits: extend comment-header groups, never reflow"

key-files:
  created:
    - src/store/shellStore.ts
    - src/store/shellStore.test.ts
  modified:
    - package.json
    - package-lock.json
    - src/styles/tokens.css

key-decisions:
  - "dockview-core pinned to exact 2.0.0 (no caret); zustand pinned exact 5.0.14; nanoid ^5.1.16"
  - "Persisted only railMode/railWidth/railOrder/leftRailPinned (D-02); activePaneId/railApplet/badges are session-only"
  - "load() wraps JSON.parse in try/catch -> {} on corrupt state (T-02-01 mitigation)"

patterns-established:
  - "Zustand vanilla store + persist-on-change scoped to a subset (not the Phase-3 persistence contract)"
  - "arrayMove helper for railOrder reorder (splice semantics)"

requirements-completed: [RAIL-01, RAIL-02, RAIL-03]

# Metrics
duration: ~12min
completed: 2026-07-07
---

# Phase 2 Plan 01: Foundation (locked deps + Chrome Rework tokens + shell store) Summary

**Installed zustand 5.0.14 / nanoid / dockview-core 2.0.0 behind an approved legitimacy gate, applied the Chrome Rework token deltas (40px titlebar, green #86A38C accent, window/rail/tab token groups), and shipped the typed Zustand shell store (cycleRailMode/reorderRail/togglePin/badges) persisting the D-02 subset.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-07
- **Tasks:** 3 (1 blocking-human gate approved by coordinator + 2 auto)
- **Files modified:** 5 (3 modified, 2 created)

## Accomplishments
- Three locked libraries installed and version-pinned (dockview-core & zustand exact, nanoid ^5), 0 vulnerabilities.
- tokens.css reworked additively per D-03: `--titlebar-h` 34px→40px, new green `--color-accent: #86A38C` (+ hover, secondary color roles), and full `--window-*`, `--rail-*`, `--tab-bar-h` groups — Phase-1 spacing/type groups untouched.
- Typed `ShellState` Zustand vanilla store with `cycleRailMode` (expanded→compact→hidden→expanded), `reorderRail` (arrayMove), `togglePin`, `setBadge`, seeded with the fixed 13-applet order; `useShellStore` selector hook for React.
- Persistence scoped to the D-02 subset only (railMode/railWidth/railOrder/leftRailPinned) on `sourcerer-shell-store-v1`, guarded by a try/catch `load()`.

## Task Commits

1. **Task 1: Package legitimacy gate** — approved by coordinator (npm registry verified: zustand@5.0.14 pmndrs, nanoid 5.1.16 ai, dockview-core@2.0.0 mathuo); no commit (gate only).
2. **Task 2: Install locked deps + Chrome Rework token deltas** — `9d2205e` (feat)
3. **Task 3 (RED): failing shell-store spec** — `db97c7c` (test)
4. **Task 3 (GREEN): typed Zustand shell store** — `3f9d58f` (feat)

**Plan metadata:** see final docs commit.

## Files Created/Modified
- [d:\Vibe Coding\Sourcerer\src\store\shellStore.ts](src/store/shellStore.ts) - Typed Zustand vanilla shell store + useShellStore hook + load/persist
- [d:\Vibe Coding\Sourcerer\src\store\shellStore.test.ts](src/store/shellStore.test.ts) - Vitest coverage for cycle/reorder/pin/badge + persistence subset
- [d:\Vibe Coding\Sourcerer\src\styles\tokens.css](src/styles/tokens.css) - Chrome Rework token deltas (40px titlebar, green accent, window/rail/tab groups)
- [d:\Vibe Coding\Sourcerer\package.json](package.json) - Added zustand/nanoid/dockview-core (pinned)
- [d:\Vibe Coding\Sourcerer\package-lock.json](package-lock.json) - Lockfile for the three new deps

## Decisions Made
- dockview-core pinned to exact `2.0.0` and zustand to exact `5.0.14` (coordinator directive + CLAUDE.md lock); nanoid left at `^5.1.16` per plan's `^5` spec.
- Session-only slices (activePaneId, railApplet, badges) deliberately excluded from persistence to honor the D-02 near-free scope (not the Phase-3 persistence contract).

## Deviations from Plan
None - plan executed exactly as written. (Only nuance: dockview-core initially resolved as `^2.0.0` from `npm install`; re-pinned to exact `2.0.0` per the plan's "dockview-core@2.0.0" lock and coordinator instruction — a version-pin correction, not a scope change.)

## Issues Encountered
None. RED spec failed as expected (module-not-found), GREEN passed all 5 tests, `tsc --noEmit` clean.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `shellStore`/`useShellStore` ready for Rail, DiviChip, RailToggleButtons, and AppShell to consume (02-02+).
- Chrome-delta tokens in place so all rail/dock chrome renders against the correct 40px/green frame (D-03 satisfied).
- dockview-core installed and ready for the Dock integration plan.
- Persistence is a deliberate D-02 placeholder on localStorage; Phase 3 (PERS-01..04) owns the real crash-safe/versioned contract.

## Self-Check: PASSED

- Files verified on disk: src/store/shellStore.ts, src/store/shellStore.test.ts, src/styles/tokens.css
- Commits verified in git log: 9d2205e (feat tokens+deps), db97c7c (test RED), 3f9d58f (feat store)

---
*Phase: 02-workspace-core*
*Completed: 2026-07-07*
