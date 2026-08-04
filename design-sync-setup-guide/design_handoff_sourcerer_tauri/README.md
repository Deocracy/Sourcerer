# Handoff: Sourcerer — Tauri Desktop Application

## Overview
Sourcerer is a research workbench for scholars: a dockable multi-pane desktop shell hosting **applets** (Library, Wiki, Graph, Chat, Writing Studio, Power Browser, Kanban, News, KeyPass, Databasise, Applet Builder…) plus a persistent right-hand **Dashboard Assistant** (AI chat). The goal of this handoff is to stand the shell up as a **Tauri 2 desktop application** in which applets are implemented one at a time — every applet the team hasn't built yet keeps rendering as a demo stub, exactly as in the prototype.

## About the Design Files
Everything in `reference/` is a **design reference created in HTML** — a working prototype showing intended look and behavior, NOT production code to copy directly. `Working Sourcerer UX UI Prototype.dc.html` + `support.js` open together in any browser and are fully interactive: use them as the behavioral spec. The task is to **recreate this design in a Tauri 2 app** with a proper frontend stack.

- The prototype's workspace/dock/rail logic is plain React (`React.createElement`) inside the file's `<script data-dc-script>` block — its algorithms (dock tree, hit-testing, drag behaviors) are sound and can be ported nearly 1:1 into real React components.
- The `reference/applets/` folder is the **applet plugin framework** already proven in the prototype (`registry.js`, `Notes.js`, `_TemplateApplet.js`, `README.md`). Preserve its contract; port the module shape to the real stack.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and interactions are final. Recreate pixel-perfectly.

## Recommended Stack
- **Tauri 2** (Rust backend), single main window, `decorations: false` (the design has its own title bar).
- **React 18 + Vite + TypeScript** frontend. No component library — the design is bespoke; styling via inline styles or CSS-in-JS matching the tokens below. No rounded corners anywhere.
- Persistence: `tauri-plugin-store` (JSON) to start — it maps 1:1 onto the prototype's `host.storage` API. Graduate to SQLite (`tauri-plugin-sql`) when applets need real data.
- AI: the frontend must only ever call `host.ai()`. Implement it as a Tauri command that proxies to whatever agent/backend is chosen later (undecided at handoff time). Keep this seam intact.

## Application Shell (single window, ref 1440×900, resizable)
Grid rows: **34px title bar / 1fr body**. Body grid columns: **left rail / workspace / assistant** (widths are state, see Interactions).

### Title bar (34px, `#0A0A0B`, bottom border `#1E1F22`)
- Left: logo (15px circle outline + 5px dot, `#E6E4DE`) + "Sourcerer" (Plex Mono 12px, letter-spacing 0.08em) + "·" + active applet name (Plex Mono 11px `#6E6C66`). Click → toggles Home ⇄ last applet view.
- Right: "◱ LAYOUTS" menu (save/apply/delete named layouts, reset to single pane) · two 34×24 icon buttons (cycle left rail, toggle assistant) · window controls — three 46px-wide zones: minimize "—", maximize (10px square outline), close "✕" (hover `#7a2a24`). **Wire these to the Tauri window API** (`minimize`, `toggleMaximize`, `close`). Title bar drag region = the empty flex spacer only (`data-tauri-drag-region`).

### Left rail (nav)
Three modes driven by width: **expanded** (≥ ~120px: glyph + label rows, 36px tall), **compact** (40px icon column), **hidden** (5px sliver with a reopen affordance). 6px right-edge grip: drag to resize, double-click / ⌘\ to cycle modes.
- Items: one per applet (glyph Plex Mono 18px, label Plex Sans 13px). Active = `#E6E4DE` text, `#131418` bg, 2px left rail accent `#E6E4DE`. Badge counts right-aligned (e.g. Wiki · 7).
- Drag an item within the rail → reorder (insertion line `#E6E4DE`, 2px). Drag below the list → pin to bottom group. Drag out into the workspace → dock as a new pane (full docking preview UI).
- Footer: Applet Catalog "◍", Settings gear, user chip (26px square `#1A1B1E`, serif italic initial).

### Workspace (dock tree)
A recursive split tree: `leaf = { tabs[], active }`, `split = { dir: row|col, sizes[], children[] }`. Behaviors to port exactly (see prototype functions `hitTest`, `performDock`, `prune`, `startDockDrag`):
- Tab bars 34px (`#060708`), tabs min-width 124px with glyph + title + ✕; active tab has 2px top accent `#E6E4DE` and `#0A0A0B` bg. "+" button opens an applet.
- Drag a tab: over a tab bar → reorder/move into that bar (white caret + pill preview); over a pane → 5-zone dock chips (center/left/right/top/bottom, 38px squares) with half-pane highlight; within 34px of the workspace edge → split the whole workspace.
- Splits have 5px draggable resizers (`#1E1F22`). Empty tree renders Home.
- Multiple instances of one applet are allowed; each tab has a stable instance id.

### Dashboard Assistant (right panel, `#131418`)
Rows: 44px header (renameable section title, Plex Mono 11px uppercase) / session list (max 128px, scrolling) / message thread / composer. Messages 13px/1.55; assistant proposals render as serif-italic quote blocks with `[y] approve · [d] diff · [n] reject` mono actions. Composer: bordered input + send button; footer hints "+ context · ⌘↵ send · ＋MAKE CARD". 6px left grip: drag to resize; snap zones close it, or expand it full-screen (overlay cue "LET GO TO SNAP").

### Home (empty workspace)
Metro-style card dashboard in draggable sections (PINNED / FRESH / LIVING / ARCHIVE): cards drag between sections with FLIP animation; assistant "＋MAKE CARD" mints a card. See prototype `homeBody()`.

### Applet stubs
Unbuilt applets render a standard stub: 48px glyph tile + code crumb (`APPLET · LIGHTRAG`), serif 26px title, 13px `#A5A29A` description, then a section label and demo rows (grid `22px 84px 1fr auto`, `#131418` bg, `#1E1F22` border). Keep these until each applet is built for real.

## Applet Framework (the core of this handoff)
Port `reference/applets/README.md` faithfully. Contract:

```ts
export const manifest = { key, glyph, code, title, desc };
export function App({ React, host }) { /* React component */ }
```

- `registry.js` lists real applets; a registered key **replaces** its demo stub, a new key appends to the rail.
- `host` API (implement in the shell, applets never bypass it):
  - `host.storage.get/set/remove` — namespaced per applet (`sourcerer:<key>:<k>`). In Tauri: back with `tauri-plugin-store`.
  - `host.ai(promptOrMessagesBody) → Promise<string>` — THE single AI seam. In Tauri: a `invoke('ai_complete', …)` command; backend/agent TBD.
  - `host.open(appletKey)` — open another applet in the active pane.
  - `host.instanceId`, `host.theme` (tokens below).
- `Notes.js` is the reference implementation (persistent notes + AI summarize); `_TemplateApplet.js` is the starter. In the real repo these become ordinary TSX modules — keep manifest + host shape, drop the `React`-via-props indirection if using a bundler.

## Interactions & Behavior (summary)
- All drags use a 5px movement threshold before engaging; plain click = activate.
- Hover states are flat color shifts (`#131418` row hover, text `#6E6C66 → #A5A29A → #E6E4DE`); no shadows except the window itself. No transitions on hover; FLIP animation (0.22s cubic-bezier(0.2,0.9,0.3,1)) only for card/tile reflow.
- Keyboard: ⌘\ cycles rail; ⌘↵ sends assistant reply; y/d/n act on the focused proposal.
- Named layouts persist (prototype key `divi-dock-layouts`): store `{ name, tree, railWidth, asstWidth, assistantOpen }`.
- **Persist the whole workspace** (dock tree, rail order/pins, panel widths, open tabs) on change and restore on launch — the prototype only persists layouts + Notes; the Tauri app should persist everything.

## State Management
Shell state (one store): `dockTree`, `activePaneId`, `railOrder`, `railBottom` (pinned), `railWidth`, `asstWidth`, `assistantOpen`, `savedLayouts`, per-instance applet state keyed by tab id. Applet-private state stays inside each applet behind `host.storage`.

## Design Tokens
Colors: bg `#0A0A0B` · bg-deep `#060708` · panel `#131418` · panel2 `#0F1013` · raised `#1A1B1E` · line `#1E1F22` · line2 `#26272B` · line3 `#3A3B40` · fg `#E6E4DE` · fg-mid `#A5A29A` · fg-soft `#C5C2BA` · dim `#6E6C66` · good `#5E8A6E` · warn `#B08A6E` · danger-hover `#7a2a24`.
Type: **IBM Plex Sans** (400/500/600) body 13px, **IBM Plex Mono** (400/500) micro-labels 9–12px uppercase letter-spacing 0.08–0.18em, **IBM Plex Serif** (400 + italic) titles 26px & quoted matter 14–15px. Bundle the fonts locally (no Google Fonts at runtime in a desktop app).
Metrics: title bar 34px · tab bar 34px · rail rows 36px · compact rail 40px · resize grips 5–6px · border-radius **0 everywhere** · borders always 1px.

## Assets
None — the UI is entirely typographic (Unicode glyphs ◉◆▤§◇≋✎◎▥◈⚷⚙⊞▦✳, no icon font, no emoji). Fonts: IBM Plex Sans/Mono/Serif (OFL, bundle locally).

## Files
- `reference/Working Sourcerer UX UI Prototype.dc.html` — the full interactive prototype (open in a browser; `support.js` must sit beside it)
- `reference/support.js` — prototype runtime (reference only, do not ship)
- `reference/applets/README.md` — applet framework contract (authoritative)
- `reference/applets/registry.js`, `Notes.js`, `_TemplateApplet.js` — framework + reference applet + starter

## Suggested build order
1. Scaffold Tauri 2 + Vite/React/TS; frameless window + custom title bar wired to window API
2. Port the dock tree + rail (lift algorithms from the prototype)
3. Implement `host` (store-backed storage, stubbed `ai`), registry loader, demo stubs
4. Port Notes as the first real applet — proves the whole loop
5. Assistant panel UI (against the stubbed `ai` seam)
6. Then applets one at a time, each replacing its stub via the registry
