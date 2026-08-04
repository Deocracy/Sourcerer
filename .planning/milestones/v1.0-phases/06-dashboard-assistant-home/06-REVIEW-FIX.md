---
phase: 06-dashboard-assistant-home
fixed_at: 2026-07-14T21:15:00Z
review_path: .planning/phases/06-dashboard-assistant-home/06-REVIEW.md
iteration: 1
findings_in_scope: 12
fixed: 12
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-07-14
**Source review:** .planning/phases/06-dashboard-assistant-home/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 12 (3 Critical + 9 Warning; fix_scope=critical_warning, 7 Info findings out of scope)
- Fixed: 12
- Skipped: 0

Full suite after fixes: **193/193 passed** (up from 175 baseline — 18 new tests added), `tsc --noEmit` clean. The residual "unhandled errors" in vitest output are the pre-existing benign unmocked-Tauri-Channel rejections in tests that render AssistantPanel without mockIPC; the count scales with test count, not a regression.

## Fixed Issues

### CR-01: Assistant resize snap used the panel's own width as `hostWidth`

**Files modified:** `src/assistant/useAssistantResize.ts`, `src/assistant/useAssistantResize.test.tsx` (new)
**Commit:** 4f600d8
**Applied fix:** `hostWidth` is now `window.innerWidth` (the workspace-scale drag context the snap math and its unit tests assume) instead of `hostRect.width`. Added an integration-shaped hook test exercising the hook's actual inputs at the default 280px panel geometry — **fail-pre-fix verified** (2 of 3 tests fail when the old measurement is restored): release at raw=300 → `{mode:"open", width:300}`, full snap → `window.innerWidth - 160` not 120px.

### CR-02: `loadSections()` blind-cast untrusted persisted JSON

**Files modified:** `src/home/homeCards.storage.ts`, `src/home/homeCards.storage.test.ts` (new)
**Commit:** 3512057
**Applied fix:** Added `isValidSectionMap` structural guard (every `SECTION_ORDER` key present as a string array) applied before the value is returned — matching the project's `validate.ts` standard. New tests feed `{"pins":"corrupt"}`, `[]`, `42`, `{"pins":[1,2]}`, missing-key maps and assert `DEFAULT_SECTIONS` fallback (the coverage T-06-06-01 claimed existed).

### CR-03: Session-switch race — stale `host.loadSession` history overwrote the new session's thread

**Files modified:** `src/assistant/AssistantPanel.tsx`, `src/assistant/AssistantPanel.test.tsx`
**Commit:** 9026b33
**Applied fix:** The active-session effect now sets a `stale` flag in its cleanup; a superseded stream's events are dropped in `onEvent`. Added a race test that switches from session A to session B, then delivers A's late `history` event and asserts B's thread is untouched.

### WR-01: Minted card ids persisted while their defs were not — ghost ids accumulated forever

**Files modified:** `src/home/homeCards.storage.ts`, `src/home/homeCards.storage.test.ts`
**Commit:** f852f5b
**Applied fix:** `loadSections` now filters ids with no `cardDefs` entry at load time (option (b) from the review — card content stays demo-scoped per D-05), so the persisted map stays bounded and `findSection`/drag never iterate ghosts. Test asserts `minted-…` ghosts are pruned.

### WR-02: Emptied sections could never receive a drop

**Files modified:** `src/shell/Home.tsx`
**Commit:** d0c1de3
**Applied fix:** Each section body is wrapped in a new `SectionDroppable` (`useDroppable({ id: sec })`), rendered even when empty, so `over.id` can resolve to the section key `moveBetweenSections` already handles. Status: **fixed — requires human verification** (dnd-kit pointer simulation is unreliable in jsdom per the project's own RESEARCH.md note, so the drop-into-empty-section interaction needs a live drag check).

### WR-03: `closeSession` never removed real sessions — resurrection + unbounded persisted list

**Files modified:** `src/assistant/AssistantPanel.tsx`, `src/assistant/AssistantPanel.test.tsx`
**Commit:** d9a2baf
**Applied fix:** Real sessions are now removed from `realSessions` (letting the persistence effect shrink the stored list); `closedIds` is kept only for the static seeds. Test mints a second session, closes it, and asserts the persisted list shrinks to one id.

### WR-04: History replay dropped proposal parsing and left a stale `focusedProposalId`

**Files modified:** `src/assistant/AssistantPanel.tsx`, `src/assistant/AssistantPanel.test.tsx`
**Commit:** 8c41454
**Applied fix:** Extracted a shared `attachProposalToLastAssistantTurn` helper used by BOTH the seeded and `history`-replay paths; the replay path now re-points (or clears) `focusedProposalId`, so a dangling focus id can no longer swallow bare y/d/n keypresses shell-wide. Test replays a history transcript carrying a proposal and asserts the y/d/n block renders.

### WR-05: `CardBody({ t })` dereferenced `t` before the callers' null guards could run

**Files modified:** `src/home/HomeCard.tsx`
**Commit:** f170331
**Applied fix:** `CardBody` signature widened to `t: CardDef | undefined`; after its (unconditional, hook-ordering-safe) useState hooks it bails out to an empty `CardBodyResult` when `t` is undefined, so unknown ids degrade instead of throwing.

### WR-06: No `pointercancel` handling — interrupted drags leaked listeners and pinned the snap cue

**Files modified:** `src/assistant/useAssistantResize.ts`, `src/assistant/useAssistantResize.test.tsx`
**Commit:** 1f3118f
**Applied fix:** Shared `teardown()` (releasePointerCapture in try/catch, removes all three listeners, clears `liveSnap`) reused by `handleUp` and a new `handleCancel` for `pointercancel`; a cancelled drag applies no snap. Test cancels mid-drag and asserts the post-cancel pointerup is inert.

### WR-07: Home's debounced section save had no close-flush and no write serialization

**Files modified:** `src/home/homeCards.storage.ts`, `src/persistence/workspaceStore.ts`, `src/home/homeCards.storage.test.ts`
**Commit:** d5b6e15
**Applied fix:** Added `flushPendingSectionsSave()` plus a write-serializing promise chain (mirroring workspaceStore's `enqueueWrite`), and a `registerCloseFlusher` seam in workspaceStore so `flushPendingSave` (the `workspace:flush-before-close` authority) drains auxiliary writers in parallel. Note: the first cut awaited the aux flushers BEFORE `flushNow()`, which shifted the workspace getters' read timing and broke two existing workspaceStore serialization tests — repaired by invoking `flushNow()` in the same synchronous tick inside the `Promise.all` (commit amended; all 18 workspaceStore tests green).

### WR-08: `onDragEnd` with `over == null` left onDragOver moves on screen but never persisted

**Files modified:** `src/shell/Home.tsx`
**Commit:** bf92d4d
**Applied fix:** The null-target arm now schedules a save of the settled section state so screen and disk agree. Status: **fixed — requires human verification** (same jsdom drag-simulation limitation as WR-02; verify with a live drag released outside any droppable).

### WR-09: Assistant session-id list persisted in raw `localStorage`

**Files modified:** `src/assistant/sessionIdsStorage.ts` (new), `src/assistant/AssistantPanel.tsx`, `src/assistant/AssistantPanel.test.tsx`
**Commit:** 9a9a803
**Applied fix:** New `sessionIdsStorage.ts` routes the id list through `LazyStore("applets.json")` under `sourcerer:assistant:sessionIds` (same file/namespace convention as Home's persistence), with a never-throws load, best-effort save, and a **one-time legacy localStorage migration** so sessions persisted by earlier builds are not orphaned. The panel now hydrates asynchronously (placeholder fresh session for first paint, persist effect gated on hydration, `sessionsDirtyRef` guard mirroring Home.tsx's Rule-1 fix). Tests converted from localStorage seeding to an in-memory plugin-store mock; a new test covers the legacy migration.

## Skipped Issues

None — all 12 in-scope findings were fixed.

## Notes for the orchestrator

- Out of scope (fix_scope=critical_warning): IN-01 … IN-07 remain open.
- Two fixes flagged "requires human verification" (WR-02, WR-08): drag-and-drop interactions cannot be exercised in jsdom; a quick live pass (drag last card out of LIVING then drop one back in; release a cross-section drag outside any droppable then restart) confirms them.
- CR-01 should also get a live sanity check: drag the assistant grip from the default width and confirm intermediate widths stick (the pre-fix build could only close or 120px-"full").
- Commits live on the fast-forwarded branch history: 4f600d8, 3512057, 9026b33, f852f5b, d0c1de3, d9a2baf, 8c41454, f170331, 1f3118f, d5b6e15, bf92d4d, 9a9a803.

---

_Fixed: 2026-07-14_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
