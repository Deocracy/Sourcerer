---
phase: 04-applet-framework
plan: 05
subsystem: applet-framework
tags: [registry, zustand, react, typescript, vitest]

requires:
  - phase: 04-applet-framework
    plan: 01
    provides: "src/host/open.ts (hostOpen focus-or-open), src/shell/dockApi.ts"
  - phase: 04-applet-framework
    plan: 02
    provides: "src/shell/registry.ts (key->AppletModule map, read-only import), src/shell/appletDefs.ts (authoritative key set)"
provides:
  - "src/shell/AppletCatalog.tsx — the registry-fed Applet Catalog picker (D-18), shared by the Dock '+' and the Rail footer"
  - "shellStore session-only catalogOpen/catalogAnchor slice + openAppletCatalog/closeAppletCatalog actions"
  - "shellStore.hydrateFromDisk D-19 append: any appletDefs key missing from a restored railOrder is appended at the end, preserving existing order"
affects: [phase-05-notes]

tech-stack:
  added: []
  patterns:
    - "LayoutsMenu dropdown pattern (WR-06 focus-into-panel, document mousedown click-outside + Escape, ArrowUp/Down + Enter nav) reused wholesale for a second dropdown (AppletCatalog), confirming it as the shell's one hand-rolled menu idiom rather than a one-off"
    - "One shared component instance, two imperative triggers (Dock '+' anchor-positioned; Rail footer default-positioned) driven entirely by a session-only shellStore slice, not local component state"

key-files:
  created:
    - src/shell/AppletCatalog.tsx
    - src/shell/AppletCatalog.module.css
    - src/shell/AppletCatalog.test.tsx
  modified:
    - src/store/shellStore.ts
    - src/store/shellStore.test.ts
    - src/app/AppShell.tsx
    - src/shell/Dock.tsx
    - src/shell/Rail.tsx

key-decisions:
  - "AppletCatalog reads registry manifests directly (glyph/title/desc), filtered+ordered by appletDefs' key order, rather than duplicating manifest data — single source of truth per 04-PATTERNS.md"
  - "Dock '+' passes an anchor (button bounding rect) to openAppletCatalog; Rail's footer/compact triggers call it with no anchor, falling back to a fixed CSS position near the tab bar (04-UI-SPEC.md's picker has one shared panel, not two independently-positioned ones)"
  - "D-19 merge implemented in hydrateFromDisk itself (not a separate migration step) so every load path (initial boot, restore) gets the append for free without a second call site"

patterns-established:
  - "Session-only shellStore slices (catalogOpen/catalogAnchor) stay out of getRailSubset exactly like railApplet/badges — the persisted/session split is enforced per-slice, not per-store"

requirements-completed: [FWK-02]

duration: ~5min
completed: 2026-07-10
---

# Phase 04 Plan 05: Applet Catalog Picker + D-19 Rail Append Summary

**Replaced the Dock '+' key-cycling hack and the Rail footer's console.log no-op with one registry-fed Applet Catalog picker (LayoutsMenu-grade keyboard/click-outside behavior) driven by a session-only shellStore slice, and implemented D-19 so a registered applet key missing from a restored rail order appends at the bottom instead of being silently dropped.**

## Performance

- **Duration:** ~5 min
- **Tasks:** 2 completed
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments
- Built `AppletCatalog.tsx`, a registry-fed dropdown mirroring `LayoutsMenu.tsx`'s exact interaction contract (WR-06 focus-on-open, click-outside/Escape close, ArrowUp/Down + Enter nav)
- Added a session-only `catalogOpen`/`catalogAnchor` slice + `openAppletCatalog`/`closeAppletCatalog` actions to `shellStore`, excluded from the persisted `getRailSubset`
- Mounted `<AppletCatalog />` once in `AppShell.tsx`
- Rewired the Dock '+' tab-bar action to open the shared picker (anchored at the button's bounding rect) and deleted the dead `orderedKeys`/`keyCursor`/`nextKey` cycling code + its now-unused `appletDefs` import
- Rewired the Rail footer row + compact icon's `openCatalog()` to call the same shared action, removing the `console.log` stub
- Implemented D-19 in `hydrateFromDisk`: any `appletDefs` key absent from the restored `railOrder` is appended at the end, preserving the saved order and never introducing duplicates
- Extended `shellStore.test.ts`'s hydrate suite with the D-19 append case and an already-complete-order (no-op) case; the pre-existing single-key (`["Sources"]`) hydrate test was updated to assert the new D-19 append behavior rather than an exact short array (directly affected by this plan's own change)

## Task Commits

1. **Task 1: AppletCatalog picker + shellStore catalog open-state + AppShell mount** - `a8685b0` (feat)
2. **Task 2: Wire both triggers + D-19 rail append** - `133c860` (feat)

## Files Created/Modified
- `src/shell/AppletCatalog.tsx` - registry-fed picker, keyboard/click-outside behavior, hostOpen row-click
- `src/shell/AppletCatalog.module.css` - LayoutsMenu-derived metrics (36px rows, `--color-bg` panel, 1px `--color-line` border, radius 0)
- `src/shell/AppletCatalog.test.tsx` - list/click→hostOpen/keyboard-nav/Escape coverage (5 tests)
- `src/store/shellStore.ts` - `catalogOpen`/`catalogAnchor` session-only slice, `openAppletCatalog`/`closeAppletCatalog`, D-19 append in `hydrateFromDisk`
- `src/store/shellStore.test.ts` - D-19 append case, already-complete-order case, updated the pre-existing hydrate test's railOrder assertion
- `src/app/AppShell.tsx` - mounts `<AppletCatalog />`
- `src/shell/Dock.tsx` - '+' action opens the catalog (anchored); removed cycling code + its `appletDefs` import
- `src/shell/Rail.tsx` - `openCatalog()` calls `openAppletCatalog()` instead of logging a stub

## Decisions Made
- **Manifest as single source, appletDefs as order:** `AppletCatalog` reads `registry[key].manifest` for glyph/title/desc but iterates `Object.keys(appletDefs)` for row order — avoids re-deriving copy while keeping the stable order contract from `appletDefs.ts`.
- **Anchor is optional, not required:** the Rail's two triggers call `openAppletCatalog()` with no anchor; the panel CSS has a fixed fallback position (`top: 44px; right: 8px`) near the tab bar, matching the plan's "falling back to a sensible default" instruction without needing every call site to compute a rect.
- **D-19 lives inside `hydrateFromDisk`:** rather than a separate post-hydrate migration pass, the append happens as part of the one function every load path already calls, so there is exactly one place this invariant can be violated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing shellStore.test.ts hydrate case broke on the D-19 change**
- **Found during:** Task 2 (`npx vitest run src/store/shellStore.test.ts` after adding the D-19 merge)
- **Issue:** The existing test hydrated a record with `railOrder: ["Sources"]` and asserted `state.railOrder` equals exactly `["Sources"]`. D-19's append (this plan's own required behavior) now appends the other 12 `appletDefs` keys to that short order, so the exact-equality assertion legitimately fails — this is the intended new behavior, not a regression.
- **Fix:** Updated the assertion to check `railOrder[0]` stays `"Sources"` and that the full `appletDefs` key set is present with no length drift, then added two new dedicated D-19 test cases (append case, already-complete-order no-op case) per the plan's Task 2 instruction to extend this file.
- **Files modified:** `src/store/shellStore.test.ts`
- **Verification:** `npx vitest run src/store/shellStore.test.ts` 8/8 green; full `npm test` 112/112 green; `npx tsc --noEmit` clean.
- **Committed in:** `133c860` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — a test directly broken by this plan's own D-19 change, not an unrelated file)
**Impact on plan:** No scope creep — a mechanical test update required by the plan's own Task 2 behavior change, exactly as the plan's own "Extend shellStore.test.ts" instruction anticipated.

## Note on the Rail acceptance-criteria grep

The plan's Task 2 acceptance criteria includes `grep -c "no-op stub" src/shell/Rail.tsx == 0`, but the same task's `<action>` text explicitly instructs "Leave `openSettings()` untouched (out of scope)" — and `openSettings()`'s own `console.log("openSettings: no-op stub...")` line is the only remaining match. `openCatalog()`'s no-op stub (the one this plan's scope covers) was removed; `openSettings()`'s pre-existing stub was left exactly as the action text directs, since Settings has no applet or picker built yet in this phase. Documented here for the verifier rather than silently deviating from either the plan's explicit action instruction or its grep — the two are in direct tension, and preserving the explicit written instruction (leave `openSettings` alone) was chosen over the blanket grep.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FWK-02 is complete: a real registry-fed Applet Catalog picker opens applets via `host.open` from both the Dock '+' and the Rail footer, and D-19 guarantees a newly-registered applet key always surfaces in the rail on the next restore.
- `registry.ts` was only read (imported) in this plan — no conflict with the parallel Wiki/Library port plans (04-03/04-04) that ran in the same wave.
- The human-check step in the plan's Task 2 verification (manually clicking the '+' and the Rail's catalog row in the running app) was not executed by this autonomous run — automated coverage (AppletCatalog.test.tsx, shellStore.test.ts, full suite, `tsc --noEmit`) stands in for it per this plan's `type="auto"` tasks (no `checkpoint:human-verify` was declared). Recommend a manual pass before considering Phase 4 fully closed out.
- Full test suite (112/112) and `tsc --noEmit` both green at plan close.

---
*Phase: 04-applet-framework*
*Completed: 2026-07-10*

## Self-Check: PASSED

All 7 created/modified files verified present on disk; both task commit hashes (a8685b0, 133c860) verified present in git log.
