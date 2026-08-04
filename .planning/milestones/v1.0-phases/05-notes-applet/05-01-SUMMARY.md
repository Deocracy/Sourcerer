---
phase: 05-notes-applet
plan: 01
subsystem: ui
tags: [react, zustand, tauri-plugin-store, applet-framework, notes]

# Dependency graph
requires:
  - phase: 04-applet-framework
    provides: registry.ts static map, host seam (storage/ai/open/instanceId/theme), instanceState reserved seam, boundary.test.ts, appletDefs
provides:
  - Notes as the first real (non-stub) applet — create/edit/delete persistent notes, auto-save, per-tab selected-note memory
  - Completed src/host/instanceState.ts seam (scheduleWorkspaceSave re-export)
  - Module-level zustand/vanilla shared-store pattern for applet-owned data (a second precedent alongside src/store/shellStore.ts)
affects: [05-02 (host.ai() Summarize on Notes), any future phase replacing another templated stub]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Applet-owned module-level zustand/vanilla store hydrated once from host.storage, shared live across every open instance of that applet"
    - "Per-instance UI state (selected-note-id) read/written via src/host/instanceState.ts directly, never through the host prop"

key-files:
  created:
    - src/applets/Notes/index.tsx
    - src/applets/Notes/store.ts
    - src/applets/Notes/relativeTime.ts
    - src/applets/Notes/Notes.module.css
    - src/applets/Notes/Notes.test.tsx
  modified:
    - src/host/instanceState.ts
    - src/shell/registry.ts

key-decisions:
  - "List-pane empty state omits duplicate 'No notes yet' copy (only the editor pane's empty state renders it) — avoids ambiguous duplicate text and keeps the list pane visually quiet when empty"
  - "Editor toolbar's delete button keeps a stable aria-label ('Delete note') across the two-step confirm; only its visible text flips to 'Delete for real?' — accessible name stays queryable/stable through both clicks"
  - "Notes.test.tsx uses vi.resetModules() + dynamic import('./index') per test to give each test a fresh module-level store instance, since the shared store is a deliberate app-lifetime singleton (D-04) that would otherwise leak hydration state across tests"

patterns-established:
  - "Pattern: applet-local zustand/vanilla store hydrated once via a memoized ensureHydrated(storage) promise, debounced write-through + immediate flush-on-blur — reusable by any future applet needing shared cross-tab state over host.storage"

requirements-completed: [NOTE-01]

# Metrics
duration: ~45min
completed: 2026-07-13
---

# Phase 5 Plan 1: Notes Applet (NOTE-01) Summary

**Notes replaces its templated stub with a real two-pane applet — create/edit/delete persistent notes via host.storage, a module-level zustand store mirroring edits live across tabs, and per-tab selected-note memory through the completed instanceState seam.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-07-13
- **Tasks:** 3
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments
- Notes is now a registered real applet (`registry.ts`'s `Notes: NotesModule`, replacing the generic templated stub) — the literal FWK-02 stub-swap proof
- Full CRUD vertical slice: create (prepends + selects + focuses title), edit (debounced 400ms + immediate flush-on-blur, re-sorts to top per D-01), delete (two-step inline confirm, D-02 next-note-down selection)
- Completed the `src/host/instanceState.ts` seam Phase 4 reserved for Notes (`scheduleWorkspaceSave` re-export) and used it for per-tab selected-note memory (D-06/D-07 silent GC-tolerant fallback)
- Module-level shared store (`zustand/vanilla`, D-04) hydrates once from `host.storage` and mirrors every open Notes tab live by construction
- Boundary test (`src/applets/boundary.test.ts`) and the five-member `Host` invariant (`src/host/index.test.ts`) both stay green

## Task Commits

Each task was committed atomically:

1. **Task 1: Complete the instanceState seam + author failing NOTE-01 tests (RED)** - `8b7c9fa` (test)
2. **Task 2: Notes module — shared store + two-pane create/edit/persist slice + registry swap (GREEN create/edit)** - `ae693f1` (feat)
3. **Task 3: Delete flow, per-tab selected-note memory, empty state (GREEN delete; NOTE-01 complete)** - `a4687ba` (feat)

_TDD tasks 2/3 built on Task 1's RED test file; no separate refactor commit was needed._

## Files Created/Modified
- `src/applets/Notes/index.tsx` - Notes applet root (manifest + App), two-pane list+editor, CRUD, delete confirm, per-tab selection
- `src/applets/Notes/store.ts` - module-level zustand/vanilla shared notes store (hydrate-once guard, debounced write-through, addNote/updateNote/deleteNote)
- `src/applets/Notes/relativeTime.ts` - hand-written relative timestamp formatter ("just now" / "2m ago" / "3h ago" / "4d ago")
- `src/applets/Notes/Notes.module.css` - two-pane layout, list row/active/toolbar/delete styling, all `tokens.css`-keyed
- `src/applets/Notes/Notes.test.tsx` - mocked-host component tests for create/edit/delete
- `src/host/instanceState.ts` - added `scheduleWorkspaceSave` re-export, completing the Phase-4-reserved seam
- `src/shell/registry.ts` - `Notes: NotesModule` (FWK-02 stub swap)

## Decisions Made
- List pane renders no rows (not a duplicate "No notes yet" message) when empty — only the editor pane's empty state carries that copy, avoiding an ambiguous duplicate-text UI and an ambiguous test query
- Delete button keeps a stable `aria-label="Delete note"` through both clicks of the two-step confirm; only the visible label text flips to "Delete for real?" (UI-SPEC's copy requirement) — keeps the control's accessible name queryable across the confirm window
- Test isolation for the deliberately-singleton module-level store uses `vi.resetModules()` + dynamic `import("./index")` per test, giving each test its own fresh store/hydrate-guard instance regardless of run order or whether tests run individually (`-t` filters) or together

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RED test failure mode is a module-resolution error, not an assertion failure**
- **Found during:** Task 1
- **Issue:** Task 1's acceptance criteria expected `npx vitest run src/applets/Notes/Notes.test.tsx` to fail with an "assertion/element-not-found" error, on the premise that `./index` already existed as the templated stub. In this codebase, Notes never received a "rich demo" pre-build the way Wiki/Library did in Phase 4 — there is no `src/applets/Notes/index.tsx` at all until Task 2 creates it, so the RED failure is a Vite module-resolution error ("Failed to resolve import './index'") instead.
- **Fix:** No code fix needed — this is a documentation/acceptance-wording gap in the plan, not a functional bug. The test file still correctly fails now and correctly requires Task 2's implementation to pass, satisfying the actual intent (a genuine, non-cheating RED state). Proceeded without altering the test's import shape.
- **Files modified:** none (informational only)
- **Verification:** Confirmed via `npx vitest run src/applets/Notes/Notes.test.tsx` output at Task 1 (module-resolution error) and again after Task 2 (create/edit pass, delete still correctly RED)
- **Committed in:** 8b7c9fa (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/wording gap, no code impact)
**Impact on plan:** None on functionality — the RED→GREEN TDD contract was still honestly satisfied task-by-task; only the plan's literal wording about the failure *mode* didn't match this applet's actual starting state.

## Issues Encountered
- Initial `index.tsx` draft rendered "No notes yet" in both the list pane and the editor pane's empty state, causing `getByText`/`findByText` to throw a "multiple elements" error. Resolved by removing the list pane's duplicate copy (list simply renders no rows when empty) — see Decisions Made above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- NOTE-01 (create/edit/delete, persistence, per-tab memory, live multi-tab mirror) is fully implemented and covered by automated tests (`npx vitest run src/applets/Notes` — 3/3; `npx vitest run` — 122/122 full suite green; `npx tsc --noEmit` clean)
- **Deferred to end-of-phase manual verification** (per `.planning/config.json`'s `human_verify_mode: "end-of-phase"`, and Task 3's plan-specified `<human-check>` which is not a `checkpoint:human-verify` gate in this autonomous plan): build+launch `sourcerer.exe`, create/edit notes across a relaunch to confirm on-disk persistence and per-tab selected-note-id survival, and open two Notes tabs to visually confirm the live multi-tab mirror (D-04). All three are architecturally implemented and exercised indirectly by the automated suite (store hydration, instanceState read/write, module-level singleton sharing) but not yet observed against a real running Tauri build.
- Plan 05-02 (host.ai() Summarize on Notes, NOTE-02) can build directly on this module — `host.ai` is already available on the `Host` object Notes receives; no additional seam work needed.

---
*Phase: 05-notes-applet*
*Completed: 2026-07-13*

## Self-Check: PASSED

All 7 created/modified source files confirmed present on disk; all 3 task commit hashes
(8b7c9fa, ae693f1, a4687ba) confirmed present in `git log --oneline --all`.
