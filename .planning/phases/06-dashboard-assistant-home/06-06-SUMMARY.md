---
phase: 06-dashboard-assistant-home
plan: 06
subsystem: ui
tags: [react, dnd-kit, home-dashboard, host-storage, d06-mint-consumer]

requires:
  - phase: 06-dashboard-assistant-home (Plan 06-03)
    provides: "shellStore.pendingCardMint written by the assistant's ＋MAKE CARD (D-06 producer half)"
  - phase: 06-dashboard-assistant-home (Plan 06-05)
    provides: "src/home/cardDefs.ts, src/home/HomeCard.tsx (CardBody/CardFrame), src/shell/Home.tsx static overlay"
provides:
  - "@dnd-kit/core@6.3.1, @dnd-kit/sortable@10.0.0, @dnd-kit/utilities@3.2.2 installed"
  - "src/home/homeCardsReducer.ts — pure findSection/moveBetweenSections/reorderWithinSection over SectionMap, independently unit-tested"
  - "src/home/SortableCard.tsx — useSortable-wrapped CardFrame/CardBody port + OverlayCard for DragOverlay"
  - "src/home/homeCards.storage.ts — shell-scoped (not applet host) debounced host.storage-equivalent read/write for home-cards-v1"
  - "src/shell/Home.tsx — DndContext + per-section SortableContext/DragOverlay wired to the pure reducer; D-06 consumer mints a card into FRESH from shellStore.pendingCardMint"
affects: []

tech-stack:
  added:
    - "@dnd-kit/core@6.3.1"
    - "@dnd-kit/sortable@10.0.0"
    - "@dnd-kit/utilities@3.2.2"
  patterns:
    - "Pure drag/drop reducer idiom (mirrors src/shell/railSnap.ts): module-level SectionMap functions, no React/DOM import, independently unit-tested apart from dnd-kit's DOM wiring"
    - "Shell-scoped storage helper composing src/host/storage.ts's best-effort never-throw LazyStore pattern with src/persistence/workspaceStore.ts's debounce pattern, without going through the applet-facing host factory"
    - "Runtime mutation of the shared cardDefs registry (a mutable Record, not readonly) to register a minted card's def, avoiding a second merged-lookup prop threaded through every existing render site"

key-files:
  created:
    - src/home/homeCardsReducer.ts
    - src/home/homeCardsReducer.test.ts
    - src/home/SortableCard.tsx
    - src/home/homeCards.storage.ts
    - src/home/Home.dnd.test.tsx
  modified:
    - package.json
    - package-lock.json
    - src/shell/Home.tsx

key-decisions:
  - "06-06: Minted cards are registered by mutating the shared cardDefs Record directly (cardDefs[id] = {...}) rather than threading a separate merged (cardDefs + minted) lookup prop through SortableCard/OverlayCard/CardFrame — mirrors the codebase's existing app-lifetime module-singleton precedent (Notes' shared store, 05-01) and needed zero changes to Plan 06-05's already-shipped HomeCard.tsx/SortableCard.tsx lookup sites"
  - "06-06: dirtyRef guard added to Home.tsx's mount-time loadSections() resolution so it cannot clobber a drag/mint that lands before the disk read settles (Rule 1 fix, found via Home.dnd.test.tsx flaking on the race — see Deviations)"
  - "06-06: onDragOver drives moveBetweenSections (cross-section reparenting) and onDragEnd drives reorderWithinSection (final within-section arrayMove); scheduleSaveSections is called only from onDragEnd, never from onDragOver's per-hover-frame updates (RESEARCH.md Pitfall 3)"

requirements-completed: [HOME-02]

duration: ~50min
completed: 2026-07-14
---

# Phase 06 Plan 06: Home Drag-and-Drop + Persistence + D-06 MAKE CARD Consumer Summary

**Installed dnd-kit and wired Home's four card sections into a real `DndContext`/`SortableContext`/`DragOverlay` driven by a pure, independently-tested `SectionMap` reducer, added debounced `host.storage`-equivalent persistence for section membership/order, and closed the D-06 loop by consuming `shellStore.pendingCardMint` to mint a new card into FRESH.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-07-14
- **Tasks:** 3 completed
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments

- Installed `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@dnd-kit/utilities@3.2.2` (RESEARCH-audited, all `[OK]`); smoke-verified `useSortable()`'s returned shape (`attributes, listeners, setNodeRef, transform, transition, isDragging`) still matches 1:1 across the 6.1.0→6.3.1/8.0.0→10.0.0 version gap by successfully compiling and rendering `SortableCard` against it (RESEARCH Assumption A2 resolved).
- `src/home/homeCardsReducer.ts`: extracted `findSection`/`moveBetweenSections`/`reorderWithinSection` from `home-cards.js`'s `findSec`/`onDragOver`/`onDragEnd` bodies as pure, immutable functions over `SectionMap` — no React/DOM import, mirrors `railSnap.ts`'s pure-fn idiom exactly. 12 boundary tests in `homeCardsReducer.test.ts` cover find/move/reorder, every no-op path (same-section, missing id, equal indices), and explicit input-immutability assertions.
- `src/home/SortableCard.tsx`: ported `SortableCard`/`OverlayCard` from the design handoff, wrapping `CardFrame`/`CardBody` (Plan 06-05) in `useSortable` with FLIP transform/transition styling and the reference's 250ms click-after-drag guard.
- `src/home/homeCards.storage.ts`: a dedicated shell-scoped storage helper (not the applet `Host`/`makeHost()` seam — RESEARCH Pitfall 1) over the shared `applets.json` LazyStore, namespaced `sourcerer:home:home-cards-v1`; `loadSections()` falls back to `DEFAULT_SECTIONS` on any read error (T-06-06-01), `scheduleSaveSections()` debounces writes 300ms so rapid `onDragOver` hover frames never each trigger a disk write (T-06-06-03).
- `src/shell/Home.tsx`: wrapped the four sections in a `DndContext` (`PointerSensor` with a 6px activation distance, `closestCenter` collision detection) with each section a `SortableContext`/`rectSortingStrategy` rendering `SortableCard`, plus a `DragOverlay` rendering `OverlayCard`. `onDragOver` drives `moveBetweenSections` (cross-section reparenting), `onDragEnd` drives `reorderWithinSection` and calls `scheduleSaveSections` (settled-state-only persistence). D-06: an effect keyed on `shellStore.pendingCardMint` mints a fresh id, registers its def directly into the shared `cardDefs` registry, prepends it to FRESH, persists, and clears `pendingCardMint`.
- `src/home/Home.dnd.test.tsx`: asserts the D-06 mint path directly at the component boundary (pure drag transitions are already covered by `homeCardsReducer.test.ts`, per RESEARCH's Wave-0 note that dnd-kit pointer simulation in jsdom is unreliable) — setting `pendingCardMint`, rendering `Home`, and confirming the minted card appears in FRESH and `pendingCardMint` clears.

## Task Commits

1. **Task 1: Install dnd-kit + pure homeCardsReducer.ts + tests** - `643428d` (test)
2. **Task 2: SortableCard + homeCards.storage debounced persistence** - `4a1dcc5` (feat)
3. **Task 3: Wire DndContext into Home.tsx + persistence + D-06 ＋MAKE CARD consumer** - `0c348d8` (feat)

## Files Created/Modified

- `package.json` / `package-lock.json` - dnd-kit dependency pins
- `src/home/homeCardsReducer.ts` - pure `findSection`/`moveBetweenSections`/`reorderWithinSection` over `SectionMap`
- `src/home/homeCardsReducer.test.ts` - 12 boundary + immutability tests
- `src/home/SortableCard.tsx` - `useSortable`-wrapped `CardFrame`/`CardBody` port + `OverlayCard`
- `src/home/homeCards.storage.ts` - shell-scoped debounced `home-cards-v1` read/write
- `src/shell/Home.tsx` - `DndContext`/`SortableContext`/`DragOverlay` wiring, persistence, D-06 consumer, dirtyRef race guard
- `src/home/Home.dnd.test.tsx` - D-06 mint-path component test

## Decisions Made

- Minted card defs are registered by mutating the shared `cardDefs` `Record` directly rather than threading a second merged-lookup prop through every existing render site (`SortableCard`/`OverlayCard`/`CardFrame`) — a smaller diff that needed zero changes to Plan 06-05's already-shipped lookup code, following the same app-lifetime module-singleton precedent Notes established in 05-01.
- `onDragOver` handles cross-section reparenting (`moveBetweenSections`); `onDragEnd` handles the final within-section reorder (`reorderWithinSection`) and is the only place `scheduleSaveSections` is called — matches the reference's own split and RESEARCH.md Pitfall 3's debounce requirement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Guarded Home.tsx's mount-time loadSections() resolution against clobbering a drag/mint that lands before the disk read settles**
- **Found during:** Task 3, while writing `Home.dnd.test.tsx`'s D-06 mint assertion
- **Issue:** The initial `useEffect(() => { void loadSections().then(setSections); }, [])` used an absolute `setSections(loaded)` call. If a user (or, in the test, a synchronous `pendingCardMint` update) mutated `sections` before the async `loadSections()` promise settled, the late-arriving resolution would silently overwrite the mutation with whatever `loadSections()` returned (`DEFAULT_SECTIONS` on a failed/absent read) — losing the mint or drag with no error. This surfaced as `Home.dnd.test.tsx`'s mint assertion failing intermittently depending on microtask ordering between the mount-time load and the test's synchronous store update.
- **Fix:** Added a `dirtyRef` (React `useRef<boolean>`) set to `true` inside the mint effect and both drag handlers (`onDragOver`, `onDragEnd`) before their `setSections` calls; the `loadSections().then(...)` callback now checks `dirtyRef.current` and no-ops if the user has already mutated sections locally, instead of unconditionally overwriting.
- **Files modified:** src/shell/Home.tsx
- **Verification:** `Home.dnd.test.tsx`'s mint assertion passes deterministically; full suite (`npx vitest run`) stays green (175/175).
- **Committed in:** 0c348d8 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** A genuine correctness fix for a real (if narrow-window) race condition between Home's initial persisted-layout load and any drag/mint interaction happening in the same tick — no scope creep beyond HOME-02's own persistence requirement.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- HOME-02 fully satisfied: drag between/within sections with dnd-kit FLIP, debounced `host.storage`-equivalent persistence, and the D-06 ＋MAKE CARD loop (proposal accept → `pendingCardMint` → Home card in FRESH) all wired end-to-end.
- End-of-phase human-check items (drag persists across restart; approve a proposal + ＋MAKE CARD → card appears in FRESH) remain for the phase's human-verify gate, per 06-06-PLAN.md's `<verification>` section.
- No blockers.

## Self-Check: PASSED

- FOUND: src/home/homeCardsReducer.ts (findSection/moveBetweenSections/reorderWithinSection, no React import)
- FOUND: src/home/homeCardsReducer.test.ts (12 tests, all passing)
- FOUND: src/home/SortableCard.tsx (useSortable, CSS.Transform.toString, OverlayCard)
- FOUND: src/home/homeCards.storage.ts (home-cards-v1, setTimeout/clearTimeout debounce, no makeHost)
- FOUND: src/shell/Home.tsx (DndContext/SortableContext/DragOverlay, scheduleSaveSections, pendingCardMint/clearPendingCardMint)
- FOUND: src/home/Home.dnd.test.tsx (D-06 mint assertion, 2/2 passing)
- FOUND commit 643428d: test(06-06): install dnd-kit + pure homeCardsReducer.ts + tests
- FOUND commit 4a1dcc5: feat(06-06): SortableCard + homeCards.storage debounced persistence
- FOUND commit 0c348d8: feat(06-06): wire DndContext into Home.tsx + persistence + D-06 MAKE CARD consumer
- Full suite: 175/175 tests passing (`npx vitest run`); `npx tsc --noEmit` clean

---
*Phase: 06-dashboard-assistant-home*
*Completed: 2026-07-14*
