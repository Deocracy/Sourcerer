---
phase: 02-sourcerer-theia-extensions
plan: 03
subsystem: ui
tags: [theia, inversify, react, jsx, webdriver-bidi, about-dialog, welcome-widget]

requires:
  - phase: 02-sourcerer-theia-extensions (plan 01)
    provides: "@sourcerer/branding package shape, ContainerModule DI loading, sourcerer-mark.ts, scripts/verify-branding.mjs as the file this plan extends"
  - phase: 02-sourcerer-theia-extensions (plan 02)
    provides: "scripts/verify-phase-02.sh sequencing driver, scripts/lib/firefox-bidi.mjs's waitFor/withFirefoxPage"
provides:
  - "SourcererWelcomeWidget (ReactWidget, WidgetFactory id 'welcome') and SourcererWelcomeViewContribution (AbstractViewContribution, initializeLayout-gated first-boot open) -- Plan 06's view: handler can address view:welcome"
  - "SourcererAboutDialog (guarded rebind of AboutDialog) -- Help/About shows Sourcerer identity, no @theia/* enumeration, no eclipse-theia.github.io link"
  - "theia/package.json devDependencies gain @types/react@18.3.31 / @types/react-dom@18.3.7 -- the first JSX-typed devDependency pair in the workspace, needed by every later @sourcerer/* React file"
  - "scripts/verify-branding.mjs extended with welcome/about surface checks plus a coverage guard -- all four BRAND-05 surfaces now proven by one re-runnable headless script"
affects: [02-04, 02-05, 02-06, 02-07]

actuals:
  tokens: 4574
  tasks: 3
  commits: 3

tech-stack:
  added: ["@types/react@18.3.31 (devDependency, type-only)", "@types/react-dom@18.3.7 (devDependency, type-only)"]
  patterns:
    - "AbstractViewContribution.initializeLayout() as the first-boot-only open hook, replacing @theia/getting-started's onStart+preference gate (D-24) -- fires only inside FrontendApplication.createDefaultLayout(), i.e. only when restoreLayout() finds no persisted state"
    - "AboutDialog subclass overrides render() entirely rather than renderHeader()/renderExtensions() individually, dropping both identity-leaking base renderers instead of restyling them (D-35)"
    - "External BiDi verification resolves Theia DI services (WidgetManager, ApplicationServer, CommandRegistry, AboutDialog, a view contribution) via container._bindingDictionary.traverse() reflection -- the same technique verify-uri-roundtrip.mjs established, now reused by verify-branding.mjs"

key-files:
  created:
    - theia/extensions/branding/src/browser/sourcerer-welcome-widget.tsx
    - theia/extensions/branding/src/browser/sourcerer-welcome-contribution.ts
    - theia/extensions/branding/src/browser/sourcerer-about-dialog.tsx
  modified:
    - theia/extensions/branding/src/browser/sourcerer-frontend-module.ts
    - scripts/verify-branding.mjs
    - theia/package.json
    - theia/yarn.lock

key-decisions:
  - "Added @types/react@18.3.31 and @types/react-dom@18.3.7 as devDependencies at theia/package.json root (same slot as Plan 01's typescript devDependency) -- react ships no bundled types and @theia/core lists both as OPTIONAL peers, which Yarn Classic never auto-installs; this is the first .tsx file in the project and the first time the gap was exercised. Type-only, never enters a runtime bundle, does not touch theia/node_modules/@theia/* (criterion 2 unaffected). Approved by the coordinator after independent verification of the @theia/core peerDependency range and the missing-types claim; exact versions pinned per D-19, not caret ranges."
  - "welcome widget verification does not use the toggle command -- AbstractViewContribution.toggleView()'s toggle logic closes an already-open main-area widget instead of re-revealing it (the main area 'cannot be collapsed, so close the widget' branch), and a fresh headless profile always has the widget open via initializeLayout() by the time the check runs. verify-branding.mjs resolves SourcererWelcomeViewContribution directly and calls openView({reveal:true, activate:true}), which is idempotent."
  - "welcome widget's repo link is a real <a href> (not a bare onClick div) with an onClick that calls windowService.openNewWindow -- satisfies both a literal href-based DOM check and the plan's stated reason for avoiding a bare <a href> (correct behaviour once this frontend is hosted inside the Firefox fork)."

requirements-completed: [BRAND-05]

coverage:
  - id: D1
    description: "SourcererWelcomeWidget opens on first boot only (initializeLayout, not onStart), carries product name + live application version + one repo link, registered under WidgetFactory id 'welcome' so Plan 06 can address it as view:welcome"
    requirement: "BRAND-05"
    verification:
      - kind: e2e
        ref: "scripts/verify-branding.mjs http://localhost:3000 (welcome surface: WidgetManager.getWidgets('welcome').length===1, textContent contains 'Sourcerer' and the live ApplicationServer version, matches neither /Theia/i nor /Eclipse/i)"
        status: pass
    human_judgment: false
  - id: D2
    description: "SourcererAboutDialog replaces AboutDialog via guarded rebind, overriding render() entirely so neither the eclipse-theia.github.io comparator link nor the @theia/* package enumeration is reachable"
    requirement: "BRAND-05"
    verification:
      - kind: e2e
        ref: "scripts/verify-branding.mjs http://localhost:3000 (about surface: opens via 'core.about' command, textContent matches neither /Theia|Eclipse/i nor /@theia\\//, no anchor href contains eclipse-theia)"
        status: pass
      - kind: integration
        ref: "Non-vacuous proof: temporarily commenting out the isBound-guarded rebind in sourcerer-frontend-module.ts (not committed) made the same check FAIL, listing every @theia/* package name+version in the failure reason -- restored and rebuilt before committing"
        status: pass
    human_judgment: false
  - id: D3
    description: "scripts/verify-branding.mjs extended (not sibling-scripted) to cover all four BRAND-05 surfaces -- title, favicon, welcome, about -- with a coverage guard that fails loudly if any surface silently never ran"
    verification:
      - kind: unit
        ref: "node --check scripts/verify-branding.mjs, exit 0"
        status: pass
      - kind: e2e
        ref: "node scripts/verify-branding.mjs http://localhost:3000 against a built app: PASS title / PASS favicon / PASS welcome / PASS about, exit 0"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-08-20
status: complete
---

# Phase 2 Plan 03: Sourcerer Welcome Widget and About Dialog Summary

**A from-scratch Sourcerer welcome tab (first-boot-only, WidgetFactory id `welcome`) and a DI-rebound About dialog that drops both of stock Theia's identity-leaking renderers entirely, both proven live over headless WebDriver BiDi -- plus the workspace's first `@types/react`/`@types/react-dom` devDependencies, needed because this is the first `.tsx` file the project has written.**

## Performance

- **Duration:** ~55 min (including the blocked-and-resumed dependency checkpoint)
- **Tasks:** 3 completed
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments
- `SourcererWelcomeWidget` (`ReactWidget`, `id: 'welcome'`) renders the Sourcerer mark, product name, live application version, and one link to `https://github.com/Deocracy/Sourcerer` -- nothing invented beyond that, per `02-CONTEXT.md`'s discretion leaning.
- `SourcererWelcomeViewContribution` (`AbstractViewContribution`) opens the widget exactly once, on first boot with no persisted layout (`initializeLayout()`), and never re-opens it after the user closes it and reloads -- the same first-boot-only behaviour `@theia/getting-started` provided (D-24), without any of its 8 hardcoded upstream URLs.
- `SourcererAboutDialog` overrides `AboutDialog.render()` entirely via the `isBound`-guarded rebind idiom, so neither `renderHeader()` (hard-links `eclipse-theia.github.io/vscode-theia-comparator`) nor `renderExtensions()` (lists every `@theia/*` package by name and version) is ever reached.
- `scripts/verify-branding.mjs` now proves all four BRAND-05 surfaces -- title, favicon, welcome, about -- in one re-runnable headless script, reusing the shared BiDi driver and the container-reflection technique `verify-uri-roundtrip.mjs` established, with a coverage guard that fails if any surface is silently skipped.
- Resolved a genuine workspace gap discovered live: `@types/react`/`@types/react-dom` were absent from the entire `node_modules` tree (optional peers of `@theia/core`, never auto-installed by Yarn Classic), blocking the project's first JSX file. Paused for explicit approval before adding them (see Deviations), then added at exact pins.

## Task Commits

1. **Task 1: Sourcerer welcome widget and its view contribution** - `1e861de` (feat)
2. **Task 2: Sourcerer About dialog by rebind** - `a019180` (feat)
3. **Task 3: Extend scripts/verify-branding.mjs to cover all four BRAND-05 surfaces** - `d7d78e1` (test)

## Files Created/Modified
- `theia/extensions/branding/src/browser/sourcerer-welcome-widget.tsx` - `SourcererWelcomeWidget`, `SOURCERER_REPO_URL`
- `theia/extensions/branding/src/browser/sourcerer-welcome-contribution.ts` - `SourcererWelcomeViewContribution`, `SourcererWelcomeCommand`
- `theia/extensions/branding/src/browser/sourcerer-about-dialog.tsx` - `SourcererAboutDialog`
- `theia/extensions/branding/src/browser/sourcerer-frontend-module.ts` - wired welcome `WidgetFactory`/`bindViewContribution`, guarded `AboutDialog` rebind
- `scripts/verify-branding.mjs` - welcome/about surface checks, coverage guard
- `theia/package.json` - `@types/react@18.3.31`, `@types/react-dom@18.3.7` devDependencies
- `theia/yarn.lock` - resolved entries for the above

## Decisions Made
See `key-decisions` in frontmatter for the three load-bearing decisions: the `@types/react`/`@types/react-dom` devDependency addition (coordinator-approved after independent verification), the welcome-widget verification's non-toggle open path, and the repo-link's real-`href`-plus-`onClick` shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, human-verified before proceeding] Missing `@types/react`/`@types/react-dom`**
- **Found during:** Task 1, first `yarn build` after writing `sourcerer-welcome-widget.tsx`
- **Issue:** `tsc -b` failed with TS2497 on `import * as React from '@theia/core/shared/react'`, cascading into `TS7026` (`JSX.IntrinsicElements` does not exist) on every JSX element. Traced with `--traceResolution`: `react@18.3.1` ships no bundled type declarations, and `@theia/core@1.74.1` lists `@types/react`/`@types/react-dom` as **optional** peer dependencies (`peerDependenciesMeta.optional: true`), which Yarn Classic never installs unless a workspace member declares them directly. Nothing in the workspace did -- this is the first `.tsx` file the project has written. Ruled out a hand-rolled ambient `.d.ts` shim as worse than the dependency itself (re-implements a slice of `@types/react`'s real surface, diverges silently, needs maintenance in every later `@sourcerer/*` React file) and ruled out `import X = require(...)` as a workaround (clears the TS2497 but not the `JSX.IntrinsicElements` errors, confirming the types package itself is the actual gap).
- **Why this paused instead of auto-fixing:** the phase's explicit non-negotiable rule ("No new npm dependency. If you think one is unavoidable, STOP and report.") required a checkpoint rather than a silent Rule 3 fix, matching the GSD deviation protocol's package-manager-install exclusion. Returned a `checkpoint:human-verify` (`gate: blocking-human`) with the full diagnosis and a proposed fix; the coordinator independently re-verified every claim (the peerDependency range, the missing types in `node_modules`) before approving, and supplied exact pins per D-19 (`18.3.31` / `18.3.7`, the latest 18.3.x satisfying `@theia/core`'s `^18.3.0` range against the installed `react@18.3.1`/`react-dom@18.3.1`).
- **Fix:** Added both as `devDependencies` in `theia/package.json`, same slot as Plan 01's `typescript` devDependency (checked that precedent per the coordinator's instruction rather than also adding to the `resolutions` block, which Plan 01 did not do for `typescript` either).
- **Side effect caught and fixed:** the plain `yarn install` needed to resolve the new devDependencies relinked `node_modules` and dropped the previously-compiled `node_modules/drivelist/build/Release/drivelist.node`, crashing the backend at boot (`@theia/core` requires it unconditionally; `docs/BUILD.md` already documents `yarn install --ignore-scripts` plus one explicit `(cd node_modules/drivelist && node-gyp rebuild)` for exactly this reason). Re-ran the documented rebuild step -- not a new gap, just re-applying the existing fix after a fresh install.
- **Files modified:** `theia/package.json`, `theia/yarn.lock`
- **Verification:** `yarn build` completes with 0 errors; `bash scripts/verify-phase-02.sh --build` returns `diff-theia-core: PASS`, `verify-branding: PASS`, `verify-dev-flag-off: PASS` (criterion 2's zero-`@theia/*`-drift check unaffected).
- **Committed in:** `1e861de` (Task 1 commit)

---

**Total deviations:** 1 (Rule 3, escalated to a human checkpoint per the phase's explicit no-new-dependency rule rather than auto-fixed).
**Impact on plan:** Required for the plan's own tasks 1-3 to compile and verify at all; no scope creep beyond what compiling JSX in this workspace needs. No architectural change, no runtime dependency, no touch inside `theia/node_modules/@theia/*`.

## Issues Encountered
None beyond the one auto-fixed-after-approval deviation above.

## User Setup Required
None -- no external service configuration required. The `@types/react`/`@types/react-dom` addition was a one-time coordinator approval already captured in this plan's execution, not a recurring setup step.

## Next Phase Readiness
All four BRAND-05 surfaces (title, favicon, welcome, about) are proven by `scripts/verify-branding.mjs`, and `@types/react`/`@types/react-dom` are now available in the workspace for every later `@sourcerer/*` React file (e.g. `@sourcerer/customize`'s widgets, if any) without re-triggering this gap. `SourcererWelcomeViewContribution` is registered through `AbstractViewContribution`, which Plan 06's `view:` handler discovers by scanning -- `view:welcome` is ready to be addressed once Plan 06 lands `TabUriRegistry`. No blockers.

## Self-Check: PASSED

All 6 created/modified source files confirmed present on disk; all three task commits (`1e861de`, `a019180`, `d7d78e1`) confirmed in `git log`.

---
*Phase: 02-sourcerer-theia-extensions*
*Completed: 2026-08-20*
