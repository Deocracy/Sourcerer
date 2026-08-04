---
phase: 05-notes-applet
reviewed: 2026-07-13T02:04:21Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/applets/Notes/Notes.module.css
  - src/applets/Notes/Notes.test.tsx
  - src/applets/Notes/index.tsx
  - src/applets/Notes/relativeTime.ts
  - src/applets/Notes/store.ts
  - src/host/instanceState.ts
  - src/shell/registry.ts
findings:
  critical: 2
  warning: 5
  info: 2
  total: 9
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-07-13T02:04:21Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the Notes applet (component, store, relative-time formatter, CSS module, tests) plus the two seam files it touches (`src/host/instanceState.ts`, `src/shell/registry.ts`). The architecture holds: the `host` boundary is respected (storage/AI only through `host`, per-tab selection through the sanctioned `instanceState` seam), the registry override is correct, `instanceState.ts` is a clean re-export, and every CSS custom property referenced in `Notes.module.css` was verified to exist in `tokens.css` (including the `--rail-active-border` shorthand, used the same way `Rail.module.css` uses it).

The defects are concentrated exactly where the phase context predicted — the seams the tests mock and async lifecycle. Two Critical findings: a hydration race that can **erase persisted notes on disk** (pre-hydration mutations + snapshot-at-schedule debounced save), and an in-flight `host.ai()` race that leaks a summary across notes in direct violation of D-03. Five Warnings cover a destructive-confirm state that carries across note switches, a misleading "No notes yet" state, debounce-window data loss on unmount, an unvalidated/uncatchable hydrate path that can wedge the applet for the whole session, and test-coverage gaps on precisely the decided behaviors (D-03/D-06/D-07) — the standing false-green lesson applies.

## Critical Issues

### CR-01: Hydration race can wipe the UI's new note and then clobber all persisted notes on disk

**File:** `src/applets/Notes/store.ts:89-96`, `src/applets/Notes/store.ts:104-110`, `src/applets/Notes/index.tsx:103-108`
**Issue:** The UI is fully interactive before hydration completes — `hydrated` gates nothing in render, so the empty-state "+ New Note" button (and, transiently, nothing else) is live while `storage.get("notes")` is still in flight over Tauri IPC. Sequence:

1. Mount → `ensureHydrated` kicks off the async `storage.get`.
2. User clicks "+ New Note" → `addNote()` puts the note in the store, `scheduleNotesSave(host.storage, notesStore.getState().notes)` captures a **snapshot** `[newNote]` in the timeout closure (store.ts:106-108 writes the captured `notes` param, not flush-time state).
3. Hydration resolves → `notesStore.setState({ notes: sortByUpdatedDesc(diskNotes), ... })` **replaces** the array — the just-created note vanishes from the UI.
4. 400ms later the pending timer fires and writes the stale snapshot `[newNote]` to `sourcerer:Notes:notes` — **every previously persisted note is erased on disk**.

Either half alone is a bug (silent note loss in the UI; disk clobber); together they are a data-loss path on the applet's primary persistence seam. The tests never catch it because `makeStubHost`'s `get` resolves before any interaction. Multi-tab makes the window wider only on first-ever mount, but a single tab on a cold app start is enough.
**Fix:** Three reinforcing changes — do at least the first two:

```tsx
// index.tsx — gate mutation UI on hydration (render nothing/disabled until hydrated)
{!hydrated ? null : selectedNote ? ( /* editor */ ) : ( /* empty state */ )}
// and disable the list-header button: disabled={!hydrated}
```

```ts
// store.ts — read state at FLUSH time (mirrors workspaceStore's read-at-flush contract)
export function scheduleNotesSave(storage: AppletStorage): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void storage.set("notes", notesStore.getState().notes);
  }, SAVE_DEBOUNCE_MS);
}
```

```ts
// store.ts — hydrate must not clobber local mutations that raced ahead
hydratePromise = storage.get<Note[]>("notes", []).then((notes) => {
  notesStore.setState((s) =>
    s.notes.length > 0
      ? { hydrated: true } // local edits won the race; keep them
      : { notes: sortByUpdatedDesc(notes), hydrated: true },
  );
});
```

### CR-02: In-flight summarize resolves onto a different note — D-03 violation (summary leaks across notes)

**File:** `src/applets/Notes/index.tsx:144-157` (vs. the D-03 clear at `index.tsx:97-100`)
**Issue:** `handleSummarize` captures note A, awaits `host.ai()`, then unconditionally `setSummary(result)`. If the user selects note B while the request is in flight (the list rows are never disabled — only the Summarize button is), `selectNote` clears the summary per D-03, but the pending promise then re-sets it — note A's AI summary renders under note B. Same for the error path (`setSummarizeError(true)` fires for a note the user is no longer viewing). This is exactly the behavior D-03 prohibits ("must not leak across notes"), and with the 120s watchdog on `host.ai` the stale window is not theoretical. No test covers it — the mock resolves before any switch can happen.
**Fix:** Token-guard the async result and invalidate the token on selection change:

```tsx
const summarizeSeqRef = useRef(0);

function selectNote(id: string | null) {
  summarizeSeqRef.current++; // invalidate any in-flight summarize
  // ...existing body (setSummary(null); setSummarizeError(false); ...)
}

async function handleSummarize(note: { title: string; body: string }) {
  const seq = ++summarizeSeqRef.current;
  setSummarizing(true);
  setSummarizeError(false);
  try {
    const result = await host.ai(`Summarize this note in 1-2 sentences:\n\n${note.title}\n\n${note.body}`);
    if (seq === summarizeSeqRef.current) setSummary(result);
  } catch {
    if (seq === summarizeSeqRef.current) setSummarizeError(true);
  } finally {
    if (seq === summarizeSeqRef.current) setSummarizing(false);
  }
}
```

## Warnings

### WR-01: Armed delete confirmation survives a selection change — "Delete for real?" fires against a different note

**File:** `src/applets/Notes/index.tsx:124-136`, `src/applets/Notes/index.tsx:93-101`
**Issue:** Clicking Delete on note A arms `confirming` with a 3s window. If the user then clicks note B in the list within that window, `selectNote` changes the selection but neither resets `confirming` nor clears `confirmTimerRef` — the toolbar now shows "Delete for real?" for note B, and a single click deletes note B without its own first-click arm. The confirmation was given for a different record; for a destructive action that is mis-targeted consent.
**Fix:** Disarm inside `selectNote()`:

```tsx
function selectNote(id: string | null) {
  if (confirmTimerRef.current != null) clearTimeout(confirmTimerRef.current);
  setConfirming(false);
  // ...existing body
}
```

### WR-02: "No notes yet" renders whenever selection is null — wrong copy and no selection repair when notes exist

**File:** `src/applets/Notes/index.tsx:232-243`, `src/applets/Notes/index.tsx:159`
**Issue:** The editor's empty branch keys off `selectedNote === null`, not `notes.length === 0`. Two real paths hit it with notes present: (a) multi-tab (D-04 is a first-class feature) — tab B deletes the note tab A has selected; tab A's `selectedNote` find fails and the editor claims "No notes yet" beside a visibly populated list, with no way to know the state is a dangling `selectedId`; (b) pre-hydration flash for a user with existing notes (compounded by CR-01's missing gate). There is also no repair effect — the dangling `selectedId` persists until the user manually clicks a row.
**Fix:** Add a repair effect and branch the copy:

```tsx
// Repair a dangling selection (e.g., another tab deleted the note)
useEffect(() => {
  if (hydrated && seededRef.current && selectedId !== null && !notes.some((n) => n.id === selectedId)) {
    selectNote(notes[0]?.id ?? null);
  }
}, [notes, hydrated, selectedId]);
```

With the repair in place, `selectedNote === null` once seeded implies `notes.length === 0`, and the existing copy becomes truthful.

### WR-03: Up to 400ms of edits silently lost on tab close / unmount — blur does not fire on unmount

**File:** `src/applets/Notes/index.tsx` (no unmount flush effect), `src/applets/Notes/store.ts:104-110`
**Issue:** The only debounce escape hatches are `onBlur={flush}` on the two inputs. React does **not** fire blur handlers when a component unmounts — closing the Notes dockview panel (or switching layouts, which disposes panels) within the 400ms debounce window drops the trailing keystrokes on the floor. The cleared timer never fires and nothing else writes. The Phase 4 CR-02 layout-switch caveat recorded in project memory makes layout-driven disposal a known, expected path.
**Fix:** Flush on unmount, guarded so a pre-hydration unmount cannot write `[]` over real data:

```tsx
useEffect(
  () => () => {
    const s = notesStore.getState();
    if (s.hydrated) flushNotesSave(host.storage, s.notes);
  },
  [host.storage],
);
```

(Safe multi-tab: it writes the full shared array; last-write-wins is accepted per D-05.)

### WR-04: Unvalidated hydrate payload + uncaught hydrate rejection can wedge Notes for the entire app session

**File:** `src/applets/Notes/store.ts:89-96`, `src/applets/Notes/index.tsx:55-57`
**Issue:** `host.storage.get` returns `raw as T` with zero shape validation (verified in `src/host/storage.ts:33` — its try/catch only covers the read itself, not the shape). If `sourcerer:Notes:notes` in applets.json is ever not a `Note[]` (hand-edited file, partial write, future schema drift), `sortByUpdatedDesc([...notes])` throws on non-iterables — and for iterable-but-wrong values (a string) hydration "succeeds" and the component crashes on `note.title.trim()`. Worse, in the throw case the rejected promise is **cached forever** in `hydratePromise`, so `hydrated` never flips true, every remount reuses the rejected promise, and Notes is stuck on the empty state until app restart. The `void ensureHydrated(...)` call site has no `.catch`, so this also surfaces as an unhandled rejection.
**Fix:** Validate and never cache a rejection:

```ts
function isNote(v: unknown): v is Note {
  const n = v as Note;
  return !!n && typeof n === "object" && typeof n.id === "string" &&
    typeof n.title === "string" && typeof n.body === "string" &&
    typeof n.createdAt === "number" && typeof n.updatedAt === "number";
}

export function ensureHydrated(storage: AppletStorage): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = storage
      .get<unknown>("notes", [])
      .then((raw) => {
        const notes = Array.isArray(raw) ? raw.filter(isNote) : [];
        notesStore.setState({ notes: sortByUpdatedDesc(notes), hydrated: true });
      })
      .catch(() => {
        notesStore.setState({ hydrated: true }); // degrade to empty, don't wedge
      });
  }
  return hydratePromise;
}
```

### WR-05: Test suite skips every decided behavior the phase flags as risk — the false-green pattern, fifth occurrence in the making

**File:** `src/applets/Notes/Notes.test.tsx:67-163`
**Issue:** The five tests cover create/edit/delete/summarize-happy/summarize-error, all against instantly-resolving mocks. None of the explicitly decided behaviors are asserted: no test that the summary clears on note switch (D-03 — and CR-02 shows the async half is in fact broken), no test of the D-06/D-07 instanceState restore path (the `getInstanceState` seeding branch at index.tsx:63-73 is entirely unexecuted — every test starts with no saved instanceState), no test of the confirm-timeout disarm, no test of the multi-tab live mirror (two `render`s against one store), and no test with a delayed `storage.get` (which would have caught CR-01). This project has struck the "green mocked tests hide real seam bugs" lesson in four prior phases; these are the exact seams.
**Fix:** Add at minimum: (1) a D-03 test — resolve `host.ai` via a manually-controlled deferred, switch notes mid-flight, assert no summary renders; (2) a restore test — pre-seed `setInstanceState("test-instance", { selectedNoteId: "n1" })` before render and assert n1 is selected over the more-recent n2; (3) a hydration-race test — `storage.get` returns a deferred, click "+ New Note" (post-fix: assert the button is gated), then resolve and assert nothing is lost.

## Info

### IN-01: Note list rows are mouse-only — no keyboard or AT access

**File:** `src/applets/Notes/index.tsx:174-183`
**Issue:** Rows are `<div onClick>` with no `role="button"`/`option`, no `tabIndex`, no key handler — the list cannot be operated by keyboard and is invisible to assistive tech as an interactive control (the tests themselves have to query these rows by text, not role).
**Fix:** `role="option"`/`aria-selected` (or `role="button"`), `tabIndex={0}`, and Enter/Space handling — or render rows as `<button>`s styled to the same tokens.

### IN-02: relativeTime labels never tick, and future timestamps read "just now"

**File:** `src/applets/Notes/relativeTime.ts:7-16`, `src/applets/Notes/index.tsx:181`, `src/applets/Notes/index.tsx:199`
**Issue:** Labels are computed at render; with no interval-driven re-render, a note reads "just now" indefinitely until some unrelated state change re-renders the list. A negative diff (clock adjustment, future `updatedAt` from another machine someday) also silently falls into "just now" rather than being clamped intentionally.
**Fix:** A coarse `useEffect` interval (e.g., 60s) bumping a counter is enough; add `if (diff < 0) return "just now";` as an explicit clamp with a comment.

---

_Reviewed: 2026-07-13T02:04:21Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
