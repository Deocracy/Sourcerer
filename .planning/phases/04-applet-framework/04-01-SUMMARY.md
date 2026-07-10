---
phase: 04-applet-framework
plan: 01
subsystem: applet-framework
tags: [host-api, tauri-plugin-store, dockview-core, react, typescript, vitest]

requires:
  - phase: 07-assistant-harness-core
    provides: src/host/ai.ts (Channel/event AI client, composed over not modified)
  - phase: 03-persistence-layouts
    provides: src/persistence/workspaceStore.ts (LazyStore idiom, mutate-then-persist pattern, instanceState slot)
  - phase: 02-workspace-core
    provides: src/shell/Dock.tsx (dockview-core instance, addAppletToDock)
provides:
  - "src/host/types.ts — Host/AppletManifest/AppletModule/AppletStorage/ThemeTokens leaf contracts (five fixed Host members, FWK-04 finalized)"
  - "src/host/index.ts — makeHost(instanceId, appletKey) factory"
  - "src/host/storage.ts — namespaced applets.json-backed host.storage"
  - "src/host/aiComplete.ts — promise+onDelta host.ai() wrapper over host/ai.ts"
  - "src/host/open.ts — host.open() D-17 focus-or-open"
  - "src/host/theme.ts — static host.theme token object"
  - "src/host/instanceState.ts — workspaceStore instanceState re-export (reserved seam)"
  - "src/shell/dockApi.ts — extracted dockApiRef/addAppletToDock/getDockApi handle"
affects: [04-02, 04-03, 04-04, 04-05, phase-05-notes]

tech-stack:
  added: []
  patterns:
    - "Per-instance factory (makeHost) over module-singleton flat-object export, adapting src/host/ai.ts's idiom"
    - "Best-effort try/catch persistence (never throw on corrupt read) mirrored from workspaceStore.loadWorkspaceRecord"
    - "dockApiRef relocated out of a React component into a plain module (dockApi.ts) so a non-React seam (host/open.ts) can reach it without importing JSX"

key-files:
  created:
    - src/host/types.ts
    - src/host/storage.ts
    - src/host/storage.test.ts
    - src/host/theme.ts
    - src/host/instanceState.ts
    - src/host/aiComplete.ts
    - src/host/aiComplete.test.ts
    - src/host/open.ts
    - src/host/open.test.ts
    - src/host/index.ts
    - src/host/index.test.ts
    - src/shell/dockApi.ts
  modified:
    - src/shell/Dock.tsx
    - src/shell/useRailDragOut.ts
    - src/persistence/workspaceStore.ts

key-decisions:
  - "host.open() uses panel.api.setActive() instead of the plan-assumed DockviewApi.setActivePanel(panel), which does not exist on dockview-core 2.0.0's public API (Rule 1 correction)"
  - "oneshot sessionId guards only the trailing character against nanoid's non-alnum alphabet; the leading character is guaranteed alnum by the fixed 'oneshot-' prefix"
  - "host/theme.ts is a static literal duplicating tokens.css (not getComputedStyle) for deterministic jsdom/vitest behavior"

patterns-established:
  - "host/ leaf modules never import registry or applet code — types.ts stays import-cycle-free"
  - "instanceState is a workspaceStore accessor + reserved seam, explicitly NOT a sixth host member"

requirements-completed: [FWK-04, FWK-01]

duration: 6min
completed: 2026-07-10
---

# Phase 04 Plan 01: Host API Seam Summary

**makeHost(instanceId, appletKey) factory assembling storage/ai/open/instanceId/theme — the five-member `host` seam applets touch, backed by a namespaced applets.json LazyStore, a promise-wrapped host.ai() over the existing Phase 7 sidecar client, and dockview focus-or-open.**

## Performance

- **Duration:** ~6 min (22:23:27 → 22:28:26, commit timestamps)
- **Tasks:** 3 completed
- **Files modified:** 15 (12 created, 3 modified)

## Accomplishments
- Finalized the `Host` type contract (types.ts) as a leaf module — exactly five members, no import cycle with registry/applet code
- Extracted `dockApiRef`/`addAppletToDock` out of Dock.tsx into a plain `src/shell/dockApi.ts` module (with a new `getDockApi()` accessor) so `host/open.ts` can reach the live dockview instance without importing a React component
- Implemented `host.storage` (namespaced, best-effort, crash-safe get/set/remove over a shared `applets.json` LazyStore)
- Implemented `host.theme` as a static token object mirroring `tokens.css`
- Added `instanceState` accessors to `workspaceStore.ts` + a thin `host/instanceState.ts` re-export (reserved seam, not a sixth host member)
- Implemented `host.ai()` (`aiComplete`) as a promise+onDelta wrapper composing over the existing `src/host/ai.ts` Channel client — never touches `invoke("host_ai")` directly
- Implemented `host.open()` (`hostOpen`) — D-17 focus-or-open against the live dockview panels
- Assembled `makeHost(instanceId, appletKey)` in `src/host/index.ts`

## Task Commits

1. **Task 1: Type contracts + dockApi extraction + RED test scaffolds** - `f7c1d59` (feat)
2. **Task 2: host.storage + instanceState slot + host.theme** - `93c270f` (feat)
3. **Task 3: host.ai() wrapper + host.open() + makeHost assembly** - `4421aab` (feat)

_Note: tests were written GREEN directly within each feat commit rather than as separate test-commits, since the plan's `tdd="true"` tasks specified behavior scaffolds up front (Task 1) rather than a strict RED-commit/GREEN-commit split._

## Files Created/Modified
- `src/host/types.ts` - Host/AppletManifest/AppletModule/AppletStorage/ThemeTokens leaf contracts
- `src/shell/dockApi.ts` - extracted dockApiRef/addAppletToDock + new getDockApi() accessor
- `src/shell/Dock.tsx` - imports dockApiRef/addAppletToDock from ./dockApi instead of defining locally
- `src/shell/useRailDragOut.ts` - updated import to match the dockApi extraction
- `src/host/storage.ts` - makeAppletStorage() over a shared applets.json LazyStore
- `src/host/storage.test.ts` - 5 passing tests (round-trip, corrupt fallback, null fallback, remove, namespace isolation)
- `src/host/theme.ts` - static ThemeTokens literal
- `src/persistence/workspaceStore.ts` - setInstanceState/getInstanceState/deleteInstanceState accessors
- `src/host/instanceState.ts` - thin re-export wrapper
- `src/host/aiComplete.ts` - promise+onDelta wrapper over host/ai.ts
- `src/host/aiComplete.test.ts` - 4 passing tests (resolve-on-done, reject-on-error, onDelta forwarding, sessionId validity)
- `src/host/open.ts` - hostOpen() D-17 focus-or-open
- `src/host/open.test.ts` - 3 passing tests (focus existing, open new, no-op when dock absent)
- `src/host/index.ts` - makeHost(instanceId, appletKey) factory
- `src/host/index.test.ts` - 2 passing tests (five-key shape, instanceId passthrough)

## Decisions Made
- **host.open() API correction:** the plan's RESEARCH/PATTERNS docs assumed `DockviewApi.setActivePanel(panel)` exists on the public dockview-core API (sourced from a `.d.ts` that turned out to be the internal `DockviewComponent` implementation class). The actual public `DockviewApi` class (`api/component.api.d.ts`) has no such method — per-panel focus is `panel.api.setActive()`. Fixed inline (Rule 1), documented in `open.ts`'s header comment and `open.test.ts`.
- **oneshot sessionId validity:** only the trailing character needs guarding against nanoid's `_`/`-` alphabet — the leading character is always `o` (from the fixed `"oneshot-"` prefix), which is already alphanumeric.
- **host.theme as a static literal:** chosen over `getComputedStyle` passthrough for deterministic behavior under jsdom/vitest (04-CONTEXT.md discretion, per 04-PATTERNS.md "No Analog Found" — this is the one host module with no prior code analog).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DockviewApi has no `setActivePanel` method; used `panel.api.setActive()` instead**
- **Found during:** Task 3 (`npx tsc --noEmit` failed with `TS2551: Property 'setActivePanel' does not exist on type 'DockviewApi'`)
- **Issue:** The plan's PATTERNS.md `open.ts` reference implementation called `api.setActivePanel(existing)`, sourced from a dockview-core `.d.ts` that on closer inspection is the internal `DockviewComponent` class (`dockviewComponent.d.ts`), not the public `DockviewApi` surface exported for consumers (`api/component.api.d.ts`). The real per-panel focus call is `panel.api.setActive()`.
- **Fix:** Changed `hostOpen` to call `existing.api.setActive()`; updated `open.test.ts`'s mocks to match; added a doc comment recording the correction for future readers.
- **Files modified:** `src/host/open.ts`, `src/host/open.test.ts`
- **Verification:** `npx tsc --noEmit` clean; `open.test.ts` 3/3 passing; full suite 91/91 green.
- **Committed in:** `4421aab` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/API correction)
**Impact on plan:** No scope creep — this was a factual correction of an assumed API surface that doesn't exist in the actual library, caught immediately by `tsc --noEmit` before any test ran against it.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The `host` seam (`makeHost`) is fully assembled and unit-tested; Plan 02 (registry + PanelBody dispatch) can wire real applet modules against this contract unchanged.
- `src/shell/dockApi.ts` is now the single import point for reaching the live dockview instance from non-React modules — future plans (registry dispatch, Applet Catalog) should reuse it rather than re-deriving a second handle.
- `instanceState` accessors exist in `workspaceStore.ts` but have no consumer yet (the dispose GC wiring is Plan 02 scope per the plan's own text) — Phase 5 Notes is the first real consumer of the per-instance state read/write seam.
- Full test suite (91/91) and `tsc --noEmit` both green at plan close.

---
*Phase: 04-applet-framework*
*Completed: 2026-07-10*

## Self-Check: PASSED

All 9 created files verified present on disk; all 4 task/summary commit hashes (f7c1d59, 93c270f, 4421aab, 2d173c6) verified present in git log.
