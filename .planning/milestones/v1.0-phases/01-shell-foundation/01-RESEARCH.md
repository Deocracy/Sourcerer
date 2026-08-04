# Phase 1: Shell Foundation - Research

**Researched:** 2026-07-07
**Domain:** Tauri 2 frameless desktop window + custom title bar (React 18 + Vite), Windows DPI correctness, locally-bundled web fonts
**Confidence:** HIGH (scaffold/version facts verified by actually running the scaffolder and inspecting output; Tauri window-chrome APIs verified against official docs; DPI-awareness default verified via secondary source — flagged MEDIUM where noted)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Seed the shared foundation now.** Phase 1 builds the title bar + empty body AND establishes (a) the app-shell CSS grid `grid-template-rows: 34px 1fr` that every later phase mounts into, and (b) a full `tokens.css` file exposing *all* UI-SPEC colors, metrics, spacing, and type tokens as CSS custom properties — not just the title-bar subset. Rationale: UI-SPEC already enumerates every token, so authoring `tokens.css` in full is nearly free, avoids a throwaway title bar rebuilt in Phase 2, and gives Phases 2-6 a real foundation. Discipline holds: still a thin slice — no logic, no Zustand store, no rail/dock, no applet code in Phase 1.

**D-02: Phase 1 stays stateless.** Track maximized/restored state via Tauri's window events (listen for maximize/unmaximize) and drive the maximize↔restore icon + aria-label from actual window state; the crumb is a static "Home" literal. Do NOT introduce Zustand in Phase 1 — defer it to Phase 2 where the dock tree actually needs a shell store. (CLAUDE.md scopes Zustand to `dockTree`/rail/widths, none of which exist yet.)

**D-03: Scaffold reconciliation.** Scaffold fresh with `npm create tauri-app@latest` (React + TS template). Keep the generated build/dev-loop wiring (Vite config, `tauri.conf.json` schema, `beforeDevCommand`) — treat the scaffolder's Vite/plugin-react versions as source of truth, do not hand-pick Vite 8. Delete only the demo UI (sample `App.tsx`, `greet` command, demo assets). Explicitly pin `react`/`react-dom` to 18.2.x and `@types/react{,-dom}` to `^18` in `package.json` (do not accept a React 19 default). Bundle `@fontsource/ibm-plex-{sans,mono,serif}` via per-weight subpath imports only (budget: Sans 400/500/600 · Mono 400/500 · Serif 400 + 400-italic); confirm zero runtime requests to `fonts.googleapis.com`/`fonts.gstatic.com`.

### Claude's Discretion

- Window control glyph implementation (`—` / 10×10px 1px-border square div / `✕`), hover color shifts, and the logo circle SVG are fully specified by UI-SPEC — implement as written, no further decision needed.
- Folder structure for the seeded foundation (where `tokens.css`, the app-shell component, and window-control components live) is the planner's call, following CLAUDE.md's CSS-Modules + single-`tokens.css` recommendation.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. (The omitted title-bar chrome — LAYOUTS/rail/assistant buttons — is not deferred *ideation*; it is already scoped to Phases 2/3/6 by the roadmap and UI-SPEC Phase Boundary Note.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHELL-01 | User sees a frameless single window with the custom 34px title bar (logo, app name, active applet crumb) matching design tokens | Architecture Patterns Pattern 1 (frameless window + custom title bar config); Recommended Project Structure; Validation Architecture SHELL-01 row |
| SHELL-02 | User can minimize, maximize/restore, and close via the custom window controls (wired to Tauri window API), and drag the window by the title-bar spacer only — no button swallows clicks | Architecture Patterns Pattern 1 (window API wiring) and Pattern 2 (reliable maximize/restore state); Common Pitfalls 3 and 4; Validation Architecture SHELL-02 rows |
| SHELL-03 | User sees crisp 1px borders and correct metrics at 100%/125%/150% Windows display scaling | Summary + Architecture Patterns (PerMonitorV2 default, no manual DPI handling needed); Common Pitfall 1 (`shadow` default breaking pixel-perfect chrome); Assumptions Log A1; Validation Architecture SHELL-03 rows (manual + regression-proxy) |
| SHELL-04 | User sees IBM Plex Sans/Mono/Serif rendered from locally bundled fonts (no network font loading) | Standard Stack (Fontsource versions); Architecture Patterns Pattern 3 (per-weight import); Code Examples (build-output grep check); Validation Architecture SHELL-04 row |
</phase_requirements>

## Summary

Phase 1 is a from-scratch scaffold. A live test scaffold was already run once this session (`npm create tauri-app@latest`, React+TS template) into the scratch directory and its `package.json`/`Cargo.toml`/`tauri.conf.json` were inspected directly — this replaces guesswork with ground truth. The scaffolder today produces **Vite 7.3.6** and **React 19.2.7** by default, not the "Vite 5.4.x" figure CLAUDE.md guessed — CLAUDE.md's own instruction to "treat the scaffolder's pins as source of truth, not hardcoded numbers" is correct and this research confirms the actual numbers to plan against. React must be downgraded to 18.2.0 immediately after scaffold per CONTEXT.md D-03.

The frameless-window mechanics (`decorations:false`, `data-tauri-drag-region`, the JS window API) are well documented and low-risk. The one **non-obvious, high-impact finding** this research surfaced: Tauri v2's window `shadow` config defaults to `true`, which on Windows silently adds an OS-drawn 1px **white** border and, on Windows 11, **auto-rounds the window's outer corners** — both of which directly violate the UI-SPEC's `#1E1F22` border color and "0 border-radius everywhere" mandate. This must be set to `shadow: false` explicitly; nothing in CLAUDE.md or UI-SPEC flags this because it's a Tauri-config-level behavior, not a CSS one.

DPI correctness (SHELL-03) requires no special configuration: Tauri's windowing layer (`tao`) requests Per-Monitor-V2 DPI awareness by default on Windows 10 1703+ (all supported targets), and the guidance is simply "author every metric in CSS logical pixels, never hand-roll physical-pixel/`devicePixelRatio` math" — which is what the UI-SPEC already does. The real risk is regression (someone adding a `0.5px` border hack) and the fact that true crispness at 125%/150% can only be confirmed by human eyes on real hardware — this is a `checkpoint:human-verify` item, not something a unit test can prove.

**Primary recommendation:** Scaffold with `npm create tauri-app@latest`, immediately pin React to 18.2.0, add `"shadow": false` alongside `"decorations": false` in `tauri.conf.json`, grant only the specific `core:window:allow-*` permissions needed (not just `core:window:default`), and drive the maximize/restore icon off `isMaximized()` re-queried on `onResized`/`listen('tauri://resize')` rather than trusting a single maximize event.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Title bar rendering (logo/wordmark/crumb/spacer/controls) | Browser/Client (React + CSS Modules) | — | Pure presentational component tree, no backend involvement |
| App-shell CSS grid (`34px 1fr`) + `tokens.css` | Browser/Client | — | Static CSS authored once, consumed by all later phases |
| Window control actions (minimize/maximize/close) | Browser/Client (issues `@tauri-apps/api/window` calls) | API/Backend (Tauri Rust core + `tao`/`wry` execute the actual OS window manipulation) | Click handler lives in React; the real state change happens in the native Rust/OS layer — client never manipulates the OS window directly |
| Drag-region behavior | Browser/Client (`data-tauri-drag-region` attribute, or `startDragging()` call) | API/Backend (native drag-move loop) | Attribute-driven; Tauri's IPC bridge translates it into a native `WM_NCLBUTTONDOWN`-style drag on Windows |
| DPI / display-scaling correctness | API/Backend (`tao` PerMonitorV2 awareness, Windows DWM) | Browser/Client (CSS must stay in logical px) | The awareness mode is a native-layer concern; the frontend's only job is to not fight it with physical-pixel hacks |
| Font bundling (IBM Plex Sans/Mono/Serif) | CDN/Static (Vite bundles `@fontsource` CSS+woff2 into `dist` as local static assets) | Browser/Client (`@font-face` consumption) | No network font fetch — the "CDN" here is the app's own bundled static asset output, not an external CDN |
| Dev/build tooling (Vite config, `tauri.conf.json`, capabilities) | Build tooling (not a runtime tier) | — | Configuration surface, not a request-time responsibility |

## Standard Stack

### Core
| Library | Version (verified) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tauri-apps/cli` | 2.11.4 [VERIFIED: npm registry, resolved in live scaffold's package-lock.json] | Scaffolding + `tauri dev`/`tauri build` CLI | Official Tauri 2.x tooling |
| `@tauri-apps/api` | 2.11.1 [VERIFIED: npm registry] | Frontend JS bindings to the Rust core (`window`, `event`, `mocks` namespaces) | The only supported way to call window/IPC commands from React |
| `tauri` (Rust crate) | 2.11.5 [VERIFIED: cargo search] — `Cargo.toml` pins `"2"` (semver-compatible, resolves to latest 2.x at build time) | Rust-side window/runtime core | Keep in lockstep with `@tauri-apps/api`'s 2.x line per CLAUDE.md Version Compatibility table |
| `react` / `react-dom` | Scaffold defaults to **19.2.7** — **must be overridden to 18.2.0** per CONTEXT.md D-03 [VERIFIED: npm registry for both numbers] | UI runtime | Project-wide pin; do not accept the scaffold's React 19 default |
| `@types/react` / `@types/react-dom` | Pin to `^18` (scaffold defaults to `^19.1.x`) [VERIFIED: npm registry] | Types matching the pinned React major | Prevents the classic React18-runtime/React19-types mismatch trap |
| `vite` | 7.3.6 as scaffolded today [VERIFIED: resolved version in live scaffold's package-lock.json] | Dev server + bundler | **Correction to CLAUDE.md's guess of "5.4.x":** the scaffolder currently ships Vite 7, not 5, and not the Vite-8-Rolldown line CLAUDE.md warned against either. Confirms CLAUDE.md's own meta-rule ("treat the scaffolder's pins as source of truth") was the right call — do not hardcode any Vite version into the plan; re-derive from the scaffold output at execution time in case it drifts again before execution. |
| `@vitejs/plugin-react` | 4.7.0 as scaffolded [VERIFIED: resolved version in live scaffold's package-lock.json] | React Fast Refresh for Vite | Peer-locked to Vite 7 (not the `@vitejs/plugin-react@6.x` line, which requires Vite ^8) |
| `typescript` | 5.8.3 as scaffolded [VERIFIED: resolved version in live scaffold's package-lock.json] | Type safety | Scaffold pin — not the bleeding-edge 6.0.3 CLAUDE.md's stack doc flagged as "currently on npm"; Tauri's official template has not moved to TS 6 yet as of this scaffold run |
| `@tauri-apps/plugin-opener` (JS) + `tauri-plugin-opener` (Rust, via `Cargo.toml`) | 2.5.4 (JS) [VERIFIED: resolved version in live scaffold's package-lock.json] | Scaffold default plugin (opens URLs/paths in the OS default handler) | Not required by SHELL-01..04; harmless to keep (adds one `opener:default` capability) or safe to strip if the planner wants a leaner Phase 1 surface — no phase requirement depends on it |
| `@fontsource/ibm-plex-sans` | 5.2.8 [VERIFIED: npm registry] | Locally bundled Sans weights (400/500/600) | Confirmed current; matches CLAUDE.md |
| `@fontsource/ibm-plex-mono` | 5.2.7 [VERIFIED: npm registry] | Locally bundled Mono weights (400/500) | **Note:** CLAUDE.md listed "5.2.8" for the whole family; mono/serif are actually 5.2.7, one patch behind sans. Not a compatibility risk (independent packages), just a version-accuracy correction. |
| `@fontsource/ibm-plex-serif` | 5.2.7 [VERIFIED: npm registry] | Locally bundled Serif weights (400, 400-italic) | Same correction as mono above |

### Supporting (test infrastructure — new for this phase, greenfield repo)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | 4.1.10 [VERIFIED: npm registry] | Unit/component test runner, native Vite integration | From Phase 1 — needed to satisfy Nyquist validation for SHELL-01/02/04 (see Validation Architecture below) |
| `@testing-library/react` | 16.3.2 [VERIFIED: npm registry] | Render/query the title bar component tree in tests | Standard pairing with Vitest + React |
| `jsdom` | 29.1.1 [VERIFIED: npm registry] | DOM environment for Vitest (no real webview needed) | Vitest `environment: 'jsdom'` |
| `@tauri-apps/api/mocks` (bundled with `@tauri-apps/api`, no separate install) | 2.11.1 | `mockIPC()` / `mockWindows()` — intercept window-command IPC calls in tests without launching Tauri | Use to assert that clicking minimize/maximize/close actually invokes the correct Tauri command, and that only the spacer carries `data-tauri-drag-region` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `tao`'s built-in PerMonitorV2 awareness (do nothing) | Hand-rolled `devicePixelRatio` CSS scaling / a custom Windows manifest | Not needed and actively risky — hand-rolling DPI math is the exact anti-pattern that causes blur/off-by-one bugs; only reach for this if a future non-Windows-manifest edge case appears |
| `shadow: false` (no OS shadow/border) | `shadow: true` + override via a native corner-preference plugin (e.g. community `window-shadows`/`tauri-plugin-decorum`) | Only worth it if a future design pass wants a native drop-shadow; UI-SPEC has no shadow token, so the simplest correct choice is `shadow: false` |
| Vitest + jsdom for logic/behavior tests | Playwright/WebDriver against the real compiled Tauri window | Full native E2E (real DPI, real window chrome) is valuable but heavyweight for Phase 1's walking-skeleton scope; reserve real-window E2E for a later hardening pass, use jsdom+mocks now for fast automatable coverage, and human-verify the real DPI/window behavior at `checkpoint:human-verify` |

**Installation (after `npm create tauri-app@latest`):**
```bash
# Re-pin React to 18.2.0 (scaffold defaults to 19.x)
npm install react@18.2.0 react-dom@18.2.0
npm install -D @types/react@^18 @types/react-dom@^18

# Fonts — per-weight subpath installs, all three families
npm install @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono @fontsource/ibm-plex-serif

# Test infra (new for this phase)
npm install -D vitest @testing-library/react jsdom
```

**Version verification command used this session (do not skip on re-verification):**
```bash
npm create tauri-app@latest   # inspect its generated package.json / src-tauri/Cargo.toml directly
npm view <package> version    # for any package not covered by the scaffold's own lockfile
```

## Package Legitimacy Audit

All packages below were checked with `slopcheck 0.6.1` (`python -m slopcheck scan --pkg npm <name> --json`) — every one returned `status: "OK"`, no `SLOP`/`SUS` flags. `npm view <pkg> scripts.postinstall` returned empty for all — no suspicious postinstall scripts.

| Package | Registry | Age (npm `time.created`) | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `react` | npm | 2011-10-26 | github.com/facebook/react | OK | Approved |
| `react-dom` | npm | (same release train as react) | github.com/facebook/react | OK | Approved |
| `@tauri-apps/api` | npm | 2021-04-13 | github.com/tauri-apps/tauri | OK | Approved |
| `@tauri-apps/cli` | npm | 2021-04-13 | github.com/tauri-apps/tauri | OK | Approved |
| `@tauri-apps/plugin-opener` | npm | (Tauri 2.x plugin train) | github.com/tauri-apps/tauri | OK | Approved (optional — see Standard Stack note) |
| `@vitejs/plugin-react` | npm | 2021-09-20 | github.com/vitejs/vite-plugin-react | OK | Approved |
| `typescript` | npm | 2012-10-01 | github.com/microsoft/TypeScript | OK | Approved |
| `vite` | npm | 2020-04-21 | github.com/vitejs/vite | OK | Approved |
| `@fontsource/ibm-plex-sans` | npm | 2020-12-23 | github.com/fontsource/font-files | OK | Approved |
| `@fontsource/ibm-plex-mono` | npm | (same monorepo as sans) | github.com/fontsource/font-files | OK | Approved |
| `@fontsource/ibm-plex-serif` | npm | (same monorepo as sans) | github.com/fontsource/font-files | OK | Approved |
| `vitest` | npm | Vite-team-maintained | github.com/vitest-dev/vitest | OK | Approved |
| `@testing-library/react` | npm | testing-library org | github.com/testing-library/react-testing-library | OK | Approved |
| `jsdom` | npm | jsdom org | github.com/jsdom/jsdom | OK | Approved |

**Packages removed due to slopcheck `[SLOP]` verdict:** none
**Packages flagged as suspicious `[SUS]`:** none

## Architecture Patterns

### System Architecture Diagram

```
npm create tauri-app@latest
        │
        ▼
 ┌─────────────────────────────┐        ┌──────────────────────────────┐
 │  React 18 app (src/)        │        │  Rust core (src-tauri/)       │
 │                              │        │                                │
 │  App.tsx                    │        │  tauri.conf.json               │
 │   └─ TitleBar.tsx  ─────────┼───IPC──┼─▶ window commands (minimize/    │
 │        ├─ LogoCluster       │  calls │    toggleMaximize/close)        │
 │        ├─ (drag spacer,     │        │  capabilities/default.json      │
 │        │   data-tauri-      │        │   (allow-* permissions gate     │
 │        │   drag-region)     │        │    which IPC calls succeed)     │
 │        └─ WindowControls    │        │                                │
 │             (minimize/      │◀──events┤  tao/wry: native window,       │
 │              maximize/      │  (resize│  PerMonitorV2 DPI awareness,   │
 │              close buttons) │  events)│  shadow:false → square/        │
 │  AppShell.tsx (grid:         │        │  bordered, no OS auto-round    │
 │   34px title-row / 1fr body)│        │                                │
 │  tokens.css (all UI-SPEC     │        └──────────────────────────────┘
 │   tokens as CSS custom       │
 │   properties)                │
 │  fonts: @fontsource imports   │──────▶ bundled into dist/ as local
 │   (per-weight .css subpaths)  │        static assets by Vite — no
 └─────────────────────────────┘        network font requests at runtime
```

Data flow for the one interactive path (SHELL-02): user clicks a window-control button → React click handler calls `getCurrentWindow().minimize()/toggleMaximize()/close()` from `@tauri-apps/api/window` → Tauri IPC bridge checks the calling window's capability file for the matching `core:window:allow-*` permission → if granted, the Rust core forwards the call to `tao`/`wry`, which performs the actual native OS window operation → for maximize/restore, the frontend re-queries `isMaximized()` on the next `onResized`/`tauri://resize` event to update the icon+aria-label (do not trust a single "maximized" event to fire in isolation).

### Recommended Project Structure
```
src/
├── app/
│   ├── AppShell.tsx        # grid-template-rows: 34px 1fr; mounts TitleBar + body outlet
│   └── AppShell.module.css
├── shell/
│   ├── TitleBar.tsx        # left cluster + spacer + window controls, per UI-SPEC
│   ├── TitleBar.module.css
│   ├── WindowControls.tsx  # minimize/maximize/close buttons, isMaximized() state
│   └── LogoCluster.tsx     # logo SVG + "Sourcerer" + "·" + crumb
├── styles/
│   └── tokens.css          # full UI-SPEC token set as CSS custom properties (D-01)
├── fonts.ts                # centralizes all @fontsource per-weight imports (single import point)
└── main.tsx
src-tauri/
├── tauri.conf.json         # decorations:false, shadow:false
├── capabilities/
│   └── default.json        # explicit core:window:allow-* list, windows:["main"]
└── src/
    ├── main.rs
    └── lib.rs
```

### Pattern 1: Frameless window + custom title bar
**What:** `decorations:false` in `tauri.conf.json`, custom HTML/CSS title bar, `data-tauri-drag-region` on the drag spacer only, window controls wired to the JS window API.
**When to use:** Always for this project — locked by UI-SPEC/handoff.
**Example:**
```json
// Source: https://v2.tauri.app/learn/window-customization/ — src-tauri/tauri.conf.json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "decorations": false,
        "shadow": false,
        "width": 1024,
        "height": 768
      }
    ]
  }
}
```
```json
// Source: https://v2.tauri.app/learn/window-customization/ — src-tauri/capabilities/default.json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-minimize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-close",
    "core:window:allow-start-dragging"
  ]
}
```
```tsx
// Source: https://v2.tauri.app/learn/window-customization/ + https://v2.tauri.app/reference/javascript/api/namespacewindow/
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

// Spacer only — never on a button or the logo cluster
<div data-tauri-drag-region className={styles.spacer} />

<button aria-label="Minimize window" onClick={() => appWindow.minimize().catch(console.error)}>—</button>
<button aria-label={isMax ? 'Restore window' : 'Maximize window'} onClick={() => appWindow.toggleMaximize().catch(console.error)}>□</button>
<button aria-label="Close window" onClick={() => appWindow.close().catch(console.error)}>✕</button>
```

### Pattern 2: Reliable maximize/restore state tracking (no Zustand — D-02)
**What:** Re-query `isMaximized()` whenever a resize-family event fires, rather than trusting a dedicated "maximized" event to always fire standalone.
**When to use:** SHELL-02's icon/aria-label swap.
**Example:**
```tsx
// Source: pattern synthesized from Tauri window API docs + community discussion
// https://v2.tauri.app/reference/javascript/api/namespacewindow/
// https://github.com/tauri-apps/tauri/discussions/5881 (maximize/minimize event reliability)
import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

function useMaximizedState() {
  const [isMax, setIsMax] = useState(false);
  useEffect(() => {
    const appWindow = getCurrentWindow();
    appWindow.isMaximized().then(setIsMax);
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMax);
    });
    return () => { unlisten.then((f) => f()); };
  }, []);
  return isMax;
}
```

### Pattern 3: Per-weight local font bundling, single import point
**What:** Import only the exact weights in the UI-SPEC budget, never the "all weights" index.
**When to use:** SHELL-04.
**Example:**
```ts
// Source: https://fontsource.org/docs/getting-started/install (official Fontsource docs)
// src/fonts.ts — single centralized import point
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-serif/400.css';
import '@fontsource/ibm-plex-serif/400-italic.css';
```

### Anti-Patterns to Avoid
- **Leaving `shadow` unset (defaults to `true`):** silently adds a 1px white OS border and Win11-rounded corners to an undecorated window — violates the `#1E1F22` border + 0-radius spec. Always set `"shadow": false` explicitly alongside `"decorations": false`.
- **`data-tauri-drag-region` on a parent container "to save typing":** the attribute does NOT cascade to children — per official docs it only affects the exact element it's applied to. Applying it to the whole title bar container (instead of just the spacer) would make buttons/logo un-clickable-but-draggable, which is the opposite of the SHELL-02 requirement ("no button swallows clicks").
- **Hardcoded physical-pixel/`devicePixelRatio` CSS hacks (e.g. `0.5px` border tricks) "to fix blur":** fights `tao`'s automatic PerMonitorV2 handling and is the documented root cause of the historical WebView2-blur reports. Author every metric in logical CSS px (as UI-SPEC already does) and trust the platform.
- **Trusting a single `'tauri://maximize'`/`'tauri://unmaximize'` event to always fire:** community reports (GitHub discussion #5881, issue #7664) note maximize-family events can be inconsistent; re-query `isMaximized()` on `onResized` instead (Pattern 2 above).
- **Importing `@fontsource/ibm-plex-{sans,mono,serif}` bare (no subpath)**: pulls every weight (100–700 + italics) instead of the ~7 weights actually budgeted — bloats the bundle and re-introduces exactly the "load everything" problem `@fontsource`'s per-weight subpaths exist to avoid.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Window drag / minimize / maximize / close | Custom native window-message plumbing, custom mouse-drag-to-move logic | `data-tauri-drag-region` + `@tauri-apps/api/window` (`minimize`/`toggleMaximize`/`close`/`startDragging`) | This is exactly what Tauri's window-customization API exists for; hand-rolling it means reimplementing OS-specific window-move message handling per platform |
| DPI/scale-factor correctness | Custom `devicePixelRatio` CSS math, custom Windows application manifest `dpiAwareness` entries | Nothing — `tao` already requests PerMonitorV2 by default | Adding manual DPI handling on top of an already-DPI-aware native layer is the documented cause of blur/off-by-one bugs, not the fix for them |
| Local font loading | Custom `@font-face` blocks pointing at self-hosted woff2 files copied by hand | `@fontsource/ibm-plex-{sans,mono,serif}` per-weight CSS imports | Fontsource packages already ship correctly-subsetted, correctly-declared `@font-face` CSS per weight; hand-rolling risks wrong `font-display`, missing unicode-range, or accidentally bundling unused weights |
| Rounded-corner / shadow suppression on Windows 11 | Custom `DWMWA_WINDOW_CORNER_PREFERENCE` native calls | `"shadow": false` in `tauri.conf.json` | Tauri's `shadow` config flag is the documented, cross-version-stable way to opt out of the Win11 auto-round + white-border behavior; a hand-rolled native call would need its own maintenance across Tauri/`tao` upgrades |

**Key insight:** every "hand-roll" temptation in this phase (drag, DPI, fonts, corner radius) already has a one-line, officially-supported off switch or API call. The failure mode in this domain isn't "no library exists" — it's "a config flag exists and nobody sets it" (the `shadow` flag being the clearest example this research found).

## Common Pitfalls

### Pitfall 1: `shadow` defaulting to `true` breaks pixel-perfect chrome
**What goes wrong:** The window silently gets a 1px white OS-drawn border and (on Windows 11) automatically rounded outer corners.
**Why it happens:** `shadow: true` is Tauri v2's default for all windows, decorated or not; it wasn't designed with "fully custom flat chrome" in mind as the only use case.
**How to avoid:** Set `"shadow": false` explicitly in every window entry in `tauri.conf.json` from the first commit.
**Warning signs:** A faint white hairline visible outside the intended `#1E1F22` border, or visibly rounded corners at the window's outer edge on Windows 11 even though no CSS `border-radius` was applied there.

### Pitfall 2: Scaffold's default React 19 + mismatched `@types/react`
**What goes wrong:** `npm create tauri-app@latest` installs React 19.2.7 and `@types/react@^19.1.x` by default; if only `react`/`react-dom` are downgraded to 18.2.0 but the `@types` packages are left floating on `^19`, TypeScript will report spurious type errors (React 19's types describe APIs the React 18 runtime doesn't have).
**Why it happens:** The scaffolder always installs current-latest React unless told otherwise; there's no "React 18 template" option.
**How to avoid:** Pin all four packages (`react`, `react-dom`, `@types/react`, `@types/react-dom`) to their 18.x lines in the same commit, immediately after scaffold, before writing any component code.
**Warning signs:** `npm ls react @types/react` showing mismatched majors; TS errors referencing React 19-only APIs (e.g. ref-as-prop changes) in code that only uses React 18 patterns.

### Pitfall 3: `data-tauri-drag-region` doesn't cascade
**What goes wrong:** Developer applies the attribute to the whole title bar `<div>` expecting child buttons to remain clickable "underneath" — instead the whole region including buttons becomes drag-only, or behavior becomes inconsistent across child elements.
**Why it happens:** The official docs explicitly note the attribute only affects the exact element it's applied to, not descendants — an easy assumption to get backwards (most CSS/ARIA attributes DO cascade or apply to subtrees).
**How to avoid:** Apply the attribute only to the dedicated flex-spacer element between the left cluster and the window controls, per UI-SPEC's explicit "drag region = the empty flex spacer only" rule.
**Warning signs:** Clicking a window-control button starts a window drag instead of firing its click handler; the logo/wordmark click (`openHome`) doesn't fire because it's inside a drag region.

### Pitfall 4: Maximize/restore icon state drifts from actual window state
**What goes wrong:** The icon and `aria-label` don't reflect reality (e.g., double-clicking the title bar to maximize doesn't update a maximize icon that's only wired to the button's own click handler).
**Why it happens:** Maximize can be triggered by means other than the custom button (title-bar double-click via `startDragging`'s companion double-click-to-maximize pattern, OS keyboard shortcuts, Aero Snap) — a click-handler-only state toggle misses all of these; and even the dedicated maximize/unmaximize Tauri events aren't 100% reliably reported standalone.
**How to avoid:** Drive the icon/aria-label off `isMaximized()`, re-queried every time `onResized` (or `listen('tauri://resize', ...)`) fires — see Pattern 2 above.
**Warning signs:** Icon shows "maximize" square while the window is actually already maximized (e.g. after an OS-level double-click on the title bar), or vice versa after restore.

### Pitfall 5: Stale project-memory landmine (`cargo run` vs `cargo tauri dev`) likely does not apply here
**What goes wrong:** Blindly carrying over the sibling Databasise project's guidance to always launch via `cargo run` from `src-tauri` instead of the standard dev-loop command.
**Why it happens:** That landmine was specifically about a Python sidecar process + editable venv install interacting badly with `cargo tauri dev`'s process supervision (per this repo's own memory: `SOURCERER_PYTHON=sourcerer-venv`, sidecar-specific). This fresh Sourcerer shell repo has **no Python, no sidecar, no editable install** in Phase 1's scope at all.
**How to avoid:** Default to the standard scaffolded dev loop (`npm run tauri dev`, which the scaffold's `package.json` wires to the Tauri CLI). Only fall back to `cargo run` from `src-tauri` if `npm run tauri dev` is verified to actually misbehave in this repo — don't pre-emptively adopt a workaround for a problem this repo's architecture doesn't have.
**Warning signs:** None expected; flag for a 30-second verification early in execution (first successful `npm run tauri dev` launch) rather than pre-deciding.

## Code Examples

### Full minimal capability file for the main window
```json
// Source: https://v2.tauri.app/learn/window-customization/, https://v2.tauri.app/security/capabilities/
// src-tauri/capabilities/default.json
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
    "core:window:allow-start-dragging"
  ]
}
```

### Verifying zero external font requests (automatable proxy for SHELL-04)
```bash
# Source: synthesized — no official Tauri/Fontsource tool for this, straightforward grep is sufficient
npm run build
grep -rIl "fonts.googleapis.com\|fonts.gstatic.com" dist/ && echo "FAIL: external font reference found" || echo "PASS: no external font references"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Tauri v1 `tauri.conf.json` `tauri.windows[]` schema, `@tauri-apps/api` v1 namespace layout | Tauri v2 `app.windows[]` schema, capability/permission ACL model (`core:window:allow-*`), `@tauri-apps/api` v2 namespaced imports (`@tauri-apps/api/window`) | Tauri 2.0 GA, Oct 2024 | Any v1-era tutorial/blog post (there are many, since v1 shipped for years) uses a schema and permission model that no longer applies — always cross-check dates on Tauri guidance found via WebSearch |
| Manually declaring `dpiAware`/manifest entries for Windows DPI | Automatic via `tao`'s default PerMonitorV2 request | Predates Tauri 2 (inherited from `tao`/`winit` lineage) | No config needed; the risk is someone adding unnecessary manual overrides, not missing a required one |

**Deprecated/outdated:**
- Tauri v1's `withGlobalTauri`/`window.__TAURI__` global-injection patterns for window control code found in older blog posts — v2 uses ES module imports (`import { getCurrentWindow } from '@tauri-apps/api/window'`) instead.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tao` requests PerMonitorV2 DPI awareness by default on Windows 10 1703+ with no Tauri-level config needed | Summary, Architecture Patterns, Pitfalls | [MEDIUM confidence — sourced via a DeepWiki paraphrase of `tao`'s source, not the raw source file or an official Tauri doc page. If wrong, SHELL-03 could fail at 125%/150% scaling and require an explicit Windows manifest edit the plan didn't anticipate.] Recommend the plan's SHELL-03 verification step explicitly test at all three scale factors on real Windows hardware regardless of this assumption. |
| A2 | The `core:window:allow-start-dragging` (and sibling) permissions, when placed in `capabilities/default.json` exactly as shown, reliably enable those window operations from the frontend | Architecture Patterns Pattern 1, Common Pitfalls | [LOW confidence — one GitHub issue (tauri-apps/tauri#11320) reported this permission "has no effect" via the capability file in some configuration, closed as not-planned (ambiguous whether it was a real bug or user misconfiguration, e.g. window-label mismatch).] If wrong, window controls or drag will silently no-op; the fix is straightforward (move the permission grant, double-check the `windows` array matches the window's actual `label`) but should be verified in the first executable slice, not assumed. |
| A3 | `npm run tauri dev` (standard scaffolded dev loop) works reliably for this repo, and the sibling Databasise project's `cargo run`-preferred landmine does not transfer | Common Pitfalls (Pitfall 5) | If wrong, the dev loop stalls or misbehaves and the planner/executor loses time diagnosing a landmine they were told not to expect; low risk since verification is a single command run early in Wave 0. |

## Open Questions

1. **Does the live-hardware verification for SHELL-03 (100/125/150% Windows scaling) need to happen inside this GSD session, or is it acceptable to mark it a `checkpoint:human-verify` deferred to the user's own machine?**
   - What we know: The dev/build environment for this session is already Windows 11 (per env block), so scale-factor testing is technically possible without leaving the sandbox.
   - What's unclear: Whether the actual execution environment (whatever runs `/gsd-execute-phase`) has display-scaling control, or whether this is something only the human user can toggle in Windows Settings and eyeball.
   - Recommendation: Plan SHELL-03's acceptance criterion as a `checkpoint:human-verify` step with explicit instructions (toggle Windows display scaling to 100/125/150%, screenshot the title bar, confirm border stays 1px and bar stays 34px with no blur) — don't assume it can be fully automated.

2. **Should `@tauri-apps/plugin-opener` be kept or stripped from the Phase 1 scaffold?**
   - What we know: It's a harmless scaffold default (opens URLs/files via the OS default handler) and no SHELL-01..04 requirement needs it.
   - What's unclear: Whether a later phase (e.g. Power Browser, or external links in Notes) will want it anyway, making removal-then-re-add wasted churn.
   - Recommendation: Keep it — zero cost, zero pixel/behavior impact on Phase 1's chrome, and saves a future re-add.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite/npm toolchain | ✓ | v22.13.1 | — |
| npm | Package installation | ✓ | 11.7.0 | — |
| Rust (rustup stable) | Tauri Rust core build | ✓ | rustc 1.93.1 / cargo 1.93.1 | — |
| Rust toolchain target | Windows MSVC build | ✓ | `stable-x86_64-pc-windows-msvc` (default) | — |
| `npm create tauri-app@latest` scaffolder | Initial project scaffold | ✓ (verified by running it live this session into scratch dir) | produces Vite 7.3.6 / React 19.2.7 / TS 5.8.3 / Tauri 2.11.x today | — |

**Missing dependencies with no fallback:** none — all required tooling is present and verified working in this environment.

**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (not yet installed — greenfield repo; part of this phase's Wave 0) |
| Config file | none yet — `vitest.config.ts` (or a `test` block in `vite.config.ts`) must be created in Wave 0 |
| Quick run command | `npx vitest run --reporter=dot` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHELL-01 | Title bar renders logo/wordmark/"·"/crumb left cluster, spacer, and 3 window controls with correct tokens/metrics applied | unit (React Testing Library render + DOM/class assertions) | `npx vitest run src/shell/TitleBar.test.tsx` | ❌ Wave 0 |
| SHELL-02 (click wiring) | Clicking minimize/maximize/close invokes the correct Tauri window command; only the spacer has `data-tauri-drag-region` | unit (Vitest + `@tauri-apps/api/mocks` `mockIPC`) | `npx vitest run src/shell/WindowControls.test.tsx` | ❌ Wave 0 |
| SHELL-02 (real drag/OS behavior) | Dragging the spacer actually moves the OS window; buttons never swallow clicks in the real compiled app | manual / `checkpoint:human-verify` | — (jsdom cannot drive real OS window drag) | n/a |
| SHELL-03 | 1px borders and 34px bar render crisply at 100/125/150% Windows display scaling | manual / `checkpoint:human-verify` | — (requires real hardware + human visual confirmation) | n/a |
| SHELL-03 (regression proxy) | No CSS in the shell uses hardcoded physical-pixel/`devicePixelRatio` hacks | automatable lint/grep check | `grep -rn "devicePixelRatio\|0\.5px" src/` (expect no matches outside intentional, commented exceptions) | ❌ Wave 0 (add as a CI/pre-commit-style check or a one-off verification script) |
| SHELL-04 | IBM Plex Sans/Mono/Serif render from local bundle; zero requests to Google Fonts domains | automatable (build + grep dist output) | `npm run build && grep -rIl "fonts.googleapis.com\|fonts.gstatic.com" dist/ ; test $? -eq 1` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=dot` (fast, jsdom-only)
- **Per wave merge:** `npx vitest run` (full suite) + the SHELL-04 build/grep check
- **Phase gate:** Full suite green + both `checkpoint:human-verify` items (SHELL-02 real drag, SHELL-03 real DPI scaling) confirmed by the user before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Install `vitest`, `@testing-library/react`, `jsdom` — no test framework exists yet (greenfield repo)
- [ ] `vitest.config.ts` — jsdom environment, path aliases matching `tsconfig.json`
- [ ] `src/shell/TitleBar.test.tsx` — covers SHELL-01
- [ ] `src/shell/WindowControls.test.tsx` — covers SHELL-02 (click-wiring half only)
- [ ] A build-output grep check (script or npm script) — covers SHELL-04
- [ ] Two explicit `checkpoint:human-verify` task entries in the plan for SHELL-02 (real drag) and SHELL-03 (real DPI scaling) — these can never be satisfied by an automated test in this environment

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase 1 has no auth surface |
| V3 Session Management | No | No sessions in this phase |
| V4 Access Control | Yes | Tauri's capability/permission ACL (`capabilities/default.json`) — grant only the specific `core:window:allow-*` permissions listed above, not a blanket broader scope |
| V5 Input Validation | No | No user data input in this phase (window chrome only) |
| V6 Cryptography | No | Not applicable |
| V14 Configuration | Yes | `tauri.conf.json` `security.csp` currently defaults to `null` (no CSP) in the scaffold — out of scope to fix in Phase 1 (no remote/untrusted content loaded), but flag for a future hardening phase once the app loads any external or plugin-supplied content |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Over-broad IPC/window capability grant (e.g. using `core:window:default` catch-all instead of specific `allow-*` permissions) | Elevation of Privilege | Explicit least-privilege permission list scoped to exactly `minimize`/`toggle-maximize`/`close`/`start-dragging`, scoped to the `"main"` window label only |
| Supply-chain risk from a compromised/typosquatted npm dependency executing in the webview's JS context | Tampering | Package Legitimacy Audit above (slopcheck + postinstall-script check) run before any `npm install`; re-run for any new dependency added in later phases |

## Sources

### Primary (HIGH confidence)
- Live scaffold inspection this session (`npm create tauri-app@latest` output at `C:\Users\somed\AppData\Local\Temp\claude\d--Vibe-Coding-Sourcerer\5e295f08-26ca-4b4e-999c-a78babbb7787\scratchpad\scaffold-test\test-app`) — exact resolved versions in `package-lock.json`, `Cargo.toml`, `tauri.conf.json`, `vite.config.ts`, `capabilities/default.json`
- [Tauri v2 — Window Customization](https://v2.tauri.app/learn/window-customization/) — frameless config, drag region, window control JS calls, permissions
- [Tauri v2 — `window` JS API reference](https://v2.tauri.app/reference/javascript/api/namespacewindow/) — `minimize`/`toggleMaximize`/`close`/`isMaximized`/`onResized`/`startDragging` signatures
- [Fontsource — Getting Started / Install](https://fontsource.org/docs/getting-started/install) — exact per-weight/italic CSS subpath import syntax
- [Tauri v2 — Mock Tauri APIs](https://v2.tauri.app/develop/tests/mocking/) and [`mocks` namespace reference](https://v2.tauri.app/reference/javascript/api/namespacemocks/) — `mockIPC`/`mockWindows` for Vitest-based window-control testing
- npm registry direct `npm view <pkg> version` / `time.created` / `scripts.postinstall` queries — package ages, current versions, postinstall-script absence
- `slopcheck` 0.6.1 (`python -m slopcheck scan --pkg npm <name> --json`) — package legitimacy checks, all `OK`

### Secondary (MEDIUM confidence)
- [DeepWiki — tao: DPI and Scaling](https://deepwiki.com/tauri-apps/tao/8.3-dpi-and-scaling) — PerMonitorV2-by-default claim (paraphrased summary of source, not the raw source file itself)
- WebSearch results on `shadow` config behavior (undecorated window 1px white border + Win11 rounded corners), cross-referenced across the Tauri changelog commit (`fix: enable shadows by default, closes #6909`) and multiple GitHub discussion threads
- [github.com/tauri-apps/tauri discussion #5881](https://github.com/tauri-apps/tauri/discussions/5881) and [issue #7664](https://github.com/tauri-apps/tauri/issues/7664) — maximize/minimize event reliability, basis for the `isMaximized()`-on-`onResized` pattern

### Tertiary (LOW confidence)
- [github.com/tauri-apps/tauri issue #11320](https://github.com/tauri-apps/tauri/issues/11320) — single report of `core:window:allow-start-dragging` not taking effect via capability file in some configuration; closed as not-planned, ambiguous root cause. Flagged in Assumptions Log (A2), not treated as established fact.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified by actually running the scaffolder and querying the npm registry directly this session, not from training-data memory
- Architecture: HIGH — official Tauri docs cover the frameless-window/drag-region/window-API mechanics directly and unambiguously
- Pitfalls: MEDIUM-HIGH — the `shadow` pitfall is confirmed via an official changelog commit + docs cross-reference; the DPI-awareness-is-automatic claim and the capability-permission edge case are each backed by a single secondary/tertiary source and are flagged accordingly in the Assumptions Log

**Research date:** 2026-07-07
**Valid until:** ~2026-07-21 (14 days) — shorter than the default 30-day window because this phase depends on exact scaffold-tool output (`npm create tauri-app@latest`), which can silently change its default pinned versions (as already observed once: CLAUDE.md's own guess of "Vite 5.4.x" was already stale by the time this research ran). Re-verify scaffold output immediately before execution if more than a few days have passed.
