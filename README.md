# Sourcerer

A Tauri 2 + React 18 desktop shell: a dockable multi-pane research workbench for
scholars. The shell hosts **applets** (Library, Wiki, Graph, Chat, Notes, Writing
Studio, Power Browser, Kanban, News, KeyPass, Databasise, Applet Builder) plus a
persistent right-hand **Dashboard Assistant**. Applets not yet built render as
high-fidelity demo stubs and are replaced one at a time via the applet registry —
the demo half is a deliberate feature, not debt.

**v1.0 "Desktop Shell MVP" shipped 2026-07-14** — 7 phases, 35 plans: frameless
shell chrome, a dockview-based workspace, persisted named layouts, the applet
framework, the Notes applet (the one real applet, proving registry → host API →
storage → AI seam end to end), the Home dashboard and Assistant panel, and a
headless Pi sidecar behind `host.ai()`.

**v2.0 "Container Platform" is planned but not started.** See
[.planning/research/CONTAINER-PLATFORM-PLAN.md](.planning/research/CONTAINER-PLATFORM-PLAN.md)
— note its host-reality caveat: the plan was written against a Windows + WSL2 host
and the project has since migrated to NixOS.

## Prerequisites

Verified on this host: **Node v24.18.0**, npm 11.16.0.

The Rust/Tauri half does **not** currently build on this Linux machine. It needs:

- a Rust stable toolchain — `rustup default stable` (no default is configured)
- Tauri's Linux system deps — `webkit2gtk-4.1`, `javascriptcoregtk-4.1`,
  `gtk+-3.0`, `libsoup-3.0`, plus `pkg-config` (none are present)

There is no `flake.nix` yet; a repo-root dev shell is a v2.0 P1 deliverable, which
is the intended fix for the above rather than imperative installs.

## Commands

    npm ci               # required first — never `npm install`, see below
    npx vitest run       # unit tests once (`npm test` is bare vitest = watch mode)
    npm run build        # tsc && vite build
    npm run tauri dev    # needs the Rust toolchain + system deps above
    cd sidecar && npm test

Use `npm ci`, not `npm install`: `package.json` floats several deps behind carets
(`vite: ^7.0.4`, `@tauri-apps/api: ^2`) while the lockfile pins the exact set v1.0
was verified against. React is pinned hard at 18.2.0 and must not drift to 19 —
see CLAUDE.md for why.

## Layout

    src/                      React shell, applets, assistant
    src-tauri/                Rust backend (window, store plugin, ai_complete seam)
    sidecar/                  headless Pi agent process behind host.ai()
    .planning/                GSD planning artifacts (phases, research, milestones, spikes)
    design-sync-setup-guide/  design handoff — the visual source of truth
