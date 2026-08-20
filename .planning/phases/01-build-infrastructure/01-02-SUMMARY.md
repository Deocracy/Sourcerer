---
phase: 01-build-infrastructure
plan: 02
subsystem: infra
tags: [theia, yarn-classic, node-pty, drivelist, node22, browser-target]

# Dependency graph
requires: ["01-01 (theia devShell, node-gyp-on-Node22 fix)"]
provides:
  - "theia/ yarn workspace: root package.json (workspaces, resolutions pinning all 12 @theia/* at 1.74.1) + applications/browser/package.json (11 @theia/* runtime deps + react/react-dom + @theia/cli devDependency)"
  - "theia/yarn.lock, committed, frozen-lockfile-installable"
  - "a stock Theia browser-target IDE that builds and boots at http://127.0.0.1:3000"
  - "scripts/smoke-theia.sh rewritten to prove node-pty via a real spawn test instead of the no-op `theia rebuild:browser`"
affects: ["01-03 (independent, firefox shell)", "01-04 (independent)", "Phase 2 (extends this exact workspace with @sourcerer/* extensions, per D-05)"]

actuals:
  tokens: 91083
  tasks: 2
  commits: 2

tech-stack:
  added: ["Theia 1.74.1 (11-package minimal set + react/react-dom 18.3.1)", "node-pty 1.2.0-beta.12 (prebuilt, not compiled)", "drivelist 12.0.2 (compiled via node-gyp)", "esbuild 0.28.2 (Theia's build backend, sibling-package prebuilt)"]
  patterns: ["yarn install --ignore-scripts + selective explicit node-gyp rebuild for the one package that genuinely needs it (drivelist)", "functional proof over build-step exit code for native modules whose loader has multiple resolution paths (node-pty prebuilds/ vs build/Release)"]

key-files:
  created:
    - theia/package.json
    - theia/applications/browser/package.json
    - theia/yarn.lock
  modified:
    - scripts/smoke-theia.sh
    - .gitignore

key-decisions:
  - "Added react@18.3.1 and react-dom@18.3.1 (exact) to applications/browser/package.json dependencies -- @theia/core requires them (peerDependencies react@^18.3.1||^19.0.0) and they were absent from RESEARCH.md's 11-package minimal set. theia-ide's own applications/browser/package.json (the D-06 reference layout) declares them directly, confirming this as the correct fix rather than a workaround."
  - "node-pty's D-10 proof is a real spawn-and-read-output test, not `theia rebuild:browser` exit code or a build/Release/pty.node file-existence check -- both were empirically false signals for this package/version (see Deviations)."

requirements-completed: [BUILD-01]

coverage:
  - id: D1
    description: "theia build produces 0 errors from the pinned 11-package + react/react-dom set"
    requirement: "BUILD-01"
    verification:
      - kind: other
        ref: "yarn --cwd applications/browser build -> [build/browser] Finished with 0 errors; [build/node] Finished with 0 errors"
        status: pass
    human_judgment: false
  - id: D2
    description: "yarn theia start boots and answers at a localhost URL"
    requirement: "BUILD-01"
    verification:
      - kind: other
        ref: "Backend log: 'Theia app listening on http://127.0.0.1:3000.'; curl -sf http://localhost:3000 exits 0 and returns index.html titled 'Sourcerer (dev)'"
        status: pass
    human_judgment: false
  - id: D3
    description: "node-pty is genuinely usable under the pinned Node 22 -- not merely present"
    requirement: "BUILD-01"
    verification:
      - kind: other
        ref: "node -e spawn test: pty.spawn('bash', ...), wrote 'echo PTY_PROOF_$((21+21))', read back PTY_PROOF_42 from real terminal output -> PASS"
        status: pass
    human_judgment: false
  - id: D4
    description: "drivelist (the one package needing its install script per the mandated constraints) compiles and loads under Node 22"
    requirement: "BUILD-01"
    verification:
      - kind: other
        ref: "node-gyp rebuild -> gyp info ok; node -e 'require(\"./node_modules/drivelist\")' -> drivelist loaded ok, has list(): true"
        status: pass
    human_judgment: false
  - id: D5
    description: "@theia/* resolves to exactly 1.74.1 workspace-wide, no drift"
    requirement: "BUILD-01"
    verification:
      - kind: other
        ref: "yarn list --pattern '@theia/core' --depth=0 -> only 1.74.1"
        status: pass
    human_judgment: false
  - id: D6
    description: "scripts/smoke-theia.sh (the BUILD-01 gate) exits 0 end-to-end, including on a second frozen-lockfile run"
    requirement: "BUILD-01"
    verification:
      - kind: other
        ref: "Two full runs, both exit 0; second (warm-cache) run completed in 11.9s"
        status: pass
    human_judgment: false

duration: 23min
completed: 2026-08-20
status: complete
---

# Phase 1 Plan 2: Theia Yarn Workspace Summary

**A stock Theia 1.74.1 browser-target workspace (11 `@theia/*` packages + react/react-dom, all exact-pinned) builds cleanly and boots at `http://127.0.0.1:3000`, with `node-pty` proven by an actual PTY spawn-and-echo test rather than a build-step exit code.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-08-20T15:10:58Z
- **Completed:** 2026-08-20T15:33:34Z
- **Tasks:** 2 (the package-legitimacy checkpoint was pre-cleared by the orchestrator per the independently-verified npm-registry audit in the dispatch context)
- **Files modified:** 5 (`theia/package.json`, `theia/applications/browser/package.json`, `theia/yarn.lock`, `scripts/smoke-theia.sh`, `.gitignore`)

## Accomplishments

- `theia/package.json` — root workspace (`workspaces: ["applications/*"]`), `resolutions` pinning all 12 `@theia/*` packages exactly at `1.74.1`, `engines` (yarn Classic, node `>=22`), `build`/`start` scripts delegating into `applications/browser`
- `theia/applications/browser/package.json` — the 11-package minimal set (`@theia/core`, `editor`, `filesystem`, `markers`, `messages`, `monaco`, `navigator`, `preferences`, `process`, `terminal`, `workspace`) plus `react`/`react-dom` at exact `18.3.1` (deviation, see below), `@theia/cli` as the sole devDependency, no Electron target, no `@sourcerer/*` package
- `theia/yarn.lock` committed — `yarn install --ignore-scripts --frozen-lockfile` reproduces the exact same tree on a second run
- `drivelist` compiled explicitly via `node-gyp rebuild` (the one package genuinely needing its install script) and its binary verified to `require()` cleanly under the pinned Node 22
- `node-pty` proven functionally: spawned a real `bash` process, wrote a command through the PTY, and read the real command output back — not a file-existence check or a build-step exit code
- `theia build --app-target=browser --mode development` completes with 0 errors in both the browser and node targets
- `yarn theia start` boots the backend and serves the frontend at `http://127.0.0.1:3000`, title "Sourcerer (dev)"
- `scripts/smoke-theia.sh` rewritten end-to-end to match the real install/build/proof sequence; two full runs both exit 0 (cold ~70s, warm/frozen-lockfile ~12s)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the stock Theia yarn workspace (root + browser application)** - `5ba5de1` (feat)
2. **Task 2: Install, compile drivelist natively, build, and boot the app at localhost** - `221d17b` (feat)

## Files Created/Modified

- `theia/package.json` - root workspace: `workspaces`, `resolutions` (12 `@theia/*` @ 1.74.1), `engines`, `build`/`start` scripts
- `theia/applications/browser/package.json` - 11 `@theia/*` runtime deps + `react`/`react-dom` @ 18.3.1 (deviation), `@theia/cli` devDependency, `theia.frontend.config.applicationName: "Sourcerer (dev)"`
- `theia/yarn.lock` - committed lockfile, 7,426 lines
- `scripts/smoke-theia.sh` - rewritten: `--ignore-scripts` install with `PUPPETEER_SKIP_DOWNLOAD=1`, explicit `drivelist` rebuild, `theia build`, real `node-pty` spawn proof, then boot + curl
- `.gitignore` - added `gen-esbuild*.mjs` / `esbuild.mjs` (Theia 1.74.1's build generates esbuild config files; the existing `gen-webpack*.js` pattern was written for an older webpack-based Theia build and did not cover these)

## Decisions Made

- **Installed with `--ignore-scripts` + `PUPPETEER_SKIP_DOWNLOAD=1`, per the mandated install constraints**, not the plan's plain `yarn install`. Verified per-package exactly as predicted: `node-pty` and `esbuild` and `@parcel/watcher` load fine from their ship-in-tarball/sibling-package prebuilts with no script run; `keytar` fails to `require()` as expected (`Cannot find module '../build/Release/keytar.node'`) and `@theia/core` is documented to catch this into `InMemoryCredentialsProvider`; `msgpackr-extract`'s script is pure optimization and was skipped without issue.
- **`drivelist` was the one package rebuilt explicitly**, via `cd node_modules/drivelist && node-gyp rebuild`, exactly per the mandated constraint. Its compiled `.node` was verified to load in a fresh Node 22 process before proceeding. No other package needed its script (confirmed by requiring `esbuild` and `@parcel/watcher` directly post-install).
- **Ran the build from `applications/browser`** (`yarn --cwd applications/browser build`), not from the workspace root with a bare `yarn theia build`. Running the latter from `theia/` root resolves output relative to the invoking cwd, not the app package, and produced a stray `theia/lib/` at the workspace root on first attempt — caught and corrected before commit (not a plan deviation, a self-caught execution-order mistake).
- **`resolutions` and `dependencies` only cover `@theia/*` packages** (12 keys, exact `1.74.1`); `react`/`react-dom` are not `@theia/*`-scoped so they are pinned as ordinary exact-version dependencies (`18.3.1`, matching `theia-ide/applications/browser/package.json`), not added to `resolutions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Missing `react`/`react-dom` dependencies — the 11-package minimal set was short, exactly as RESEARCH.md Open Question 1 predicted**
- **Found during:** Task 2, first `theia build` attempt
- **Issue:** `theia build --app-target=browser --mode development` failed with 29 esbuild errors, all `Could not resolve "react"` / `"react-dom"` / `"react-dom/client"` from `@theia/core`'s browser-shell code (`tab-bars.js`, `select-component.js`, `status-bar.js`, etc.) and from `react-tooltip`/`@virtuoso.dev/react-urx` (transitive deps of `@theia/core`). `yarn install` had already warned `"@theia/core@1.74.1" has unmet peer dependency "react@^18.3.1 || ^19.0.0"` — `@theia/core` declares React as a `peerDependency`, not a bundled dependency, and the researched 11-package set never listed it.
- **Fix:** Added `"react": "18.3.1"` and `"react-dom": "18.3.1"` (exact, no caret) to `theia/applications/browser/package.json` `dependencies`. Version chosen to match `theia-ide/applications/browser/package.json`'s own `^18.3.1` pin (the D-06 canonical reference layout), pinned exact per this workspace's discipline. This is exactly the repair the plan's own text anticipated for Open Question 1 ("the in-scope repair is to add the single named package... and to record the addition in the SUMMARY"), extended from `@theia/*` packages to the one non-`@theia/*` peer dependency the researched set omitted.
- **Files modified:** `theia/applications/browser/package.json`
- **Verification:** Re-ran `yarn install --ignore-scripts`; `theia build` completed with 0 errors in both browser and node targets; `yarn theia start` served a working frontend bundle at `http://localhost:3000`.
- **Committed in:** `221d17b`

**2. [Rule 1 - Bug] Untracked generated `esbuild.mjs`/`gen-esbuild*.mjs` files not covered by the existing `.gitignore`**
- **Found during:** Task 2, post-build `git status` check
- **Issue:** `theia build` generated `theia/esbuild.mjs`, `theia/gen-esbuild.browser.mjs`, `theia/gen-esbuild.node.mjs`, and the same three under `theia/applications/browser/`. The repo's existing `.gitignore` had `gen-webpack*.js` (written when Theia's build was webpack-based); Theia 1.74.1 uses esbuild, and none of the generated esbuild config files matched that pattern, so they appeared as untracked files that would otherwise leak into the commit.
- **Fix:** Added `gen-esbuild*.mjs` and `esbuild.mjs` to `.gitignore` alongside the existing `gen-webpack*.js` line.
- **Files modified:** `.gitignore`
- **Verification:** `git status --porcelain theia/` returns empty after the fix (all generated build artifacts correctly ignored); the plan's own verification item 3 ("only `package.json`, `applications/browser/package.json`, and `yarn.lock` as tracked additions") holds.
- **Committed in:** `221d17b`

### Plan-mandated corrections (not deviations — applied exactly as instructed)

**3. `node-pty` D-10 proof replaced: `theia rebuild:browser` and `build/Release/pty.node` are both false signals for this package**
- The dispatch context's `<proof_correction_MANDATORY>` identified that `yarn theia rebuild:browser` is a no-op on a fresh browser-target tree (no `.browser_modules` cache exists yet) and proves nothing. Empirically confirmed: the command printed `native node modules are already rebuilt for browser` and exited in 0.49s without compiling anything.
- Also empirically discovered (not anticipated by the plan text, which assumed `build/Release/pty.node` would exist): `node-pty@1.2.0-beta.12` ships **no** `build/Release` directory at all — reading `node_modules/node-pty/lib/utils.js`'s `loadNativeModule()` shows it checks `build/Release`, then `build/Debug`, then falls back to `prebuilds/<platform>-<arch>/<name>.node`. This package resolves entirely via the bundled `prebuilds/linux-x64/pty.node`, so the plan's literal acceptance criterion (`test -f theia/node_modules/node-pty/build/Release/pty.node`) is unsatisfiable by design for this exact package/version, not a build failure.
- **Real proof substituted, per the mandate:** a Node script that `require("node-pty")`, spawns a real `bash` process via `pty.spawn()`, writes `echo PTY_PROOF_$((21+21))` through the PTY, and asserts the real terminal output contains `PTY_PROOF_42`. Ran standalone (PASS) and is now baked into `scripts/smoke-theia.sh` as a required step before the boot/curl check.
- **Files modified:** `scripts/smoke-theia.sh` (rewritten per the mandate; not a deviation, an instructed correction)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking-issue fix predicted by RESEARCH.md Open Question 1, 1 Rule 1 gitignore gap), plus 1 plan-mandated proof correction applied exactly as instructed.
**Impact on plan:** No scope creep. `react`/`react-dom` addition stayed within `theia/applications/browser/package.json`, the file the plan already declared as modified. No `@theia/*` package was added beyond the researched 11 — the 11-package set held; only the peer dependency it implicitly required was missing.

## Issues Encountered

- **Self-caught execution mistake (not a deviation):** ran the first `theia build` attempt with `nix develop .#theia --command yarn theia build ...` from the `theia/` workspace root instead of via `yarn --cwd applications/browser build`. Since yarn workspace binaries hoist, this executed with `cwd=theia/` and wrote build output to a stray `theia/lib/` instead of `theia/applications/browser/lib/`. Caught before commit; removed the stray directory and re-ran the build via the correct invocation. No files were left in the wrong location.
- **`yarn install` re-run after adding react/react-dom wiped the just-built `drivelist.node`** — the second `yarn install --ignore-scripts` reinstalled `node_modules/drivelist` fresh (since its manifest hadn't changed but the lockfile/tree was regenerated), removing the manually-compiled binary from the first pass. Re-ran `node-gyp rebuild` in `node_modules/drivelist` after the second install, verified again. `scripts/smoke-theia.sh` runs the `drivelist` rebuild unconditionally after every install for exactly this reason — it is idempotent and cheap (a few seconds on a warm ccache-less build).

## User Setup Required

None beyond what plan 01-01 already established. The `nix develop .#theia --command node --version` precondition (Node 22.23.2) was verified live before Task 2 began.

## Next Phase Readiness

- Phase 2 can extend `theia/` (add `theia-extensions/*` to the `workspaces` glob and `@sourcerer/*` packages) without restructuring anything — the workspace is real, stock, and Electron-free (D-05, D-06, D-07 all held).
- Phase 2 should note the `react`/`react-dom` addition when composing its own extension packages — they are already present at exact `18.3.1` and any `@sourcerer/*` extension using React should match that pin rather than introducing a second React copy.
- `scripts/smoke-theia.sh` is a real, repeatable BUILD-01 gate — safe for CI or pre-commit use as-is.
- No blockers for `01-03` (Firefox shell — fully independent) or `01-04`.

---
*Phase: 01-build-infrastructure*
*Completed: 2026-08-20*

## Self-Check: PASSED

All 5 declared artifacts found on disk (`theia/package.json`, `theia/applications/browser/package.json`, `theia/yarn.lock`, `scripts/smoke-theia.sh`, this SUMMARY). Both commit hashes (`5ba5de1`, `221d17b`) confirmed present in `git log --oneline --all`.
