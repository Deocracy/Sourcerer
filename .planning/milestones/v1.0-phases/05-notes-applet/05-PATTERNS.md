# Phase 5: Notes Applet - Pattern Map

**Mapped:** 2026-07-12
**Files analyzed:** 7 (5 new, 2 modified)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/applets/Notes/index.tsx` | component (applet root: manifest + `App({host})`) | CRUD (notes) + request-response (AI summarize) | `src/applets/Library/index.tsx` | exact (role: applet module registered the same way; richer than templated stub, simpler than Library/Wiki's multi-view shape) |
| `src/applets/Notes/store.ts` | store (module-level shared state) | CRUD, event-driven (mirrors across tabs) | `src/store/shellStore.ts` | role-match (vanilla-zustand `createStore`/hydrate/persist shape; different persistence backend — `host.storage` vs `workspaceStore.ts`) |
| `src/applets/Notes/Notes.module.css` | config/style | — | `src/applets/Library/Library.module.css` + `src/shell/LayoutsMenu.module.css` | role-match (host container + DEMO-chip-omitted eyebrow from Library; row/active/delete-hover/nameInput from LayoutsMenu — UI-SPEC mandates mirroring both) |
| `src/applets/Notes/Notes.test.tsx` | test | request-response (mocked host) | `src/applets/Library/Library.test.tsx` | exact (identical `makeStubHost()` idiom, `render`/`screen`/`fireEvent`, mocked `host.ai`/`host.storage`) |
| `src/applets/Notes/relativeTime.ts` (or inline helper) | utility | transform | *(no direct analog — hand-written per RESEARCH.md "Don't Hand-Roll")* | no analog (small, self-contained; see Code Examples below) |
| `src/host/instanceState.ts` (MODIFY — add one re-export) | utility (thin re-export wrapper) | — | itself (extend existing pattern) | exact (one-line addition to an established re-export list) |
| `src/shell/registry.ts` (MODIFY — swap Notes entry) | config (registration map) | — | itself (Wiki/Library's existing override lines) | exact (literal copy of the two-line import + map-entry pattern already used twice) |

## Pattern Assignments

### `src/applets/Notes/index.tsx` (component, CRUD + request-response)

**Analog:** `src/applets/Library/index.tsx` (module shape) + `src/applets/_stub/TemplatedStub.tsx` (eyebrow format) + `src/host/aiComplete.ts` usage (summarize call, already excerpted in RESEARCH.md Code Examples)

**Imports pattern** (`src/applets/Library/index.tsx` lines 1-13):
```typescript
import React, { useEffect, useRef, useState } from "react";
import type { AppletManifest, AppletModule, Host } from "../../host/types";
import { appletDefs } from "../../shell/appletDefs";
import styles from "./Library.module.css";
```
Notes' `index.tsx` mirrors this exactly, replacing the demo-content imports with `./store` (module-level notes store) and `../../host/instanceState` (selected-note-id seam — see boundary note below).

**Boundary-safe import list** (only two non-relative-host imports are ever legal inside `src/applets/**`, per `src/applets/boundary.test.ts` lines 37-43):
```typescript
import { appletDefs } from "../../shell/appletDefs"; // the ONE sanctioned shell/** exception
// forbidden: anything matching /^(?:\.\.\/)+store\// or /^(?:\.\.\/)+shell\/(?!appletDefs$)/
```
`../../host/instanceState` is legal (it is under `src/host/**`, not `src/store/**`/`src/shell/**`) — RESEARCH.md Pattern 2 confirms this is the intended seam, imported directly (never through the `Host` object).

**Manifest + App export pattern** (`src/applets/Library/index.tsx` lines 871-881, exact structure to copy):
```typescript
const def = appletDefs.Library; // → appletDefs.Notes for this module
export const manifest: AppletManifest = {
  key: "Library", // → "Notes"
  glyph: def.glyph,
  code: def.code,
  title: def.title,
  desc: def.line,
};
export const App: AppletModule["App"] = ({ host }) => <Library host={host} />; // → <Notes host={host} />
```

**Eyebrow format — literal copy, omit the DEMO chip** (`src/applets/_stub/TemplatedStub.tsx` lines 28-33):
```tsx
<div className={styles.eyebrow}>
  APPLET · {manifest.title.toUpperCase()} · {manifest.code}
</div>
{/* Notes renders NO sibling .demoChip div — D-12 exception, "no DEMO chip renders" per UI-SPEC line 85 */}
```
UI-SPEC's copy "APPLET · NOTES · NOTE" is this exact template with `manifest.code === "NOTE"` (from `appletDefs.ts` line 99) — not new copy to invent (RESEARCH.md Pitfall 4).

**Component-local state precedent (no shell-store subscription)** (`src/applets/Library/index.tsx` lines 714-725, CR-01 discipline):
```typescript
function Library({ host }: { host: Host }) {
  const [view, setView] = useState<LibraryView>("dashboard");
  const [sel, setSel] = useState<string | null>("doc-ficino-vita");
  // CR-01: component-local selection — applets never subscribe to the shell
  // store; the `host` seam is the only shell surface.
```
Notes' selected-note-id follows the same discipline but is ALSO mirrored into `instanceState` (D-06) — local `useState` for render + `setInstanceState`/`scheduleWorkspaceSave` for persistence, per RESEARCH.md Pattern 2.

**Single-tracked-timer discipline (WR-05)** — reuse for both the delete two-step confirm and the summarize/toast-equivalent state (`src/applets/Library/index.tsx` lines 728-741):
```typescript
const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const flash = (m: string) => {
  if (toastTimer.current != null) clearTimeout(toastTimer.current);
  setToast(m);
  toastTimer.current = setTimeout(() => setToast(null), 2600);
};
useEffect(() => () => {
  if (toastTimer.current != null) clearTimeout(toastTimer.current);
}, []);
```
Directly reused (per RESEARCH.md Code Examples) for the 3s delete-confirm flip:
```tsx
const [confirming, setConfirming] = useState(false);
const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
function handleDeleteClick() {
  if (!confirming) {
    setConfirming(true);
    confirmTimer.current = setTimeout(() => setConfirming(false), 3000);
    return;
  }
  if (confirmTimer.current) clearTimeout(confirmTimer.current);
  setConfirming(false);
  deleteNote(selectedId); // D-02: select next note down, or empty state
}
useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); }, []);
```

**AI summarize pattern** (RESEARCH.md Code Examples, grounded in `src/host/aiComplete.ts` lines 49-91's Promise contract — single try/catch covers both the in-band `error` event and the 120s watchdog):
```tsx
async function handleSummarize(note: Note) {
  setSummarizing(true);
  setSummarizeError(false);
  try {
    const result = await host.ai(`Summarize this note in 1-2 sentences:\n\n${note.title}\n\n${note.body}`);
    setSummary(result);
  } catch {
    setSummarizeError(true); // "Couldn't summarize this note." / "Check your connection and try again."
  } finally {
    setSummarizing(false);
  }
}
// D-03 ephemeral: clear summary/summarizeError on note-selection change; unmount handles tab close.
```

**Selected-note-id restore/select pattern** (RESEARCH.md Pattern 2, grounded in `src/shell/Dock.tsx` lines 104-108's mutate-then-persist idiom):
```typescript
import { getInstanceState, setInstanceState, scheduleWorkspaceSave } from "../../host/instanceState";

const saved = getInstanceState(host.instanceId) as { selectedNoteId?: string } | undefined;
const initialSelectedId = saved?.selectedNoteId && notes.some((n) => n.id === saved.selectedNoteId)
  ? saved.selectedNoteId
  : (notes[0]?.id ?? null); // D-07: silent fallback, never an error

function selectNote(id: string | null) {
  setSelectedId(id);
  setInstanceState(host.instanceId, { selectedNoteId: id });
  scheduleWorkspaceSave();
}
```
Mirrors `src/shell/Dock.tsx` lines 104-108:
```typescript
deleteInstanceState(panel.id);
scheduleWorkspaceSave();
```
(mutate the in-memory slice, then flush — never mutate without the paired flush call).

---

### `src/applets/Notes/store.ts` (store, CRUD + event-driven mirror)

**Analog:** `src/store/shellStore.ts`

**Vanilla-store creation pattern** (`src/store/shellStore.ts` lines 14-15, 75-90):
```typescript
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
// ...
export const shellStore = createStore<ShellState>()((set, get) => ({
  railMode: seedRail.railMode,
  // ...actions calling set(...) then scheduleWorkspaceSave()
}));

export function useShellStore<T>(selector: (state: ShellState) => T): T {
  return useStore(shellStore, selector);
}
```
Notes' `store.ts` mirrors this shape exactly but persists through `host.storage` (per-instance-injected, not a module singleton import) rather than `workspaceStore.ts` — see RESEARCH.md Pattern 1's `ensureHydrated(storage)` / `notesStore` shape for the adapted version (module executes once because `registry.ts` statically imports Notes exactly once — same "module body runs once for the app's lifetime" guarantee `shellStore.ts` relies on).

**Debounced write-through pattern** (RESEARCH.md Pattern 3, same shape as `scheduleWorkspaceSave`'s debounce in `src/persistence/workspaceStore.ts` lines 419-424):
```typescript
export function scheduleWorkspaceSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void flushNow();
  }, 300);
}
```
Notes' own `scheduleNotesSave(storage, notes)` (RESEARCH.md Pattern 3) is the same clear-then-reschedule shape at 400ms, targeting `host.storage.set("notes", notes)` instead of `flushNow()` — a SEPARATE debounce timer, independent of `workspace.json`'s.

**Hydrate-once guard pattern** (RESEARCH.md Pattern 1 — no direct existing analog for the promise-memoization guard itself, but the "seed synchronously, hydrate async, never re-hydrate" discipline mirrors `shellStore.ts`'s `seedRail` + `hydrateFromDisk()` split at lines 70-73/151-165):
```typescript
const seedRail = DEFAULT_WORKSPACE.rail; // synchronous seed, valid before disk hydration
// ...
export function hydrateFromDisk(record: WorkspaceRecordV1): void { /* overwrites once, called once at boot */ }
```

---

### `src/applets/Notes/Notes.module.css` (style)

**Analog 1 — host container + eyebrow/no-chip:** `src/applets/Library/Library.module.css` (full file, 26 lines):
```css
.host {
  height: 100%;
}
/* DEMO chip lifted verbatim from TemplatedStub.module.css — Notes OMITS
 * rendering this class entirely (no sibling div), per D-12 exception. */
```

**Analog 2 — list row / active-row / delete hover-reveal / name-input:** `src/shell/LayoutsMenu.module.css` (full file, 164 lines) — UI-SPEC explicitly mandates mirroring this file's row treatment. Key excerpts:
```css
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--rail-row-h);
  padding: 0 var(--space-sm);
  border-left: 2px solid transparent;
  cursor: pointer;
}
.row:hover, .row.focused { background: var(--color-panel); }
.row.active { border-left-color: var(--color-accent); }
.row.active .label { color: var(--color-accent); font-weight: var(--fw-semibold); }

.delete {
  flex-shrink: 0;
  margin-left: var(--space-sm);
  border: none;
  background: transparent;
  color: var(--color-faint);
  visibility: hidden;
}
.row:hover .delete, .row.focused .delete { visibility: visible; }
.delete:hover { color: var(--color-danger); }

.nameInput {
  height: var(--rail-row-h);
  padding: 0 var(--space-sm);
  border: none;
  background: var(--color-panel-2);
  color: var(--color-fg);
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  outline: none;
}
```
Notes' list-row uses `.row`/`.row.active`/`.delete` classes near-verbatim (UI-SPEC's "selected row gets `2px solid var(--color-accent)` left border... mirrors `--rail-active-border` token literally"); the title/body inputs reuse `.nameInput`'s borderless/`--color-panel-2`-on-focus treatment (UI-SPEC line 83).

No new tokens/colors/sizes — every value must resolve to an existing `src/styles/tokens.css` custom property (UI-SPEC "Notes introduces zero new sizes/weights" / "zero new colors").

---

### `src/applets/Notes/Notes.test.tsx` (test, mocked-host component test)

**Analog:** `src/applets/Library/Library.test.tsx` (full file, 92 lines)

**`makeStubHost()` idiom to copy verbatim, adapting `ai`/`storage` per test case** (lines 15-41):
```typescript
function makeStubHost(): Host {
  return {
    storage: {
      get: async (_key, fallback) => fallback,
      set: async () => {},
      remove: async () => {},
    },
    ai: async () => "",
    open: vi.fn(),
    instanceId: "test-instance",
    theme: { /* ...full ThemeTokens literal, copy verbatim... */ },
  };
}
afterEach(cleanup);
```
For NOTE-01/NOTE-02 test cases, override `storage.get`/`storage.set`/`ai` per-test (e.g. `ai: async () => { throw new Error("boom"); }` for the summarize-error case) rather than using the fallback-only defaults — same override-per-test pattern already implicit in the stub shape.

**Render + assert pattern** (lines 45-52, 54-59):
```typescript
describe("Notes applet", () => {
  it("...", () => {
    const host = makeStubHost();
    render(<App host={host} />);
    expect(screen.getByText(/.../)).toBeTruthy();
  });
  it("calls host.X when Y is clicked", () => {
    const host = makeStubHost();
    render(<App host={host} />);
    fireEvent.click(screen.getByText(/.../));
    expect(host.someFn).toHaveBeenCalledWith(/* ... */);
  });
});
```
RESEARCH.md's Validation Architecture already maps NOTE-01/NOTE-02 test names (`-t "create"`, `-t "delete"`, `-t "summarize"`, `-t "summarize error"`) to this exact idiom.

---

### `src/host/instanceState.ts` (MODIFY — add `scheduleWorkspaceSave` re-export)

**Current file (full, 17 lines):**
```typescript
export {
  getInstanceState,
  setInstanceState,
  deleteInstanceState,
  listInstanceStateIds,
} from "../persistence/workspaceStore";
```

**Required one-line addition** (RESEARCH.md Pitfall 1 — this is an explicit, in-scope plan task, not scope creep; the header comment already reserves this module as "finalized by its first real consumer (Phase 5 Notes)"):
```typescript
export {
  getInstanceState,
  setInstanceState,
  deleteInstanceState,
  listInstanceStateIds,
  scheduleWorkspaceSave, // NEW — Notes' first real consumer of the mutate-then-persist idiom
} from "../persistence/workspaceStore";
```
Source contract this re-export exposes: `src/persistence/workspaceStore.ts` lines 419-424 (`scheduleWorkspaceSave`'s definition) and lines 336-338 ("Callers must call scheduleWorkspaceSave() after this to persist").

---

### `src/shell/registry.ts` (MODIFY — swap Notes stub for real module)

**Current file (full, 24 lines) — the exact two-line-per-applet pattern to replicate:**
```typescript
import { templatedModules } from "../applets/templated";
import * as WikiModule from "../applets/Wiki";
import * as LibraryModule from "../applets/Library";
import type { AppletManifest, AppletModule } from "../host/types";

export type { AppletManifest, AppletModule };

export const registry: Record<string, AppletModule> = {
  ...templatedModules,
  Wiki: WikiModule,
  Library: LibraryModule,
};
```

**Required change:**
```typescript
import * as NotesModule from "../applets/Notes"; // add import

export const registry: Record<string, AppletModule> = {
  ...templatedModules,
  Wiki: WikiModule,
  Library: LibraryModule,
  Notes: NotesModule, // add entry — this is FWK-02, the literal one-line registry swap
};
```
This is the ONLY file outside `src/applets/Notes/` (+ the `instanceState.ts` re-export) the phase touches — CONTEXT.md: "the shell, framework, and all other stubs are untouched."

---

## Shared Patterns

### Host-only seam / boundary enforcement
**Source:** `src/applets/boundary.test.ts` (full file, 63 lines)
**Apply to:** `src/applets/Notes/index.tsx`, `src/applets/Notes/store.ts` — every new source file under `src/applets/Notes/`
```typescript
const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  { name: "src/store/**", pattern: /^(?:\.\.\/)+store\// },
  { name: "src/shell/** (except appletDefs)", pattern: /^(?:\.\.\/)+shell\/(?!appletDefs$)/ },
];
```
Mechanically enforced, scans `src/applets/**` automatically (no new test file needed) — `npx vitest run src/applets/boundary.test.ts` must stay green after adding Notes. `../../host/instanceState` and `../../shell/appletDefs` are the two sanctioned non-`host` imports.

### `Host` — exactly five members, never a sixth
**Source:** `src/host/types.ts` lines 51-57, enforced by `src/host/index.test.ts`
```typescript
export interface Host {
  storage: AppletStorage;
  ai(prompt: string, opts?: { onDelta?: (text: string) => void }): Promise<string>;
  open(appletKey: string): void;
  instanceId: string;
  theme: ThemeTokens;
}
```
**Apply to:** Notes must never add `instanceState` (or anything else) to this interface or to `makeHost()`'s return object in `src/host/index.ts` — always import `src/host/instanceState.ts` directly (Pattern 2 above).

### Best-effort, never-throws storage contract (D-16)
**Source:** `src/host/storage.ts` lines 35-53
```typescript
async set(key: string, value: unknown): Promise<void> {
  try {
    await store.set(namespacedKey(appletKey, key), value);
    await store.save();
  } catch {
    // a failed IPC/disk write is dropped silently rather than surfacing
    // as an unhandled rejection
  }
},
```
**Apply to:** `src/applets/Notes/store.ts`'s `scheduleNotesSave` — `void storage.set("notes", notes)` never needs (and cannot usefully have) a `.catch()`. Per RESEARCH.md Pitfall 2/Open Question 1: do not build a fake "Not saved — retrying" state around a promise that never rejects; treat that UI-SPEC copy as unreachable/omitted unless the planner makes a conscious different call.

### Mutate-then-persist idiom for instanceState
**Source:** `src/shell/Dock.tsx` lines 104-108, `src/persistence/workspaceStore.ts` lines 336-357, 419-424
```typescript
setInstanceState(instanceId, value); // or deleteInstanceState(instanceId)
scheduleWorkspaceSave(); // MUST always be paired — mutate alone never persists
```
**Apply to:** `src/applets/Notes/index.tsx`'s note-selection handler exclusively (D-06 — selected note ID only).

### Applet eyebrow format
**Source:** `src/applets/_stub/TemplatedStub.tsx` lines 28-33
```tsx
APPLET · {manifest.title.toUpperCase()} · {manifest.code}
```
**Apply to:** `src/applets/Notes/index.tsx` header — literal reuse, D-12 exception means Notes omits the sibling `.demoChip` div only.

### Single-tracked-timer discipline (WR-05)
**Source:** `src/applets/Library/index.tsx` lines 728-741
**Apply to:** Notes' delete two-step confirm (3s flip) — clear-then-reset-timer on every trigger, clear on unmount.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/applets/Notes/relativeTime.ts` (or inline) | utility | transform | No existing hand-written relative-timestamp formatter in the codebase (`Wiki.tsx`'s history rows use hardcoded literal strings, not a computed function) — RESEARCH.md's Code Examples section already provides the ~10-line reference implementation to use directly; no in-repo analog to point to instead. |

## Metadata

**Analog search scope:** `src/applets/**` (Library, Wiki, TemplatedStub, boundary.test.ts), `src/host/**` (types, index, storage, aiComplete, instanceState), `src/store/shellStore.ts`, `src/shell/registry.ts`, `src/shell/appletDefs.ts`, `src/shell/LayoutsMenu.tsx`/`.module.css`, `src/shell/Dock.tsx`, `src/persistence/workspaceStore.ts`
**Files scanned:** 20
**Pattern extraction date:** 2026-07-12
