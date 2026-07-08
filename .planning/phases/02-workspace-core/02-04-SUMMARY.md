---
phase: 02-workspace-core
plan: 04
subsystem: ui
tags: [rail, pointer-events, zustand, css-modules, drag-resize, reorder]

# Dependency graph
requires:
  - phase: 02-workspace-core
    provides: "shellStore (plan 02-01): railMode/railWidth/railOrder/leftRailPinned/railApplet/badges + cycleRailMode/reorderRail/togglePin actions"
  - phase: 02-workspace-core
    provides: "AppShell body-row structure fixed by the 02-03 human-verify checkpoint (full-width TitleBar row, AssistantPanel in the body row) — Rail mounts as a sibling inside that row, not nested in .main"
provides:
  - "Rail.tsx: 3-mode (expanded/compact/hidden) left rail rendering railOrder with glyph+label rows, 12px badge pills (hidden when count is 0), 2px accent active-row border, fixed footer group (Applet Catalog + Casey/HUMAN user block)"
  - "railSnap.ts: pure snapWidthToMode(raw) bucketing a raw drag width into hidden/compact/expanded per CLOSE_AT(44)/COMPACT_AT(132)/EXPANDED_MAX(520), mirroring tokens.css 1:1"
  - "useRailDrag.ts: setPointerCapture-based resize hook (live snap during drag), Cmd/Ctrl-\\ + double-click mode cycling, 5px-threshold row reorder (arrayMove via reorderRail), getVisualRailOrder (unpinned-then-pinned render order), pin-toggle wrapper"
  - "AppShell mounts <Rail /> as the first child of the body row, left of .main"
affects: [Dock, PanelBody, appletDefs, plan-02-05, plan-02-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bespoke pointer-capture gestures (setPointerCapture on the target element + pointermove/pointerup listeners added directly to it) instead of window-level mouse listeners, per CLAUDE.md's locked rail/assistant pattern"
    - "Pure snap/threshold functions (railSnap.ts) kept separate from the stateful gesture hook so boundary behavior is unit-testable without DOM/pointer mocking"
    - "getVisualRailOrder(railOrder, pinned) as the single shared function between render (Rail.tsx) and reorder math (useRailDrag.ts) so both agree on what a rendered row index means"

key-files:
  created:
    - src/shell/Rail.tsx
    - src/shell/Rail.module.css
    - src/shell/railSnap.ts
    - src/shell/railSnap.test.ts
    - src/shell/useRailDrag.ts
  modified:
    - src/app/AppShell.tsx
    - src/app/AppShell.module.css

key-decisions:
  - "AppShell does NOT compute the rail's pixel width itself (as the plan's original wording described) — Rail.tsx reads railMode/railWidth/liveSnap internally and sizes itself, since the 02-03 checkpoint fixed AppShell's body row to a flat flex layout ([Rail | .main | AssistantPanel]) rather than a nested grid AppShell owned width math for. This keeps AppShell a pure mount-point list, matching how TitleBar/AssistantPanel already self-manage."
  - "Badge rendered as a 12px pill (bg --color-muted, dark text) in BOTH expanded and compact rows, per UI-SPEC's literal wording ('12px pill ... top-right in compact / inline-right in expanded'), even though the .dc.html prototype's expanded row badge is plain text with no pill background. UI-SPEC is the authoritative design contract over the prototype where they disagree."
  - "Pin-to-bottom-group implemented as a hover-visible per-row toggle button (○ unpinned / ● pinned, calling togglePin(key)) rather than 'drag into the footer group' — the plan offered both as acceptable ('e.g. a pin control on hover, or drag into the footer group'); the explicit button is simpler and reliably testable via source-assertion."
  - "Reorder-across-pin-groups (dragging an unpinned row visually into the pinned tail, or vice versa) does not persist a cross-group position: since Rail.tsx always re-partitions railOrder into [unpinned..., pinned...] for render via getVisualRailOrder, an item's group membership is controlled solely by leftRailPinned/togglePin, not by drop position. Reordering is fully faithful WITHIN a group; a cross-group drop still lands the dragged item as a same-group reorder relative to its final array-adjacency. This matches the plan's two independent asks (reorder + pin) without inventing a merged interaction the source prototype never had (it has no left-rail pinning concept at all)."

patterns-established:
  - "Snap-threshold pure functions (railSnap.ts) as the sole source of truth for drag-resize bucketing, imported by both the gesture hook and (indirectly) mirrored 1:1 against tokens.css constants"
  - "Hook-owns-imperative-store-calls, component-owns-render: useRailDrag exposes handlers + derived state (liveSnap, rowDrag) and thin action wrappers (togglePin); Rail.tsx never calls shellStore.getState() for drag-derived actions directly"

requirements-completed: [RAIL-01, RAIL-02, RAIL-03, DOCK-06]

# Metrics
duration: ~25min
completed: 2026-07-07
---

# Phase 2 Plan 04: Bespoke Three-Mode Left Rail Summary

**Built the left rail's full interaction surface — pointer-capture drag-resize with snap thresholds, Cmd/Ctrl-\\ and double-click mode cycling, 5px-threshold within-rail reorder with a drop-line indicator, and a pin-to-bottom-group toggle — mounted into the AppShell body row established by the 02-03 chrome-rework checkpoint.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-07
- **Tasks:** 3 (all `type="auto"`, one `tdd="true"`)
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments
- `Rail.tsx` renders all 13 `railOrder` applets in expanded (36px rows, glyph+label+badge) and compact (40×40 tiles) modes, plus a 6px hidden hover-strip, with a fixed footer group (Applet Catalog + Casey/HUMAN user block) that always renders last.
- `railSnap.ts` — pure, fully unit-tested `snapWidthToMode(raw)` bucketing function (8 boundary tests: negative, 0, 43, 44, 131, 132, 300, 600), matching the CSS token thresholds (`--rail-close-at: 44`, `--rail-compact-at: 132`, `--rail-expanded-max: 520`) 1:1.
- `useRailDrag.ts` — bespoke `setPointerCapture`-based resize (live snap preview while dragging), Cmd/Ctrl-`\` + double-click mode cycling, 5px-threshold row reorder (splice/`arrayMove` semantics matching the prototype's own adjustment logic), and a `getVisualRailOrder` helper shared between render and reorder math.
- Pin-to-bottom-group: a hover-visible `○`/`●` toggle per expanded row calling `togglePin(key)`; pinned keys always render after unpinned keys, before the footer.
- `AppShell.tsx` mounts `<Rail />` as the first child of the body row (left of `.main`), preserving the 02-03 checkpoint's invariants: full-width `TitleBar` row and `AssistantPanel` mounted in the body row's right slot — neither was touched.

## Task Commits

Each task was committed atomically:

1. **Task 1: AppShell grid rework + Rail render (3 modes, rows, badges, footer)** - `b63ce01` (feat)
2. **Task 2: Pointer-capture resize hook + snap thresholds + keyboard/double-click cycling** - `f37ac6e` (test — railSnap.ts + railSnap.test.ts + useRailDrag.ts resize/keyboard/dblclick, all added together since railSnap.test.ts is the TDD-relevant artifact)
3. **Task 3: Within-rail reorder (5px threshold, drop-line, arrayMove) + pin** - `33dbcb4` (feat)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- [d:\Vibe Coding\Sourcerer\src\shell\Rail.tsx](src/shell/Rail.tsx) - 3-mode rail component: rows, badges, footer, drop-line, pin button; wires useRailDrag
- [d:\Vibe Coding\Sourcerer\src\shell\Rail.module.css](src/shell/Rail.module.css) - Token-driven CSS for all three modes, drop-line indicators, pin button
- [d:\Vibe Coding\Sourcerer\src\shell\railSnap.ts](src/shell/railSnap.ts) - Pure `snapWidthToMode(raw)` + threshold constants
- [d:\Vibe Coding\Sourcerer\src\shell\railSnap.test.ts](src/shell/railSnap.test.ts) - 8 boundary-case unit tests, all green
- [d:\Vibe Coding\Sourcerer\src\shell\useRailDrag.ts](src/shell/useRailDrag.ts) - Resize/keyboard/dblclick/reorder/pin gesture hook + `getVisualRailOrder`
- [d:\Vibe Coding\Sourcerer\src\app\AppShell.tsx](src/app/AppShell.tsx) - Mounts `<Rail />` in the body row, left of `.main`
- [d:\Vibe Coding\Sourcerer\src\app\AppShell.module.css](src/app/AppShell.module.css) - Updated stale comments to reflect Rail's sibling (not nested) position

## Decisions Made
- AppShell stays a thin mount-point list; Rail self-sizes from the store rather than AppShell computing/passing a width — required by the 02-03 checkpoint's flat flex body row (see key-decisions in frontmatter for full rationale).
- Badge rendered as a pill in both modes (UI-SPEC over prototype where they disagree).
- Pin affordance is an explicit hover button, not a drag-into-footer gesture.
- Cross-pin-group drag reorders within the dragged item's own group rather than inventing a merged reorder+pin interaction absent from the source prototype.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 3's verify script required `useRailDrag.ts` to contain `togglePin`, but the pin toggle was initially wired as a direct `shellStore.getState().togglePin(key)` call in `Rail.tsx`**
- **Found during:** Task 3 verification (`node -e "...for(const t of ['reorderRail','togglePin'])..."` against `useRailDrag.ts`)
- **Issue:** The plan's automated verify checks `useRailDrag.ts`'s own source for `togglePin`; calling the store action directly from `Rail.tsx` left that string absent from the hook file, failing the gate.
- **Fix:** Added a thin `togglePin(key)` wrapper to `useRailDrag.ts` (calls `shellStore.getState().togglePin(key)`) and returned it from the hook; `Rail.tsx`'s pin button now calls the hook's `togglePin`, keeping all rail gesture/action wiring behind one seam (consistent with the hook already owning resize/keyboard/reorder actions).
- **Files modified:** src/shell/useRailDrag.ts, src/shell/Rail.tsx
- **Verification:** Re-ran the exact verify command — passed; full `npm run build` + `npx vitest run` (23/23) re-confirmed green afterward.
- **Committed in:** `33dbcb4` (Task 3 commit — fixed before commit, not a separate commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — verify-script/architecture alignment)
**Impact on plan:** No scope change; centralizes the pin action in the same hook that owns every other rail gesture, which is arguably a cleaner shape than the plan's literal wording implied.

## Issues Encountered
None beyond the deviation above. `tsc --noEmit` is clean; `npx vitest run` passes 23/23 across all 5 test files (including the pre-existing `shellStore.test.ts` and `TitleBar.test.tsx`, confirming no regressions); `npm run build` succeeds after every task.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02-05 (Dock) can now mount `<Dock />` into `AppShell`'s `.main` column — `Rail` occupies the sibling slot to its left and does not need modification.
- Plan 02-05's Task 1 will extract a shared `appletDefs.ts` from `Rail.tsx`'s inline `railDefs` map so the dock's `PanelBody` dispatcher consumes the same glyph/title/line source — `railDefs` is exported from `Rail.tsx` today specifically to make that extraction straightforward.
- Full interactive behavior (drag-resize feel, reorder drop-line placement, pin persistence across reload) is deferred to plan 02-06's consolidated human-verify, per this plan's own `<verification>` note — nothing here blocks that pass.
- `leftRailPinned`/`railOrder` persistence (D-02 subset, plan 02-01) already covers the new pin/reorder actions with no changes needed — `togglePin`/`reorderRail` were pre-existing store actions this plan wires UI to, not new ones.

## Known Stubs
- `openCatalog()` and `openSettings()` in `Rail.tsx` are no-op console-stub handlers (Applet Catalog is Phase 4 scope; Settings applet is not built yet) — same stub idiom as `DiviChip.tsx`'s `toggleDivi`. Intentional, not a regression risk: no rendering path depends on these actually opening anything yet.

## Self-Check: PASSED
- Files verified on disk: src/shell/Rail.tsx, src/shell/Rail.module.css, src/shell/railSnap.ts, src/shell/railSnap.test.ts, src/shell/useRailDrag.ts, src/app/AppShell.tsx, src/app/AppShell.module.css
- Commits verified in git log: b63ce01 (feat, Task 1), f37ac6e (test, Task 2), 33dbcb4 (feat, Task 3)

---
*Phase: 02-workspace-core*
*Completed: 2026-07-07*
