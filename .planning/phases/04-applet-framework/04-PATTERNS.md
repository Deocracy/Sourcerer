# Phase 4: Applet Framework - Pattern Map

**Mapped:** 2026-07-09
**Files analyzed:** 15 (new) + 5 (modified)
**Analogs found:** 15 / 15 (all files have a direct in-repo analog; zero "no analog" gaps)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/shell/registry.ts` (NEW) | config/registry | transform (key→module map) | `Design sync setup guide/design_handoff_sourcerer_tauri/reference/applets/registry.js` | exact (adapt: drop React-via-props) |
| `src/applets/_stub/TemplatedStub.tsx` (NEW) | component | request-response (render from appletDefs) | `src/shell/PanelBody.tsx` (`PanelBody` function) | exact |
| `src/applets/Wiki/Wiki.tsx` + subcomponents (NEW) | component | CRUD-ish (edit→dry-run→apply→undo) + store read | `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/wiki.js` | exact (port, adapt to imported React + host) |
| `src/applets/Library/Library.tsx` (NEW) | component | CRUD-ish (corpus/doc tree) + store read | `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/library.js` | exact (port) |
| `src/applets/<Key>.tsx` (~11 thin stub modules) (NEW) | component | request-response | `Design sync setup guide/.../_TemplateApplet.js` (manifest+App shape) + `TemplatedStub.tsx` (render body) | exact |
| `src/host/index.ts` (NEW) | service/factory | transform (assemble host object) | `src/host/ai.ts` (module-as-seam pattern: `export const host = {...}`) | role-match |
| `src/host/aiComplete.ts` (NEW) | service | streaming→Promise adapter | `src/host/ai.ts` (`ai()` Channel/event-listener function) | exact (compose over, don't replace) |
| `src/host/storage.ts` (NEW) | service/persistence | CRUD (get/set/remove) | `src/persistence/workspaceStore.ts` (`LazyStore` usage, best-effort try/catch) | exact |
| `src/host/instanceState.ts` (NEW) | service/persistence | CRUD (per-instance slot) | `src/persistence/workspaceStore.ts` (`instanceState` slot + `registerStateSources` seam) | role-match |
| `src/host/theme.ts` (NEW) | service/config | transform (CSS vars → object) | `src/styles/tokens.css` (source of truth to read) | partial (no code analog; token file only) |
| `src/host/open.ts` (NEW) | service | request-response (focus-or-open) | `src/shell/Dock.tsx` (`addAppletToDock`, `dockApiRef`) | exact |
| `src/shell/AppletCatalog.tsx` (NEW) | component | request-response (picker) | `src/shell/LayoutsMenu.tsx` (dropdown: open/close, click-outside, keyboard nav) | exact |
| `src/shell/PanelBody.tsx` (MODIFIED) | controller/dispatch | request-response | itself (extend `makeRenderer`) — pattern source: dockview `.d.ts` (`GroupPanelPartInitParameters`) | exact (self) |
| `src/shell/Dock.tsx` (MODIFIED) | controller | event-driven (dockview lifecycle) | itself (`createComponent`, "+" button, `addAppletToDock`) | exact (self) |
| `src/shell/Rail.tsx` (MODIFIED) | component | event-driven | itself (`openCatalog()` no-op stub → wire to `AppletCatalog`) | exact (self) |
| `src/store/shellStore.ts` (MODIFIED) | store | CRUD (state merge) | itself (`hydrateFromDisk`, `railOrder` handling) | exact (self) |
| `src/shell/appletDefs.ts` (MODIFIED/merged) | config | transform | itself (existing `AppletDef` map) | exact (self) |

## Pattern Assignments

### `src/shell/registry.ts` (config/registry, transform)

**Analog:** `Design sync setup guide/design_handoff_sourcerer_tauri/reference/applets/registry.js` (whole file, 17 lines) + `_TemplateApplet.js` (manifest/App shape)

**Registry pattern** (`registry.js` lines 1-16):
```javascript
// To add a REAL applet:
//   1. Copy _TemplateApplet.js → YourApplet.js and build it
//   2. Import it below and add it to the `applets` array
// Any applet NOT listed here keeps its demo stub in the shell.
import * as Notes from './Notes.js';
export const applets = [
  Notes,
];
```

**Manifest shape** (`_TemplateApplet.js` lines 6-16):
```javascript
export const manifest = {
  key: 'Template',
  glyph: '◌',
  code: 'TMPL',
  title: 'Template',
  desc: 'Starter applet. Copy me.',
};
```

**CLAUDE.md-mandated adaptation:** drop the `React.createElement`-via-props indirection — CLAUDE.md "What NOT to Use" explicitly calls this out: *"applets as ordinary `.tsx` modules that `import React` normally and are registered into a typed `registry.ts`."* Target shape (per 04-RESEARCH.md Pattern 1):
```typescript
import * as Wiki from "../applets/Wiki";
import * as Library from "../applets/Library";
// ...one import per applet key
export interface AppletManifest { key: string; glyph: string; code: string; title: string; desc: string; }
export interface AppletModule { manifest: AppletManifest; App: (props: { host: Host }) => JSX.Element; }
export const registry: Record<string, AppletModule> = { Wiki, Library, /* ... */ };
```
`appletDefs.ts` (glyph/title/line, 13 entries, `src/shell/appletDefs.ts` lines 18-84) is the existing source of truth Rail.tsx and PanelBody.tsx both already import — merge its `{glyph, title, line}` into each manifest's `{glyph, title, desc}` (line→desc) so there is exactly one place glyph/title/desc live (CONTEXT.md warns explicitly against rail/dock drift; RESEARCH.md "Don't Hand-Roll" table repeats this).

---

### `src/applets/_stub/TemplatedStub.tsx` (component, request-response)

**Analog:** `src/shell/PanelBody.tsx` lines 17-40 (the `PanelBody` function itself — this is the exact visual/structural pattern to lift into a per-applet-callable component)

**Core pattern** (lines 17-40):
```tsx
export function PanelBody({ appletKey }: PanelBodyProps) {
  const def = appletDefs[appletKey] ?? { glyph: "◌", title: appletKey, line: "" };
  return (
    <div className={styles.host}>
      <div className={styles.wrap}>
        <div className={styles.eyebrow}>APPLET · {def.title.toUpperCase()}</div>
        <div className={styles.header}>
          <div className={styles.glyphTile}>{def.glyph}</div>
          <div className={styles.title}>{def.title}</div>
        </div>
        <div className={styles.desc}>{def.line}</div>
        <div className={styles.noteBox}>...</div>
      </div>
    </div>
  );
}
```
**Adaptation for D-10/D-12/D-13:** `TemplatedStub` takes `{manifest, host}` (not just `appletKey`), replaces the static `noteBox` with per-applet demo rows (D-13, Claude's discretion — cheap where believable: Kanban cards, News feed items), and adds the D-12 "DEMO" mono chip/eyebrow. It remains an ordinary applet module (`manifest` + `App({host})`) per D-11 — it is called BY the ~11 thin per-key modules, not registered itself.

---

### `src/applets/Wiki/Wiki.tsx` (component, CRUD-ish + store read)

**Analog:** `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/wiki.js` (full file — rich demo, port faithfully per CONTEXT.md "the moat" instruction)

**Imports/color-object pattern** (lines 1-12):
```javascript
import React from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1';
import { store } from './store.js';
const h = React.createElement;
const T = { bg: '#0A0A0B', panel: '#131418', ..., accent: '#86A38C', amber: '#D8C69C', amberBg: '#1E1C17', warm: '#B8A06E', red: '#B05A4E' };
```
**Adaptation:** drop the ESM-CDN React import and `React.createElement`-via-props (CLAUDE.md) — `import React from "react"` normally, write JSX. Per Pitfall 4 (04-RESEARCH.md), `T.amber`/`T.amberBg`/`T.warm`/`T.red` have **no** counterpart in `src/styles/tokens.css` (which only defines `--color-danger`/`--color-accent` etc, see tokens.css lines 10-25) — UI-SPEC says "ported verbatim... do not re-theme," so keep these four as local hex constants scoped to `Wiki.tsx`/`Library.tsx`, not promoted to `tokens.css`.

**Store-read pattern to port** (`wiki.js` reads `store.js`'s vanilla zustand for selected entity/corpus — mirror via `useShellStore`/`shellStore` exactly as `Rail.tsx` already does):
```tsx
// Rail.tsx lines 35-40 — the established selector-subscription idiom to mirror:
const railApplet = useShellStore((s) => s.railApplet);
```
Wiki's own selection state (which article/entity is open) is new shell-store or component-local state — not shellStore's existing rail slice; follow the same `createStore`+`useStore` selector shape shown in `src/store/shellStore.ts` lines 14-15, 64 (`createStore<ShellState>()`, `useStore` binding) if a new dedicated store is added, or component `useState` if scoped to the Wiki module only (discretion, low risk either way).

**Trust-chip / provenance UI patterns** (`wiki.js` lines 56-70) — port verbatim as JSX, translating `h(...)` calls to JSX tags 1:1; no structural changes needed, only the element-creation syntax changes.

---

### `src/applets/Library/Library.tsx` (component, CRUD-ish + store read)

**Analog:** `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/library.js` (full file — same porting discipline as Wiki above: same `T` color object, same `store.js` read pattern, same React-via-props removal).

---

### `src/applets/<EachOtherKey>.tsx` (~11 thin modules) (component, request-response)

**Analog:** `_TemplateApplet.js` manifest shape (lines 6-16) + `TemplatedStub.tsx` (this phase's own new component, above)

**Pattern:**
```tsx
import { TemplatedStub } from "../_stub/TemplatedStub";
export const manifest = { key: "Kanban", glyph: "▥", code: "KANB", title: "Kanban", desc: "..." };
export function App({ host }: { host: Host }) {
  return <TemplatedStub manifest={manifest} host={host} rows={KANBAN_DEMO_ROWS} />;
}
```
Manifest `glyph`/`title`/`desc` values come straight from `src/shell/appletDefs.ts` lines 18-84 (already ported verbatim from the handoff per that file's own header comment) — do not re-invent; `code` field values are Claude's discretion (CONTEXT.md D-specifics) — take from the handoff's `_TemplateApplet.js` `code: 'TMPL'` convention (short 3-5 char mono crumb) where the handoff specifies one, else derive from the title.

---

### `src/host/index.ts` (service/factory, transform)

**Analog:** `src/host/ai.ts` line 145 — the "assemble a flat object of the module's public functions" idiom already used in this exact directory:
```typescript
export const host = { ai, setModes, loadSession };
```
**Adaptation:** `makeHost(instanceId: string)` is a factory (not a flat singleton export) since `storage`/`instanceId` are per-applet/per-instance:
```typescript
import { aiComplete } from "./aiComplete";
import { makeAppletStorage } from "./storage";
import { hostOpen } from "./open";
import { theme } from "./theme";

export function makeHost(instanceId: string, appletKey: string): Host {
  return {
    storage: makeAppletStorage(appletKey),
    ai: aiComplete,
    open: hostOpen,
    instanceId,
    theme,
  };
}
```

---

### `src/host/aiComplete.ts` (service, streaming→Promise adapter)

**Analog:** `src/host/ai.ts` lines 90-112 (`ai()` function) — compose over this, never re-implement `invoke("host_ai", ...)` (RESEARCH.md Anti-Pattern, explicit).

**Core pattern to compose over** (lines 90-112):
```typescript
export function ai(request: HostAiRequest, onEvent: AssistantEventListener): Promise<void> {
  return new Promise((resolve) => {
    const channel = new Channel<AssistantEvent>();
    channel.onmessage = (event) => {
      onEvent(event);
      if (event.type === "done") resolve();
    };
    invoke("host_ai", { message: request.message, sessionId: request.sessionId, modes: request.modes, onEvent: channel })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        onEvent({ type: "error", id: "invoke", message });
        onEvent({ type: "done", id: "invoke" });
        resolve();
      });
  });
}
```
**Error-handling pattern to mirror (D-06 honest-degrade):** `ai.ts` never throws — invoke-rejection is converted to an in-band `error`+`done` pair (lines 105-109). `aiComplete()`'s wrapper inverts this back into a rejecting Promise (per D-06 "errors reject the promise"):
```typescript
// wrapper composes over ai.ts's `ai()`, per D-03/D-04/D-05/D-06/D-07:
import { nanoid } from "nanoid";
import { ai as lowLevelAi, type AssistantEvent } from "./ai";

export function aiComplete(prompt: string, opts?: { onDelta?: (text: string) => void }): Promise<string> {
  return new Promise((resolve, reject) => {
    let text = "";
    let settled = false;
    const sessionId = `oneshot-${nanoid()}`; // D-04 throwaway session; strip trailing -/_ (RESEARCH A2)
    void lowLevelAi({ message: prompt, sessionId, modes: [] }, (event: AssistantEvent) => {
      if (event.type === "text_delta") { text += event.text; opts?.onDelta?.(text); }
      else if (event.type === "error" && !settled) { settled = true; reject(new Error(event.message)); }
      else if (event.type === "done" && !settled) { settled = true; resolve(text); }
    });
  });
}
```
Note the `nanoid` id-validity gotcha (RESEARCH.md Assumption A2): `sidecar/src/sessions.ts`'s pattern requires first+last char alnum; nanoid's default alphabet can end in `_`/`-`; either strip trailing non-alnum or append a fixed alnum suffix char.

---

### `src/host/storage.ts` (service/persistence, CRUD)

**Analog:** `src/persistence/workspaceStore.ts` — the `LazyStore` + best-effort try/catch pattern (lines 21, 84-91, 241-247)

**Imports pattern** (line 21):
```typescript
import { LazyStore } from "@tauri-apps/plugin-store";
```
**Core LazyStore-file pattern** (lines 84-85, adapt filename per D-15):
```typescript
const store = new LazyStore("workspace.json");
const WORKSPACE_KEY = "workspace";
```
For `applets.json` (D-15): `const store = new LazyStore("applets.json");` with per-call namespacing `sourcerer:<appletKey>:<key>` (D-15 literal).

**Best-effort try/catch pattern** (`loadWorkspaceRecord`, lines 193-207 excerpted):
```typescript
let raw: unknown;
try {
  raw = await store.get<unknown>(WORKSPACE_KEY);
} catch {
  // Read itself failed — fall back silently-safe to default.
  return DEFAULT_WORKSPACE;
}
if (raw == null) {
  return DEFAULT_WORKSPACE;
}
```
**Write pattern** (`saveWorkspaceRecord`, lines 241-247):
```typescript
export async function saveWorkspaceRecord(record: WorkspaceRecordV1): Promise<void> {
  inMemory = record;
  return enqueueWrite(async () => {
    await store.set(WORKSPACE_KEY, record);
    await store.save();
  });
}
```
`host/storage.ts`'s `get/set/remove` (D-16 Promise API) should mirror this try/catch-never-throws shape exactly (RESEARCH.md Pattern 5 gives the target shape almost verbatim already).

---

### `src/host/instanceState.ts` (service/persistence, CRUD)

**Analog:** `src/persistence/workspaceStore.ts`'s `instanceState` slot (`WorkspaceRecordV1.instanceState: Record<string, unknown>`, line 40) + the `registerStateSources`/`buildRecordFromSources` seam (lines 262-364) that already threads live getters into the persisted record without a circular import.

**Pattern to extend, not replace:** the record's `instanceState` field is read/written the same way `savedLayouts` already is (mutate-then-persist idiom, lines 309-318):
```typescript
export function setSavedLayouts(next: WorkspaceRecordV1["savedLayouts"]): void {
  inMemory = { ...inMemory, savedLayouts: next };
  savedLayoutsListeners.forEach((listener) => listener(next));
}
export function getSavedLayouts(): WorkspaceRecordV1["savedLayouts"] {
  return inMemory.savedLayouts;
}
```
`host/instanceState.ts` should add analogous `setInstanceState(instanceId, value)` / `getInstanceState(instanceId)` functions in `workspaceStore.ts` (or a thin wrapper module re-exporting from there), then have `PanelBody.tsx`'s `dispose()` call a cleanup (delete `instanceState[instanceId]`) per RESEARCH.md Pitfall 6 recommendation — same seam as the D-07 AI auto-cancel wiring.

---

### `src/host/theme.ts` (service/config, transform)

**Analog:** `src/styles/tokens.css` (source token file, not a code pattern) — lines 10-25, 52-54 for the color/font token set:
```css
--color-bg: #0a0a0b;
--color-fg: #e6e4de;
--color-accent: #86A38C;
--color-accent-hover: #A3BCA8;
--font-mono: "IBM Plex Mono", ui-monospace, monospace;
--font-sans: "IBM Plex Sans", system-ui, sans-serif;
--font-serif: "IBM Plex Serif", Georgia, serif;
```
No prior code module reads `tokens.css` programmatically — this is the one file in Phase 4 with **no existing code analog**, only a data-source analog (the CSS file itself). Implementation is Claude's discretion (CONTEXT.md): either a static object literal duplicating these values, or `getComputedStyle(document.documentElement).getPropertyValue(...)` passthrough. The handoff's own inline `T` object (`wiki.js` line 11) shows the expected consumer shape (`T.bg`, `T.accent`, `T.mono`, etc.) to match key-for-key.

---

### `src/host/open.ts` (service, request-response)

**Analog:** `src/shell/Dock.tsx` — `dockApiRef` (line 23) + `addAppletToDock` (lines 44-61) + the focus-tracking `onDidActivePanelChange` handler (lines 232-236)

**Core pattern** (lines 44-61):
```typescript
const dockApiRef: { current: DockviewApi | null } = { current: null };

export function addAppletToDock(key: string, position?: {...}): void {
  const api = dockApiRef.current;
  if (!api) return;
  const def = appletDefs[key];
  api.addPanel({ id: `${key}:${nanoid()}`, component: key, title: def?.title ?? key, ...(position ? { position } : {}) });
}
```
**D-17 focus-or-open extension** (RESEARCH.md Pattern 4, verified against `dockview-core` `.d.ts`):
```typescript
export function hostOpen(appletKey: string): void {
  const api = dockApiRef.current;
  if (!api) return;
  const existing = api.panels.find((p) => p.id.split(":")[0] === appletKey);
  if (existing) {
    api.setActivePanel(existing);
  } else {
    addAppletToDock(appletKey);
  }
}
```
Note: `dockApiRef` is currently module-private to `Dock.tsx` — `host/open.ts` needs it exported (or `Dock.tsx` needs to expose a `getDockApi()` accessor) since `host/` must not create a second dockview instance.

---

### `src/shell/AppletCatalog.tsx` (component, request-response picker)

**Analog:** `src/shell/LayoutsMenu.tsx` (full file, 211 lines) — the established dropdown-menu pattern in this exact codebase (open/close state, click-outside, keyboard nav, `useSyncExternalStore` binding).

**Open/close + click-outside pattern** (lines 17-50):
```tsx
const [open, setOpen] = useState(false);
const rootRef = useRef<HTMLDivElement | null>(null);
useEffect(() => {
  if (!open) return;
  function onDocMouseDown(e: MouseEvent) {
    if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
  }
  function onDocKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") setOpen(false);
  }
  document.addEventListener("mousedown", onDocMouseDown);
  document.addEventListener("keydown", onDocKeyDown);
  return () => {
    document.removeEventListener("mousedown", onDocMouseDown);
    document.removeEventListener("keydown", onDocKeyDown);
  };
}, [open]);
```
**Focus-into-panel pattern (WR-06, lines 61-63)** — required for the keyboard contract to be reachable at all:
```tsx
useEffect(() => {
  if (open && !saving) panelRef.current?.focus();
}, [open, saving]);
```
**ArrowUp/Down+Enter keyboard nav pattern** (lines 101-123) — mirror directly, swapping `rows` (saved layouts) for the registry's applet list and `handleApply` for `hostOpen(key)`/`addAppletToDock(key)`.

**Row-render pattern** (lines 143-176) — glyph+title+desc row instead of layout-name row; data source is the registry's manifests (glyph/title/desc), not `appletDefs` directly, to avoid a second drift point (D-18).

**Wiring points (both Pitfall 5 trigger affordances, per RESEARCH.md):**
- `Dock.tsx`'s "+" button (currently `el.onclick = () => addApplet(nextKey())`, lines 88-104, 147-161 key-cycling hack) → replace with catalog-open.
- `Rail.tsx`'s `openCatalog()` no-op (lines 18-21, `console.log("openCatalog: no-op stub...")`) → wire to the same `<AppletCatalog>` component/open-state (recommended: one shared picker, per RESEARCH.md Pitfall 5 recommendation).

---

### `src/shell/PanelBody.tsx` (MODIFIED — controller/dispatch)

**Analog:** itself, current `makeRenderer` (lines 55-72) + dockview's own `.d.ts` contract (`GroupPanelPartInitParameters`)

**Current shape to extend** (lines 55-72):
```typescript
export function makeRenderer(appletKey: string): DockContentRenderer {
  const element = document.createElement("div");
  element.style.height = "100%";
  let root: Root | null = createRoot(element);
  root.render(<PanelBody appletKey={appletKey} />);
  return {
    element,
    init: () => { /* no per-panel init needed for the generic placeholder body */ },
    dispose: () => { root?.unmount(); root = null; },
  };
}
```
**Target shape (RESEARCH.md Pattern 2, verified against `node_modules/dockview-core/dist/esm/dockview/types.d.ts`):** capture `parameters.api.id` at `init()` time (NOT at `createComponent()` time — the current `Dock.tsx` `createComponent` callback splits `opts.name || opts.id` at `:` and discards the nanoid suffix, line 85), render lazily inside `init`, dispatch through the new `registry` before falling back to the existing generic `<PanelBody appletKey={appletKey} />` (D-11, Phase 3 D-06 fallback preserved unconditionally).

---

### `src/shell/Dock.tsx` (MODIFIED — controller, event-driven)

**Analog:** itself — `createComponent` (lines 82-87), the "+" button handler (lines 88-104), `addAppletToDock` (lines 44-61)

**One-line load-bearing change required** (line 85):
```typescript
// current:
createComponent: (opts) => {
  const key = String(opts.name || opts.id).split(":")[0];
  return makeRenderer(key);
},
// must become: pass the FULL opts.id through so PanelBody.tsx's init() can
// read parameters.api.id === opts.id and derive host.instanceId (Pattern 2).
createComponent: (opts) => makeRenderer(opts.id, String(opts.name || opts.id).split(":")[0]),
```
**"+" button replacement target** (lines 88-104, 147-161 `nextKey()`/`keyCursor` cycling hack) → replace `el.onclick = () => addApplet(nextKey())` with opening `<AppletCatalog>` (D-18); delete the `orderedKeys`/`keyCursor`/`nextKey` cycling code entirely once the picker exists.

---

### `src/shell/Rail.tsx` (MODIFIED — component, event-driven)

**Analog:** itself, `openCatalog()` (lines 18-21)
```typescript
function openCatalog() {
  // eslint-disable-next-line no-console
  console.log("openCatalog: no-op stub in Phase 2 (Applet Catalog is Phase 4 scope)");
}
```
Wire this to the same shared `<AppletCatalog>` open-state Dock.tsx's "+" button now opens (Pitfall 5 — one component, two trigger points, per RESEARCH.md recommendation). `openSettings()` (lines 23-26) stays untouched — out of Phase 4 scope.

---

### `src/store/shellStore.ts` (MODIFIED — store, CRUD merge)

**Analog:** itself, `hydrateFromDisk` (lines 135-144) + `railOrder` array handling (lines 25, 67, 93, 119-129, 140)

**D-19 "new key appends to railOrder end" extension point** — the merge must happen where `railOrder` is set from disk (`hydrateFromDisk`, lines 135-144):
```typescript
export function hydrateFromDisk(record: WorkspaceRecordV1): void {
  const rail = record.rail;
  shellStore.setState({
    railMode: rail.railMode,
    railWidth: rail.railWidth,
    railOrder: rail.railOrder,       // <- D-19: append any registry key not
    leftRailPinned: rail.leftRailPinned,  //     present here, before setState
    railOpen: rail.railMode !== "hidden",
  });
}
```
Target: compute `const merged = [...rail.railOrder, ...registryKeys.filter(k => !rail.railOrder.includes(k))]` and pass `merged` as `railOrder` — deterministic append-at-bottom-of-main-group, never disturbs existing custom order (D-19 literal). Existing test file `src/store/shellStore.test.ts` already mocks `workspaceStore` (per 04-RESEARCH.md Validation Architecture) — extend it with the new append case rather than creating a new file.

## Shared Patterns

### Best-effort try/catch persistence (never crash on bad disk state)
**Source:** `src/persistence/workspaceStore.ts` lines 193-225 (full `loadWorkspaceRecord`), lines 241-247 (`saveWorkspaceRecord`)
**Apply to:** `src/host/storage.ts` (D-16), `src/host/instanceState.ts`
```typescript
try {
  raw = await store.get<unknown>(KEY);
} catch {
  return fallback; // best-effort — never throw
}
```

### Vanilla zustand store + selector-subscription binding
**Source:** `src/store/shellStore.ts` lines 14-15 (`createStore`/`useStore` import), `src/shell/Rail.tsx` lines 35-40 (`useShellStore((s) => s.railApplet)`)
**Apply to:** Wiki.tsx/Library.tsx reading shared selection/corpus state (mirrors handoff's `store.js` `railApplet`/`activeCorpus`/`selection` pattern, lines 20-25, 50-52 of `store.js`)

### Honest-degrade AI errors — exactly one error, never a hang
**Source:** `src/host/ai.ts` lines 90-112 (invoke-rejection converted to in-band `error`+`done`, never thrown)
**Apply to:** `src/host/aiComplete.ts` — D-06 requires this invert back into a single `reject()`, never a silent resolve or a second error.

### Module assembles a flat object of its own public functions as the "host surface"
**Source:** `src/host/ai.ts` line 145: `export const host = { ai, setModes, loadSession };`
**Apply to:** `src/host/index.ts`'s `makeHost()` factory — same "one seam module, flat object surface" idiom, adapted to a per-instance factory.

### Registry-driven single source of truth (no glyph/title/desc drift)
**Source:** `src/shell/appletDefs.ts` header comment (lines 1-11): "Both `Rail.tsx` ... and `Dock.tsx`/`PanelBody.tsx` ... import from this one source of truth so glyph/title/description never drift between the two surfaces."
**Apply to:** `registry.ts` manifests, `AppletCatalog.tsx` row data — extend the same discipline to a third consumer (the catalog picker) rather than re-deriving.

### Dropdown/picker UI shell (open/close, click-outside, keyboard nav, focus-into-panel)
**Source:** `src/shell/LayoutsMenu.tsx` full file (211 lines)
**Apply to:** `src/shell/AppletCatalog.tsx` — reuse structure wholesale per RESEARCH.md "Don't Hand-Roll" table (already tested via `LayoutsMenu.test.tsx`).

## No Analog Found

None — every file in Phase 4's scope has at least a partial or exact analog already in this repository or the design-handoff reference folders. The one file with a data-source-only analog (no prior *code* pattern) is:

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/host/theme.ts` | service/config | transform | No existing module reads `tokens.css` programmatically today — analog is the CSS token file itself (`src/styles/tokens.css`) plus the handoff's inline `T` object shape (`wiki.js` line 11) showing the expected consumer key names. Implementation mechanism is Claude's discretion per 04-CONTEXT.md. |

## Metadata

**Analog search scope:** `src/shell/`, `src/host/`, `src/persistence/`, `src/store/`, `src/styles/tokens.css`, `Design sync setup guide/design_handoff_sourcerer_tauri/reference/applets/`, `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/`
**Files scanned:** `PanelBody.tsx`, `Dock.tsx`, `Rail.tsx`, `appletDefs.ts`, `LayoutsMenu.tsx`, `src/host/ai.ts`, `src/persistence/workspaceStore.ts`, `src/store/shellStore.ts`, `tokens.css`, `registry.js`, `_TemplateApplet.js`, `store.js`, `wiki.js`
**Pattern extraction date:** 2026-07-09
