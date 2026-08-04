---
phase: 06-dashboard-assistant-home
reviewed: 2026-07-14T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - src/app/AppShell.tsx
  - src/assistant/AssistantPanel.module.css
  - src/assistant/AssistantPanel.test.tsx
  - src/assistant/AssistantPanel.tsx
  - src/assistant/assistantSnap.test.ts
  - src/assistant/assistantSnap.ts
  - src/assistant/proposalParse.test.ts
  - src/assistant/proposalParse.ts
  - src/assistant/sessionSeeds.ts
  - src/assistant/useAssistantResize.ts
  - src/home/Home.dnd.test.tsx
  - src/home/HomeCard.tsx
  - src/home/SortableCard.tsx
  - src/home/cardDefs.ts
  - src/home/homeCards.storage.ts
  - src/home/homeCardsReducer.test.ts
  - src/home/homeCardsReducer.ts
  - src/persistence/validate.ts
  - src/persistence/workspaceStore.ts
  - src/shell/DiviChip.tsx
  - src/shell/Home.module.css
  - src/shell/Home.test.tsx
  - src/shell/Home.tsx
  - src/shell/LogoCluster.tsx
  - src/store/shellStore.ts
  - src/store/shellStore.test.ts
  - src/styles/tokens.css
findings:
  critical: 3
  warning: 9
  info: 7
  total: 19
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-07-14
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Phase 6 grows the AssistantPanel into a multi-session panel with proposal parsing and a bespoke resize, and adds the dnd-kit Home dashboard with persisted section membership. The pure modules (`assistantSnap.ts`, `proposalParse.ts`, `homeCardsReducer.ts`) are clean and well-tested. However, three critical defects survive the 100%-green unit tests, all in the *wiring* between pure logic and the live surfaces — the same false-green failure mode this project has struck four times before:

1. The assistant resize hook feeds the snap function the **panel's own width** as `hostWidth`, while the snap math (and its unit tests) assume the workspace/window width. At the default 280px width the "open" snap bucket is mathematically unreachable — every resize release either closes the panel or "fulls" it to a 120px (or 0px) width.
2. `loadSections()` blind-casts arbitrary persisted JSON to `SectionMap`; a corrupt `applets.json` value crashes Home's render — directly violating the T-06-06-01 truth and the project's own `validate.ts` standard.
3. Session switching races `host.loadSession`: a slow history stream for session A overwrites session B's visible thread with no staleness guard.

The Home mint/persistence seam also has a data-loss-shaped gap (minted card ids persist while their defs do not), and emptied sections can never receive a drop.

## Critical Issues

### CR-01: Assistant resize snap uses the panel's own width as `hostWidth` — "open" snap unreachable at default width, "full" snaps to 120px (or 0px from the closed strip)

**File:** `src/assistant/useAssistantResize.ts:45-47` (with `src/assistant/assistantSnap.ts:29-34`, `src/assistant/AssistantPanel.tsx:348,367`)
**Issue:** `hostRef` is attached to the panel div itself (and to the 6px `closedStrip` when closed). At `pointerdown` the hook captures `hostWidth = hostRect.width` — the panel's **current width**, not the workspace width the snap math assumes (the unit tests in `assistantSnap.test.ts` all pass `hostWidth` of 1200/500, i.e. viewport-scale; the hook's own fallback is `window.innerWidth`, confirming the intended semantic).

Trace at the default `asstWidth: 280`:
- Open clamp upper bound = `hostWidth - 160` = `280 - 160 = 120`, which is **below** `CLOSE_AT` (180). So *every* release with `raw ≤ FULL_AT` clamps to ≤120 → `{ mode: "closed" }`. The `{ mode: "open", width }` bucket is unreachable — the user can never resize the panel to any width.
- Dragging past `FULL_AT` (620) yields "full", but `applySnapToShellStore` then sets `asstWidth = Math.max(0, 280 - 160) = 120` — "full" mode produces a 120px panel.
- From the closed strip (`hostWidth = 6`): "full" sets `asstWidth = Math.max(0, 6 - 160) = 0` — the panel reopens at width **0**, an invisible open panel. The CSS comment ("a drag-out from the strip can reopen") describes behavior that cannot work with this measurement.

The green `assistantSnap.test.ts` suite is a false green for the feature: it validates the pure function under viewport-scale `hostWidth` inputs the hook never supplies.
**Fix:** Measure the drag context width from the workspace container (or `window.innerWidth`), not the panel:
```ts
// useAssistantResize.ts — pointerdown
const hostRect = hostRef.current?.getBoundingClientRect();
const hostRight = hostRect ? hostRect.right : window.innerWidth;
const hostWidth = window.innerWidth; // or the shell-body container's width, mirroring useRailDrag's nav reference
```
Then add an integration-shaped test asserting that a release at e.g. `raw = 300` from the default 280px panel yields `{ mode: "open", width: 300 }` through the hook's actual inputs.

### CR-02: `loadSections()` blind-casts untrusted persisted JSON — corrupt `applets.json` crashes Home

**File:** `src/home/homeCards.storage.ts:33-42` (crash site `src/shell/Home.tsx:137-151`)
**Issue:** The function's contract (and comment) promises "corrupt/missing storage never crashes Home" (T-06-06-01), but only *read errors* and *null/undefined* fall back to `DEFAULT_SECTIONS`. Any other value — `{"pins": "corrupt"}`, `[]`, `42`, `{"pins": [1, 2]}` — is returned via `return raw as SectionMap` with zero structural validation. Home then evaluates `ids.map(...)` inside `grid()`: `sections[sec] || []` passes a truthy non-array through (a string has no `.map`), throwing a `TypeError` that unmounts the Home overlay. This is exactly the CR-05 failure mode `src/persistence/validate.ts` documents and guards against for `workspace.json` ("a record like `{ rail: {} }` passes a shallow check … then crashes the shell") — the project's own established standard was not applied to this new persistence read.
**Fix:**
```ts
function isValidSectionMap(v: unknown): v is SectionMap {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  return SECTION_ORDER.every(
    (k) => Array.isArray((v as Record<string, unknown>)[k]) &&
      ((v as Record<string, unknown[]>)[k]).every((id) => typeof id === "string"),
  );
}
// in loadSections:
if (!isValidSectionMap(raw)) return DEFAULT_SECTIONS;
return raw;
```
Add a test feeding a malformed persisted value and asserting fallback (the current test truth claims this behavior exists; it does not).

### CR-03: Session-switch race — a stale `host.loadSession` history stream overwrites the newly-selected session's thread

**File:** `src/assistant/AssistantPanel.tsx:130-174`
**Issue:** The active-session effect fires `void host.loadSession(activeSessionId, onEvent)` with no cleanup and no staleness guard. `onEvent` closes over `setMessages` unconditionally: if the user clicks session A's chip and then session B's chip before A's `history` event arrives (the sidecar round-trip is async and unbounded), A's late `history` event executes `setMessages(replayed)` — replacing session B's visible thread with **session A's transcript**. The user now reads (and can reply into) a thread rendered under the wrong session chip; the next send goes to session B's `sessionId` with session A's transcript on screen. React's effect model provides the exact tool for this and it is unused.
**Fix:**
```ts
useEffect(() => {
  let stale = false;
  // ... seeding ...
  const onEvent = (event: AssistantEvent) => {
    if (stale) return;
    if (event.type === "history" && event.turns.length > 0) { /* setMessages */ }
  };
  void host.loadSession(activeSessionId, onEvent);
  return () => { stale = true; };
}, [activeSessionId]);
```

## Warnings

### WR-01: Minted card ids are persisted but their defs are not — minted cards silently vanish on restart and orphan ids accumulate forever

**File:** `src/shell/Home.tsx:89-105` (render guard at `:145`, load at `homeCards.storage.ts`)
**Issue:** The ＋MAKE CARD consumer writes the minted def into the in-memory `cardDefs` registry and the minted **id** into `sections.fresh`, then persists sections via `scheduleSaveSections`. After a restart, `sections.fresh` still contains `minted-…` ids but `cardDefs` no longer has their defs — `cardDefs[id] ? … : null` silently drops them. Net effect: (a) user-created cards disappear without explanation on every restart (data-loss-shaped UX even if D-05 scopes card *content* as demo-only this phase); (b) dead `minted-…` ids accumulate in the persisted map unboundedly — there is no GC or load-time filter. `findSection`/drag logic also iterates these ghosts.
**Fix:** Either persist minted defs alongside the section map (one `{ defs, sections }` record under the same key), or filter unknown ids at load time (`loaded[k].filter((id) => cardDefs[id])`) so the persisted map stays bounded and honest.

### WR-02: Emptied sections can never receive a drop — the section-id branch of `moveBetweenSections` is dead code in this wiring

**File:** `src/shell/Home.tsx:137-151` (dead branch: `src/home/homeCardsReducer.ts:36`)
**Issue:** `moveBetweenSections` explicitly handles `overId` naming a section directly, and its test covers it — but nothing in Home registers a section container as a droppable (`useDroppable(sec)` is never called; when a section is empty, `grid()` returns `<EmptySection />` with no `SortableContext` and no droppable node at all). dnd-kit's `over.id` can therefore only ever be a *card* id. Consequences: drag the only LIVING card out and LIVING is permanently unreachable as a drop target (and that emptiness is persisted); the reducer's section-id branch is untestable-in-production dead code, and the EmptySection copy ("Cards appear here as you pin items") promises an interaction that cannot happen via drag.
**Fix:** Wrap each section body in a `useDroppable({ id: sec })` container (rendered even when empty) so `over.id` can resolve to the section key the reducer already handles.

### WR-03: `closeSession` never removes real sessions — closed sessions resurrect on restart and the persisted id list grows without bound

**File:** `src/assistant/AssistantPanel.tsx:112-116,183-194`
**Issue:** Close only adds the id to session-only `closedIds`; `realSessions` is never shrunk, and the persistence effect (whose comment claims it fires "whenever it grows/shrinks" — it can only grow) keeps writing every closed real session's id to `SESSION_IDS_KEY`. Every closed session reappears on the next launch (as an indistinct "Session" chip), and the localStorage array grows monotonically for the lifetime of the install — each entry also re-triggering a `host.loadSession` when selected.
**Fix:** For real sessions, remove from `realSessions` in `closeSession` (letting the persistence effect shrink the stored list); keep `closedIds` only for seeds, which cannot be removed from the static `sessionSeeds` array.

### WR-04: History replay drops proposal parsing and leaves a stale `focusedProposalId`

**File:** `src/assistant/AssistantPanel.tsx:156-170,234-253`
**Issue:** Two related gaps in the `history` replay path: (a) unlike the seeded-transcript path (lines 144-154), replayed turns are never run through `parseProposal` — a real session whose last assistant turn carried a proposal loses its y/d/n block after an app restart, an inconsistency with the seeded path in the same effect; (b) `setFocusedProposalId` is not reset when `setMessages(replayed)` replaces the seeded messages, so `focusedProposalId` can point at a message id that no longer exists — the y/d/n key handler then `preventDefault()`s bare `y`/`d`/`n` keypresses shell-wide (outside inputs) while doing nothing visible.
**Fix:** In the `history` branch, run the same last-assistant-turn `parseProposal` attachment used for seeds, and set `focusedProposalId` to the result (or `null`).

### WR-05: `CardBody({ t })` is called before the `if (!t) return null` guard and dereferences `t` — the null guard is dead code that crashes first

**File:** `src/home/SortableCard.tsx:25-31`, `src/home/HomeCard.tsx:643-647`, `src/home/SortableCard.tsx:64-67` (OverlayCard)
**Issue:** All three card components do `const t = cardDefs[id]; const body = CardBody({ t }); if (!t) return null;`. `CardBody` immediately reads `t.dim`, `t.bar`, `t.variant` — with an unknown id, the guard never runs because `CardBody` throws `TypeError: Cannot read properties of undefined` first. Currently masked by Home's `cardDefs[id] ?` render guard, but any future caller (or a race where a minted def is deleted mid-drag) crashes instead of degrading. The hook-ordering constraint (CardBody's `useState`s must run unconditionally) explains the call placement but not the missing null-tolerance.
**Fix:** Make `CardBody` null-tolerant (`t?.dim`, early bail-out branch returning empty kids after the hooks run), or type `t: CardDef | undefined` and guard inside — the hooks still execute unconditionally either way.

### WR-06: Resize drag has no `pointercancel`/`lostpointercapture` handling — an interrupted drag leaks listeners and pins the "LET GO TO SNAP" cue

**File:** `src/assistant/useAssistantResize.ts:49-65`
**Issue:** Only `pointermove`/`pointerup` are attached. If the drag is cancelled (window loses focus, OS gesture, touch cancel, element removal), `pointerup` never fires: the move/up listeners stay attached to the grip, `liveSnap` stays non-null (the full-mode cue renders permanently), and the next `pointerdown` stacks a second set of handlers. `releasePointerCapture` can also throw if capture was already lost — it is not wrapped.
**Fix:** Attach a shared `handleCancel` for `pointercancel` (and reuse it from `handleUp`) that removes all three listeners, wraps `releasePointerCapture` in try/catch, and clears `liveSnap` without applying a snap.

### WR-07: Home's debounced section save has no close-flush — a drag within 300ms of window close is silently lost

**File:** `src/home/homeCards.storage.ts:62-68`
**Issue:** `workspaceStore.ts` invests heavily in close-safety (WR-02/WR-03/PERS-04: `flushPendingSave`, the `workspace:flush-before-close` handshake, serialized write chain) precisely because a debounced writer plus window close loses the pending write. The new `homeCards.storage.ts` debounce reproduces the writer shape but not the flush authority: dragging a card and closing the window inside the 300ms window (or before the async `flush()`'s `store.save()` settles) silently discards the layout. There is also no write serialization — two flushes 300ms apart can interleave `set`/`save` pairs if IPC is slow.
**Fix:** Export a `flushPendingSectionsSave()` and call it from the existing `workspace:flush-before-close` path (or have `flushPendingSave` in workspaceStore invoke registered flushers), mirroring the established pattern.

### WR-08: `onDragEnd` with `over == null` leaves onDragOver's cross-section moves applied in state but never persisted

**File:** `src/shell/Home.tsx:124-133`
**Issue:** `onDragOver` mutates `sections` (cross-section moves) on every hover frame but deliberately does not save; `onDragEnd` persists — except it early-returns when `over` is null (release outside any droppable). The moved state remains on screen and `dirtyRef` is set (so the mount load won't fix it), but disk still holds the pre-drag map: the UI and persisted state silently diverge until some later drag saves. A restart quietly reverts what the user saw.
**Fix:** In the `!over` arm, still call `scheduleSaveSections(sections)` (current state), or revert the onDragOver moves on a null-target drop — either makes screen and disk agree.

### WR-09: Assistant session-id list persists in raw `localStorage`, against the project's persistence standard

**File:** `src/assistant/AssistantPanel.tsx:34,44,115`
**Issue:** CLAUDE.md's stack guidance explicitly warns off raw webview `localStorage` ("lost on certain reset/profile scenarios … route through tauri-plugin-store"); Phase 3 migrated the shell's two localStorage scaffolds to `workspace.json` for exactly this reason, and this very phase's Home persistence correctly uses `LazyStore("applets.json")`. The grown multi-session id list (now durable, user-visible state whose loss orphans real sidecar sessions) stays on `localStorage`. A webview data reset silently strands every past session while the sidecar still holds their transcripts.
**Fix:** Move `SESSION_IDS_KEY` reads/writes to the plugin-store (e.g. the same `applets.json` under `sourcerer:assistant:sessionIds`), with the same never-throws load fallback. (Acknowledged Phase-7 carry-over — but the phase that generalized the key was the natural migration point.)

## Info

### IN-01: `lastResolvedProposal` is write-only

**File:** `src/store/shellStore.ts:53,168`; writer `src/assistant/AssistantPanel.tsx:202`
**Issue:** No production code reads `lastResolvedProposal` — only the writer and tests touch it. Dead cross-surface state, or an undocumented future seam.
**Fix:** Remove it, or add a comment naming its intended consumer.

### IN-02: `isValidRail` type predicate accepts records missing fields the `rail` type declares required

**File:** `src/persistence/validate.ts:26-43` vs `src/persistence/workspaceStore.ts:29-40`
**Issue:** `asstWidth`/`assistantOpen` are non-optional on `WorkspaceRecordV1["rail"]`, but the guard deliberately accepts `undefined` — the predicate asserts a type the value may not satisfy. Runtime-safe today only because `hydrateFromDisk`/`shellStore` apply `?? 280` / `?? true`, but any new consumer trusting the type reads `undefined` from a "validated" record.
**Fix:** Mark the two fields optional (`asstWidth?: number`) on the type, matching the guard and the existing `??` fallbacks.

### IN-03: Every restored real session is labeled "Session" — duplicate titles and aria-labels

**File:** `src/assistant/AssistantPanel.tsx:50,392`
**Issue:** `loadRealSessions` labels all reconstructed sessions "Session"; chips get identical `title="Session"` and `aria-label="Close session Session"`, making them indistinguishable to screen readers and `getByTitle` alike.
**Fix:** Persist labels alongside ids, or label positionally ("Session II").

### IN-04: `stack` variant divides by zero on an empty `claims` array

**File:** `src/home/HomeCard.tsx:357-360`
**Issue:** `idx` guards with `claims.length || 1` but `onClickExtra` computes `(i + 1) % claims.length` → `NaN` for an empty array, and the counter renders "1 / 0". Latent (the one stack def has 3 claims), but the guard on one line and not the other shows the edge was half-considered.
**Fix:** `if (claims.length > 0)` before assigning `onClickExtra`.

### IN-05: y/d/n shortcuts ignore modifier keys and contentEditable targets

**File:** `src/assistant/AssistantPanel.tsx:235-249`
**Issue:** `Ctrl+Y` (redo), `Cmd+D` etc. are swallowed whenever a proposal is focused, and typing into a future contentEditable surface isn't exempted (only TEXTAREA/INPUT are).
**Fix:** Bail out when `e.ctrlKey || e.metaKey || e.altKey`, and add `(e.target as HTMLElement)?.isContentEditable` to the typing guard.

### IN-06: Stale floating-inset comment (and orphan token) in tokens.css

**File:** `src/styles/tokens.css:78,123-127`
**Issue:** The body comment still describes "App's 20px floating-window margin", and `--window-inset: 20px` remains — the 20px floating stage was cut by user decision (2026-07-07, CLAUDE.md constraint). Misleading for the next reader of the window chrome.
**Fix:** Update the comment to the card-fills-window model; remove `--window-inset` if nothing consumes it.

### IN-07: `HomeCard` component is dead code after Plan 06-06

**File:** `src/home/HomeCard.tsx:643-661`
**Issue:** Only `CardBody`/`CardFrame` are imported (by `SortableCard.tsx`); the `HomeCard` component itself has no remaining consumer since Home switched to `SortableCard`.
**Fix:** Delete the component (keep `CardBody`/`CardFrame`), or annotate why the static variant is retained.

---

_Reviewed: 2026-07-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
