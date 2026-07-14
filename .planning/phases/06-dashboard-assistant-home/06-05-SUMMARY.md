---
phase: 06-dashboard-assistant-home
plan: 05
subsystem: ui
tags: [react, home-dashboard, metro-cards, shellStore, dockview]

requires:
  - phase: 06-dashboard-assistant-home (Plan 06-01)
    provides: "shellStore.homeOpen/toggleHomeOpen/setHomeOpen session-only slice"
provides:
  - "src/home/cardDefs.ts — typed 33-entry cardDefs registry + DEFAULT_SECTIONS/SECTION_ORDER/SECTION_LABELS"
  - "src/home/HomeCard.tsx — CardBody/CardFrame port covering all ~18 card variants, static (non-draggable) HomeCard component"
  - "src/shell/Home.tsx — metro dashboard overlay (PINNED/FRESH/LIVING/ARCHIVE), mounted absolute-inset over .main"
  - "DiviChip + LogoCluster wired to the single shellStore.homeOpen boolean (RESEARCH Pitfall 4 resolved)"
  - "AppShell best-effort empty-dock -> setHomeOpen(true) wiring (D-04)"
affects: [06-06 (Home drag-and-drop + host.storage persistence)]

tech-stack:
  added: []
  patterns:
    - "Static demo-card port: JS h(tag,props,kids) createElement calls converted 1:1 to JSX, literal hex/px preserved verbatim (pixel-perfect fidelity)"
    - "Single-boolean visibility source of truth: shellStore.homeOpen driven by two entry points (DiviChip toggle, LogoCluster open), never a derived/parallel signal"

key-files:
  created:
    - src/home/cardDefs.ts
    - src/home/HomeCard.tsx
    - src/shell/Home.tsx
    - src/shell/Home.module.css
    - src/shell/Home.test.tsx
  modified:
    - src/shell/DiviChip.tsx
    - src/shell/LogoCluster.tsx
    - src/app/AppShell.tsx

key-decisions:
  - "06-05: Home's section membership/order seeded from DEFAULT_SECTIONS into local component useState this plan (no persistence, no drag) — Plan 06-06 installs dnd-kit and replaces this local state with the host.storage-backed slice (D-05)"
  - "06-05: onOpen best-effort dock integration — closes Home then calls addAppletToDock(to) only when `to` matches a real appletDefs key (Library/Wiki/Graph/Chat/Writing), otherwise a no-op close; real cross-surface navigation stays out of scope"
  - "06-05: empty-dock -> Home summon wired in AppShell via a short poll for dockApiRef + onDidLayoutChange subscription (dockApiRef is set by Dock.tsx's own mount effect, a descendant committed before AppShell's effect, but the poll guards against ordering changes)"

patterns-established:
  - "Home dashboard demo-card port: convert home-cards.js's h()-based renderers to typed JSX 1:1, no behavior/visual simplification"

requirements-completed: [HOME-01]

duration: ~25min
completed: 2026-07-14
---

# Phase 6 Plan 5: Home Metro Dashboard (Static Cards) Summary

**Ported the design handoff's 33-entry demo card registry and all ~18 card-variant renderers into typed TSX, then wired a real `homeOpen` overlay (PINNED/FRESH/LIVING/ARCHIVE) behind DiviChip and LogoCluster, replacing DiviChip's stale `railApplet === "Home"` chrome placeholder.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 completed
- **Files modified:** 8 (5 created, 3 edited)

## Accomplishments

- `src/home/cardDefs.ts`: typed `CardDef`/`CardVariant`/`CardMark` union + all 33 `cardDefs` entries, `DEFAULT_SECTIONS`, `SECTION_ORDER`, `SECTION_LABELS` — no field dropped or simplified from the reference.
- `src/home/HomeCard.tsx`: `markEl`, `shim`, `CardBody` (all ~18 variant branches: metric/spark/progress/excerpt/timeline/skeleton/compare/graph/chain/feed/annotation/cluster/stack/action/entitywiki/entitylive/audit + default), `CardFrame` (archive-list + living special cases), and a static `HomeCard` component (no `useSortable`/dnd-kit import — Plan 06-06 scope).
- `src/shell/Home.tsx` + `Home.module.css`: the metro overlay rendering all four sections from `DEFAULT_SECTIONS` (seeded into local state), ARCHIVE ◧ CARDS / ≡ LIST toggle, empty-section copy per UI-SPEC, `position:absolute; inset:0; z-index:55` over `.main`.
- `DiviChip.tsx`: active styling + click handler now read/write `shellStore.homeOpen` — the stale `railApplet === "Home"` comparison is gone.
- `LogoCluster.tsx`: `openHome` now calls `shellStore.getState().setHomeOpen(true)`.
- `AppShell.tsx`: mounts `{homeOpen && <Home/>}` inside `.main`, plus a best-effort empty-dock check (via `getDockApi()` + `onDidLayoutChange`) that summons Home when the dock has zero panels (D-04).
- `Home.test.tsx`: 5 tests covering all `<behavior>` bullets — section rendering, ARCHIVE toggle, DiviChip toggling `homeOpen`, active styling reflecting `homeOpen` (not the stale rail-applet signal), and overlay DOM presence gated by `homeOpen`.

## Verification

- `npx tsc --noEmit -p tsconfig.json` — clean.
- `npx vitest run src/shell/Home.test.tsx` — 5/5 passed.
- `npx vitest run src/shell src/home src/app` — 15 files, 72/72 passed (pre-existing `PanelBody.errorBoundary.test.tsx` console noise, unrelated to this plan).
- `npx vitest run` (full suite) — 24 files, 152/152 passed. A handful of unhandled-rejection console errors surface from `AssistantPanel.test.tsx`/`src/host/ai.ts` (Phase 7 code, untouched by this plan) — pre-existing test noise, out of scope per the deviation-rules scope boundary.
- Acceptance-criteria greps: `cardDefs` count = 34 (≥33 data entries + interface field), `export const cardDefs/DEFAULT_SECTIONS/SECTION_ORDER` all present, `useSortable`/`@dnd-kit` count = 0 in HomeCard.tsx, `PINNED/FRESH/LIVING/ARCHIVE` present in Home.tsx, stale `railApplet === "Home"` selector count = 0 in DiviChip.tsx, `homeOpen` present in both DiviChip.tsx and AppShell.tsx, `setHomeOpen(true)` present in LogoCluster.tsx.

## Task Commits

1. **Task 1: Port cardDefs.ts + HomeCard.tsx (static registry + card renderers)** - `b2a444b` (feat)
2. **Task 2: Home.tsx overlay + wire DiviChip/LogoCluster + AppShell mount** - `29af1dd` (feat)

## Files Created/Modified

- `src/home/cardDefs.ts` - typed 33-entry card registry + DEFAULT_SECTIONS/SECTION_ORDER/SECTION_LABELS
- `src/home/HomeCard.tsx` - CardBody/CardFrame port (all variants) + static HomeCard component
- `src/shell/Home.tsx` - metro dashboard overlay (4 sections, ARCHIVE toggle, empty state)
- `src/shell/Home.module.css` - overlay + section/grid/toggle styling
- `src/shell/Home.test.tsx` - behavior coverage (5 tests)
- `src/shell/DiviChip.tsx` - active/toggle now driven by `shellStore.homeOpen`
- `src/shell/LogoCluster.tsx` - `openHome` wired to `setHomeOpen(true)`
- `src/app/AppShell.tsx` - mounts `<Home/>` overlay + empty-dock summon wiring

## Decisions Made

- Section membership/order stays local `useState` seeded from `DEFAULT_SECTIONS` this plan (no persistence, no drag) — Plan 06-06 installs dnd-kit and swaps in the `host.storage`-backed slice (D-05).
- `onOpen` performs a best-effort dock open only for `to` values matching a real `appletDefs` key; otherwise it just closes Home. Real cross-surface navigation stays out of scope per 06-CONTEXT.md.
- Empty-dock detection lives in `AppShell.tsx` (not `Dock.tsx`) via a short poll for `dockApiRef` plus an `onDidLayoutChange` subscription, since `Dock.tsx` always seeds Wiki/Library on a fresh/failed restore and never itself observes a truly empty state.

## Deviations from Plan

None - plan executed exactly as written. Two literal-string acceptance-criteria greps (`PINNED/FRESH/LIVING/ARCHIVE` in Home.tsx; stale `railApplet === "Home"` absent from DiviChip.tsx) required rewording doc comments so they didn't accidentally match/mismatch the grep patterns via comment text — no functional change, just comment wording.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06-06 can install `@dnd-kit/core`/`@dnd-kit/sortable`, wrap `Home.tsx`'s section grids in a `DndContext`/`SortableContext`, swap `HomeCard`'s static render for a `useSortable`-wrapped variant, and replace the local `useState` card-section state with a `host.storage`-backed persisted slice (D-05) — none of this plan's static rendering needs restructuring for that.
- `＋ MAKE CARD` (D-06 assistant -> Home hand-off) still needs its shell-level action wired against `shellStore.pendingCardMint` (already added in 06-01) — out of this plan's scope.

---
*Phase: 06-dashboard-assistant-home*
*Completed: 2026-07-14*

## Self-Check: PASSED

- FOUND: src/home/cardDefs.ts
- FOUND: src/home/HomeCard.tsx
- FOUND: src/shell/Home.tsx
- FOUND: src/shell/Home.module.css
- FOUND: src/shell/Home.test.tsx
- FOUND commit b2a444b: feat(06-05): port cardDefs.ts + HomeCard.tsx
- FOUND commit 29af1dd: feat(06-05): Home.tsx overlay + wire DiviChip/LogoCluster + AppShell mount
