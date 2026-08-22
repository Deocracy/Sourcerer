# Roadmap: Sourcerer 4.0

## Overview

Sourcerer 4.0 is built as two decoupled halves that meet at the end. The Nix
flake comes first because the NixOS Firefox toolchain is the project's highest
unknown and it blocks everything. With both dev shells proven, the Theia side
(branding, customization seam, universal tab URIs — all `@sourcerer/*`
extensions, iterated with `yarn watch` and no Firefox in the loop) and the
Firefox side (vendored ESR fork, full rebrand, artifact builds) proceed in
parallel. They converge when `sourcerer.xhtml` replaces `browser.xhtml` and
`TheiaService.sys.mjs` supervises the sidecar behind the `SourcererAPI`
anti-corruption layer, producing a window that is nothing but Theia. The final
phase makes that window survive crashes and kills without orphaning processes
or freezing. v4.0 is done when it is daily-drivable on the NixOS host.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Build Infrastructure** - Nix flake with `theia` and `firefox` dev shells; both halves build from a clean checkout on the NixOS host (completed 2026-08-20)
- [x] **Phase 2: Sourcerer Theia Extensions** - `@sourcerer/*` extensions deliver branding, the inert customization seam, and a URI for every tab (completed 2026-08-20)
- [ ] **Phase 3: Branded Firefox Fork** - Vendored ESR fork rebranded to Sourcerer, iterated via the tiered incremental rebuild loop, trademark- and telemetry-free
- [ ] **Phase 4: Full-Window Theia Shell** - `sourcerer.xhtml` + `SourcererAPI` + `TheiaService`: one window, Theia is the entire UI, backend spawned and token-gated
- [ ] **Phase 5: Lifecycle & Failure Hardening** - Zero orphaned processes, single-instance behaviour, branded error state, diagnostics page

## Phase Details

### Phase 1: Build Infrastructure

**Goal**: A developer on the NixOS host can build and run both halves of Sourcerer from a clean checkout, without `mach bootstrap` and without out-of-shell setup.
**Depends on**: Nothing (first phase)
**Requirements**: BUILD-01, BUILD-02
**Success Criteria** (what must be TRUE):

  1. Developer runs `nix develop .#theia` plus one documented command and a stock Theia browser-target IDE loads at a localhost URL in any browser
  2. Developer runs `nix develop .#firefox` and builds the pinned `FIREFOX_153_1_0esr_RELEASE` tag into a launchable stock Firefox, never invoking `mach bootstrap`
  3. Native modules compile inside the `theia` shell against the single pinned Node 22 version — the node-gyp path is proven by a real build, not assumed
  4. A second fresh clone on the NixOS host reaches both of the above with the documented commands and no manual steps outside the shells

**Plans**: 4/4 plans complete

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Tracer: both dev shells enter on the real host; Wave 0 smoke harness, `.mozconfig`, and the D-13 toolchain baseline

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Stock Theia 1.74.1 yarn workspace; `node-pty` compiled against pinned Node 22; IDE boots at localhost (BUILD-01)
- [x] 01-03-PLAN.md — `upstream/` materialized at `FIREFOX_153_1_0esr_RELEASE`; full non-artifact Gecko compile launches (BUILD-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-04-PLAN.md — `docs/BUILD.md` + README pointer, proven by a second fresh clone (success criterion 4)

### Phase 2: Sourcerer Theia Extensions

**Goal**: The standalone Theia app is Sourcerer-branded, exposes an inert customization seam, and gives every tab a URL — entirely via `@sourcerer/*` extensions with Theia core untouched.
**Depends on**: Phase 1
**Requirements**: BRAND-05, CUST-01, CUST-02, URI-01, URI-02, URI-03, URI-04
**Success Criteria** (what must be TRUE):

  1. Opening the standalone app shows Sourcerer identity in the welcome/getting-started widget, About dialog, window/tab title, and favicon — no "Theia" or "Eclipse" left in user-visible chrome
  2. Diffing the workspace against the pinned Theia release shows zero changes inside `@theia/*`; all branding arrives by DI rebind from `@sourcerer/*`
  3. A user CSS file dropped into the customize layer restyles the running app; with that file empty the app renders identically to stock Theia, and with the dev flag off no privileged JS binding exists at runtime
  4. Copying the URI off a settings tab, a terminal tab, or the AI chat view and passing it to `OpenerService.open()` opens or focuses that exact tab — no shipped widget type reports an empty resource URI
  5. Per-scheme semantics (what the path encodes, open-vs-focus behaviour) are documented and the URIs can be typed by hand

**Plans**: 7/7 plans executed

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Tracer: first `@sourcerer/*` extension end-to-end (workspace glob, `theiaExtensions` discovery, branded title + favicon, headless proof)

**Wave 2**

- [x] 02-02-PLAN.md — Wave 0 verification harness: core-diff, dev-flag-off, URI round-trip, phase driver
- [x] 02-03-PLAN.md — Branding completion: Sourcerer welcome widget and About dialog by rebind

**Wave 3**

- [x] 02-04-PLAN.md — Package set 11 → 49, install audit, first-boot AI layout rebinds, BUILD.md

**Wave 4**

- [x] 02-05-PLAN.md — `@sourcerer/customize`: user CSS layer and the flag-gated privileged JS layer

**Wave 5**

- [x] 02-06-PLAN.md — `@sourcerer/tab-uris`: registry plus the `view:` and `settings:` open handler

**Wave 6**

- [x] 02-07-PLAN.md — `terminal:` addressing, existing-scheme coverage, and `docs/URI-SCHEMES.md`

### Phase 3: Branded Firefox Fork

**Goal**: A Sourcerer-identity Firefox-ESR fork that rebuilds in minutes, carries no Mozilla trademark asset or endpoint, and can be rebased onto a new ESR tag by a documented procedure.
**Depends on**: Phase 1
**Requirements**: BUILD-03, BUILD-04, BRAND-01, BRAND-02, BRAND-03, BRAND-04, BRAND-06
**Success Criteria** (what must be TRUE):

  1. Six identity surfaces each report Sourcerer, verified by command: executable name in `dist/bin`, `application.ini` `Name` and `Vendor`, about:support identity fields, window title, the `.desktop` file's `Name` and `StartupWMClass`, and `--version` output (an open `grep -ri firefox` is not the check — 39 filenames and 32 further occurrences are upstream feature names that survive a correct build)
  2. The repo is laid out as `upstream/` (pinned tag) + `patches/` + `sourcerer/`, and the documented rebase procedure replays the patch stack onto a new ESR tag, failing loudly on conflict rather than silently dropping a patch
  3. `scripts/check-patch-surface.sh` exits non-zero on a deliberately-planted compiled-file patch (working positive control), and the tiered loop's timings — `./mach run` for symlinked frontend files, `./mach build faster` for preprocessed files, full build after a compiled-define change — are re-measured on the dev host at phase end and recorded in `docs/BUILD.md` with date and command
  4. Running the build on a machine with real Firefox installed never reads or writes `~/.mozilla/firefox` (proven by exact-path `strace`, not a bare `.mozilla` match), and a full-session network capture contacts no host outside a documented allowlist — whose only Mozilla entry is the `firefox.settings.services.mozilla.com` Remote Settings carve-out, with each non-Mozilla host individually waived or disabled. Each check ships a positive control that must go red
  5. A dev build is distinguishable at a glance from a future packaged release (title suffix or icon badge), and the shipped `branding/` tree contains no Mozilla trademark assets

**Plans**: 5/6 plans executed

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Tracer: one-hunk identity patch, branding overlay symlink, dev branding tree, full build #1, a binary reporting `Deocracy Sourcerer`; plus the D-76 dirt-classifying clean-tree gate and the compiled-file guard (BUILD-03, BUILD-04, BRAND-01, BRAND-02)

**Wave 2** *(both blocked on Wave 1; these two run in parallel)*

- [x] 03-02-PLAN.md — Wave-0 verification harness, red by design: six-surface identity checklist, three-layer endpoint/profile prover, machine-readable allowlist, phase aggregator, `binPath`-parameterised BiDi driver
- [x] 03-04-PLAN.md — Rebase procedure: `scripts/rebase-upstream.sh` and `workflow_dispatch`-only CI (BUILD-03)

**Wave 3** *(blocked on Wave 2)*

- [x] 03-03-PLAN.md — Endpoint and telemetry removal: branding pref file, minimal `policies.json`, all three layers driven green with every positive control observed red first (BRAND-03, BRAND-04)

**Wave 4** *(blocked on 03-03)*

- [x] 03-05-PLAN.md — Release branding variant, two `.desktop` entries, full build #2 into a separate objdir, dev-vs-release distinguishability (BRAND-01, BRAND-02, BRAND-06)

**Wave 5** *(blocked on 03-04 and 03-05)*

- [ ] 03-06-PLAN.md — `docs/BUILD.md`: three re-measured tier timings, the compiled-file boundary, the allowlist and its one carve-out, rebase and desktop-install procedures; phase gate green (BUILD-03, BUILD-04)

> **Build budget:** this phase spends exactly **two** full `./mach build` cycles
> — build #1 in 03-01 and build #2 in 03-05, the latter into a separate
> `objdir-release/` so the dev build survives. Every other build is
> `./mach build faster` or none.

> **Criteria 1, 3 and 4 amended 2026-08-21** (Phase 3 discussion, decisions D-79
> and D-70 in `.planning/phases/03-branded-firefox-fork/03-CONTEXT.md`).
> Criterion 3 no longer names artifact builds: they work for ESR 153 but
> cannot produce a renamed binary (`artifacts.py:92` hardcodes the product as
> `"firefox"`; `MOZ_APP_NAME` is a compiled define), so it could not coexist
> with criterion 1. Criterion 1 no longer asks for an empty `grep` — that can
> never pass on a correct build. See `.planning/REQUIREMENTS.md` for the
> matching BUILD-04 / BRAND-01 amendments.
> Criterion 4's "zero Mozilla endpoints" became an allowlist: Remote Settings
> cannot be disabled by pref off Nightly (`services/settings/Utils.sys.mjs:52-84`),
> and the alternative policy also stops CRLite certificate-revocation data,
> intermediate-certificate preloading and tracking-protection updates (D-83).

### Phase 4: Full-Window Theia Shell

**Goal**: Launching Sourcerer opens one window that spawns and health-gates the Theia sidecar and presents it full-window as the entire interface, with every Firefox-internals touch funnelled through one file.
**Depends on**: Phase 2 and Phase 3
**Requirements**: SHELL-01, SHELL-02, SHELL-05, SIDE-01, SIDE-02, SIDE-03
**Success Criteria** (what must be TRUE):

  1. Launching Sourcerer opens a window whose entire surface is Theia's own shell — menu bar, status bar, tab bar, all unsuppressed — with no Firefox chrome and no custom chrome added
  2. The window paints a branded loading state immediately on launch and swaps to Theia when the health check passes; window show never waits on backend readiness
  3. The backend listens only on 127.0.0.1 at an OS-assigned free port, and a plain HTTP request carrying no per-launch token is rejected — not just the WebSocket upgrade
  4. `sourcerer/INTERNAL-APIS.md` catalogues every Firefox-internals touchpoint, and a repo-wide search confirms `SourcererAPI.sys.mjs` is the only file importing Firefox internals
  5. Killing the backend while Sourcerer runs causes the health-check loop to restart it with backoff and the session recovers without relaunching the browser

**Plans**: TBD

### Phase 5: Lifecycle & Failure Hardening

**Goal**: Sourcerer cleans up after itself under any exit path and tells the user what went wrong instead of freezing. v4.0 is daily-drivable at the end of this phase.
**Depends on**: Phase 4
**Requirements**: SIDE-04, SIDE-05, SHELL-03, SHELL-04
**Success Criteria** (what must be TRUE):

  1. `SIGKILL` on the browser leaves zero backend processes behind, and a leftover backend from a previous crash is detected and cleaned up on the next startup
  2. Launching Sourcerer while it is already running focuses the existing window and spawns no second backend
  3. When the backend dies and restart exhausts its backoff, the user sees a branded chrome-rendered error state with a retry that works — never a blank or frozen window
  4. A diagnostics page shows the sidecar's port, PID, health status, and recent log output, and stays reachable while the backend is down
  5. The developer uses Sourcerer as their daily IDE on the NixOS host for a working period without a manual process cleanup or a forced relaunch

**Plans**: TBD

## Notes

**UI hints deliberately omitted.** Phases 2, 3, and 4 touch keywords that
normally trigger a `**UI hint**: yes` annotation (CSS, favicon, widget, window,
branding). They are suppressed here on purpose: `CLAUDE.md` sets a hard rule
that v4.0 makes **no GUI change beyond the rename**, and the requirements put
custom chrome explicitly out of scope. Routing these phases to `/gsd-ui-phase`
would produce a design contract for a GUI the milestone forbids. Post-4.0
chrome milestones (CHROME-01/02/03) are where UI hints belong.

**Parallelization.** Phases 2 and 3 have no dependency on each other and share
only the flake from Phase 1. The decoupled-build strategy is what makes this
real: Theia browser-target runs standalone in any browser, so Phase 2 iterates
with `yarn watch` and never waits on a Firefox build.

**Scope gate.** The urge to add chrome will surface during Phase 4, when a
full-window `<browser>` makes a tab strip look one afternoon away. It is not in
v4.0. Route it to the backlog.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 (2 and 3 may run in parallel)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Build Infrastructure | 4/4 | Complete   | 2026-08-20 |
| 2. Sourcerer Theia Extensions | 7/7 | Complete   | 2026-08-20 |
| 3. Branded Firefox Fork | 5/6 | In Progress|  |
| 4. Full-Window Theia Shell | 0/TBD | Not started | - |
| 5. Lifecycle & Failure Hardening | 0/TBD | Not started | - |

---
*Roadmap created: 2026-08-20*
*Phase 3 criteria 1, 3 and 4 amended: 2026-08-21*
