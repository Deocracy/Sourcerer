---
phase: 04-full-window-theia-shell
plan: 02
subsystem: auth
tags: [theia, express-middleware, http, node, cookie-auth, constant-time-compare]

# Dependency graph
requires:
  - phase: 04-01
    provides: scripts/verify-phase-04.sh (side01-bind-scope, side02-token-negative/positive/index-gated checks), red-by-design baseline all four expected to flip green
provides:
  - "@sourcerer/token-gate workspace package (theia/extensions/token-gate/) composed into theia/applications/browser"
  - "SourcererTokenGateContribution: Express middleware inserted at index 0 of EarlyExpressMiddleware.handlers, gating every plain-HTTP route (including / and static assets) on a SOURCERER_TOKEN cookie, constant-time compared"
  - "GET /sourcerer/health -> {ok:true, pid, port} once past the gate"
  - "stdout sentinel SOURCERER_BACKEND_READY {\"port\":N,\"pid\":N}, emitted only for a loopback bind (127.0.0.1/::1)"
  - "Fail-closed startup: unconfigured SOURCERER_TOKEN (and no SOURCERER_TOKEN_DISABLE bypass) exits 78 before the HTTP server ever binds"
  - "SOURCERER_TOKEN_DISABLE=1 named bypass wired into scripts/smoke-theia.sh and scripts/verify-phase-02.sh so the Phase 1/2 dev loops still run unauthenticated"
affects: [04-03-shell-chrome, 04-04-backend-supervisor, 04-05-internal-apis-catalogue]

actuals:
  tokens: 3089
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "EarlyExpressMiddleware.handlers.unshift(), never .push() -- front-inserts the gate ahead of the stock BrowserConnectionTokenBackendContribution so a rejected request never reaches its unconditional cookie-bootstrap and res.sendStatus(403) on reject never calls next()"
    - "Fail-closed contribution lifecycle: the token-presence check runs in initialize() (the earliest BackendApplicationContribution hook), before BackendApplication#start() ever calls server.listen() -- an unconfigured token never gets far enough to open a socket"
    - "onStart(server) as both the port read-back channel (SIDE-01's stdout sentinel) and a bind-scope enforcement point -- it now refuses to announce readiness for anything but a 127.0.0.1/::1 bind"
    - "Named legacy-dev bypass (SOURCERER_TOKEN_DISABLE=1) confined to exactly the token-gate contribution and the two Phase 1/2 scripts that need it -- never a config default, never present under sourcerer/"

key-files:
  created:
    - theia/extensions/token-gate/package.json
    - theia/extensions/token-gate/tsconfig.json
    - theia/extensions/token-gate/src/node/token-gate-backend-module.ts
    - theia/extensions/token-gate/src/node/token-gate-backend-contribution.ts
  modified:
    - theia/applications/browser/package.json
    - theia/package.json
    - scripts/smoke-theia.sh
    - scripts/verify-phase-02.sh

key-decisions:
  - "onStart(server)'s bind-scope guard exits 78 (same code as the fail-closed startup path) rather than a distinct code, since both are the same class of failure: the backend must never become reachable in a state SIDE-01/SIDE-02 forbid."
  - "theia/package.json's root build:extensions script was extended to build token-gate before the app build -- not in the plan's literal file list, but required: theia build bundles from each extension's already-compiled lib/, and without this the browser app build fails to find theia/extensions/token-gate/lib/node/token-gate-backend-module.js. Matches the exact pattern the three existing @sourcerer/* extensions already use in that same script."
  - "grep -rl 'SOURCERER_TOKEN_DISABLE' theia/extensions scripts sourcerer also matches the gitignored compiled theia/extensions/token-gate/lib/node/token-gate-backend-contribution.js in a built tree -- expected (it is the .ts source's compiled twin, not a new occurrence), and it never appears under sourcerer/."

patterns-established:
  - "A Theia BackendApplicationContribution that both gates and self-reports readiness: initialize() (auth decision) -> configure() (route registration, inherits the gate for free) -> onStart() (bind-scope enforcement + stdout sentinel) -- later Phase 4 plans (backend supervisor) consume the sentinel format and health route shape as-is."

requirements-completed: [SIDE-01, SIDE-02]

coverage:
  - id: D1
    description: "@sourcerer/token-gate composed into theia/applications/browser: a tokenless GET of any path (including / and /sourcerer/health) returns a cookie-free 403; the same request with Cookie: SOURCERER_TOKEN=<token> returns 200/JSON {ok:true,pid,port}"
    requirement: "SIDE-02"
    verification:
      - kind: e2e
        ref: "bash scripts/verify-phase-04.sh (side02-token-negative, side02-token-positive, side02-index-gated)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Backend binds 127.0.0.1-only on an OS-assigned port and announces SOURCERER_BACKEND_READY {port,pid} on stdout; a non-loopback bind or unconfigured token is a startup failure (exit 78), never a silent pass-through"
    requirement: "SIDE-01"
    verification:
      - kind: e2e
        ref: "bash scripts/verify-phase-04.sh (side01-bind-scope)"
        status: pass
      - kind: manual_procedural
        ref: "live spawn with no SOURCERER_TOKEN/no bypass -> exit 78, stderr names SOURCERER_TOKEN, no listener opened; ss -ltnH shows only 127.0.0.1:<port> rows"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-104 restart invariant: token validity is a pure function of process.env, so a killed-and-respawned backend on the same port accepts the same already-issued token cookie with no re-handshake; the extension persists no state (grep for writeFile/appendFile returns 0)"
    verification:
      - kind: manual_procedural
        ref: "live kill + respawn on the same --port with the same SOURCERER_TOKEN: cookie request returns 200 with no intermediate step"
        status: pass
    human_judgment: false
  - id: D4
    description: "Phase 1/2 dev loops (scripts/smoke-theia.sh, scripts/verify-phase-02.sh) keep working unauthenticated against the gate-composed backend via the named SOURCERER_TOKEN_DISABLE=1 bypass, which appears nowhere under sourcerer/"
    verification:
      - kind: e2e
        ref: "bash scripts/verify-phase-02.sh (5/5 checks PASS); bash scripts/smoke-theia.sh (PASS)"
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-08-26
status: complete
---

# Phase 4 Plan 2: Token Gate Extension Summary

**`@sourcerer/token-gate`, a Theia backend extension that front-inserts a constant-time-compared cookie gate ahead of every plain-HTTP route (including `/` and static assets), fails closed with exit 78 when unconfigured or non-loopback, and announces its OS-assigned port/pid via a `SOURCERER_BACKEND_READY` stdout sentinel.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-08-26T20:31:25Z
- **Completed:** 2026-08-26T20:57:48Z
- **Tasks:** 3
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- Built `@sourcerer/token-gate` as a new in-repo workspace package (`theia/extensions/token-gate/`), composed into `theia/applications/browser/package.json` and built end to end (`theia build --app-target=browser`, 0 errors).
- `SourcererTokenGateContribution` inserts its gate handler at index 0 of `EarlyExpressMiddleware.handlers` via `.unshift()` (never `.push()`), so a rejected request is answered with a plain `res.sendStatus(403)` and never reaches Theia's stock `BrowserConnectionTokenBackendContribution`, which would otherwise unconditionally hand the caller a valid `theia-connection-token` cookie.
- Token comparison is `crypto.timingSafeEqual` on equal-length buffers, with an explicit length check first; the cookie is parsed by hand (no new dependency).
- `GET /sourcerer/health` returns `{ok:true, pid, port}` once past the gate — one route proves both liveness and enforcement (D-103).
- `onStart(server)` announces `SOURCERER_BACKEND_READY {"port":N,"pid":N}` on stdout, but only for a loopback bind: a 0.0.0.0/`[::]` bind now exits 78 instead of silently becoming reachable (SIDE-01).
- Startup is fail-closed: no `SOURCERER_TOKEN` and no `SOURCERER_TOKEN_DISABLE=1` exits 78 during `initialize()`, before the HTTP server ever calls `listen()` — confirmed live with `ss -ltnH` showing no new listener afterward.
- `SOURCERER_TOKEN_DISABLE=1` is the sole named bypass: a single warning line to stderr, wired only into `scripts/smoke-theia.sh` and `scripts/verify-phase-02.sh` (both re-verified passing against the gate-composed backend), never into anything under `sourcerer/`.
- D-104 confirmed live: killing and respawning the backend on the same port with the same `SOURCERER_TOKEN` value serves the same already-issued cookie a `200` with no intermediate request — the extension persists nothing (`grep -rc 'writeFile\|writeFileSync\|appendFile'` returns 0).

## Task Commits

1. **Task 1: End-to-end token gate — one tokenless request rejected, one accepted** - `c7556b0` (feat)
2. **Task 2: Fail-closed startup and 127.0.0.1-only binding** - `f514694` (feat)
3. **Task 3: Keep the Phase 1/2 dev loops working against the gated backend** - `a606b86` (fix)

**Plan metadata:** (this commit)

## Files Created/Modified

- `theia/extensions/token-gate/package.json` - `@sourcerer/token-gate` workspace package, single `@theia/core` dependency, `theiaExtensions: [{backend: "lib/node/token-gate-backend-module"}]`
- `theia/extensions/token-gate/tsconfig.json` - branding's tsconfig with `jsx`/`dom` trimmed (no browser-side code)
- `theia/extensions/token-gate/src/node/token-gate-backend-module.ts` - `ContainerModule` binding `SourcererTokenGateContribution` as a `BackendApplicationContribution`
- `theia/extensions/token-gate/src/node/token-gate-backend-contribution.ts` - the gate, health route, and sentinel/bind-scope logic
- `theia/applications/browser/package.json` - added `"@sourcerer/token-gate": "0.1.0"` in alphabetical position
- `theia/package.json` - `build:extensions` script extended to build token-gate before the app build
- `scripts/smoke-theia.sh` - backend start now carries `SOURCERER_TOKEN_DISABLE=1` with an explanatory comment
- `scripts/verify-phase-02.sh` - same bypass, same comment convention

## Decisions Made

1. **Bind-scope failure reuses exit code 78.** Both the missing-token case and the non-loopback-bind case are the same class of failure — the backend must never become reachable outside SIDE-01/SIDE-02's contract — so both exit 78 rather than inventing a second code.
2. **`theia/package.json`'s `build:extensions` script extended (not in the plan's literal file list).** `theia build` bundles from each extension's already-compiled `lib/`; without adding token-gate to this script (matching the exact pattern the three existing `@sourcerer/*` extensions use), the browser app build cannot find `lib/node/token-gate-backend-module.js`. Verified: `yarn --cwd theia/extensions/token-gate build` then `yarn --cwd theia/applications/browser build` both complete with 0 errors, and the compiled contribution is present at `theia/extensions/token-gate/lib/node/token-gate-backend-contribution.js`.
3. **drivelist's native module needed an explicit rebuild before the backend would start.** The fresh `yarn install --ignore-scripts --frozen-lockfile` (per the plan's own install command) left `theia/node_modules/drivelist` unbuilt, exactly as `scripts/smoke-theia.sh` already documents and works around (`(cd node_modules/drivelist && node-gyp rebuild)`). Ran the identical rebuild before any live backend test; not a code change, purely a local dev-environment step.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `theia/package.json`'s `build:extensions` script did not include the new extension**
- **Found during:** Task 1 (building the browser app after composing the extension in)
- **Issue:** `theia build --app-target=browser` requires every composed extension's TypeScript already compiled to `lib/`; the root `build:extensions` script built only `branding`, `tab-uris`, `customize`.
- **Fix:** Added `&& yarn --cwd extensions/token-gate build` to the existing script, matching its established pattern exactly.
- **Files modified:** theia/package.json
- **Verification:** `theia/extensions/token-gate/lib/node/token-gate-backend-contribution.js` exists after the build; `theia build --app-target=browser` completes with 0 errors in both browser and node targets.
- **Committed in:** c7556b0 (Task 1 commit)

**2. [Rule 3 - Blocking] `drivelist` native module unbuilt after a fresh `yarn install --ignore-scripts`**
- **Found during:** Task 1 (first live backend spawn attempt)
- **Issue:** `node theia/applications/browser/lib/backend/main.js` failed immediately with `Cannot find module 'drivelist/build/Release/drivelist.node'` — the plan's own install command (`--ignore-scripts --frozen-lockfile`) intentionally skips drivelist's install script, and `scripts/smoke-theia.sh` already documents and rebuilds it explicitly for exactly this reason.
- **Fix:** Ran `nix develop .#theia --command bash -c "cd theia/node_modules/drivelist && node-gyp rebuild"` (the documented sequence), not a code change.
- **Files modified:** none (local `node_modules` build artifact only)
- **Verification:** backend spawns cleanly afterward; all live curl/ss checks pass.
- **Committed in:** n/a (no repo file changed)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking build-completeness issues, neither a code-correctness or security gap). No scope creep: no new files beyond the plan's own manifest, no new dependencies.

## Issues Encountered

None beyond the two auto-fixed blocking issues above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04-03 (shell chrome / `sourcerer.xhtml`) is unaffected by this plan; `internals-boundary` in `verify-phase-04.sh` correctly still FAILs (empty scan target) until it lands.
- Plan 04-04 (backend supervisor / `TheiaService.sys.mjs`) has a concrete, proven contract to spawn against: `node lib/backend/main.js` directly (never the yarn/`theia start` wrapper), env `SOURCERER_TOKEN` set per launch, stdout sentinel `SOURCERER_BACKEND_READY {"port":N,"pid":N}` observed at **~0.62-0.63s since backend process start** (measured across five live spawns in this plan's verification; use this as the floor when sizing 04-04's startup timeout), cookie name `SOURCERER_TOKEN`, health route `GET /sourcerer/health`.
- `shell01-theia-is-the-window`, `shell05-paint-before-backend`, and `side03-kill-and-recover` in `verify-phase-04.sh` remain FAIL, as expected — they depend on `sourcerer/shell/sourcerer.xhtml` (04-03) and the supervisor (04-04), neither of which exists yet.
- No blockers. `git -C theia status --porcelain node_modules/@theia` is clean; Theia core was never touched.

---
*Phase: 04-full-window-theia-shell*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: theia/extensions/token-gate/package.json
- FOUND: theia/extensions/token-gate/tsconfig.json
- FOUND: theia/extensions/token-gate/src/node/token-gate-backend-module.ts
- FOUND: theia/extensions/token-gate/src/node/token-gate-backend-contribution.ts
- FOUND: c7556b0 (Task 1 commit)
- FOUND: f514694 (Task 2 commit)
- FOUND: a606b86 (Task 3 commit)
