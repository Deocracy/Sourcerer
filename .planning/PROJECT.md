# Sourcerer

## What This Is

Sourcerer is a Firefox-ESR fork under its own branding that hosts Eclipse Theia
IDE. Version 4.0 boots the branded fork, supervises a bundled Node + Theia
browser-target backend on localhost, and presents Theia full-window as the only
GUI. Post-4.0 milestones rebuild the browser chrome around it (unified tab
strip where web pages and editors are peers), which is why the substrate is
Firefox and not Electron.

## Core Value

A daily-drivable IDE whose substrate is a real browser (DRM, WebExtensions,
site isolation inherited from Firefox), built so every later plan — unified
tabs, full GUI customization, AI — lands as an addition, never a rework.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] R1 — Rebrand: Sourcerer name, window title, icon, installer name, Theia
      welcome tab and about dialog
- [ ] R2 — Own build: Zen-style Firefox-ESR fork (upstream/ + patches/ +
      sourcerer/) with bundled Node + Theia browser-target backend as a
      supervised localhost sidecar; Theia full-window as sole GUI; builds and
      runs on the NixOS dev host
- [ ] R3 — Extension-based internals: all Theia-side code as @sourcerer/*
      extensions (never fork/patch Theia core); all Firefox-internal touches
      through the single anti-corruption layer (SourcererAPI.sys.mjs) with a
      touchpoint catalogue (INTERNAL-APIS.md)
- [ ] R4 — Incremental growth: nothing welds Theia to full-window
      presentation; the mirror/proxy bridge and chrome-owned tab model stay
      landable without rework
- [ ] R4a — Customization bridge: @sourcerer/customize exposing a runtime CSS
      layer and dev-flagged privileged JS layer, visually inert by default
- [ ] R4b — Every Theia tab has a URL: all widget types (settings, terminals,
      chat views, …) implement Navigatable.getResourceUri() under their own
      schemes with per-scheme open handlers, so tabs report URLs and URLs open
      tabs

### Out of Scope

- Custom browser GUI in v4.0 (tab strip, toolbar, URL bar, panels) — post-4.0
  milestones per the architecture sketch's build order; Theia full-window is
  the entire v4.0 interface
- Electron packaging — never the plan; the Electron framing in an early
  requirements draft was a drafting error, corrected 2026-08-19
- Windows/macOS packaging in v4.0 — v4.0's finish line is a daily-drivable
  dev build on the Linux/NixOS host; installers and multi-platform CI are a
  later milestone
- Firefox extension (WebExtensions) UI surfacing in v4.0 — the host ships
  inside the fork but re-hosted extension UI is sketch milestone 5
- Mobile — Android would be a separate GeckoView product; iOS has no
  shippable Gecko

## Context

- Authoritative requirements: docs/PRODUCT-REQUIREMENTS.md (R1–R9, CONFIRMED
  2026-08-19, corrected same day). Authoritative architecture:
  docs/research/sourcerer-architecture.md. Supporting research in
  docs/research/ (extension model D1–D7, GUI customizability G1–G5,
  tab-management studies, Firefox-vs-Electron substrate research) is current,
  not legacy.
- The v1.0–v3.0 Tauri era is frozen at
  /home/chris/Vibe Coding/Sourcerer-Archived (360 commits). Reference only.
- Theia framework sources v1.74.1 read-only at
  /home/chris/Vibe Coding/TheiaIDE/sources/; the Theia tag to pin is decided
  at build start.
- Dev host is NixOS (host "legion"). The repo path is deliberately
  space-free (/home/chris/coding/sourcerer) — a space in the path breaks
  NIX_LDFLAGS in the Nix dev shell and fails every native link step.
- Build strategy (established 2026-08-19): the Theia sidecar and the Firefox
  fork are decoupled builds. Theia browser-target runs standalone at
  localhost in any browser, so R1(Theia-side)/R4a/R4b iterate with yarn watch
  and no Firefox build in the loop. The Firefox side uses artifact builds
  (--enable-artifact-builds) since we never modify compiled Gecko code —
  minutes, not hours, and it sidesteps most of the C++/Rust toolchain on
  NixOS. Full compiles happen in CI (crib Zen/Floorp). Nix flake with two dev
  shells: theia (node 22, yarn 1.x, node-gyp toolchain) and firefox
  (inputsFrom nixpkgs' firefox-esr unwrapped derivation; mach bootstrap does
  not work on NixOS). Verify all package names against the nixos MCP when
  writing the flake.

## Constraints

- **Tech stack**: Firefox ESR (pinned tag) + Theia (pinned release, browser
  target) — the substrate decision is final; it exists to inherit DRM,
  WebExtensions, and site isolation that Electron cannot provide
- **Upstream discipline**: Gecko never modified; Theia core never
  forked/patched — updates must stay cheap (ESR rebase ~4-weekly via CI;
  Theia upgrades by re-pinning)
- **Platform**: Linux/NixOS is the only dev and delivery target for v4.0
- **Trademark**: full rename required for any distributed Firefox fork
  (already satisfied by R1)
- **Sidecar lockstep**: browser and Theia sidecar always ship/update
  together so the bridge never meets a mismatched Theia

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Firefox-ESR fork, not Electron | R7 capabilities (DRM, WebExtensions, site isolation) need Firefox's toolkit; starting on Firefox avoids a substrate swap later | — Pending |
| Theia full-window is the only v4.0 GUI | Ships the substrate + IDE with months-scale fork cost but zero custom chrome; sketch milestones 2/4+ add the chrome later | — Pending |
| Theia consumed as npm workspace sidecar | Survives substrate work untouched; upgrades by re-pinning | — Pending |
| R4b (universal Theia tab URIs) pulled into v4.0 | Research decision D4: reusable under any later layer split; prerequisite for chrome URL bar and unified tab strip | — Pending |
| Artifact builds for local Firefox dev | We never touch compiled code, so downloading prebuilt Gecko turns builds into minutes and dodges NixOS toolchain friction | — Pending |
| v4.0 done = daily-drivable dev build on the NixOS host | Packaging/installers deferred to a later milestone | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-22 — Phase 3 (branded-firefox-fork) complete: 5/5 roadmap success criteria verified, BRAND-06 closed after human re-verification PASS. R1's Firefox-side rebrand (name, title, icons, dev/release variants) is built and verified; R1 stays Active until the Theia-side surfaces and installer naming land.*
