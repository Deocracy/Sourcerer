---
phase: 03-persistence-layouts
reviewed: 2026-07-09T23:24:38Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src-tauri/Cargo.toml
  - src-tauri/capabilities/default.json
  - src-tauri/src/lib.rs
  - src/app/AppShell.tsx
  - src/persistence/layouts.test.ts
  - src/persistence/layouts.ts
  - src/persistence/workspaceStore.test.ts
  - src/persistence/workspaceStore.ts
  - src/shell/Dock.tsx
  - src/shell/LayoutsMenu.module.css
  - src/shell/LayoutsMenu.test.tsx
  - src/shell/LayoutsMenu.tsx
  - src/shell/ResetNotice.module.css
  - src/shell/ResetNotice.tsx
  - src/shell/TitleBar.tsx
  - src/store/shellStore.test.ts
  - src/store/shellStore.ts
findings:
  critical: 5
  warning: 7
  info: 4
  total: 16
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-07-09T23:24:38Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

The unified persistence spine (one `WorkspaceRecordV1` on `workspace.json`, single 300ms debounced writer, corrupt-fallback with rolling `.bak`, close-flush via Rust `CloseRequested`) is well-structured and well-commented, and the Rust maximize-frame-drop `Resized` arm was NOT disturbed by the new `CloseRequested` arm (verified against the recorded Phase-2 shape). The tests exercise the happy debounce/flush paths correctly.

However, the **restore-canary lifecycle is broken in three compounding ways** (CR-01/CR-02/CR-03): the canary is only ever cleared on one path, `saveWorkspaceRecord`'s `inMemory = record` side effect leaks `restoreCanary: true` into every flush during the 4-second window, and the canary-clear timer writes boot-time-stale `savedLayouts`. The net user-visible behavior: **quit the app within ~4s of a successful restore once, and every subsequent launch permanently resets the workspace to the Wiki+Library default** — the exact data-loss class this phase exists to prevent. Additionally, the ResetNotice banner can never actually appear (CR-04), and the shape validation is too shallow to uphold the stated T-03-01 "corrupt JSON can never crash the shell" invariant (CR-05).

## Critical Issues

### CR-01: restoreCanary is never cleared on the not-restored path — one canary trip becomes a permanent reset loop

**File:** `src/shell/Dock.tsx:172-227`, `src/persistence/workspaceStore.ts:297-314`
**Issue:** When a boot finds `record.restoreCanary === true`, Dock treats the dockTree as poisoned, resets to Wiki+Library, and calls `scheduleWorkspaceSave()` (Dock.tsx:226). But `loadWorkspaceRecord` set `inMemory = migrated` — a record with `restoreCanary: true` — and `buildRecordFromSources()` (workspaceStore.ts:306-308) spreads `inMemory.restoreCanary` into every flushed record. Nothing on this path ever writes `restoreCanary: false` (only the restored-branch 4s timer at Dock.tsx:205-217 does). So the reset flush re-persists `restoreCanary: true`, the next launch sees it, discards the (now-default) dockTree again, re-persists `true` again — forever. After one canary trip, layout changes never survive a restart until the user deletes `workspace.json` by hand.
**Fix:** Clear the canary in memory before the reset-path flush, e.g. in Dock.tsx after detecting the tripped canary:
```ts
if (record.restoreCanary) {
  restored = false;
  // The poisoned tree has been discarded — the canary has served its
  // purpose. Clear it so the reset flush doesn't perpetuate it.
  record.restoreCanary = false; // and expose a clearRestoreCanary() on
                                // workspaceStore that sets inMemory =
                                // { ...inMemory, restoreCanary: false }
}
```
The cleanest shape: workspaceStore owns `setRestoreCanary(v: boolean)` mutating `inMemory`, and Dock calls it in all three exits (canary-tripped, restore-failed, restore-succeeded-after-4s) instead of hand-assembling records.

### CR-02: Any flush inside the 4s canary window persists restoreCanary: true — quitting shortly after launch loses the workspace

**File:** `src/shell/Dock.tsx:195-204`, `src/persistence/workspaceStore.ts:202-206, 297-314`
**Issue:** On a successful restore, Dock writes the canary via `saveWorkspaceRecord({ ..., restoreCanary: true })`. `saveWorkspaceRecord` does `inMemory = record` (workspaceStore.ts:203), so for the next 4 seconds `inMemory.restoreCanary === true`. If the user closes the window in that window (a completely normal "open app, glance, close" flow), the PERS-04 close-flush runs `flushPendingSave()` → `buildRecordFromSources()` → spreads `restoreCanary: true` into the final record, then `confirm_close` exits the app before the 4s clear timer fires. Next launch reads `restoreCanary: true`, presumes the (perfectly healthy) dockTree poisoned, and resets to default — then CR-01 makes the reset permanent. The same leak also fires for any debounced save inside the window (rail resize at t=1s persists `true`; only the 4s timer saves it, and only if the app survives that long).
**Fix:** Do not conflate "canary armed on disk" with "canary is part of the current in-memory truth." Either (a) write the canary via a dedicated `store.set` that does NOT touch `inMemory.restoreCanary` and have `buildRecordFromSources` always emit `restoreCanary: false` (a graceful flush is by definition not mid-restore-crash), or (b) have `flushPendingSave` explicitly force `restoreCanary: false` in the record it writes — a graceful close proves the session did not crash, which is exactly the signal the canary encodes.

### CR-03: The 4s canary-clear write clobbers savedLayouts/instanceState with the boot-time snapshot

**File:** `src/shell/Dock.tsx:205-217`
**Issue:** The canary-clear timer writes `savedLayouts: record.savedLayouts, instanceState: record.instanceState` — the values captured at load time — via `saveWorkspaceRecord`. If the user saves a named layout (or `deleteLayout`/anything mutating `setSavedLayouts`) within the first 4 seconds, the subsequent canary-clear write (1) overwrites the just-persisted `savedLayouts` on disk with the stale boot snapshot, and (2) because `saveWorkspaceRecord` also does `inMemory = record`, silently reverts the in-memory slice too — without notifying `savedLayoutsListeners`, so LayoutsMenu keeps rendering a layout row that no longer exists anywhere. Lost user data plus a desynced UI.
**Fix:** The canary-clear must go through the single flush authority instead of hand-assembling a record from stale captures:
```ts
canaryTimer = setTimeout(() => {
  if (dockApiRef.current !== api) return;
  clearRestoreCanary();        // inMemory = { ...inMemory, restoreCanary: false }
  void flushPendingSave();     // reads live getters + CURRENT inMemory slices
}, 4000);
```
This also removes the second hand-built-record path that PERS-04's "the two paths cannot drift" comment claims does not exist.

### CR-04: ResetNotice can never appear — resetOccurred() is read once at initial render, before the async load flips it

**File:** `src/shell/ResetNotice.tsx:19`, `src/persistence/workspaceStore.ts:95-106`
**Issue:** `resetHappened` is a plain module variable with no subscription mechanism. ResetNotice reads `resetOccurred()` during render only. Boot order: AppShell mounts ResetNotice synchronously (returns `null`, since `resetHappened` is still `false`), then Dock's mount effect awaits `loadWorkspaceRecord()`, and only then does `backupAndFallback` set `resetHappened = true`. Nothing ever re-renders ResetNotice — AppShell has no state, ResetNotice's only state is `dismissed`, and there is no listener/store binding. The D-04 banner is therefore dead code in the real corrupt-fallback path: the reset happens, the loud-warning requirement is silently unmet. (The component only "works" in a hypothetical where something else forces a re-render after the load resolves.)
**Fix:** Give the reset signal the same minimal pub/sub treatment savedLayouts already has, and bind with `useSyncExternalStore`:
```ts
// workspaceStore.ts
const resetListeners = new Set<() => void>();
export function subscribeReset(l: () => void): () => void { resetListeners.add(l); return () => resetListeners.delete(l); }
// in backupAndFallback: resetHappened = true; resetListeners.forEach((l) => l());

// ResetNotice.tsx
const reset = useSyncExternalStore(subscribeReset, resetOccurred);
```

### CR-05: Shallow record validation lets a schemaVersion-1 record with a garbage rail slice crash the shell (violates T-03-01)

**File:** `src/persistence/workspaceStore.ts:151-159`, `src/store/shellStore.ts:133-143`, `src/shell/useRailDrag.ts:19-23`
**Issue:** `isCandidateRecord` checks only that `schemaVersion` is a number and that the four keys *exist* — not their shapes. A persisted value like `{ schemaVersion: 1, dockTree: null, rail: {}, savedLayouts: {}, instanceState: {} }` (or `rail: 42`, `railOrder: "x"`, …) passes validation, skips migration (version === LATEST), and is accepted as the live record. `hydrateFromDisk` then pushes `railMode: undefined, railWidth: undefined, railOrder: undefined` into shellStore, and Rail's render path calls `getVisualRailOrder(railOrder, ...)` → `railOrder.filter(...)` → **TypeError, shell render crash**. The module's own header claims "T-03-01: untrusted persisted JSON can never crash the shell" — this input is precisely untrusted persisted JSON, it takes the *accept* path instead of the backup-and-fallback path, and it crashes the shell. The dockTree being opaque is fine (Dock's fromJSON is try/caught); the rail slice is not opaque and is consumed unguarded.
**Fix:** Extend `isCandidateRecord` (or add a `validateRail`) to structurally check the rail subset before accepting, falling through to `backupAndFallback` on failure:
```ts
function isValidRail(r: unknown): r is WorkspaceRecordV1["rail"] {
  if (typeof r !== "object" || r === null) return false;
  const v = r as Record<string, unknown>;
  return (
    (v.railMode === "expanded" || v.railMode === "compact" || v.railMode === "hidden") &&
    typeof v.railWidth === "number" && Number.isFinite(v.railWidth) &&
    Array.isArray(v.railOrder) && v.railOrder.every((k) => typeof k === "string") &&
    Array.isArray(v.leftRailPinned) && v.leftRailPinned.every((k) => typeof k === "string")
  );
}
```
Also validate `savedLayouts`/`instanceState` are plain objects (a persisted `savedLayouts: "x"` currently flows into `Object.values()` in LayoutsMenu and `{ ...current.savedLayouts }` in layouts.ts).

## Warnings

### WR-01: Boot performs two independent disk loads, racing the canary write — contradicting its own "same load" comment

**File:** `src/shell/Dock.tsx:229-230`, `src/store/shellStore.ts:133-143`
**Issue:** The comment at Dock.tsx:229 says "Rail hydrates from the same load (record already fetched above)" — but `hydrateFromDisk()` calls `loadWorkspaceRecord()` again, a second full disk read. Consequences beyond the wasted read: (1) it races the concurrent `restoreCanary: true` write at Dock.tsx:195 — if the write lands first, the second load pulls `restoreCanary: true` back into `inMemory` (feeding CR-02) and re-clobbers `inMemory.savedLayouts`; (2) on a corrupt store, `backupAndFallback` runs twice (double `.bak` write, double warn); (3) `savedLayoutsListeners` fire twice.
**Fix:** Change `hydrateFromDisk` to accept the already-loaded record: `hydrateFromDisk(record: WorkspaceRecordV1)` applying `record.rail`, and pass the record Dock already has. This makes the comment true and removes the race.

### WR-02: No timeout on the close-flush handshake — a hung or unregistered flush makes the window permanently unclosable

**File:** `src-tauri/src/lib.rs:77-91`, `src/persistence/workspaceStore.ts:363-389`
**Issue:** The Rust `CloseRequested` arm unconditionally `prevent_close()`s and emits, trusting the frontend to eventually call `confirm_close`. If the dynamic `import("@tauri-apps/api/event")` failed (registration error is only console-warned, line 384-386), the webview is wedged, or `store.save()` never resolves, no `confirm_close` ever arrives — every close click is swallowed and the app can only be killed via Task Manager. There is no deadline on either side.
**Fix:** Add a bounded wait. Simplest on the frontend: race the flush against a timeout before confirming —
```ts
await Promise.race([flushPendingSave(), new Promise((r) => setTimeout(r, 2000))]);
```
(the `finally` already guarantees `confirm_close` on flush *rejection*, but not on a flush that never settles). Optionally also arm a Rust-side fallback (e.g., force-close N seconds after the first prevented close) as defense in depth.

### WR-03: flushNow has no reentrancy/in-flight guard — overlapping flushes can interleave set/save and inMemory updates

**File:** `src/persistence/workspaceStore.ts:319-353`
**Issue:** `flushPendingSave` clears the *pending timer*, but cannot cancel a flush already in flight (timer fired, `saveTimer` already `undefined`, `saveWorkspaceRecord` awaiting). Two concurrent `flushNow` calls interleave `store.set` → `store.save` pairs and both assign `inMemory = record`; the final on-disk and in-memory state depends on IPC resolution order, not on which record is newer. Similarly, the Dock canary writes call `saveWorkspaceRecord` directly and can interleave with a debounced flush. Low probability, but this is exactly the close-flush window the phase is meant to make deterministic.
**Fix:** Serialize writes through a single promise chain:
```ts
let writeChain: Promise<void> = Promise.resolve();
function enqueueWrite(fn: () => Promise<void>): Promise<void> {
  writeChain = writeChain.then(fn, fn);
  return writeChain;
}
```
and route both `flushNow` and `saveWorkspaceRecord` callers through it, so "last enqueued wins" is guaranteed.

### WR-04: A future schemaVersion (> LATEST) is accepted as-is instead of triggering backup-and-fallback

**File:** `src/persistence/workspaceStore.ts:134-148`
**Issue:** `migrate` only loops `while (version < LATEST_SCHEMA_VERSION)`. A record with `schemaVersion: 2` (user downgraded the app, or a future build wrote the file) skips the loop entirely and is cast to `WorkspaceRecordV1` with zero shape guarantees — a v2 record with a renamed rail field would flow into `hydrateFromDisk` unvalidated (compounding CR-05). Downgrade is a realistic scenario for a desktop app with a user-profile data file.
**Fix:** Treat unknown-future versions as unmigratable:
```ts
if (version > LATEST_SCHEMA_VERSION) return null; // caller backs up + falls back
```

### WR-05: applyLayout trusts the persisted savedLayouts entry shape — a corrupt entry throws on click

**File:** `src/persistence/layouts.ts:47-61`
**Issue:** `applyLayout` dereferences `layout.record.rail.railMode` etc. with no guard. `savedLayouts` entries come straight from disk (validated only for key-presence per CR-05); an entry with a missing/garbage `record` or `rail` (`record: {}` — the shape layouts.test.ts itself uses for delete-path fixtures) throws a TypeError inside a click handler, crashing the interaction. T-03-01's "untrusted persisted JSON can never crash the shell" applies to this path too. Secondary: when `restoreDockTree` returns `false` because Dock hasn't registered yet, the function still applies rail state and persists — a half-applied layout.
**Fix:** Guard the entry shape before applying (reuse the `isValidRail` check from CR-05's fix) and no-op (or warn) on malformed entries; consider skipping `scheduleWorkspaceSave()` when `restoreDockTree` returned `false` and nothing coherent was applied.

### WR-06: LayoutsMenu keyboard navigation is unreachable — the panel is never focusable, so its onKeyDown never fires

**File:** `src/shell/LayoutsMenu.tsx:91-113, 126`
**Issue:** `handlePanelKeyDown` (ArrowUp/ArrowDown/Enter/Delete/Backspace row navigation, ~23 lines plus the `focusedIndex` state and `.focused` CSS) is wired to `onKeyDown` on the panel `div`, but the panel has no `tabIndex` and focus is never moved into it — after clicking the trigger, focus remains on the trigger button, which is a *sibling* of the panel, so key events never propagate through the panel. Rows are `tabIndex={-1}` and never programmatically focused either. Net effect: the entire keyboard-navigation contract (03-UI-SPEC Interaction Contract) is dead code; only the document-level Escape works. `role="menu"`/`role="menuitem"` without focus management is also an a11y anti-pattern (screen readers announce a menu that arrow keys can't traverse).
**Fix:** Make the panel focusable and focus it on open:
```tsx
<div className={styles.panel} role="menu" tabIndex={-1} ref={panelRef} onKeyDown={handlePanelKeyDown}>
```
with `useEffect(() => { if (open && !saving) panelRef.current?.focus(); }, [open, saving])` — or move the keydown handling onto the trigger/root so the existing focus target hears it.

### WR-07: getDockTree returns null after Dock unmount — a late flush would persist dockTree: null and wipe the saved layout

**File:** `src/shell/Dock.tsx:113-115`, `src/persistence/workspaceStore.ts:297-314`
**Issue:** The registered `getDockTree` returns `null` whenever `dockApiRef.current` is unset (Dock unmounted/disposed), and `buildRecordFromSources` happily persists that as the record's `dockTree` — which the load path interprets as "no layout saved" (D-05 default). Today Dock lives for the app lifetime, but the cleanup at Dock.tsx:245-252 nulls the ref without deregistering the sources, so any pending debounced timer or close-flush that fires after cleanup (React 18 StrictMode dev double-mount is a live instance of this ordering) writes `dockTree: null` over a real layout. Latent data-loss trap guarded only by current mount topology.
**Fix:** On Dock cleanup, either deregister (`registerStateSources(null)` — allow null) or have `getDockTree` return the last-known-good tree (`inMemory.dockTree`) instead of `null` when the live api is gone; alternatively have `buildRecordFromSources` fall back to `inMemory.dockTree` when the getter yields `null` while `inMemory.dockTree` is non-null.

## Info

### IN-01: DEFAULT_WORKSPACE is returned/assigned by reference — one in-place mutation anywhere corrupts every future fallback

**File:** `src/persistence/workspaceStore.ts:69-80, 122-123, 179-185`
**Issue:** `loadWorkspaceRecord`/`backupAndFallback` return the shared `DEFAULT_WORKSPACE` object itself and set `inMemory` to it. Any consumer that mutates the returned record (e.g. pushing into `rail.railOrder`) silently corrupts the canonical default for the rest of the session.
**Fix:** Deep-freeze it (`Object.freeze` recursively) in dev, or return a structured clone (`structuredClone(DEFAULT_WORKSPACE)`) from the fallback paths.

### IN-02: saveLayout embeds restoreCanary into the layout snapshot

**File:** `src/persistence/layouts.ts:35`
**Issue:** A layout saved during the 4s canary window permanently carries `restoreCanary: true` inside its snapshot. `applyLayout` ignores the field today, so it's inert noise — but it's meaningless data in a user-facing artifact and a foot-gun if a future applyLayout ever round-trips the whole record.
**Fix:** Drop `restoreCanary` from the snapshot: it is boot-lifecycle state, not layout state.

### IN-03: CLOSE_CONFIRMED is process-global and never reset

**File:** `src-tauri/src/lib.rs:18, 27-30`
**Issue:** Fine for the current single-window app (the process exits after close), but the static will bypass the flush for *every* window's first close once any window confirms, if multi-window ever arrives. Worth a comment or a per-window flag when that day comes.
**Fix:** No action needed now; note the constraint next to the static (the existing comment covers the loop-guard purpose but not the single-window assumption).

### IN-04: LayoutsMenu activeId is session-local and can go stale

**File:** `src/shell/LayoutsMenu.tsx:19, 66-75`
**Issue:** The active-layout highlight lives in component state: it resets on remount, isn't persisted, and stays highlighted after the workspace diverges from the applied layout (any dock change). Cosmetic; just noting the contract is "last clicked this session," not "current layout."
**Fix:** Acceptable as-is for this phase; document the semantics or clear `activeId` on `onDidLayoutChange` if "matches current layout" is ever the intent.

---

_Reviewed: 2026-07-09T23:24:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
