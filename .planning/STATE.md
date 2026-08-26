---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: milestone
current_phase: 4
current_phase_name: Full-Window Theia Shell
status: executing
stopped_at: Phase 4 context gathered
last_updated: "2026-08-26T19:55:44.942Z"
last_activity: 2026-08-22
last_activity_desc: Phase 03 execution started
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 27
  completed_plans: 22
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-19)

**Core value:** A daily-drivable IDE whose substrate is a real browser (DRM, WebExtensions, site isolation inherited from Firefox), built so every later plan lands as an addition, never a rework.
**Current focus:** Phase 03 — branded-firefox-fork

## Current Position

Phase: 4 — Full-Window Theia Shell
Plan: Not started
Status: Ready to execute
Last activity: 2026-08-22 — Phase 03 complete, transitioned to Phase 4

Progress: [██████████] 95%

## Performance Metrics

**Velocity:**

- Total plans completed: 11
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 03 | 11 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 10min | 3 tasks | 9 files |
| Phase 01 P02 | 23min | 2 tasks | 5 files |
| Phase 1 P3 | 2h18min | 2 tasks | 4 files |
| Phase 01 P04 | 20min | 2 tasks | 2 files |
| Phase 02 P01 | 45min | 1 tasks | 13 files |
| Phase 02 P02 | 45min | 3 tasks | 5 files |
| Phase 02 P03 | 55min | 3 tasks | 8 files |
| Phase 02 P04 | 45min | 3 tasks | 7 files |
| Phase 02 P05 | ~2h | 3 tasks | 12 files |
| Phase 02 P06 | 40min | 3 tasks | 12 files |
| Phase 02 P07 | 90min | 3 tasks | 8 files |
| Phase 03 P01 | 20min | 3 tasks | 21 files |
| Phase 03 P02 | 55min | 3 tasks | 6 files |
| Phase 03 P04 | 6min | 2 tasks | 2 files |
| Phase 03 P03 | ~50min | 2 tasks | 4 files |
| Phase 03 P05 | 65min | 3 tasks | 19 files |
| Phase 03 P06 | 35min | 3 tasks | 4 files |
| Phase 03 P07 | 20min | 3 tasks | 3 files |
| Phase 03 P08 | 55min | 3 tasks | 3 files |
| Phase 03 P09 | 35min | 2 tasks | 4 files |
| Phase 03 P10 | ~13h (spans human checkpoint pause) | 3 tasks | 2 files |
| Phase 03 P11 | 50min | 3 tasks | 9 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Nix flake is its own phase (not folded into 2/3) — the NixOS Firefox toolchain is the project's highest unknown and blocks both tracks
- Roadmap: research's 7 phases compressed to 5 (standard granularity) — xhtml gut + TheiaService merged into Phase 4; both are "the window shows Theia"
- Roadmap: UI hints suppressed on all phases — CLAUDE.md forbids GUI work beyond the rename in v4.0
- [Phase ?]: shellHook banners write to stderr, not stdout, so nix develop --command output stays machine-parseable for scripts like toolchain-baseline.sh
- [Phase ?]: Added react/react-dom 18.3.1 (exact) to theia/applications/browser/package.json -- @theia/core's peer dependency, missing from the researched 11-package set (RESEARCH.md Open Question 1)
- [Phase ?]: node-pty D-10 proof is a real PTY spawn-and-echo test, not theia rebuild:browser or a build/Release/pty.node file check -- both are false signals for this package (it ships prebuilds/ only)
- [Phase ?]: firefox devShell now overrides stdenv to pkgs.llvmPackages.stdenv (clang) -- inputsFrom copies nativeBuildInputs/buildInputs from firefox-esr-153-unwrapped but not its own buildStdenv, and the real derivation builds under overrideCC llvmPackages.stdenv
- [Phase ?]: firefox shellHook unsets AS/LD/NM/AR/RANLIB/OBJDUMP/OBJCOPY/READELF/SIZE/STRINGS/STRIP -- nixpkgs bintools-wrapper exports these as bare tool names, which Firefox's moz.configure treats as an explicit override and uses without routing ASFLAGS through the compiler driver
- [Phase ?]: fetch-upstream.sh re-run identity check compares resolved commit SHAs, not git describe --tags --exact-match -- the mirror tags this release with both _RELEASE and _BUILD1 on the identical commit, and describe's tie-break is non-deterministic
- [Phase ?]: docs/BUILD.md documents the --ignore-scripts + explicit drivelist node-gyp rebuild install sequence, with the audit reason, so it is never simplified back to a plain yarn install
- [Phase ?]: scripts/fetch-upstream.sh is documented as run directly from the repo root (needs only git, already on host), not wrapped in nix develop .#firefox
- [Phase ?]: 02-01: @sourcerer/branding tsconfig.json uses the full theia-ide base.tsconfig.json compilerOptions (skipLibCheck, lib:[...,dom], declaration) -- the abbreviated set fails tsc -b on @theia/core's own .d.ts files
- [Phase ?]: 02-01: verify-branding.mjs polls for the favicon link itself, not just window.theia.container -- container is assigned before onStart contributions run, so a container-only wait races the DOM mutation
- [Phase ?]: 02-01: .gitignore's Theia build-output lib/ rule anchored to theia/**/lib/ -- the unanchored form also silently excluded scripts/lib/ (hand-written source)
- [Phase ?]: 02-01: sourcererPrivilegedJs read in-page via Object.getOwnPropertySymbols(window) -- FrontendApplicationConfigProvider stores config behind a bare Symbol(), no fixed lookup key or DI token exists externally
- [Phase ?]: 02-02: verify-uri-roundtrip.mjs resolves Theia DI services (OpenerService, WidgetManager, TabUriRegistry) via Inversify _bindingDictionary reflection and a minimal URI shim, since the real classes are unreachable from an external BiDi evaluation context -- an informal contract Plan 06/07 must not break with an instanceof URI check
- [Phase ?]: 02-02: bash trap cleanup EXIT INT TERM does not terminate a script on INT/TERM (bash resumes after a non-EXIT trap returns unless it exits) -- verify-phase-02.sh splits into trap cleanup EXIT plus trap 'cleanup; exit N' INT TERM
- [Phase ?]: Added @types/react@18.3.31 and @types/react-dom@18.3.7 as devDependencies (type-only, exact-pinned) -- react ships no bundled types and @theia/core lists both as optional peers Yarn Classic never auto-installs; approved by the coordinator after independent verification, per the phase's no-new-dependency stop-and-report rule.
- [Phase ?]: Welcome widget verification resolves SourcererWelcomeViewContribution directly and calls openView({reveal:true}) rather than the toggle command -- toggleView() closes an already-open main-area widget instead of re-revealing it, and a fresh headless profile always has it open via initializeLayout() already.
- [Phase ?]: 49-package @theia/* set exact-pinned (D-19); theia rebuild:browser corrected to reflect its actual output (generic message, not a per-module skip list)
- [Phase ?]: Two isBound-guarded rebinds (SourcererAIFirstPerspectiveContribution, SourcererAIConfigurationViewContribution) neutralize @theia/ai-ide's first-boot layout forcing without touching AIActivationService (D-22)
- [Phase ?]: onStart()/onDidInitializeLayout() in @sourcerer/customize's contributions never await their file read -- awaiting a user-storage: read inside a lifecycle hook that startContributions() itself awaits deadlocks app boot (the RPC connection that read needs stabilizes around/after that same chain resolves).
- [Phase ?]: scripts/lib/firefox-bidi.mjs's withFirefoxPage gained a screenshot() export (same-session BiDi capture) -- Plan 02's captureScreenshot fires on the page's early load event, before a Theia SPA settles, and cannot see the rendered app.
- [Phase ?]: 02-06: TabUriRegistry discovers view: targets at runtime from AbstractViewContribution instances (cross-checked against the static coverage table), not a hard-coded lookup -- turns a mis-transcribed table id into a startup console.error instead of a silent no-op
- [Phase ?]: 02-06: AbstractViewContribution.openView()'s return value is unreliable for a view: URI target when viewContainerId differs from widgetId -- it resolves via viewId (the container's part), not effectiveWidgetId (the container); ViewUriOpenHandler re-fetches the widget by name after calling openView() for its side effect
- [Phase ?]: 02-06: AI chat widget non-extractable (D-27) fix checks for an already-created widget via WidgetManager.getWidgets() in addition to subscribing to onDidCreateWidget -- another AI contribution's own onStart can create the widget first, and onDidCreateWidget only fires once, on first creation
- [Phase ?]: 02-07: TerminalUriOpenHandler and SourcererOutputOpenHandler stay bare OpenHandlers, not WidgetOpenHandler subclasses -- WidgetOpenHandler.doOpen defaults an unattached widget's area to 'main', wrong for Terminal's real 'bottom' default; delegating to each widget's own in-tree contribution reuses Theia's already-correct placement logic
- [Phase ?]: 02-07: fixed a live bug in @theia/output's own OutputContribution.open() -- it validated the output: scheme and then discarded the channel, never selecting it; opening output:B after output:A left selectedChannel pinned on A
- [Phase ?]: 02-07: terminalIdentityOptions({created,id,title} all equal) is a single shared helper used by both the auto-mint path and the terminal-open-handler's stale-name fresh-shell path -- WidgetManager dedups on stableJsonStringify({factoryId,options}), so any drift between the two call sites would fork a duplicate widget
- [Phase ?]: 03-01: sccache lands in the firefox devShell with RUSTC_WRAPPER exported after the existing AS/LD/NM unset line, never before (D-71) -- smoke-tested green
- [Phase ?]: 03-01: -brand-product-name stays Firefox in brand.ftl -- consistent with D-78's byte-identical UA rationale (resolves 03-RESEARCH.md A1)
- [Phase ?]: 03-01: MOZ_SERVICES_HEALTHREPORT flipped to False alongside MOZ_NORMANDY in the same browser/moz.configure hunk -- zero marginal file cost (resolves Open Question 1)
- [Phase ?]: 03-01: git apply --3way exits 0 with a completely silent no-op on already-adopted patch content -- apply-patches.sh's before/after blob-hash comparison is the only mechanism that catches it (D-75)
- [Phase ?]: 03-02: about:support is live-evaluable with --remote-allow-system-access, confirmed both directions -- not degraded to Manual-Only
- [Phase ?]: 03-02: layer 2's positive-observation anchor changed from a flaky .mozilla substring to a reliable $HOME-prefix match, after repeated live testing showed the substring probe doesn't fire on every run
- [Phase ?]: 03-02: two Remote Settings companion hosts (content-signature-2.cdn.mozilla.net, firefox-settings-attachments.cdn.mozilla.net) added to the allowlist under D-83's carve-out after a real layer-3 run surfaced them
- [Phase ?]: 03-02: MOZ_LOG per-child log naming is <base>.child-N.moz_log, not <base>.moz_log.child-N -- corrected against GeckoChildProcessHost.cpp:945-967
- [Phase ?]: 03-04: rebase-upstream.sh echoes its target tag to stdout before the remote-existence check, on every path -- so a dry run against a tag that turns out not to exist still proves it never silently substituted the pinned default
- [Phase ?]: 03-04: workflow_dispatch input consumed via env:/shell-variable (REBASE_TAG), never interpolated directly into run: -- avoids the GitHub Actions shell-injection pattern
- [Phase ?]: 03-03: TRR open item resolved as NetworkConnectivityService.cpp (network.connectivity-service.enabled), not network.trr.mode -- cloudflare-dns.com/example.org/ipv4only.arpa dispositioned deny
- [Phase ?]: 03-03: layer 3's MOZ_LOG capture window corrected 20s -> 35s -- app.update.timerFirstInterval defaults to 30000ms, so the periodic AddonManager update-check timer (and layer 3's own OpenH264 positive control) never fired inside 20s
- [Phase ?]: 03-03: services.addons.mozilla.org denied via extensions.getAddons.cache.enabled master switch; update.googleapis.com and www.google.com allowed under D-86's existing DRM rationale (Widevine's Chromium-Omaha update-check host and its redirect target) -- corrects C-4's premise that Widevine is fully idle-gated
- [Phase ?]: 03-05: release icon set is unbadged base-accent recolor (#2B6CB0), not a distinct accent hex -- dev's committed PNGs were found (pixel inspection) to carry an orange corner-badge overlay, contradicting 03-01-SUMMARY.md's prose
- [Phase ?]: 03-05: verify-branding-identity.mjs BIN_DIR is now derived from --bin (dirname(BIN_PATH)), not hardcoded to objdir -- the executable surface previously silently re-checked the dev binary even when pointed at release
- [Phase ?]: 03-05: StartupWMClass=sourcerer in both .desktop files (not per-variant); Icon= is an absolute path to each variant's own default128.png, not an icon-theme name
- [Phase ?]: 03-06: pushed the full local history (133 commits) to origin/master and dispatched .github/workflows/rebase-upstream.yml for the first time -- run concluded success in ~2min, proving the rebase mechanism off this machine
- [Phase ?]: 03-06: dl.google.com allowlisted as a second D-86-extension host (Widevine Omaha redirect flow), discovered by this plan's own final verify-phase-03.sh run
- [Phase ?]: 03-07: Promoted a per-variant VARIANTS descriptor (bin/desktop/configStatus/brandFtl/brandFullName) in verify-branding-identity.mjs so the brand-full-name identity surface reads whichever variant --variant selects, closing CR-01's vacuous release-variant PASS.
- [Phase ?]: 03-08: dropped setsid in favor of set -m for the interrupt self-test's recursive child launch -- setsid layered under job control forces an extra internal fork that decouples $! from the real process-group leader; set -m alone gives the async job its own fresh pgid and avoids the SIG_IGN-on-background-job trap that defeats a non-interactive script's own INT trap
- [Phase ?]: 03-08: interrupt self-test's mutation-detection grep matches the appended pref("media.gmp-gmpopenh264.enabled", true) value specifically, not the bare key name -- the pristine pref file already contains that key set to false, so a bare-key grep matched instantly and made the test vacuous
- [Phase ?]: [Phase 3] 03-09: amended the authoritative requirement wording (ROADMAP Criterion 4, REQUIREMENTS BRAND-04, D-83) to name three Remote-Settings-family hosts instead of one, rather than writing a verification override -- direction pre-approved by the developer
- [Phase ?]: [Phase 3] 03-09: allowlist-doc-consistency matches hosts as whole tokens (character-class boundary regex), not substrings -- a plain substring search would let cdn.mozilla.net pass vacuously as a suffix of two genuinely-documented hosts
- [Phase ?]: [Phase 3] 03-10: Item A (dev-vs-release distinguishable at a glance) human-verified and recorded as FAILED -- brand.properties/brand.ftl mismatch within dev variant, client-side window decorations hide the title bar, icon badge not reliably perceptible. Open gap, not fixed by this evidence-only plan.
- [Phase ?]: [Phase 3] 03-10: Item B (branding-tree trademark-asset review) human-verified and recorded as PASSED -- 15/15 carried-forward files reviewed in both variants, opened not judged by filename, 0 Mozilla-mark findings.
- [Phase ?]: [Phase 3] 03-11: BRAND-06 gap closed -- dev brand.properties suffixed to match brand.ftl (WR-01), dev-only browser.tabs.inTitlebar=0 default paints a real title bar, verify-branding-identity.mjs brand-full-name surface now reads brand.properties too; human re-verification PASS 2026-08-22 (icon badge deliberately left un-rebadged)

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1: nixpkgs Firefox-toolchain attributes are unverified. Check every attribute against the nixos MCP before writing the flake (research STACK.md gap).
- Phase 4: verify the pinned Theia release is >= 1.73.1 and that the CVE-2026-61891 token check fires on plain HTTP, not only WebSocket upgrade.
- All phases: Theia has no API stability tier. Review every `@theia/*` import against `doc/Migration.md` and record it in INTERNAL-APIS.md.

## Quick Tasks Completed

| Date | Slug | Description |
|------|------|-------------|
| 2026-08-22 | repo-homes-decided | Recorded decided repo homes: powerbrowser under DeBIOS-Foundation, Sourcerer stays at Deocracy |
| 2026-08-22 | stream-model-docs | Recorded the three-layer stream model (Power Browser as midstream platform, Sourcerer as downstream distribution) in PRODUCT-REQUIREMENTS.md and sourcerer-architecture.md |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-08-26T19:10:53.869Z
Stopped at: Phase 4 context gathered
Resume file: .planning/phases/04-full-window-theia-shell/04-CONTEXT.md
