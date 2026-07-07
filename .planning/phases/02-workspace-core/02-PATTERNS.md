# Phase 2: Workspace Core - Pattern Map

**Mapped:** 2026-07-07
**Files analyzed:** 13
**Analogs found:** 11 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/styles/tokens.css` (MODIFY) | config | transform | `src/styles/tokens.css` (self, Phase 1) | exact — edit in place |
| `src/app/AppShell.tsx` (MODIFY) | component | request-response | `src/app/AppShell.tsx` (self, Phase 1) | exact — edit in place |
| `src/app/AppShell.module.css` (MODIFY) | config | transform | `src/app/AppShell.module.css` (self) | exact |
| `src/shell/TitleBar.tsx` (MODIFY) | component | request-response | `src/shell/TitleBar.tsx` (self, Phase 1) + `LogoCluster.tsx` | exact |
| `src/shell/TitleBar.module.css` (MODIFY) | config | transform | `src/shell/TitleBar.module.css` (self) | exact |
| `src/shell/DiviChip.tsx` (NEW) | component | request-response | `src/shell/LogoCluster.tsx` (click-stub button pattern) | role-match |
| `src/shell/RailToggleButtons.tsx` (NEW) | component | request-response | `src/shell/WindowControls.tsx` (icon-button cluster, aria-label, Tauri-guarded click) | role-match |
| `src-tauri/tauri.conf.json` (MODIFY) | config | transform | self (Phase 1, `decorations:false`) | exact — add `transparent:true` |
| `src/store/shellStore.ts` (NEW) | store | event-driven | `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/store.js` (porting reference, not in-repo) | role-match (design-handoff reference; no in-repo Zustand store exists yet) |
| `src/shell/Rail.tsx` (NEW) | component | event-driven | `src/shell/useMaximizedState.ts` (Tauri/native-event → React state bridging idiom) + `.dc.html` `startRailResize`/rail render (reference) | partial — no in-repo rail exists |
| `src/shell/Rail.module.css` (NEW) | config | transform | `src/shell/TitleBar.module.css` (CSS Modules + token-var convention) | role-match |
| `src/shell/Dock.tsx` (NEW) | component | event-driven | `.dc.html` `initDock`/`makeRenderer`/`dockRef` (reference); no in-repo analog | no analog — new integration surface |
| `src/shell/Dock.module.css` (NEW) | config | transform | UI-SPEC "Dock Theme Tokens" block (`.sourcerer-dock` → `--dv-*`) | no in-repo analog — spec-authored |
| `src/shell/PanelBody.tsx` (NEW, generic placeholder body / dispatcher) | component | request-response | `.dc.html` `panelBody(key)` (reference) | no in-repo analog |
| `src/shell/TitleBar.test.tsx` (MODIFY) | test | request-response | `src/shell/TitleBar.test.tsx` (self, Phase 1 RED-spec convention) + `WindowControls.test.tsx` | exact |

## Pattern Assignments

### `src/styles/tokens.css` (config, transform — MODIFY)

**Analog:** self (`src/styles/tokens.css`, authored Phase 1 D-01)

**Current shape** (lines 8-66): a single `:root` block grouped by comment headers (`/* ---- Color ---- */`, `/* ---- Chrome metrics ---- */`, `/* ---- Spacing scale (4pt) ---- */`, `/* ---- Type: ... ---- */`). Phase 1 values to change/add per UI-SPEC "Chrome Rework" table:
```css
--titlebar-h: 34px;             /* -> 40px */
--color-fg: #e6e4de;            /* was accent role -> becomes plain text color, add --color-accent: #86A38C separately */
```

**Core pattern — additive edit, don't restructure:** keep the existing comment-header grouping convention and append new groups (`/* ---- Window (floating chrome) ---- */`, `/* ---- Rail ---- */`, `/* ---- Tab bar ---- */`) rather than reflowing the file. UI-SPEC section "Chrome Rework" (lines 56-90 of `02-UI-SPEC.md`) gives the exact new/changed custom-property block to insert verbatim — copy those literal values, do not re-derive.

**Naming convention to follow:** `--color-*`, `--space-*`, `--fs-*`, `--fw-*`, `--lh-*`, `--ls-*` prefixes already established; extend with `--window-*`, `--rail-*`, `--tab-bar-h` exactly as UI-SPEC names them so Rail/Dock components can reference tokens by the same prefix family.

---

### `src/app/AppShell.tsx` + `.module.css` (component, request-response — MODIFY)

**Analog:** self (Phase 1)

**Current pattern** (`AppShell.tsx` lines 1-16):
```tsx
import { TitleBar } from "../shell/TitleBar";
import styles from "./AppShell.module.css";

export function AppShell() {
  return (
    <div className={styles.shell}>
      <TitleBar />
      <div className={styles.body} />
    </div>
  );
}
```
**Core pattern to extend:** keep the same "grid shell, dumb container, no state" shape (per Phase 1 comment "No logic, no state") — but Phase 2 now DOES need state (Zustand `railMode`) to size the grid columns, so this file graduates from stateless to a thin store-reader. Replace the placeholder `<div className={styles.body} />` with `<Rail /><Dock />` siblings inside a `styles.body` grid row that is itself `[rail-width | 1fr]` columns. Grid metrics belong in `AppShell.module.css` using CSS custom properties (`grid-template-rows: var(--titlebar-h) 1fr`) exactly as Phase 1 already does — do not inline styles.

**Floating window wrapper (D-03):** the 20px-inset/10px-radius card is a NEW outer wrapper — likely `#root` styling in `tokens.css`/`index.html` plus an `App.tsx` (`src/App.tsx`, not read in full here but is the Vite entry mounting `AppShell`) wrapping div. Confirm exact mount point in `src/App.tsx` before adding — Phase 1's `AppShell` assumed edge-to-edge frameless, this phase's floating card needs a backdrop element OUTSIDE the current `.shell` grid.

---

### `src/shell/TitleBar.tsx` + `.module.css` (component, request-response — MODIFY)

**Analog:** self (Phase 1) + `LogoCluster.tsx` for the click-stub-button idiom

**Current pattern** (`TitleBar.tsx` lines 1-20): flat `LogoCluster -> drag-spacer -> WindowControls` row; the spacer is explicitly documented as "absorbs future space until Phases 2/3/6 add them" — this phase fills that spacer with the DIVI chip + corpus label + rail-toggle buttons, but **must preserve exactly one `data-tauri-drag-region` element** (verified by `TitleBar.test.tsx` line 26-41 — that test will need a new assertion for the *shrunk* spacer, not removal of the drag region).

**CSS convention** (`TitleBar.module.css` lines 1-21): flex row, `height: var(--titlebar-h)`, token-driven border/background, `.spacer { flex: 1 1 auto; }`. New chip/buttons go as additional flex children between `LogoCluster` and the (now narrower) spacer, spacer stays before `WindowControls`.

**DIVI chip click-stub pattern to copy** (`LogoCluster.tsx` lines 10-13): a no-op console-stub handler, matching Phase 2 scope note ("DIVI chip renders this phase but toggles nothing yet"):
```tsx
function openHome() {
  // eslint-disable-next-line no-console
  console.log("openHome: no-op stub in Phase 1 (no workspace to toggle yet)");
}
```
Reuse this exact shape for the DIVI chip's click handler (console-stub, not wired to the Home overlay — that's Phase 6).

---

### `src/shell/DiviChip.tsx` (component, request-response — NEW)

**Analog:** `src/shell/LogoCluster.tsx` (role-match: small clickable title-bar cluster reading a styles module, no props, no state)

**Imports pattern** (LogoCluster.tsx line 1):
```tsx
import styles from "./DiviChip.module.css";
```
**Core pattern:** functional component, CSS-module class toggling active/inactive state (UI-SPEC: "active = accent border + rgba(134,163,140,0.14) bg + accent text; inactive = #26272B border + muted text"). Read active state from the new Zustand store's `railApplet`/Home-toggle field (store not yet wired to Home overlay this phase — chip renders active/inactive purely from a store boolean, no real toggle logic, matching D-03 "chrome-only stub").

---

### `src/shell/RailToggleButtons.tsx` (component, request-response — NEW)

**Analog:** `src/shell/WindowControls.tsx` (role-match: cluster of icon buttons, each wired to an imperative action, aria-labeled, degrades safely outside a live context)

**Imports + guarded-call pattern** (`WindowControls.tsx` lines 1-15):
```tsx
function withWindow(fn: (appWindow: ReturnType<typeof getCurrentWindow>) => Promise<void>) {
  try {
    fn(getCurrentWindow()).catch(console.error);
  } catch (err) {
    console.error(err);
  }
}
```
**Core pattern to adapt:** two SVG rail-toggle buttons (16x12, "fill to show rail state" per UI-SPEC), each `<button type="button" aria-label="..." onClick={...}>`. Since RailToggleButtons drives the Zustand store (not the Tauri window API), replace `withWindow` with a direct `store.getState().cycleRailMode()` call — no try/catch guard needed (Zustand calls don't throw the way un-mocked Tauri IPC does), but keep the aria-label + button-per-action convention from `WindowControls.tsx` lines 27-54.

---

### `src-tauri/tauri.conf.json` (config, transform — MODIFY)

**Analog:** self

**Current relevant block:**
```json
"windows": [
  {
    "label": "main",
    "title": "Sourcerer",
    "width": 1024,
    "height": 768,
    "decorations": false,
    "shadow": false
  }
]
```
**Change:** add `"transparent": true` alongside existing `"decorations": false, "shadow": false"` — this is the D-03 prerequisite for the floating rounded window's OS-level radial backdrop. Per CONTEXT.md D-03, this must land as its OWN commit paired with a re-verify of Phase 1's DPI (100/125/150%) + title-bar drag behavior, since transparent/decoration changes can regress both.

---

### `src/store/shellStore.ts` (store, event-driven — NEW)

**Analog:** `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/store.js` (design-handoff porting reference — explicitly named in CONTEXT.md canonical_refs as "the Zustand shape porting reference"; not an in-repo file, but the closest and only concrete pattern to copy from since this is Zustand's first use in the codebase)

**Full reference shape** (store.js lines 1-77) — port directly, swapping the CDN import for the locked package:
```js
import { createStore } from 'https://esm.sh/zustand@4.5.5/vanilla';
// -> import { createStore } from 'zustand/vanilla';

const LS = 'sourcerer-shell-store-v1';
function load() {
  try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; }
}
const saved = load();

export const store = createStore((set, get) => ({
  railMode: saved.railMode || 'expanded',
  setRailMode: (m) => { set({ railMode: m, railOpen: m !== 'hidden' }); persist(get); },
  cycleRailMode: () => {
    const next = { expanded: 'compact', compact: 'hidden', hidden: 'expanded' }[get().railMode] || 'expanded';
    set({ railMode: next, railOpen: next !== 'hidden' });
    persist(get);
  },
  // ... railOrder, leftRailPinned, activeCorpus, selection, reviewCount per UI-SPEC's store fields
}));

function persist(get) {
  const s = get();
  try {
    localStorage.setItem(LS, JSON.stringify({ /* subset of fields */ }));
  } catch (e) {}
}

export function subscribe(selector, cb) {
  let prev = selector(store.getState());
  return store.subscribe((state) => {
    const next = selector(state);
    if (next !== prev) { prev = next; cb(next); }
  });
}
```
**Adaptations for Phase 2 scope (CONTEXT.md D-02):** keep `railMode`/`railOrder`/`leftRailPinned` and their `persist()` calls (near-free per D-02), but do NOT port `corpora`/full persistence-contract fields that belong to Phase 3 (PERS-01..04) — `activeCorpus` may stay as a simple default-0 store slice per the UI-SPEC's Home overlay note. Type the store with TypeScript (the reference is untyped JS) — define a `ShellState` interface with `railMode: 'expanded' | 'compact' | 'hidden'`.

**React binding note:** since this is `zustand/vanilla` (works outside React per the reference's own comment), pair it with `zustand/react`'s `useStore(store, selector)` hook for component consumption, or `create` from `zustand` re-exporting the vanilla store — confirm against zustand 5.0.14's docs at implementation time (not covered by the JS reference, which predates the React binding split).

---

### `src/shell/Rail.tsx` + `.module.css` (component, event-driven — NEW)

**Analog:** no in-repo component analog exists (Phase 1 shipped no rail). Closest **in-repo** pattern for "native/imperative event -> React state" bridging is `src/shell/useMaximizedState.ts` (lines 13-54): a custom hook that subscribes to an external event source in `useEffect`, updates local state, and cleans up on unmount — reuse this shape for a `useRailDrag`/resize hook rather than managing `pointermove` listeners inline in the component body.

**Reference algorithm to port** (`.dc.html` lines 345, 443-465 — pointer-drag resize with snap thresholds):
```js
HIDDEN_W = 6; COMPACT_W = 56; COMPACT_AT = 132; CLOSE_AT = 44;

startRailResize = (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  const navRect = this.navEl.getBoundingClientRect();
  const move = (ev) => {
    const raw = Math.max(0, Math.min(520, ev.clientX - navRect.left));
    const w = raw < CLOSE_AT ? HIDDEN_W : raw < COMPACT_AT ? COMPACT_W : raw;
    this.setState({ liveW: w });
    this.relayout();
  };
  const up = (ev) => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up, true);
    const w = Math.max(HIDDEN_W, Math.min(520, ev.clientX - navRect.left));
    const mode = w < CLOSE_AT ? 'hidden' : w < COMPACT_AT ? 'compact' : 'expanded';
    this.setState({ liveW: null, railWidth: mode === 'expanded' ? w : this.state.railWidth, railMode: mode });
    store.getState().setRailMode(mode);
    requestAnimationFrame(this.relayout);
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up, true);
};
```
**Port to React idiom:** replace `window.addEventListener('mousemove'/'mouseup')` with `pointerdown` + `element.setPointerCapture(pointerId)` + `pointermove`/`pointerup` on the captured element (per CLAUDE.md's locked "bespoke pointer events" pattern — `setPointerCapture`, not raw window mouse listeners, is the project's explicit choice over the prototype's exact mouse-event approach). Use the token values `--rail-close-at: 44px`, `--rail-compact-at: 132px` etc. from `tokens.css` rather than hardcoding the JS constants — read them via `getComputedStyle` once or duplicate as TS constants matching the CSS values 1:1.

**Rail-item drag-out to dock (D-01, highest-risk item):** reference reorder-splice logic at `.dc.html` lines 823-833 (within-rail reorder via `arrayMove` splice semantics) — port directly for `railOrder` reordering. The drag-OUT-to-dock branch (ghost + 28%-zone overlay + `api.addPanel({position:{referenceGroup,direction}})`) has no direct prototype excerpt captured here beyond the reorder mechanics; CONTEXT.md D-01 flags this as the phase's own high-risk slice — plan it separately with dockview's group `getBoundingClientRect()` for zone math, with a fallback that resolves an ambiguous drop to a new tab.

**CSS Module convention:** follow `TitleBar.module.css`'s flat-property, token-var style (no nesting, one selector per rule, comment header describing the component).

---

### `src/shell/Dock.tsx` + `.module.css` (component, event-driven — NEW)

**Analog:** no in-repo analog (dockview-core not yet installed). Reference: `.dc.html` `initDock()` (lines 604-652), `dockRef` (594-603), `makeRenderer` (839-853), `syncOpen` (654-663), `addApplet` (665-672).

**Core mount + restore-with-canary pattern to port** (lines 604-652):
```js
initDock() {
  const opts = { createComponent: (o) => this.makeRenderer(o) };
  this.api = this.dv.createDockview(this.dockEl, opts);

  const CANARY = this.LAYOUT_KEY + ':canary';
  let restored = false;
  try {
    if (localStorage.getItem(CANARY)) { localStorage.removeItem(this.LAYOUT_KEY); }
    localStorage.setItem(CANARY, '1');
    const saved = JSON.parse(localStorage.getItem(this.LAYOUT_KEY));
    if (saved) { this.api.fromJSON(saved); restored = true; }
  } catch (e) {
    restored = false;
    try { this.api.clear(); } catch (e2) {}
    try { localStorage.removeItem(this.LAYOUT_KEY); } catch (e2) {}
  }
  setTimeout(() => { try { localStorage.removeItem(CANARY); } catch (e) {} }, 4000);
  if (!restored || this.api.panels.length === 0) {
    try { this.api.clear(); } catch (e) {}
    this.addApplet('Wiki');
    this.addApplet('Library');
  }

  this.api.onDidLayoutChange(() => {
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => {
      try { localStorage.setItem(this.LAYOUT_KEY, JSON.stringify(this.api.toJSON())); } catch (e) {}
    }, 300);
  });
  this.api.onDidActivePanelChange(() => this.syncOpen());
}
```
This maps directly to DOCK-03 (empty/fallback + canary + 300ms debounce) — copy the canary + try/catch + Wiki/Library-default logic verbatim, wrap in a `useEffect` with cleanup calling `this.dock.dispose()` (mirrored from `.dc.html` `componentWillUnmount` line 406: `if (this.dock) { try { this.dock.dispose(); } catch (e) {} }`).

**Panel-id / multi-instance pattern** (line 670, DOCK-04): `this.api.addPanel({ id: key + ':' + Date.now(), component: key, title: def.title });` — port using `nanoid` instead of `Date.now()` per CLAUDE.md's locked choice: `id: \`${key}:${nanoid()}\``.

**Focus pattern (DOCK-05)** (lines 654-663): `onDidActivePanelChange` -> derive `activeKey` from `String(active.id).split(':')[0]` -> push into the shell store via `store.getState().setRailApplet(activeKey)`. This is the exact "consume dockview's event as sole source of truth" pattern CONTEXT.md requires — copy the split-on-`:`-prefix id-parsing idiom.

**Theme class convention:** `dockview-theme-abyss sourcerer-dock` (UI-SPEC line 296) applied as the container's className; the `--dv-*` variable overrides go in `Dock.module.css` as `.sourcerer-dock { --dv-group-view-background-color: #0A0A0B; ... }` — copy the full 19-variable block from UI-SPEC "Dock Theme Tokens" verbatim (lines 272-294 of `02-UI-SPEC.md`), do not re-derive values.

---

### `src/shell/PanelBody.tsx` (component, request-response — NEW, generic placeholder + dispatcher)

**Analog:** `.dc.html` `makeRenderer` (839-853) + `panelBody(key)` (874-897) — the dispatcher-to-generic-body pattern.

**Dispatcher pattern to port** (lines 839-847):
```js
makeRenderer(opts) {
  const key = String(opts.name || opts.id).split(':')[0];
  const el = (key === 'Home') ? this.homeBody()
    : (key === 'Wiki') ? this.moduleBody('./wiki.js', 'mountWiki')
    : (key === 'Library') ? this.moduleBody('./library.js', 'mountLibrary')
    : (key === 'Settings') ? this.moduleBody('./settings.js', 'mountSettings')
    : this.panelBody(key);
  return { element: el, init: (params) => { ... }, dispose: () => { ... } };
}
```
Phase 2 only needs the `else -> generic placeholder` branch (per UI-SPEC's Panel body dispatch note: "Phase 2 only needs the dispatcher and the generic placeholder body"). Port `panelBody(key)`'s content structure (glyph + title + description + dashed note box, lines 874-897) as a proper React component reading from an applet-defs map (`defs` object, lines 347-364) — copy the `defs` shape (`{ glyph, title, line }` per applet key) as a typed TS const, and the "APPLET · {TITLE}" mono label + glyph tile + serif title + dashed `border: 1px dashed` note box as CSS-module styles rather than inline `style.cssText` strings (React project has no reason to inline styles the way the vanilla-JS prototype does).

---

### `src/shell/TitleBar.test.tsx` (test, request-response — MODIFY)

**Analog:** self (Phase 1) + `WindowControls.test.tsx`

**Convention** (`TitleBar.test.tsx` lines 1-42): Vitest + Testing Library, one `describe` block per component, RED-spec framing in comments ("This suite MUST fail... until plan X builds the component"), `afterEach(cleanup)`. The existing "exactly one `data-tauri-drag-region`" assertion (lines 26-41) needs updating: the spacer shrinks but must still exist and still be the sole drag region once the DIVI chip + rail-toggle buttons are inserted — extend the test, don't replace its intent.

---

## Shared Patterns

### Tauri-guarded imperative calls
**Source:** `src/shell/WindowControls.tsx` lines 9-15 (`withWindow` helper)
**Apply to:** any new component calling `getCurrentWindow()` (none identified beyond existing WindowControls this phase, but the pattern applies if rail-toggle buttons ever need window-level Tauri calls, not just store calls)

### Native-event-to-React-state bridging
**Source:** `src/shell/useMaximizedState.ts` (full file) — subscribe in `useEffect`, guard with try/catch for non-Tauri contexts, clean up listeners on unmount, return primitive state
**Apply to:** `Rail.tsx`'s resize-drag hook, any Dock lifecycle hook wrapping dockview's imperative API in `useEffect`

### CSS Modules + tokens.css
**Source:** `src/shell/TitleBar.module.css` (full file) — flat declarations, `var(--token-name)` everywhere, no magic numbers, comment header naming the component and its fixed metrics
**Apply to:** `DiviChip.module.css`, `RailToggleButtons.module.css`, `Rail.module.css`, `Dock.module.css`, `PanelBody.module.css`

### Zustand vanilla store + persist-on-change
**Source:** `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/store.js` (full file, 77 lines)
**Apply to:** `src/store/shellStore.ts` — the `createStore` + `load()`/`persist()` localStorage round-trip + `subscribe(selector, cb)` convenience wrapper pattern applies wholesale, scoped down per D-02 (railMode/railOrder/leftRailPinned only, not full Phase-3 persistence contract)

### Panel-id scheme (DOCK-04)
**Source:** `.dc.html` line 670 (`id: key + ':' + Date.now()`), CLAUDE.md's locked nanoid choice
**Apply to:** `Dock.tsx`'s `addApplet`/`addPanel` calls — use `` `${key}:${nanoid()}` `` and parse the active key via `id.split(':')[0]` (per `syncOpen`, lines 654-663) consistently across Dock.tsx and PanelBody.tsx's dispatcher

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/shell/Dock.tsx` | component | event-driven | First integration of dockview-core in the repo; no wrapper component exists to imitate in-repo. Reference exists only in the (non-React, vanilla-JS) design-handoff prototype `.dc.html`, cited above. |
| `src/shell/Dock.module.css` (the `--dv-*` override block itself) | config | transform | The 19-variable dockview theme map is spec-authored (UI-SPEC "Dock Theme Tokens"), not extracted from any existing repo file — copy verbatim from `02-UI-SPEC.md` lines 272-294. |

## Metadata

**Analog search scope:** `src/` (full tree, 13 files), `src-tauri/tauri.conf.json`, `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/` (store.js + `.dc.html` prototype — cited by CONTEXT.md as the explicit porting reference)
**Files scanned:** src/App.tsx, src/app/AppShell.tsx(+css), src/shell/TitleBar.tsx(+css+test), src/shell/LogoCluster.tsx, src/shell/WindowControls.tsx(+css+test), src/shell/useMaximizedState.ts, src/styles/tokens.css, src-tauri/tauri.conf.json, package.json, store.js, Sourcerer Bespoke Rails.dc.html (targeted sections: rail geometry, dock init, panel dispatch, drag/reorder)
**Pattern extraction date:** 2026-07-07
