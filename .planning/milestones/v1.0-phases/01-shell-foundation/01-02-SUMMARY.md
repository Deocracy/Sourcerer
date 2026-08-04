---
phase: 01-shell-foundation
plan: 02
subsystem: title-bar
tags: [tauri, react18, window-controls, drag-region, css-modules, tokens, tdd-green, fonts]
requires:
  - "01-01: app-shell grid (34px/1fr), tokens.css, per-weight IBM Plex bundle, RED SHELL-01/02 specs, window capability ACL"
provides:
  - "34px custom title bar: LogoCluster (logo ring+dot + Sourcerer wordmark + · + Home crumb) → flex drag-spacer → WindowControls"
  - "WindowControls wired to @tauri-apps/api/window (minimize / toggleMaximize / close), silent-fail to console"
  - "useMaximizedState hook: isMaximized() re-queried on onResized, stateless (D-02), guards non-Tauri context"
  - "verify:fonts npm script — repeatable SHELL-04 build-output gate (no Google Fonts, local IBM Plex bundled)"
affects:
  - "Plan 01-03 (human-verify checkpoints: real window drag, DPI crispness, visual fidelity)"
  - "Phases 2/3/6 (add LAYOUTS / rail-cycle / assistant-toggle chrome into the spacer space)"
tech-stack:
  added: []
  patterns:
    - "getCurrentWindow() deferred to click-time (withWindow guard) so render outside Tauri/mock context can't crash"
    - "isMaximized()-on-onResized state tracking (RESEARCH Pattern 2) — no store, no maximize-event trust (Pitfall 4)"
    - "data-tauri-drag-region on the flex spacer ONLY (Pitfall 3 / T-01-03)"
key-files:
  created:
    - src/shell/LogoCluster.tsx
    - src/shell/LogoCluster.module.css
    - src/shell/TitleBar.tsx
    - src/shell/TitleBar.module.css
    - src/shell/WindowControls.tsx
    - src/shell/WindowControls.module.css
    - src/shell/useMaximizedState.ts
    - scripts/verify-fonts.mjs
  modified:
    - src/app/AppShell.tsx
    - src/app/AppShell.module.css
    - package.json
decisions:
  - "D-02 honored: maximize/restore icon+aria-label driven by isMaximized() on onResized; zero zustand imports in src/"
  - "verify:fonts implemented as cross-platform node script (not grep) so the SHELL-04 gate runs identically on Windows/CI"
  - "getCurrentWindow() deferred to click-time + guarded in useMaximizedState so TitleBar.test (no window mocks) renders WindowControls without crashing"
metrics:
  duration_min: 14
  completed: 2026-07-07
requirements: [SHELL-01, SHELL-02, SHELL-04]
---

# Phase 1 Plan 02: Title Bar Slice Summary

Built the interactive title-bar slice that turns plan 01-01's RED SHELL-01/02 specs green: a pixel-perfect 34px bar composing LogoCluster (left) → flex drag-spacer → WindowControls (right), with window controls wired directly to the Tauri window API and a stateless maximize/restore indicator driven by `isMaximized()` re-queried on resize. Added a repeatable `verify:fonts` gate proving the production build ships zero network-font references.

## What Was Built

**Task 1 — LogoCluster + TitleBar composition (commit 09fb2c1; CSS reconciled in 0d2d8cc)**
- `LogoCluster.tsx/.module.css`: 15px SVG logo ring (1.5px stroke) + 5px dot in accent `--color-fg`, "Sourcerer" wordmark (Plex Mono 12px, `--ls-wordmark` 0.08em), "·" separator, "Home" crumb (11px, dim `--color-dim`); 9px cluster gap; `openHome` click stub (console). Carries NO drag-region.
- `TitleBar.tsx/.module.css`: 34px bar, 12px left inset, 1px `--color-line` bottom border, flat `--color-bg`, radius 0. Composition = LogoCluster → `div.spacer[data-tauri-drag-region]` (the ONLY drag region) → WindowControls. LAYOUTS / rail-cycle / assistant-toggle intentionally NOT rendered (UI-SPEC Phase Boundary Note).
- `AppShell.tsx/.module.css`: mounts `<TitleBar/>` into grid row 1; dead `.titleRow` placeholder removed.

**Task 2 — WindowControls + useMaximizedState (commit 1edbd0c; CSS/guard reconciled in 0d2d8cc)**
- `useMaximizedState.ts`: on mount calls `getCurrentWindow().isMaximized()`, subscribes via `onResized` to re-query on every resize (RESEARCH Pattern 2 / Pitfall 4 — Aero Snap & double-click bypass the button; maximize events unreliable standalone). Cleans up the unlisten fn; no zustand/store (D-02). Guarded so a non-Tauri/unmocked render degrades silently.
- `WindowControls.tsx/.module.css`: three 46×34 buttons (`—` / 10×10 1px-border square div / `✕`) firing `minimize()` / `toggleMaximize()` / `close()` via a click-time `withWindow` guard with `.catch(console.error)` (silent-fail per UI-SPEC). Maximize `aria-label` toggles "Maximize window" ⇄ "Restore window" off the hook's state. Flat hover shifts only: minimize→panel bg + fg-mid glyph, maximize→panel bg, close→danger-hover bg + accent glyph. No transitions/shadows.

**Task 3 — SHELL-04 no-network-fonts gate (commit caf40cf)**
- `scripts/verify-fonts.mjs`: scans `dist/` text assets for `fonts.googleapis.com`/`fonts.gstatic.com`, asserts local `ibm-plex-*.woff2` present, exits 1 on any violation. Cross-platform node (no grep dependency).
- `package.json`: `verify:fonts` = `npm run build && node scripts/verify-fonts.mjs`.

## Verification Evidence

- `npm run test -- --run`: **2 files / 6 tests passed** — SHELL-01 (TitleBar structure + drag-region-on-spacer-only) and SHELL-02 (minimize/toggle_maximize/close IPC per click) specs now **GREEN** (were RED at 01-01 end).
- `npm run build`: compiles clean (tsc + vite); 160 kB JS, fonts bundled to `dist/assets/*.woff2`.
- `npm run verify:fonts`: **PASS — no external font references; 76 local IBM Plex assets bundled** (SHELL-04).
- `grep -rn "zustand" src/`: **none** (D-02 stateless).
- `data-tauri-drag-region` in non-test src: exactly one live occurrence, on `TitleBar` spacer (T-01-03).

## Deviations from Plan

### Auto-fixed / adjustments

**1. [Rule 1 - Bug] Test-isolation crash from render-time getCurrentWindow()**
- **Found during:** Task 2 full-suite run. In the combined suite, `TitleBar.test.tsx` renders `<TitleBar/>` (→ WindowControls → useMaximizedState) with NO window mocks; `getCurrentWindow()` threw synchronously, producing unhandled errors that failed all 3 TitleBar tests (they passed in isolation only because WindowControls.test provides mocks).
- **Fix:** Guarded `useMaximizedState`'s effect in try/catch (silent console degrade) and deferred `getCurrentWindow()` in WindowControls to click-time via a `withWindow` wrapper. Both degrade cleanly outside a live/mocked Tauri context — consistent with the UI-SPEC "fail silently for native chrome" rule.
- **Commits:** 1edbd0c (initial guard), 0d2d8cc (withWindow reconciliation).

**2. [process] CSS-module class-name reconciliation (commit 0d2d8cc)**
- The title-bar TSX components were revised (intentional edit) to reference class names (`.titleBar`, `.minimize`, `.maximize`, `.maximizeGlyph`, `.close`) that differed from the class names in the originally-committed CSS modules (`.bar`, `.button`, `.minGlyph`, `.maxGlyph`). CSS modules resolve unknown keys to `undefined` silently, so tests stayed green but styling would have broken (pixel fidelity lost). Reconciled the CSS module files to the component-referenced names, preserving all token-driven values.

**3. [process] verify:fonts implemented as node, not grep**
- Task 3's plan verify literally names a `grep` gate. On Windows/PowerShell `grep` isn't reliably present, so the reusable `verify:fonts` script is a cross-platform node scanner instead (same PASS/FAIL semantics: zero Google-Fonts references + local woff2 present). The one-off grep still works where a POSIX shell exists.

## Follow-ups for 01-03 / later
- Real OS window drag on the spacer, DPI crispness at 100/125/150%, and visual pixel-fidelity remain the `checkpoint:human-verify` items in plan 01-03 (jsdom cannot cover them).
- SHELL-02's live minimize/maximize/close behavior against a real window is confirmed only via mockIPC here; verify at first live launch (01-03).

## Self-Check: PASSED
All 8 created + 3 modified key files exist on disk; commits 1edbd0c, 09fb2c1, caf40cf, 0d2d8cc all present in git history.
