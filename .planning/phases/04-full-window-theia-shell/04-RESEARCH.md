# Phase 4: Full-Window Theia Shell - Research

**Researched:** 2026-08-26
**Domain:** Firefox-ESR chrome window replacement + Node/Theia backend supervision + HTTP token-gate hardening
**Confidence:** HIGH (all load-bearing claims verified by reading the pinned Firefox ESR 153 and Theia 1.74.1 sources in-tree)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-89:** `sourcerer.xhtml` becomes the startup window by repointing `BROWSER_CHROME_URL` to `chrome://sourcerer/content/sourcerer.xhtml` via a patch hunk in `upstream/browser/moz.configure` (line 19). Costly reversal (tier-3 rebuild each direction, `toolkit/moz.configure:60-70`). Rejected: jar.mn masquerade, startup-observer suppression.
- **D-90:** `sourcerer.xhtml` is minimal, written from scratch — one `<browser>`, loading-state deck, our own modules only. No `browser.js`/`gBrowser`/browser-sets.
- **D-91:** The single `<browser>` runs `type="content" remote="true"` (ordinary content process, site isolation).
- **D-92:** Build learns about shell code via `DIRS += [...]` in `upstream/browser/moz.build`, through the `upstream/sourcerer` symlink, pointing at `sourcerer/shell/`. Our own `moz.build` + `jar.mn` register `chrome://sourcerer/content/`. jar.mn edits land tier 2; `.xhtml`/`.mjs` edits tier 1 once symlinked. Rejected: runtime `chrome.manifest`.
- **D-93:** New build wiring lives in `patches/020-sourcerer-shell.patch` (BROWSER_CHROME_URL hunk + DIRS hunk together). `010-sourcerer-identity.patch` stays identity/configure only.
- **D-94:** Branded loading state is a chrome-rendered stack/deck layer in `sourcerer.xhtml`, on top of the `<browser>`. Overlay paints with the window; `<browser>` navigates exactly once, to the Theia URL, after health check passes. Window show never waits on backend readiness. Rejected: loading page inside the `<browser>`.
- **D-95:** Backend dies mid-session and restarts: chrome does nothing visually — Theia's own reconnect UI (`frontendConnectionTimeout` pinned Phase 1) handles the gap. Chrome overlay only shows pre-first-load.
- **D-96:** "Firefox internal" defined maximally: any `ChromeUtils.importESModule` outside `chrome://sourcerer/`, plus `Services.*`, `Cc`/`Ci`/XPCOM, `AppConstants`. Only `SourcererAPI.sys.mjs` imports these; `sourcerer.xhtml` and `TheiaService.sys.mjs` import only our own modules.
- **D-97:** Criterion 4 proven by `scripts/check-internals-boundary.sh` — scans `sourcerer/` excluding `SourcererAPI.sys.mjs`, exits 1 on any forbidden pattern, ships `--self-test` (D-68/`check-patch-surface.sh` idiom). Runs in `verify-phase-04.sh`.
- **D-98:** Stock Theia token insufficient — `browser-connection-token.js` issues its cookie to ANY HTTP caller, enforces only on WS upgrade + opt-in routes. Sourcerer replaces the trust root: TheiaService mints the token, passes it in spawn env; a new `@sourcerer/*` backend extension (`BackendApplicationContribution` pushing onto `EarlyExpressMiddleware`) 403s every HTTP request without the token, index.html/static included. No Theia core patch. Rejected: rebinding stock `BrowserConnectionToken`.
- **D-99:** Browser presents the token as a chrome-set cookie for `http://127.0.0.1:<port>`, set via the cookie service before the `<browser>` ever navigates. Rejected: query-param token.
- **D-100:** TheiaService locates the sidecar via Firefox prefs with dev defaults (`sourcerer.sidecar.nodePath`, `.backendMain`, etc.), read through SourcererAPI. Rejected: env vars at launch, hardcoded relative path.
- **D-101:** Spawn env permanently carries `THEIA_CONFIG_DIR=$XDG_CONFIG_HOME/sourcerer` (mkdir -p) and explicit `VSX_REGISTRY_URL` (Phase 2 D-55's permanent home). Port binding: bind 0, read back.
- **D-102:** No workspace passed to sidecar — Theia's own stock last-workspace memory applies. Rejected: `workspaceDir` pref.
- **D-103:** Health check probes a tiny token-gated health endpoint on the same `@sourcerer/*` backend extension — one probe proves liveness AND token-gate enforcement. Fast poll during startup gate, slower steady-state; restart with exponential backoff capped at a few seconds, retrying indefinitely in Phase 4. Rejected: probing `GET /`, process-alive-only.
- **D-104:** Port and token are per browser launch, not per spawn — every health-loop restart passes the SAME port explicitly (the loaded Theia page reconnects to its original origin); token likewise minted once per launch. Rejected: fresh port + forced reload per restart.
- **D-105:** Normal quit: TheiaService observes quit via SourcererAPI (e.g. `quit-application-granted`), stops health loop first, SIGTERM, bounded grace, then SIGKILL. Rejected: immediate SIGKILL.
- **D-106:** TheiaService captures backend stdout/stderr into a bounded in-memory ring buffer (a few hundred lines) from day one, mirrored to browser console. Phase 5's diagnostics page reads this buffer — no retrofit.
- **D-107:** Phase 4 introduces no persistence of its own — port/PID/token/log buffer are per-launch in-memory only; no SessionStore dependency.
- **D-108:** `sourcerer/INTERNAL-APIS.md` catalogues SessionStore as deliberately-not-touched.

### Claude's Discretion

- Exact deck/stack markup and loading-state visuals in `sourcerer.xhtml` (keep minimal; BRAND-06 already distinguishes dev builds).
- Health-poll intervals and backoff constants (fast-gate vs steady-state) — pick sensible values, record in the plan.
- Exact SourcererAPI method names and signatures.
- How the assigned port is read back from the backend (stdout parse vs other mechanism) — **researched below: use the `BackendApplicationContribution.onStart(server)` hook, not stdout parsing.**
- Ring buffer size and grace-period duration.
- Keyboard/quit shortcut handling in the minimal window (whatever XUL gives for free).

### Deferred Ideas (OUT OF SCOPE)

- Orphan/SIGKILL hardening, process-group kill, startup leftover cleanup — Phase 5 (SIDE-04).
- Single-instance behaviour — Phase 5 (SIDE-05).
- Exhausted-backoff branded error state — Phase 5 (SHELL-03).
- Diagnostics page — Phase 5 (SHELL-04).
- Pinned-port-stolen-during-restart-gap handling — Phase 5.
- SEED-001 unified SQL store — dormant.
- `@sourcerer/browser-bridge`, chrome tab strip, URL bar — post-4.0.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHELL-01 | `sourcerer.xhtml` presents one full-window `<browser>` loading Theia; Theia's own shell is the entire UI, unsuppressed | Q3 (chrome package registration), Q4 (minimal XUL window shape) below |
| SHELL-02 | Every Firefox-internals touch goes through `SourcererAPI.sys.mjs`, catalogued in `INTERNAL-APIS.md` | Q2 (EarlyExpressMiddleware ordering — TheiaService itself never imports internals directly), D-96/97 scripting pattern confirmed against `check-patch-surface.sh` |
| SHELL-05 | Window paints immediately with a loading state, swaps to Theia when health check passes | Q4 (deck/stack over `<browser>`), Q1 (health probe/port timing) |
| SIDE-01 | `TheiaService.sys.mjs` spawns the bundled backend via `Subprocess.sys.mjs`, bound to 127.0.0.1 on an OS-assigned free port (bind 0, read back) | Q1 (port read-back mechanism), Q6 (Subprocess spawn/kill/read API) |
| SIDE-02 | Backend access requires a per-launch token; enforcement verified on plain HTTP, not only WS upgrade (CVE-2026-61891 class) | Q2 (ordering landmine + fix), Q5 (cookie-set API), Q10 (CVE brief) |
| SIDE-03 | Health-check loop gates first load and restarts backend with backoff on crash | Q1 (health endpoint doubles as port carrier), Q6 (kill/wait semantics), Q8 (verification harness for kill-and-recover) |
</phase_requirements>

## Summary

Phase 4 is almost entirely **in-tree verification work**, not library selection: every API this phase touches (Firefox `Subprocess.sys.mjs`, `nsICookieManager`, chrome package registration, quit observers) and every Theia backend hook (`BackendApplicationContribution`, `EarlyExpressMiddleware`, the stock connection-token contribution) already exists in the pinned sources at `upstream/` and `theia/node_modules/@theia/core/`. The research below resolves all ten priority questions the discussion phase flagged, with two genuine landmines found and resolved (not just confirmed):

1. **Port read-back is not a stdout-parsing problem.** `BackendApplicationContribution.onStart(server: http.Server)` hands any backend contribution — including the one D-98 already requires — the live `http.Server` object after `listen()` resolves. `server.address().port` gives the exact OS-assigned port with zero string parsing. The same `@sourcerer/*` backend extension that implements the token gate and health endpoint should implement `onStart` and announce the port over a channel TheiaService controls (see Q1) — this is `Claude's Discretion` per CONTEXT, now resolved.

2. **EarlyExpressMiddleware ordering is a real correctness requirement, not a cosmetic one — and the fix is `unshift()`, not push().** The stock `BrowserConnectionTokenBackendContribution.expressMiddleware` (`browser-connection-token.js:94-106`) **unconditionally** issues its own cookie and **always** calls `next()`, regardless of whether the caller supplied a valid token. If the stock handler runs *before* ours in the Express chain, an attacker who never had our token still receives a valid Theia WS-upgrade cookie in the response `Set-Cookie` header — even though our own middleware later 403s the same request's *body*. The fix does not require knowing Theia's contribution-binding order at all: since both contributions push into the same shared, mutable `EarlyExpressMiddleware.handlers` array during their synchronous `initialize()` calls, our contribution should call `.unshift(ourHandler)` instead of `.push(ourHandler)`, guaranteeing first position regardless of load order, and must not call `next()` on rejection (ending the chain before the stock middleware ever runs). This closes a gap the CONTEXT's own D-98 wording did not fully anticipate.

Everything else — chrome package registration, the minimal XUL window shape, the cookie-set API, `Subprocess.sys.mjs` kill/wait semantics, the quit observer topic, the verification harness, and the build-tier sequencing — was already correctly anticipated by the locked decisions; this research supplies the exact file:line citations and code shapes the planner needs, plus one more landmine (spawn command shape) documented in Pitfall 3.

**Primary recommendation:** Build the `@sourcerer/*` backend extension first (it is the single piece all six requirements route through: token gate, health endpoint, port announcement, and the `onStart` hook), then the chrome side (`sourcerer.xhtml` + `SourcererAPI.sys.mjs` + `TheiaService.sys.mjs`), landing the one unavoidable tier-3 rebuild (`BROWSER_CHROME_URL` + `DIRS`, both in `patches/020-sourcerer-shell.patch` per D-93) as the very first build action of the phase.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Window presentation / loading overlay | Browser / Client (Gecko chrome) | — | `sourcerer.xhtml` is a XUL/XHTML chrome document; no server involved |
| Firefox-internals access (Subprocess, cookies, quit observer) | Browser / Client (Gecko chrome), funneled through `SourcererAPI.sys.mjs` | — | D-96 makes this a single-file boundary by design |
| Backend process supervision (spawn, health poll, restart, kill) | Browser / Client (Gecko chrome, `TheiaService.sys.mjs`) | API / Backend (the spawned Node process itself) | The supervisor lives in chrome; the supervised process is the API/Backend tier |
| Token minting and cookie issuance | Browser / Client (mint + set cookie) | API / Backend (validate on each request) | Trust root is chrome (D-98); backend only verifies |
| Token enforcement / health endpoint | API / Backend (`@sourcerer/*` Theia backend extension) | — | Runs inside the Node process, gates Express + WS |
| Theia's own shell UI (menu/status/tab bar) | Frontend Server (SSR-equivalent: Theia's browser-target frontend) | — | Entirely Theia's responsibility; Sourcerer adds nothing here in v4.0 |

## Standard Stack

No new external dependencies this phase. Every API used is either already pinned (Theia 1.74.1, `@theia/core`) or built into Firefox ESR 153 (`Subprocess.sys.mjs`, `nsICookieManager`, XPCOM observers). The one new artifact is an in-repo `@sourcerer/*` Theia backend extension package (npm-workspace-local, not published), following the exact pattern Phase 2 already established for `@sourcerer/branding`, `@sourcerer/customize`, `@sourcerer/tab-uris`.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@theia/core` | 1.74.1 (already pinned, D-19 exact-pin set) | `BackendApplicationContribution`, `EarlyExpressMiddleware`, health endpoint, token-gate extension point | Already the app's own extension mechanism; no alternative exists that avoids patching Theia core |
| `Subprocess.sys.mjs` | Firefox ESR 153 built-in (`upstream/toolkit/modules/subprocess/Subprocess.sys.mjs`) | Spawns the Node backend, reads stdout/stderr, kills with SIGTERM→SIGKILL | The only sanctioned way to spawn a child process from privileged Gecko JS; `nsIProcess` is the deprecated predecessor |
| `nsICookieManager` (XPCOM, built-in) | Firefox ESR 153 (`upstream/netwerk/cookie/nsICookieManager.idl`) | Sets the per-launch token cookie for `http://127.0.0.1:<port>` before first navigation | Chrome-privileged cookie injection API; no alternative that avoids a query-param token (rejected by D-99) |

### Package Legitimacy Audit

Not applicable — this phase adds no new npm/PyPI/crates registry dependency. The one new package (`@sourcerer/theia-token-gate` or similarly named, exact name is Claude's Discretion) is an in-repo workspace package, never published, with zero external supply-chain surface. Skip the registry-verification gate.

## Architecture Patterns

### System Architecture Diagram

```
Firefox process (chrome, privileged)
  │
  ├─ startup ──► BROWSER_CHROME_URL (patched) ──► opens sourcerer.xhtml
  │                                                     │
  │                                        ┌────────────┴────────────┐
  │                                        │  deck/stack in xhtml:    │
  │                                        │  [loading layer] (paints│
  │                                        │   immediately, no I/O)  │
  │                                        │  [<browser> content,    │
  │                                        │   remote=true, blank]   │
  │                                        └────────────┬────────────┘
  │                                                      │
  ├─ TheiaService.sys.mjs (via SourcererAPI only) ───────┤
  │     1. mint token                                    │
  │     2. Subprocess.call() spawn `node lib/backend/main.js`
  │          --hostname 127.0.0.1 --port 0
  │          env: THEIA_CONFIG_DIR, VSX_REGISTRY_URL, SOURCERER_TOKEN
  │     3. poll health endpoint (fast) until 200          │
  │     4. SourcererAPI: nsICookieManager.add(token cookie for 127.0.0.1:<port>)
  │     5. <browser>.loadURI("http://127.0.0.1:<port>/") ─┘  (loading layer hides)
  │     6. steady-state: poll health endpoint (slow)
  │     7. on probe failure: restart backend w/ backoff (same port+token)
  │     8. on quit-application-granted: stop loop, SIGTERM, grace, SIGKILL
  │
  ▼
Node backend process (spawned, unprivileged, 127.0.0.1-only)
  │
  ├─ @theia/core BackendApplication.configure()
  │     applies EarlyExpressMiddleware.handlers in array order:
  │       [0] our token-gate middleware (unshift'd — always first)
  │            no valid SOURCERER cookie → res.sendStatus(403), STOP
  │            valid cookie → next()
  │       [1] stock BrowserConnectionTokenBackendContribution.expressMiddleware
  │            (harmless now — only ever reached by already-authorized callers)
  │     then express.static() serves index.html/assets
  │
  ├─ our BackendApplicationContribution.onStart(server)
  │     server.address().port → announce to TheiaService (see Q1)
  │
  └─ our health route (also token-gated): GET /sourcerer-health → 200 {ok:true, pid}
```

### Recommended Project Structure

```
sourcerer/shell/                       # new — registers chrome://sourcerer/content/
├── moz.build                          # JAR_MANIFESTS += ["jar.mn"]
├── jar.mn                             # sourcerer.jar: % content sourcerer %content/sourcerer/
├── sourcerer.xhtml                    # the startup window (D-90)
├── SourcererAPI.sys.mjs                # the single anti-corruption layer (D-96)
└── TheiaService.sys.mjs                # backend supervisor, imports SourcererAPI only

theia/extensions/token-gate/           # new — @sourcerer/* backend extension (D-98)
├── package.json
└── src/
    ├── node/
    │   ├── token-gate-backend-module.ts     # binds BackendApplicationContribution
    │   └── token-gate-backend-contribution.ts  # initialize()/onStart()/health route

patches/020-sourcerer-shell.patch      # BROWSER_CHROME_URL + browser/moz.build DIRS hunk (D-93)
sourcerer/INTERNAL-APIS.md             # catalogue (D-97/108)
scripts/check-internals-boundary.sh    # guard script (D-97)
scripts/verify-phase-04.sh             # phase verification (extends Phase 2/3 shape)
```

### Pattern 1: Reading the OS-assigned port without parsing stdout (Q1)

**What:** `BackendApplicationContribution.onStart` receives the live `http.Server`/`https.Server` after `server.listen()` resolves.
**When to use:** Any Theia backend extension that needs to know the actual bound port, especially when `--port 0` is used.
**Verified shape** [VERIFIED: theia/node_modules/@theia/core/lib/node/backend-application.d.ts:81]:
```
onStart?(server: http.Server | https.Server): MaybePromise<void>;
```
And the call site [VERIFIED: theia/node_modules/@theia/core/lib/node/backend-application.js:217-234]:
```js
server.listen(port, hostname, () => {
    const address = server.address();
    const url = typeof address === 'string' ? address : this.getHttpUrl(address, this.cliParams.ssl);
    this.logger.info(`Theia app listening on ${url}.`);
    deferred.resolve(server);
});
...
for (const contribution of this.contributionsProvider.getContributions()) {
    if (contribution.onStart) {
        await this.measureContribution(contribution, 'onStart', () => contribution.onStart(server));
    }
}
```
So the same `@sourcerer/*` extension already implementing D-98's token gate should also implement `onStart(server)`, read `server.address().port`, and **write it somewhere TheiaService can read** — e.g. a fixed-name file under the already-created `THEIA_CONFIG_DIR` (D-101 already `mkdir -p`s this directory before spawn), written atomically (`writeFile` to a temp name then `rename`) so TheiaService's poll never reads a half-written file. TheiaService then polls for that file's existence/content immediately after spawn, before starting the health-endpoint poll. This avoids depending on Theia's own `this.logger.info` log-line wording (confirmed default log level is `INFO` [VERIFIED: theia/node_modules/@theia/core/lib/node/logger-cli-contribution.js:51] `this._defaultLogLevel = logger_1.LogLevel.INFO;`, so the line *would* be visible on stdout by default — but relying on the exact prose `` `Theia app listening on ${url}.` `` string surviving a future point-release patch bump is fragile, whereas `onStart(server)` is a documented, typed extension point we already depend on for the token gate).

**Rejected mechanism:** stdout log-line parsing. Works today but couples port discovery to Theia core's internal log wording rather than a typed API we already consume.

### Pattern 2: EarlyExpressMiddleware — guaranteed-first registration (Q2, landmine + fix)

**What:** `EarlyExpressMiddleware` is a plain mutable array; contributions push handlers during their synchronous `initialize()` [VERIFIED: theia/node_modules/@theia/core/lib/node/backend-application.d.ts:22-27]:
```
/**
 * Shared registry for Express middleware that must run before static file handlers.
 * Contributions push handlers during `initialize()`, and `BackendApplication`
 * applies them at the start of `configure()`, before gzipped handlers and `express.static()`.
 */
export declare class EarlyExpressMiddleware {
    readonly handlers: express.Handler[];
```

`BackendApplication.configure()` iterates the array in order and calls `this.app.use(handler)` for each [VERIFIED: theia/node_modules/@theia/core/lib/node/backend-application.js:142-148]:
```js
async configure() {
    await this.initialize();
    // Apply early middleware before static file handlers.
    for (const handler of this.earlyMiddleware.handlers) {
        this.app.use(handler);
    }
    this.app.get('*.js', this.serveGzipped.bind(this, 'text/javascript'));
    ...
```

The stock cookie-bootstrap contribution's `initialize()` is fully synchronous and unconditional [VERIFIED: theia/node_modules/@theia/core/lib/node/hosting/browser-connection-token.js:53-58, 94-106]:
```js
initialize() {
    if (index_1.environment.electron.is()) { return; }
    this.earlyMiddleware.handlers.push((req, res, next) => this.expressMiddleware(req, res, next));
}
...
expressMiddleware(req, res, next) {
    const existing = this.getTokenFromCookie(req);
    if (!existing || !this.isTokenValid(existing)) {
        res.cookie(exports.BROWSER_TOKEN_COOKIE_NAME, this.browserConnectionToken.value, {
            httpOnly: true, sameSite: 'strict', path: '/'
        });
    }
    next();
}
```

**The landmine:** `expressMiddleware` **always** calls `next()` and **always** (re-)issues the stock cookie if missing/invalid — it never rejects. If this handler runs *before* our token-gate handler in the array, an unauthorized caller's HTTP response carries a valid stock `theia-connection-token` `Set-Cookie` header **even though our own middleware, running later in the same chain, still 403s the response body.** That harvested cookie is exactly what the stock `allowWsUpgrade` validator checks for WS upgrades [VERIFIED: theia/node_modules/@theia/core/lib/node/hosting/backend-hosting-module.js:26-27, 34] (`WsRequestValidatorContribution` bound to the same class). An attacker could therefore issue one plain HTTP request, harvest the stock cookie from the response headers regardless of the 403, then use it to open a WS connection the stock validator accepts — silently defeating SIDE-02's "not just the WebSocket upgrade" requirement.

**The fix:** the new `@sourcerer/*` extension's `initialize()` must call `this.earlyMiddleware.handlers.unshift(ourHandler)`, not `.push()`. `unshift` always inserts at index 0 regardless of whether the stock contribution's `initialize()` ran before or after ours (both run synchronously inside the same `Promise.all(...).map(...)` in `BackendApplication.initialize()` [VERIFIED: theia/node_modules/@theia/core/lib/node/backend-application.js:123-134]) — so **no dependency on container-binding/load order is required.** Our handler must also *not* call `next()` on rejection (send `res.sendStatus(403)` and return), which stops the Express chain before the stock handler — and its unconditional cookie issuance — ever executes for that request. Accepted (token-valid) requests still call `next()`, so the stock contribution still runs afterward and issues its own cookie harmlessly (defense-in-depth, unchanged behavior for legitimate use).

**Rejected alternative:** proving array-load-order is deterministic (i.e., depends on DI multi-binding/container-module load order across two different npm packages) and relying on it. This is unnecessary risk when `unshift()` gives a construction-time guarantee.

### Pattern 3: Chrome package registration (Q3)

The repo already has a working precedent for a jar.mn + moz.build pair registering a *sub-package* into the existing `browser.jar` [VERIFIED: sourcerer/branding/release/content/jar.mn:11-17, sourcerer/branding/release/moz.build:5-11]. Phase 4 needs a **new, top-level** chrome package (`chrome://sourcerer/content/`), which upstream itself demonstrates at `toolkit/content/jar.mn` [VERIFIED: upstream/toolkit/content/jar.mn:1-2]:
```
toolkit.jar:
%  content global %content/global/ contentaccessible=yes
```
The jar *filename* (`toolkit.jar`) is a packaging artifact name; the actual chrome registration is the `% content <package> %<path>/` manifest line. For Sourcerer:

`sourcerer/shell/jar.mn`:
```
sourcerer.jar:
%  content sourcerer %content/sourcerer/ contentaccessible=yes
   content/sourcerer/sourcerer.xhtml       (sourcerer.xhtml)
```

`sourcerer/shell/moz.build` wires it in exactly as `browser/base/moz.build` does [VERIFIED: upstream/browser/base/moz.build:81]:
```
JAR_MANIFESTS += ["jar.mn"]
```

**Reaching `sourcerer/shell/` from `browser/moz.build`:** the `upstream/sourcerer` symlink points at `../sourcerer` (repo root) [VERIFIED: scripts/fetch-upstream.sh:106 `ln -sfn ../sourcerer "$git_dir/sourcerer"`], so `sourcerer/shell/` is a *sibling* of `browser/`, not a child. `DIRS` entries support parent-relative paths — precedented in this exact tree [VERIFIED: upstream/mfbt/moz.build:197] `DIRS += ["../build/pure_virtual"]`. So the D-92/D-93 hunk in `browser/moz.build` should read:
```
DIRS += ["../sourcerer/shell"]
```
(added alongside the existing `DIRS += ["actors", "base", ..., "branding"]` block at `upstream/browser/moz.build:13-24`, or as its own `DIRS +=` line — either is valid mozbuild).

**`.sys.mjs` modules — EXTRA_JS_MODULES vs. chrome package:** D-96 requires `SourcererAPI.sys.mjs` and `TheiaService.sys.mjs` to be importable as `ChromeUtils.importESModule("chrome://sourcerer/content/...")` or as a `resource://` module via `EXTRA_JS_MODULES`. Upstream uses `EXTRA_JS_MODULES` for `resource:///modules/*.sys.mjs` files that are imported from many places by stable path [VERIFIED: upstream/browser/moz.build:114-129, e.g. `"BrowserWindowTracker.sys.mjs"`]. Since D-96's rule is "only `SourcererAPI.sys.mjs` imports internals" and both new modules are consumed **only from `sourcerer.xhtml` and each other**, the simpler and more consistent choice is to ship both `.sys.mjs` files **inside the same chrome package** (`content/sourcerer/SourcererAPI.sys.mjs`, `content/sourcerer/TheiaService.sys.mjs`), imported via `ChromeUtils.importESModule("chrome://sourcerer/content/SourcererAPI.sys.mjs")`. This keeps every Phase-4 file under one jar.mn entry and avoids adding a second registration mechanism (`EXTRA_JS_MODULES`) for two files nothing outside `sourcerer/shell/` needs to resolve by a stable `resource://` path. `EXTRA_JS_MODULES` remains the right tool only if a *later* phase needs these modules reachable from outside the chrome package by a stable `resource:///modules/` path.

### Pattern 4: Minimal XUL window (Q4)

Upstream ships a real precedent for exactly the shape D-90 wants: a standalone chrome window containing one `type="content" remote="true"` `<browser>` and nothing else browser.xhtml-shaped — the Picture-in-Picture player window [VERIFIED: upstream/toolkit/components/pictureinpicture/content/player.xhtml:1-45]:
```xhtml
<html xmlns="http://www.w3.org/1999/xhtml"
      xmlns:xul="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
      windowtype="Toolkit:PictureInPicture"
      macnativefullscreen="true"
      customtitlebar="true"
      scrolling="false">
  <head>
    <meta charset="utf-8"/>
    <meta http-equiv="Content-Security-Policy" content="default-src chrome:"/>
    ...
    <title data-l10n-id="pictureinpicture-player-title"></title>
  </head>
  <body>
    <div class="player-holder">
      <xul:browser type="content" primary="true" remote="true" remoteType="web" id="browser" tabindex="-1" .../>
    </div>
    ...
  </body>
</html>
```
Confirms exactly what D-90/D-91 need: root is an **HTML `<html>` element** (not XUL `<window>`), with `xmlns:xul` declared so `<xul:browser>` can be used inline for the content element itself; `windowtype` is a plain string attribute with no required value (browser.xhtml itself uses `windowtype="navigator:browser"` [VERIFIED: upstream/browser/base/content/browser.xhtml:8]) — Sourcerer's window should use its own distinct value (e.g. `"sourcerer:main"`) since nothing in the startup path requires the literal string `navigator:browser` to open a window (see gBrowber-dependency check below); `remoteType="web"` plus `type="content" remote="true"` is the exact triple D-91 asks for. A `<div>`/deck wrapper around the `<browser>` is where D-94's loading-layer sibling goes (a second `<div>` overlay, toggled via a class or `hidden` attribute, no XUL `<deck>` needed — the PIP window already demonstrates plain HTML `<div>`s doing layered UI in a chrome document).

**gBrowser dependency check (residual risk, not a blocker):** grepped `BrowserGlue.sys.mjs` for all 13 `gBrowser` references [VERIFIED: upstream/browser/components/BrowserGlue.sys.mjs, `grep -n "gBrowser\b"` → lines 289, 1463, 1522, 1547, 1556, 1606, 1634/1654/1662/1664/1668, 1780, 1793]. Every hit sits inside a feature-specific, event-triggered handler (post-update "what's new" tab, tab-close-warning confirmation, private-browsing-context menu) — none execute unconditionally during initial window creation/paint. This is **MEDIUM confidence**, not HIGH: `BrowserGlue.sys.mjs` is large and its `_finalUIStartup`-style observer chain was not traced line-by-line in full. Recommend the plan add a smoke-test task ("first launch, browser console shows zero `gBrowser is undefined` errors") as a cheap residual-risk check rather than a full trace.

**CSP note:** the PIP window's `<meta http-equiv="Content-Security-Policy" content="default-src chrome:"/>` would block the `<browser>` from loading `http://127.0.0.1:<port>` content — that CSP applies to the **chrome document itself** (`sourcerer.xhtml`'s own resources), not to what the `<browser remote="true">` element navigates to (a separate content-process document with its own CSP), so this is safe to keep/adapt as-is for the chrome document's own security posture.

### Pattern 5: Cookie-set API for the token (Q5)

Exact signature [VERIFIED: upstream/netwerk/cookie/nsICookieManager.idl:134-146]:
```idl
[implicit_jscontext]
nsICookieValidation add(in AUTF8String aHost,
                        in AUTF8String aPath,
                        in ACString    aName,
                        in AUTF8String aValue,
                        in boolean     aIsSecure,
                        in boolean     aIsHttpOnly,
                        in boolean     aIsSession,
                        in int64_t     aExpiry,
                        in jsval aOriginAttributes,
                        in int32_t aSameSite,
                        in nsICookie_schemeType aSchemeMap,
                        [optional] in boolean aIsPartitioned);
```
Relevant constants [VERIFIED: upstream/netwerk/cookie/nsICookie.idl:29-32, 158-161]:
```idl
const uint32_t SAMESITE_NONE   = 0;
const uint32_t SAMESITE_LAX    = 1;
const uint32_t SAMESITE_STRICT = 2;
...
SCHEME_UNSET = 0x00,
SCHEME_HTTP = 0x01,
SCHEME_HTTPS = 0x02,
SCHEME_FILE = 0x04,
```
For D-99's cookie, from `SourcererAPI.sys.mjs`:
```js
Services.cookies.add(
  "127.0.0.1",                 // aHost
  "/",                          // aPath
  "SOURCERER_TOKEN",            // aName
  token,                         // aValue
  false,                         // aIsSecure — MUST be false; origin is http://, not https://
  true,                          // aIsHttpOnly
  true,                          // aIsSession — cookie dies with the backend process's lifetime concept (per-launch)
  0,                              // aExpiry — ignored when aIsSession is true
  {},                              // aOriginAttributes — default (no containers/private browsing partitioning)
  Ci.nsICookie.SAMESITE_STRICT,    // aSameSite — matches stock cookie's posture
  Ci.nsICookie.SCHEME_HTTP,        // aSchemeMap — plain HTTP only, matches the origin
  false                             // aIsPartitioned
);
```
`aIsSecure: false` is required (not optional) because the origin is `http://127.0.0.1:<port>`, not HTTPS — a `Secure` cookie would never be sent to it and D-99's whole point (every request, page, assets, WS carries it automatically) would silently fail. This must be called **before** `<browser>.loadURI()` is invoked (or before `<browser>.src` is set), per D-99.

### Pattern 6: Subprocess lifecycle (Q6)

`BaseProcess.kill(timeout=300)` already implements the exact SIGTERM→grace→SIGKILL sequence D-105 wants — it is not something to hand-roll [VERIFIED: upstream/toolkit/modules/subprocess/subprocess_common.sys.mjs:670-703]:
```js
/**
 * @param {integer} [timeout=300]
 *        ... the process will be sent a `SIGTERM` signal immediately ...
 *        and a `SIGKILL` signal if it hasn't exited within `timeout` milliseconds.
 *        On other platforms (namely Windows), the process will be forcibly
 *        terminated immediately.
 */
kill(timeout = 300) {
    if (this.exitCode != null) { return this.wait(); }
    let force = timeout <= 0;
    this.worker.call("kill", [this.id, force]);
    if (!force) {
        lazy.setTimeout(() => {
            if (this.exitCode == null) { this.worker.call("kill", [this.id, true]); }
        }, timeout);
    }
    return this.wait();
}
wait() { return this.exitPromise; }
```
D-105's "SIGTERM, wait a short bounded grace, then SIGKILL" is literally `await process.kill(graceMs)` — one call. **Don't hand-roll a manual setTimeout+SIGKILL sequence; `kill(timeoutMs)` already is that sequence.**

`exitPromise`/`wait()` resolves `{ exitCode }`; on Unix a negative exit code means "killed by signal `abs(exitCode)`" [VERIFIED: subprocess_common.sys.mjs:705-721 docblock].

Reading stdout incrementally: `process.stdout` is an `InputPipe` instance with `readString(length = null, options = {...})` [VERIFIED: subprocess_common.sys.mjs — class `InputPipe extends Pipe`, method `readString` present]. For D-106's ring buffer, read in a loop with `readString(null, { stream: true })`-style calls (streaming mode is the `options.stream` default when `length === null`) and push each chunk into the bounded buffer.

**What happens to the child on browser SIGKILL by default:** `Subprocess.sys.mjs` spawns a plain OS child process; nothing in the reviewed API registers it as a job object / process group by default. Firefox itself being SIGKILLed gives the child **no cleanup signal at all** — it becomes an orphan under whatever reparents it (usually PID 1). This is exactly the gap Phase 5's SIDE-04 (process-group kill semantics, startup leftover cleanup) exists to close — **Phase 4 correctly does not attempt this** (per the Deferred Ideas list); this is confirmation, not a new finding.

### Pattern 7: Quit observer topic (Q7)

D-105's choice of `quit-application-granted` is validated by a direct in-tree precedent doing the same two-phase thing (allow-to-cancel, then commit) [VERIFIED: upstream/toolkit/components/downloads/DownloadIntegration.sys.mjs:115-116, 1341, 1349]:
```
"quit-application-requested",
"quit-application-granted",
...
case "quit-application-requested": { ... }   // can still be cancelled
case "quit-application-granted": { ... }     // quit is committed, safe to act
```
`quit-application-granted` fires only once the quit decision is final and no observer can still cancel it — the correct topic for "stop the health loop, then SIGTERM" (D-105), since starting an irreversible shutdown sequence on the earlier, cancelable `quit-application-requested` topic would risk killing the backend under a quit that gets aborted.

### Pattern 8: Verification harness reuse (Q8)

The existing zero-dependency WebDriver BiDi harness at `scripts/lib/firefox-bidi.mjs` [VERIFIED: scripts/lib/firefox-bidi.mjs:39, 148, 254] already provides everything `verify-phase-04.sh` needs:
- `FIREFOX_BIN = join(REPO_ROOT, 'objdir', 'dist', 'bin', 'sourcerer')` — drives the **built** binary, not `mach run`.
- `withFirefoxPage(url, callback, { binPath })` → `{ evaluate, waitFor, screenshot }`, spawning with `--remote-debugging-port=<port>` and cleaning up the child in a `finally`.
- `waitFor(evaluate, expression, { timeoutMs = 15000, intervalMs = 100 })` — the bounded-poll pattern already used for "wait for the Theia SPA to settle" per 02-LEARNINGS.

**For criterion 5 (kill-backend-PID → poll recovery):** the harness's own `child.pid` is Firefox's PID, not the Node backend's. The verify script needs the **backend's** PID. Recommend extending the token-gated health endpoint (D-103) to return `{ ok: true, pid: <backend pid> }` in its JSON body — this is a one-field addition to an endpoint the plan must build anyway, and it is exactly what Phase 5's diagnostics page (SHELL-04, "recent log output" + presumably PID) will also want to read (D-106 already establishes "read the buffer that already exists — no retrofit"; the same logic applies to PID). The verify script calls the (token-authenticated) health endpoint once to learn the PID, then sends the OS kill signal directly (`process.kill(pid, 'SIGKILL')` from the Node-based verify script, or `kill -9 $PID` from bash) and polls the health endpoint again until it recovers.

### Pattern 9: Build-tier sequencing for Phase 4 artifacts (Q9)

Cross-referencing `docs/BUILD.md`'s tier table [VERIFIED: docs/BUILD.md:277-297] against this phase's specific files:

| Artifact | Tier | Why |
|----------|------|-----|
| `upstream/browser/moz.configure` — `BROWSER_CHROME_URL` hunk | 3 (full `./mach build`) | `set_as_define=True` [VERIFIED: upstream/toolkit/moz.configure:60-70, per D-89] regenerates `mozilla-config.h`, a compiled define |
| `upstream/browser/moz.build` — `DIRS += ["../sourcerer/shell"]` hunk | 3, same rebuild as above | New `DIRS` entries require the build system to re-run configure/moz.build discovery; per D-93 both hunks ship in the same `020-sourcerer-shell.patch` so this is **one** rebuild, not two |
| `sourcerer/shell/jar.mn` (new file, and later edits) | 2 (`./mach build faster`) | Packaging manifest processing (`JAR_MANIFESTS`) is non-compiling per the Tier 2 definition [VERIFIED: docs/BUILD.md:225-229, "preprocessed frontend file... required, but only the fast, non-compiling `faster` tier"]; matches D-92's own claim |
| `sourcerer.xhtml`, `SourcererAPI.sys.mjs`, `TheiaService.sys.mjs` edits, **after** the jar.mn registration above has been built once | 1 (`./mach run`, no build) | Once chrome-registered, these are symlinked into `objdir/dist/bin` the same way every other `.js`/`.xhtml` file is [VERIFIED: docs/BUILD.md:189-193] |

**Sequencing consequence for the plan:** land the `020-sourcerer-shell.patch` (both hunks) and the first version of `sourcerer/shell/{moz.build,jar.mn,sourcerer.xhtml}` in the **same first task**, run the one unavoidable tier-3 build (~2368-2822s per the phase's own measured figures), and treat every subsequent content/API iteration in this phase as tier 1 (or tier 2 only when jar.mn itself changes, e.g. adding a second file to the package).

### Pattern 10: Spawn command shape — avoid the bash-wrapper PID trap (new finding, not in the original question list)

The already-working `theia/applications/browser/package.json` `start` script spawns via a **bash wrapper** [VERIFIED: theia/applications/browser/package.json:83]:
```json
"start": "VSX_REGISTRY_URL=https://open-vsx.org THEIA_CONFIG_DIR=\"${XDG_CONFIG_HOME:-$HOME/.config}/sourcerer\" bash -c 'mkdir -p \"$THEIA_CONFIG_DIR\" && theia start'"
```
If `TheiaService.sys.mjs` spawns this script (or an equivalent `bash -c '...theia start...'` string) via `Subprocess.sys.mjs`, the `pid` `Subprocess.call()` returns is **bash's** PID, not the Node process actually listening on the port — `theia start` (itself likely a further wrapper around `node lib/backend/main.js`) may be a grandchild. Killing the reported PID would leave the real backend running (orphaned) — exactly the wrong outcome for both D-105's normal-quit path and criterion 5's kill-and-recover test.

**Recommendation:** TheiaService should spawn `node` directly against `theia/applications/browser/lib/backend/main.js` (the D-100 `sourcerer.sidecar.backendMain` pref should point at this file), passing `--hostname 127.0.0.1 --port 0` as argv and `THEIA_CONFIG_DIR`/`VSX_REGISTRY_URL`/the token via `Subprocess.sys.mjs`'s `options.environment`, with `mkdir -p $THEIA_CONFIG_DIR` performed by TheiaService itself (via SourcererAPI) before spawn rather than relying on a shell one-liner. This makes the `pid` `Subprocess.call()` returns the actual Node process, so `kill()` targets the right process and the health-endpoint PID (Pattern 8) matches what TheiaService itself already holds (useful as a cheap consistency check).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| SIGTERM-then-SIGKILL shutdown sequence | A manual `setTimeout` + second kill call | `BaseProcess.kill(timeoutMs)` | Already implements exactly this (Pattern 6) |
| Reading the OS-assigned port | stdout regex parsing of Theia's log line | `BackendApplicationContribution.onStart(server)` + `server.address().port` | Typed, documented extension point vs. a prose log string that can change wording across point releases |
| Guaranteeing middleware order | Reasoning about DI/container-module load order | `EarlyExpressMiddleware.handlers.unshift()` | Construction-time guarantee regardless of contribution registration order (Pattern 2) |
| Health-check-doubles-as-token-check | A separate `/health` route plus a separate token-verification route | One token-gated health route (D-103's own design) | One request proves two properties; fewer routes for the boundary-guard script to reason about |
| Ring-buffer log capture | A logging library dependency | Bounded in-memory array, mirrored to console (D-106) | A few hundred lines of text; the entire point of D-106 is this is cheap and needs no library |

**Key insight:** every "hard part" of this phase already has a first-class hook in the pinned dependency versions (`onStart`, `EarlyExpressMiddleware`, `kill(timeout)`) — the risk in this phase is not missing functionality, it's wiring things together in the wrong order (Pattern 2, Pattern 10) in ways that look correct and are not, mirroring D-104's own stated rationale for why "bind 0 every spawn" reads correct and isn't.

## Common Pitfalls

### Pitfall 1: EarlyExpressMiddleware.push() instead of unshift()
**What goes wrong:** Token gate appears to work (a curl without the cookie gets 403) in casual testing, but a WS-upgrade-only attack path still succeeds because the stock cookie was issued before the 403.
**Why it happens:** `push()` looks like the obvious, symmetric choice alongside the stock contribution's own `push()` call; the ordering bug is invisible unless you specifically test "does the 403 response also carry a stock Set-Cookie header."
**How to avoid:** Use `unshift()` (Pattern 2); write the verify script's negative-control test to assert the **response headers of the 403** contain no `theia-connection-token` Set-Cookie, not just that the status code is 403.
**Warning signs:** A 403 test passes but a paired "did this response leak a usable stock cookie" check fails.

### Pitfall 2: Spawning through a bash wrapper
**What goes wrong:** `kill()`/SIGTERM only reaches the shell, backend survives as an orphan; criterion 5's kill-and-recover test looks like it passes (Firefox restarts *a* backend on a new spawn) but the old one is still listening on the pinned port, causing a bind-conflict on the "same port" restart D-104 requires.
**Why it happens:** the working `yarn start` script already uses `bash -c '...'` (Pattern 10) and it's tempting to reuse it verbatim from `Subprocess.sys.mjs`.
**How to avoid:** spawn `node lib/backend/main.js` directly with explicit argv/env (Pattern 10).
**Warning signs:** after a kill-and-recover test, `pgrep -f backend/main.js` on the host shows two matching processes.

### Pitfall 3: BROWSER_CHROME_URL tier-3 rebuild done more than once
**What goes wrong:** iterating on `sourcerer.xhtml` content by re-touching `browser/moz.configure` or re-applying patches individually costs a ~40-47 minute rebuild each time.
**Why it happens:** D-89/D-92/D-93 are two separate concerns (URL repoint, DIRS registration) that are easy to patch and test one at a time out of habit.
**How to avoid:** land both hunks in the single `020-sourcerer-shell.patch` (already D-93's decision) and do the one tier-3 build before iterating on content (Pattern 9).
**Warning signs:** the plan has more than one task requiring a full `./mach build`.

### Pitfall 4: gBrowser-shaped assumptions leaking into the minimal window
**What goes wrong:** some Firefox chrome machinery (BrowserGlue's post-update tab, tab-close warning, private-browsing menu items) calls `win.gBrowser` and throws when it's undefined, producing console noise or — in a worse case — blocking a code path other decisions depend on.
**Why it happens:** these are triggered by prefs/events Sourcerer doesn't control end-to-end yet (e.g. auto-update is disabled per BRAND-04, but not every gBrowser-touching code path is gated purely on that).
**How to avoid:** the residual-risk smoke test named in Pattern 4 (first-launch console check for `gBrowser is undefined`); do not attempt a full trace of `BrowserGlue.sys.mjs`'s startup observer chain in Phase 4 — the CONTEXT's own decision to keep the window from-scratch (D-90) already accepts this class of risk in exchange for a smaller rebase surface.
**Warning signs:** browser console errors mentioning `gBrowser` on cold launch.

## Code Examples

### Minimal chrome-registered content (Pattern 3 + Pattern 4 combined sketch)

`sourcerer/shell/jar.mn`:
```
sourcerer.jar:
%  content sourcerer %content/sourcerer/ contentaccessible=yes
   content/sourcerer/sourcerer.xhtml         (sourcerer.xhtml)
   content/sourcerer/SourcererAPI.sys.mjs    (SourcererAPI.sys.mjs)
   content/sourcerer/TheiaService.sys.mjs    (TheiaService.sys.mjs)
```
`sourcerer/shell/moz.build`:
```python
# Source: upstream/browser/base/moz.build:81 pattern
JAR_MANIFESTS += ["jar.mn"]
```

### Token-gate backend extension skeleton (Pattern 2)

```ts
// Source: theia/node_modules/@theia/core/lib/node/backend-application.d.ts (BackendApplicationContribution shape)
@injectable()
export class SourcererTokenGateContribution implements BackendApplicationContribution {
    @inject(EarlyExpressMiddleware)
    protected readonly earlyMiddleware: EarlyExpressMiddleware;

    initialize(): void {
        // unshift, not push — see RESEARCH.md Pattern 2 for why order matters
        this.earlyMiddleware.handlers.unshift((req, res, next) => this.gate(req, res, next));
    }

    onStart(server: http.Server): void {
        const address = server.address();
        const port = typeof address === 'string' ? undefined : address?.port;
        // announce `port` via the mechanism TheiaService reads (Pattern 1)
    }

    private gate(req: express.Request, res: express.Response, next: express.NextFunction): void {
        const token = this.getTokenFromCookie(req); // parse SOURCERER_TOKEN cookie
        if (token && this.isTokenValid(token)) {
            next();
            return;
        }
        res.sendStatus(403); // no next() — stock cookie contribution never runs for this request
    }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Theia connection token enforced only on WS upgrade | `EarlyExpressMiddleware` + opt-in `HttpConnectionValidator` extension point added to `@theia/core` | Landed by 1.74.1 (Sourcerer's pinned version); CVE-2026-61891 names versions "up to and including 1.73.1" as vulnerable | The *mechanism* to fix this ships in the pinned version, but nothing in core wires index.html/static routes to require it by default — Sourcerer's own extension (D-98) is still required to close the gap for its own token |

**Deprecated/outdated:** none specific to this phase beyond the above — Theia has no formal API-stability tier (already flagged project-wide in STATE.md Blockers/Concerns), so every `@theia/core` import used here should be re-checked against `doc/Migration.md` on the next Theia re-pin, per that existing standing concern.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `theia start` (the CLI wrapper invoked by the `start` npm script) forwards `--hostname`/`--port` CLI args unchanged to `lib/backend/main.js`'s yargs parser, rather than transforming them | Pattern 10 / Q1 discretion note | Low — Phase 4 recommends spawning `node lib/backend/main.js` directly instead of through `theia start`/the bash wrapper, which sidesteps this assumption entirely; only relevant if the plan chooses to keep the wrapper script |
| A2 | No code path in `BrowserGlue.sys.mjs`'s unconditional startup sequence (outside the 13 grepped `gBrowber` references, all confirmed event-gated) accesses `gBrowser` before first paint | Pattern 4 | Medium — a console error on cold launch, not a hard failure; mitigated by the recommended smoke-test task |
| A3 | `InputPipe.readString(null, { stream: true })` is the correct incremental-read call shape for the D-106 ring buffer (method existence verified; exact call-site semantics for streaming mode not traced beyond the method signature) | Pattern 6 | Low — worst case, the plan needs to adjust the exact `readString` options object during implementation; the class and method are confirmed to exist |

## Open Questions

1. **Exact `theia start`→`lib/backend/main.js` argv-forwarding path**
   - What we know: `lib/backend/main.js` exists (generated), and `BackendApplicationCliContribution` parses `--port`/`--hostname` via yargs.
   - What's unclear: whether `theia start`'s own CLI wrapper (inside `@theia/cli`) does anything besides `require()`-ing `lib/backend/main.js` with `process.argv` passed through.
   - Recommendation: moot if the plan follows Pattern 10's recommendation to spawn `node lib/backend/main.js` directly — bypasses `theia start` entirely and its own argv handling.

2. **Exact wording/format of the port-announcement file (Pattern 1)**
   - What we know: the mechanism (write from `onStart(server)`, poll from TheiaService) is sound.
   - What's unclear: exact file path/format — Claude's Discretion per CONTEXT; JSON `{ "port": N }` under `$THEIA_CONFIG_DIR/sourcerer-backend.json`, written atomically, is a reasonable default for the plan to lock in.
   - Recommendation: planner picks a concrete path/format and records it as a plan decision; not a research gap.

## Environment Availability

Skipped — this phase has no new external dependency beyond what Phases 1-3 already provisioned and verified (the `theia` and `firefox` Nix dev shells, pinned Node 22, `objdir/dist/bin/sourcerer`). No new tool, service, or runtime is introduced.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None (no jest/pytest) — custom zero-dependency WebDriver BiDi harness, `scripts/lib/firefox-bidi.mjs`, driving the built binary directly |
| Config file | none — see `scripts/verify-phase-02.sh`/`verify-phase-03.sh` for the established shape |
| Quick run command | `node scripts/verify-phase-04.sh` (to be created, extending the Phase 2/3 pattern) |
| Full suite command | same script — this project has one verification script per phase, extended not sibling'd (established pattern) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| SHELL-01 | Window shows Theia's own unsuppressed shell, no custom chrome | e2e (BiDi, bounded poll for settled Theia DOM) | `withFirefoxPage` + `waitFor` against `objdir/dist/bin/sourcerer` | ❌ Wave 0 — `verify-phase-04.sh` |
| SHELL-05 | Window paints loading state immediately, swaps after health check | e2e (screenshot early, then poll for swap) | `captureScreenshot`/`withFirefoxPage.screenshot()` | ❌ Wave 0 |
| SIDE-01 | Backend bound to 127.0.0.1 on OS-assigned port | smoke (assert bound host via a probe outside 127.0.0.1 fails; announced port file/endpoint matches actual listening port) | shell/node probe in `verify-phase-04.sh` | ❌ Wave 0 |
| SIDE-02 | Plain HTTP without token rejected, not just WS upgrade | integration (positive control: with-token 200; negative: without-token 403, and header-leak check per Pitfall 1) | `curl`/`fetch` pair in `verify-phase-04.sh` | ❌ Wave 0 |
| SIDE-03 | Health loop restarts backend with backoff on crash | e2e (kill backend PID via health-endpoint-reported PID, poll for recovery) | `verify-phase-04.sh` | ❌ Wave 0 |
| SHELL-02 | Only `SourcererAPI.sys.mjs` imports Firefox internals | static analysis | `scripts/check-internals-boundary.sh` (+ `--self-test`) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** relevant slice of `verify-phase-04.sh` (e.g. just the token-gate curl pair while building the extension)
- **Per wave merge:** full `verify-phase-04.sh`
- **Phase gate:** full suite green, plus the one `human_verify_mode: end-of-phase` item ("window paints its branded state immediately at launch") before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `scripts/verify-phase-04.sh` — covers SHELL-01, SHELL-05, SIDE-01, SIDE-02, SIDE-03
- [ ] `scripts/check-internals-boundary.sh` (+ `--self-test`) — covers SHELL-02
- [ ] No shared fixtures needed beyond the existing `scripts/lib/firefox-bidi.mjs`

## Security Domain

Skipped — `security_enforcement: false` in `.planning/config.json`. (Note: SIDE-02's token-gate work is still fully covered above because it is an explicit phase requirement, not because of the security-enforcement toggle.)

## Sources

### Primary (HIGH confidence — read directly from the pinned trees this session)
- `upstream/browser/moz.configure`, `upstream/toolkit/moz.configure` — `BROWSER_CHROME_URL` define
- `upstream/browser/moz.build`, `upstream/browser/base/moz.build`, `upstream/mfbt/moz.build`, `upstream/toolkit/content/jar.mn` — DIRS/jar.mn/moz.build wiring
- `upstream/browser/base/content/browser.xhtml`, `upstream/toolkit/components/pictureinpicture/content/player.xhtml` — chrome window shape precedents
- `upstream/browser/components/BrowserGlue.sys.mjs` — gBrowser-dependency grep
- `upstream/netwerk/cookie/nsICookieManager.idl`, `upstream/netwerk/cookie/nsICookie.idl` — cookie API
- `upstream/toolkit/modules/subprocess/subprocess_common.sys.mjs` — Process/Pipe API
- `upstream/toolkit/components/downloads/DownloadIntegration.sys.mjs` — quit-observer precedent
- `theia/node_modules/@theia/core/lib/node/backend-application.js` (+ `.d.ts`), `.../hosting/browser-connection-token.js`, `.../hosting/backend-hosting-module.js`, `.../logger-cli-contribution.js` — Theia backend hosting internals
- `theia/applications/browser/package.json` — app config, start script
- `scripts/fetch-upstream.sh`, `scripts/lib/firefox-bidi.mjs`, `scripts/check-patch-surface.sh`, `docs/BUILD.md` — repo tooling and measured build tiers
- `sourcerer/branding/release/{content/jar.mn,moz.build}` — in-repo jar.mn/moz.build precedent

### Secondary (MEDIUM confidence)
- CVE-2026-61891 description (WebSearch, cross-referenced against the actual `browser-connection-token.js` source, which matches the described vulnerability class)

### Tertiary (LOW confidence)
- None — every claim above is either read directly from the pinned source this session or a single, source-corroborated web search result.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new external dependencies; every API verified against the pinned source
- Architecture: HIGH — chrome registration, window shape, and the EarlyExpressMiddleware ordering fix are all directly verified with file:line citations and exact quotes
- Pitfalls: HIGH for Pitfalls 1-3 (directly derived from verified source behavior); MEDIUM for Pitfall 4 (BrowserGlue's full startup chain not exhaustively traced)

**Research date:** 2026-08-26
**Valid until:** Firefox ESR 153 and Theia 1.74.1 are both exact-pinned for this milestone (D-19 et al.) — this research is valid for the lifetime of those pins, i.e. until the next ESR rebase or Theia re-pin, not a fixed day count.
