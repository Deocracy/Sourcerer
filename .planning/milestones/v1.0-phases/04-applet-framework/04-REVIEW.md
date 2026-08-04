---
phase: 04-applet-framework
reviewed: 2026-07-10T06:30:50Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - src/app/AppShell.tsx
  - src/applets/Library/Library.module.css
  - src/applets/Library/Library.test.tsx
  - src/applets/Library/index.tsx
  - src/applets/Library/libraryContent.ts
  - src/applets/Wiki/Wiki.module.css
  - src/applets/Wiki/Wiki.test.tsx
  - src/applets/Wiki/index.tsx
  - src/applets/Wiki/wikiContent.ts
  - src/applets/_stub/TemplatedStub.module.css
  - src/applets/_stub/TemplatedStub.tsx
  - src/applets/_stub/demoRows.ts
  - src/applets/templated.ts
  - src/host/aiComplete.test.ts
  - src/host/aiComplete.ts
  - src/host/index.test.ts
  - src/host/index.ts
  - src/host/instanceState.ts
  - src/host/open.test.ts
  - src/host/open.ts
  - src/host/storage.test.ts
  - src/host/storage.ts
  - src/host/theme.ts
  - src/host/types.ts
  - src/persistence/workspaceStore.test.ts
  - src/persistence/workspaceStore.ts
  - src/shell/AppletCatalog.module.css
  - src/shell/AppletCatalog.test.tsx
  - src/shell/AppletCatalog.tsx
  - src/shell/Dock.tsx
  - src/shell/PanelBody.test.tsx
  - src/shell/PanelBody.tsx
  - src/shell/Rail.tsx
  - src/shell/appletDefs.ts
  - src/shell/dockApi.ts
  - src/shell/registry.test.ts
  - src/shell/registry.ts
  - src/shell/useRailDragOut.ts
  - src/store/shellStore.ts
findings:
  critical: 2
  warning: 6
  info: 6
  total: 14
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-07-10T06:30:50Z
**Depth:** standard
**Files Reviewed:** 39 (all 40 listed files read; `src/store/shellStore.test.ts` reviewed as test-support, no findings)
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Phase 4's applet framework was reviewed adversarially: registry dispatch, per-instance `makeHost()`, storage/ai/open seams, templated stubs, the rich Wiki/Library ports, and the Applet Catalog. The core dispatch loop (registry → makeRenderer → makeHost) is sound, `hostOpen`'s focus-or-open matches the corrected dockview API, and the persistence write chain (WR-03 serialization, WR-07 null-dockTree guard, canary lifecycle) held up under trace.

Two Critical findings stand out. First, the Library applet imports and reads the shell's Zustand store directly — a direct violation of the phase's stated hard invariant ("applets must touch the shell ONLY through the `host` API") and of CLAUDE.md's constraint. Second, the instanceState dispose GC — the exact integration seam this project's standing lesson says mocked tests hide — deletes per-instance state on *every* renderer dispose, including layout-restore `fromJSON` and dock teardown, which will silently destroy per-tab state for panels that are immediately recreated with the same ids once Phase 5 Notes starts writing to the slot. Neither defect is caught by the (green, mocked) test suite: no test exercises dispose-during-restore, and no test asserts the applet→shell import boundary.

## Critical Issues

### CR-01: Library applet bypasses the `host` seam by importing the shell store directly

**File:** `src/applets/Library/index.tsx:4` and `src/applets/Library/index.tsx:727`
**Issue:** The applet imports `useShellStore` from `../../store/shellStore` and subscribes to `s.activeCorpus` inside the component. CLAUDE.md is explicit: "Applets never bypass the `host` API," and this phase's key invariant is that applets touch the shell *only* through `host`. The in-file comment frames this as sanctioned discretion ("Rail.tsx's established selector idiom"), but Rail is shell chrome — not an applet. `Host` is deliberately fixed at five members with no shell-state channel, so this import creates the exact applet→shell coupling the registry/host architecture exists to prevent, and it establishes precedent for every future applet port ("Library already does it").
**Fix:** Remove the `store/shellStore` import from the applet. Either:

```tsx
// Option A (matches Wiki's precedent): component-local default, no shell read
const [corpusId] = useState("ficino");

// Option B (if shell-driven corpus is genuinely needed this phase): thread it
// through the seam — e.g. PanelBody passes it as a prop the same way `host`
// is passed, or defer to the reserved additive seam Phase 5 finalizes.
```

Also add a boundary test/lint gate (e.g. ESLint `no-restricted-imports` for `src/applets/**` → `src/store/*`, `src/shell/*` except `appletDefs`) so the invariant is enforced mechanically, not by review.

### CR-02: instanceState GC fires on every renderer dispose — layout restore and dock teardown wipe state for panels that still exist

**File:** `src/shell/PanelBody.tsx:94-105` (with `src/shell/Dock.tsx:90-113,199-206`, `src/persistence/workspaceStore.ts:353-357`)
**Issue:** `makeRenderer().dispose()` calls `deleteInstanceState(instanceId)` unconditionally, treating "renderer disposed" as "user closed this tab." But dockview disposes content renderers in at least three non-close paths:

1. **Saved-layout restore** (`restoreDockTree` → `liveApi.fromJSON(json)` in `Dock.tsx:96`): `fromJSON` tears down the current layout first, disposing every live panel → `deleteInstanceState` for each → then recreates panels from the snapshot **with the same serialized `Key:nanoid` ids**. Net effect: applying a layout deletes the per-tab state of the very instances the layout recreates.
2. **Dock unmount / dev HMR / StrictMode remount** (`api.dispose()` in the effect cleanup, `Dock.tsx:205`): all panels dispose → the entire in-memory `instanceState` map is emptied → the remounted dock restores the same panel ids from disk, and the next debounced flush (any layout change fires one) persists the wipe to `workspace.json`.

The slot is empty in Phase 4, so every test stays green — this is precisely the "green mocked tests hide real spine bugs" failure mode: `workspaceStore.test.ts:205` calls `renderer.dispose()` but never asserts state survival across a restore. The moment Phase 5 Notes writes per-tab state, this becomes silent user data loss. Secondary defects in the same block: (a) `deleteInstanceState` runs *before* `root.unmount()`, so a Phase 5 applet writing state from an unmount cleanup effect resurrects the slot right after GC; (b) the deletion is never followed by `scheduleWorkspaceSave()` despite `workspaceStore.ts:351-352`'s explicit mutate-then-persist contract — persistence of the GC currently depends on a coincidental `onDidLayoutChange` save.
**Fix:** GC on *panel removal*, not renderer dispose. For example:

```ts
// Dock.tsx — close is a panel-removal event, not a renderer lifecycle event
const removeDisposable = api.onDidRemovePanel((panel) => {
  deleteInstanceState(panel.id);
  scheduleWorkspaceSave();
});
```

…and drop `deleteInstanceState` from `makeRenderer().dispose()` entirely (note: verify `onDidRemovePanel` also fires during `fromJSON` teardown in dockview-core 2.0.0 — if it does, gate the GC on a `restoring` flag around `fromJSON`, or switch to the reconciliation approach). Alternatively, reconcile orphans at boot: after restore, delete every `instanceState` key not present in `api.panels.map(p => p.id)`. Either way, add a failing-first test: seed a slot, `fromJSON` a layout containing that panel id, assert the slot survives.

## Warnings

### WR-01: `host.storage.set`/`remove` violate the documented never-throws contract

**File:** `src/host/storage.ts:35-43` (contract at `src/host/types.ts:42-47`)
**Issue:** `types.ts` declares `AppletStorage` a "best-effort, never-throws Promise API (D-15/D-16)." Only `get` honors that — `set` and `remove` propagate any `store.set`/`store.save` IPC rejection straight to the applet. An applet that takes the contract at its word (`void host.storage.set(...)` without catch) gets an unhandled promise rejection on the first disk/IPC fault. No test covers a failing `set` (`storage.test.ts` only exercises the failing-`get` path).
**Fix:** Wrap `set`/`remove` bodies in `try { ... } catch { /* best-effort */ }` to match the contract, or amend the contract in `types.ts` to state that writes may reject — and in either case add a failing-save test.

### WR-02: `aiComplete` can hang forever if the event stream ends without a terminal event

**File:** `src/host/aiComplete.ts:39-62`
**Issue:** The docblock promises "never hangs," but the promise settles only on a `done` or `error` event. `ai()` (src/host/ai.ts) converts an `invoke` rejection into a synthetic error+done pair, so the dispatch-failure path is covered — but if the channel simply stops delivering (sidecar process killed mid-turn, Rust relay drops the channel without synthesizing a terminal event), neither callback fires and the applet's `await host.ai(...)` is pending forever with no UI recovery. The guarantee is only as strong as the Rust relay's terminal-event discipline, which this module neither verifies nor bounds.
**Fix:** Add an inactivity watchdog (e.g. reject after N seconds without any event, reset on each delta), or document and test that the Rust relay guarantees a terminal event on sidecar death; at minimum correct the "never hangs" claim.

### WR-03: `useRailDragOut` has no `pointercancel`/`lostpointercapture` handling — leaked listeners and stuck drag UI

**File:** `src/shell/useRailDragOut.ts:120-167`
**Issue:** `handleUp` is the sole cleanup path for the `pointermove`/`pointerup` listeners added on every `pointerdown`. If the gesture ends via `pointercancel` (window loses focus mid-drag, OS gesture interrupt, capture lost) the listeners are never removed and `ghost`/`overlay`/`rowDrag` state is left stuck on screen. Worse, before the 5px threshold no capture is taken, so a press-then-release-outside-the-row leaves a stale `handleMove`/`handleUp` pair attached to the row element; the next drag on that row runs both the fresh and stale closures (each with its own `moved`/`targetIndex`), which can double-fire `reorderRail`/`addAppletToDock` on release.
**Fix:** Register `pointercancel` (and `lostpointercapture`) alongside `pointerup`, routing to a shared cleanup that removes all three listeners and clears drag state; treat cancel as an aborted gesture (no reorder/dock).

### WR-04: No error boundary around applet render — a throwing applet body escapes containment

**File:** `src/shell/PanelBody.tsx:85-92`
**Issue:** The framework's "dispatch never crashes" guarantee only covers *unknown keys* (generic `PanelBody` fallback). A registered applet whose `App` throws during render (the framework's whole purpose is hosting per-applet code of varying maturity, including generated stubs and future Phase 5+ applets) produces an uncaught error: React unmounts that root's tree, leaving a permanently blank panel with no recovery affordance and an error escaping to `window`. There is no per-panel `ErrorBoundary`.
**Fix:** Wrap the rendered module in a minimal error boundary that renders the generic `PanelBody`-style fallback (glyph + title + "this applet crashed" note):

```tsx
root.render(
  <AppletErrorBoundary fallback={<PanelBody appletKey={appletKey} />}>
    <mod.App host={host} />
  </AppletErrorBoundary>,
);
```

### WR-05: Wiki/Library toast timers race each other and outlive the component

**File:** `src/applets/Wiki/index.tsx:478-488,690-693`; `src/applets/Library/index.tsx:729-732`
**Issue:** Every toast schedules `setTimeout(() => setToast(null), 2600)` with no handle tracking. Two rapid actions (e.g. resolving two review items) leave the *first* timer alive; it fires at its original deadline and clears the *second* toast early (visible after ~a few hundred ms instead of 2.6s). Timers also survive unmount — closing the panel mid-toast leaves a pending `setToast` against an unmounted component (silently ignored by React 18, but the timer itself is a leaked callback into a disposed React root).
**Fix:** Keep the timer id in a ref; clear the previous timer before setting a new toast, and clear on unmount via a `useEffect` cleanup.

### WR-06: Applet Catalog panel is not clamped to the viewport when anchored

**File:** `src/shell/AppletCatalog.tsx:83-85` (anchor produced at `src/shell/Dock.tsx:64-67`)
**Issue:** The panel is positioned with raw `{ top: anchor.y, left: anchor.x }` and is 220-320px wide with a 320px-max list. The Dock '+' action button sits at the *right* end of every tab bar, so for any group on the right half of the window `rect.left` puts most of the fixed-position panel past the window's right edge (and for a bottom group, below the bottom edge) — rows become unreachable. The CSS fallback (`top:44px; right:8px`) only applies when no anchor is supplied.
**Fix:** Clamp before render, e.g. `left: Math.min(anchor.x, window.innerWidth - 328)`, `top: Math.min(anchor.y, window.innerHeight - 328)`, or measure the panel post-mount and flip/clamp.

## Info

### IN-01: `aiComplete` doc claims "never resolves empty" but resolves `""` on a delta-less `done`

**File:** `src/host/aiComplete.ts:33-37,56-59`
**Issue:** A `done` event with zero preceding `text_delta` events resolves the promise with the empty string, contradicting the docblock's "(never resolves empty …)" claim.
**Fix:** Correct the docblock, or reject/mark empty completions if the guarantee is intended.

### IN-02: `host.storage.get` conflates stored `null` with "missing"

**File:** `src/host/storage.ts:30-32`
**Issue:** `set(key, null)` round-trips to the caller's fallback because `get` treats `raw === null` as absent. Legitimate for a JSON store, but undocumented in the `AppletStorage` contract — a Phase 5 applet storing nullable values will be surprised.
**Fix:** Document "storing `null` is equivalent to `remove`" in `types.ts`, or only treat `undefined` as missing.

### IN-03: Theme tokens hand-duplicated across four unsynchronized sources

**File:** `src/host/theme.ts:15-29`; `src/applets/Wiki/index.tsx:38-52`; `src/applets/Library/index.tsx:50-64`; (mirrors `src/styles/tokens.css`)
**Issue:** The same palette lives in `tokens.css`, the `host.theme` literal, and each rich applet's local `T` object (which deliberately does not consume `host.theme`), plus test stubs. Casing already drifts (`#0a0a0b` vs `#0A0A0B` — harmless, but proof of drift). One future accent change requires four coordinated edits with no guard.
**Fix:** At minimum add a unit test asserting `host/theme.ts` values appear in `tokens.css`; longer term, generate both from one TS source. Rich applets could read `host.theme` for the tokens that exist there.

### IN-04: Applet modules import `appletDefs` from `src/shell/`

**File:** `src/applets/Wiki/index.tsx:3`; `src/applets/Library/index.tsx:3`; `src/applets/templated.ts:2`
**Issue:** Sanctioned as a leaf single-source-of-truth, but it plants an `src/applets → src/shell` import edge that makes the CR-01 boundary rule harder to state ("no shell imports… except this one") and couples applet modules to shell directory layout.
**Fix:** Consider relocating `appletDefs` to a neutral leaf (e.g. `src/host/appletDefs.ts` or `src/applets/defs.ts`) so `src/applets/**` can be forbidden from importing `src/shell/**` outright.

### IN-05: Demo-interaction nits in the rich ports

**File:** `src/applets/Wiki/index.tsx:614-619,593`; `src/applets/Library/index.tsx:748`
**Issue:** (a) Both "CHOOSE {A}" and "CHOOSE {B}" review buttons invoke the identical `resolve(rq.id, "winner")` — the user's actual choice is discarded (acceptable for a demo, but the two buttons are behaviorally one button). (b) `<a href="#">Trust &amp; limitations</a>` is a dead hash link inside the Tauri webview. (c) Library's INGEST tab badge is hardcoded `badge={1}` rather than derived from `INGEST_QUEUE`.
**Fix:** Pass the chosen side through `resolve` (even if only reflected in the toast), replace the anchor with a styled span, derive the badge from queue length.

### IN-06: `openSettings` console.log stub in Rail

**File:** `src/shell/Rail.tsx:24-27`
**Issue:** Debug `console.log` no-op stub (eslint-disabled inline). Pre-existing from Phase 2 but still shipping in this phase's reviewed surface.
**Fix:** Silence it or route to the same "not built yet" affordance other stubs use.

---

_Reviewed: 2026-07-10T06:30:50Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
