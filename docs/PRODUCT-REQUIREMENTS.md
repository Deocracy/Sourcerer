# Sourcerer — Product Requirements

Status: CONFIRMED 2026-08-19. Corrected 2026-08-19: an earlier draft of this
document described v4.0 as an Electron build of Theia IDE and called the
Firefox-fork substrate "abandoned". That decision was never made — the
framing was a drafting error. The authoritative architecture is
`docs/research/sourcerer-architecture.md` (same day), which replaces the
earlier Electron plan. GUI design beyond what R1/R2 require is out of scope
until after v4.0.

**What Sourcerer is:** a Firefox-ESR fork under our own branding, hosting
Theia IDE. In v4.0 **Theia is the only GUI** — the fork boots, supervises a
bundled Theia backend on localhost, and presents Theia full-window. The
custom browser GUI (unified tab strip, toolbar, panels) comes in post-4.0
milestones, and v4.0's internals must be built so those milestones land
without rework.

**Milestone mapping:** `.planning/` tracks milestones, starting fresh at
**v4.0 = Sourcerer 4.0**, covering R1, R2, R3, R4, R4a and R4b. In terms of the
architecture sketch's build order, v4.0 is milestone 1 (fork boots under our
branding) plus milestone 3's Theia integration (supervisor + Theia surface),
with milestone 2's custom tab strip deferred — Theia full-window is the whole
GUI. Versions v1.0–v3.0 are the retired Tauri era, frozen with full git
history at `/home/chris/Vibe Coding/Sourcerer-Archived`. The research under
`docs/research/` is **current and authoritative** for this direction —
`sourcerer-architecture.md` above all.

## v4.0 requirements

- **R1 — Rebrand.** The product ships as **Sourcerer**: application name,
  window title, icon/logo, installer name, plus Theia-side branding (welcome
  tab, about dialog). A full rename is mandatory anyway — Mozilla trademark
  rules require it for any distributed fork.
- **R2 — Own build.** A Firefox-ESR fork we build and package ourselves,
  structured Zen-style: `upstream/` (pinned ESR tag) + `patches/` +
  `sourcerer/` (our tree), with CI that rebases on each ESR point release and
  fails loudly on conflicts. Bundled Node runs the Theia **browser-target**
  backend as a supervised child process on token-authenticated localhost
  (`TheiaService.sys.mjs`: spawn, health-check, restart, kill on quit).
  Theia loads full-window as the sole GUI. The Theia app is its own npm
  workspace pinned to a Theia release (tag decided at build start; local
  reference sources are v1.74.1), shipped as a versioned sidecar in lockstep
  with the browser build. Develop on Linux; Windows/macOS packaging follows.
- **R3 — Extension-based internals, both sides.**
  - *Theia side:* everything we add is our own Theia extensions
    (`@sourcerer/*` packages). We do not fork or patch Theia core; upstream
    Theia releases are adopted by re-pinning.
  - *Firefox side:* our code touches Firefox internals **only** through one
    anti-corruption layer (`SourcererAPI.sys.mjs`), with every internal-API
    touchpoint catalogued in `sourcerer/INTERNAL-APIS.md` and re-tested each
    ESR update. Gecko itself is never modified.
- **R4 — Incremental growth.** Parts are added as we go without rework of
  what came before. The v4.0 internals must not preclude the post-4.0
  requirements below — in particular the Theia surface must be embeddable
  under a future chrome-owned tab model (the mirror/proxy bridge pattern),
  not welded to full-window presentation.
- **R4a — GUI customization bridge ships in v4.0.** One build-once Theia
  extension (`@sourcerer/customize`) exposing a runtime CSS layer
  (userChrome.css equivalent) and a dev-flagged privileged JS layer, so
  post-4.0 Theia GUI work happens at runtime without a rebuild. It changes
  nothing visually by default. Known limits (webview interiors, codicon
  glyphs) to be re-verified against the Firefox-hosted build when R4a is
  planned.
- **R4b — Every Theia tab has a URL (ships in v4.0).** Universal tab
  addressability inside Theia: every widget type — settings, terminals, chat
  views, and any other non-document widget — implements
  `Navigatable.getResourceUri()` under its own scheme (`settings://`,
  `terminal://`, `chat://`, …), with a `NavigatableWidgetOpenHandler`
  registered per scheme so `OpenerService.open(uri)` creates or focuses the
  widget. Addressing works both directions: a tab reports its URL, and a URL
  opens its tab. Implemented as `@sourcerer/*` extension(s) on stable public
  Theia APIs (decision D4 in
  `docs/research/tab-management-research/05-theia-shell-customization.md`).
  URL semantics per type (what the address encodes, whether it is typeable)
  are decided during implementation — cheap now, miserable later. This is
  the reusable prerequisite for the post-4.0 chrome URL bar and unified tab
  strip (R5), and is identical work regardless of where that bar lands.

## Post-4.0 requirements (v4.0 internals must not preclude them)

- **R5 — Web browsing as first-class tabs.** The unified tab strip: web pages
  and Theia editors as peers in one chrome-owned tab model (architecture
  sketch milestones 2 and 4 — `sourcerer.xhtml`, `TabModel`,
  `@sourcerer/browser-bridge`).
- **R6 — Fully customizable GUI.** Every visible element addable, changeable,
  removable, ideally at runtime without a rebuild.
- **R7 — Real-browser capabilities.** Widevine DRM, the WebExtensions host,
  and per-site process isolation are **inherited from the Firefox substrate
  on day one** — this is why the substrate is Firefox, not Electron. The
  post-4.0 work is surfacing them in our GUI: re-hosted extension
  buttons/popups, permission prompts, downloads (sketch milestone 5).
- **R8 — AI integration.** Theia AI is already in the framework; the Firefox
  AI Runtime (local inference from privileged JS) is inherited from the
  substrate. Our own agents/config later.
- **R9 — Extension distribution.** Plugin registry (self-hosted Open VSX)
  when third-party distribution matters.

## Costs accepted with this direction

Perpetual ESR rebase discipline (~4-week cadence, one major rebase per ESR
year) · we own updater infrastructure and an update channel · v4.0 is a
months-scale build, not a weeks-scale rebrand.

## Open items (not yet requirements)

- Opt-in telemetry (wanted; design undecided).
- Enterprise collaboration (@theia/collaboration / OCT) — relevance TBD.
- Docker-based deployment — understanding TBD.

## Explicitly out of scope for now

- Any custom browser GUI in v4.0 — no tab strip, no toolbar, no panels.
  Theia full-window is the entire v4.0 interface. Earlier GUI sketches are
  archived, not decisions.
- Choosing between internal-design options — internals that satisfy R3/R4
  and don't preclude R5–R9 can be designed pre-build, but that design is a
  separate document, not this one.
