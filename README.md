# Sourcerer

Sourcerer is Eclipse Theia IDE, rebranded and extended into a research
workbench. Version 4.0 is the first shipped rebrand: the Theia IDE product
template renamed, packaged as an Electron desktop app, with everything we add
living in our own `@sourcerer/*` Theia extensions.

**Status:** pre-build. This repository was reset to a clean slate on 2026-08-19.
Requirements live in [docs/PRODUCT-REQUIREMENTS.md](docs/PRODUCT-REQUIREMENTS.md).

## What v4.0 is

- **R1 — Rebrand.** Application name, window title, icon, welcome tab, about
  dialog, installer name. No other GUI change from Theia default.
- **R2 — Own build.** Built from Theia sources against a pinned release,
  producing an installable Electron desktop app. Linux first.
- **R3 — Extension-based internals.** Everything we add is a `@sourcerer/*`
  Theia extension. Theia core is never forked or patched, so upstream releases
  are adopted by re-pinning.
- **R4 — Incremental growth.** Parts are added one extension at a time.
- **R4a — GUI customization bridge.** One extension exposing a runtime CSS layer
  and a dev-flagged privileged JS layer. Changes nothing visually by default.

Post-4.0 requirements — web browsing as first-class tabs, full GUI
customization, real-browser capabilities, AI integration, extension
distribution — are recorded in the requirements document so the internals do
not preclude them.

## History

Versions 1.0–3.0 were a bespoke Tauri 2 + React desktop shell. That work is
frozen with its full git history at `/home/chris/Vibe Coding/Sourcerer-Archived`.
Nothing from it is a dependency of v4.0.

## License

PolyForm Noncommercial. See [LICENSE](LICENSE).
