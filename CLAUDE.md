# CLAUDE.md — Sourcerer

## Project

**Sourcerer 4.0** is Eclipse Theia IDE, rebranded and built as our own product.
It is *not* a fork of the Theia framework — it is our own npm workspace pinned
to a Theia release, composing `@theia/*` packages plus our own `@sourcerer/*`
extensions, packaged as an Electron desktop app.

Authoritative requirements: `docs/PRODUCT-REQUIREMENTS.md` (R1–R9, CONFIRMED
2026-08-19). Read it before planning any work.

**This repo was reset to a clean slate on 2026-08-19 and has no code yet.**
The v1.0–v3.0 Tauri era is frozen at `/home/chris/Vibe Coding/Sourcerer-Archived`
with its full 360-commit history. That tree is reference only — none of its
stack decisions carry forward (Tauri, React 18, dockview, zustand, the
pixel-perfect token system, the Pi/Databasise assistant sidecar).

## Hard rules

- **Never fork or patch Theia core.** Everything we add is a `@sourcerer/*`
  Theia extension composed into the product. This is precisely what makes
  upstream Theia releases adoptable by re-pinning.
- **No GUI change beyond the rename in v4.0.** R1 is explicit: app name, icon,
  window title, welcome tab, about dialog, installer name. Everything else stays
  default Theia. GUI design is a post-4.0 conversation.
- **Consume `@theia/*` as npm dependencies.** Never vendor the framework
  monorepo.

## Environment

This repo lives at `/home/chris/coding/sourcerer` — **a path with no spaces, on
purpose.** The previous location was under `Vibe Coding`, and that space broke
the linker inside the Nix dev shell: `mkShell` appends `-rpath
$PWD/outputs/out/lib` to the space-separated `NIX_LDFLAGS`, the cc-wrapper
splits it on the space, and every native link step fails with a bogus path.
Theia's build compiles native modules through node-gyp, which drives that same
linker. **Do not move this repo back under a path containing a space.**

Reference checkouts:
- Theia framework sources, v1.74.1, read-only: `/home/chris/Vibe Coding/TheiaIDE/sources/`
- Frozen pre-4.0 tree: `/home/chris/Vibe Coding/Sourcerer-Archived`

## Conventions

Not yet established — this is a fresh tree. Populate as patterns emerge.

## Architecture

Not yet built. Follow `docs/PRODUCT-REQUIREMENTS.md`.

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD
command so planning artifacts and execution context stay in sync.

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly
asks to bypass it.
