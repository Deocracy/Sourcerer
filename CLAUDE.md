# CLAUDE.md — Sourcerer

## Project

**Sourcerer 4.0** is a Firefox-ESR fork under our own branding, hosting Eclipse
Theia IDE. In v4.0 **Theia is the only GUI**: the fork boots, supervises a
bundled Node + Theia browser-target backend on localhost, and presents Theia
full-window. The custom browser GUI (unified tab strip, toolbar, panels) is
post-4.0; v4.0 internals must be built so those milestones land without rework.

Authoritative requirements: `docs/PRODUCT-REQUIREMENTS.md` (R1–R9, CONFIRMED
2026-08-19). Authoritative architecture: `docs/research/sourcerer-architecture.md`.
Read both before planning any work. (An earlier draft of the requirements doc
described an Electron target and called the Firefox substrate abandoned — that
was a drafting error, corrected 2026-08-19. No Electron decision ever existed.)

**This repo was reset to a clean slate on 2026-08-19 and has no code yet.**
The v1.0–v3.0 Tauri era is frozen at `/home/chris/Vibe Coding/Sourcerer-Archived`
with its full 360-commit history. That tree is reference only — none of its
stack decisions carry forward (Tauri, React 18, dockview, zustand, the
pixel-perfect token system, the Pi/Databasise assistant sidecar).

## Hard rules

- **Never fork or patch Theia core.** Everything we add on the Theia side is a
  `@sourcerer/*` Theia extension composed into the sidecar app. Upstream Theia
  releases are adopted by re-pinning.
- **Consume `@theia/*` as npm dependencies.** Never vendor the framework
  monorepo.
- **Never modify Gecko.** The Firefox fork is a Zen-style patch-set repo
  (`upstream/` ESR tag + `patches/` + `sourcerer/` tree). Our code touches
  Firefox internals only through the single anti-corruption layer
  (`SourcererAPI.sys.mjs`); every internal-API touchpoint is catalogued in
  `sourcerer/INTERNAL-APIS.md`.
- **Theia is the only GUI in v4.0.** No custom browser chrome — no tab strip,
  toolbar, or panels. Those are post-4.0 milestones.
- **Design for the bridge.** Nothing in v4.0 may weld Theia to full-window
  presentation; the mirror/proxy bridge pattern (chrome-owned tab model,
  `@sourcerer/browser-bridge`) must remain landable without rework.

## Environment

This repo lives at `/home/chris/coding/sourcerer` — **a path with no spaces, on
purpose.** The previous location was under `Vibe Coding`, and that space broke
the linker inside the Nix dev shell: `mkShell` appends `-rpath
$PWD/outputs/out/lib` to the space-separated `NIX_LDFLAGS`, the cc-wrapper
splits it on the space, and every native link step fails with a bogus path.
Both the Firefox build and Theia's node-gyp native modules drive that same
linker. **Do not move this repo back under a path containing a space.**

Reference checkouts:
- Theia framework sources, v1.74.1, read-only: `/home/chris/Vibe Coding/TheiaIDE/sources/`
- Frozen pre-4.0 tree: `/home/chris/Vibe Coding/Sourcerer-Archived`

## Conventions

Not yet established — this is a fresh tree. Populate as patterns emerge.

## Architecture

Not yet built. Follow `docs/research/sourcerer-architecture.md` and
`docs/PRODUCT-REQUIREMENTS.md`.

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD
command so planning artifacts and execution context stay in sync.

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly
asks to bypass it.
