---
phase: 03-persistence-layouts
verified: 2026-07-09T17:00:00Z
status: human_needed
score: 4/4 must-haves verified (code-level); 2 items require live human relaunch/kill testing
overrides_applied: 0
human_verification:
  - test: "Change layout (dock a panel / reorder rail), close the window immediately (graceful close), relaunch — the last change is present."
    expected: "The change made just before close survives relaunch (flushPendingSave + Rust CloseRequested arm actually flush before the process exits)."
    why_human: "Requires a real OS window-close event and process relaunch; jsdom/Vitest cannot simulate Tauri's CloseRequested/confirm_close IPC round-trip or a real file-system reload. Environment cannot screenshot the transparent window either."
  - test: "Launch the app, then kill the process abruptly (Task Manager / kill -9) within ~1-4s of launch (inside the restore-canary window), then relaunch."
    expected: "The app either restores the prior layout or falls back cleanly to the Wiki+Library default with the ResetNotice banner — never a crash, and never a permanent reset loop on the following (3rd) launch."
    why_human: "Validates the CR-01/CR-02/CR-03 canary-lifecycle fix under real abrupt-termination timing, which cannot be simulated by unit tests (they cover the logic in isolation, not real process-kill timing against real disk I/O latency)."
---

# Phase 3: Persistence & Layouts Verification Report

**Phase Goal:** The workspace remembers itself — the whole dock/rail/tab state persists crash-safely, survives schema drift, and users can save and switch named layouts without ever losing or corrupting their workspace.
**Verified:** 2026-07-09T17:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PERS-01: Whole workspace (dock tree, rail order/pins, widths, open tabs) persists on change and restores on launch through `workspace.json` | ✓ VERIFIED | `src/persistence/workspaceStore.ts` single `LazyStore("workspace.json")` sink; `src/shell/Dock.tsx` registers `getDockTree`/`getRail` via `registerStateSources`, calls `scheduleWorkspaceSave()` on `onDidLayoutChange`; `src/store/shellStore.ts` calls `scheduleWorkspaceSave()` on every rail-mutating action and exposes `hydrateFromDisk(record)`. `localStorage` fully removed from both files (`grep -c localStorage` = 0 in each). 77/77 tests pass including round-trip cases. |
| 2 | PERS-02: User can save, apply, delete named layouts and reset to default via the LAYOUTS ▾ menu | ✓ VERIFIED | `src/persistence/layouts.ts` exports `saveLayout/applyLayout/deleteLayout/resetToDefault`, each ending in `scheduleWorkspaceSave()`. `src/shell/LayoutsMenu.tsx` mounted in `src/shell/TitleBar.tsx` (before `RailToggleButtons`), trigger `aria-label="Layouts menu"`, empty-state copy `"No saved layouts yet"` present verbatim, delete buttons `aria-label="Delete layout {name}"`. `resetToDefault` proven (by test) to leave `savedLayouts` untouched (D-03). |
| 3 | PERS-03: Persisted state carries `schemaVersion` + migration path; corrupt/stale/future-version state falls back to the Wiki+Library default without crashing; missing applet keys keep their pane | ✓ VERIFIED | `migrate()` handles missing-migrator AND future-version (`version > LATEST_SCHEMA_VERSION`) as unmigratable (WR-04 fix, `workspaceStore.ts:157`). New `src/persistence/validate.ts` (`isValidRail`/`isValidRecordV1`) structurally validates the POST-migration record so a shape-only-valid-but-garbage rail slice (CR-05) is caught and routed to `backupAndFallback`, not accepted. `backupAndFallback` writes the corrupt raw value to a second `LazyStore("workspace.json.bak")` sink, sets `resetHappened=true`, and `console.warn`s — never silent. `ResetNotice.tsx` binds via `useSyncExternalStore(subscribeReset, resetOccurred)` (CR-04 fix — the original implementation could never actually surface the banner; now fixed and regression-tested). |
| 4 | PERS-04: Writes are debounced (300ms) and force-flushed on window close so abrupt termination cannot corrupt the store | ✓ VERIFIED (code-level; live-relaunch/kill timing is human-only, see below) | `flushPendingSave()` clears the pending timer and performs one immediate write via the shared `buildRecordFromSources()`/`flushNow()` helper (no drift between debounced and forced paths). `src-tauri/src/lib.rs` adds a `CloseRequested` arm (`prevent_close()` + emit) ALONGSIDE the pre-existing `Resized`/`ADJUSTING_MAXIMIZE` maximize-frame-drop arm — verified byte-unchanged. Close-flush is bounded (2s JS race + 5s Rust force-close fallback, WR-02 fix) so a hung/unregistered flush can never make the window permanently unclosable. Writes serialize through one promise chain (WR-03 fix) so overlapping flushes cannot interleave. |

**Score:** 4/4 truths verified at the code level. PERS-04's real-world close/relaunch and abrupt-kill timing behavior (and the general "does a real relaunch actually show the restored layout" check, since the sandboxed environment cannot screenshot the transparent Tauri window) require human execution — routed to Human Verification below, not treated as a code gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/persistence/workspaceStore.ts` | Unified schema, load/migrate/default, debounced writer, registration seams | ✓ VERIFIED | Exports `WorkspaceRecordV1`, `loadWorkspaceRecord`, `saveWorkspaceRecord`, `scheduleWorkspaceSave`, `flushPendingSave`, `registerStateSources`, `DEFAULT_WORKSPACE`, `LATEST_SCHEMA_VERSION`, `resetOccurred`, `acknowledgeReset`, `subscribeReset`, `setRestoreCanary`, `getCurrentRecord`, `setSavedLayouts`, `getSavedLayouts`, `subscribeSavedLayouts`, `restoreDockTree`. One `LazyStore("workspace.json")` sink confirmed (`grep -c` = 1). |
| `src/persistence/validate.ts` | Structural guards (added post-review, not in original plan frontmatter but required by CR-05 fix) | ✓ VERIFIED | `isPlainObject`/`isValidRail`/`isValidRecordV1`; consumed by both `workspaceStore.ts` (load-path acceptance) and `layouts.ts` (WR-05, `applyLayout` entry guard). |
| `src/shell/ResetNotice.tsx` | One-time dismissible corrupt-reset banner (D-04) | ✓ VERIFIED | Exact copy "Workspace was reset after a problem loading your layout." present; `aria-label="Dismiss notice"`; bound via `useSyncExternalStore` (post-review fix — original render-time-only read was dead code, now fixed). Mounted once in `src/app/AppShell.tsx`. |
| `src/persistence/layouts.ts` | save/apply/delete/reset over `savedLayouts` | ✓ VERIFIED | All 4 functions present, each calls `scheduleWorkspaceSave()`. Guards malformed persisted entries (WR-05 fix) — no-throw on corrupt saved-layout data. |
| `src/shell/LayoutsMenu.tsx` | LAYOUTS ▾ title-bar dropdown | ✓ VERIFIED | Present, ≥40 lines, mounted in TitleBar before RailToggleButtons, no `data-tauri-drag-region` on it (drag-region invariant intact). Keyboard navigation fixed post-review (WR-06 — panel is now focusable and focused on open). |
| `src-tauri/src/lib.rs` | `CloseRequested` flush-then-close arm alongside intact `Resized` arm | ✓ VERIFIED | `CloseRequested` arm present; `Resized`/`ADJUSTING_MAXIMIZE` logic confirmed unchanged (per REVIEW-FIX commit log and direct read). Bounded via `CLOSE_CONFIRMED` guard + WR-02's 5s force-close fallback. |
| `src-tauri/capabilities/default.json` | store permission | ✓ VERIFIED (implied by passing `cargo check` and functioning tests; not independently re-diffed line-by-line, but plugin registration + IPC calls in tests succeed) | |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src-tauri/src/lib.rs` | `tauri_plugin_store` | `.plugin(tauri_plugin_store::Builder::default().build())` | ✓ WIRED | Confirmed via successful `cargo check`. |
| `src/shell/Dock.tsx` | `src/persistence/workspaceStore.ts` | `registerStateSources` + `scheduleWorkspaceSave` + `loadWorkspaceRecord` + `setRestoreCanary` | ✓ WIRED | All four calls present in Dock.tsx; canary lifecycle now routes exclusively through `setRestoreCanary` + the shared flush helpers (CR-01/02/03 fix — Dock no longer hand-assembles records). |
| `src/store/shellStore.ts` | `src/persistence/workspaceStore.ts` | `scheduleWorkspaceSave` on every rail action + `hydrateFromDisk` | ✓ WIRED | 5 call sites of `scheduleWorkspaceSave` found in shellStore.ts; `hydrateFromDisk(record)` now takes the already-loaded record (WR-01 fix — no second racing disk read). |
| `src/app/AppShell.tsx` | `src/shell/ResetNotice.tsx` | mounted, reads `resetOccurred` reactively | ✓ WIRED | Mounted; reactive binding fixed post-review (was previously a dead, non-reactive read — CR-04). |
| `src/shell/TitleBar.tsx` | `src/shell/LayoutsMenu.tsx` | mounted before `RailToggleButtons` | ✓ WIRED | Confirmed via source read. |
| `src/persistence/layouts.ts` | `src/persistence/workspaceStore.ts` | mutate `savedLayouts` slice + `scheduleWorkspaceSave` | ✓ WIRED | Confirmed. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite | `npx vitest run` | 10 files, 77/77 tests passed | ✓ PASS |
| Type check | `npx tsc --noEmit` | Clean, no output/errors | ✓ PASS |
| Rust build | `cargo check --manifest-path src-tauri/Cargo.toml` | `Finished` in 0.67s, no errors | ✓ PASS |
| Production build | `npm run build` | Vite build succeeded, `✓ built in 1.85s` | ✓ PASS |
| Debt-marker scan | `grep -n "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across all phase-3 touched files | No matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| PERS-01 | 03-01, 03-02 | Whole workspace persists on change, restores on launch | ✓ SATISFIED | Dock.tsx + shellStore.ts wiring, 77/77 tests, no localStorage remaining |
| PERS-02 | 03-04 | Save/apply/delete named layouts + reset via LAYOUTS menu | ✓ SATISFIED | layouts.ts + LayoutsMenu.tsx, tests + build green |
| PERS-03 | 03-03 | schemaVersion + migration path; corrupt/stale state falls back without crashing; missing applet key keeps pane | ✓ SATISFIED | validate.ts (post-review addition) + backupAndFallback + ResetNotice, CR-05/WR-04 fixes closed the shell-crash gap the original implementation had |
| PERS-04 | 03-05 | Debounced writes flushed on close; abrupt termination doesn't corrupt store | ✓ SATISFIED (code); real close/relaunch timing → human verification | flushPendingSave + Rust CloseRequested arm, WR-02/WR-03 fixes |

No orphaned requirements: REQUIREMENTS.md traceability table maps exactly PERS-01..04 to Phase 3, all four appear in plan frontmatter `requirements:` fields, all four are addressed above.

### Anti-Patterns Found

None. No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in any phase-3-modified file. No stub returns, no empty handlers, no hardcoded-empty-data patterns found in workspaceStore.ts, layouts.ts, validate.ts, Dock.tsx, shellStore.ts, LayoutsMenu.tsx, ResetNotice.tsx, or lib.rs.

**Note on process:** The initial plan-executor implementation (commits through 03-05) had 5 CRITICAL and 7 WARNING findings from `03-REVIEW.md`, including a data-loss-class bug (CR-01/02/03: one canary trip within 4s of a graceful close could permanently reset the workspace on every subsequent launch) and a completely dead-code UI element (CR-04: ResetNotice could never render). All 12 were fixed in a documented follow-up cycle (`03-REVIEW-FIX.md`, commits `7cbe137..348a5b0`) with 15 new regression tests (baseline 62 → 77). This verification checked the CURRENT post-fix codebase state directly (not the SUMMARY.md narratives) and confirms the fixes are present, wired, and tested as claimed.

## Human Verification Required

### 1. Graceful close-then-relaunch persistence round-trip

**Test:** Launch the built app, change the layout (dock a panel, reorder a rail item, resize a split), close the window normally (title-bar × or OS close), relaunch.
**Expected:** The last change made before close is present after relaunch — proving `flushPendingSave()` + the Rust `CloseRequested` arm actually complete the flush before the process exits.
**Why human:** Requires a real Tauri window-close IPC round-trip and a real process relaunch reading the actual on-disk `workspace.json`; this cannot be simulated in jsdom/Vitest. The sandboxed environment also cannot screenshot the transparent Tauri window to visually confirm restoration.

### 2. Abrupt-kill-within-canary-window recovery sanity

**Test:** Launch the app, then forcibly kill the process (Task Manager / `kill -9`) within roughly 1-4 seconds of launch (inside the restore-canary arm window), then relaunch, then relaunch again a second time.
**Expected:** First relaunch either restores cleanly or falls back to the Wiki+Library default with the `ResetNotice` banner visible — never a crash. The SECOND relaunch must NOT be stuck in a permanent reset loop (this is exactly the CR-01/CR-02/CR-03 bug class the review-fix cycle closed).
**Why human:** Validates real abrupt-termination timing against real disk I/O latency, which unit tests exercise only in simulated/mocked form (fake timers, mocked LazyStore) — the actual OS-level race conditions the canary mechanism defends against require a live kill test.

## Gaps Summary

No code-level gaps. Both goal-relevant behaviors that remain unverified are inherently un-automatable (real OS window-close IPC and real process-kill timing) and are routed to human verification per the phase's own plan (`03-05-PLAN.md` Task 2 already specifies this exact human-check). All automated evidence (77/77 tests, clean `tsc`, clean `cargo check`, successful `npm run build`, source-level confirmation of every review-fix commit's claimed change) supports that the phase goal is achieved in the codebase as currently committed.

---

_Verified: 2026-07-09T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
