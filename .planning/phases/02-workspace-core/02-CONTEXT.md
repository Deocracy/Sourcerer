# Phase 2: Workspace Core - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers the **interactive dockable workspace** — the bespoke three-mode left rail
(expanded / compact / hidden) plus the **dockview-core** center dock (tabs, 5-zone docking, splits,
multi-instance panels, deterministic focus, clamp bounds). Requirements **RAIL-01, RAIL-02, RAIL-03,
DOCK-01..06**.

This phase also **reworks Phase 1 chrome** to the new `bespoke_rails_shell` handoff — a prerequisite
for rail/dock to render inside the correct frame: **40px** title bar (was 34px), **floating rounded
window** (Tauri `transparent:true`, 20px inset, radial backdrop, shadow, 10px inner card), green
`#86A38C` accent (demotes white `#E6E4DE` to primary text), and the title-bar **DIVI chip + corpus
label + rail-toggle SVG buttons**. It also introduces **Zustand** for the first time (deferred from
Phase 1 per P1 D-02) as the single shell store.

**Explicitly NOT in Phase 2** (scoped to later phases, not deferred ideation):
- Crash-safe / schema-versioned / named-layouts persistence + flush-on-close → **Phase 3** (PERS-01..04).
- The right-hand Dashboard Assistant rail chrome + resize/snap → **Phase 6** (same bespoke pattern applies later).
- The DIVI Home overlay / metro-card Home dashboard → **Phase 6** (the DIVI chip renders this phase but toggles nothing yet).
- Real applet bodies (Wiki/Library/Notes/etc.) → **Phase 4** demo stubs / **Phase 5** Notes. Phase 2 ships only the panel dispatcher + a generic placeholder body.
- Corpus-switcher *behavior* and badge-count *producing* logic → later applet phases. Phase 2 renders the corpus label + badge UI wired to a store slice (defaulting to 0 / hidden-if-zero).
</domain>

<decisions>
## Implementation Decisions

### Rail drag-to-dock fidelity (discussed — founder call)
- **D-01:** **Build the FULL 28%-zone preview drag-out, to UI-SPEC.** Dragging a rail item out past
  the rail's right edge into the workspace docks it as a new dockview panel with the complete bespoke
  UI: a floating ghost (glyph + title, `#131418` bg / `#26272B` border) following the cursor, and a
  green drop overlay (`rgba(134,163,140,0.18)` fill + accent border) with split zones at the outer
  **28%** of the target dockview group (left/right/top/bottom → `referenceGroup` + `direction` into
  `api.addPanel`) and center 44% = tab-join. Founder explicitly accepted this as the phase's
  highest-risk item to land it at full fidelity rather than MVP it.
  - **For researcher:** nail the bespoke↔dockview seam — how a bespoke pointer drag (off the rail,
    `setPointerCapture`) resolves a target dockview group + direction and calls `api.addPanel({...,
    position: { referenceGroup, direction }})` on dockview-core 2.0.0. Confirm dockview exposes the
    group hit-test / bounding rects needed to compute the 28% zones, or whether we compute them from
    `getBoundingClientRect` on dockview's rendered groups.
  - **For planner:** sequence this as its own slice with a working fallback path (drop resolves to a
    new tab if zone computation fails) so a fragile preview never blocks the rest of the phase from
    verifying.

### Claude's Discretion (defaulted — founder delegated: "you can figure them out")

- **D-02: Persistence boundary (P2 ↔ P3) — stay live, minimal fallback only.** Phase 2 keeps
  workspace state **live in Zustand** and wires **only** the dockview-native layout serialize/restore
  that DOCK-03's fallback requires: on mount, if there is no / empty / corrupt saved layout,
  auto-open **Wiki → Library** as the two default panels. It may persist the dockview layout to the
  placeholder key `localStorage['sourcerer-dockview-bespoke-v2']` with a 300ms debounce on
  `onDidLayoutChange` + a canary key guarding crash-on-restore (both specified in the UI-SPEC) purely
  as scaffolding. Phase 2 does **NOT** build the formal persistence contract — `schemaVersion`,
  migration path, named layouts (LAYOUTS menu), flush-on-close, `tauri-plugin-store`, or unified
  whole-workspace state (rail order/pins/widths + per-instance state). That is **Phase 3** (PERS-01..04).
  Rail mode/order/width/pins may persist trivially via zustand's own localStorage if the planner finds
  it near-free, but it is not a Phase 2 requirement. *(Rationale: stay-in-phase-boundary — don't pull
  Phase 3 work forward, but DOCK-03's corrupt-layout fallback genuinely needs restore-detection, so
  wire the minimal dockview-native path and nothing more.)*

- **D-03: Chrome rework staged FIRST, floating window as its own verified slice.** The token deltas +
  title-bar chrome land before rail/dock, because RAIL/DOCK chrome must render inside the correct
  40px/floating frame (UI-SPEC "Chrome Rework" calls it a prerequisite). Order: **(1)** update
  `tokens.css` chrome deltas (40px `--titlebar-h`, green `--color-accent`, all new `--window-*` /
  `--rail-*` / `--tab-*` vars) + rework the TitleBar (DIVI chip, corpus label, two rail-toggle SVG
  buttons — all chrome-only stubs this phase); **(2)** the Tauri `transparent:true` floating rounded
  window (20px inset, radial-gradient backdrop, shadow, 10px inner card) as its **own commit**, paired
  with a **re-verify of Phase 1's DPI (100/125/150%) + title-bar drag** — transparent/decoration
  changes can regress both, and Phase 1 just verified them. Do the full floating window this phase
  (roadmap scopes it to Phase 2).
  - **For researcher:** Tauri 2 `transparent:true` + `decorations:false` interaction on Windows 11;
    whether the OS-level radial backdrop lives on `html/body` inside the inset vs a Tauri window
    background; and whether `transparent:true` reintroduces the shadow/drag caveats from Phase 1.

- **D-04: Requirement text vs UI-SPEC — dockview-native supersedes bespoke docking.** The
  ROADMAP/REQUIREMENTS literal "**5px resizers**" and "prototype's **preview UI**" for the *center
  dock* are superseded by the UI-SPEC: **dockview-core owns tabs, splits, resizers, and 5-zone
  docking natively** (theme via `--dv-*`, do not reimplement). DOCK-02 / DOCK-03 verify against
  dockview's themed native behavior — the "5px resizer" figure is a pre-dockview holdover; defer to
  dockview's actual resizer hit-area (verify against `dockview-core@2.0.0` once installed, don't
  invent a px value). The bespoke **preview UI survives ONLY for the rail drag-OUT** (D-01, the
  28%-zone green overlay) — dockview's internal docking preview is the library's own.
  - **For verifier:** do not mark DOCK-02/03 unmet for lacking a bespoke "5px resizer" or a
    hand-rolled center-dock preview — that reimplementation is explicitly rejected by the UI-SPEC.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract (LOCKED — pixel-perfect, recreate exactly)
- `.planning/phases/02-workspace-core/02-UI-SPEC.md` — **the authoritative visual/interaction contract
  for this phase.** Locks: RAIL-01..03 + DOCK-01..06 geometry, drag thresholds (5px start, CLOSE_AT
  44px, COMPACT_AT 132px, clamp [132,520]), the Chrome Rework token table + full `tokens.css` delta,
  the `.sourcerer-dock` → dockview `--dv-*` theme map, applet order array, and the copywriting/fallback
  contract. **Read this first.**
- `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/` (folder — name contains spaces, so
  link the folder and name files in text) — the adopted source-of-truth handoff (supersedes the old
  `design_handoff_sourcerer_tauri`). Key files:
  - `Sourcerer Bespoke Rails.dc.html` — prototype markup + the **pointer-event algorithms to port**
    (`startRailResize`, `startDockDrag`, rail hit-test / snap logic). Verified refs: wordmark weight
    600 (line 67), DIVI chip weight 500 (line 68), badge digit weight 600 (line 111).
  - `store.js` — the Zustand shape porting reference (railMode 3-state cycle, railOpen, leftRailPinned,
    activeCorpus, selection, reviewCount). Prototype uses zustand 4.5.5 vanilla `createStore` on a CDN
    import — swap for the locked `zustand/vanilla` 5.0.14 package import (patterns compatible).
  - `README.md` — handoff overview. `wiki.js` / `library.js` / `settings.js` / `home-cards.js` — applet
    mount references (mostly Phase 4+; not built this phase).

### Stack & constraints
- `CLAUDE.md` (project root) — stack lock: **dockview-core** (center, adopt-then-theme), **bespoke
  pointer events** (rail only), **Zustand 5.0.14** (single shell store, introduced this phase),
  **nanoid** for stable per-instance ids (DOCK-04), CSS Modules + single `tokens.css`, IBM Plex bundled
  locally (no runtime Google Fonts). "What NOT to Use": no component lib / Tailwind / generic DnD lib.
  Also the `cargo run` vs `cargo tauri dev` launch landmine and Tauri `transparent:true` note.
- `.planning/REQUIREMENTS.md` §RAIL/DOCK + the 2026-07-07 design-supersession banner.
- `.planning/ROADMAP.md` §"Phase 2: Workspace Core" — goal, 5 success criteria, design note.

### Prior phase decisions
- `.planning/phases/01-shell-foundation/01-CONTEXT.md` — P1 decisions that constrain this phase:
  D-01 (`tokens.css` already seeded with the **full** token set — update chrome deltas, don't
  recreate), D-02 (Zustand deferred to **Phase 2** — lands now), D-03 (React 18.2 pin, scaffold's Vite,
  Fontsource per-weight imports).

### Existing code to rework (read before editing)
- `src/styles/tokens.css` — full token set already authored; update the D-03 chrome-delta vars.
- `src/app/AppShell.tsx` + `src/app/AppShell.module.css` — the grid mount point, still `34px 1fr`;
  rework to 40px + become the titlebar / [rail | dock] layout.
- `src/shell/TitleBar.tsx` + `src/shell/TitleBar.module.css` — rework to DIVI chip + corpus label +
  rail-toggle buttons.
- `src/shell/useMaximizedState.ts` — the Tauri window-event pattern to mirror for rail-toggle wiring.
- `src-tauri/tauri.conf.json` — add `transparent: true` for the floating window (D-03).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`tokens.css`** — the entire UI-SPEC token set is already authored (P1 D-01). Phase 2 only edits the
  chrome-delta + adds `--rail-*` / `--tab-*` / `--dv-*`-adjacent vars. Do not recreate.
- **`AppShell` grid** — the `1fr` body row is the mount point; rail + dockview fill it. TitleBar is
  extended, not rebuilt.
- **`fonts.ts`** — IBM Plex Sans/Mono/Serif already bundled locally (400/500/600 sans covers the
  wordmark/chip/badge weights the UI-SPEC's typography exemption requires).
- **`useMaximizedState.ts`** — established pattern for driving UI off Tauri window events; reuse the
  shape for rail-toggle / keyboard wiring.

### New dependencies to add (all locked in CLAUDE.md)
- `dockview-core@2.0.0` (`npm install dockview-core`) — not yet in package.json.
- `zustand@5.0.14` — first use; `zustand/vanilla` so the store works inside and outside React.
- `nanoid` — stable per-instance panel ids (`key:{nanoid}`) for DOCK-04.

### Established Patterns
- **Bespoke pointer events** (`pointerdown/move/up` + `setPointerCapture`) for rail resize + drag-out —
  port from the `.dc.html` prototype. **Do NOT** hand-roll center-dock chrome — theme dockview via
  `.sourcerer-dock` on top of the `dockview-theme-abyss` base (D-04).
- **CSS Modules + `tokens.css`** styling; **static ES-module registry** pattern for applets (Phase 4).

### Integration Points
- The dockview instance fills the center grid column (`position:absolute; inset:0`); the rail is a
  bespoke left column; the AppShell grid becomes `titlebar / [rail | dock]` (exact grid = planner's
  call).
- **DOCK-05 focus:** consume dockview's `onDidActivePanelChange` as the single source of truth for the
  focused pane — no bespoke focus tracking.
- **Panel body dispatch:** `makeRenderer` maps applet key → mount fn; Phase 2 builds only the
  dispatcher + the generic placeholder body (glyph + title + desc + dashed note box) so Phase 4 has a
  proven mounting seam.
- The rail drag-OUT (D-01) is the one seam bridging bespoke pointer logic and dockview's `api.addPanel`.

</code_context>

<specifics>
## Specific Ideas

- Founder confirmed the phase is intentionally UI-SPEC-cleared (like Phase 1) and delegated all
  implementation calls to the builder **except** the one genuine appetite question: rail drag-out
  fidelity — chosen **full 28%-zone preview, to spec** (D-01), explicitly accepting it as the phase's
  highest-risk item rather than MVP-ing it. No other "I want it like X" overrides beyond what the
  UI-SPEC already locks.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Everything adjacent that came up (crash-safe/named-layout
persistence, right assistant rail, DIVI Home overlay + metro dashboard, real applet bodies,
corpus-switcher behavior) is already scoped to Phases 3/4/5/6 by the roadmap and UI-SPEC — not deferred
ideation.

</deferred>

---

*Phase: 2-workspace-core*
*Context gathered: 2026-07-07*
