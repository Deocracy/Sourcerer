# Phase 3: Persistence & Layouts - Pattern Map

**Mapped:** 2026-07-09
**Files analyzed:** 11 (new + modified)
**Analogs found:** 9 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/persistence/workspaceStore.ts` (new) | service/store | CRUD (load/save + migrate) | `src/shell/Dock.tsx` (persistence block, lines 129-186) + `src/store/shellStore.ts` (load/persist, lines 60-91) | role-match (localStorage → plugin-store re-home) |
| `src/persistence/layouts.ts` (new) | service | CRUD | `src/store/shellStore.ts` (action-then-persist pattern, lines 120-148) | role-match |
| `src/persistence/workspaceStore.test.ts` (new) | test | unit | `src/shell/TitleBar.test.tsx` (render/assert idiom); no existing store test to copy from directly | partial |
| `src/shell/Dock.tsx` (modify) | component | event-driven → CRUD write | itself (existing file, lines 129-186 to be replaced by calls into `workspaceStore.ts`) | exact (self) |
| `src/store/shellStore.ts` (modify) | store | CRUD | itself (existing file, `load()`/`persist()` redirected) | exact (self) |
| `src/shell/LayoutsMenu.tsx` (new) | component (dropdown) | request-response (user action → store mutation) | `src/shell/DiviChip.tsx` (title-bar button/store-read stub) + `src/shell/RailToggleButtons.tsx` (store-action-on-click) | no close analog — net-new UI, see below |
| `src/shell/LayoutsMenu.module.css` (new) | config/style | — | `src/shell/DiviChip.module.css` / `src/shell/TitleBar.module.css` | role-match |
| `src/shell/ResetNotice.tsx` (new) | component | event-driven (one-time dismissible) | none — no toast/notice component exists yet | no analog |
| `src/shell/LayoutsMenu.test.tsx` (new) | test | component | `src/shell/TitleBar.test.tsx` | role-match |
| `src/shell/TitleBar.tsx` (modify) | component | request-response | itself (mount point, lines 15-28) | exact (self) |
| `src-tauri/src/lib.rs` (modify) | native/config | event-driven (window close) | itself (existing `on_window_event` closure, lines 31-57) | exact (self) |
| `src-tauri/Cargo.toml` (modify) | config | — | itself (dependency list, lines 20-25) | exact (self) |
| `src-tauri/capabilities/default.json` (modify) | config | — | itself (permissions array) | exact (self) |

## Pattern Assignments

### `src/persistence/workspaceStore.ts` (service, CRUD load/save/migrate)

**Analog:** `src/shell/Dock.tsx` (canary + debounce block) and `src/store/shellStore.ts` (load/persist)

**Canary-guarded restore pattern to re-home** (`src/shell/Dock.tsx` lines 129-162):
```typescript
const LAYOUT_KEY = "sourcerer-dockview-bespoke-v2";
const CANARY_KEY = `${LAYOUT_KEY}:canary`;
...
let restored = false;
try {
  if (localStorage.getItem(CANARY_KEY)) {
    // Previous restore crashed before clearing its own canary — the
    // saved layout is presumed poisoned, drop it.
    localStorage.removeItem(LAYOUT_KEY);
  }
  localStorage.setItem(CANARY_KEY, "1");
  const raw = localStorage.getItem(LAYOUT_KEY);
  if (raw) {
    api.fromJSON(JSON.parse(raw));
    restored = true;
  }
} catch {
  restored = false;
  try { api.clear(); } catch { /* best-effort recovery only */ }
  try { localStorage.removeItem(LAYOUT_KEY); } catch { /* best-effort recovery only */ }
}
const canaryTimer = setTimeout(() => {
  try { localStorage.removeItem(CANARY_KEY); } catch { /* best-effort cleanup only */ }
}, 4000);
```
**Re-home instructions:** Replace `localStorage.getItem/setItem/removeItem` calls with reads/writes against a `WorkspaceRecordV1` object loaded via `@tauri-apps/plugin-store`'s `LazyStore`. Keep the exact canary-then-4s-clear shape — do not invent a new crash-detection mechanism (per CONTEXT.md D-02/"Behavior to preserve").

**Debounced save pattern to re-home** (`src/shell/Dock.tsx` lines 174-186):
```typescript
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const layoutDisposable = api.onDidLayoutChange(() => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(api.toJSON()));
    } catch {
      // persistence is best-effort scaffolding in Phase 2 (D-02); ignore
      // quota/serialization errors.
    }
  }, 300);
});
```
**Re-home instructions:** This 300ms debounce becomes the single `scheduleWorkspaceSave()` writer (per RESEARCH.md Pitfall 3) — it must read the *current full* in-memory state at flush time (dockApiRef's live `toJSON()` **and** `shellStore.getState()`'s rail subset **and** the savedLayouts map), not a partial snapshot captured at schedule time, since both `Dock.tsx` and `shellStore.ts` currently fire independent uncoordinated writes.

**Best-effort try/catch load pattern to re-home** (`src/store/shellStore.ts` lines 68-91):
```typescript
function load(): PersistedSlice {
  try {
    return (JSON.parse(localStorage.getItem(LS_KEY) || "{}") as PersistedSlice) || {};
  } catch {
    return {};
  }
}

function persist(get: () => ShellState): void {
  const s = get();
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        railMode: s.railMode,
        railWidth: s.railWidth,
        railOrder: s.railOrder,
        leftRailPinned: s.leftRailPinned,
      }),
    );
  } catch {
    // persistence is best-effort in Phase 2; ignore quota/serialization errors.
  }
}
```
**Re-home instructions:** This is the rail-subset half of the unified record. Per D-04/D-07, the new version must NOT stay silent on failure — add the one-time dismissible notice + `console.warn` + `.bak` copy (D-08) before falling back to `DEFAULT_WORKSPACE` (Wiki+Library, D-05), which this Phase-2 pattern does not do (RESEARCH.md Anti-Pattern: "Silent reset on corrupt state").

**New migrator seam** (no existing analog — synthesized in RESEARCH.md Pattern 1, use as-is):
```typescript
const LATEST_SCHEMA_VERSION = 1;
type Migrator = (old: unknown) => unknown;
const migrators: Record<number, Migrator> = {
  // 1: (old) => { /* transform v1 -> v2 when that day comes */ },
};

function migrate(raw: { schemaVersion: number; [k: string]: unknown }): WorkspaceRecordV1 | null {
  let version = raw.schemaVersion;
  let data: unknown = raw;
  while (version < LATEST_SCHEMA_VERSION) {
    const step = migrators[version];
    if (!step) return null; // no path forward -> caller discards to default
    data = step(data);
    version += 1;
  }
  return data as WorkspaceRecordV1;
}
```

**LazyStore load/save shape** (RESEARCH.md Code Examples, official docs pattern):
```typescript
import { LazyStore } from "@tauri-apps/plugin-store";
const workspaceStore = new LazyStore("workspace.json");
export async function loadWorkspaceRecord(): Promise<unknown> {
  return workspaceStore.get("workspace");
}
export async function saveWorkspaceRecord(record: WorkspaceRecordV1): Promise<void> {
  await workspaceStore.set("workspace", record);
  await workspaceStore.save();
}
```

---

### `src/persistence/layouts.ts` (service, CRUD over savedLayouts slice)

**Analog:** `src/store/shellStore.ts` action-then-persist idiom (lines 120-148):
```typescript
setRailMode: (m) => {
  set({ railMode: m, railOpen: m !== "hidden" });
  persist(get);
},
...
togglePin: (key) => {
  const pinned = get().leftRailPinned;
  const next = pinned.includes(key)
    ? pinned.filter((k) => k !== key)
    : [...pinned, key];
  set({ leftRailPinned: next });
  persist(get);
},
```
**Apply pattern:** `saveLayout(name)` / `applyLayout(id)` / `deleteLayout(id)` / `resetToDefault()` should each mutate the in-memory record then call the single `scheduleWorkspaceSave()` writer from `workspaceStore.ts` — mirror the "mutate, then persist" two-step shown above rather than writing to disk inline per-action.

---

### `src/shell/LayoutsMenu.tsx` (component, dropdown, no close analog)

**No existing dropdown/menu component in the codebase** (grep for `dropdown|Menu|role="menu"` across `src/` returned no matches) — this is genuinely net-new UI per CONTEXT.md D-01 ("no design-handoff reference"). Closest structural precedents for the *button* half:

**Store-read + click-driven store-action button** (`src/shell/DiviChip.tsx`, full file):
```typescript
import { useShellStore } from "../store/shellStore";
import styles from "./DiviChip.module.css";

function toggleDivi() {
  console.log("toggleDivi: no-op stub in Phase 2 (Home overlay not built yet)");
}

export function DiviChip() {
  const active = useShellStore((s) => s.railApplet === "Home");
  return (
    <button
      type="button"
      className={active ? `${styles.chip} ${styles.active}` : styles.chip}
      onClick={toggleDivi}
    >
      DIVI
    </button>
  );
}
```

**Multiple related store-action buttons in one component** (`src/shell/RailToggleButtons.tsx` lines 10-20):
```typescript
export function RailToggleButtons() {
  const railMode = useShellStore((s) => s.railMode);
  return (
    <div className={styles.toggles}>
      <button
        type="button"
        className={styles.toggle}
        aria-label="Cycle rail mode (left)"
        onClick={() => shellStore.getState().cycleRailMode()}
      >
        ...
      </button>
```

**Guidance for planner:** Build `LayoutsMenu.tsx` as a `useState`-driven open/closed dropdown (no existing precedent for the popover/listbox itself — this is the one truly novel component this phase). Follow the codebase's established conventions for the parts that DO have precedent: CSS Modules import (`styles from "./LayoutsMenu.module.css"`), `useShellStore`/direct `shellStore.getState()` for store reads/actions (see DiviChip/RailToggleButtons above), and `aria-label`s on every interactive element (TitleBar.test.tsx asserts on these). Mount point is `TitleBar.tsx` line 24, **before** `<RailToggleButtons />` per D-01.

---

### `src/shell/ResetNotice.tsx` (component, event-driven, no analog)

**No existing toast/notice/dismissible-element component in the codebase.** Per CONTEXT.md D-04, this is deliberately "one self-contained element," not shared infra — build a minimal component with local `useState` for dismiss, no new framework. Follow `PanelBody.tsx`'s simple CSS-module + JSX-return shape as the nearest *structural* (not behavioral) precedent for a small self-contained display component:

```typescript
// src/shell/PanelBody.tsx lines 17-40 — CSS module import + simple functional
// component returning a styled div tree, no external deps beyond styles.
export function PanelBody({ appletKey }: PanelBodyProps) {
  const def = appletDefs[appletKey] ?? { glyph: "◌", title: appletKey, line: "" };
  return (
    <div className={styles.host}>
      <div className={styles.wrap}>...</div>
    </div>
  );
}
```

---

### `src-tauri/src/lib.rs` (modify — add `CloseRequested` arm)

**Analog:** itself — the existing `on_window_event` closure (lines 31-57) already handles `WindowEvent::Resized`. CRITICAL per RESEARCH.md Pitfall 4 / Common Pitfalls: **add a new match arm alongside, do not replace the closure**:

```rust
.on_window_event(|window, event| {
    if let tauri::WindowEvent::Resized(_) = event {
        if ADJUSTING_MAXIMIZE.load(Ordering::SeqCst) {
            return;
        }
        let maximized = window.is_maximized().unwrap_or(false);
        let resizable = window.is_resizable().unwrap_or(true);
        if maximized && resizable {
            // ... existing maximize-frame-drop landmine fix, DO NOT TOUCH ...
        } else if !maximized && !resizable {
            let _ = window.set_resizable(true);
            log_window_rect(window, "restored: frame back");
        }
    }
    // NEW: add here, e.g. `else if let tauri::WindowEvent::CloseRequested { api, .. } = event { ... }`
})
```
**Plugin registration analog** — existing plugin registration pattern to copy for `tauri_plugin_store`:
```rust
.plugin(tauri_plugin_opener::init())
```
Add `.plugin(tauri_plugin_store::Builder::default().build())` the same way, in the builder chain before `.invoke_handler(...)`.

---

### `src-tauri/Cargo.toml` (modify)

**Analog:** itself, existing `[dependencies]` block (lines 20-25):
```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["sync", "time"] }
```
Add `tauri-plugin-store = "2"` following the same `"2"`-pinned-major convention as `tauri-plugin-opener`.

---

### `src-tauri/capabilities/default.json` (modify)

**Analog:** itself, existing `permissions` array:
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-minimize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-close",
    "core:window:allow-set-resizable",
    "core:window:allow-start-dragging",
    "opener:default"
  ]
}
```
Add the store plugin's permission identifier (likely `"store:default"` — verify at implementation time per RESEARCH.md A2, prefer `npm run tauri add store` which auto-patches this file over a hand-edit).

## Shared Patterns

### Best-effort try/catch persistence (never crash on untrusted state)
**Source:** `src/shell/Dock.tsx` lines 143-155 and `src/store/shellStore.ts` lines 69-73, 88-90
**Apply to:** `workspaceStore.ts` load/save, `layouts.ts` apply-layout (any path that parses persisted JSON or calls `dockApi.fromJSON()`)
```typescript
try {
  // parse / hydrate
} catch {
  restored = false;
  try { api.clear(); } catch { /* best-effort recovery only */ }
}
```
Phase 3 formalizes this into a *visible* fallback (D-04's notice) rather than the current silent swallow — see Anti-Pattern note above.

### Debounce coalescing (300ms)
**Source:** `src/shell/Dock.tsx` lines 174-186
**Apply to:** the single `scheduleWorkspaceSave()` writer in `workspaceStore.ts` — keep the interval and clear-then-reset-timer shape; do not stack a second independent debounce from `shellStore.ts`'s currently-synchronous `persist(get)` calls (RESEARCH.md Pitfall 3).

### Vanilla Zustand store + `useStore` selector binding
**Source:** `src/store/shellStore.ts` lines 108-160
**Apply to:** Any component reading the unified record's in-memory mirror (e.g. `LayoutsMenu.tsx` reading `savedLayouts`) — use `useShellStore((s) => s.someSlice)` for the read path and `shellStore.getState().someAction()` for the write path, exactly as `DiviChip.tsx`/`RailToggleButtons.tsx` already do.

### Tauri IPC guarded-at-click-time pattern
**Source:** `src/shell/WindowControls.tsx` lines 9-15
```typescript
function withWindow(fn: (appWindow: ReturnType<typeof getCurrentWindow>) => Promise<void>) {
  try {
    fn(getCurrentWindow()).catch(console.error);
  } catch (err) {
    console.error(err);
  }
}
```
**Apply to:** Any new code calling Tauri window/store JS APIs from a component that must also render safely in Vitest/jsdom without a mocked IPC context (see `TitleBar.test.tsx` rendering `WindowControls` with no IPC mock) — defer the `getCurrentWindow()`/store call to click/effect time, not render/module time.

### Component test idiom (render + `screen.getByLabelText`/`getByText`)
**Source:** `src/shell/TitleBar.test.tsx` (full file)
**Apply to:** `LayoutsMenu.test.tsx` — render the component, assert structure via `aria-label`s and visible text, and (new for this phase) assert dropdown open/close state transitions and per-row delete/apply click handlers the same way `WindowControls.test.tsx`/`TitleBar.test.tsx` assert click-triggered store actions.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/shell/LayoutsMenu.tsx` (the dropdown/popover mechanism itself, not the button) | component | request-response | No dropdown/menu/popover component exists anywhere in `src/` (grep for `dropdown\|Menu\|role="menu"` returned zero matches) — CONTEXT.md D-01 confirms this is net-new UI with no design-handoff reference. Use RESEARCH.md's architecture diagram (Save current…/apply/delete/Reset flow) as the behavioral spec; borrow only the button/store-binding idioms from DiviChip/RailToggleButtons above. |
| `src/shell/ResetNotice.tsx` | component | event-driven | No toast/notification/dismissible-banner component exists in the codebase (CLAUDE.md/CONTEXT.md both note the shell has no toast system, and D-04 explicitly scopes this as one self-contained element, not shared infra). |
| `workspaceStore.test.ts` (the corrupt/migration-fallback test cases) | test | unit | No existing test exercises a corrupt-JSON-fallback or schema-migration scenario; nearest precedent (`TitleBar.test.tsx`) only covers render/structure assertions, not persistence-layer fault injection. Use Vitest's `vi.useFakeTimers()` (already available per `vitest.config.ts`) for the debounce-timing half; the corrupt-input half needs new fixture data with no direct codebase precedent. |

## Metadata

**Analog search scope:** `src/shell/`, `src/store/`, `src-tauri/src/`, `src-tauri/capabilities/`, `src-tauri/Cargo.toml`
**Files scanned:** `Dock.tsx`, `shellStore.ts`, `TitleBar.tsx`, `TitleBar.test.tsx`, `PanelBody.tsx`, `DiviChip.tsx`, `RailToggleButtons.tsx`, `WindowControls.tsx`, `useMaximizedState.ts`, `lib.rs`, `Cargo.toml`, `capabilities/default.json`
**Pattern extraction date:** 2026-07-09
