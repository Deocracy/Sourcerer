# Phase 5: Notes Applet - Research

**Researched:** 2026-07-12
**Domain:** React/TypeScript applet built against an already-shipped host seam (Tauri 2 + zustand
+ tauri-plugin-store), first real consumer of `host.storage`, `host.ai()`, and the reserved
per-instance-state seam.
**Confidence:** HIGH — every claim below is grounded in reading the actual Phase 2-4 source
(not training-data guesses); this is an in-repo integration phase, not new-library adoption.

## Summary

Phase 5 has almost no new-technology risk — no new npm packages, no new UI framework decisions,
no new persistence backend. Everything Notes needs (`host.storage`, `host.ai()`, the registry, the
`appletDefs` leaf, `LayoutsMenu.tsx`'s row/hover/delete CSS pattern, `Wiki`/`Library`'s
mocked-host test idiom) already exists and is directly readable in this repository. The real
work is **wiring three already-built seams together correctly** inside one new
`src/applets/Notes/` module, without violating the mechanically-enforced host-only import
boundary (`src/applets/boundary.test.ts`).

The single most important non-obvious finding: **the per-instance selected-note-id slot Notes
needs (D-06) is NOT reachable through the `host` prop.** `Host` is a mechanically-enforced
five-member type (`storage`, `ai`, `open`, `instanceId`, `theme` — a test asserts exactly these
five keys). Per-instance state lives in a *separate* module, `src/host/instanceState.ts`,
explicitly reserved and left unfinished pending "its first real consumer (Phase 5 Notes)."
Today that module only re-exports `getInstanceState`/`setInstanceState`/`deleteInstanceState`/
`listInstanceStateIds` — it is **missing a re-export of `scheduleWorkspaceSave`**, which every
other caller of `setInstanceState`/`deleteInstanceState` in the codebase (`Dock.tsx`) calls
immediately afterward (mutate-then-persist idiom). Without that re-export, Notes has no way to
actually flush the selected-note-id write to disk. This is a one-line addition the plan must
include as an explicit task, not something to discover mid-implementation.

The second notable finding: **`host.storage.set()` never rejects** (Phase 4 D-16, verified by
reading `src/host/storage.ts` — every failure path is caught and silently dropped). The UI-SPEC's
"Not saved — retrying" copy therefore has no real failure signal to key off of under the current
seam contract. Flagged as an Open Question below — the planner must decide how (or whether) to
implement that copy honestly.

**Primary recommendation:** Build Notes as a single `src/applets/Notes/` module (`index.tsx` +
a module-level `store.ts` using `zustand/vanilla`, mirroring `src/store/shellStore.ts`'s
`createStore`/`useStore` shape) that (1) hydrates once from `host.storage` on first mount behind
a module-level guard, (2) debounces writes back through `host.storage.set`, (3) reads/writes the
selected-note-id through `../../host/instanceState` directly (not through the `host` prop) after
adding the missing `scheduleWorkspaceSave` re-export, and (4) calls `host.ai(prompt)` directly for
Summarize (no streaming UI required by UI-SPEC). Register it in `src/shell/registry.ts` exactly
as `Wiki`/`Library` already are.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Note CRUD (create/edit/delete) | Browser/Client (React component + module-level zustand store) | Storage (tauri-plugin-store `applets.json` via `host.storage`) | Notes is a pure-frontend applet; the Rust side already exists (`tauri-plugin-store`) and needs zero new commands — `host.storage` is a JS-only wrapper over an existing plugin. |
| Multi-tab live mirror (D-04) | Browser/Client (shared module-level store) | — | Two Notes panels are two React roots inside the same renderer process/module graph — a JS module singleton, not IPC, is the correct and simplest mechanism (no Tauri event bus needed). |
| Selected-note-id per tab (D-06) | Browser/Client (`src/host/instanceState.ts` → `workspace.json` via `scheduleWorkspaceSave`) | — | Already-built Phase 3/4 seam; Notes is its first real consumer, not a new subsystem. |
| AI summarize (NOTE-02) | Browser/Client (`host.ai()` call) | Backend/Sidecar (Pi sidecar, already live per Phase 7) | The applet only calls `host.ai(prompt)`; all sidecar/session/IPC complexity is already absorbed by `src/host/aiComplete.ts` + `src/host/ai.ts` (Phase 4/7, shipped). Nothing new to build at this tier. |
| Registry wiring (FWK-02) | Browser/Client (`src/shell/registry.ts`, static import) | — | One-line addition to an existing static map; no dynamic loading. |

## Standard Stack

### Core
No new packages. Everything Notes needs is already installed and pinned:

| Library | Version (installed) | Purpose | Why Standard (already project-wide) |
|---------|---------|---------|--------------|
| `zustand` | 5.0.14 `[VERIFIED: package.json]` | Module-level shared Notes store (D-04) via `zustand/vanilla` + `useStore` | Exact pattern already used by `src/store/shellStore.ts`; zustand 5's React binding uses `useSyncExternalStore`, native in React 18 — no shim. |
| `nanoid` | ^5.1.16 `[VERIFIED: package.json]` | Note `id` generation | Already the project's id-generation library (`src/host/aiComplete.ts`'s session ids, `src/shell/dockApi`'s panel ids). Use plain `nanoid()` for note ids — the alnum-first/last-char stripping in `aiComplete.ts`'s `makeOneshotSessionId()` is a sidecar-specific constraint (`SESSION_ID_PATTERN`) that does **not** apply to note ids; do not copy that stripping logic for notes. |
| `react` | 18.2.0 `[VERIFIED: package.json]` | UI | Project-pinned, unrelated to this phase's decisions. |
| `@tauri-apps/plugin-store` | ^2.4.3 `[VERIFIED: package.json]` | Backing store for `host.storage` (`applets.json`) | Already wired in `src/host/storage.ts` — Notes never touches this package directly, only `host.storage`. |

### Supporting
None — no CSS-in-JS, no date library (relative-timestamp formatting is small enough to hand-write;
see Code Examples), no markdown renderer (UI-SPEC mandates a plain `<textarea>` in v1).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written relative-timestamp formatter | `date-fns`/`dayjs` | Unjustified new dependency for one function ("2m ago", "3d ago"); CLAUDE.md's whole-project discipline is minimal deps — do not add a package for this. |
| Module-level `zustand/vanilla` store for the shared notes cache | React Context + `useReducer` | Wouldn't survive being genuinely module-level across independently-mounted dockview panel React roots the way a module-scope `createStore()` call does (registry.ts statically imports the Notes module exactly once for the app's lifetime — verified below). Zustand vanilla is strictly the right shape here, matching the project's own established pattern. |

**Installation:** None required — no `npm install` step for this phase.

**Version verification:** All versions above read directly from `package.json` at the phase-5
research pass (2026-07-12) — no registry lookups were needed since nothing new is installed.

## Package Legitimacy Audit

**Not applicable.** Phase 5 installs zero new external packages. Every library used
(`zustand`, `nanoid`, `react`, `@tauri-apps/plugin-store`) is already installed, already used
elsewhere in this exact codebase, and was legitimacy-gated in Phases 2-4. No `slopcheck`/registry
verification step is required; the planner does not need a `checkpoint:human-verify` for
installs in this phase.

## Architecture Patterns

### System Architecture Diagram

```
 dockview panel "Notes:<nanoid>"
        │  (init() fires once per panel instance)
        ▼
 PanelBody.tsx makeRenderer()
        │  makeHost(instanceId, "Notes")  →  { storage, ai, open, instanceId, theme }
        ▼
 registry["Notes"].App({ host })            src/applets/Notes/index.tsx
        │
        ├─ on first mount only (module-level guard):
        │     host.storage.get<Note[]>("notes", [])
        │        └──▶ hydrates the MODULE-LEVEL zustand/vanilla store
        │             (src/applets/Notes/store.ts — one instance for the
        │             whole app process, shared by every open Notes tab)
        │
        ├─ every mount:
        │     useStore(notesStore, selector)          — live mirror (D-04)
        │     getInstanceState(host.instanceId)        — restore selected note id
        │        └──▶ src/host/instanceState.ts (NOT the `host` prop —
        │             a separate direct import; D-06/D-07)
        │
        ├─ user edits title/body:
        │     notesStore.setState(...)  (optimistic, instant, mirrors to
        │        every other open Notes tab via the shared store)
        │        └─(debounced ~400ms)─▶ host.storage.set("notes", notes[])
        │
        ├─ user selects a different note:
        │     setInstanceState(host.instanceId, { selectedNoteId })
        │        └─▶ scheduleWorkspaceSave()   ⚠ MUST be re-exported from
        │             src/host/instanceState.ts — currently missing, see
        │             Common Pitfalls #1
        │
        └─ user clicks Summarize:
              host.ai(prompt)  →  src/host/aiComplete.ts (Promise wrapper,
                 120s watchdog)  →  src/host/ai.ts (Channel/event client)
                 →  Tauri `invoke("host_ai", …)`  →  Rust relay (Phase 7,
                 already shipped)  →  Pi sidecar  →  real completion text
              resolves inline (D-03 ephemeral — not persisted)
              rejects → UI-SPEC honest-degrade error copy
```

A reader can trace NOTE-01 (create/edit/delete → survives relaunch) by following the middle
column (`host.storage`) and NOTE-02 (summarize) by following the bottom branch
(`host.ai()` → sidecar). Nothing in this diagram is new infrastructure — every arrow already
exists and is exercised by Wiki/Library (storage) or the Assistant panel (ai), except the two
⚠-marked additions.

### Recommended Project Structure
```
src/applets/Notes/
├── index.tsx           # manifest + App({host}) — the registered AppletModule
├── store.ts             # module-level zustand/vanilla store (D-04), hydrate/debounced-save
├── Notes.module.css      # CSS Modules keyed to tokens.css (two-pane layout, list row, editor)
└── Notes.test.tsx        # mocked-host component test, mirrors Wiki.test.tsx/Library.test.tsx
```
No subfolders needed — Notes is far smaller in scope than Wiki/Library (no multi-view tabs,
no modal flows), so a flat 3-4-file module matches its actual complexity rather than
over-structuring to match the richer demos.

### Pattern 1: Module-level shared store hydrated once, guarded against double-hydrate
**What:** A `zustand/vanilla` store created at module scope (executes exactly once — `registry.ts`
statically imports `* as NotesModule from "../applets/Notes"`, so the module body runs once for
the app's process lifetime, not once per dockview panel). The first `App({host})` invocation to
mount triggers an async hydrate from `host.storage`; every subsequent mount (a second Notes tab)
sees the already-hydrated store immediately, and both mirror every future write instantly by
construction (D-04's "no polling, no refresh-on-focus" requirement).
**When to use:** Exactly this phase's shared-notes-across-tabs requirement.
**Example (pattern, not copy-paste — adapt to your final `Note` shape):**
```typescript
// src/applets/Notes/store.ts
import { createStore } from "zustand/vanilla";
import type { AppletStorage } from "../../host/types";

export interface Note { id: string; title: string; body: string; createdAt: number; updatedAt: number; }
interface NotesState {
  notes: Note[];
  hydrated: boolean;
  setNotes(next: Note[]): void;
}

export const notesStore = createStore<NotesState>()((set) => ({
  notes: [],
  hydrated: false,
  setNotes: (next) => set({ notes: next }),
}));

let hydratePromise: Promise<void> | null = null;

/** Idempotent — safe to call from every mounting Notes instance; only the
 *  first caller's host.storage.get() actually runs (module-level guard). */
export function ensureHydrated(storage: AppletStorage): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = storage.get<Note[]>("notes", []).then((notes) => {
      notesStore.setState({ notes, hydrated: true });
    });
  }
  return hydratePromise;
}
```
Source: adapted directly from `src/store/shellStore.ts` lines 14-15 (`createStore`/`useStore`
import shape) and `src/store/shellStore.ts`'s `hydrateFromDisk()` precedent (seed-then-overwrite).

### Pattern 2: Per-instance selected-note-id via the reserved instanceState seam (NOT the `host` prop)
**What:** `src/host/instanceState.ts` is a thin re-export wrapper over
`src/persistence/workspaceStore.ts`'s instanceId-keyed slot in `workspace.json` — separate from
`host.storage` (which is a different file, `applets.json`, and a different persistence
*kind*: shared-across-instances data, not per-tab UI state). It is imported directly by module
path, never through the `Host` object (`Host` is fixed at five members, mechanically tested).
**When to use:** D-06's "selected note ID only" per-tab memory.
**Example (mirrors `Dock.tsx`'s existing mutate-then-persist call sites exactly):**
```typescript
// inside src/applets/Notes/index.tsx
import { getInstanceState, setInstanceState, scheduleWorkspaceSave } from "../../host/instanceState";
// ⚠ scheduleWorkspaceSave must be ADDED to that module's re-export list first — see Pitfall 1.

// restore on mount (D-07: silent fallback, never an error):
const saved = getInstanceState(host.instanceId) as { selectedNoteId?: string } | undefined;
const initialSelectedId = saved?.selectedNoteId && notes.some((n) => n.id === saved.selectedNoteId)
  ? saved.selectedNoteId
  : (notes[0]?.id ?? null);

// on selection change:
function selectNote(id: string | null) {
  setSelectedId(id);
  setInstanceState(host.instanceId, { selectedNoteId: id });
  scheduleWorkspaceSave();
}
```
Source: `src/shell/Dock.tsx` lines 104-108 (`deleteInstanceState(panel.id); scheduleWorkspaceSave();`)
is the exact mutate-then-persist idiom to mirror — confirmed by reading
`src/persistence/workspaceStore.ts` lines 336-343 ("Callers must call scheduleWorkspaceSave()
after this to persist").

### Pattern 3: Debounced write-through to `host.storage` (separate from the instanceState debounce)
**What:** `host.storage.set()` itself performs an immediate disk write + `store.save()` on every
call (`src/host/storage.ts` has no internal debounce) — calling it on every keystroke would be
excessive I/O. Notes needs its **own** debounce timer around calls to `host.storage.set("notes", …)`,
independent of `workspace.json`'s 300ms `scheduleWorkspaceSave` debounce (a different file,
different concern).
**When to use:** Auto-save on blur/debounced change (UI-SPEC, no explicit Save button).
**Example:**
```typescript
let saveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleNotesSave(storage: AppletStorage, notes: Note[]) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void storage.set("notes", notes); }, 400);
}
```
400ms is a reasonable default (UI-SPEC leaves the exact interval to discretion) — close to but
not required to match `workspace.json`'s 300ms constant; pick one value and use it consistently.
**On blur:** flush immediately (`clearTimeout(saveTimer); void storage.set("notes", notes);`) so
navigating away from a note doesn't lose the trailing debounce window — matches "auto-save on
blur/debounced" in UI-SPEC literally.

### Anti-Patterns to Avoid
- **Adding a sixth member to `Host`:** `src/host/index.test.ts` asserts `Object.keys(host).sort()`
  equals exactly `["ai", "instanceId", "open", "storage", "theme"]`. Do not add `instanceState` to
  the `Host` interface or the `makeHost()` return object — import `src/host/instanceState.ts`
  directly instead (Pattern 2).
- **Importing `shellStore` or any `src/store/**`/`src/shell/**` module (except `appletDefs`) from
  inside `src/applets/Notes/`:** mechanically fails `src/applets/boundary.test.ts`. This is exactly
  the mistake Phase 4's code review caught in Library (CR-01, since fixed) — do not repeat it.
- **Re-hydrating on every mount:** a second Notes tab calling `host.storage.get(...)` again on
  mount (instead of reading the already-hydrated module store) risks clobbering concurrent edits
  from the first tab with stale disk data. Use the guarded `ensureHydrated()` shape (Pattern 1).
- **Copying `aiComplete.ts`'s session-id alnum-stripping logic for note ids:** that stripping
  exists solely to satisfy the sidecar's `SESSION_ID_PATTERN`; plain `nanoid()` is correct for
  note ids, which are never sent to the sidecar.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistence backend for notes | A custom file/IPC layer | `host.storage` (already built, Phase 4 D-14/D-15/D-16) | Exactly what it's for; reinventing it violates the phase's own boundary. |
| AI completion / sidecar protocol | Direct `invoke("host_ai", …)` calls, or a second event-parsing layer | `host.ai(prompt)` (→ `aiComplete.ts`) | `04-RESEARCH.md`'s explicit anti-pattern: "this module NEVER calls invoke("host_ai") directly." One module (`src/host/`) absorbs sidecar protocol drift — applets never do. |
| Relative timestamp formatting | A date library | A ~10-line hand-written function (see Code Examples) | The full set of buckets UI-SPEC/copy needs ("just now", "2m ago", "3d ago") is small; a dependency is disproportionate. |
| Two-step delete confirm | A modal dialog / confirm library | `LayoutsMenu.module.css`'s `.delete` hover-reveal + a local 3s timer swapping button label | UI-SPEC explicitly mandates mirroring this exact pattern; "no modals anywhere in this shell" is a standing constraint. |
| Multi-tab state sync | A Tauri event/broadcast channel between windows/panels | A module-level `zustand/vanilla` store | Both Notes panels run in the same renderer process/module graph — no IPC needed; simpler and already the project's precedent (`shellStore.ts`). |

**Key insight:** every "don't hand-roll" item in this phase already has a finished, in-repo
implementation from Phases 2-4. The risk in Phase 5 is architectural miswiring (using the wrong
seam, e.g. `host.storage` for per-tab state or a direct `host` member for instanceState), not
missing infrastructure.

## Common Pitfalls

### Pitfall 1: `src/host/instanceState.ts` is missing the `scheduleWorkspaceSave` re-export Notes needs
**What goes wrong:** Notes calls `setInstanceState(host.instanceId, {...})` to remember the
selected note, but nothing flushes it to disk — `setInstanceState`/`deleteInstanceState` only
mutate an in-memory slice (confirmed by reading `src/persistence/workspaceStore.ts` lines
336-343: "Callers must call scheduleWorkspaceSave() after this to persist"). Every existing
caller (`Dock.tsx`) imports `scheduleWorkspaceSave` from `../persistence/workspaceStore` directly
— but that's a shell-owned relative path Notes should not reach into (it would work mechanically,
since `boundary.test.ts` only forbids `store/**` and `shell/**`, not `persistence/**`, but it
breaks the "one place under src/host/" convention the module's own header comment establishes).
**Why it happens:** `src/host/instanceState.ts` was deliberately left partial in Phase 4 — its
header comment says outright: "wired here only for the dispose GC... finalized by its first real
consumer (Phase 5 Notes)." Phase 4 never needed to call `scheduleWorkspaceSave` from an applet
context, so it never added the re-export.
**How to avoid:** Add one line to `src/host/instanceState.ts`'s export list:
`scheduleWorkspaceSave` from `../persistence/workspaceStore`. This is a small, in-scope framework
touch even though CONTEXT.md says "the shell, framework, and all other stubs are untouched" —
it is completing a seam Phase 4 explicitly reserved for Notes, not scope creep. Include it as an
explicit plan task so it isn't missed or mistakenly worked around with a direct `persistence/`
import from inside `src/applets/Notes/`.
**Warning signs:** Selected note reverts to the first note (or empty state) after every relaunch,
even though D-07's "silent fallback" makes this look like *correct* behavior at first glance —
it will pass casual manual testing while being wrong. Verify explicitly: select note B, quit,
relaunch, confirm note B (not note A) is still selected.

### Pitfall 2: `host.storage.set()` never rejects — the UI-SPEC's "Not saved — retrying" copy has no real trigger
**What goes wrong:** UI-SPEC says: "if a write demonstrably fails, show inline 'Not saved —
retrying' next to the toolbar timestamp." But `src/host/storage.ts`'s `set()` catches every
failure internally and always resolves (Phase 4 D-16's "best-effort, never-throws" contract,
enforced by comment: "a failed IPC/disk write is dropped silently rather than surfacing as an
unhandled rejection"). There is no promise rejection, no error object, nothing for Notes to
`catch()` and key the "Not saved — retrying" state off of.
**Why it happens:** D-16 was written for `host.storage` in general (any applet, any failure mode)
before Notes existed as a concrete consumer; the UI-SPEC was written assuming a failure signal
that the underlying seam doesn't actually provide.
**How to avoid:** This is a genuine open question for the planner/executor, not a research-time
fixable pitfall — see Open Questions below. Do not implement a fake/always-succeeds "retry" UI;
either treat the copy as unreachable/defensive-only (acceptable, matches "best-effort" honestly)
or extend `host.storage` itself to surface failures (out of this phase's stated scope — "the
shell, framework... are untouched").
**Warning signs:** A code reviewer asking "how would this ever render?" and getting no good
answer — that's the signal this was implemented as dead code rather than a real state.

### Pitfall 3: Concurrent double-hydrate race when two Notes tabs restore simultaneously
**What goes wrong:** On app launch, dockview's `fromJSON` restore can recreate multiple saved
Notes panels in the same tick. If each panel's `App({host})` independently calls
`host.storage.get("notes", [])` and unconditionally `setState`s the shared store, the *second*
resolved read (not necessarily the most recent write) can stomp the first — though since both
reads return the same on-disk data at boot, this is lower-risk than it sounds, but becomes real
once any edit races the hydrate.
**Why it happens:** Without a hydrate guard (Pattern 1), "module-level store" only prevents
diverging state *after* hydrate — it does not by itself deduplicate concurrent hydrate calls.
**How to avoid:** The `ensureHydrated()` promise-memoization shape in Pattern 1 — every mount
awaits the *same* in-flight promise rather than issuing a second `host.storage.get()`.
**Warning signs:** Flaky test failures or occasional "note reverted" reports specifically when
multiple Notes tabs were open at last relaunch.

### Pitfall 4: Forgetting the `AppletManifest.code` eyebrow format is already established
**What goes wrong:** Reinventing the "APPLET · NOTES" eyebrow layout instead of reusing the exact
`APPLET · {TITLE} · {CODE}` format already shipped in `TemplatedStub.tsx` (`manifest.code` =
`"NOTE"` per `appletDefs.ts`), which is precisely what UI-SPEC's copy "APPLET · NOTES · NOTE"
specifies — UI-SPEC is describing the *existing* stub eyebrow format, minus the DEMO chip, not a
new format.
**Why it happens:** Easy to miss that UI-SPEC's copy is a literal match for existing code rather
than new copy to invent.
**How to avoid:** Read `src/applets/_stub/TemplatedStub.tsx` lines 28-33 before writing Notes'
header; reuse the string template `APPLET · ${manifest.title.toUpperCase()} · ${manifest.code}`
and simply omit the sibling `.demoChip` div (D-12 exception, "no DEMO chip renders" for Notes).
**Warning signs:** A UI review diffing Notes' eyebrow against Wiki/Library/stub eyebrows and
finding a different mono/letter-spacing treatment.

## Code Examples

### Relative timestamp formatter (Don't Hand-Roll table — no date library)
```typescript
// src/applets/Notes/relativeTime.ts (or inline helper in index.tsx)
export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const min = 60_000, hr = 3_600_000, day = 86_400_000;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  return `${Math.floor(diff / day)}d ago`;
}
```
Matches the mono/faint relative-timestamp treatment already used elsewhere (`Wiki.tsx`'s history
tab rows: `"just now"`, `"2h ago"`, `"yesterday"`, `"3d ago"` literals) — same vocabulary, now
computed rather than hardcoded demo data.

### Two-step delete confirm (mirrors `LayoutsMenu.module.css` `.delete` hover-reveal, per UI-SPEC)
```tsx
// inside the Notes editor toolbar
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
Source pattern: `src/applets/Wiki/index.tsx`'s WR-05 "single tracked toast timer" comment (lines
480-492) — same clear-then-reset-timer discipline, applied to a confirm-flip instead of a toast.

### Summarize call (D-03 ephemeral, honest-degrade error per UI-SPEC)
```tsx
const [summary, setSummary] = useState<string | null>(null);
const [summarizing, setSummarizing] = useState(false);
const [summarizeError, setSummarizeError] = useState(false);

async function handleSummarize(note: Note) {
  setSummarizing(true);
  setSummarizeError(false);
  try {
    const result = await host.ai(`Summarize this note in 1-2 sentences:\n\n${note.title}\n\n${note.body}`);
    setSummary(result);
  } catch {
    setSummarizeError(true); // UI-SPEC: "Couldn't summarize this note." / "Check your connection and try again."
  } finally {
    setSummarizing(false);
  }
}
// Switching notes / closing the tab must clear `summary` (D-03: ephemeral, never persisted) —
// e.g. reset summary/summarizeError in the note-selection handler and rely on unmount for tab close.
```
Source: `src/host/aiComplete.ts` — `host.ai()` already rejects with a plain `Error(message)` on
both an in-band `error` event and the 120s inactivity watchdog, so a single `try/catch` covers
every failure mode without needing to distinguish them (matches "exactly one error, never a hang").

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| ROADMAP's "stub response in v1" for NOTE-02 | Real Pi sidecar completion via `host.ai()` | Phase 4 D-01 (2026-07-09), superseding the original roadmap wording | Notes' Summarize is a genuine AI call from day one — no throwaway stub to later replace; must handle real latency/errors, not a synchronous fake. |

**Deprecated/outdated:** None specific to this phase — Phase 5 consumes Phase 4's finished
contract as-is (04-CONTEXT.md: "the module signature finalized before any real applet exists").

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 400ms is a reasonable debounce interval for note auto-save | Pattern 3 | Low — CONTEXT.md explicitly leaves this to discretion; any value in the 300-800ms range is defensible and easily tunable later. |
| A2 | A single `host.storage` key (`"notes"`) holding a `Note[]` array is the right storage shape at Notes' expected data volume | Standard Stack / code_context (CONTEXT.md's own discretion note) | Low — CONTEXT.md itself calls this "the expected lazy default at this data volume"; per-note keys would only matter at a scale (hundreds+ of notes) far beyond v1's "quick capture" framing. |
| A3 | The Summarize prompt template shown in Code Examples is adequate | Code Examples | Low — CONTEXT.md explicitly delegates "Summarize prompt text" to discretion; any reasonable instruction-plus-content prompt satisfies NOTE-02 ("invoke AI summarize... and receive a real response"). |

**If this table is empty:** N/A — three low-risk discretionary assumptions are logged above, all
already explicitly delegated to Claude's judgment by 05-CONTEXT.md; none require user
confirmation before planning proceeds.

## Open Questions

1. **How should the UI-SPEC's "Not saved — retrying" storage-failure copy be handled, given `host.storage.set()` never rejects?**
   - What we know: Phase 4 D-16 makes `host.storage` best-effort and never-throwing by design
     (verified by reading `src/host/storage.ts` — every catch block swallows and returns/resolves
     silently). UI-SPEC's copy assumes a detectable failure state.
   - What's unclear: Whether the planner should (a) omit the "Not saved — retrying" state entirely
     since it can never legitimately fire under the current contract, or (b) treat it as
     unreachable defensive UI that's still worth rendering the markup for (in case `host.storage`
     is ever extended to surface failures in a later phase).
   - Recommendation: Option (a) — do not build a dead-code UI state. If the planner wants to keep
     the copy literally available for a future host.storage extension, that's a reasonable
     alternative, but should be a conscious plan decision, not an oversight either way.

2. **Should `handleSummarize` stream partial text via `host.ai`'s `onDelta` callback, or wait for the full Promise?**
   - What we know: UI-SPEC only specifies a "Summarizing…" disabled-button state while in-flight
     and a final inline serif-italic block on completion — no mention of live-updating text.
     `host.ai(prompt, { onDelta? })` supports both modes.
   - What's unclear: Whether a streaming render (nicer UX, mirrors the Assistant panel) is worth
     the extra state management for what UI-SPEC describes as a simple two-state (loading/done)
     interaction.
   - Recommendation: Skip `onDelta` for v1 — await the Promise directly (Code Examples above).
     Matches UI-SPEC literally and is less code. Purely additive to wire in `onDelta` later if
     wanted.

## Environment Availability

Skipped — Phase 5 has no external tool/service/runtime dependencies beyond what Phases 1-4/7
already established as working (Tauri dev loop, the Pi sidecar). No new environment probes are
needed; if the sidecar isn't running, `host.ai()`'s existing 120s watchdog/error path already
handles that gracefully (Phase 7, shipped) and Notes' `try/catch` (Code Examples) surfaces it via
the UI-SPEC's honest-degrade copy.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.10 + `@testing-library/react` ^16.3.2 `[VERIFIED: package.json]` |
| Config file | `D:\Vibe Coding\Sourcerer\vitest.config.ts` (jsdom environment, `globals: true`, `include: ["src/**/*.test.{ts,tsx}"]`) |
| Quick run command | `npx vitest run src/applets/Notes` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTE-01 | Create/edit/delete notes persist via `host.storage`, survive relaunch (D-01/D-02) | unit/component | `npx vitest run src/applets/Notes/Notes.test.tsx -t "create"` | ❌ Wave 0 |
| NOTE-01 | Delete selects next-down note or empty state (D-02) | unit/component | `npx vitest run src/applets/Notes/Notes.test.tsx -t "delete"` | ❌ Wave 0 |
| NOTE-02 | Summarize calls `host.ai()` and renders the result inline, ephemeral (D-03) | unit/component | `npx vitest run src/applets/Notes/Notes.test.tsx -t "summarize"` | ❌ Wave 0 |
| NOTE-02 | Summarize error renders honest-degrade copy (D-06 inherited from Phase 4) | unit/component | `npx vitest run src/applets/Notes/Notes.test.tsx -t "summarize error"` | ❌ Wave 0 |
| — (boundary invariant, not a numbered requirement but a hard phase constraint) | Notes never imports `src/store/**`/`src/shell/**` except `appletDefs` | static/mechanical | `npx vitest run src/applets/boundary.test.ts` | ✅ (already exists, scans `src/applets/**` automatically — no new test file needed, Notes is covered by the existing scan) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/applets/Notes`
- **Per wave merge:** `npx vitest run` (full suite — also re-runs `boundary.test.ts` against the
  new Notes files)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/applets/Notes/Notes.test.tsx` — new file, covers NOTE-01/NOTE-02, mirrors
  `src/applets/Library/Library.test.tsx`'s `makeStubHost()` idiom (a plain object shaped like
  `Host`, `ai: async () => "..."` stubbed per test case to simulate success/error/timeout).
- [ ] `src/host/instanceState.ts` — needs the `scheduleWorkspaceSave` re-export added (Pitfall 1)
  before any test exercising D-06 persistence can pass meaningfully.
- No new fixtures/conftest-equivalent needed — Vitest + Testing Library's existing `render`/
  `screen`/`fireEvent`/`cleanup` idiom (already used by `Wiki.test.tsx`/`Library.test.tsx`) covers
  everything Notes needs.

## Security Domain

Skipped — `.planning/config.json` sets `workflow.security_enforcement: false` explicitly.

## Sources

### Primary (HIGH confidence — direct repository reads, this session)
- `D:\Vibe Coding\Sourcerer\src\host\types.ts` — `Host`/`AppletModule`/`AppletManifest` exact
  shapes, the "exactly five members, do not add a sixth" constraint.
- `D:\Vibe Coding\Sourcerer\src\host\index.ts` + `src\host\index.test.ts` — `makeHost()` factory
  and its mechanical five-key assertion test.
- `D:\Vibe Coding\Sourcerer\src\host\storage.ts` — `host.storage` never-throws contract (D-16),
  the basis for Pitfall 2.
- `D:\Vibe Coding\Sourcerer\src\host\aiComplete.ts` — Promise+onDelta wrapper, 120s watchdog,
  error-rejection contract (D-06).
- `D:\Vibe Coding\Sourcerer\src\host\instanceState.ts` — the incomplete re-export module at the
  center of Pitfall 1.
- `D:\Vibe Coding\Sourcerer\src\persistence\workspaceStore.ts` (lines ~328-425) —
  `setInstanceState`/`getInstanceState`/`deleteInstanceState`/`listInstanceStateIds`/
  `scheduleWorkspaceSave` definitions and the "callers must call scheduleWorkspaceSave() after
  this" contract comment.
- `D:\Vibe Coding\Sourcerer\src\shell\Dock.tsx` — the live mutate-then-persist call sites
  (`deleteInstanceState` + `scheduleWorkspaceSave` paired calls) Notes' pattern mirrors.
- `D:\Vibe Coding\Sourcerer\src\shell\PanelBody.tsx` — `makeRenderer`/dispose lifecycle, CR-02
  GC-timing caveat confirmed in code (comment block at dispose()).
- `D:\Vibe Coding\Sourcerer\src\applets\boundary.test.ts` — the exact forbidden-import regexes
  (`store/**`, `shell/**` except `appletDefs`) that gate every applet file, including Notes.
- `D:\Vibe Coding\Sourcerer\src\applets\Wiki\index.tsx`, `src\applets\Library\index.tsx`,
  `Library.test.tsx` — component-local state precedent, mocked-host test idiom, `T` color-object
  pattern, WR-05 single-tracked-timer pattern.
- `D:\Vibe Coding\Sourcerer\src\applets\_stub\TemplatedStub.tsx` — the exact eyebrow format
  (`APPLET · {TITLE} · {CODE}`) UI-SPEC's copy matches (Pitfall 4).
- `D:\Vibe Coding\Sourcerer\src\shell\LayoutsMenu.tsx` + `.module.css` — the row/active/delete
  hover-reveal pattern UI-SPEC explicitly mandates mirroring.
- `D:\Vibe Coding\Sourcerer\src\store\shellStore.ts` — the vanilla-zustand `createStore`/`useStore`
  pattern Notes' shared store (D-04) mirrors.
- `D:\Vibe Coding\Sourcerer\src\styles\tokens.css` — full token set confirming UI-SPEC's token
  references are accurate (colors, spacing, type scale, `--rail-row-h`).
- `D:\Vibe Coding\Sourcerer\vitest.config.ts` + `package.json` — test framework/versions,
  confirming no new dependency is needed.
- `.planning/phases/04-applet-framework/04-CONTEXT.md`, `04-PATTERNS.md`, `04-REVIEW.md` — D-01
  through D-19 decisions, the CR-01/CR-02 review findings, and the file-by-file pattern map this
  research extends into Phase 5.
- `.planning/phases/05-notes-applet/05-CONTEXT.md`, `05-UI-SPEC.md` — user decisions D-01
  through D-07, the locked design contract.
- `.planning/config.json` — `nyquist_validation: true`, `security_enforcement: false`.

### Secondary / Tertiary
None used — this phase required no WebSearch/Context7 lookups; every claim is grounded directly
in the repository's own source and prior phase documentation (an integration phase, not a
new-technology-adoption phase).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all versions read directly from `package.json`.
- Architecture: HIGH — every pattern verified by reading the actual implementing source files
  (not inferred from documentation or memory).
- Pitfalls: HIGH — Pitfall 1 and 2 are structural gaps found by tracing the actual code paths
  (`instanceState.ts`'s incomplete export list; `storage.ts`'s never-throws catch blocks), not
  speculative risks.

**Research date:** 2026-07-12
**Valid until:** Effectively indefinite for this phase's scope (no external/version-drift risk
since nothing new is installed) — re-verify only if Phase 4's host contract changes before Phase
5 executes.
