# Phase 6: Dashboard Assistant & Home - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 14
**Analogs found:** 12 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/assistant/AssistantPanel.tsx` (EDIT — grow, don't replace) | component | streaming | itself (Phase 7 shipped version) | exact — same file |
| `src/assistant/sessionSeeds.ts` (NEW) | config/data | transform | `home-cards.js` `cardDefs` (static registry idiom) | role-match |
| `src/assistant/proposalParse.ts` (NEW) | utility | transform | `src/shell/railSnap.ts` (pure fn, unit-tested independently of the hook) | exact — pure-fn pattern |
| `src/assistant/proposalParse.test.ts` (NEW) | test | transform | `src/shell/railSnap.test.ts` | exact |
| `src/assistant/useAssistantResize.ts` (NEW) | hook | event-driven | `src/shell/useRailDrag.ts` | exact — pointer-capture resize hook, mirrored/inverted |
| `src/assistant/assistantSnap.ts` (NEW) | utility | transform | `src/shell/railSnap.ts` | exact — pure fn(raw px) -> mode |
| `src/assistant/assistantSnap.test.ts` (NEW) | test | transform | `src/shell/railSnap.test.ts` | exact |
| `src/shell/DiviChip.tsx` (EDIT) | component | event-driven | itself (Phase 2 stub) | exact — replace no-op handler + selector |
| `src/shell/LogoCluster.tsx` (EDIT) | component | event-driven | itself (Phase 1 stub) | exact — replace no-op handler |
| `src/shell/Home.tsx` (NEW) | component | CRUD | `home-cards.js` `Home` (design handoff, full port) | exact — direct port target |
| `src/home/cardDefs.ts` (NEW) | config/data | transform | `home-cards.js` `cardDefs` object | exact — direct port |
| `src/home/HomeCard.tsx` (NEW) | component | transform | `home-cards.js` `CardBody`/`CardFrame` | exact — direct port |
| `src/home/SortableCard.tsx` (NEW) | component | event-driven | `home-cards.js` `SortableCard`/`OverlayCard` | exact — direct port |
| `src/home/homeCards.storage.ts` (NEW) | utility/storage | file-I/O | `src/host/storage.ts` (`makeAppletStorage`) + `src/persistence/workspaceStore.ts` (debounce) | role-match — compose two existing patterns |
| `src/store/shellStore.ts` (EDIT — add `asstWidth`/`assistantOpen`/`homeOpen`/last-proposal slice) | store | CRUD | itself (existing `railMode`/`railWidth` slice) | exact — same file, same slice template |

## Pattern Assignments

### `src/assistant/AssistantPanel.tsx` (component, streaming) — GROW IN PLACE

**Analog:** itself, `D:\Vibe Coding\Sourcerer\src\assistant\AssistantPanel.tsx` (Phase 7, full file already read — 209 lines)

**Do not rewrite.** Add to the existing component:
1. A `sessions: SessionEntry[]` array (real + seed, from `sessionSeeds.ts`) and `activeSessionId` state, replacing the single `useRef(loadOrMintSessionId())`.
2. Extend the `case "done":` branch to call `parseProposal(m.text)` (Pattern from `proposalParse.ts`) and attach the result to the message.
3. Wire `useAssistantResize()` onto a new resize-grip element in the panel's JSX, driving the new `shellStore` slice.

**sessionId minting pattern to reuse verbatim for multi-session (lines 17-42):**
```typescript
const newSessionId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 21);
const SESSION_STORAGE_KEY = "sourcerer:assistant:sessionId";
function loadOrMintSessionId(): string {
  const stored = localStorage.getItem(SESSION_STORAGE_KEY);
  if (stored) return stored;
  const minted = newSessionId();
  localStorage.setItem(SESSION_STORAGE_KEY, minted);
  return minted;
}
```
For multi-session, generalize this into a list-backed variant (e.g. `sourcerer:assistant:sessionIds`) — do not reinvent the alphanumeric-only alphabet workaround (CR-01 landmine: default nanoid's URL-safe alphabet can start/end with `_`/`-`, rejected by the sidecar's `SESSION_ID_PATTERN`, and the rejection is cached — permanently wedging the session).

**Event-switch core pattern (lines 103-138), the shape every new event branch must match:**
```typescript
const onEvent = (event: AssistantEvent) => {
  switch (event.type) {
    case "text_delta": /* append event.text to message */ break;
    case "tool_start": /* toolNotice */ break;
    case "tool_end": /* clear toolNotice */ break;
    case "error": /* status: "error", text: `assistant unavailable: ${event.message}` */ break;
    case "done": /* status: "done" — EXTEND HERE with parseProposal(m.text) */ break;
    case "ready":
    case "thinking_delta":
      break; // still suppressed per Phase 7 discretion default
  }
};
```

**History-replay pattern for reopening a seeded/real session (lines 66-84):**
```typescript
useEffect(() => {
  const onEvent = (event: AssistantEvent) => {
    if (event.type === "history") {
      const replayed: ChatMessage[] = event.turns.map((turn) => ({
        id: nanoid(), role: turn.role, text: turn.text, status: "done",
      }));
      setMessages(replayed);
    }
  };
  void host.loadSession(sessionId.current, onEvent);
}, []);
```
Reuse this per-session (call `host.loadSession(id, onEvent)` when the user selects a *real* session chip); seed sessions instead render their canned transcript directly from `sessionSeeds.ts` with no `host.loadSession` call and a disabled/hidden composer (per UI-SPEC "Interaction Notes — ASST-01").

**Error copy (line 121) — reuse verbatim, do not introduce a second error string:**
```typescript
text: `assistant unavailable: ${event.message}`,
```

---

### `src/host/ai.ts` — CONSUME UNCHANGED (no analog needed, read-only reference)

**File:** `D:\Vibe Coding\Sourcerer\src\host\ai.ts` (146 lines, full file read)

This is the shell-level `host` object (`{ ai, setModes, loadSession }`) — distinct from `src/host/index.ts`'s `makeHost()` applet-facing `Host` (5-member: `storage, ai, open, instanceId, theme`). **Pitfall 1 from RESEARCH.md is real** — Phase 6 code must import `host` from `src/host/ai.ts`, never construct/import `makeHost()`. The `AssistantEvent` union (8 shapes: `ready, thinking_delta, text_delta, tool_start, tool_end, error, done, history`) is final for this phase — do not add a 9th shape for proposals (D-02).

---

### `src/assistant/proposalParse.ts` (utility, transform) — NEW

**Analog:** `D:\Vibe Coding\Sourcerer\src\shell\railSnap.ts` (34 lines, full file read) — the "pure function, independently unit-tested, constants at module top" idiom to mirror:

```typescript
// Pattern to mirror (railSnap.ts):
export const HIDDEN_W = 6;
export const COMPACT_W = 56;
export type RailSnap =
  | { mode: "hidden" }
  | { mode: "compact" }
  | { mode: "expanded"; width: number };
export function snapWidthToMode(raw: number): RailSnap {
  const clamped = Math.max(0, raw);
  if (clamped < CLOSE_AT) return { mode: "hidden" };
  if (clamped < COMPACT_AT) return { mode: "compact" };
  return { mode: "expanded", width: Math.min(clamped, EXPANDED_MAX) };
}
```
Apply the same shape to `proposalParse.ts`: a discriminated-union return type (`Proposal | null`), pure/synchronous, no React/DOM dependency, module-level constants (the marker regex/token) documented with a comment on *why* the convention was chosen (mirrors railSnap's header comment tying constants to tokens.css). See RESEARCH.md Pattern 3 for the marker-convention recommendation (a `Proposal —`/`Proposal:`-prefixed Markdown blockquote).

### `src/assistant/proposalParse.test.ts` (test) — NEW

**Analog:** `D:\Vibe Coding\Sourcerer\src\shell\railSnap.test.ts` (37 lines, full file read) — boundary-style `describe`/`it` structure, one `expect(...).toEqual(...)` per case, explicit boundary values (just-under / at-threshold), no mocking needed since the function under test is pure:
```typescript
import { describe, it, expect } from "vitest";
import { snapWidthToMode, CLOSE_AT, COMPACT_AT, EXPANDED_MAX } from "./railSnap";
describe("snapWidthToMode(raw)", () => {
  it("clamps negative input to 0 before bucketing -> hidden", () => {
    expect(snapWidthToMode(-50)).toEqual({ mode: "hidden" });
  });
  // ...boundary cases at CLOSE_AT-1, CLOSE_AT, COMPACT_AT-1, COMPACT_AT, etc.
});
```
Mirror this exactly for `proposalParse.test.ts`: fixture strings for (a) the seeded demo transcript's authored proposal text (guaranteed to parse), (b) synthetic marker-convention text, (c) plain prose with no marker (must return `null`).

---

### `src/assistant/useAssistantResize.ts` (hook, event-driven) — NEW

**Analog:** `D:\Vibe Coding\Sourcerer\src\shell\useRailDrag.ts` (172 lines, full file read) — specifically `onResizePointerDown` (lines 42-69):
```typescript
const onResizePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
  if (e.button !== 0) return;
  e.preventDefault();
  const target = e.currentTarget;
  const pointerId = e.pointerId;
  target.setPointerCapture(pointerId);
  const navRect = navElRef.current?.getBoundingClientRect();
  const navLeft = navRect ? navRect.left : 0;

  const handleMove = (ev: PointerEvent) => {
    const raw = Math.max(0, Math.min(520, ev.clientX - navLeft));
    setLiveSnap(snapWidthToMode(raw));
  };
  const handleUp = (ev: PointerEvent) => {
    target.releasePointerCapture(pointerId);
    target.removeEventListener("pointermove", handleMove);
    target.removeEventListener("pointerup", handleUp);
    setLiveSnap(null);
    const raw = Math.max(0, Math.min(520, ev.clientX - navLeft));
    const snap = snapWidthToMode(raw);
    shellStore.getState().setRailMode(snap.mode);
    if (snap.mode === "expanded") shellStore.getState().setRailWidth(snap.width);
  };
  target.addEventListener("pointermove", handleMove);
  target.addEventListener("pointerup", handleUp);
}, []);
```

**CRITICAL — do not copy the formula verbatim (RESEARCH.md Pattern 2 / Anti-Pattern):** the rail measures `ev.clientX - navLeft` (drag distance from the LEFT edge, since the rail is on the left and grows rightward). The assistant is the RIGHT-hand panel — mirror the formula to `hostRect.right - ev.clientX` (drag distance from the panel's own right edge). RESEARCH.md's own worked example for this hook (already vetted against the handoff's `startRightResize`):
```typescript
const onResizePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
  if (e.button !== 0) return;
  e.preventDefault();
  const target = e.currentTarget;
  target.setPointerCapture(e.pointerId);
  const hostRect = panelHostRef.current?.getBoundingClientRect();
  const hostRight = hostRect ? hostRect.right : window.innerWidth;

  const handleMove = (ev: PointerEvent) => {
    const raw = hostRight - ev.clientX;
    setLiveSnap(snapWidthToAsstMode(raw, hostRect?.width ?? window.innerWidth));
  };
  const handleUp = (ev: PointerEvent) => {
    target.releasePointerCapture(e.pointerId);
    target.removeEventListener("pointermove", handleMove);
    target.removeEventListener("pointerup", handleUp);
    setLiveSnap(null);
    const raw = hostRight - ev.clientX;
    const snap = snapWidthToAsstMode(raw, hostRect?.width ?? window.innerWidth);
    applySnapToShellStore(snap); // sets asstWidth / assistantOpen / fullscreen flag
  };
  target.addEventListener("pointermove", handleMove);
  target.addEventListener("pointerup", handleUp);
}, []);
```
Also reuse `useRailDrag.ts`'s double-click-to-cycle idiom (lines 71-73) and its global-keydown-listener idiom (lines 77-86, `Cmd-\` cycling) as optional secondary affordances if the plan wants a keyboard shortcut for open/closed/full — same `document.addEventListener("keydown", ...)` + cleanup shape.

### `src/assistant/assistantSnap.ts` (utility, transform) — NEW

**Analog:** `D:\Vibe Coding\Sourcerer\src\shell\railSnap.ts` (full file, reproduced above) — same pure-function idiom, 3-state discriminated union. RESEARCH.md Pattern 2 already supplies the concrete recovered thresholds (traced to the handoff's `startRightResize`, lines 514-542 of `Sourcerer Bespoke Rails.dc.html`) — use these as-is unless the plan deliberately overrides:
```typescript
export type AsstSnap =
  | { mode: "closed" }
  | { mode: "open"; width: number }
  | { mode: "full" };

const HIDDEN_W = 6;      // matches --asst-closed-w (06-UI-SPEC.md)
const CLOSE_AT = 180;
const FULL_AT = 620;     // raw drag distance from the host's right edge

export function snapWidthToAsstMode(raw: number, hostWidth: number): AsstSnap {
  if (raw > FULL_AT) return { mode: "full" };
  const clamped = Math.max(HIDDEN_W, Math.min(hostWidth - 160, raw));
  if (clamped < CLOSE_AT) return { mode: "closed" };
  return { mode: "open", width: clamped };
}
```
Default reopen-from-closed width: `280px` (matches `--asst-width-default` in 06-UI-SPEC.md).

### `src/assistant/assistantSnap.test.ts` (test) — NEW

**Analog:** `railSnap.test.ts` (same structure as above) — boundary cases at `HIDDEN_W`, `CLOSE_AT - 1`/`CLOSE_AT`, `FULL_AT - 1`/`FULL_AT + 1`, plus the `hostWidth - 160` clamp case (a case `railSnap.test.ts` doesn't need since rail has no second-argument clamp — add one boundary test for this assistant-specific clamp).

---

### `src/shell/DiviChip.tsx` (component, event-driven) — EDIT

**File:** `D:\Vibe Coding\Sourcerer\src\shell\DiviChip.tsx` (28 lines, full file read)

Current stub (replace both the handler and the selector per RESEARCH.md Pitfall 4):
```typescript
function toggleDivi() {
  console.log("toggleDivi: no-op stub in Phase 2 (Home overlay not built yet)");
}
export function DiviChip() {
  const active = useShellStore((s) => s.railApplet === "Home"); // STALE — Phase 2 placeholder
  return (
    <button type="button" className={active ? `${styles.chip} ${styles.active}` : styles.chip} onClick={toggleDivi}>
      DIVI
    </button>
  );
}
```
Replace with a real `shellStore` action + the new `homeOpen` boolean selector (per D-04), following the `useRailDrag.ts`/`shellStore` action-call convention (`shellStore.getState().someAction()` from an event handler, `useShellStore((s) => s.someBoolean)` for the read). Do NOT keep `railApplet === "Home"` as a second parallel "is Home showing" signal — this is the exact anti-pattern RESEARCH.md Pitfall 4 warns about.

### `src/shell/LogoCluster.tsx` (component, event-driven) — EDIT

**File:** `D:\Vibe Coding\Sourcerer\src\shell\LogoCluster.tsx` (41 lines, full file read)

Same shape — replace the `openHome` no-op (lines 10-13) with a call to the same `shellStore` action used by `DiviChip`'s `toggleDivi`, so both entry points drive one boolean, never two:
```typescript
function openHome() {
  console.log("openHome: no-op stub in Phase 1 (no workspace to toggle yet)");
}
export function LogoCluster() {
  return (
    <div className={styles.cluster} onClick={openHome}>
      {/* svg logo mark + wordmark, unchanged */}
    </div>
  );
}
```

---

### `src/shell/Home.tsx` (component, CRUD) + `src/home/cardDefs.ts` + `src/home/HomeCard.tsx` + `src/home/SortableCard.tsx` — NEW, direct port

**Analog:** `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/home-cards.js` (338 lines, full file read — the complete, working dnd-kit reference).

**Imports to convert (top of file, lines 1-13):**
```javascript
// BEFORE (prototype, esm.sh, React-via-createElement):
import React from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter } from 'https://esm.sh/@dnd-kit/core@6.1.0?...';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from 'https://esm.sh/@dnd-kit/sortable@8.0.0?...';
import { CSS } from 'https://esm.sh/@dnd-kit/utilities@3.2.2?...';
const h = React.createElement;
```
```typescript
// AFTER (real bundler, per CLAUDE.md "drop the React-via-props indirection"):
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
// h(...) calls become JSX; no createRoot/mountHome wrapper needed — Home becomes
// an ordinary component mounted by AppShell/App.tsx, same convention as AssistantPanel.
```

**`cardDefs` registry (lines 22-56) — port near-verbatim into `src/home/cardDefs.ts` as a typed const:**
```javascript
export const cardDefs = {
  corpus: { span: 2, kind: 'CORPUS · PRIMARY', mark: 'live', title: 'Renaissance Papers', foot: '342 docs · 5 conflicts', bg: '#1E1F22', to: 'Library' },
  // ...33 entries total, static curated demo data (D-06/HOME-02: card content stays static this phase)
};
export const DEFAULT_SECTIONS = {
  pins: ['corpus', 'dissertation', /* ... */],
  fresh: [/* ... */], living: ['livingq'], archive: [/* ... */],
};
export const SECTION_ORDER = ['pins', 'fresh', 'living', 'archive'];
export const SECTION_LABELS = { pins: '◆ PINNED', fresh: 'FRESH', living: 'LIVING' };
```

**Core drag/drop reducer logic to port into `Home.tsx` (lines 283-308) — the exact `onDragOver`/`onDragEnd` shape the planner should preserve as a *pure*, separately-testable function per RESEARCH.md's Wave-0-gap note (Home.dnd.test.tsx):**
```javascript
const findSec = (id) => SECTION_ORDER.find(k => (cards[k] || []).includes(id));
const onDragOver = ({ active, over }) => {
  if (!over) return;
  const from = findSec(active.id);
  const to = SECTION_ORDER.includes(over.id) ? over.id : findSec(over.id);
  if (!from || !to || from === to) return;
  setCards(c => {
    const src = c[from].filter(x => x !== active.id);
    const dst = [...c[to]];
    const overIdx = dst.indexOf(over.id);
    dst.splice(overIdx >= 0 ? overIdx : dst.length, 0, active.id);
    return { ...c, [from]: src, [to]: dst };
  });
};
const onDragEnd = ({ active, over }) => {
  setActiveId(null);
  if (!over) return;
  const sec = findSec(active.id);
  if (!sec) return;
  const items = cards[sec];
  const oldIdx = items.indexOf(active.id), newIdx = items.indexOf(over.id);
  if (oldIdx >= 0 && newIdx >= 0 && oldIdx !== newIdx) {
    setCards(c => ({ ...c, [sec]: arrayMove(c[sec], oldIdx, newIdx) }));
  }
};
```

**`SortableCard` (lines 234-254) — port into `src/home/SortableCard.tsx`, the `useSortable` shape to preserve exactly:**
```javascript
function SortableCard({ id, sec, listView, onOpen }) {
  const t = cardDefs[id];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const body = CardBody({ t });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.25 : 1 };
  const extra = { ...attributes, ...listeners, onClick: () => { /* click-to-open, guarded against drag-then-click */ } };
  return h(CardFrame, { t, sec, listView, body, style, innerRef: setNodeRef, extra });
}
```

**`DndContext` wiring (lines 282, 323) — sensors + top-level context, port verbatim:**
```javascript
const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
// ...
<DndContext sensors={sensors} collisionDetection={closestCenter}
  onDragStart={({ active }) => setActiveId(active.id)} onDragOver={onDragOver} onDragEnd={onDragEnd}
  onDragCancel={() => setActiveId(null)}>
  {/* 4 sections, each a <SortableContext items={cards[sec]} strategy={rectSortingStrategy}> */}
  <DragOverlay>{activeId ? <OverlayCard id={activeId} sec={activeSec} listView={...} /> : null}</DragOverlay>
</DndContext>
```

---

### `src/home/homeCards.storage.ts` (utility/storage, file-I/O) — NEW

**Analogs (compose two existing patterns):**

1. `D:\Vibe Coding\Sourcerer\src\host\storage.ts` (55 lines, full file read) — the `host.storage` async get/set/remove contract, best-effort never-throw (WR-01):
```typescript
async get<T>(key: string, fallback: T): Promise<T> {
  let raw: unknown;
  try { raw = await store.get<unknown>(namespacedKey(appletKey, key)); }
  catch { return fallback; }
  if (raw === null || raw === undefined) return fallback;
  return raw as T;
},
async set(key: string, value: unknown): Promise<void> {
  try { await store.set(namespacedKey(appletKey, key), value); await store.save(); }
  catch { /* WR-01: best-effort, never-throws */ }
},
```
RESEARCH.md's own worked replacement for `home-cards.js`'s localStorage effect pair (Pattern 4):
```typescript
const [cards, setCards] = useState(DEFAULT_SECTIONS);
useEffect(() => {
  void host.storage.get<SectionMap>("home-cards-v1", DEFAULT_SECTIONS).then(setCards);
}, []);
useEffect(() => {
  void host.storage.set("home-cards-v1", cards); // best-effort, never throws (WR-01 contract)
}, [cards]);
```

2. `D:\Vibe Coding\Sourcerer\src\persistence\workspaceStore.ts` (lines 370-425, targeted read) — the debounce pattern to apply on top of the above so rapid `onDragOver` hover-frames don't fire a disk write per frame (RESEARCH.md Pitfall 3):
```typescript
const SAVE_DEBOUNCE_MS = 300;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
export function scheduleWorkspaceSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = undefined; void flushNow(); }, SAVE_DEBOUNCE_MS);
}
```
Apply the same `if (timer) clearTimeout(timer); timer = setTimeout(...)` shape to `homeCards.storage.ts`'s write path — debounce `host.storage.set()` calls (only the final `onDragEnd` state needs durability, per RESEARCH.md Pitfall 3), reusing the *pattern*, not this exact function (this file is shell-workspace-specific; Home's write path is applet/shell-scoped storage, a different underlying store).

**Home is a shell surface, not an applet** — do NOT import `makeAppletStorage`/`makeHost()` from `src/host/index.ts` unmodified as an applet would. Either add a dedicated shell-scoped storage helper analogous to `makeAppletStorage("home")`, or extend `src/host/storage.ts`'s factory to be reusable for shell surfaces — planner's call per RESEARCH.md Pitfall 1's guidance ("a dedicated shell-scoped storage helper").

---

### `src/store/shellStore.ts` (store, CRUD) — EDIT, extend existing slice template

**File:** `D:\Vibe Coding\Sourcerer\src\store\shellStore.ts` (172 lines, full file read)

The `railMode`/`railWidth` slice is the exact template to copy for `asstWidth`/`assistantOpen`/`homeOpen`/last-resolved-proposal. Key structural pieces to replicate:

**State shape + action co-location (lines 25-55):**
```typescript
export interface ShellState {
  // --- persisted ---
  railMode: RailMode;
  railWidth: number;
  // ADD: asstWidth: number; assistantOpen: boolean; (persisted, mirrors rail)

  // --- session-only (never persisted) ---
  railOpen: boolean;
  // ADD: homeOpen: boolean; (session-only, per D-04 — not part of workspace.json unless planner decides otherwise)
  // ADD: lastResolvedProposal / lastAssistantMessage (session-only shell-level surface for D-06, per RESEARCH.md Pitfall 2)

  // --- actions ---
  setRailMode(m: RailMode): void;
  setRailWidth(w: number): void;
  // ADD: setAsstWidth(w: number): void; setAssistantOpen(open: boolean): void; toggleHomeOpen(): void;
}
```

**Action pattern — mutate + persist together (lines 89-103):**
```typescript
setRailMode: (m) => {
  set({ railMode: m, railOpen: m !== "hidden" });
  scheduleWorkspaceSave();
},
setRailWidth: (w) => {
  set({ railWidth: w });
  scheduleWorkspaceSave();
},
```
Follow this exactly for `setAsstWidth`/`setAssistantOpen`: call `set({...})` then `scheduleWorkspaceSave()` if the value is meant to persist through `workspace.json` (asstWidth/assistantOpen — D-03 says "width persists via the shell store"). `homeOpen` and the D-06 proposal-surface fields are session-only (no `scheduleWorkspaceSave()` call), matching how `activePaneId`/`railApplet`/`badges` are session-only (lines 119-122, no persistence call).

**Synchronous seed + `hydrateFromDisk` pattern (lines 70-73, 147-165)** — if `asstWidth`/`assistantOpen` are added to `WorkspaceRecordV1.rail` (or a new top-level slice), they need the same two-phase lifecycle: a synchronous seed from `DEFAULT_WORKSPACE` valid before disk load, then an overwrite in `hydrateFromDisk()` once the async load resolves. This is a `src/persistence/workspaceStore.ts` schema change (`WorkspaceRecordV1` type + `DEFAULT_WORKSPACE` value) that the plan must account for alongside the `shellStore.ts` edit — check `WorkspaceRecordV1`'s shape before assuming a bare `shellStore.ts` edit suffices.

**React binding (lines 169-171) — reuse verbatim, no new export needed:**
```typescript
export function useShellStore<T>(selector: (state: ShellState) => T): T {
  return useStore(shellStore, selector);
}
```

---

## Shared Patterns

### Bespoke pointer-capture resize (rail + assistant)
**Source:** `src/shell/useRailDrag.ts` (full pattern above)
**Apply to:** `src/assistant/useAssistantResize.ts`
Key elements: `target.setPointerCapture(pointerId)` on `pointerdown` (never `window`-level mouse listeners), live snap state during drag for the visual cue, final snap recomputed on `pointerup` (not read from the last live value — protects against a fast flick under-sampling the move handler).

### Pure snap-threshold functions, independently unit-tested
**Source:** `src/shell/railSnap.ts` + `src/shell/railSnap.test.ts`
**Apply to:** `src/assistant/assistantSnap.ts` + `.test.ts`, `src/assistant/proposalParse.ts` + `.test.ts`
No React/DOM dependency; module-level constants documented against their design-token source; boundary-value test cases (`X-1`/`X` pairs at every threshold).

### `host.storage` best-effort, never-throw contract (WR-01)
**Source:** `src/host/storage.ts`
**Apply to:** `src/home/homeCards.storage.ts`
`get<T>(key, fallback)` swallows read errors and returns `fallback`; `set`/`remove` swallow write errors silently — callers (`void host.storage.set(...)`) never need a try/catch.

### Debounced persistence write
**Source:** `src/persistence/workspaceStore.ts` lines 370-425 (`scheduleWorkspaceSave`)
**Apply to:** `src/home/homeCards.storage.ts` (debounce `host.storage.set()` across rapid `onDragOver` frames, per Pitfall 3), and `shellStore.ts`'s new `asstWidth`/`assistantOpen` actions (reuse `scheduleWorkspaceSave()` itself if these fields join `WorkspaceRecordV1`, rather than inventing a second debounce timer).

### Shell-level cross-surface action (Home ↔ Assistant, D-06)
**Source:** `src/store/shellStore.ts`'s existing action co-location idiom (state + actions in one `createStore` call, consumed via `useShellStore(selector)` or `shellStore.getState().action()`)
**Apply to:** the new last-resolved-proposal/last-message field + `mintCardFromProposal`-style action — Home reads from `shellStore`, never imports from `src/assistant/*` directly; the assistant panel writes to `shellStore`, never imports from `src/home/*` directly (RESEARCH.md Pitfall 2 — avoid sideways coupling, route through the store).

### `host` naming disambiguation
**Source:** `src/host/ai.ts` (`export const host = { ai, setModes, loadSession }`) vs. `src/host/index.ts` (`makeHost(instanceId, appletKey): Host` — 5-member applet seam)
**Apply to:** every new file — Home and AssistantPanel are shell-level surfaces; import the *assistant* `host` from `src/host/ai.ts` for AI, and a dedicated shell-scoped storage path (not `makeHost()`) for Home's persistence. Verify the exact import in every task before writing code (RESEARCH.md Pitfall 1).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/assistant/sessionSeeds.ts` | config/data | transform | No prior "seeded/read-only demo transcript" data file exists in the codebase; nearest structural analog is `home-cards.js`'s `cardDefs` static-registry idiom (already cited above) but the *content* (canned conversation turns) has no precedent — author fresh from the handoff's dc.html seed transcripts ("Casey · human", etc.) per D-01. |

## Metadata

**Analog search scope:** `src/assistant/`, `src/shell/`, `src/store/`, `src/host/`, `src/persistence/`, `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/`
**Files scanned:** `AssistantPanel.tsx`, `AssistantPanel.test.tsx` (existence only), `host/ai.ts`, `host/index.ts`, `host/storage.ts`, `store/shellStore.ts`, `shell/railSnap.ts`, `shell/railSnap.test.ts`, `shell/useRailDrag.ts`, `shell/DiviChip.tsx`, `shell/LogoCluster.tsx`, `app/AppShell.tsx`, `persistence/workspaceStore.ts` (targeted range), `home-cards.js` (full, design handoff)
**Pattern extraction date:** 2026-07-14
