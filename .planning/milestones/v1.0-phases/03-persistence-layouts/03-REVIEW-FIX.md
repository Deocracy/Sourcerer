---
phase: 03-persistence-layouts
fixed_at: 2026-07-09T16:45:00-04:00
review_path: .planning/phases/03-persistence-layouts/03-REVIEW.md
iteration: 1
findings_in_scope: 12
fixed: 12
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-07-09T16:45:00-04:00
**Source review:** .planning/phases/03-persistence-layouts/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 12 (5 Critical + 7 Warning; Info out of scope)
- Fixed: 12
- Skipped: 0

**Execution note:** Per the recorded project constraint ("no worktrees in Sourcerer — run sequentially on main tree"; node_modules and the cargo target dir do not exist in a fresh worktree, so the required test gate could not run there), fixes were applied sequentially on the main tree with per-finding commits scoped by pathspec. Pre-existing unrelated dirty files (CLAUDE.md, .planning/config.json) were never staged.

**Verification gate (all green after final fix):**
- `npx vitest run` — 10 files, 77 tests passed (baseline was 62; 15 regression tests added)
- `npx tsc --noEmit` — clean
- `cargo check` (src-tauri) — clean (run after WR-02, the only Rust change)
- Rust `Resized`/ADJUSTING_MAXIMIZE maximize-frame-drop arm: verified byte-for-byte unchanged (0 diff lines touching it)

## Fixed Issues

The review's root-cause note was honored: CR-01/02/03 were resolved structurally by making workspaceStore own the canary lifecycle (`setRestoreCanary`) and routing every canary write through the single flush authority — Dock no longer hand-assembles any record.

### CR-01: restoreCanary never cleared on the not-restored path

**Files modified:** `src/persistence/workspaceStore.ts`, `src/shell/Dock.tsx`, `src/persistence/workspaceStore.test.ts`
**Commit:** 7cbe137
**Applied fix:** Added `setRestoreCanary(v)` to workspaceStore; Dock's canary-tripped exit clears it in memory before the reset flush, so the reset persists `restoreCanary:false` instead of perpetuating the trip. Regression test: tripped canary + debounced reset flush persists false.

### CR-02: Any flush inside the 4s canary window persisted restoreCanary:true

**Files modified:** `src/persistence/workspaceStore.ts`, `src/persistence/workspaceStore.test.ts`
**Commit:** e826a87
**Applied fix:** Review's option (b): `flushPendingSave` forces `restoreCanary:false` — an explicit force-flush (graceful close, canary-clear timer) proves the session did not crash. Debounced saves inside the window still persist the armed canary, preserving the full 4s crash-detection semantics. Regression test: armed canary + close-flush persists false.

### CR-03: 4s canary-clear write clobbered savedLayouts/instanceState with the boot snapshot

**Files modified:** `src/shell/Dock.tsx`, `src/persistence/workspaceStore.test.ts`
**Commit:** 817d264
**Applied fix:** Removed both hand-built `saveWorkspaceRecord` calls from Dock. Arm = `setRestoreCanary(true) + scheduleWorkspaceSave()`; clear = `setRestoreCanary(false) + flushPendingSave()` — both read live getters + CURRENT inMemory slices. Regression test: layout saved inside the window survives the canary-clear flush.

### CR-04: ResetNotice could never appear

**Files modified:** `src/persistence/workspaceStore.ts`, `src/shell/ResetNotice.tsx`, `src/shell/ResetNotice.test.tsx` (new)
**Commit:** 9b048c0
**Applied fix:** Added `subscribeReset` pub/sub (notified in `backupAndFallback` and `acknowledgeReset`); ResetNotice binds via `useSyncExternalStore(subscribeReset, resetOccurred)`. New test reproduces the real boot ordering (mount first, corrupt load resolves after) — it fails pre-fix.

### CR-05: Shallow validation let a garbage rail slice crash the shell (T-03-01)

**Files modified:** `src/persistence/validate.ts` (new), `src/persistence/workspaceStore.ts`, `src/persistence/workspaceStore.test.ts`
**Commit:** 8c1c9cf
**Applied fix:** New shared `validate.ts` (`isPlainObject`/`isValidRail`/`isValidRecordV1`); `loadWorkspaceRecord` structurally validates the POST-migration record (rail shape, savedLayouts/instanceState plain objects, restoreCanary boolean-or-absent) and routes failures to `backupAndFallback`. Validation applied post-migration deliberately so future migrators may accept older shapes. Regression tests: `rail: {}` at schemaVersion 1, `savedLayouts: "x"`, `instanceState: 42` all fall back.

### WR-01: Boot performed two independent disk loads racing the canary write

**Files modified:** `src/store/shellStore.ts`, `src/shell/Dock.tsx`, `src/store/shellStore.test.ts`
**Commit:** 5ef3e30
**Applied fix:** `hydrateFromDisk(record)` now consumes the record Dock already loaded (synchronous, no second `loadWorkspaceRecord`). Test asserts `loadWorkspaceRecord` is NOT called during hydration.

### WR-02: No timeout on the close-flush handshake

**Files modified:** `src/persistence/workspaceStore.ts`, `src-tauri/src/lib.rs`
**Commit:** 838b23b
**Applied fix:** Frontend: close-flush races `flushPendingSave()` against a 2s timeout before `confirm_close`. Rust (CloseRequested arm additions ONLY, per constraint): a once-armed background thread force-closes after 5s if no `confirm_close` arrived — covers the unregistered-listener/wedged-webview case the frontend cannot fix. `cargo check` clean; Resized arm untouched.

### WR-03: flushNow had no in-flight guard — overlapping flushes could interleave

**Files modified:** `src/persistence/workspaceStore.ts`, `src/persistence/workspaceStore.test.ts`
**Commit:** a2c6932
**Applied fix:** All disk writes serialize through one promise chain (`enqueueWrite`, review's suggested shape) inside `saveWorkspaceRecord`, guaranteeing last-enqueued-wins; the rejection arm keeps one failed write from wedging the chain. Regression test holds write 1's `store.save` open and asserts write 2's `store.set` has not run (fails pre-fix), then asserts final state is the last-enqueued record.

### WR-04: Future schemaVersion accepted as-is

**Files modified:** `src/persistence/workspaceStore.ts`, `src/persistence/workspaceStore.test.ts`
**Commit:** e5694d4
**Applied fix:** `migrate` returns null for `version > LATEST_SCHEMA_VERSION` → backup-and-fallback. Regression test: a v2 record with a renamed rail field is backed up to `.bak` and falls back to default.

### WR-05: applyLayout trusted the persisted entry shape / half-applied on failed restore

**Files modified:** `src/persistence/layouts.ts`, `src/persistence/layouts.test.ts`
**Commit:** 2597120
**Applied fix:** Guards via shared `validate.ts` (`isPlainObject(record)` + `isValidRail(rail)`) — malformed entries warn-and-no-op; a failed `restoreDockTree` now returns early without applying rail state or persisting. Regression tests: `record: {}` entry does not throw; failed restore leaves rail untouched and does not persist.

### WR-06: LayoutsMenu keyboard navigation unreachable

**Files modified:** `src/shell/LayoutsMenu.tsx`, `src/shell/LayoutsMenu.module.css`, `src/shell/LayoutsMenu.test.tsx`
**Commit:** 973c5e9
**Applied fix:** Panel gets `tabIndex={-1}` + `ref` and is programmatically focused on open (and after the name input closes); `.panel:focus { outline: none }` keeps the token-driven row `.focused` treatment as the focus affordance. Regression tests: focus lands on the panel; ArrowDown+Enter applies; Delete removes without applying.

### WR-07: getDockTree null after Dock unmount could wipe the saved layout

**Files modified:** `src/persistence/workspaceStore.ts`, `src/persistence/workspaceStore.test.ts`
**Commit:** 348a5b0
**Applied fix:** `buildRecordFromSources` falls back to `inMemory.dockTree` when the live getter yields null; `getCurrentRecord` now delegates to the same builder (one assembly path, no drift — also gains the getter try/catch). Regression test: flush with a dead dock api persists the last-known-good tree, not null.

## Skipped Issues

None.

---

_Fixed: 2026-07-09T16:45:00-04:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
