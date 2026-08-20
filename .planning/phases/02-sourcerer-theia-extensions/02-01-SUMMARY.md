---
phase: 02-sourcerer-theia-extensions
plan: 01
subsystem: ui
tags: [theia, inversify, webdriver-bidi, firefox-headless, svg-favicon]

requires:
  - phase: 01-nixos-toolchain-and-builds
    provides: objdir/dist/bin/firefox (153.1.0esr) and the theia/ workspace with applications/browser
provides:
  - "extensions/* workspace glob wired into theia/package.json and theia build"
  - "@sourcerer/branding package: proven theiaExtensions discovery, ContainerModule DI loading, and a DOM-mutating FrontendApplicationContribution"
  - "theia.frontend.config.applicationName and the undeclared sourcererPrivilegedJs custom-key path, both proven live in the running page (not assumed from source)"
  - "scripts/lib/firefox-bidi.mjs -- shared zero-dependency WebDriver BiDi driver for objdir/dist/bin/firefox, importable unchanged by every later phase-2 plan"
  - "scripts/verify-branding.mjs -- first consumer of the shared driver, extended (not sibling-scripted) by later plans"
affects: [02-02, 02-03, 02-05, phase-3-build-config]

actuals:
  tokens: 4500
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "@sourcerer/* extension packages: private npm workspace member under theia/extensions/*, theiaExtensions manifest key pointing at compiled lib/browser/*, no react peerDependency (import from @theia/core/shared/react instead)"
    - "WebDriver BiDi over Node's global WebSocket against objdir/dist/bin/firefox --headless, in place of Playwright/Puppeteer/geckodriver (D-69)"
    - "Recolor an inlined SVG favicon via its own <defs><style> @media (prefers-color-scheme: dark) block rather than shipping two asset variants"

key-files:
  created:
    - theia/extensions/branding/package.json
    - theia/extensions/branding/tsconfig.json
    - theia/extensions/branding/src/browser/sourcerer-mark.ts
    - theia/extensions/branding/src/browser/sourcerer-favicon-contribution.ts
    - theia/extensions/branding/src/browser/sourcerer-frontend-module.ts
    - scripts/lib/firefox-bidi.mjs
    - scripts/verify-branding.mjs
  modified:
    - theia/package.json
    - theia/applications/browser/package.json
    - .gitignore

key-decisions:
  - "tsconfig.json for @sourcerer/branding uses the FULL compilerOptions set from theia-ide's base.tsconfig.json (skipLibCheck, lib: [...,'dom'], declaration, etc.), not the abbreviated subset named in the plan's action text -- the abbreviated set fails tsc -b on @theia/core's own .d.ts files (Electron types, React namespace, socket.io) that skipLibCheck exists to suppress."
  - "verify-branding.mjs polls for the favicon link itself (waitFor), not just window.theia.container -- the generated src-gen/frontend/index.js assigns window.theia.container before application.start() runs onStart contributions, so a container-only wait races the favicon DOM mutation and fails intermittently."
  - ".gitignore's bare `lib/` rule is anchored to `theia/**/lib/` -- the unanchored form also matched scripts/lib/, silently excluding the shared BiDi driver (hand-written source, not build output) from every git status/add."
  - "sourcererPrivilegedJs is read in-page via Object.getOwnPropertySymbols(window), because FrontendApplicationConfigProvider stores the merged config behind a bare Symbol() (not Symbol.for), so there is no fixed property name or DI token an external BiDi evaluation can look up directly."

requirements-completed: [BRAND-05, CUST-02]

coverage:
  - id: D1
    description: "@sourcerer/branding extension package discovered by theia build via theiaExtensions, compiled with tsc -b, loaded into the frontend DI container with zero edits inside theia/node_modules/@theia/"
    requirement: "BRAND-05"
    verification:
      - kind: integration
        ref: "yarn --cwd theia build (tsc -b + theia build --app-target=browser --mode development), exit 0"
        status: pass
      - kind: e2e
        ref: "scripts/verify-branding.mjs http://localhost:3000"
        status: pass
    human_judgment: false
  - id: D2
    description: "Running app's document title reads Sourcerer and <head> carries a data:image/svg+xml favicon link, both proven in a headless browser"
    requirement: "BRAND-05"
    verification:
      - kind: e2e
        ref: "scripts/verify-branding.mjs http://localhost:3000 (asserts document.title === 'Sourcerer' and link[rel=icon] href starts with data:image/svg+xml)"
        status: pass
    human_judgment: true
    rationale: "Plan's own <verify><human-check> calls for visual confirmation on light and dark OS themes -- a headless assertion proves the DOM state but not that the mark is legible/undistorted at favicon size on a real display."
  - id: D3
    description: "theia.frontend.config.sourcererPrivilegedJs (undeclared custom key) survives ApplicationPackage merge and is readable in the running page -- the mechanism CUST-02's build-time gate depends on"
    requirement: "CUST-02"
    verification:
      - kind: e2e
        ref: "scripts/verify-branding.mjs http://localhost:3000 (asserts sourcererPrivilegedJs === false via Object.getOwnPropertySymbols(window) lookup)"
        status: pass
    human_judgment: false
  - id: D4
    description: "scripts/lib/firefox-bidi.mjs: zero-dependency WebDriver BiDi driver, no test dependency added to theia/package.json, guaranteed process/profile cleanup including on SIGINT"
    verification:
      - kind: unit
        ref: "node --check scripts/lib/firefox-bidi.mjs; grep confirms only node: built-in imports"
        status: pass
      - kind: integration
        ref: "manual SIGINT test mid-flight (both during spawn and after BiDi connect): pgrep -fc objdir/dist/bin/firefox unchanged, no /tmp/sourcerer-firefox-bidi-* directory left behind, harness exits 130"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-20
status: complete
---

# Phase 2 Plan 01: Sourcerer Branding Extension (tracer slice) Summary

**A `@sourcerer/branding` Theia extension proven end to end -- workspace discovery, `theiaExtensions` resolution, DI container loading, and a live DOM mutation -- verified in headless Firefox over WebDriver BiDi, not by reading source.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 1 completed (tracer)
- **Files modified:** 13 (10 plan-scoped files + 3 logo/ assets newly tracked)

## Accomplishments
- `theia/package.json` gained the `extensions/*` workspace glob, a pinned `typescript` devDependency, and a `build:extensions` script ahead of the app build -- the two-part wiring D-31 requires (workspace membership alone is invisible to `theia build` without the app's direct dependency entry).
- `@sourcerer/branding` compiles with `tsc -b`, is discovered via its `theiaExtensions` manifest key, and its `ContainerModule` binds a `FrontendApplicationContribution` that appends a recolored SVG favicon link to `document.head` on `onStart` -- zero changes anywhere inside `theia/node_modules/@theia/`.
- `theia.frontend.config.applicationName` (`"Sourcerer"`) and the undeclared `sourcererPrivilegedJs` boolean both survive the generator's `deepmerge` and land in the browser's `FrontendApplicationConfigProvider` state, proven by evaluating the live page rather than grepping `package.json`.
- `scripts/lib/firefox-bidi.mjs` -- a genuinely zero-dependency (Node built-ins only) WebDriver BiDi client against `objdir/dist/bin/firefox --headless` -- launches, connects, evaluates, and always cleans up its process and temp profile, verified under both a clean run and two SIGINT-mid-flight scenarios.
- `scripts/verify-branding.mjs` drives the shared library and asserts all three page-level truths (title, favicon href, custom config key), printing `verify-branding: PASS`/`FAIL -- <reason>` and exiting non-zero on failure.

## Task Commits

1. **Task 1: End-to-end "the app is branded Sourcerer"** - `7703f20` (feat)

_Single-task tracer plan; the entire vertical slice landed as one commit per the plan's tracer-task shape._

## Files Created/Modified
- `theia/package.json` - `extensions/*` workspace glob, `typescript` devDependency, `build:extensions` script
- `theia/applications/browser/package.json` - `@sourcerer/branding` direct dependency, `theia.frontend.config` block
- `theia/extensions/branding/package.json` - extension manifest (`theiaExtensions`, no `electronMain`, no `react` peerDependency)
- `theia/extensions/branding/tsconfig.json` - full theia-ide base compilerOptions inlined (see Deviations)
- `theia/extensions/branding/src/browser/sourcerer-mark.ts` - `SOURCERER_MARK_SVG` / `SOURCERER_MARK_DATA_URI`, recolored with a `prefers-color-scheme` media query
- `theia/extensions/branding/src/browser/sourcerer-favicon-contribution.ts` - `SourcererFaviconContribution`, `onStart`-hooked
- `theia/extensions/branding/src/browser/sourcerer-frontend-module.ts` - `ContainerModule` binding the contribution
- `scripts/lib/firefox-bidi.mjs` - shared headless driver, consumed unchanged by Plans 02/03/05
- `scripts/verify-branding.mjs` - first consumer of the shared driver
- `.gitignore` - anchored the Theia build-output `lib/` rule to `theia/**/lib/`
- `logo/LE logo.svg`, `logo/LE blue C bord@4x-8.png`, `logo/logo reworked.png` - newly git-tracked (were untracked)

## Decisions Made
- Used the full, verified `base.tsconfig.json` `compilerOptions` set for `@sourcerer/branding` rather than the plan's abbreviated list (see Deviations -- Rule 1).
- `verify-branding.mjs` polls for the favicon element itself via `waitFor`, not just `window.theia.container` readiness (see Deviations -- Rule 1).
- `.gitignore`'s `lib/` ignore rule anchored to `theia/**/lib/` (see Deviations -- Rule 1).
- Read `sourcererPrivilegedJs` in-page via `Object.getOwnPropertySymbols(window)` rather than `require()` (unavailable in the bundled frontend's global scope) or reading `package.json` on disk (which D-64 explicitly forbids as a vacuous-pass shape).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tsc -b` failed on abbreviated compilerOptions**
- **Found during:** Task 1, first `yarn build` attempt
- **Issue:** The plan's action text names a subset of `compilerOptions` (`rootDir`, `outDir`, `composite`, `jsx`, decorators, `module`, `moduleResolution`, `target`). Without `skipLibCheck`, `tsc -b` type-checked every `.d.ts` in `node_modules`, failing on `@theia/application-package`'s Electron-typed field, `React` namespace references (needs `lib: ["dom"]`), `socket.io`'s ambient `http` import, and `vscode-jsonrpc`'s `LinkedMap` vs. newer-TS `Map` iterator shape.
- **Fix:** Used the full `compilerOptions` block from RESEARCH.md's Pattern 1 (itself a verbatim citation of `theia-ide/configs/base.tsconfig.json` plus `baseUrl`/`esModuleInterop`), which the plan's own `<read_first>` names as the source to transcribe.
- **Files modified:** `theia/extensions/branding/tsconfig.json`
- **Verification:** `yarn build` completes with 0 errors on both `build:extensions` and the app build.
- **Committed in:** `7703f20` (part of task commit)

**2. [Rule 1 - Bug] Favicon assertion raced `onStart`**
- **Found during:** Task 1, first `verify-branding.mjs` run against the live app
- **Issue:** `window.theia.container` is assigned in `src-gen/frontend/index.js` *before* `application.start()` runs `onStart` contributions, so the plan's literal wait-for-container-then-assert sequence read the favicon link before `SourcererFaviconContribution.onStart()` had appended it -- an intermittent-by-construction race, not a one-off flake.
- **Fix:** `verify-branding.mjs` now polls for the favicon element itself (`waitFor(...)`) instead of relying on container-readiness as a proxy for full startup.
- **Files modified:** `scripts/verify-branding.mjs`
- **Verification:** Three consecutive `verify-branding.mjs` runs against a running `yarn start`, all PASS.
- **Committed in:** `7703f20` (part of task commit)

**3. [Rule 1 - Bug] `.gitignore`'s bare `lib/` rule swallowed `scripts/lib/`**
- **Found during:** Task 1, pre-commit `git status` review
- **Issue:** The pre-existing `.gitignore` had an unanchored `lib/` rule intended for Theia's TypeScript build output (`theia/*/lib/`). Git's gitignore matching treats an unanchored directory pattern as matching at any depth, so it also silently excluded the newly created `scripts/lib/firefox-bidi.mjs` -- hand-written source, not build output -- from `git status` and `git add`.
- **Fix:** Anchored the rule to `theia/**/lib/`, which still ignores every Theia build-output `lib/` directory and stops matching `scripts/lib/`.
- **Files modified:** `.gitignore`
- **Verification:** `git check-ignore -v scripts/lib/firefox-bidi.mjs` (no match, exit 1) vs. `git check-ignore -v theia/extensions/branding/lib/browser/sourcerer-frontend-module.js` (still matches, exit 0).
- **Committed in:** `7703f20` (part of task commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 -- bugs blocking task completion).
**Impact on plan:** All three were required for the plan's own `<verify>` to pass; no scope creep beyond what the plan already specified.

## Issues Encountered
None beyond the three auto-fixed deviations above.

## User Setup Required
None -- no external service configuration required.

## Next Phase Readiness
`scripts/lib/firefox-bidi.mjs` is ready for Plan 02 (which extends it with a screenshot helper for CUST-01) and for Plans 03/05 to import unchanged. The `extensions/*` workspace layout and `theia.frontend.config` key names are now load-bearing for the rest of the phase -- both `@sourcerer/customize` and `@sourcerer/tab-uris` (Plans 02+) follow the same package shape proven here. No blockers.

## Self-Check: PASSED

All 8 created/output files confirmed present on disk; both commits (`7703f20` task, `fe65acd` docs) confirmed in `git log`.
