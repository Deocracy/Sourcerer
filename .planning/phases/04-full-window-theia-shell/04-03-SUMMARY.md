---
phase: 04-full-window-theia-shell
plan: 03
subsystem: infra
tags: [firefox, gecko-patch, chrome-window, xhtml, sys-mjs, mach-build]

# Dependency graph
requires:
  - phase: 04-full-window-theia-shell
    provides: "04-01: scripts/check-internals-boundary.sh, scripts/verify-phase-04.sh (the target this plan's Task 2/3 checks run against)"
provides:
  - "patches/020-sourcerer-shell.patch -- the phase's second and final Gecko patch (BROWSER_CHROME_URL, browser/moz.build DIRS)"
  - "sourcerer/shell/{moz.build,jar.mn,sourcerer.xhtml,sourcerer.js,sourcerer-sidecar.js,SourcererAPI.sys.mjs} -- the entire startup window and the anti-corruption layer"
  - "chrome://sourcerer/content/{sourcerer.xhtml,sourcerer.js,SourcererAPI.sys.mjs} -- the chrome package, registered as content sourcerer browser/content/sourcerer/ in browser.manifest, not web-accessible"
  - "objdir/dist/bin/sourcerer rebuilt with the compiled BROWSER_CHROME_URL define genuinely repointed"
  - "scripts/fetch-upstream.sh fix: .mozbuild/ excluded from the D-76 dirt classifier"
affects: [04-04-backend-supervisor, 04-05-internal-apis-catalogue]

actuals:
  tokens: 3800
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Chrome document's own document.nodePrincipal used as triggeringPrincipal for a privileged browser-element navigation, instead of Services.scriptSecurityManager -- keeps a non-boundary file (sourcerer.js) clean under scripts/check-internals-boundary.sh"
    - "#filter substitution + @VAR@ is required (not automatic) for any JS_PREFERENCE_PP_FILES .js/.mjs/.java/.webidl file -- the mozbuild preprocessor's checkLineNumbers/failUnused logic rejects a PP file with zero preprocessor directives ('no preprocessor directives found'), and @VAR@ substitution itself is inert until the substitution filter is explicitly turned on"
    - "A ChromeUtils.importESModule(...) call and its chrome://sourcerer/ target string must share one line -- scripts/check-internals-boundary.sh's conditional-pattern check is line-scoped, and the substring 'ChromeUtils.import' inside 'ChromeUtils.importESModule' otherwise trips the guard on a wrapped call"

key-files:
  created:
    - patches/020-sourcerer-shell.patch
    - sourcerer/shell/moz.build
    - sourcerer/shell/jar.mn
    - sourcerer/shell/sourcerer.xhtml
    - sourcerer/shell/sourcerer.js
    - sourcerer/shell/sourcerer-sidecar.js
    - sourcerer/shell/SourcererAPI.sys.mjs
  modified:
    - scripts/fetch-upstream.sh

key-decisions:
  - "sourcerer.js's sourcererSwapToUrl navigates the content browser via browserElement.fixupAndLoadURIString(url, { triggeringPrincipal: document.nodePrincipal }) rather than Services.io.newURI()/Services.scriptSecurityManager.getSystemPrincipal() -- a chrome:// document's own nodePrincipal already IS the system principal, so this avoids the only Services.* touch a naive implementation would have needed outside SourcererAPI.sys.mjs."
  - "sourcerer-sidecar.js opens with a bare '#filter substitution' directive (matching browser/app/profile/firefox.js's own '#filter dumbComments emptyLines substitution' precedent) -- without it the file has zero preprocessor directives and mozbuild's Preprocessor.failUnused() raises 'no preprocessor directives found', and even with a directive present, @SOURCERER_DEV_TREE@ is left as a literal string unless the substitution filter is explicitly enabled."
  - "fetch-upstream.sh's D-76 dirt classifier now excludes .mozbuild/ from its git status --porcelain scan via a pathspec (-- . ':!.mozbuild'), not by patching upstream/.gitignore -- .mozbuild/ is Firefox build-tooling state (MOZBUILD_STATE_PATH, repo-local per flake.nix), not Gecko source, and patching upstream/.gitignore would need a third patch hunk, breaking D-93's 'two hunks in two files' invariant for no reason."

requirements-completed: [SHELL-01, SHELL-02, SHELL-05]

coverage:
  - id: D1
    description: "patches/020-sourcerer-shell.patch lands two hunks (browser/moz.configure BROWSER_CHROME_URL, browser/moz.build DIRS) and replays cleanly from a pristine upstream/ in numeric order after 010, both non-vacuous"
    requirement: "SHELL-01"
    verification:
      - kind: unit
        ref: "bash scripts/check-patch-surface.sh (PASS, 2 patches, no compiled-file targets)"
        status: pass
      - kind: integration
        ref: "git -C upstream checkout HEAD -- browser/moz.configure browser/moz.build; bash scripts/apply-patches.sh (both patches applied and verified non-vacuous); bash scripts/fetch-upstream.sh (fully-applied, accounted-for clean)"
        status: pass
    human_judgment: false
  - id: D2
    description: "sourcerer/shell/{moz.build,jar.mn} register chrome://sourcerer/content/ as a non-web-accessible top-level package inside browser.jar; the built objdir/dist/bin resolves the chrome URL to the real sourcerer.xhtml/sourcerer.js/SourcererAPI.sys.mjs files via browser.manifest's 'content sourcerer browser/content/sourcerer/' line"
    requirement: "SHELL-01"
    verification:
      - kind: unit
        ref: "grep -c contentaccessible sourcerer/shell/jar.mn == 0; grep -c 'browser.jar:' sourcerer/shell/jar.mn == 1"
        status: pass
      - kind: integration
        ref: "objdir/dist/bin/browser/chrome/browser/content/sourcerer/{sourcerer.xhtml,sourcerer.js,SourcererAPI.sys.mjs} symlinks present; objdir/dist/bin/browser/chrome/browser.manifest:5 'content sourcerer browser/content/sourcerer/'"
        status: pass
    human_judgment: false
  - id: D3
    description: "sourcerer/shell/sourcerer-sidecar.js preprocesses cleanly with SOURCERER_DEV_TREE substituted to an absolute, existing path; browser.dom.window.dump.enabled default lets the chrome bootstrap's sentinels reach stdout"
    requirement: "SHELL-05"
    verification:
      - kind: unit
        ref: "objdir/dist/bin/browser/defaults/preferences/sourcerer-sidecar.js: sourcerer.sidecar.backendMain == /home/chris/coding/sourcerer/theia/applications/browser/lib/backend/main.js (test -f confirms it exists)"
        status: pass
    human_judgment: false
  - id: D4
    description: "sourcerer.xhtml adds no custom browser chrome (zero tabbrowser/nav-bar/toolbarbutton/urlbar occurrences) -- the static half of shell01-theia-is-the-window"
    requirement: "SHELL-01"
    verification:
      - kind: unit
        ref: "grep -c 'tabbrowser\\|nav-bar\\|toolbarbutton\\|urlbar' sourcerer/shell/sourcerer.xhtml == 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "SourcererAPI.sys.mjs is the sole file in sourcerer/shell/ permitted to touch a Firefox internal; the boundary guard scans a real non-empty file set and passes, self-test still catches a planted violation"
    requirement: "SHELL-02"
    verification:
      - kind: unit
        ref: "bash scripts/check-internals-boundary.sh (PASS, non-vacuous scan of sourcerer/shell/); bash scripts/check-internals-boundary.sh --self-test (PASS)"
        status: pass
      - kind: unit
        ref: "grep -c setTimeout sourcerer/shell/SourcererAPI.sys.mjs == 0 (killProcess is a single proc.kill(graceMs) call, not a hand-rolled signal-then-timeout sequence)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Live end-to-end proof -- SOURCERER_SHELL_READY sentinel on cold launch, single-window paint, SourcererAPI-mediated sentinel line -- could not be captured. Genuinely blocked, not skipped: this executor's sandboxed session cannot get a Firefox content process past RenderCompositorSWGL/IPC channel setup at all, reproduced identically on the untouched Phase-3 objdir-release binary (predates every line this plan wrote)."
    requirement: "SHELL-01, SHELL-05"
    verification: []
    human_judgment: true
    rationale: "Requires a human (or a differently-provisioned CI runner) to run objdir/dist/bin/sourcerer --headless --profile <dir> (or under a real/virtual X display) and confirm SOURCERER_SHELL_READY / SOURCERER_SIDECAR_PREFS / SOURCERER_SHELL_SWAP-adjacent sentinels appear on stdout and exactly one window paints. Every acceptance criterion answerable from static/build-artifact inspection has been verified (see D1-D5); the remaining gap is purely the live-render step, tracked in .planning/WINDOWS.md entry #2 (unrun-verify)."

duration: 3h10min
completed: 2026-08-26
status: complete
---

# Phase 4 Plan 3: Full-Window Theia Shell -- Chrome Bootstrap Summary

**The startup window is now our own `sourcerer.xhtml` (branded loading layer + one remote `<browser>`, zero custom chrome), `SourcererAPI.sys.mjs` is the single anti-corruption layer with the boundary guard passing against it, and the phase's one full `./mach build` is spent -- after discovering and fixing a stale-config bug that would otherwise have shipped this plan without the compiled `BROWSER_CHROME_URL` change ever actually taking effect.**

## Performance

- **Duration:** ~3h10min (dominated by build/rebuild cycles and live-launch diagnosis, not code authoring)
- **Started:** 2026-08-26T21:07:07Z
- **Completed:** 2026-08-27T00:15Z
- **Tasks:** 3
- **Files modified:** 8 (7 created, 1 modified)

## Accomplishments

- `patches/020-sourcerer-shell.patch`: two hunks, `browser/moz.configure`'s `BROWSER_CHROME_URL` repointed to `chrome://sourcerer/content/sourcerer.xhtml`, `browser/moz.build` gains `DIRS += ["../sourcerer/shell"]`. Replays cleanly from a pristine `upstream/` after 010, both non-vacuous; `browser/base/content/browser.xhtml` stays byte-untouched.
- `sourcerer/shell/{moz.build,jar.mn}`: register `chrome://sourcerer/content/` as a new top-level, non-web-accessible package inside `browser.jar` (no third patch hunk against `package-manifest.in`).
- `sourcerer/shell/sourcerer.xhtml`: the entire startup window -- HTML root with `xmlns:xul`, `windowtype="sourcerer:main"`, CSP `default-src chrome:`, one branded loading `<div>`, one `<xul:browser id="sourcerer-content" type="content" primary="true" remote="true" remoteType="web">`. Zero tab strip/toolbar/menu/address-bar markup.
- `sourcerer/shell/sourcerer.js`: chrome bootstrap. Writes `SOURCERER_SHELL_READY chrome://sourcerer/content/sourcerer.xhtml` via `dump()` as the first statement in its `DOMContentLoaded` handler, before anything else runs. Exposes `window.sourcererSwapToUrl(url)` (writes `SOURCERER_SHELL_SWAP <url>`, then `fixupAndLoadURIString` using this document's own `nodePrincipal`) and `window.sourcererGetBrowser()` for plan 04-04. Imports `SourcererAPI.sys.mjs` and emits `SOURCERER_SIDECAR_PREFS backendMain=... nodePath=...` reading two sidecar prefs back through it.
- `sourcerer/shell/sourcerer-sidecar.js`: preprocessed default-pref file (`#filter substitution`), `sourcerer.sidecar.{nodePath,backendMain,healthIntervalStartupMs,healthIntervalSteadyMs,startupTimeoutMs,healthTimeoutMs,killGraceMs,logBufferLines}` plus `browser.dom.window.dump.enabled`. `backendMain` substitutes to an absolute, on-disk path with no hardcoded user path checked into the repo.
- `sourcerer/shell/SourcererAPI.sys.mjs`: the anti-corruption layer. `getStringPref`/`getIntPref` (never throw), `getEnv`, `ensureDirectory` (`IOUtils.makeDirectory`), `pathSearch` (resolves `null` instead of throwing), `setSessionCookie` (`secure=false` for loopback HTTP per D-99, `httpOnly=true`, `SAMESITE_STRICT`, `SCHEME_HTTP`, not partitioned), `spawnProcess` (`Subprocess.call`, explicit argv, never a shell), `killProcess` (a single `proc.kill(graceMs)` call -- the platform method already does SIGTERM/grace/SIGKILL), `readPipeChunk`, `onQuitGranted`, `log`.
- One full `./mach build` spent, plus one tier-2 `./mach build faster` for the Task 2 `jar.mn` addition (~10s).
- `scripts/fetch-upstream.sh`: fixed a real bug discovered while proving rebase-safety -- `.mozbuild/` (Firefox build-tooling state, repo-local per `flake.nix`) was read as unaccounted dirt by the D-76 classifier. Excluded via a `git status --porcelain` pathspec; `--self-test` and the real run both still pass.

## Task Commits

1. **Task 1: Repoint the startup window and spend the one full build** - `f835f6e` (feat)
2. **Task 2: The anti-corruption layer** - `6897461` (feat)
3. **Task 3: Prove the shell adds no chrome and the patch stack stays rebase-safe** - `76b5696` (fix)

**Plan metadata:** (this commit)

## Files Created/Modified

- `patches/020-sourcerer-shell.patch` - the phase's second and final Gecko patch hunk pair
- `sourcerer/shell/moz.build` - `JAR_MANIFESTS`, `DEFINES["SOURCERER_DEV_TREE"] = TOPSRCDIR + "/.."`, `JS_PREFERENCE_PP_FILES`
- `sourcerer/shell/jar.mn` - chrome package registration, three content mappings
- `sourcerer/shell/sourcerer.xhtml` - the startup window document
- `sourcerer/shell/sourcerer.js` - chrome bootstrap, sentinels, `SourcererAPI` proof-of-resolution
- `sourcerer/shell/sourcerer-sidecar.js` - preprocessed sidecar pref defaults
- `sourcerer/shell/SourcererAPI.sys.mjs` - the anti-corruption layer, 10 methods
- `scripts/fetch-upstream.sh` - `.mozbuild/` excluded from the D-76 dirt classifier

## Decisions Made

1. **`document.nodePrincipal` instead of `Services.scriptSecurityManager.getSystemPrincipal()`.** A chrome-privileged document's own `nodePrincipal` already is the system principal, so `sourcerer.js`'s `sourcererSwapToUrl` never needs to reach for `Services.*` directly -- it stays outside `check-internals-boundary.sh`'s exemption without losing the ability to navigate the content browser with a valid `triggeringPrincipal`.
2. **`#filter substitution` is mandatory, not implied, for a JS preprocessed file.** Discovered live: `mozbuild.preprocessor.Preprocessor.failUnused()` raises `no preprocessor directives found` on a `.js` PP file with zero `#`-directives, and even once a directive exists, `@VAR@` replacement is inert until the `substitution` filter is explicitly turned on via `#filter substitution` (confirmed against `browser/app/profile/firefox.js`'s own header).
3. **`ChromeUtils.importESModule(...)` call kept on one physical line with its `chrome://sourcerer/` argument.** `check-internals-boundary.sh`'s forbidden-pattern scan is per-line; `ChromeUtils.importESModule` contains the substring `ChromeUtils.import`, and the guard's conditional carve-out (allowed only when the same line also contains `chrome://sourcerer/`) fails if the call is wrapped across two lines.
4. **`.mozbuild/` excluded from `fetch-upstream.sh`'s dirt scan via a pathspec, not a patch to `upstream/.gitignore`.** `.mozbuild/` is Mozilla build-tooling state (this repo's `flake.nix` points `MOZBUILD_STATE_PATH` at it to stay repo-local), not Gecko source -- patching `upstream/.gitignore` to ignore it would need a third patch hunk for zero functional benefit and would break D-93's "020 carries exactly two hunks in two files" invariant.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stale `mozilla-config.h` meant the compiled `BROWSER_CHROME_URL` define never actually changed after the first "successful" `./mach build`**
- **Found during:** Task 1, after the first full build reported success and the built binary still would not resolve to our chrome window (root-caused via `mozilla-config.h` inspection after a long live-launch diagnosis).
- **Issue:** This plan reused `objdir/` from Phase 3's own prior full builds. `./mach build` completed with no errors, but `objdir/mozilla-config.h`'s `BROWSER_CHROME_URL`/`BROWSER_CHROME_URL_QUOTED` `#define`s (the actual compiled constant `AppWindow.cpp`/`ClientOpenWindowUtils.cpp`/`BrowserWindowTracker.sys.mjs` consume) stayed on the OLD, pre-patch value the whole time -- `./mach configure` alone did not rewrite it, because `mozilla-config.h` generation is itself a `GeneratedFile` action (`CONFIGURE_DEFINE_FILES`) with its own `.deps/mozilla-config.h.stub` staleness tracking, and that stub's timestamp was newer than the underlying source it should have depended on. `AppConstants.sys.mjs` (the JS-level `@BROWSER_CHROME_URL@` substitution) picked up the new value correctly the whole time -- only the C++-compiled path was stuck, which is why the earlier "successful" 4-minute and 8-second rebuilds were suspiciously fast: they were not actually recompiling anything the real change touched.
- **Fix:** Deleted `objdir/.deps/mozilla-config.h.stub` and `.pp`, ran `make -C objdir export` to regenerate `mozilla-config.h` with the correct value, confirmed via `grep`, then re-ran the real full `./mach build` (this time genuinely invalidating and recompiling `AppWindow.cpp`/`ClientOpenWindowUtils.cpp` and relinking -- ~2m47s wall via sccache's warm cache for everything else).
- **Files modified:** none (this was an `objdir/` state fix, not a source change; `objdir/` is entirely gitignored)
- **Verification:** `grep BROWSER_CHROME_URL objdir/mozilla-config.h` now reads `chrome://sourcerer/content/sourcerer.xhtml` on both the `_QUOTED` and bare macro; `--version` still reports `Deocracy Sourcerer 153.1.0esr`; the chrome package resolves correctly in the rebuilt `dist/bin`.
- **Committed in:** `f835f6e` (documented in the commit body; no separate file diff since it was objdir-only)

**2. [Rule 1 - Bug] `fetch-upstream.sh`'s D-76 dirt classifier flagged `.mozbuild/` as unaccounted dirt**
- **Found during:** Task 3, while proving the two-patch stack replays cleanly from pristine.
- **Issue:** `flake.nix`'s `firefox` devShell sets `MOZBUILD_STATE_PATH` to `upstream/.mozbuild` (repo-local instead of `~/.mozbuild`); any `./mach` invocation creates this directory on first use. `upstream/.gitignore` (part of the real, tracked mozilla-central tree) has no entry for it, so `git -C upstream status --porcelain` reports it as untracked, and `fetch-upstream.sh`'s classifier read that as "Gecko modified outside the patch stack" -- failing a correctly, fully-patched tree.
- **Fix:** Excluded `.mozbuild/` from the `git status --porcelain` scan via a pathspec (`-- . ':!.mozbuild'`) inside `classify_upstream_dirt`, rather than patching `upstream/.gitignore` (which would need a third patch hunk for a non-Gecko, non-shipping file).
- **Files modified:** `scripts/fetch-upstream.sh`
- **Verification:** `bash scripts/fetch-upstream.sh --self-test` (all 4 sub-cases still PASS); `bash scripts/fetch-upstream.sh` against the real, fully-patched, `.mozbuild/`-containing tree now reports `fully-applied -- dirt matches the patch stack exactly`.
- **Committed in:** `76b5696`

---

**Total deviations:** 2 auto-fixed (1 blocking-issue fix that was load-bearing for the plan's entire purpose, 1 bug in supporting tooling discovered by this plan's own rebase-safety check).
**Impact on plan:** Deviation 1 is the difference between this plan actually landing SHELL-01 and merely appearing to (the earlier "successful" builds would have shipped with the stock `browser.xhtml` still opening at startup). Deviation 2 is a pre-existing latent gap in Phase 3's own tooling, surfaced only because this plan is the first to run a full build and then immediately re-verify rebase-safety in the same session. No scope creep in either case -- no new files beyond the plan's own manifest, no new dependencies.

## Issues Encountered

**Live end-to-end verification of the startup window could not be completed.** After landing the real compiled-define fix (Deviation 1 above), every attempt to launch `objdir/dist/bin/sourcerer` and observe the `SOURCERER_SHELL_READY` sentinel on stdout failed the same way, across ~20 attempts spanning headless mode, a real virtual X server (Xvfb), Firefox's own GPU/content sandboxes disabled (`MOZ_DISABLE_GPU_SANDBOX`/`MOZ_DISABLE_CONTENT_SANDBOX`), `LIBGL_ALWAYS_SOFTWARE`, `MOZ_WEBRENDER=0`, `MOZ_ACCELERATED=0`, and single-process mode (`MOZ_FORCE_DISABLE_E10S=1`):

- A `Crash Annotation GraphicsCriticalError: RenderCompositorSWGL failed mapping default framebuffer, no dt` is logged within ~1s of every launch.
- The process then either hangs indefinitely with no further output (window created per `xdotool`/`xwininfo` in some runs, but never painted -- confirmed via an Xvfb screenshot showing solid black), or exits after ~10-15s with four repeated `Exiting due to channel error.` lines (a content-process IPC channel repeatedly failing to establish).
- No `gBrowser is undefined` or any other undefined-global JS error (`shell05-paint-before-backend`'s specific residual-risk check) was ever observed in any of the ~20 captured logs -- the failure is at the native compositor/IPC layer, not in chrome JS assuming the wrong shape.
- **Decisively isolated as pre-existing and environmental, not caused by this plan:** the identical `GraphicsCriticalError` and identical eventual hang/channel-error reproduce on `objdir-release/dist/bin/sourcerer`, a binary built entirely in Phase 3 that still opens the STOCK `chrome://browser/content/browser.xhtml` and contains none of this plan's code. `--version` (no window, no compositor) works correctly on both binaries. `strace -f` of a launch showed no ptrace/seccomp denials, `/dev/dri/renderD128` is world-writable, `/dev/shm` has 32G free and is not `noexec`, user namespaces are available (`unshare --user --pid` succeeds).
- Recorded in `.planning/WINDOWS.md` (`unrun-verify`, entry 2) so it stays visible at ship time. Every acceptance criterion answerable without a live paint (patch replay, chrome-package resolution, pref substitution, boundary guard, `--version` smoke test) is verified and passing -- see the `coverage:` block's D1-D5. D6 is the honest, human-judgment-flagged gap.

## User Setup Required

None - no external service configuration required. **However:** whoever next runs this plan's live verification (plan 04-04's own checks, or a re-run of `scripts/verify-phase-04.sh`'s non-`--quick` checks) needs an execution environment where Firefox's headless/Xvfb content-process bring-up actually completes -- confirmed NOT to work in this session's sandbox regardless of the mitigations listed above. A different CI runner or an interactive desktop session is the natural next place to try.

## Next Phase Readiness

- Plan 04-04 (backend supervisor / `TheiaService.sys.mjs`) can proceed on the code level -- `sourcerer.js`'s `window.sourcererSwapToUrl`/`sourcererGetBrowser` and `SourcererAPI`'s full method set are both in place and statically verified -- but inherits the SAME live-launch blocker for its own `side03-kill-and-recover` verification. Flag this early rather than rediscovering it independently.
- Plan 04-05 (`INTERNAL-APIS.md` catalogue) has a real, complete `SourcererAPI` surface to catalogue: `getStringPref`, `getIntPref`, `getEnv`, `ensureDirectory`, `pathSearch`, `setSessionCookie`, `spawnProcess`, `killProcess`, `readPipeChunk`, `onQuitGranted`, `log`.
- `scripts/verify-phase-04.sh --quick` passes end to end (both boundary-guard checks). The remaining 7 checks (all of which spawn a backend and/or launch the browser) are blocked by the same environmental limitation documented above -- not re-attempted in this plan, since Task 1-3's own scope is the shell, not the aggregator's non-`--quick` checks.
- No blockers for continuing to plan 04-04 on the code/architecture level. The live-verification gap is a session/infrastructure concern, tracked in `.planning/WINDOWS.md`, not a defect in any file this plan shipped.

---
*Phase: 04-full-window-theia-shell*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: patches/020-sourcerer-shell.patch
- FOUND: sourcerer/shell/moz.build
- FOUND: sourcerer/shell/jar.mn
- FOUND: sourcerer/shell/sourcerer.xhtml
- FOUND: sourcerer/shell/sourcerer.js
- FOUND: sourcerer/shell/sourcerer-sidecar.js
- FOUND: sourcerer/shell/SourcererAPI.sys.mjs
- FOUND: scripts/fetch-upstream.sh
- FOUND: f835f6e (Task 1 commit)
- FOUND: 6897461 (Task 2 commit)
- FOUND: 76b5696 (Task 3 commit)
