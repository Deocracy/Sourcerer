# Sourcerer Applet Framework

The shell (`Working Sourcerer UX UI Prototype.dc.html`) renders every applet
as a **demo stub** by default. Real applets live here, one JS module each,
registered in `registry.js`. Registered applets appear in the left rail and
Applet Catalog automatically and render for real inside panes (tabs, splits,
drag-to-dock all work with no extra code).

## Add an applet

1. Copy `_TemplateApplet.js` → `YourApplet.js`
2. Fill in `manifest` and build `App`
3. In `registry.js`: `import * as YourApplet from './YourApplet.js';` and add it to the `applets` array

If `manifest.key` matches an existing demo applet (`Library`, `Wiki`, `Graph`,
`Chat`, `Writing`, `Browser`, `Kanban`, `News`, `KeyPass`, `Dadabase`), your
module **replaces** that demo — same rail slot, same glyph position. A new key
appends a new applet to the rail.

## Module contract

```js
export const manifest = { key, glyph, code, title, desc };
export function App({ React, host }) { ... } // React function component
```

- `React` is passed in via props — never import or bundle your own.
- Hooks work normally (`React.useState`, `React.useEffect`, …).
- Build UI with `React.createElement` (alias `const h = React.createElement`).
- One `App` instance mounts per open tab of the applet.

## The `host` API

| Member | What it does |
|---|---|
| `host.storage.get(key, fallback)` | Read persisted JSON (namespaced per applet) |
| `host.storage.set(key, value)` | Persist JSON — survives reload |
| `host.storage.remove(key)` | Delete a key |
| `host.ai(prompt)` | Ask Claude, returns Promise<string>. Also accepts a Messages-API body (`{messages, system, max_tokens, ...}`) |
| `host.open(appletKey)` | Open another applet in the active pane |
| `host.instanceId` | Unique id of this tab (for per-tab state) |
| `host.theme` | Shared tokens — see below |

`host.ai` currently uses the preview's built-in Claude bridge and is
rate-limited (~15 calls/min). It is the ONE place to swap in a different
backend/agent later — applets never call a model directly.

## Theme tokens (`host.theme`)

Use these; don't invent colors.

- `bg` #0A0A0B · `panel` #131418 · `panel2` #0F1013 · `line` #1E1F22 · `line2` #26272B
- `fg` #E6E4DE · `mid` #A5A29A · `dim` #6E6C66 · `good` #5E8A6E · `warn` #B08A6E
- `sans` IBM Plex Sans · `mono` IBM Plex Mono · `serif` IBM Plex Serif

Conventions: square corners (no border-radius), 1px `line` borders, mono
uppercase micro-labels with `letter-spacing: 0.12–0.16em`, serif for titles
and quoted matter, ✕ / ＋ / ▸ style glyphs (no emoji).

## Persistence

`host.storage` is localStorage under `sourcerer:<appletKey>:<key>`, JSON
encoded. Fine for now; when moving to a real backend, reimplement the three
storage functions in the shell's `makeHost()` — applets don't change.
