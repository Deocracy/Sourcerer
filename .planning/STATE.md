---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: milestone
current_phase: 05
current_phase_name: lifecycle-failure-hardening
status: awaiting-human-verification
stopped_at: "Completed quick task 260829-ikk: closed WINDOWS.md 5 (endpoint-allowlist 127.0.0.1/github.com/ciscobinary.openh264.org, e13d4f2/548e762)"
last_updated: "2026-08-29T21:22:59.166Z"
last_activity: 2026-08-29
last_activity_desc: "Completed quick task 260829-hjj: closed WINDOWS.md 10 (token redaction) and 11 (sidecar-state litter)"
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 32
  completed_plans: 32
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-19)

**Core value:** A daily-drivable IDE whose substrate is a real browser (DRM, WebExtensions, site isolation inherited from Firefox), built so every later plan lands as an addition, never a rework.
**Current focus:** Phase 05 — lifecycle-failure-hardening

## Current Position

Phase: 05 (lifecycle-failure-hardening) — EXECUTING
Plan: 5 of 5
Status: awaiting-human-verification
Last activity: 2026-08-29 — Completed quick task 260829-ikk: closed WINDOWS.md 5 (endpoint allowlist: 127.0.0.1 allowed, github.com prefetch closed, openh264 autoupdate path closed)

All 5 plans are complete and the automated surface is green (`verify-phase-05.sh`
14/14, `verify-phase-04.sh` 10/10, `--gate` PASS at `e13d4f2` with no remaining
named exclusion -- `verify-endpoints` / WINDOWS.md entry 5 is now fixed). What
blocks the phase is the human surface: **Items A, B and C of
`05-MANUAL-VERIFICATION.md` are all still unperformed against the fixed build.**

Two defects were found and fixed by hand after verification, both by looking at
the product rather than at the harness:

1. **Deck-overlay CSP regression** — Item C was attempted once and failed before
   reaching the chord: both overlays were painted over a healthy Theia from
   startup because the shell's own CSP drops the inline `style` attributes
   05-02/05-03 used to hide them. Fixed in `014b0d9`; guarded by `def0143`
   (`shell-csp-inline-attrs`) and `b3a287d` (`SOURCERER_DECK_STATE`).
   `.planning/WINDOWS.md` entry 8.

2. **MED-01, the `SOURCERER_*` environment leak** — worse than the review
   recorded it. `mergeProcessEnv` reads `process.env` live at terminal-creation
   time, so `SOURCERER_SUPERVISED` reached every IDE terminal and killed nested
   `yarn start` / `smoke-theia.sh` / `verify-phase-04.sh` runs, and
   `SOURCERER_TOKEN` — the backend's auth credential — took the identical path.
   Fixed in `86cc4e4` (scrub every `SOURCERER_*` key from `process.env` at
   module load) and `ffdc221` (token now travels on the backend's stdin pipe,
   never the environment, because a `delete` does not rewrite
   `/proc/<pid>/environ`); guarded by `side04-token-not-in-environment`.
   `.planning/WINDOWS.md` entry 9, now `fixed`.

3. **Ledger entry 5, the BRAND-04 endpoint allowlist** — 127.0.0.1 (allow,
   Theia sidecar loopback) and github.com (deny, closed by
   `network.dns.disablePrefetch`) added; ciscobinary.openh264.org's existing
   deny reason corrected -- `media.gmp-gmpopenh264.enabled` never gated the
   periodic auto-update path, and the per-plugin `.autoupdate` override
   cannot be set from a default-branch pref file at all
   (`GMPPrefs.isSet()` requires `prefHasUserValue()`); the real fix is the
   global `extensions.update.autoUpdateDefault = false`, confirmed live and
   confirmed safe for Widevine. Fixed in `e13d4f2`; `.planning/WINDOWS.md`
   entry 5 now `fixed`.

Still open and tracked: WINDOWS.md entries 1 and 7. See
`05-VERIFICATION.md`'s two Post-Verification Update sections.

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 16
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 03 | 11 | - | - |
| 04 | 5 | - | - |

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
| Phase 04 P01 | 30min | 3 tasks | 2 files |
| Phase 04 P02 | 26min | 3 tasks | 8 files |
| Phase 04 P03 | 190min | 3 tasks | 8 files |
| Phase 04 P04 | 35min | 3 tasks | 4 files |
| Phase 04 P05 | 19min | 3 tasks | 6 files |
| Phase 05 P01 | 75min | 2 tasks | 6 files |
| Phase 05 P02 | 95min | 3 tasks | 9 files |
| Phase 05 P03 | 70min | 2 tasks | 8 files |
| Phase 05 P04 | 55min | 2 tasks | 6 files |
| Phase 05 P05 | 25min | 2 tasks | 3 files |
| Phase quick P260829-hjj | ~35min | 3 tasks | 6 files |
| Phase quick P260829-ikk | 45min | 3 tasks | 5 files |

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
- [Phase ?]: 04-01: check-internals-boundary.sh default scan target is sourcerer/shell/, not the whole sourcerer/ tree D-97 names literally -- existing sourcerer/branding/*/pref/firefox-branding.js files match the *.js glob with zero offenses, so scanning all of sourcerer/ would make internals-boundary a false PASS before any Phase 4 code exists, defeating Wave 0's red-by-design requirement
- [Phase ?]: 04-01: side03-kill-and-recover asserts D-104's pid/port recovery half only, not cookie continuity -- a bash/curl driver cannot read the chrome-set token cookie without a WebDriver BiDi storage.getCookies call, which scripts/lib/firefox-bidi.mjs (required to stay unchanged) does not export; deferred to a future task
- [Phase ?]: 04-02: bind-scope failure reuses exit code 78 (same class of failure as fail-closed startup)
- [Phase ?]: 04-02: theia/package.json build:extensions extended to build token-gate before the app build -- theia build bundles from each extension's already-compiled lib/
- [Phase ?]: 04-02: SOURCERER_BACKEND_READY sentinel measured at ~0.62-0.63s since backend process start across five live spawns -- floor for 04-04's supervisor startup timeout
- [Phase ?]: 04-03: sourcerer.js navigates the content browser via document.nodePrincipal (a chrome document's own system principal), not Services.scriptSecurityManager -- keeps the file outside check-internals-boundary.sh's exemption
- [Phase ?]: 04-03: JS_PREFERENCE_PP_FILES .js files need an explicit #filter substitution directive -- @VAR@ substitution and even the preprocessor's own non-vacuity check are both inert without it, confirmed against browser/app/profile/firefox.js's own header
- [Phase ?]: 04-03: fixed a stale mozilla-config.h bug -- reusing Phase 3's objdir meant ./mach build reported success without ever regenerating the compiled BROWSER_CHROME_URL define; cleared .deps/mozilla-config.h.stub to force real regeneration before the real full build
- [Phase ?]: 04-03: fetch-upstream.sh excludes .mozbuild/ (repo-local MOZBUILD_STATE_PATH build-tooling state) from its D-76 dirt classifier via a git pathspec, not a patch to upstream/.gitignore
- [Phase ?]: 04-04: spawnProcess now passes environmentAppend: true -- the prior shape replaced the child's entire environment with just the 3 sidecar vars, dropping PATH/HOME
- [Phase ?]: 04-04: health probe uses a system-privileged XMLHttpRequest, not fetch() -- fetch() silently drops the Cookie header (forbidden Fetch-spec header, no privileged-caller carve-out); XHR's setRequestHeader has that carve-out
- [Phase ?]: 04-04: restart backoff constants (500ms->5000ms cap) stay literal in TheiaService.sys.mjs, not prefs -- no such pref exists in 04-03's shipped set and this plan doesn't touch sourcerer-sidecar.js
- [Phase ?]: 04-04: health-loop cancellation is a checked _shuttingDown flag at every await point, not a cancelable timer handle -- stop() bounds purely on the platform kill call's own grace period
- [Phase ?]: 04-05: Catalogue row grain is the distinct occurrence LINE in SourcererAPI.sys.mjs, not the distinct pattern match -- two forbidden patterns on one line (Cc[.../Ci.) collapse to one required catalogue row, matched by file:line
- [Phase ?]: 04-05: 04-VALIDATION.md set to status: validated / nyquist_compliant: false (honest PARTIAL) -- 7/10 verify-phase-04.sh checks green and non-flaky across 3 live runs, 3/10 (SHELL-01, SHELL-05, SIDE-03) blocked by the pre-existing RenderCompositorSWGL environmental failure (WINDOWS.md entries 2-3), no assertion weakened to force a false green
- [Phase ?]: 04-05: 04-MANUAL-VERIFICATION.md's launch-paint verdict recorded as genuinely pending, not fabricated -- this autonomous session has no attached desktop and has never achieved a live paint across three plans (04-03/04-04/04-05); WINDOWS.md entry 4 tracks the gap
- [Phase ?]: 05-01: SourcererAPI.readProcessStartTicks uses IOUtils.read({maxBytes}) + TextDecoder, never IOUtils.readUTF8() -- readUTF8's ReadUTF8Options has no maxBytes field, so it always sizes its buffer from stat() and silently returns empty string for procfs files (st_size always 0)
- [Phase ?]: 05-01: verify-phase-05.sh's D-125 controls compare startTicks not raw pid -- the freshly-spawned real backend can legitimately recycle the just-reaped leftover's pid number
- [Phase ?]: 05-02: Discriminator A (real display) - remoting works, non-headless launch paints in <1s; verify-phase-05.sh gained start_shell_display/harness-display-available with on-demand Xvfb fallback
- [Phase ?]: 05-02: Discriminator B (chrome-side Marionette automation) - blocked on Linux, moz:windowless is macOS-only (Capabilities.sys.mjs); firefox-marionette.mjs NOT created, WINDOWS.md entry 7 records the finding, Retry-button click routed to human record
- [Phase ?]: 05-02: give-up budget folds the first spawn attempt into _restart()'s own bounded loop so giveUpAttempts=N means N total attempts, never N+1 -- a real bug caught live during verification
- [Phase ?]: 05-02: SourcererAPI.pathExists (new) closes a real classification gap -- backendMain pointing at a nonexistent-but-set path was previously misclassified as recoverable instead of D-113's own named unrecoverable case
- [Phase ?]: 05-03: AppConstants.MOZ_APP_VERSION_DISPLAY (lazy-getter block) backs getAppIdentity's version field -- the same build-time preprocessor constant about:support itself used
- [Phase ?]: 05-03: diagnostics sentinel is written on EVERY call to the show global (open or close, toggle) -- matches Task 1's literal acceptance criteria over the plan's looser must_haves paraphrase
- [Phase ?]: 05-03: objdir-release was stale since 2026-08-21 (predated the shell-window feature entirely) -- fixed with the project's own documented full release rebuild, Rule 3 blocking-issue fix, not a repo artifact
- [Phase ?]: 05-03: WINDOWS.md #6 closed by repointing verify-branding-identity.mjs's third surface (runtime-identity) at SourcererAPI.getAppIdentity() via a spawn+stdout-sentinel read, not by waiving it
- [Phase ?]: 05-04: entry name a-sourcerer sorts ahead of the stock m-browser/x-default command-line handlers (ascending strcmp) -- confirmed live
- [Phase ?]: 05-04: TheiaService._started set before any other work in start() -- catches a re-entrant call racing the first launch's own async work, not just a plain second call
- [Phase ?]: 05-04: no Ci.nsICommandLine.STATE_INITIAL_LAUNCH or classID field needed -- the handler never reads the command line and components.conf's own cid is sufficient for an ESM-class component (matches Marionette.sys.mjs's in-tree pattern)
- [Phase ?]: 05-05: --gate mode's known-open exclusion is keyed to WINDOWS.md ledger entry 5 and re-checked live on every run (ledger_entry_is_open) -- never a value baked in at authoring time; live-verified both directions (entry fixed -> gate fails naming lapsed exclusion, entry restored -> gate passes)
- [Phase ?]: 05-05: 05-MANUAL-VERIFICATION.md's three items (daily-drive, Retry click, diagnostics chord) are built with every instruction filled in and every verdict deliberately left 'pending' -- never self-certified by the autonomous session, per this plan's checkpoint_protocol
- [Phase 5] 2026-08-28: the deck overlays are hidden by their sourcerer.css base rules (`display: none`), never by an inline `style` attribute -- the shell document's CSP (`default-src chrome:`) drops inline style ATTRIBUTES as well as inline `<style>` elements, which is why 05-02/05-03's `style="display:none;"` was inert and both layers painted over a healthy Theia from startup
- [Phase 5] 2026-08-28: visibility is read with `window.getComputedStyle(el).display`, never `el.style.display` -- the inline-attribute read returns `""` for a stylesheet-driven default and inverted the diagnostics toggle on first press
- [Phase 5] 2026-08-28: the shell's own rendered chrome state is now observable to automation via the `SOURCERER_DECK_STATE` stdout sentinel -- BiDi can only see the content `<browser>` and chrome-context Marionette is platform-blocked, so a screenshot photographs Theia UNDERNEATH any chrome overlay; a sentinel is the only instrument this repo has for that surface
- [Phase 5] 2026-08-28: verify-phase-05.sh's backend-orphan scans are scoped to process groups the run itself created, never a machine-global `pgrep -f 'backend/main.js'` -- the unscoped form made the suite fail on any other Sourcerer instance on the box
- [Phase ?]: [Quick 260829-hjj] TheiaService._pushLog redacts this._token before buffering (null/empty-string guarded); SourcererAPI.log console mirror in _pumpOutput stays unredacted by design
- [Phase ?]: [Quick 260829-hjj] verify-phase-04/05.sh export a run-scoped XDG_CONFIG_HOME for the whole script run (not just per setsid call) so scripts/lib/firefox-bidi.mjs's own spawn also lands in the throwaway dir; start_backend's own config dir preserved via a REAL_XDG_CONFIG_HOME snapshot
- [Phase ?]: 127.0.0.1 allow, github.com deny (closed by network.dns.disablePrefetch), ciscobinary.openh264.org deny reason corrected to extensions.update.autoUpdateDefault=false (media.gmp-gmpopenh264.autoupdate cannot be set from a default-branch pref file); WINDOWS.md entry 5 closed

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1: nixpkgs Firefox-toolchain attributes are unverified. Check every attribute against the nixos MCP before writing the flake (research STACK.md gap).
- Phase 4: verify the pinned Theia release is >= 1.73.1 and that the CVE-2026-61891 token check fires on plain HTTP, not only WebSocket upgrade.
- All phases: Theia has no API stability tier. Review every `@theia/*` import against `doc/Migration.md` and record it in INTERNAL-APIS.md.
- Phase 4: this executor's sandboxed session cannot get a Firefox content process past RenderCompositorSWGL/IPC channel setup in headless or Xvfb mode (reproduced on the untouched Phase-3 binary too) -- blocks live launch verification for plans 04-03's own <verify> and 04-04's kill-and-recover check; try a different runner/interactive session.
- Phase 5, CLOSED 2026-08-28 (WINDOWS.md 9, review MED-01): `SOURCERER_SUPERVISED=1` inheriting into every backend subprocess is fixed -- `theia/extensions/token-gate/src/node/sourcerer-env.ts` captures and deletes every `SOURCERER_*` key from `process.env` at module load, and `verify-phase-05.sh`'s `side04-token-not-in-environment` asserts it from outside the process on a real supervised launch.
- Phase 5, CLOSED 2026-08-29 (WINDOWS.md 10, review MED-02): the diagnostics layer rendered the backend stdout/stderr ring buffer unredacted. Fixed in `d61b27b` -- `TheiaService._pushLog` now redacts `this._token` (null- and empty-string-guarded) before buffering; guarded by `shell04-log-redacts-token`, proven red before green against the real shipped module. The `SourcererAPI.log` console mirror in `_pumpOutput` stays deliberately unredacted (same sink the text already came from, not a new surface).
- Phase 5, CLOSED 2026-08-29 (WINDOWS.md 11): the CR-01 profile-scoping fix left one `~/.config/sourcerer/sidecar-state-<profile>.json` per profile path with nothing reaping them -- 307 accumulated from harness runs against `mktemp` profiles. Fixed in `bf1d482` -- both verify harnesses mint a run-scoped `HARNESS_CONFIG_HOME` and export it as `XDG_CONFIG_HOME` for the whole run (also covers `scripts/lib/firefox-bidi.mjs`'s own spawn, missed by the original two-call-site scope); `verify-phase-04.sh`'s `start_backend()` config dir preserved unchanged via a pre-export snapshot. 305 stale files deleted, the 2 real-profile files survive, `verify-phase-04.sh` confirmed 10/10 with the file count unchanged across a real run.
- Phase 5, OPEN: the new `shell-csp-inline-attrs` guard matches only `name="value"` attribute syntax -- an inline `<style>` or `<script>` ELEMENT in the shipped markup (the Phase-4 form of the same defect) still passes it clean.
- Phase 5, CLOSED 2026-08-28: `05-PATTERNS.md` had prescribed the defective `style="display:none;"` markup as the deck-layer template (a future agent following it would reintroduce the bug). The snippet is corrected and carries a dated CORRECTED note naming the CSP and the `getComputedStyle` rule.
- Phase 5, CLOSED 2026-08-28: `--gate` no longer mutates a tracked file — `write_gate_runtime_to_validation` is deleted, the measured wall time is printed in the run output only, and 05-VALIDATION.md's runtime cell points at that line instead of carrying a number that goes stale on the next added check.
- Phase 5, OPEN: `sourcererRetry()` hides the error layer with a direct CSSOM write instead of calling `sourcererHideError()`, so `TheiaService._errorShown` stays true -- a FAILING retry then early-returns out of `_showError()` and leaves the user on a blank branded splash with no message and no Retry control.

## Quick Tasks Completed

| Date | Slug | Description |
|------|------|-------------|
| 2026-08-22 | repo-homes-decided | Recorded decided repo homes: powerbrowser under DeBIOS-Foundation, Sourcerer stays at Deocracy |
| 2026-08-22 | stream-model-docs | Recorded the three-layer stream model (Power Browser as midstream platform, Sourcerer as downstream distribution) in PRODUCT-REQUIREMENTS.md and sourcerer-architecture.md |
| 2026-08-29 | fix-windows-10-token-redaction-and-11-sidecar-state-litter | Redacted the per-launch token in TheiaService's diagnostics ring buffer (WINDOWS.md 10 / MED-02) and stopped verify-phase-04/05.sh from littering the real config dir (WINDOWS.md 11); ledger down to 3 open entries |
| 2026-08-29 | close-windows-5-allowlist | Closed WINDOWS.md 5: allowed 127.0.0.1 (Theia sidecar loopback), closed github.com via network.dns.disablePrefetch, closed the OpenH264 periodic-autoupdate path via extensions.update.autoUpdateDefault=false; verify-endpoints fully green, ledger down to 2 open entries |
| 2026-08-29 | close-windows-5-allowlist-127-0-0-1-disa | Closed WINDOWS.md ledger entry 5: added 127.0.0.1 (allow) and github.com (deny, closed by network.dns.disablePrefetch) to the BRAND-04 allowlist, and corrected ciscobinary.openh264.org's deny rationale -- the real gate is extensions.update.autoUpdateDefault, not media.gmp-gmpopenh264.autoupdate, which can't be set from a default-branch pref file; ledger down to 2 open entries |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-08-29T21:22:59.153Z
Stopped at: Completed quick task 260829-ikk: closed WINDOWS.md 5 (endpoint-allowlist 127.0.0.1/github.com/ciscobinary.openh264.org, e13d4f2/548e762)
Resume file: None
Next action: a human performs 05-MANUAL-VERIFICATION.md Items A, B and C against a build at b30dff7 or later, and records each verdict there.
