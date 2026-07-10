---
phase: 04-applet-framework
plan: 02
subsystem: applet-framework
tags: [registry, dockview-core, react, typescript, vitest, tdd]

requires:
  - phase: 04-applet-framework
    plan: 01
    provides: "src/host/types.ts (Host/AppletManifest/AppletModule), src/host/index.ts (makeHost), src/host/instanceState.ts (deleteInstanceState)"
provides:
  - "src/shell/registry.ts — static key->AppletModule map (FWK-01), spreads templatedModules then overrides Wiki/Library"
  - "src/applets/_stub/TemplatedStub.tsx — the one shared templated-stub component (glyph tile, serif title, demo rows, DEMO chip)"
  - "src/applets/templated.ts — templatedModules: one generated AppletModule per appletDefs key"
  - "src/applets/Wiki/index.tsx, src/applets/Library/index.tsx — override module shells ready for Plans 03/04 to replace App without touching registry.ts"
  - "src/shell/PanelBody.tsx makeRenderer(fullPanelId, appletKey) — registry dispatch + per-instance host + dispose GC"
affects: [04-03, 04-04, 04-05, phase-05-notes]

tech-stack:
  added: []
  patterns:
    - "Lazy render inside dockview's init(parameters) rather than at makeRenderer-factory time, deriving instanceId from parameters.api.id (04-RESEARCH.md Pattern 2)"
    - "Generated-module registry: one appletDefs entry -> one AppletModule via Object.entries().map(), avoiding ~11 hand-duplicated stub files"
    - "Override-after-spread registry composition: { ...templatedModules, Wiki, Library } so real applets replace their stub without any other file changing"

key-files:
  created:
    - src/shell/registry.ts
    - src/shell/registry.test.ts
    - src/shell/PanelBody.test.tsx
    - src/applets/_stub/TemplatedStub.tsx
    - src/applets/_stub/TemplatedStub.module.css
    - src/applets/_stub/demoRows.ts
    - src/applets/templated.ts
    - src/applets/Wiki/index.tsx
    - src/applets/Library/index.tsx
  modified:
    - src/shell/appletDefs.ts
    - src/shell/PanelBody.tsx
    - src/shell/Dock.tsx
    - src/persistence/workspaceStore.test.ts

key-decisions:
  - "templated.ts kept as .ts (not .tsx, per plan's file list) — uses React.createElement instead of JSX since .ts has no JSX parsing enabled in this tsconfig"
  - "D-07 in-flight host.ai() abandonment implemented as a natural consequence of unmounting the React root before any pending promise settles, not a bespoke per-instance cancellation registry — matches 04-RESEARCH.md Pitfall 3's accepted MVP scope (sidecar cannot be aborted mid-turn either way)"
  - "PanelBody.test.tsx wraps render/dispose calls in react-dom/test-utils act() — createRoot()'s initial commit does not flush synchronously under jsdom without it (discovered via a sanity-check spike during Task 3, not assumed)"

patterns-established:
  - "registry.ts is the sole registration point; adding a real applet = adding/overriding one module here, never editing appletDefs.ts's shape or templated.ts's generator"

requirements-completed: [FWK-01, FWK-02, FWK-03]

duration: 10min
completed: 2026-07-10
---

# Phase 04 Plan 02: Registry + Templated Stub + Panel Dispatch Summary

**Closed the framework loop end-to-end: a static registry mapping every appletDefs key to a `{manifest, App}` module, a shared TemplatedStub carrying a subtle DEMO chip + believable per-applet demo rows, and PanelBody's dockview dispatch now renders each registered module with a live per-instance `host` instead of the old generic placeholder.**

## Performance

- **Duration:** ~10 min (22:30:38 → 22:40:09, commit timestamps)
- **Tasks:** 3 completed (RED test task + 2 feat tasks)
- **Files modified:** 13 (9 created, 4 modified)

## Accomplishments
- Wrote RED integration tests (`registry.test.ts`, `PanelBody.test.tsx`) against the not-yet-existing registry/dispatch, verified they fail for the right reason (missing import / no-op dispatch), then turned them GREEN
- Added a `code` crumb field to every `appletDefs` entry (single source of truth, no drift into registry manifests)
- Built `TemplatedStub` — the one shared templated-stub body (glyph tile, serif title, description, demo rows, mono `--color-faint` DEMO chip — never accent, never a banner)
- Authored believable per-applet demo rows for all 13 applets (`demoRows.ts`), KeyPass rows are vault-entry labels only, never secret values
- Generated `templatedModules` (one `AppletModule` per `appletDefs` key) from the single source of truth via `Object.entries().map()`
- Created Wiki/Library as override modules (currently rendering the templated stub) — the seam Plans 03/04 fill in without ever touching `registry.ts`
- Assembled `registry.ts`: `{ ...templatedModules, Wiki, Library }`, the sole registration point
- Rewrote `PanelBody.tsx`'s `makeRenderer` to `(fullPanelId, appletKey)`, rendering lazily inside dockview's `init(parameters)` and deriving `instanceId` from `parameters.api.id` (Pattern 2) — registered keys render `registry[key].App({host: makeHost(instanceId, appletKey)})`; unknown keys still fall back to the generic `PanelBody` placeholder without throwing
- Wired `dispose()` to call `deleteInstanceState(instanceId)` (Pitfall 6 GC) before unmounting
- Fixed `Dock.tsx`'s `createComponent` to pass the full `opts.id` through instead of discarding the nanoid suffix

## Task Commits

1. **Task 1: RED — registry + PanelBody dispatch integration tests** - `8b496da` (test)
2. **Task 2: TemplatedStub + generated templated modules + registry + manifest merge** - `8d35de3` (feat)
3. **Task 3: PanelBody registry dispatch + instanceId + Dock createComponent passthrough** - `b2e85a0` (feat)

## Files Created/Modified
- `src/shell/registry.ts` - static key->AppletModule map, spreads templatedModules then overrides Wiki/Library
- `src/shell/registry.test.ts` - FWK-01/FWK-02 shape assertions (4 tests)
- `src/shell/PanelBody.test.tsx` - FWK-02/FWK-03 dispatch assertions (2 tests, mocks `makeHost`)
- `src/applets/_stub/TemplatedStub.tsx` - shared templated-stub component
- `src/applets/_stub/TemplatedStub.module.css` - lifted from PanelBody.module.css's exact metrics + new DEMO chip/rows styles
- `src/applets/_stub/demoRows.ts` - per-applet believable demo content
- `src/applets/templated.ts` - generates one AppletModule per appletDefs key
- `src/applets/Wiki/index.tsx`, `src/applets/Library/index.tsx` - override module shells
- `src/shell/appletDefs.ts` - added `code` field to all 13 entries
- `src/shell/PanelBody.tsx` - `makeRenderer` registry dispatch + instanceId + dispose GC
- `src/shell/Dock.tsx` - `createComponent` passes full `opts.id` through
- `src/persistence/workspaceStore.test.ts` - updated its pre-existing `makeRenderer` call to the new two-arg signature (Rule 1, directly broken by Task 3's signature change)

## Decisions Made
- **templated.ts stays `.ts`:** the plan's file list specifies `src/applets/templated.ts` (not `.tsx`); since this tsconfig only enables JSX parsing for `.tsx` files, the module builder uses `React.createElement` instead of JSX syntax.
- **D-07 abandonment via natural unmount:** rather than building a bespoke per-instance AI-call cancellation registry, `dispose()` unmounts the React root before any pending `host.ai()` promise can settle against a live component — matching 04-RESEARCH.md Pitfall 3's explicitly accepted MVP scope (the sidecar itself cannot be aborted mid-turn either way, so a frontend cancellation token would not stop real work, only suppress a UI update that already can't happen post-unmount).
- **`act()` wrapping in PanelBody.test.tsx:** discovered via a throwaway sanity test during Task 3 that `createRoot().render()`'s initial commit does not flush synchronously under jsdom without `act()` (or an awaited macrotask, as the pre-existing `workspaceStore.test.ts` case already did) — documented inline rather than assumed from memory.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `workspaceStore.test.ts`'s pre-existing `makeRenderer`/`init()` call broke on Task 3's signature change**
- **Found during:** Task 3 (`npm test` full-suite run after the PanelBody.tsx rewrite)
- **Issue:** A Phase 3 test (`(g) a restored layout referencing a missing applet key...`) called the old one-arg `makeRenderer(key)` + zero-arg `renderer.init()`. Task 3's plan-specified signature change (`makeRenderer(fullPanelId, appletKey)`, `init(parameters)` deriving `instanceId` from `parameters.api.id`) is a direct, in-scope breaking change to a file this test exercises.
- **Fix:** Updated the call to the new two-arg signature and passed a `{ api: { id } }`-shaped `init` parameter, matching Task 3's Pattern 2 contract; the existing awaited macrotask (`setTimeout(resolve, 0)`) already gave React's scheduler time to flush, so no `act()` wrapper was needed there (unlike the new `PanelBody.test.tsx`, which asserts synchronously and does need `act()`).
- **Files modified:** `src/persistence/workspaceStore.test.ts`
- **Verification:** `npx vitest run src/persistence/workspaceStore.test.ts` 18/18 green; full `npm test` 97/97 green; `npx tsc --noEmit` clean.
- **Committed in:** `b2e85a0` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, directly caused by this plan's own signature change to a shared file)
**Impact on plan:** No scope creep — a mechanical signature-migration fix to a Phase 3 test that exercises the exact function this plan's Task 3 modifies.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The FWK-01/FWK-02/FWK-03 loop is demonstrably closed for the templated tier: any registered key renders through `registry` + a live `makeHost(instanceId, appletKey)`, and an unregistered key still falls back safely.
- `src/applets/Wiki/index.tsx` and `src/applets/Library/index.tsx` are the exact seams Plans 03/04 replace — only `App` (and whatever new files those plans add under each directory) needs to change; `registry.ts` and `templated.ts` are stable.
- `Dock.tsx`'s "+" button still cycles `appletDefs` keys (the Applet Catalog picker replacing it is a later plan's scope per 04-UI-SPEC.md's Component Inventory — not part of 04-02).
- Full test suite (97/97) and `tsc --noEmit` both green at plan close.

---
*Phase: 04-applet-framework*
*Completed: 2026-07-10*

## Self-Check: PASSED

All 14 created/modified files verified present on disk; all 4 task/summary commit hashes (8b496da, 8d35de3, b2e85a0, 949546e) verified present in git log.
