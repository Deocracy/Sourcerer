# Phase 3: Persistence & Layouts - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers the **formal persistence contract** the shell has so far only stubbed:
the workspace remembers itself crash-safely, survives schema drift, and gains named layouts.
Requirements **PERS-01..04**.

Concretely, Phase 3 unifies the two Phase-2 localStorage scaffolds (rail state +
dockview layout) into **one whole-workspace record** on `@tauri-apps/plugin-store`,
carrying a `schemaVersion` + migration seam, a corrupt/stale fallback to the default
workspace, debounced writes flushed on window close, and a **LAYOUTS menu** for
save/apply/delete named layouts + reset.

**Explicitly NOT in Phase 3** (scoped elsewhere, not deferred ideation):
- Real applet bodies / demo stubs / the applet registry → **Phase 4** (FWK-01..04). Phase 3
  persists the plumbing; unknown applet keys render the existing generic placeholder.
- Per-instance applet *state producers/consumers* → **Phase 5** (Notes). Phase 3 builds the
  empty per-instance slot in the schema; nothing fills it yet.
- The Home dashboard / metro cards → **Phase 6**. Phase 3's fallbacks target the current
  Wiki+Library default, not Home.
- A general toast/notification system → out of scope. The corrupt-reset notice is one
  minimal, self-contained dismissible element, not shared infra.
- Pixel-perfect styling of the LAYOUTS menu → the **`/gsd-ui-phase 3`** pass owns exact
  chrome (roadmap flags "UI hint: yes"). Phase 3 locks placement + behavior only.

</domain>

<decisions>
## Implementation Decisions

### LAYOUTS menu (PERS-02) — net-new UI, no design-handoff reference
The `bespoke_rails_shell` handoff does **not** spec a LAYOUTS menu or any named-layouts
concept — the prototype only ever did the single auto-saved dockview layout. This is a
founder-defined surface; `/gsd-ui-phase 3` pixel-specs it later.

- **D-01: Placement — title-bar dropdown.** A `LAYOUTS ▾` text button in the title-bar
  **right cluster** (before the two rail-toggle SVG buttons), opening a dropdown: the list of
  saved layouts (apply on click, delete affordance per row), plus `Save current…` and
  `Reset`. Consistent with the existing wordmark/DIVI-chip/corpus-label chrome language.
  Exact styling/metrics deferred to `/gsd-ui-phase 3`; placement + behavior are locked here.
- **D-02: A named layout captures the WHOLE workspace** — dock tree + open tabs/instances +
  rail order/pins/mode/width + panel widths (+ the per-instance slot from D-09). Applying a
  layout restores the entire arrangement. Matches PERS-01's unified record.
- **D-03: "Reset to single pane" restores the current Wiki+Library default.** PERS-02's
  literal "single pane" is interpreted as "reset to the default workspace." The reset baseline
  is deliberately the **same** baseline as the corrupt/stale fallback (D-05) — one default,
  reused everywhere. Reset does not touch saved named layouts.

### Corrupt / stale fallback (PERS-03)
- **D-04: On reset, show a minimal one-time notice.** When persisted state is corrupt or from
  an unmigratable schema version and the shell falls back to the default, surface a small
  **non-blocking, dismissible inline notice** ("Workspace was reset after a problem loading
  your layout"). NOT silent. This is a single self-contained element — the shell has no
  toast/notification system and Phase 3 does not build one. A console warning is also logged.
- **D-05: The "default workspace" = Wiki + Library** (today's Phase-2 two-panel default).
  Same baseline as D-03's reset target.
- **D-06: Missing applet key → generic placeholder, keep the pane.** If a restored layout
  references an applet key that doesn't exist, render the **existing Phase-2 generic
  `PanelBody` placeholder** (showing the unknown key), preserving the pane so one bad key
  never destroys the surrounding layout/splits. PERS-03 literally.

### Schema versioning & migration (PERS-03 / PERS-04)
- **D-07: `schemaVersion` + a migration seam; discard-to-default on failure.** The record
  carries a `schemaVersion` (starts at 1) and a **registry of version→version migrators**
  (empty at v1 — nothing to migrate yet). On load: if versions differ, run applicable
  migrators; if none apply or a migrator throws, **discard and load the default** (with D-04's
  notice). Never crash, never load a half-migrated tree. This satisfies PERS-03's "migration
  path carried" without building migrators that have nothing to migrate.
  - **For researcher/planner:** do NOT over-build the migrator framework — one typed
    `migrators: Record<number, (old) => next>` map + a runner loop is enough. The value here is
    the *seam*, so Phase 4/5 can add a migrator instead of a breaking change.
- **D-08: One rolling `.bak` before any destructive reset.** Before discarding/resetting
  corrupt or unmigratable state, copy it to a single last-known-good backup (e.g.
  `workspace.json.bak`), overwritten each time. Cheap insurance against an upgrade silently
  destroying a real workspace; manually recoverable. One file, not a history.

### Storage backend & shape (PERS-01 / PERS-04)
- **D-09: One unified whole-workspace record on `@tauri-apps/plugin-store`.** Adopt the plugin
  (JS `@tauri-apps/plugin-store` 2.4.3 + the Rust `tauri-plugin-store` crate — per CLAUDE.md
  stack lock) and write **one** versioned record containing dock tree + rail
  order/pins/mode/width + panel widths + a **per-instance-state slot** keyed by `instanceId`
  (empty until Phase 5). Replaces BOTH Phase-2 localStorage scaffolds
  (`sourcerer-shell-store-v1`, `sourcerer-dockview-bespoke-v2`). One atomic write makes
  flush-on-close (PERS-04) trivial. Existing localStorage scaffold data is **abandoned** (it's
  dev-only) — no migration from localStorage; fresh start on the plugin-store file.
- **D-10: Build the per-instance-state slot now, empty.** Include the `instanceId`-keyed slot
  in the v1 schema and carry it through save/restore even though nothing writes to it until
  Phase 5 Notes. Since schema versioning is being built this phase, adding the slot now avoids
  a future schema bump. No producer/consumer built this phase.

### Behavior to preserve (carried from Phase 2, D-02)
- The **canary-guarded restore** + **300ms debounced** save + **Wiki/Library default** already
  in `Dock.tsx` are the behavioral seed. Phase 3 lifts this logic OUT of localStorage into the
  unified plugin-store record and generalizes it to the whole workspace — it does not discard
  the canary/debounce approach, it re-homes it.

### Claude's Discretion (defaulted)
- Exact plugin-store file name(s)/dir, the Rust-vs-JS split for the flush-on-close hook, the
  debounce interval (300ms is the established seed — keep unless research shows better), the
  migrator runner's internal shape, and how the flush binds to the Tauri window-close/
  `onCloseRequested` event are all left to research + planning.
- Whether rail state persists via zustand's own path or is folded into the unified record's
  write is an implementation detail — the *record* is unified (D-09); the write mechanism is
  the planner's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §Persistence (PERS) — PERS-01..04 verbatim + the 2026-07-07
  design-supersession banner.
- `.planning/ROADMAP.md` §"Phase 3: Persistence & Layouts" — goal + 4 success criteria.

### Stack lock (persistence backend)
- `CLAUDE.md` (project root) — mandates `@tauri-apps/plugin-store` (2.4.3 JS + `tauri-plugin-store`
  Rust crate) as the persistence layer, one store file per logical concern, keyed as
  `sourcerer:<key>:<k>`; explicitly rejects raw `localStorage` for real persistence (webview-scoped,
  lost on profile reset, no OS app-data conventions). Also the `cargo run` vs `cargo tauri dev`
  launch landmine and version-compatibility table (keep JS plugin + Rust crate in lockstep).

### Existing code to re-home / reuse (read before editing)
- `src/shell/Dock.tsx` — the Phase-2 dockview persistence seam: canary key, 300ms debounce,
  `api.toJSON()`/`api.fromJSON()`, Wiki/Library default, `onDidLayoutChange`. This logic is
  **lifted into the unified record**, not rewritten from scratch. `LAYOUT_KEY` /
  `CANARY_KEY` / `getDockGroupRects` / `addAppletToDock` live here.
- `src/store/shellStore.ts` — the Zustand shell store persisting the rail subset
  (`railMode/railWidth/railOrder/leftRailPinned`) to `localStorage['sourcerer-shell-store-v1']`
  via `load()`/`persist()`. Phase 3 redirects this into the unified plugin-store record.
- `src/shell/PanelBody.tsx` (`makeRenderer`) — the generic placeholder body reused for
  missing applet keys (D-06).
- `src/shell/TitleBar.tsx` + `src/shell/TitleBar.module.css` — the title-bar right cluster the
  `LAYOUTS ▾` dropdown (D-01) mounts into.
- `src-tauri/tauri.conf.json` + `src-tauri/src/` — where the `tauri-plugin-store` Rust plugin
  registers and where a window-close flush hook (PERS-04) would bind.

### Prior-phase decisions that constrain this phase
- `.planning/phases/02-workspace-core/02-CONTEXT.md` — **D-02** (this phase's charter: schemaVersion,
  migration, named layouts, LAYOUTS menu, flush-on-close, plugin-store, unified whole-workspace
  state were ALL deferred from Phase 2 to here; the canary/debounce/default was shipped as the seed).
  D-04 (dockview owns tabs/splits/resizers natively — its layout is captured via `toJSON`).

### Design contract (for the /gsd-ui-phase 3 pass, not the persistence logic)
- `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/` (folder — name has spaces, link the
  folder and name files in text): `README.md` (title-bar chrome spec — confirms NO layouts menu
  exists, so D-01 is net-new); `Sourcerer Bespoke Rails.dc.html` (the canary/debounce
  `LAYOUT_KEY` prototype logic Phase 2 ported). The handoff is the styling reference for the new
  `LAYOUTS ▾` dropdown; it does NOT contain a layouts design to recreate.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`Dock.tsx` persistence block** (lines ~129–186): canary-guarded restore + 300ms debounced
  `toJSON` save + Wiki/Library default. The behavioral seed to generalize into the unified
  record — reuse the approach, re-home the storage target.
- **`shellStore.ts` `load()`/`persist()`**: the rail-subset persist pattern; redirect its target
  from `localStorage` to the unified plugin-store record.
- **`PanelBody.tsx` `makeRenderer`**: generic placeholder body — directly reused for missing
  applet keys (D-06), no new component needed.
- **`useMaximizedState.ts`** (Phase 1/2): the established pattern for driving UI off Tauri
  window events — the reference for wiring PERS-04's flush-on-window-close hook.

### Established Patterns
- **Best-effort try/catch persistence** (T-02-01 mitigation): parsing untrusted persisted state
  never crashes the shell — already the norm in both `Dock.tsx` and `shellStore.ts`; Phase 3's
  fallback (D-04..D-07) formalizes it.
- **Debounce coalescing** (300ms) on layout change — established; keep as the seed interval.
- **Vanilla Zustand store + `useStore` selector binding** — the shell-state substrate the
  unified record reads from / writes to.

### Integration Points
- `src-tauri` plugin registration (`tauri-plugin-store`) + a `WindowEvent::CloseRequested` /
  `onCloseRequested` flush hook — the new backend surface (PERS-04).
- Title-bar right cluster in `TitleBar.tsx` — LAYOUTS dropdown mount (D-01).
- The single dockview instance handle (`dockApiRef` in `Dock.tsx`) — `toJSON`/`fromJSON` are the
  dock-tree capture/restore path feeding the unified record.

</code_context>

<specifics>
## Specific Ideas

- Reset target and corrupt-fallback default are deliberately the **same** baseline (Wiki+Library)
  — one "default workspace" definition reused for D-03 and D-05.
- The migration *seam* matters more than any migrator — v1 ships an empty migrator registry;
  the point is that Phase 4/5 add a migrator, never a breaking rewrite.
- LAYOUTS menu is behavior-locked here, pixel-locked later via `/gsd-ui-phase 3`.

</specifics>

<deferred>
## Deferred Ideas

- **Toast/notification system** — the corrupt-reset notice (D-04) is one self-contained element;
  a general notification framework is out of scope, revisit if later phases need cross-cutting toasts.
- **Layout backup history** — D-08 keeps ONE rolling `.bak`; a multi-version history / undo of
  layout changes is not scoped.
- **Import/export named layouts** (share a layout file between machines) — plausible future, not
  in PERS-01..04.
- **Per-corpus default layouts** (a layout auto-applied when switching corpus) — corpus-switcher
  behavior is a later applet-phase concern; not Phase 3.

</deferred>

---

*Phase: 3-persistence-layouts*
*Context gathered: 2026-07-09*
