# Phase 3: Persistence & Layouts - Research

**Researched:** 2026-07-09
**Domain:** Tauri v2 `tauri-plugin-store` persistence, schema versioning/migration, window-close flush, named-layout UI over dockview-core + Zustand
**Confidence:** HIGH (stack/API surface, verified via official docs + registry) / MEDIUM (close-flush race handling — no official worked example found)

## Summary

Phase 3 replaces two ad-hoc Phase-2 `localStorage` scaffolds (`sourcerer-dockview-bespoke-v2` in `Dock.tsx`, `sourcerer-shell-store-v1` in `shellStore.ts`) with **one** versioned record on `@tauri-apps/plugin-store` (JS 2.4.3, confirmed current on npm; Rust crate `tauri-plugin-store` tracks the same `2.x` line). The plugin is not yet installed in this project — `Cargo.toml` has no `tauri-plugin-store` dependency and `package.json` has no `@tauri-apps/plugin-store` — so Wave 1 of this phase must add both halves (`npm install @tauri-apps/plugin-store` + `cargo add tauri-plugin-store`) plus the store's own permission entry in `src-tauri/capabilities/default.json` (currently only `core:*` + `opener:default`).

The plugin ships its own debounced `autoSave` (100ms) but the docs are explicit that a *disabled* autoSave only saves "upon graceful exit" — the same abrupt-termination risk PERS-04 exists to close. The safe pattern verified against Tauri's `WindowEvent::CloseRequested` + `CloseRequestApi.prevent_close()` (Rust) is: intercept close, synchronously force a final `store.save()`, then call `api.close()` (or emit a JS-side flush via `onCloseRequested` + `event.preventDefault()` before manually closing). Keep the existing 300ms coalescing debounce for *writes to the in-memory record*; let the store's own autoSave (or an explicit `.save()` call inside the debounce callback) do the disk write — do not stack two independent debounce layers without deciding which owns "final" flush authority.

**A third, previously undocumented localStorage scaffold exists**: `sourcerer:assistant:sessionId` in `src/assistant/AssistantPanel.tsx` (Phase 7, shipped after this CONTEXT.md was written, STATE.md: "interim, ahead of tauri-plugin-store"). Per the Phase 02/07 ownership-boundary memory, `src/assistant/**` is Phase-7-owned — Phase 3 must NOT migrate or touch this key; it's explicitly called out in STATE.md as **intentionally interim** pending a later plugin-store migration outside this phase's scope. Flag it as an open question for planning (does Phase 3's arrival change that "interim" status?) rather than silently assuming it's covered by D-09's "two scaffolds" framing.

**Primary recommendation:** Install `@tauri-apps/plugin-store` 2.4.3 + `tauri-plugin-store` (matching 2.x), add its capability, define one `WorkspaceRecordV1` TypeScript type (dock tree JSON + rail subset + saved layouts map + empty instance-state slot + `schemaVersion: 1`), lift the existing canary+debounce logic from `Dock.tsx`/`shellStore.ts` into a single module that reads/writes that one record, add a `migrators: Record<number, (old: unknown) => unknown>` empty map + runner, wire an `onCloseRequested` (JS) or `on_window_event` (Rust) flush hook that forces a final synchronous save before allowing close, and build the LAYOUTS dropdown per `03-UI-SPEC.md` as a new `TitleBar.tsx` child reading/writing the layouts slice of the same record.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Unified workspace record read/write | Frontend (TS, Zustand + plugin-store JS API) | — | All shell state (dock tree, rail, layouts) already lives in the frontend; plugin-store's JS API is the direct persistence surface, no Rust command layer needed for normal reads/writes |
| Flush-on-close | Rust (Tauri `on_window_event`/`CloseRequestApi`) with a JS-side `onCloseRequested` alternative | Frontend (JS `Store.save()`) | The close event and the ability to block it natively lives at the window/Rust layer; the actual save call can be issued from either side, but blocking `api.close()` until save resolves is more reliable from Rust since it can `block_on` the async save before permitting close |
| Corrupt/stale fallback + migration | Frontend (TS) | — | Parsing, validating schemaVersion, and picking the default workspace are pure data-shape logic against the already-loaded JSON; no OS/native concern |
| LAYOUTS dropdown UI | Browser/Client (React component in `TitleBar.tsx`) | — | Pure UI, no native surface; reads/writes the same frontend record |
| Rolling `.bak` write | Frontend (JS `Store` API, a second store file) OR Rust (fs copy) | — | Either works; JS is simpler (just a second `Store.load('workspace.json.bak')` write) and keeps all persistence logic in one file — no Rust round-trip needed unless the team wants copy to be atomic at the OS level |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tauri-apps/plugin-store` | 2.4.3 `[VERIFIED: npm registry]` | JS API: `Store.load`/`LazyStore`, get/set/save/delete | Already mandated in project `CLAUDE.md`; confirmed current on npm registry (`npm view` returned `2.4.3`, matches CLAUDE.md's locked version, not stale) |
| `tauri-plugin-store` (Rust crate) | `2.x` (lockstep with JS package per CLAUDE.md's version-compatibility table) `[CITED: tauri-apps/tauri-plugin-store GitHub mirror + crates.io listing]` | Rust-side plugin registration (`tauri_plugin_store::Builder::default().build()`) | Official first-party plugin; required Rust half of the same feature — `cargo add tauri-plugin-store` per official docs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing `zustand` 5.0.14 vanilla store (`shellStore.ts`) | already installed | Holds rail subset + the new `savedLayouts`/`schemaVersion` in-memory before it's written to plugin-store | Extend, don't replace — D-09/discretion note leaves "zustand path vs folded into unified write" to the planner; recommend keeping Zustand as the in-memory source of truth and using plugin-store purely as the disk sink it subscribes into via `subscribeWithSelector` (already a CLAUDE.md-recommended pattern, not yet used in `shellStore.ts`) |
| `dockview-core` 2.0.0 (already installed) `toJSON()`/`fromJSON()` | existing | Dock-tree serialize/deserialize — untouched by this phase, just re-homed into the unified record's `dockTree` field | No change needed to Dock's dockview usage, only to *where* the JSON string is written/read |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `tauri-plugin-store`'s built-in `autoSave` (100ms debounce) | A hand-rolled debounce writing via explicit `.save()` calls (current 300ms pattern) | Recommend **keeping the hand-rolled 300ms debounce** for coalescing rapid dockview layout-change events, but calling `.save()` explicitly rather than relying solely on plugin autoSave — this keeps the existing, already-tested debounce behavior and gives an explicit hook point to also trigger the D-08 `.bak` write and D-04 corrupt-notice logic, which autoSave alone can't drive |
| Single `workspace.json` file for everything | Two files (`workspace.json` for hot state + `layouts.json` for saved named layouts) | D-09 explicitly mandates "one unified whole-workspace record" — do not split; a single file also makes the D-08 rolling `.bak` and the atomic-write guarantee simpler (one file to back up, one file whose corruption triggers fallback) |
| Rust-side `on_window_event` close-flush | JS-side `getCurrentWindow().onCloseRequested()` + `event.preventDefault()` + manual `.close()` after save | Both work (both verified in official docs/search). **Recommend Rust-side** (`CloseRequestApi.prevent_close()` + `tauri::async_runtime::block_on` the save) because it is the officially-documented pattern with the most examples, and it centralizes the flush next to the existing `on_window_event` handler already in `lib.rs` (maximize-drop logic) rather than adding a second async close-race surface in the frontend |

**Installation:**
```bash
npm install @tauri-apps/plugin-store
cargo add tauri-plugin-store --manifest-path src-tauri/Cargo.toml
```
Then register the plugin in `src-tauri/src/lib.rs` (`.plugin(tauri_plugin_store::Builder::default().build())`) and add a store permission set to `src-tauri/capabilities/default.json` (the plugin publishes `store:default` — verify exact permission identifier name at `npm run tauri add store` time, since `tauri add` auto-patches the capabilities file, which is the officially recommended installation path over manual `cargo add`/`npm install`).

**Version verification:** Confirmed via `npm view @tauri-apps/plugin-store version` → `2.4.3` (matches CLAUDE.md's already-researched pin, still current as of this research pass). The Rust crate version was not independently re-verified against crates.io in this session (network search only, not a direct registry query) — `[ASSUMED]` that it is on the same `2.x` line per Tauri's stated lockstep convention; confirm with `cargo add tauri-plugin-store` at implementation time and let Cargo resolve the matching version.

## Package Legitimacy Audit

> slopcheck was **not available** in this environment (`pip install slopcheck` succeeded but the `slopcheck` CLI was not on PATH / not found by the shell — `command not found`). Per the graceful-degradation protocol, the one net-new package this phase installs is tagged `[ASSUMED]` below and the planner must gate its install behind a `checkpoint:human-verify` task.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@tauri-apps/plugin-store` | npm | first-party Tauri org plugin, multi-year history (part of the `tauri-apps/plugins-workspace` monorepo) | high (official Tauri plugin, used across the ecosystem) | `github.com/tauri-apps/plugins-workspace` (mirror: `github.com/tauri-apps/tauri-plugin-store`) | not run — `[ASSUMED]` | Approved, but gate install behind `checkpoint:human-verify` since slopcheck did not run |
| `tauri-plugin-store` (Rust crate) | crates.io | same first-party monorepo/release cadence as above | high | same as above | not run — `[ASSUMED]` | Approved, but gate install behind `checkpoint:human-verify` |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time — both packages above are tagged `[ASSUMED]` and the planner must gate each install behind a `checkpoint:human-verify` task, even though both are already independently mandated in `CLAUDE.md` as the project's locked stack choice (i.e., this is not a "new" discovery, but the automated legitimacy gate still could not run mechanically this session).*

## Architecture Patterns

### System Architecture Diagram

```
[App launch]
     │
     ▼
[Frontend: WorkspacePersistence.load()]
     │  reads workspace.json via @tauri-apps/plugin-store JS API
     ▼
[Parse + schemaVersion check] ──fails/throws──► [copy corrupt file → workspace.json.bak (D-08)]
     │  passes / migrated OK                              │
     ▼                                                     ▼
[Hydrate: dockApi.fromJSON(dockTree)          [Load DEFAULT_WORKSPACE (Wiki+Library, D-05)]
 + shellStore rail fields + savedLayouts]              │
     │                                                 ▼
     │                                        [Show one-time dismissible notice (D-04)
     │                                         + console.warn]
     └──────────────────┬──────────────────────────────┘
                         ▼
              [Shell renders — user interacts:
               drag/dock/resize/rail-reorder/tab-open]
                         │
                         ▼
        [onDidLayoutChange / setRailMode / etc. fire]
                         │
                         ▼
         [300ms debounce coalesce (existing pattern)]
                         │
                         ▼
     [Build one WorkspaceRecordV1 snapshot: dockTree.toJSON()
      + rail subset + savedLayouts + instanceState slot]
                         │
                         ▼
        [store.set('workspace', record) + store.save()]
                         │
                         ▼
              (disk write to workspace.json)

[User opens LAYOUTS ▾ dropdown]
     │
     ├─ "Save current…" → snapshot current record → append to savedLayouts map → persist
     ├─ click a saved layout row → apply: dockApi.fromJSON(layout.dockTree) + rehydrate rail/instance state → persist as current
     ├─ "×" per row → delete from savedLayouts map → persist
     └─ "Reset" → load DEFAULT_WORKSPACE (same as D-05) → apply → persist (does NOT touch savedLayouts)

[Window close requested]
     │
     ▼
[Rust on_window_event: WindowEvent::CloseRequested]
     │  api.prevent_close()
     ▼
[block_on: force final store.save() / flush pending debounce]
     │
     ▼
[api.close() — actual window close proceeds]
```

### Recommended Project Structure
```
src/
├── persistence/
│   ├── workspaceStore.ts     # the ONE plugin-store-backed record: schema, load/save, migrators map+runner, default workspace, corrupt-fallback + .bak logic
│   ├── layouts.ts            # save/apply/delete named-layout operations over workspaceStore's savedLayouts slice
│   └── workspaceStore.test.ts
├── shell/
│   ├── Dock.tsx               # MODIFIED: canary/debounce logic removed, replaced by calls into persistence/workspaceStore.ts; dockApiRef unchanged
│   ├── LayoutsMenu.tsx        # NEW — the LAYOUTS ▾ dropdown (D-01), mounts in TitleBar's right cluster
│   ├── LayoutsMenu.module.css
│   ├── ResetNotice.tsx        # NEW — D-04's one-time dismissible corrupt-reset notice
│   └── TitleBar.tsx           # MODIFIED: mounts <LayoutsMenu /> before RailToggleButtons
├── store/
│   └── shellStore.ts          # MODIFIED: load()/persist() redirected from localStorage to persistence/workspaceStore.ts's record (rail subset only)
src-tauri/
├── Cargo.toml                 # MODIFIED: + tauri-plugin-store
├── capabilities/default.json  # MODIFIED: + store permission
└── src/lib.rs                 # MODIFIED: + .plugin(tauri_plugin_store::Builder::default().build()) + CloseRequested flush handler
```

### Pattern 1: Unified versioned record with empty migrator seam
**What:** One `WorkspaceRecordV1` type with `schemaVersion: number`, loaded through a `migrators: Record<number, (old: unknown) => unknown>` map + a runner loop that applies migrators sequentially from the persisted version up to the current `LATEST_SCHEMA_VERSION`, discarding to default on any throw or gap.
**When to use:** Any time persisted shape may change across app versions — this is the exact PERS-03 "migration path carried" requirement, deliberately over-engineered by zero migrators today (D-07's explicit "do NOT over-build" instruction).
**Example:**
```typescript
// Source: pattern synthesized from Tauri plugin-store JS API (Store.load/get/set/save)
// https://v2.tauri.app/plugin/store/ — no official migration helper exists, this is
// a standard versioned-JSON-migration idiom, not a plugin-store-specific API.
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

### Pattern 2: Canary-guarded restore (re-homed, not rewritten)
**What:** The existing `Dock.tsx` canary key (`sourcerer-dockview-bespoke-v2:canary`) already detects "previous restore crashed before clearing its own flag" — re-home this exact mechanism onto a key inside the plugin-store record (e.g. a `restoreCanary: boolean` field written before hydrate and cleared 4s after, same as today) rather than inventing a new crash-detection mechanism.
**When to use:** Every app launch, before `dockApi.fromJSON()` is called.
**Example:**
```typescript
// Source: ported from existing src/shell/Dock.tsx (lines ~129-162), re-homed onto
// the plugin-store record instead of localStorage — same canary-then-4s-clear shape.
```

### Pattern 3: Rust-side close-flush via `CloseRequestApi`
**What:** Intercept `WindowEvent::CloseRequested` in the existing `on_window_event` handler in `lib.rs`, call `api.prevent_close()`, force the pending frontend write to flush (either by emitting an event the frontend awaits, or — simpler — always writing through the Rust-side `app.store(path)` handle so the Rust layer itself can call `.save()` synchronously before permitting close), then call `window.close()` (or `api.close()` depending on the exact CloseRequestApi surface at implementation time — verify against `docs.rs/tauri/latest/tauri/struct.CloseRequestApi.html` since this research pass did not fetch that exact page, only corroborating WebSearch summaries).
**When to use:** PERS-04's "flushed on window close" requirement.
**Example:**
```rust
// Source: pattern corroborated via WebSearch of docs.rs/tauri CloseRequestApi +
// GitHub discussion #5334 (MEDIUM confidence — no official Tauri v2 guide page
// was found with a worked flush-then-close example; verify CloseRequestApi's
// exact method names against docs.rs at implementation time).
.on_window_event(|window, event| {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        // flush the store synchronously, then actually close:
        let w = window.clone();
        tauri::async_runtime::spawn(async move {
            // e.g. w.state::<StoreCollection>()... .save() — exact call depends
            // on whether the record is written via the Rust or JS store handle.
            w.close().ok();
        });
    }
})
```
**Confidence flag:** MEDIUM — the `prevent_close()`/`CloseRequestApi` API surface itself is HIGH confidence (docs.rs page exists, confirmed via WebSearch), but no official *end-to-end worked example* combining "flush store then actually close" was found in the official Tauri docs during this pass. Treat the exact call sequence as needing a quick implementation-time spike/smoke-test, not as a copy-paste-ready recipe.

### Anti-Patterns to Avoid
- **Stacking plugin autoSave AND a hand-rolled debounce with no single owner of "final flush":** decide once whether `.save()` is called explicitly (recommended, keeps the existing 300ms coalescing pattern and gives an explicit hook for the `.bak` write) or left to the plugin's own 100ms autoSave — don't run both expecting either to "win," pick one flush authority.
- **Splitting the workspace into multiple store files:** D-09 is explicit about one unified record; don't create `dock.json` + `rail.json` + `layouts.json` — one file simplifies the corrupt-fallback/`.bak`/schemaVersion logic to a single blast radius.
- **Silent reset on corrupt state:** D-04 requires the dismissible notice; a `try/catch` that swallows the error and resets with no user-visible signal (the *current* Phase-2 `localStorage` pattern) does not satisfy PERS-03 as scoped by CONTEXT.md — the "best-effort try/catch" Phase-2 pattern must gain a visible notice this phase, not just be re-homed silently.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Key-value disk persistence with debounced writes | A custom file-write wrapper around Tauri's fs plugin | `@tauri-apps/plugin-store` (already mandated) | First-party plugin already handles atomic-ish writes, `autoSave` debounce, and cross-platform app-data-dir resolution; CLAUDE.md explicitly rejects `localStorage` for this reason |
| Dock-tree serialize/restore | Any bespoke tree-walk serializer | `dockview-core`'s own `api.toJSON()`/`api.fromJSON()` (already used in `Dock.tsx`, D-04 from Phase 2) | Dockview already owns and serializes its own tree shape; Phase 3 only changes the storage target, never the serialization mechanism |
| Version-to-version data migration engine | A generic schema-migration library/framework | The one-map-plus-runner-loop pattern in Pattern 1 above | D-07 explicitly warns against over-building this — a full migration framework (e.g. with rollback, dry-run, branching migrations) solves problems this v1-schema, zero-migrators phase does not have |

**Key insight:** Every persistence primitive this phase needs (KV store, debounce, tree serialize) already exists in the stack or the Phase-2 codebase — the work is *unification and re-homing*, not new infrastructure, except for the LAYOUTS UI and the close-flush hook (both genuinely new).

## Common Pitfalls

### Pitfall 1: Trusting plugin `autoSave` alone for PERS-04's "flushed on window close"
**What goes wrong:** Assuming enabling `autoSave: true` (100ms debounce) is sufficient for crash-safety; docs state that with autoSave *disabled* the store only saves "upon graceful exit" — implying the plugin's own guarantee around abrupt termination (crash, kill -9, power loss) is not fully documented/verified either way.
**Why it happens:** The plugin's debounce is about *coalescing frequent writes*, not about surviving an OS-level abrupt kill — those are different guarantees.
**How to avoid:** Treat the plugin's autoSave as best-effort coalescing only; PERS-04's actual crash-safety guarantee comes from (a) the debounce being short (existing 300ms) so the *window* of unsaved data is small, and (b) the explicit close-flush hook (Pattern 3) handling the *graceful* close path. True abrupt termination (process killed) cannot be made fully safe by any userspace mechanism — document this as an inherent limit, not a gap in the implementation.
**Warning signs:** A plan that treats "flushed on window close" as fully solved by `autoSave: true` alone, with no explicit `CloseRequested` handler.

### Pitfall 2: Forgetting the capabilities file when adding the plugin
**What goes wrong:** `src-tauri/capabilities/default.json` currently only lists `core:*` + `opener:default` permissions. Adding `tauri_plugin_store::Builder::default().build()` to `lib.rs` without also adding the plugin's permission identifier(s) to the capability file causes the JS API calls to silently fail/reject at runtime (Tauri v2's permission model blocks unlisted commands).
**Why it happens:** Tauri v2's ACL model is opt-in per capability file, unlike v1's blanket allowlist — easy to forget when hand-adding a plugin instead of using `npm run tauri add store` (which auto-patches capabilities).
**How to avoid:** Prefer `npm run tauri add store` over manual `cargo add`/`npm install`, since the CLI patches both `Cargo.toml` and the capabilities file together. If installing by hand, explicitly grep the plugin's own README/docs for its permission identifier(s) (typically `store:default` or similarly named) and add them to `default.json`.
**Warning signs:** `Store.load()`/`.set()`/`.save()` calls reject with a permission-denied-style error in the webview console at runtime despite the plugin being registered in Rust.

### Pitfall 3: Two independent debounce timers racing on the same write
**What goes wrong:** If `Dock.tsx`'s existing 300ms `onDidLayoutChange` debounce and `shellStore.ts`'s immediate `persist(get)` calls (currently un-debounced, called synchronously on every rail action) both write to the *same* unified record independently, a fast sequence of rail + dock changes can produce out-of-order writes where a stale rail-only snapshot overwrites a newer dock-tree snapshot (or vice versa).
**Why it happens:** D-09 unifies the record but the two source subsystems (dockview layout changes, rail Zustand actions) currently have independent, uncoordinated write paths inherited from Phase 2.
**How to avoid:** Route both write paths through one shared debounced writer (a single `scheduleWorkspaceSave()` function that always reads the *current full* in-memory state — dockApiRef's live `toJSON()` + shellStore's live getState() — at flush time, not at schedule time) so the last write always reflects the latest state from both subsystems, never a stale partial snapshot from whichever subsystem fired last.
**Warning signs:** Intermittent test/manual-verify failures where rapid drag+resize actions produce a persisted record missing one of the two changes.

### Pitfall 4: `useMaximizedState`'s existing `on_window_event` handler in `lib.rs` conflicting with the new CloseRequested handler
**What goes wrong:** `lib.rs`'s current `.on_window_event()` closure only matches `WindowEvent::Resized` (for the maximize-frame-drop landmine documented in memory `floating-window-inset-cut.md`). Adding a `CloseRequested` match arm to the *same* closure is safe (different enum variant), but a careless refactor that replaces the whole closure rather than adding an arm would silently regress the maximize-frame-drop fix — a previously-shipped, hard-won landmine fix (see `floating-window-inset-cut.md` memory: "maximize = Rust in-place frame drop... tao no-ops on non-resizable").
**Why it happens:** Both concerns live in the same single `on_window_event` closure by necessity (Tauri only allows one such handler per window builder call).
**How to avoid:** Add a new `match`/`if let` arm for `WindowEvent::CloseRequested` alongside the existing `Resized` arm inside the same closure — do not remove or restructure the existing Resized-handling logic.
**Warning signs:** Re-maximizing the window after this phase's changes reintroduces the dark-halo/resize-grip bug documented in `02-06-BUG-maximize-halo.md`.

## Code Examples

### Loading a plugin-store record with LazyStore
```typescript
// Source: https://v2.tauri.app/plugin/store/ (JS API summary — LazyStore defers
// load until first access)
import { LazyStore } from '@tauri-apps/plugin-store';

const workspaceStore = new LazyStore('workspace.json');

export async function loadWorkspaceRecord(): Promise<unknown> {
  return workspaceStore.get('workspace');
}

export async function saveWorkspaceRecord(record: WorkspaceRecordV1): Promise<void> {
  await workspaceStore.set('workspace', record);
  await workspaceStore.save();
}
```

### Existing canary + debounce pattern to re-home (verbatim reference, not new code)
```typescript
// Source: D:\Vibe Coding\Sourcerer\src\shell\Dock.tsx lines 129-186 (Phase 2, D-02) —
// this is the behavioral seed CONTEXT.md D-02/"Behavior to preserve" instructs Phase 3
// to generalize, not rewrite from scratch. Re-target CANARY_KEY/LAYOUT_KEY reads/writes
// from localStorage.getItem/setItem onto the unified plugin-store record's fields.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Two independent `localStorage` scaffolds (`sourcerer-dockview-bespoke-v2`, `sourcerer-shell-store-v1`) | One `tauri-plugin-store`-backed record with `schemaVersion` | This phase (Phase 3) | Enables crash-safe OS-app-data-dir storage, atomic single-file writes, and a real migration seam — `localStorage` had none of these and is webview-scoped (lost on profile reset) |
| `tauri-plugin-store` v1 closure-based `with_store()` API | Direct `app.store(path)` / `LazyStore` API | Tauri plugin v2 (already the version in use) | Not directly relevant to writing new code this phase, but relevant if any AI-assisted code generation surfaces v1-era `with_store()` snippets from stale training data — reject those, use the v2 direct-handle API |

**Deprecated/outdated:**
- v1 plugin-store's `with_store(app, stores, path, |store| { ... })` closure pattern — superseded by direct `app.store(path)` handle access in v2; do not use if any generated code suggests it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tauri-plugin-store` Rust crate is on a `2.x` version compatible with JS `2.4.3` | Standard Stack / Core | Low — Cargo will resolve a compatible version at `cargo add` time regardless; only affects documentation precision, not build correctness |
| A2 | The plugin's exact capability/permission identifier (likely `store:default`) | Common Pitfalls #2 | Medium — if the identifier name differs from assumed, the manual capabilities-file edit could use a wrong string and silently fail; mitigated by recommending `npm run tauri add store` (which patches this automatically) over a hand-edit |
| A3 | `CloseRequestApi`'s exact Rust method names/signatures for "prevent then later actually close" | Architecture Patterns / Pattern 3 | Medium — the close-flush implementation task should include a quick smoke-test verifying the exact call sequence against `docs.rs/tauri` at implementation time rather than trusting the WebSearch-summarized pattern verbatim |
| A4 | Both packages (`@tauri-apps/plugin-store` JS + Rust crate) are legitimate, non-slopsquatted | Package Legitimacy Audit | Low — both are the official first-party Tauri org plugin, already independently vetted in `CLAUDE.md`'s prior research pass; slopcheck simply didn't run mechanically this session, so this is a process gap, not a genuine trust signal |

## Open Questions

1. **Does the `sourcerer:assistant:sessionId` localStorage key (Phase 7, `src/assistant/AssistantPanel.tsx`) fall inside or outside Phase 3's persistence unification?**
   - What we know: CONTEXT.md D-09 only names two scaffolds to replace (`sourcerer-shell-store-v1`, `sourcerer-dockview-bespoke-v2`); STATE.md separately notes the assistant's sessionId storage is "interim, ahead of tauri-plugin-store."
   - What's unclear: whether "ahead of" means Phase 3 is expected to also migrate it, or whether that migration is deliberately left to a future assistant-focused phase (per the Phase 02/07 ownership-boundary memory, `src/assistant/**` is Phase-7-owned, and Phase 3 shouldn't reach into it without a cross-phase decision).
   - Recommendation: Treat it as **out of scope** for Phase 3 (respect the ownership boundary), but flag it explicitly in the plan's assumptions so a human can confirm — don't silently migrate a Phase-7-owned file as a side effect of this phase's persistence work.

2. **Exact Rust `CloseRequestApi` close-then-flush sequencing**
   - What we know: `prevent_close()` exists and blocks the default close; `tauri::async_runtime::block_on`/`spawn` patterns are commonly used to run async work before actually closing.
   - What's unclear: the officially-recommended exact sequence (block_on vs spawn, and how to guarantee the spawned task actually completes before the app process truly exits) wasn't found in an official worked example this session — only corroborated via WebSearch summaries of docs.rs + a GitHub discussion.
   - Recommendation: Budget a short implementation-time spike (a few minutes against `docs.rs/tauri/latest/tauri/struct.CloseRequestApi.html`) before writing the flush-hook task's final code, rather than treating Pattern 3's example as copy-paste ready.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| npm registry access | Installing `@tauri-apps/plugin-store` | Yes | 2.4.3 confirmed live | — |
| slopcheck CLI | Package Legitimacy Gate | No (`pip install` succeeded but binary not found on PATH) | — | All new packages tagged `[ASSUMED]`; planner adds `checkpoint:human-verify` before install |
| Rust/Cargo toolchain | `cargo add tauri-plugin-store` | Not independently re-verified this session (prior phases already build successfully with `cargo`/`tauri`, so assumed present) | — | — |
| Tauri CLI (`npm run tauri add store`) | Recommended install path (auto-patches capabilities) | Assumed present (already used to scaffold the project) | — | Manual `cargo add` + `npm install` + hand-edit capabilities file if unavailable |

**Missing dependencies with no fallback:** none blocking.
**Missing dependencies with fallback:** slopcheck (fallback: human-verify checkpoint gate, already the documented graceful-degradation path).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (`vitest.config.ts`) + `@testing-library/react` 16.3.2, jsdom environment |
| Config file | `D:\Vibe Coding\Sourcerer\vitest.config.ts` |
| Quick run command | `npm test -- --run src/persistence` (scope to the new persistence tests once created) |
| Full suite command | `npm test -- --run` (matches existing `include: ["src/**/*.test.{ts,tsx}"]`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERS-01 | Whole workspace (dock tree, rail, tabs, instance slot) persists on change and restores on launch | unit | `npm test -- --run src/persistence/workspaceStore.test.ts` | ❌ Wave 0 |
| PERS-02 | Save/apply/delete named layouts + reset via LAYOUTS menu | unit + component | `npm test -- --run src/shell/LayoutsMenu.test.tsx` | ❌ Wave 0 |
| PERS-03 | Corrupt/stale state falls back to default without crashing; missing applet key renders placeholder; schemaVersion + migration path | unit | `npm test -- --run src/persistence/workspaceStore.test.ts` (corrupt-input cases) | ❌ Wave 0 (extends same file as PERS-01) |
| PERS-04 | Writes debounced and flushed on window close | unit (debounce timing, fake timers) + manual-only (real OS close/kill behavior) | `npm test -- --run src/persistence/workspaceStore.test.ts` (debounce coalescing via `vi.useFakeTimers()`); **manual-only**: verifying a real abrupt process kill doesn't corrupt the file requires a live human-verify pass (jsdom/Vitest cannot simulate an actual OS-level process kill or a real Tauri `CloseRequested` event) | ❌ Wave 0 for the automatable half; manual checkpoint for the rest |

### Sampling Rate
- **Per task commit:** `npm test -- --run src/persistence` (and `src/shell/LayoutsMenu.test.tsx` once it exists)
- **Per wave merge:** `npm test -- --run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus the manual-only PERS-04 abrupt-termination checkpoint noted above (mirrors the project's existing `human_verify_mode: "end-of-phase"` config setting)

### Wave 0 Gaps
- [ ] `src/persistence/workspaceStore.test.ts` — covers PERS-01, PERS-03, the debounce-timing half of PERS-04
- [ ] `src/shell/LayoutsMenu.test.tsx` — covers PERS-02 (save/apply/delete/reset UI behavior), follows the existing `TitleBar.test.tsx` render+`screen.getByLabelText` pattern
- [ ] No new framework install needed — Vitest + Testing Library + jsdom already fully configured and in active use (`TitleBar.test.tsx`, `WindowControls.test.tsx`, `AssistantPanel.test.tsx` are working precedents)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A — single-user local desktop app, no auth surface in this phase |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A — no multi-user/permission boundary within the persisted workspace record |
| V5 Input Validation | Yes | Treat the persisted JSON as **untrusted input** on every load (it's a local file that could be hand-edited, corrupted by disk error, or stale from a future app version) — validate `schemaVersion` is a number, that `dockTree`/`savedLayouts`/rail fields have the expected shape before use, and never call `dockApi.fromJSON()` or apply a saved layout without a try/catch around the whole parse+hydrate path (this is exactly PERS-03's mandate, framed as an input-validation control, not merely a UX nicety) |
| V6 Cryptography | No | N/A — the workspace record contains no secrets/credentials; no encryption requirement (Tauri's own app-data-dir file permissions are the OS-level boundary, not this phase's concern) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/hand-edited `workspace.json` causing a crash or hang on load | Denial of Service | The existing try/catch-and-fallback pattern (already in `Dock.tsx`/`shellStore.ts`, formalized by D-04/D-07 this phase) — never trust the parsed shape, always have a default-workspace escape hatch |
| A saved layout referencing an applet key that no longer exists (e.g. after an applet is removed/renamed in a future phase) crashing panel dispatch | Denial of Service (partial) | D-06's generic `PanelBody` placeholder fallback — already implemented in `PanelBody.tsx`'s `makeRenderer`, reused verbatim, not a new mitigation to build |
| Local file-write race/corruption from a concurrent write during an abrupt kill mid-`.save()` | Tampering (self-inflicted, not adversarial) | D-08's rolling `.bak` file — cheap, manually-recoverable insurance; this is the phase's actual mitigation for this exact risk, not a new item to add |

## Sources

### Primary (HIGH confidence)
- [Tauri v2 Store plugin docs](https://v2.tauri.app/plugin/store/) — JS/Rust API surface, autoSave behavior, LazyStore, install commands
- npm registry direct query (`npm view @tauri-apps/plugin-store version` / `versions`) — confirmed `2.4.3` is current
- `D:\Vibe Coding\Sourcerer\src\shell\Dock.tsx`, `src\store\shellStore.ts`, `src\shell\TitleBar.tsx`, `src\shell\PanelBody.tsx`, `src\shell\useMaximizedState.ts`, `src-tauri\src\lib.rs`, `src-tauri\Cargo.toml`, `src-tauri\capabilities\default.json`, `package.json`, `vitest.config.ts` — direct codebase read, ground truth for what exists today

### Secondary (MEDIUM confidence)
- WebSearch: `CloseRequestApi` / `WindowEvent::CloseRequested` (docs.rs page existence + GitHub discussions #5334, issue #12334) — corroborates the prevent-then-flush pattern but no official worked example combining flush+close was directly fetched
- WebSearch: JS `onCloseRequested` usage pattern (v2.tauri.app JS API reference namespace pages, summarized not directly fetched)

### Tertiary (LOW confidence)
- Rust crate `tauri-plugin-store` exact version-lockstep claim — not independently queried against crates.io registry API this session (WebSearch summary only); resolve via `cargo add` at implementation time

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — plugin identity, JS version, and API surface directly confirmed via npm registry + official docs page
- Architecture: MEDIUM-HIGH — the unification/re-homing patterns are directly grounded in the existing codebase (HIGH); the close-flush hook's exact Rust call sequence is MEDIUM (no official worked example found)
- Pitfalls: HIGH — all four pitfalls are grounded in direct reads of existing code + project memory (maximize-frame-drop landmine, ownership boundary, debounce race), not speculative

**Research date:** 2026-07-09
**Valid until:** 2026-08-08 (30 days — stable first-party plugin API, unlikely to shift meaningfully in a month; re-check npm/crates versions if planning is delayed past that window)
