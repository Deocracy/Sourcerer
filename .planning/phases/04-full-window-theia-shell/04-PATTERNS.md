# Phase 4: Full-Window Theia Shell - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 12
**Analogs found:** 10 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `patches/020-sourcerer-shell.patch` | config (Gecko patch) | transform | `patches/010-sourcerer-identity.patch` | exact |
| `sourcerer/shell/moz.build` | config (build) | transform | `sourcerer/branding/release/moz.build` | role-match |
| `sourcerer/shell/jar.mn` | config (chrome registration) | transform | `sourcerer/branding/release/content/jar.mn` (in-repo) + `upstream/toolkit/content/jar.mn` (top-level package precedent) | role-match |
| `sourcerer/shell/sourcerer.xhtml` | component (chrome window) | request-response (loads one URL once) | `upstream/toolkit/components/pictureinpicture/content/player.xhtml` | exact (shape), no in-repo analog |
| `sourcerer/shell/SourcererAPI.sys.mjs` | utility / anti-corruption layer | request-response | none in-repo (new pattern); style precedent `upstream/toolkit/components/downloads/DownloadIntegration.sys.mjs` (observer + XPCOM usage) | no-analog (new boundary file) |
| `sourcerer/shell/TheiaService.sys.mjs` | service (process supervisor) | event-driven | none in-repo; API shape from `upstream/toolkit/modules/subprocess/subprocess_common.sys.mjs` (Subprocess/BaseProcess) | no-analog (new supervisor) |
| `theia/extensions/token-gate/package.json` | config | — | `theia/extensions/branding/package.json` | exact |
| `theia/extensions/token-gate/src/node/token-gate-backend-module.ts` | provider (DI container module) | request-response | `theia/extensions/branding/src/browser/sourcerer-frontend-module.ts` (DI/isBound idiom); real backend-side analog is Theia core's own `theia/node_modules/@theia/core/lib/node/hosting/backend-hosting-module.js` | role-match |
| `theia/extensions/token-gate/src/node/token-gate-backend-contribution.ts` | controller (BackendApplicationContribution + middleware + route) | request-response | `theia/node_modules/@theia/core/lib/node/hosting/browser-connection-token.js` (`BrowserConnectionTokenBackendContribution`) | exact |
| `sourcerer/INTERNAL-APIS.md` | doc/config | — | none (new); format precedent `sourcerer/endpoint-allowlist.json` schema as checked by `scripts/verify-phase-03.sh`'s `check_allowlist_schema` (catalogue-with-reason idiom) | role-match |
| `scripts/check-internals-boundary.sh` | test (static-analysis guard) | batch | `scripts/check-patch-surface.sh` | exact |
| `scripts/verify-phase-04.sh` | test (e2e aggregator) | batch | `scripts/verify-phase-03.sh` | exact |
| `theia/applications/browser/package.json` (edit) | config | — | itself (existing file, add one `@sourcerer/*` dependency line) | exact |

## Pattern Assignments

### `patches/020-sourcerer-shell.patch` (config, transform)

**Analog:** `patches/010-sourcerer-identity.patch`

Standard unified-diff patch, one file per hunk, applied by `scripts/apply-patches.sh` in numeric order. Excerpt showing the diff shape to copy (`patches/010-sourcerer-identity.patch:1-16`):
```diff
diff --git a/browser/moz.configure b/browser/moz.configure
index 3ea3d88b93..33098ee135 100644
--- a/browser/moz.configure
+++ b/browser/moz.configure
@@ -3,15 +3,16 @@
 # file, You can obtain one at http://mozilla.org/MPL/2.0/.
 
 imply_option("MOZ_PLACES", True)
-imply_option("MOZ_SERVICES_HEALTHREPORT", True)
+imply_option("MOZ_SERVICES_HEALTHREPORT", False)
...
```
020 needs two hunks in one file per D-93: the `BROWSER_CHROME_URL` imply_option in `upstream/browser/moz.configure:19`, and a `DIRS += ["../sourcerer/shell"]` addition in `upstream/browser/moz.build` (see RESEARCH.md Pattern 3/9). Must pass `scripts/check-patch-surface.sh` (config-only paths, not compiled suffixes).

---

### `sourcerer/shell/moz.build` (config, transform)

**Analog:** `sourcerer/branding/release/moz.build`

```python
# sourcerer/branding/release/moz.build
DIRS += ["content", "locales"]
```
For `sourcerer/shell/moz.build`, RESEARCH.md's own recommended content is the minimal equivalent:
```python
JAR_MANIFESTS += ["jar.mn"]
```
(Pattern from `upstream/browser/base/moz.build:81`.)

---

### `sourcerer/shell/jar.mn` (config, transform)

**Analogs:** `sourcerer/branding/release/content/jar.mn` (in-repo jar.mn shape/comment style) + `upstream/toolkit/content/jar.mn:1-2` (top-level `% content <package>` registration, since shell registers a *new* top-level chrome package, not a sub-package of `browser.jar`).

In-repo comment/header convention to copy (`sourcerer/branding/release/content/jar.mn:1-9`):
```
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Stub jar.mn: only re-exports the five default*.png icons this tree ships.
...
browser.jar:
% content branding %content/branding/ contentaccessible=yes
  content/branding/icon16.png                    (../default16.png)
```
Top-level package registration syntax to copy (`upstream/toolkit/content/jar.mn:1-2`):
```
toolkit.jar:
%  content global %content/global/ contentaccessible=yes
```
RESEARCH.md's concrete target for this file (`sourcerer/shell/jar.mn`):
```
sourcerer.jar:
%  content sourcerer %content/sourcerer/ contentaccessible=yes
   content/sourcerer/sourcerer.xhtml         (sourcerer.xhtml)
   content/sourcerer/SourcererAPI.sys.mjs    (SourcererAPI.sys.mjs)
   content/sourcerer/TheiaService.sys.mjs    (TheiaService.sys.mjs)
```

---

### `sourcerer/shell/sourcerer.xhtml` (component, request-response)

**Analog:** `upstream/toolkit/components/pictureinpicture/content/player.xhtml:1-45` (read-only reference; do not copy verbatim, do not modify).

No in-repo analog exists — this is the first hand-written chrome window in the tree. Shape to copy:
```xhtml
<html xmlns="http://www.w3.org/1999/xhtml"
      xmlns:xul="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
      windowtype="Toolkit:PictureInPicture"
      ...>
  <head>
    <meta charset="utf-8"/>
    <meta http-equiv="Content-Security-Policy" content="default-src chrome:"/>
    <title data-l10n-id="pictureinpicture-player-title"></title>
  </head>
  <body>
    <div class="player-holder">
      <xul:browser type="content" primary="true" remote="true" remoteType="web" id="browser" tabindex="-1" .../>
    </div>
  </body>
</html>
```
Root is HTML `<html>` (not XUL `<window>`), `xmlns:xul` declared for the inline `<xul:browser>`. Use a distinct `windowtype` (e.g. `"sourcerer:main"`, not `"navigator:browser"` — see `upstream/browser/base/content/browser.xhtml:8`). D-91's triple (`type="content" remote="true" remoteType="web"`) matches this element exactly. D-94's loading-layer deck is a sibling `<div>` overlay (plain HTML, no XUL `<deck>` needed — PIP already does layered chrome UI with plain divs). Keep the CSP meta tag; it scopes to the chrome document only, not the `<browser>`'s own content process (RESEARCH.md Pattern 4, CSP note).

**Residual-risk check to carry into the plan:** smoke-test for zero `gBrowser is undefined` console errors on cold launch (RESEARCH.md Pitfall 4 / Pattern 4).

---

### `sourcerer/shell/SourcererAPI.sys.mjs` (utility, anti-corruption layer)

**No in-repo analog** — this is Phase 4's one new boundary file (D-96). Style precedent for the *kind* of API surface it wraps (`upstream/toolkit/components/downloads/DownloadIntegration.sys.mjs:115-116,1341,1349`, read-only reference for observer registration idiom):
```js
"quit-application-requested",
"quit-application-granted",
...
case "quit-application-granted": { ... }   // quit is committed, safe to act
```
SourcererAPI must expose named methods wrapping (per D-96/D-99/D-100/D-101/D-105 and RESEARCH.md Patterns 5-7):
- `Services.cookies.add(...)` for the token cookie (exact call shape in RESEARCH.md Pattern 5, `upstream/netwerk/cookie/nsICookieManager.idl:134-146`)
- pref reads (`sourcerer.sidecar.nodePath`, `.backendMain`) via `Services.prefs`
- `Subprocess.sys.mjs` spawn/kill wrapping (`upstream/toolkit/modules/subprocess/subprocess_common.sys.mjs:670-703` — `BaseProcess.kill(timeoutMs)` already implements SIGTERM→grace→SIGKILL, do not hand-roll)
- quit-observer registration (`quit-application-granted` topic)

This file is the ONLY file in `sourcerer/` allowed the forbidden-pattern imports that `scripts/check-internals-boundary.sh` scans for.

---

### `sourcerer/shell/TheiaService.sys.mjs` (service, event-driven)

**No in-repo analog** — new supervisor. Imports only `SourcererAPI.sys.mjs` (D-96). Core shape from RESEARCH.md's architecture diagram: mint token → spawn via `SourcererAPI` → poll port-announcement file → poll health endpoint (fast, then slow) → set cookie via `SourcererAPI` → `loadURI` once → steady-state poll → restart w/ same port+token on failure → stop-loop-then-kill on quit observer callback. Spawn `node lib/backend/main.js` directly (not through the `bash -c '...theia start...'` wrapper in `theia/applications/browser/package.json:83`) per RESEARCH.md Pattern 10 / Pitfall 2, so the returned PID is the actual backend process `kill()` can target.

---

### `theia/extensions/token-gate/package.json` (config)

**Analog:** `theia/extensions/branding/package.json` (exact shape to copy, only naming/deps/entry point differ)

```json
{
  "private": true,
  "name": "@sourcerer/branding",
  "version": "0.1.0",
  "license": "MIT",
  "dependencies": {
    "@theia/ai-ide": "1.74.1",
    "@theia/core": "1.74.1"
  },
  "theiaExtensions": [
    { "frontend": "lib/browser/sourcerer-frontend-module" }
  ],
  "files": ["lib", "src"],
  "scripts": {
    "clean": "rm -rf lib *.tsbuildinfo",
    "build": "tsc -b"
  }
}
```
For the new extension: `"name": "@sourcerer/token-gate"`, dependency only `"@theia/core": "1.74.1"`, and `"theiaExtensions": [{ "backend": "lib/node/token-gate-backend-module" }]` (backend entry point, not frontend — this extension has no browser-side code). tsconfig: reuse `theia/extensions/branding/tsconfig.json` verbatim (same compilerOptions block, no `jsx`/`dom` lib entries needed since this package has no browser code — trim `"jsx": "react"` and `"dom"` from `lib`).

---

### `theia/extensions/token-gate/src/node/token-gate-backend-module.ts` (provider, request-response)

**Analog (DI/isBound idiom):** `theia/extensions/branding/src/browser/sourcerer-frontend-module.ts:1-14` — plain `bind(X).toSelf().inSingletonScope(); bind(Interface).toService(X);` shape (no rebind needed here since nothing stock implements this exact contribution).

```ts
import { ContainerModule } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node';
import { SourcererTokenGateContribution } from './token-gate-backend-contribution';

export default new ContainerModule(bind => {
    bind(SourcererTokenGateContribution).toSelf().inSingletonScope();
    bind(BackendApplicationContribution).toService(SourcererTokenGateContribution);
});
```
(Real DI-registration precedent for how a contribution reaches `EarlyExpressMiddleware` at Theia core level: `theia/node_modules/@theia/core/lib/node/hosting/backend-hosting-module.js:31-35`.)

---

### `theia/extensions/token-gate/src/node/token-gate-backend-contribution.ts` (controller, request-response)

**Analog:** `theia/node_modules/@theia/core/lib/node/hosting/browser-connection-token.js` (`BrowserConnectionTokenBackendContribution`) — the stock contribution this one supersedes/coexists with.

**Core pattern to copy the shape of, with the critical `unshift`/no-`next()`-on-reject deviation** (verified stock behavior at `browser-connection-token.js:53-58,94-106`, and the corrected skeleton RESEARCH.md already worked out):
```js
// STOCK (browser-connection-token.js) -- what NOT to imitate for ordering:
initialize() {
    if (index_1.environment.electron.is()) { return; }
    this.earlyMiddleware.handlers.push((req, res, next) => this.expressMiddleware(req, res, next));
}
expressMiddleware(req, res, next) {
    const existing = this.getTokenFromCookie(req);
    if (!existing || !this.isTokenValid(existing)) {
        res.cookie(exports.BROWSER_TOKEN_COOKIE_NAME, this.browserConnectionToken.value, { httpOnly: true, sameSite: 'strict', path: '/' });
    }
    next(); // <-- always calls next, never rejects
}
```
```ts
// NEW (token-gate-backend-contribution.ts) -- correct shape:
@injectable()
export class SourcererTokenGateContribution implements BackendApplicationContribution {
    @inject(EarlyExpressMiddleware)
    protected readonly earlyMiddleware: EarlyExpressMiddleware;

    initialize(): void {
        // unshift, not push -- see RESEARCH.md Pattern 2: guarantees first
        // position regardless of stock contribution's own initialize() order.
        this.earlyMiddleware.handlers.unshift((req, res, next) => this.gate(req, res, next));
    }

    onStart(server: http.Server): void {
        const address = server.address();
        const port = typeof address === 'string' ? undefined : address?.port;
        // announce `port` via the file TheiaService polls (Pattern 1)
    }

    private gate(req: express.Request, res: express.Response, next: express.NextFunction): void {
        const token = this.getTokenFromCookie(req);
        if (token && this.isTokenValid(token)) { next(); return; }
        res.sendStatus(403); // no next() -- stops chain before stock middleware ever runs
    }
}
```
Also add the token-gated health route (`GET /sourcerer-health` → `{ ok: true, pid: process.pid }`, D-103/RESEARCH.md Pattern 8) inside the same contribution's `configure`/`initialize`.

**Call-site precedent for how `BackendApplication` applies `earlyMiddleware.handlers` in order** (`theia/node_modules/@theia/core/lib/node/backend-application.js:142-148`, read-only reference, confirms the array-order contract):
```js
async configure() {
    await this.initialize();
    for (const handler of this.earlyMiddleware.handlers) {
        this.app.use(handler);
    }
    ...
```

---

### `sourcerer/INTERNAL-APIS.md` (doc)

No file-format analog exists in-repo; closest structural precedent is the reason-carrying entry shape already validated by `scripts/verify-phase-03.sh`'s `check_allowlist_schema` for `sourcerer/endpoint-allowlist.json` (each entry has host/disposition/reason, or name/expect/reason) — carry the same "one row = one touchpoint + why" discipline into INTERNAL-APIS.md's file:line/purpose/threat-notes rows. Must include entries for every method on `SourcererAPI.sys.mjs`, plus D-108's line naming SessionStore (`sessionstore.jsonlz4`) as a deliberately-not-touched internal.

---

### `scripts/check-internals-boundary.sh` (test, static-analysis guard)

**Analog:** `scripts/check-patch-surface.sh` (exact structural match — this is explicitly named in D-97 as the idiom to copy)

Full shape to copy: scan function returning offense count, `--self-test` planting a violating fixture in `mktemp -d`, asserting the scan rejects it and the message names the planted path, then the "no self-test" default path running against the real target. Header comment style, `set -euo pipefail`, `REPO_ROOT` resolution, and script structure below (`scripts/check-patch-surface.sh:1-14,60-77,100-116`):
```bash
#!/usr/bin/env bash
# D-72/D-73: ... executable guard, not prose ...
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

scan_patch_surface() { ... }  # → becomes scan_internals_boundary()

run_self_test() {
  local tmp
  tmp="$(mktemp -d)"
  trap 'find "$tmp" -delete' RETURN
  cat > "$tmp/900-bad.patch" <<'EOF'
...
EOF
  if scan_patch_surface "$tmp" >/dev/null 2>"$tmp/self-test.err"; then
    echo "...FAIL -- planted ... was NOT rejected" >&2
    return 1
  fi
  if grep -q '...' "$tmp/self-test.err"; then
    echo "...PASS -- ... correctly rejected"
    return 0
  fi
  ...
}

if [ "${1:-}" = "--self-test" ]; then
  run_self_test
  exit $?
fi

scan_patch_surface "$REPO_ROOT/patches"
echo "check-patch-surface: PASS -- ..."
```
For `check-internals-boundary.sh`: scan target is `sourcerer/` (excluding `SourcererAPI.sys.mjs`), forbidden patterns are `ChromeUtils.importESModule` (outside `chrome://sourcerer/`), `Services.`, `Cc.`/`Ci.`/XPCOM constructors, `AppConstants` (D-96). Self-test plants a fixture `.sys.mjs` file containing one forbidden pattern and asserts it's caught by file:line, mirroring the compiled-suffix self-test's `nsGlobalWindowInner.cpp` assertion pattern exactly.

---

### `scripts/verify-phase-04.sh` (test, e2e aggregator)

**Analog:** `scripts/verify-phase-03.sh` (exact structural match, per RESEARCH.md's own "one verification script per phase, extended not sibling'd" convention)

Shape to copy (`scripts/verify-phase-03.sh:1-60`): `set -uo pipefail` (no `-e`, every check runs regardless), `--quick` flag dispatch, `CURRENT_CHECK_PID`/`TEMP_PATHS` tracking with a `cleanup()` trap on both `EXIT` and `INT TERM`, `setsid` wrapping for any check that backgrounds a browser process (needed here for the kill-backend-PID-and-recover check per D-103/SIDE-03), and a per-check PASS/FAIL summary table with non-zero exit on any failure. Reuse `scripts/lib/firefox-bidi.mjs`'s `withFirefoxPage`/`waitFor` (bounded poll, per 02-LEARNINGS) for SHELL-01/SHELL-05 checks; add curl/fetch pairs for SIDE-02's positive/negative token checks (assert the 403 response also carries no stock `theia-connection-token` Set-Cookie header — RESEARCH.md Pitfall 1); call the health endpoint to learn the backend PID, then kill it and poll for recovery for SIDE-03 (RESEARCH.md Pattern 8).

---

### `theia/applications/browser/package.json` (edit)

**Analog:** itself. Add one line under `dependencies`, matching the existing three `@sourcerer/*` entries' format exactly (`theia/applications/browser/package.json:9-11`):
```json
"@sourcerer/branding": "0.1.0",
"@sourcerer/customize": "0.1.0",
"@sourcerer/tab-uris": "0.1.0",
```
→ add `"@sourcerer/token-gate": "0.1.0"` to this block (Phase 2 D-23's 49-package freeze governs `@theia/*` entries only, not `@sourcerer/*`).

## Shared Patterns

### Guard-script-with-self-test idiom
**Source:** `scripts/check-patch-surface.sh` (full file)
**Apply to:** `scripts/check-internals-boundary.sh`
Every negative assertion (a forbidden pattern must be caught) ships a `--self-test` planting a violating fixture in a `mktemp -d` (never touching real repo files) and asserting the fixture IS rejected, with the failure message naming the offending path. A green run alone proves nothing without this control (D-68 idiom, D-97 explicitly cites this file).

### DI isBound-guarded bind/rebind
**Source:** `theia/extensions/branding/src/browser/sourcerer-frontend-module.ts:26-40`
**Apply to:** any `@sourcerer/token-gate` module that might rebind a stock Theia binding (not currently needed for this extension since nothing stock implements `SourcererTokenGateContribution`, but if a later iteration needs to rebind/coexist with `BrowserConnectionTokenBackendContribution`, use this guard):
```ts
if (isBound(SomeToken)) {
    rebind(SomeToken).to(SourcererImpl).inSingletonScope();
} else {
    bind(SomeToken).to(SourcererImpl).inSingletonScope();
}
```

### EarlyExpressMiddleware unshift, not push
**Source:** `theia/node_modules/@theia/core/lib/node/hosting/browser-connection-token.js:53-58` (what to avoid) + RESEARCH.md Pattern 2 (the fix)
**Apply to:** `token-gate-backend-contribution.ts` only, but record as the single most safety-critical line in the phase — `.unshift()` not `.push()`, and never call `next()` on a 403.

### One verification script per phase, extended not sibling'd
**Source:** `scripts/verify-phase-02.sh` / `scripts/verify-phase-03.sh` shape (header comment explicitly states the convention)
**Apply to:** `scripts/verify-phase-04.sh` — new file, but modeled line-for-line on 03's control-flow skeleton (trap/cleanup/setsid/CHECKS-array/summary-table), not a from-scratch script.

### Subprocess kill is one call, not hand-rolled
**Source:** `upstream/toolkit/modules/subprocess/subprocess_common.sys.mjs:670-703` (`BaseProcess.kill(timeout)`)
**Apply to:** `TheiaService.sys.mjs`'s quit-handling and restart logic — `await process.kill(graceMs)` already is the full SIGTERM→grace→SIGKILL sequence D-105 wants.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `sourcerer/shell/sourcerer.xhtml` | component | request-response | No hand-written chrome window exists in-repo yet; closest is upstream's read-only Picture-in-Picture player.xhtml (reference shape only, never modified) |
| `sourcerer/shell/SourcererAPI.sys.mjs` | utility | request-response | First anti-corruption-layer file in the tree; no prior single-file internals boundary exists to copy structurally, only individual upstream API call-shapes (cookie, Subprocess, quit observer) to wrap |
| `sourcerer/shell/TheiaService.sys.mjs` | service | event-driven | First process-supervisor file in the tree; nearest API-level precedent is upstream's own Subprocess/BaseProcess class, not an in-repo supervisor |

## Metadata

**Analog search scope:** `sourcerer/`, `patches/`, `scripts/`, `theia/extensions/{branding,customize,tab-uris}/`, `theia/node_modules/@theia/core/lib/node/hosting/`, `theia/applications/browser/`, `upstream/browser/`, `upstream/toolkit/{components/pictureinpicture,components/downloads,modules/subprocess,content}/`
**Files scanned:** ~20 (package.json x4, jar.mn x2, moz.build x2, patch x1, verify/guard scripts x2, DI modules x2, Theia core hosting sources x3, player.xhtml, browser.xhtml, Subprocess source, cookie IDLs)
**Pattern extraction date:** 2026-08-26
