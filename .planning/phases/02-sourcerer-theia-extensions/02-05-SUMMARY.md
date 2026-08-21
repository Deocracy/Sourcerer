---
phase: 02-sourcerer-theia-extensions
plan: 05
subsystem: ui
tags: [theia, inversify, webdriver-bidi, firefox-headless, css-injection, dynamic-eval]

requires:
  - phase: 02-sourcerer-theia-extensions (plan 04)
    provides: "@theia/userstorage as an established direct dependency; VSX_REGISTRY_URL/THEIA_CONFIG_DIR (with mkdir -p) explicit in the start script"
  - phase: 02-sourcerer-theia-extensions (plan 02)
    provides: "scripts/lib/firefox-bidi.mjs's withFirefoxPage/waitFor, scripts/verify-dev-flag-off.mjs, scripts/verify-phase-02.sh's sequencing driver"
provides:
  - "@sourcerer/customize: CustomizeCssContribution (user CSS layer, hot-reload) and CustomizePrivilegedJsContribution (build-flag-gated JS layer)"
  - "scripts/verify-customize-inert.mjs -- CUST-01's pixel-equality proof"
  - "scripts/lib/firefox-bidi.mjs's withFirefoxPage screenshot() capability -- a same-session BiDi screenshot, needed because Plan 02's captureScreenshot fires before a Theia SPA settles"
  - "docs/CUSTOMIZE.md"
affects: [02-06, 02-07]

actuals:
  tokens: 8440
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Fire-and-forget file I/O in a FrontendApplicationContribution lifecycle hook (onStart/onDidInitializeLayout): apply a synchronous, harmless default immediately, then kick off the real async read WITHOUT awaiting it inside the hook -- awaiting a user-storage: read inside a hook that startContributions() itself awaits deadlocks the whole app against the RPC connection that read needs, which only comes up around/after that same chain resolves."
    - "DELETED-type file-change events bypass the ordinary 'keep last good content on read failure' guard and reset immediately -- a deliberate user delete is not the same case as a mid-save truncate/rename race, and conflating them left stale content on-screen after an intentional delete."
    - "withFirefoxPage's screenshot() (browsingContext.captureScreenshot inside the live BiDi session) instead of a fresh --headless --screenshot process launch per capture, whenever a test needs to see the SPA in its fully-settled state -- the CLI one-shot mode fires on the page's early load event, not on SPA readiness."

key-files:
  created:
    - theia/extensions/customize/package.json
    - theia/extensions/customize/tsconfig.json
    - theia/extensions/customize/src/browser/customize-css-contribution.ts
    - theia/extensions/customize/src/browser/customize-privileged-js-contribution.ts
    - theia/extensions/customize/src/browser/sourcerer-privileged-js.ts
    - theia/extensions/customize/src/browser/customize-frontend-module.ts
    - scripts/verify-customize-inert.mjs
    - docs/CUSTOMIZE.md
  modified:
    - theia/package.json
    - theia/applications/browser/package.json
    - scripts/verify-phase-02.sh
    - scripts/lib/firefox-bidi.mjs

key-decisions:
  - "onStart()/onDidInitializeLayout() in both contributions are synchronous (not async) and never await the file read they kick off -- discovered live that awaiting a user-storage: read inside a lifecycle hook `startContributions()` itself awaits deadlocks the entire app (the shell never attaches) because that read needs the frontend<->backend RPC connection, which only stabilizes around/after that same awaited chain resolves. Confirmed as boot-chain ordering, not a broken FileService activation, by the same coordinator who ran an independent repro (writing settings.json and observing the theme apply in the same boot) before this was implemented -- see Deviations."
  - "A DELETED-type change event resets the CSS layer to empty immediately, bypassing the ordinary read-failure guard that otherwise preserves the last good content -- without this, deleting customize.css while the app runs left the previous styling on screen instead of returning to the unstyled state, because a plain read failure and a deliberate delete were being treated identically."
  - "State 3's proof rule in verify-customize-inert.mjs is a full-viewport `position: fixed` overlay at max z-index, not a `body`/`html` background-color or border -- both were tried live and produced zero visible pixel difference, because #theia-app-shell is an opaque, absolutely-positioned element that fully covers body/html regardless of what's painted behind it."
  - "scripts/lib/firefox-bidi.mjs's withFirefoxPage gained a screenshot() export (browsingContext.captureScreenshot inside the existing BiDi session) rather than reusing Plan 02's captureScreenshot -- the latter's `--headless --screenshot` is a one-shot process launch with no scripting hook, found live to fire on the page's early `load` event well before startContributions()/shell-attach complete: every capture was ~99.9% white pixels regardless of customize.css content, and repeated captures of that same near-blank state were not even byte-identical (font-rasterization jitter across separate process launches). withFirefoxPage's screenshot() runs after an explicit waitFor('#theia-app-shell'), reuses one page across all three states, and produced byte-identical repeated captures of an unchanged page -- confirming byte-hash (D-69's branch one) is safe once the mechanism itself is correct."

requirements-completed: [CUST-01, CUST-02]

coverage:
  - id: D1
    description: "@sourcerer/customize's CustomizeCssContribution reads $THEIA_CONFIG_DIR/customize.css via UserStorageUri.resolve, injects it as a bare <style> element with no wrapper, never creates the file, and hot-reloads on save (debounced ~150ms) without blocking app startup"
    requirement: "CUST-01"
    verification:
      - kind: e2e
        ref: "Live BiDi session against a running yarn build/start: shell attaches (#theia-app-shell present), no-file state renders normally with an empty <style> present, a written high-specificity rule applies end-to-end (getComputedStyle confirms), a second write hot-reloads with exactly one net style-element replacement (count unchanged before/after), deleting the file resets to unstyled (not the last-good content), and an unreadable file (chmod 000) mid-session keeps the last good content in place -- all PASS"
        status: pass
      - kind: automated_ui
        ref: "node scripts/verify-customize-inert.mjs -- pixel-equality proof: state 1 (absent) == state 2 (empty) PASS, state 1 != state 3 (styled) PASS, both via SHA-256 over a same-session BiDi screenshot"
        status: pass
    human_judgment: false
  - id: D2
    description: "CustomizePrivilegedJsContribution executes $THEIA_CONFIG_DIR/customize.js only when theia.frontend.config.sourcererPrivilegedJs is true at build time; the DI token (Symbol.for('SourcererPrivilegedJs')) and the contribution's binding are skipped entirely (not runtime-guarded) when the flag is false or absent"
    requirement: "CUST-02"
    verification:
      - kind: unit
        ref: "grep -c \"Symbol.for('SourcererPrivilegedJs')\" == 1, no bare Symbol( for it"
        status: pass
      - kind: e2e
        ref: "node scripts/verify-dev-flag-off.mjs: default (flag false) PASS; flag temporarily flipped true and rebuilt, --expect-bound PASS (positive control); key removed entirely from theia.frontend.config and rebuilt, default mode still PASS (absent behaves as off); restored to false and rebuilt before committing"
        status: pass
      - kind: e2e
        ref: "With flag true: a customize.js setting a global marker observed with container+shell populated after startup; a customize.js whose top level throws still lets the shell attach (console-reported, not fatal) -- both PASS"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/CUSTOMIZE.md documents both layers accurately, including the security posture (DI container is a page global in every build; the flag is not a boundary against script already running in the page) and the pre-existing-reach statement (the config directory is not a security boundary)"
    verification:
      - kind: manual_procedural
        ref: "docs/CUSTOMIZE.md reviewed against D-57/D-65/D-66's exact wording requirements"
        status: pass
    human_judgment: false

duration: ~2h (includes an extended live investigation into an app-boot deadlock, resolved with the orchestrating coordinator before implementing the fix)
completed: 2026-08-21
status: complete
---

# Phase 2 Plan 05: Customization Layer (CSS hot-reload + gated privileged JS) Summary

**`@sourcerer/customize` ships a working, live-verified CSS hot-reload layer (D-54/57/58/59/60/61) and a build-flag-gated privileged JS layer (D-62..67, CUST-02), after discovering and fixing a real app-boot deadlock caused by awaiting a `user-storage:` file read inside a `FrontendApplicationContribution` lifecycle hook.**

## Performance

- **Duration:** ~2h (majority spent live-diagnosing why the app's shell never attached with the CSS contribution's original, plan-literal `await`-based `onStart()`)
- **Tasks:** 3 completed
- **Files modified:** 12 (8 created, 4 modified)

## Accomplishments

- `@sourcerer/customize`'s `CustomizeCssContribution` reads `$THEIA_CONFIG_DIR/customize.css` via `UserStorageUri.resolve('customize.css')`, injects it as a bare `<style>` element with the file's literal bytes and no wrapper, never creates the file, and hot-reloads on save through the existing config-dir watch (`@theia/userstorage`'s free recursive watch) with a ~150ms debounce. Verified live end to end: absent file renders identically to an empty one, a written rule applies within the debounce window, a second write hot-reloads with no duplicate style elements, deleting the file resets to unstyled, and an unreadable file mid-session keeps the last good content rather than blanking it.
- `CustomizePrivilegedJsContribution` executes `$THEIA_CONFIG_DIR/customize.js` only when `theia.frontend.config.sourcererPrivilegedJs` is `true` at build time. The DI token (`Symbol.for('SourcererPrivilegedJs')`) and the contribution's binding are skipped entirely inside the guarded `ContainerModule` callback when the flag is off or absent -- proven with a working positive control (`scripts/verify-dev-flag-off.mjs --expect-bound`), not just the negative case.
- A live app-boot deadlock was found, diagnosed, and fixed: awaiting the CSS file's initial read inside `onStart()` (as the plan's action text specified) hung `startContributions()` forever and the shell never attached, because that read needs the frontend<->backend RPC connection which only stabilizes around/after `startContributions()` itself resolves. Both contributions now apply a synchronous, harmless default (an empty `<style>`; no JS execution) and kick off the real read without awaiting it inside the hook. Root-caused live with the orchestrating coordinator, who independently reproduced the same boot in a way that proved `user-storage:` reads work fine off the boot-blocking path (a `settings.json` write took effect in the same boot) -- see Deviations for the full account, since the first diagnosis (a hypothesized permanent Theia-internals defect) was wrong and was corrected before the fix was implemented.
- `scripts/verify-customize-inert.mjs` proves CUST-01's inertness claim by pixel comparison: state 1 (absent) == state 2 (empty), state 1 != state 3 (styled, so an inert-because-broken layer cannot pass). D-69's one open detail (byte-hash vs. pixel-decode) was settled empirically rather than assumed, and along the way surfaced that Plan 02's `captureScreenshot` helper is unusable for this purpose (fires before the SPA settles) -- fixed by adding a same-session `screenshot()` capability to `withFirefoxPage` in `scripts/lib/firefox-bidi.mjs`.
- `docs/CUSTOMIZE.md` documents both layers for end users, stating the security posture accurately (the DI container is exposed on a page global in every build; the flag is not a boundary against script already executing in the page) and the pre-existing-reach note (the config directory is not a security boundary) rather than overclaiming.

## Task Commits

1. **Task 1: `@sourcerer/customize` package and the user CSS layer** - `f547a4a` (feat)
2. **Task 2: The privileged JS layer behind a build-time flag** - `5559062` (feat)
3. **Task 3: Pixel-equality proof for CUST-01 inertness, and the customization doc** - `7cc10c0` (feat)

## Files Created/Modified

- `theia/extensions/customize/package.json` - extension manifest, `@theia/userstorage` + `p-debounce` as direct dependencies
- `theia/extensions/customize/tsconfig.json` - full theia-ide base compilerOptions (mirrors `@sourcerer/branding`)
- `theia/extensions/customize/src/browser/customize-css-contribution.ts` - `CustomizeCssContribution`: read/inject/hot-reload, non-blocking `onStart`
- `theia/extensions/customize/src/browser/sourcerer-privileged-js.ts` - `SourcererPrivilegedJs` token (`Symbol.for`) and the surface interface
- `theia/extensions/customize/src/browser/customize-privileged-js-contribution.ts` - `CustomizePrivilegedJsContribution`: gated `customize.js` execution
- `theia/extensions/customize/src/browser/customize-frontend-module.ts` - `ContainerModule` with the guarded privileged-binding `if`
- `theia/package.json` - `build:extensions` now also builds `extensions/customize`
- `theia/applications/browser/package.json` - `@sourcerer/customize` added as a dependency
- `scripts/verify-customize-inert.mjs` - CUST-01's pixel-equality proof
- `scripts/verify-phase-02.sh` - `verify-customize-inert` appended to the CHECKS sequence
- `scripts/lib/firefox-bidi.mjs` - `withFirefoxPage` gained a `screenshot()` export
- `docs/CUSTOMIZE.md` - user-facing doc for both layers

## Decisions Made

See `key-decisions` in frontmatter for the four load-bearing notes: the fire-and-forget lifecycle-hook pattern (and why awaiting inside the hook deadlocks the app), the DELETED-event-bypasses-last-good-content fix, the full-viewport-overlay proof rule (and why body/html background didn't work), and the `withFirefoxPage.screenshot()` addition (and why Plan 02's `captureScreenshot` couldn't be reused as specified).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Awaiting the CSS file read inside `onStart()` deadlocked the entire app**
- **Found during:** Task 1, first live boot with the plan's literal `await this.applyCss()` inside `onStart()`
- **Issue:** The shell never attached (`#theia-app-shell` never appeared, confirmed after 60+ continuous seconds across three independent runs including a from-scratch backend restart). Extensive live tracing initially misdiagnosed this as a permanent defect in Theia's own `user-storage:` filesystem-provider activation (`FileService.activateProvider('user-storage')` never settling) and reached a checkpoint proposing three options, one of which would have deviated from D-54/56/57/60's locked mechanism. The orchestrating coordinator corrected this before any deviation was made: they independently wrote a `settings.json` and observed the theme apply live in the same kind of boot, proving `user-storage:` reads resolve fine -- the actual mechanism is a boot-chain ordering deadlock (the read needs the frontend<->backend RPC connection, which stabilizes around/after `startContributions()` -- the very chain `onStart()`'s `await` was blocking -- resolves), not a broken activation.
- **Fix:** Both contributions now apply a synchronous, harmless default in the lifecycle hook (`replaceStyleElement('')` for the CSS layer; nothing for the JS layer) and kick off the real file read without awaiting it inside the hook itself.
- **Files modified:** `theia/extensions/customize/src/browser/customize-css-contribution.ts`, `theia/extensions/customize/src/browser/customize-privileged-js-contribution.ts`
- **Verification:** Shell attaches immediately; no-file state renders normally; a written rule applies end-to-end; hot reload applies exactly once; delete resets to unstyled; unreadable-file mid-session keeps last good content. `scripts/verify-phase-02.sh --build` full suite: `diff-theia-core`/`verify-branding`/`verify-dev-flag-off`/`verify-customize-inert` PASS, `verify-uri-roundtrip` FAIL as expected (Plan 06 not yet landed).
- **Committed in:** `f547a4a` (Task 1 commit)

**2. [Rule 1 - Bug] Deleting `customize.css` left stale styling on screen instead of resetting**
- **Found during:** Task 1, live verification of the plan's "deleting the file returns the page to the unstyled state" acceptance criterion
- **Issue:** The read-failure guard added to preserve content across a mid-save truncate/rename race (D-60) also caught a genuine, deliberate file deletion, since both surface as the same `fileService.read()` rejection -- the previous styling stayed on screen after the user removed the file.
- **Fix:** The file-change subscription now checks `event.contains(this.uri, FileChangeType.DELETED)` first and resets immediately on a confirmed delete, bypassing the "keep last good content" guard, which still applies to non-DELETED (mid-save) read failures.
- **Files modified:** `theia/extensions/customize/src/browser/customize-css-contribution.ts`
- **Verification:** Live: write a rule, confirm applied; delete the file; confirm the page returns to default (not the deleted rule's styling).
- **Committed in:** `f547a4a` (Task 1 commit)

**3. [Rule 1 - Bug] Plan 02's `captureScreenshot` cannot see a settled Theia SPA**
- **Found during:** Task 3, step 0's byte-identity experiment for `verify-customize-inert.mjs`
- **Issue:** `captureScreenshot` (`--headless --screenshot`, a one-shot process launch) fires on the page's early `load` event -- well before `startContributions()`/shell-attach complete. Every capture was ~99.9% white pixels (sampled) regardless of `customize.css` content, and repeated captures of that same near-blank state were not even byte-identical (small, stable, font-rasterization-jitter region across separate process launches).
- **Fix:** Added `screenshot()` to `withFirefoxPage`'s callback (`browsingContext.captureScreenshot` inside the existing BiDi session), letting the caller wait for `#theia-app-shell` and settle before capturing. `verify-customize-inert.mjs` uses this instead, and reuses one page across all three states rather than three fresh boots -- also a more faithful test of the hot-reload claim than independent boots would have been.
- **Files modified:** `scripts/lib/firefox-bidi.mjs`, `scripts/verify-customize-inert.mjs`
- **Verification:** Repeated same-session captures of an unchanged page are SHA-256 identical (confirmed twice); state 1 == state 2 and state 1 != state 3 both PASS against the real running app.
- **Committed in:** `7cc10c0` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 -- bugs blocking the plan's own `<verify>`/acceptance criteria or discovered live while proving them). None reverse or reword any locked decision (D-54/56/57/60/61/62-67 are all implemented exactly as specified); all three are about *when* and *how* the already-specified mechanisms are invoked.
**Impact on plan:** No scope creep -- all three were required for the plan's own acceptance criteria (a working hot-reload layer, a correct delete behavior, an honest pixel-equality proof) to pass for real rather than vacuously or not at all.

## Issues Encountered

The Task 1 boot-deadlock investigation (deviation 1) initially reached a wrong conclusion (a permanent Theia-internals defect) and produced a `checkpoint:decision` proposing three options, one of which (bypassing `user-storage:` scheme entirely) would have been a real architectural deviation from four locked decisions. The orchestrating coordinator identified the correct mechanism (a boot-chain ordering deadlock, not a broken activation) with an independent live repro before any such deviation was implemented. No deviation from D-54/56/57/60 exists in the shipped code -- flagged here so the false start is visible rather than silently dropped from the record.

## User Setup Required

None -- no external service configuration required.

## Known Stubs

- **`SourcererPrivilegedJsSurface.tabUriRegistry` is always `undefined`.** D-67 specifies the privileged JS surface should include the tab-URI registry alongside the container and shell, but `@sourcerer/tab-uris` (Plan 06) does not exist yet in this plan's dependency chain (`02-05` depends only on `02-04`; `02-06` depends on both `02-04` and `02-06`'s own predecessor, `02-05`). The property is reserved in the interface (`sourcerer-privileged-js.ts`) so a later plan can populate it without changing the surface's shape, but no plan in this phase currently wires it up (`02-06-PLAN.md`'s `files_modified` does not include the customize extension). A future plan should add `@sourcerer/tab-uris` as a dependency of `@sourcerer/customize` and inject `TabUriRegistry` once it exists.

## Threat Flags

None. The privileged JS execution surface (`new Function('sourcerer', source)`) is exactly the surface CUST-02 specifies, already extensively documented in D-62 through D-67 and restated in `docs/CUSTOMIZE.md`'s security-posture section -- not an undocumented addition.

## Next Phase Readiness

`@sourcerer/customize` is live and verified: both layers work as specified, `scripts/verify-phase-02.sh`'s full suite is green except the expected `verify-uri-roundtrip` red (unchanged, pending Plan 06's `TabUriRegistry`). `scripts/lib/firefox-bidi.mjs`'s new `screenshot()` capability is available to any later plan that needs to see a fully-settled page rather than the page's early `load` state. The `tabUriRegistry: undefined` gap (Known Stubs) is the one piece of D-67 not yet closed -- worth a small follow-up once `@sourcerer/tab-uris` lands. No other blockers.

## Self-Check: PASSED

All 8 created files and 4 modified files confirmed present on disk; all three task commits (`f547a4a`, `5559062`, `7cc10c0`) confirmed in `git log`.

---
*Phase: 02-sourcerer-theia-extensions*
*Completed: 2026-08-21*
