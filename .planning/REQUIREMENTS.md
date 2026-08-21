# Requirements: Sourcerer 4.0

**Defined:** 2026-08-19
**Core Value:** A daily-drivable IDE whose substrate is a real browser (DRM, WebExtensions, site isolation inherited from Firefox), built so every later plan — unified tabs, full GUI customization, AI — lands as an addition, never a rework.

## v1 Requirements

Requirements for v4.0. Each maps to roadmap phases.

### Build Infrastructure

- [x] **BUILD-01**: Developer can enter a `theia` Nix dev shell (node 22, yarn 1.x, node-gyp toolchain) and build/run the Theia browser-target app standalone at localhost on the NixOS host
- [x] **BUILD-02**: Developer can enter a `firefox` Nix dev shell (toolchain via `inputsFrom` nixpkgs' firefox-esr unwrapped derivation, no `mach bootstrap`) and build the pinned ESR tag
- [ ] **BUILD-03**: Fork repo is structured as `upstream/` (pinned `FIREFOX_153_1_0esr_RELEASE`) + `patches/` + `sourcerer/` with a documented, CI-ready rebase procedure
- [ ] **BUILD-04**: Developer has a tiered incremental rebuild loop — `./mach run` for the frontend files symlinked into `upstream/` (no build), `./mach build faster` for preprocessed files, full `./mach build` only after a compiled-define change — with the compiled-file boundary enforced by a guard script

### Rebrand

- [ ] **BRAND-01**: Firefox-side identity is Sourcerer (`MOZ_APP_NAME`, `MOZ_APP_DISPLAYNAME`, `MOZ_APP_VENDOR`, distribution id), verified by a named-surface checklist: executable name in `dist/bin`, `application.ini` `Name` and `Vendor`, about:support identity fields, window title, the `.desktop` file's `Name` and `StartupWMClass`, and `--version` output
- [ ] **BRAND-02**: Full replacement `branding/` tree ships (icons, strings) containing no Mozilla trademark assets
- [ ] **BRAND-03**: Profile directory is Sourcerer's own (falls out of `MOZ_APP_NAME`); verified to never touch `~/.mozilla/firefox` on a machine with real Firefox installed
- [ ] **BRAND-04**: Auto-update is disabled and a running build contacts no host outside a documented allowlist — whose only Mozilla entry is the `firefox.settings.services.mozilla.com` Remote Settings carve-out (6-hour poll), with every non-Mozilla host individually waived with a stated reason or disabled
- [x] **BRAND-05**: Theia-side branding (welcome/getting-started widget, About dialog, window/tab title, favicon) ships as a `@sourcerer/*` extension via DI rebind — no Theia core patch
- [ ] **BRAND-06**: Dev builds carry a visible indicator (title suffix or icon badge) distinguishing them from future packaged releases

### Sidecar Supervision

- [ ] **SIDE-01**: `TheiaService.sys.mjs` spawns the bundled Node + Theia browser-target backend at startup via `Subprocess.sys.mjs`, bound explicitly to 127.0.0.1 on an OS-assigned free port (bind port 0, read back)
- [ ] **SIDE-02**: Backend access requires a per-launch token minted before first load; token enforcement verified on plain HTTP requests, not only WebSocket upgrade (CVE-2026-61891 class)
- [ ] **SIDE-03**: A health-check loop gates first load and restarts the backend with backoff on crash
- [ ] **SIDE-04**: Quitting or killing the browser (including SIGKILL) leaves zero orphaned backend processes — process-group kill semantics plus startup cleanup of leftovers
- [ ] **SIDE-05**: Launching Sourcerer a second time focuses the existing window and never spawns a second backend (Firefox's native single-instance behavior preserved)

### Shell Presentation

- [ ] **SHELL-01**: `sourcerer.xhtml` presents one full-window `<browser>` loading Theia; Theia's own shell (menu bar, status bar, tab bar) is the entire UI, unsuppressed — no custom chrome
- [ ] **SHELL-02**: Every Firefox-internals touch goes through `SourcererAPI.sys.mjs` and is catalogued in `sourcerer/INTERNAL-APIS.md`; nothing else imports Firefox internals
- [ ] **SHELL-03**: When the backend dies and restart fails, the user sees a branded, chrome-rendered error state with retry — never a blank/frozen window
- [ ] **SHELL-04**: A diagnostics page (about:sourcerer-style) shows sidecar port, PID, health status, and recent log output
- [ ] **SHELL-05**: The window paints immediately with a loading state and swaps to Theia when the health check passes — window show is not blocked on backend readiness

### Customization Bridge (R4a)

- [x] **CUST-01**: `@sourcerer/customize` loads a runtime user CSS layer after Theia's own styles; empty by default with zero visual change
- [x] **CUST-02**: The privileged JS layer is exposed only when a dev flag is set; with the flag off, no privileged binding exists at runtime

### Universal Tab URIs (R4b)

- [x] **URI-01**: The settings widget has an address under `settings:` with a registered open handler — `OpenerService.open()` opens or focuses it, and the tab reports that address
- [x] **URI-02**: Terminal widgets implement `Navigatable.getResourceUri()` under `terminal:` (per-instance addressing semantics documented)
- [x] **URI-03**: Every other non-document widget type shipped in v4.0 (e.g. Theia AI chat view) has an address under a registered scheme with an open handler — no tab without a URI
- [x] **URI-04**: These URIs are typeable/copy-pasteable, with per-scheme semantics (what the path encodes, open-vs-focus behavior) documented

> **Amended 2026-08-20** (Phase 2 discussion, decision D-38 in
> `.planning/phases/02-sourcerer-theia-extensions/02-CONTEXT.md`). URI-01 and
> URI-03 previously required each widget to *implement
> `Navigatable.getResourceUri()`*. That is unachievable for the widget URI-01
> names: `NavigatableWidget.is()` requires `arg instanceof BaseWidget`
> (`navigatable-types.ts:41`) and is the variant Theia's tab bar calls, while
> `PreferencesWidget extends` Lumino `Panel` (`preference-widget.tsx:35`).
> The requirement now asks for an **address per tab**, delivered by a
> `factoryId → URI` registry; `Navigatable` is implemented only on Terminal
> (URI-02), where the widget is a `BaseWidget`. The canonical URI form is the
> opaque `scheme:path`, not `scheme://` — the authority component is
> lower-cased on serialization and Theia widget ids are not uniformly
> lowercase. `settings://` normalizes to `settings:` either way.

> **Amended 2026-08-21** (Phase 3 discussion, decisions D-70 and D-79 in
> `.planning/phases/03-branded-firefox-fork/03-CONTEXT.md`).
>
> **BUILD-04** previously required "a runnable build in minutes via artifact
> builds (`MOZ_ARTIFACT_REVISION` pinned)". Artifact builds do work for ESR 153
> — the Taskcluster namespace was queried live and returns a downloadable
> `target.tar.xz` — but they cannot produce a *renamed* binary:
> `GeckoJobConfiguration.product` is hardcoded `"firefox"`
> (`upstream/python/mozbuild/mozbuild/artifacts.py:92`), `LinuxArtifactJob`
> installs `firefox/firefox` → `dist/bin/firefox` (`:632`, `:663`), and
> `MOZ_APP_NAME`/`MOZ_APP_VENDOR` are compiled defines baked into the
> downloaded `libxul.so`. BUILD-04 and BRAND-01 could not both hold. The
> requirement now names the tiered incremental loop, which is what already
> works on the dev host. Accepted cost: a clean clone has no
> minutes-to-runnable path — first build is a full compile.
>
> **BRAND-01** previously required that "a search for a residual 'firefox'
> identity string comes back empty". That is unachievable on any correct
> build: a correctly branded, unpackaged build still ships 39 files with
> `firefox` in the filename and 32 more containing the string — all upstream
> feature names — plus 21 update-named files that survive `--disable-updater`.
> The requirement now names the six identity surfaces explicitly, each
> verifiable by a command.
>
> **BRAND-04** previously required that "no Mozilla update or telemetry
> endpoint is reachable from a running build". Remote Settings cannot be
> turned off by pref on a non-Nightly channel — `services/settings/Utils.sys.mjs:52-84`
> refuses any `services.settings.server` override — and the only alternative,
> the `DisableRemoteSettingsAndAcceptSecurityConsequences` policy, also stops
> CRLite certificate-revocation data, intermediate-certificate preloading and
> tracking-protection list updates on a browser substrate. The requirement now
> reads as a documented allowlist with that single named carve-out, and is
> *stricter* than before on third-party hosts: Google Safe Browsing, Google's
> Widevine CDM host and Cisco's OpenH264 host must each be waived with a
> stated reason or disabled (D-83, D-85).

## v2 Requirements

Deferred to post-4.0 milestones. Tracked but not in the current roadmap.

### Chrome & Browsing (R5, R6)

- **CHROME-01**: Unified tab strip — web pages and Theia widgets as peer tabs in a chrome-owned TabModel (mirror/proxy bridge, `@sourcerer/browser-bridge`)
- **CHROME-02**: Chrome URL bar serving both web and IDE tabs, consuming R4b URIs
- **CHROME-03**: Fully customizable GUI beyond the inert R4a seam

### Substrate Surfacing (R7)

- **SURF-01**: Re-hosted WebExtension UI (toolbar buttons, popups, permission prompts, downloads)

### Platform & Distribution

- **DIST-01**: Own update channel/AUS infrastructure
- **DIST-02**: Windows and macOS packaging + CI
- **DIST-03**: Linux distribution (tarball, Flatpak/Flathub)
- **DIST-04**: Open VSX plugin registry (R9)

### AI (R8)

- **AI-01**: Own agents/config on top of Theia AI; Firefox AI Runtime integration

## Out of Scope

| Feature | Reason |
|---------|--------|
| Custom browser chrome (tab strip, toolbar, URL bar, panels) in v4.0 | R5+ milestones; building a bar now means building it twice once the chrome-owned tab model design lands |
| Electron packaging | Never the plan — the Electron framing in an early draft was a drafting error; the Firefox substrate is the point |
| Self-hosted Open VSX registry in v4.0 | R9, post-4.0 — v4.0 ships only bundled `@sourcerer/*` extensions |
| WebExtension UI surfacing in v4.0 | Host ships inertly inside the fork; re-hosted UI is sketch milestone 5 |
| Own auto-update/AUS infrastructure in v4.0 | v4.0 is a single-host dev build; disabling the updater is the v4.0 deliverable |
| Opt-in telemetry pipeline | Open item with undecided design — do not build speculatively; strip Mozilla endpoints only |
| Windows/macOS builds in v4.0 | Linux/NixOS is the only v4.0 dev and delivery target |
| Mobile | Android would be a separate GeckoView product; iOS has no shippable Gecko |
| Patching Theia core or Gecko | Hard rule — anti-corruption layer and DI rebind are the only mechanisms |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUILD-01 | Phase 1 | Complete |
| BUILD-02 | Phase 1 | Complete |
| BRAND-05 | Phase 2 | Complete |
| CUST-01 | Phase 2 | Complete |
| CUST-02 | Phase 2 | Complete |
| URI-01 | Phase 2 | Complete |
| URI-02 | Phase 2 | Complete |
| URI-03 | Phase 2 | Complete |
| URI-04 | Phase 2 | Complete |
| BUILD-03 | Phase 3 | Pending |
| BUILD-04 | Phase 3 | Pending |
| BRAND-01 | Phase 3 | Pending |
| BRAND-02 | Phase 3 | Pending |
| BRAND-03 | Phase 3 | Pending |
| BRAND-04 | Phase 3 | Pending |
| BRAND-06 | Phase 3 | Pending |
| SHELL-01 | Phase 4 | Pending |
| SHELL-02 | Phase 4 | Pending |
| SHELL-05 | Phase 4 | Pending |
| SIDE-01 | Phase 4 | Pending |
| SIDE-02 | Phase 4 | Pending |
| SIDE-03 | Phase 4 | Pending |
| SIDE-04 | Phase 5 | Pending |
| SIDE-05 | Phase 5 | Pending |
| SHELL-03 | Phase 5 | Pending |
| SHELL-04 | Phase 5 | Pending |

**Coverage:**

- v1 requirements: 26 total
- Mapped to phases: 26 ✓
- Unmapped: 0

**Per-phase counts:** Phase 1 = 2, Phase 2 = 7, Phase 3 = 7, Phase 4 = 6, Phase 5 = 4.

**Placement notes:**

- **BRAND-06** (dev-build indicator) sits in Phase 3, not Phase 2: the distinction it draws is between a dev build and a future *packaged release*, which is a Firefox build-configuration concern (app display name / icon variant), not a Theia-side one.
- **SIDE-03** (health-check loop) sits in Phase 4, not Phase 5: its first clause gates first load, which SHELL-05's immediate-paint-then-swap behaviour depends on. Phase 5 owns the failure surfaces around it (orphan cleanup, exhausted-backoff error state), not the loop itself.

---
*Requirements defined: 2026-08-19*
*Last updated: 2026-08-21 — BUILD-04, BRAND-01 and BRAND-04 amended during Phase 3 discussion*
