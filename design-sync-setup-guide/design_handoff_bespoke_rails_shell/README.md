# Handoff: Sourcerer — Bespoke Rails Shell

## Overview
The desktop application shell for **Sourcerer**, a corpus research tool (Ficino/Renaissance
scholarship domain). This is the top-level workspace chrome: a custom **left applet rail**, a
**dockview-powered workspace** in the center (tabbed/splittable applet panels), and a bespoke
**right rail** holding the "Divi" dashboard assistant (chat with the agent, session switching,
model/effort pickers). Rails are hand-built and live *outside* the docking engine — dockview owns
only the center column — which is the defining architectural choice of this variant.

It targets a **Tauri** desktop window (custom title bar with minimize/maximize/close, drag region).

## About the Design Files
The files in this bundle are **design references created in HTML/JS** — a running prototype showing
intended look and behavior, **not production code to ship directly**. The prototype is authored as a
"Design Component" (`.dc.html`) that runs in a bespoke in-browser runtime (`support.js`), which is
**not** part of your target stack.

Your task is to **recreate these designs in Sourcerer's real codebase** using its established
framework and patterns. If a codebase already exists (React/Tauri is implied by the prototype),
follow its component and state conventions. If no environment exists yet, choose the most
appropriate stack — a React + Tauri desktop app matches the prototype's assumptions (it already uses
React 18, dockview-core, zustand, and dnd-kit via ESM).

The prototype's own logic (the `class Component extends DCLogic` block in the `.dc.html`) is written
against the prototype runtime. **Read it for behavior and measurements; do not copy it verbatim.**
The plain `.js` modules (`store.js`, `home-cards.js`, `wiki.js`, `library.js`, `settings.js`) are
much closer to real code — they use standard React 18 + zustand and can largely be ported directly,
swapping the ESM CDN imports for your bundler's package imports.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, iconography, and interactions. Recreate
pixel-accurately using exact values below.

## Tech Stack (as prototyped)
- **React 18.3.1** — applet bodies (`wiki.js`, `library.js`, `home-cards.js`) render via `createRoot`.
- **dockview-core 2.0.0** — the center workspace (tabs, splits, drag-to-dock, persisted layout).
  The prototype imports it from `https://cdn.jsdelivr.net/npm/dockview-core@2.0.0/+esm` and its CSS
  from the matching `/dist/styles/dockview.css`. Install `dockview-core` from npm in your app.
- **zustand 4.5.5** (vanilla `createStore`) — cross-applet shared state. See `store.js`.
- **@dnd-kit** (`core` 6.1.0, `sortable` 8.0.0, `utilities` 3.2.2) — Home dashboard card drag/reorder.
- **IBM Plex Mono / Serif / Sans** (Google Fonts) — the entire type system.
- **Tauri** window APIs (`window.__TAURI__.window.getCurrentWindow()`) for min/max/close.

## Design Tokens

### Colors (exact hex)
- App background (deepest): `#0A0A0B`
- Panel: `#131418`
- Panel-2 (inputs, recessed): `#0F1013`
- Line / border: `#1E1F22`
- Line-2 (stronger border): `#26272B`
- Dim border (hover): `#3A3B40`
- Text (primary): `#E6E4DE`
- Text secondary: `#C5C2BA`
- Muted: `#A5A29A`
- Faint (labels, captions): `#6E6C66`
- Accent (green): `#86A38C`  — hover/light `#A3BCA8`
- Accent alt options (theme prop): `#8C99A3` (blue-grey), `#A3948C` (warm)
- Amber / warning: `#D8C69C`, amber bg `#1E1C17`
- Avatar chip bg: `#1A1B1E`
- Close-button red (window control): `#C42B1C`
- Outer window backdrop: `radial-gradient(120% 120% at 50% -10%, #0E0F12 0%, #050506 60%, #030304 100%)`

### Typography
- **IBM Plex Sans** — UI body, labels, buttons. Weights 400/500/600. Base size 13px.
- **IBM Plex Mono** — codes, small caps labels, badges, glyph icons, model pickers.
  Letter-spacing 0.04–0.18em on labels; uppercase for section headers.
- **IBM Plex Serif** — applet titles (26px), assistant proposal quotes (italic 14px), avatar initial.
- Google Fonts link: `family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Serif:ital,wght@0,400;0,500;1,400&family=IBM+Plex+Sans:wght@400;500;600&display=swap`

### Spacing / geometry
- Outer window inset padding: 20px; window border-radius 10px; 1px `#1E1F22` border.
- Window shadow: `0 24px 70px -10px rgba(0,0,0,0.75), 0 4px 14px rgba(0,0,0,0.5)`.
- Title bar height: 40px. Window-control buttons 46px wide; rail-toggle buttons 36px.
- Scrollbars: 3px wide, thumb `#1A1B1E` (hover `#26272B`), transparent track.
- Rail row height: 36px (expanded), 40×40 icon tiles (compact).
- Active rail item: 2px left border in accent, bg `#131418`/`#1E1F22`.

### Left-rail width states (px)
- `HIDDEN_W` = 6 (a 6px reopen strip)
- `COMPACT_W` = 56 (icons only)
- Expanded default = 220 (resizable up to 520)
- Snap thresholds while dragging: below `CLOSE_AT` (44) → hidden; below `COMPACT_AT` (132) → compact; else expanded.

### Right-rail width states (px)
- Default open width = 280 (resizable). Closed → 6px strip.
- `FULL_AT` = 620: dragging the edge past this shows a "LET GO TO SNAP" ghost; release → full-screen assistant (workspace hidden, grid becomes `0px 0px 1fr`).
- Below 180px on release → snaps closed.

## Screens / Views

### 1. Shell frame (top level)
- **Layout**: `position:fixed; inset:0` backdrop → single rounded window card
  (`grid-template-rows: 40px 1fr`). Row 1 = title bar. Row 2 = body.
- **Body grid**: `grid-template-columns: {leftW}px minmax(0,1fr) {rightW}px` — left rail, dockview
  workspace, right rail. When right rail is full-screen the columns collapse to `0px 0px 1fr`.

- **Title bar** (`data-tauri-drag-region`, `-webkit-app-region: drag`): left cluster has the
  "Sourcerer" wordmark (Plex Sans 12px/600), a **DIVI** toggle chip (Plex Mono 11px; active = accent
  border + `rgba(134,163,140,0.14)` bg + accent text; inactive = `#26272B` border, muted text), and
  `— {corpus name}` in faint mono. Right cluster: two rail-toggle SVG buttons (16×12 rectangles that
  fill to show rail state), then Minimize (11×1px bar), Maximize (9×9px square outline), Close (✕,
  hover bg `#C42B1C`). All interactive controls carry class `no-drag` / `win-ctl`.

### 2. Left applet rail (bespoke)
Three render modes driven by `railMode` (`expanded` | `compact` | `hidden`), cycled by the toggle
or ⌘\ / Ctrl+\.
- **Expanded**: vertical list of applet rows — 26px glyph column (Plex Mono 18px) + label (Plex Sans
  13px, ellipsis) + optional badge (e.g. Wiki review count in muted). Footer: "Applet Catalog" row,
  then a user block (avatar "C" serif italic, "Casey / HUMAN", settings gear).
- **Compact**: 40×40 centered glyph tiles; badge as a 12px `#A5A29A` pill top-right. Footer: catalog
  ◍, settings ⚙, avatar.
- **Hidden**: 6px hover strip that reopens the rail on click.
- **Resize handle**: 6px col-resize strip on the right edge; hover `rgba(230,228,222,0.28)`; double-click cycles mode.
- **Applet order**: `['Sources','Library','Wiki','Graph','Chat','Writing','Browser','Kanban','News','KeyPass','Builder','Dadabase','Notes']`. Each has a glyph + title + one-line description (see `defs` map in the DC).
- **Drag behavior**: mousedown+drag a row → within the rail = **reorder** (drop-line indicator
  between rows); drag *out into the workspace* = **dock a new panel** (green drop overlay,
  `rgba(134,163,140,0.18)` fill + accent border, split zones at the 28% edges → left/right/top/bottom
  of the target group). Plain click (no movement) = open/focus that applet.

### 3. Center workspace (dockview)
- A single dockview instance fills the center column (`position:absolute; inset:0`). Theme is the
  custom `.sourcerer-dock` variable set (see the `<style>` block for the full `--dv-*` mapping —
  dark tabs `#0F1013`, active tab bg `#0A0A0B`, mono tab font, accent drag-over color).
- Tab height 34px, 12px mono tabs. Tabs container hides its scrollbar.
- **Layout persistence**: serialized to `localStorage['sourcerer-dockview-bespoke-v2']` on every
  layout change (300ms debounce), restored on load. A "canary" key guards against a corrupt layout
  crashing the restore (if the canary survives a reload, the saved layout is dropped).
- **Default panels** when nothing is saved: opens `Wiki` then `Library`.
- **Panel bodies** are created per applet key by `makeRenderer`:
  - `Home` → `home-cards.js` `mountHome(el, ctx)`
  - `Wiki` → `wiki.js` `mountWiki(el, ctx)`
  - `Library` → `library.js` `mountLibrary(el, ctx)`
  - `Settings` → `settings.js` `mountSettings(el, ctx)`
  - everything else → a generic placeholder body (glyph + title + description + a dashed note box).
  - `ctx.open(key)` lets a panel deep-link to open another applet.
- **Divi overlay**: when the DIVI toggle is on, the Home dashboard is mounted in an overlay
  (`z-index:55`) covering the workspace column only. Opening an applet from the dashboard hides the
  overlay to reveal the workspace.
- Loading/failure states render a centered mono message ("LOADING…", "DOCKVIEW FAILED TO LOAD").

### 4. Right rail — Divi dashboard assistant (bespoke)
`grid-template-rows: 44px auto 1fr auto` (header · history · thread · composer).
- **Header (44px)**: horizontally scrollable **session chips** (26×26, Roman-numeral labels I, II,
  III…; active = `#1E1F22` bg + `#3A3B40` border; closable chips get a × badge top-right; running
  sessions get a status dot and can't be closed). Right side: history toggle (clock SVG) and
  new-assistant (+) buttons.
- **History panel** (collapsible): list of sessions with title + meta + state label
  (ACTIVE/RUNNING/PAUSED/IDLE), active row bg `#1E1F22` with muted left border.
- **Thread (1fr, scrolls)**: message bubbles — user messages right-aligned, `#1E1F22` bg, 9×12px
  padding, max-width 90%; assistant messages full-width transparent, text `#C5C2BA`, 13px/1.55.
  Session 0 shows a **proposal card**: intro line referencing "§ Poliziano", a serif-italic quoted
  edit on `#1A1B1E`, and a mono action row `[y] approve · [d] diff · [n] reject · 2 downstream`.
  Approve/reject append a confirmation message and clear the proposal.
- **Composer (auto)**: input box (`#0F1013`, border brightens to `#33343A` when non-empty) with a
  send button (fills to `#E6E4DE`/dark icon when text present, else `#1E1F22`/faint). Below it, a
  right-aligned mono control row: **model picker** (◈ accent dot + model name + ▾, opens a 260px
  search-filtered popover of Bedrock models: Fable 5 Global/US, Opus 4.8/US, Sonnet 4.6/5) and an
  **effort picker** (Low/Medium/High popover). Both popovers open upward.
- **Resize / snap**: 6px handle on the left edge. Drag to resize; drag narrow (<180) → close; drag
  past `FULL_AT` (620) → snap to full screen (ghost cue). When closed, the rail becomes a thin strip
  (click or drag to reopen).

## Interactions & Behavior
- **Left rail toggle**: click cycles expanded → compact → hidden; keyboard ⌘\ / Ctrl+\.
- **Right rail toggle** (title-bar button): "bounces" closed ↔ part-open ↔ full-screen without
  wrapping (direction reverses at each end).
- **Rail item drag**: 5px movement threshold before a drag starts; a floating ghost (glyph + title)
  follows the cursor; reorder uses `arrayMove`-style splice on `railOrder`; docking calls
  `api.addPanel({ position: { referenceGroup, direction } })`.
- **Corpus switcher**: clicking the corpus label cycles the active corpus (re-scopes the app via the
  store); title bar reflects the active corpus name.
- **Session management**: new-assistant creates a fresh thread; chips select/close sessions; running
  sessions are protected from closing.
- **Transitions**: drop overlay animates `all 90ms ease`; hover states are instant background/opacity
  changes. No long animations — the feel is crisp/desktop-native.

## State Management (`store.js`, zustand)
Cross-applet state, persisted to `localStorage['sourcerer-shell-store-v1']`:
- `corpora[]` + `activeCorpus` / `setCorpus(id)` — 3 seeded corpora (Ficino, Medici, Scratch) with tier/docs/conflicts.
- `railApplet` / `setRailApplet(key)` — which applet the rail context follows.
- `railMode` (`expanded|compact|hidden`) + `setRailMode` / `cycleRailMode`.
- `railOpen`, `rightRailOpen` + toggles.
- `leftRailPinned`, `rightRailPinned` + toggles — pinned = rail keeps view; unpinned = follows context.
- `selection` per applet (selected doc / entity / conversation) + `select(applet, id)`.
- `reviewCount` + `setReviewCount(n)` — surfaced as the Wiki badge and Home CTA.

The shell's own view state (drag state, live widths, session threads, picker indices) is local
component state in the prototype — model it as component/UI state in your app, not global store.

## Applet module notes
- **`home-cards.js`** — Divi Home dashboard. React + dnd-kit sortable card grid. Exports
  `mountHome(el, ctx)`. Rich `cardDefs` registry (corpus, dissertation, entity, graph, contradiction,
  timeline, excerpt, ingestion progress, spark/metric variants, etc.) with a `span` (1 or 2 columns),
  `kind` label, `title`, `foot`, and a `to` applet target. Card order persists to
  `localStorage['sourcerer-home-cards-v2']`.
- **`wiki.js`** — Wiki applet. Canonical articles with provenance and a first-class **Unresolved**
  block (a hard requirement — never fabricate an answer; render the unresolved state explicitly).
  Reads selection + review count from the store.
- **`library.js`** — Library applet. Corpus/document tree, ingest, document detail, trust flags.
- **`settings.js`** — Settings applet. Providers & keys, corpus tiers, identity, agent access, appearance.

## Assets
No raster/image assets. All iconography is Unicode glyphs rendered in IBM Plex Mono
(◉ ▥ ¶ ⊹ ≋ ◆ ✎ ◎ ◈ ⚷ ⊞ ▦ ✳ ◍ ⚙ ◈) plus a few inline SVGs (history clock, plus, send arrow,
search, rail-state rectangles). Recreate icons with your icon system or keep the glyphs. Fonts come
from Google Fonts (IBM Plex family).

## Files in this bundle
- `Sourcerer Bespoke Rails.dc.html` — the shell prototype (structure + all shell behavior/measurements).
- `store.js` — zustand shared-state store (portable).
- `home-cards.js` — Divi Home dashboard (React + dnd-kit).
- `wiki.js` — Wiki applet (React).
- `library.js` — Library applet (React).
- `settings.js` — Settings applet (React).

> The `.dc.html` also references `support.js` (the prototype runtime) — intentionally **not**
> included; it is not part of your target stack. Ignore the `<x-dc>`, `<helmet>`, `{{ … }}` template
> holes, `sc-if`/`sc-for`, and `DCLogic` — these are prototype-runtime constructs. Translate them to
> your framework: template holes are just bound values, `sc-for` is a `.map()`, `sc-if` is a
> conditional render.
