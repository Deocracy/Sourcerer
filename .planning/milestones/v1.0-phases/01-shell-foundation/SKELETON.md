# Walking Skeleton — Sourcerer (Desktop Shell)

**Phase:** 1
**Generated:** 2026-07-07

## Capability Proven End-to-End

> One sentence: the smallest user-visible capability that exercises the full stack.

A user launches Sourcerer via the dev loop and sees a frameless single window with a pixel-perfect 34px custom title bar (logo + "Sourcerer" wordmark + "·" + "Home" crumb, rendered in locally-bundled IBM Plex Mono), can minimize / maximize / restore / close it through the custom controls wired to the Tauri window API, and can drag the window by the title-bar spacer only.

This proves the full desktop stack: Tauri Rust core (frameless window, capability ACL) → Vite/React 18 render → locally-bundled fonts → `@tauri-apps/api/window` IPC → native OS window operations — with zero network font loading.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Tauri 2.11.x + React 18.2.0 + Vite (scaffolder pin, ~7.3.6) + TypeScript 5.8.x | Handoff-mandated (CLAUDE.md). React pinned to 18.2.0 explicitly — scaffold defaults to 19 and MUST be overridden (D-03). Vite version is whatever `npm create tauri-app@latest` ships; do NOT hand-pick Vite 8. |
| Window chrome | Frameless: `decorations: false` **AND** `shadow: false` in `tauri.conf.json` | `decorations:false` gives the custom title bar; `shadow` defaults to `true`, which silently adds a 1px white OS border + Win11 auto-rounded corners — both violate the `#1E1F22` border + 0-radius spec (RESEARCH Pitfall 1). |
| Window IPC / security | Least-privilege capability file: `core:window:allow-minimize`, `allow-toggle-maximize`, `allow-close`, `allow-start-dragging`, scoped to `windows:["main"]` | ASVS V4 Access Control — grant only the specific window ops needed, never `core:window:default` catch-all (RESEARCH Security Domain). |
| Maximize/restore state | `isMaximized()` re-queried on every `onResized` event (no Zustand — D-02) | Maximize-family events are unreliable standalone; Aero Snap / double-click / OS shortcuts bypass the button handler (RESEARCH Pattern 2 / Pitfall 4). Phase 1 stays stateless; Zustand deferred to Phase 2. |
| Fonts | `@fontsource/ibm-plex-{sans,mono,serif}` per-weight subpath imports, bundled by Vite into `dist/` | No runtime Google Fonts fetch (SHELL-04). Budget: Sans 400/500/600 · Mono 400/500 · Serif 400 + 400-italic. All three families bundled now even though Phase 1 chrome uses only Mono 400 — later phases need them without a second font pass (D-01/D-03). |
| Styling | CSS Modules (`*.module.css`) + a single full `tokens.css` (all UI-SPEC colors/metrics/type as CSS custom properties) | Bespoke pixel-perfect design — no component library, no Tailwind (CLAUDE.md). `tokens.css` authored in full now (D-01) so Phases 2-6 mount into a real foundation. |
| DPI correctness | Do nothing special — trust `tao`'s default Per-Monitor-V2 awareness; author every metric in logical CSS px | Hand-rolled `devicePixelRatio` / `0.5px` hacks are the documented cause of blur, not the fix (SHELL-03, RESEARCH Pitfall / Don't-Hand-Roll). |
| Directory layout | `src/app/` (AppShell + grid), `src/shell/` (TitleBar, LogoCluster, WindowControls), `src/styles/tokens.css`, `src/fonts.ts` (single font import point); `src-tauri/` (config + capabilities) | Follows RESEARCH Recommended Project Structure and CLAUDE.md CSS-Modules convention. |
| Test runner | Vitest + @testing-library/react + jsdom; window IPC asserted via `@tauri-apps/api/mocks` `mockIPC` | Fast jsdom-level coverage for SHELL-01/02/04; real DPI + real drag are human-verify (jsdom cannot drive OS window ops). |
| Dev loop | `npm run tauri dev` (scaffolder default) | The sibling Databasise `cargo run` landmine was sidecar/venv-specific and does NOT apply here (no Python in Phase 1). Verify the standard loop launches early; fall back only if it demonstrably misbehaves (RESEARCH Pitfall 5 / A3). |

## Stack Touched in Phase 1

- [x] Project scaffold (Tauri + Vite + React 18 + TS, lint, Vitest test runner)
- [x] Routing — N/A for a single-window shell; the app-shell grid (`34px 1fr`) is the single mount surface every later phase fills
- [x] "Data layer" — N/A in Phase 1 (deliberately stateless per D-02; persistence is Phase 3). The full-stack read/write proven instead is the **native window state round-trip**: `isMaximized()` query → OS → `onResized` event → React re-render
- [x] UI — window controls (minimize/maximize/close) wired to `@tauri-apps/api/window`; drag-region on the spacer
- [x] Deployment / run — `npm run tauri dev` launches the frameless window; `npm run tauri build` compiles clean

## Out of Scope (Deferred to Later Slices)

> Explicit — prevents future phases from re-litigating Phase 1's minimalism.

- The "◱ LAYOUTS" menu button (PERS-02 / Phase 3), rail-cycle button (RAIL-01 / Phase 2), assistant-toggle button (ASST-* / Phase 6) — the spacer's flex-basis absorbs their future space; **no placeholder chrome now** (UI-SPEC Phase Boundary Note)
- Zustand / any shell state store (Phase 2 — dock tree)
- Left rail, dock tree, tabs, splits, focus model (Phase 2)
- Persistence, schema versioning, named layouts (Phase 3)
- Applet framework, registry, `host` API, demo stubs (Phase 4)
- Notes applet + real `host.storage` / `host.ai()` (Phase 5)
- Dashboard Assistant panel + metro Home dashboard (Phase 6) — the `1fr` body stays an empty flat `#0A0A0B` panel in Phase 1, no "coming soon" text
- `@tauri-apps/plugin-sql`, CSP hardening, installer/packaging (later milestones)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2 — Workspace Core:** left rail (3 modes) + dock tree (tabs, 5-zone docking, splits, focus) mounted into the `1fr` body; introduces the Zustand shell store
- **Phase 3 — Persistence & Layouts:** crash-safe workspace persistence via `tauri-plugin-store`, schema versioning, named layouts
- **Phase 4 — Applet Framework:** static registry + `host` API seam + high-fidelity demo stubs
- **Phase 5 — Notes Applet:** first real applet proving registry → host → storage → ai loop
- **Phase 6 — Dashboard Assistant & Home:** right-panel assistant + metro Home dashboard filling the empty body
