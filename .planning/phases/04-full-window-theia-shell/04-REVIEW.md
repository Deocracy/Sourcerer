---
phase: 04-full-window-theia-shell
reviewed: 2026-08-26T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - patches/020-sourcerer-shell.patch
  - scripts/check-internals-boundary.sh
  - scripts/fetch-upstream.sh
  - scripts/smoke-theia.sh
  - scripts/verify-phase-02.sh
  - scripts/verify-phase-04.sh
  - sourcerer/INTERNAL-APIS.md
  - sourcerer/shell/jar.mn
  - sourcerer/shell/moz.build
  - sourcerer/shell/SourcererAPI.sys.mjs
  - sourcerer/shell/sourcerer.js
  - sourcerer/shell/sourcerer-sidecar.js
  - sourcerer/shell/sourcerer.xhtml
  - sourcerer/shell/TheiaService.sys.mjs
  - theia/applications/browser/package.json
  - theia/extensions/token-gate/package.json
  - theia/extensions/token-gate/src/node/token-gate-backend-contribution.ts
  - theia/extensions/token-gate/src/node/token-gate-backend-module.ts
  - theia/extensions/token-gate/tsconfig.json
  - theia/package.json
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-08-26T00:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Reviewed the token-gate backend extension, the Gecko chrome shell, the
`SourcererAPI.sys.mjs` anti-corruption layer, `TheiaService.sys.mjs`'s
supervisor/restart loop, and the phase's build/verification scripts.

The core security design is sound and matches what the plan asserts:
`EarlyExpressMiddleware.handlers.unshift()` (not `push()`) puts the gate
ahead of the stock `BrowserConnectionTokenBackendContribution`, the token
comparison uses `crypto.timingSafeEqual` with a length check, the token
itself is minted with `crypto.randomUUID()` and travels to the child process
only via environment variables (never argv), the loopback-bind check in
`onStart()` exits the process rather than announcing readiness on a
non-loopback address, and `check-internals-boundary.sh`'s catalogue mode
correctly re-derives `INTERNAL-APIS.md` from the guarded file rather than
trusting the doc.

One finding undermines a specific guarantee the code and its own comments
claim: the `SOURCERER_TOKEN_DISABLE` dev bypass is documented as reachable
only from the two named dev scripts, but nothing in the spawn path actually
prevents it from leaking into the supervised/production launch via
inherited process environment. Three further issues (a boundary-layer
evasion, unredacted secret-adjacent logging, and a silent-fallback path
building a bogus config directory) are quality/robustness gaps worth fixing
but are not immediately exploitable the way the first one is.

## Critical Issues

### CR-01: `SOURCERER_TOKEN_DISABLE` can leak from the launching shell into the supervised production backend

**File:** `sourcerer/shell/TheiaService.sys.mjs:149-153`, `sourcerer/shell/SourcererAPI.sys.mjs:96-104`

**Issue:** `SourcererAPI.spawnProcess` calls `Subprocess.call({ ..., environmentAppend: true })`,
which — per the method's own doc comment — "merges `environment` onto the
parent process's own environment (PATH, HOME, ...) rather than replacing it
outright." `TheiaService._spawnAndGate()` builds that `environment` object
with exactly three keys: `SOURCERER_TOKEN`, `THEIA_CONFIG_DIR`,
`VSX_REGISTRY_URL`. It never sets or clears `SOURCERER_TOKEN_DISABLE`.

`token-gate-backend-contribution.ts`'s comment asserts: "The supervised
Sourcerer path never sets this -- it is a deliberately-typed name, not an
omission, so an unconfigured token never silently passes through." That is
true only in the narrow sense that TheiaService never *sets* the variable
to `1` itself. It says nothing about *unsetting* it, and with
`environmentAppend: true` it doesn't need to — any `SOURCERER_TOKEN_DISABLE=1`
already present in the Firefox process's own environment (inherited from
whatever shell launched it) passes straight through to the spawned Node
backend unchanged.

Both `scripts/smoke-theia.sh` and `scripts/verify-phase-02.sh` `export`
(via `env SOURCERER_TOKEN_DISABLE=1 ...`) this exact variable as their
documented workflow. A developer who runs either script and then, in the
same shell session, launches the real `objdir/dist/bin/sourcerer` binary
(or any script/CI job that doesn't scope the variable to a subshell) gets a
"supervised" backend with the token gate silently disabled — full
unauthenticated local access to arbitrary file access and the terminal
(the exact surface `INTERNAL-APIS.md`'s process-spawn row calls out). This
is precisely the failure mode the review brief asked to be verified as
unreachable, and it is reachable.

**Fix:** Explicitly clear the bypass flag in the environment object handed
to `spawnProcess`, so an inherited value can never survive the merge:

```js
// sourcerer/shell/TheiaService.sys.mjs, in _spawnAndGate()
const environment = {
  SOURCERER_TOKEN: this._token,
  // Explicit override: never let a dev-only bypass survive from the
  // launching shell's own environment into the supervised path.
  SOURCERER_TOKEN_DISABLE: "",
  THEIA_CONFIG_DIR: this._configDir,
  VSX_REGISTRY_URL: "https://open-vsx.org",
};
```

(`token-gate-backend-contribution.ts`'s check is `=== '1'`, so an empty
string correctly still evaluates as "not disabled" — no change needed
there.)

## Warnings

### WR-01: `sourcerer.js` reaches a Firefox-privileged API outside `SourcererAPI.sys.mjs`, evading the boundary guard

**File:** `sourcerer/shell/sourcerer.js:33-39`

**Issue:** `SourcererAPI.sys.mjs` is documented (D-96/D-97, and CLAUDE.md's
hard rule) as "the ONLY file in `sourcerer/` permitted to reach a Firefox
internal," enforced by `scripts/check-internals-boundary.sh` and catalogued
in `sourcerer/INTERNAL-APIS.md`. `sourcerer.js`'s `sourcererSwapToUrl`
reads `document.nodePrincipal` (the chrome document's system principal)
directly and passes it as `triggeringPrincipal` to
`browserElement.fixupAndLoadURIString`. The code comment even says this is
done specifically to *avoid* `Services`/`Cc`/`Ci`, "which
scripts/check-internals-boundary.sh forbids outside SourcererAPI.sys.mjs" —
i.e. the boundary is being routed around, not through. `nodePrincipal` and
`fixupAndLoadURIString` are not in `check-internals-boundary.sh`'s
`FORBIDDEN_PATTERNS`, so the guard script passes this file silently, and
there is no `INTERNAL-APIS.md` row for it (that document's own
`--catalogue` check only ever scans `SourcererAPI.sys.mjs`, so it cannot
catch a touchpoint that lives somewhere else). The URL passed is always the
fixed local backend URL, so exploitability here is low, but it is a real
gap in the "one audit surface" property the anti-corruption layer exists
to guarantee — a future edit to this function has no automated check
stopping it from doing something riskier with that same principal.

**Fix:** Move the principal-elevated navigation into `SourcererAPI.sys.mjs`
as a named method (e.g. `loadUrlAsSystem(browserElement, url)`), call it
from `sourcerer.js`, and add its row to `INTERNAL-APIS.md`. If
`nodePrincipal`/`fixupAndLoadURIString` are judged out of scope for the
boundary rule, say so explicitly in `INTERNAL-APIS.md`'s "Deliberately not
touched" table rather than leaving the gap implicit.

### WR-02: Backend stdout/stderr is mirrored into the log ring buffer and console with no secret redaction

**File:** `sourcerer/shell/TheiaService.sys.mjs:336-360` (`_pumpOutput`/`handleLine`), `:438-444` (`_pushLog`)

**Issue:** Every line the spawned backend writes to stdout or stderr is
pushed verbatim into `_log` (exposed via `getRecentLog()`, which Phase 5's
diagnostics page reads) and mirrored to the browser console via
`SourcererAPI.log("log", line)`. There is no filtering step. `SOURCERER_TOKEN`
never appears in this codebase's own log lines today, but nothing prevents
a future Theia/Express change (a verbose error handler dumping request
headers, an uncaught exception stack trace including environment) from
writing the token into stdout/stderr, at which point it lands unredacted in
a buffer explicitly designed to be readable from a diagnostics UI.

**Fix:** Scrub known-secret values before buffering/logging, e.g. in
`handleLine`:

```js
const redact = line => this._token ? line.split(this._token).join('[REDACTED]') : line;
```

applied before both `this._pushLog(line)` and `SourcererAPI.log("log", line)`.

### WR-03: Missing `HOME`/`XDG_CONFIG_HOME` silently produces a bogus config directory instead of failing loudly

**File:** `sourcerer/shell/TheiaService.sys.mjs:132-137`

**Issue:** `_resolveConfigDir()` does:

```js
const xdg = SourcererAPI.getEnv("XDG_CONFIG_HOME");
const home = SourcererAPI.getEnv("HOME");
const base = xdg || `${home}/.config`;
return `${base}/sourcerer`;
```

If both `XDG_CONFIG_HOME` and `HOME` are unset (uncommon but not
impossible — a stripped-down launch environment, systemd unit without
`HOME` forwarded, etc.), `home` is `undefined` and `base` becomes the
literal string `"undefined/.config"`. `start()` then calls
`SourcererAPI.ensureDirectory(this._configDir)`, which will create a
directory literally named `undefined` relative to cwd — a confusing silent
misconfiguration rather than the fail-loud behavior this file uses
everywhere else (`_resolveSidecar()` calls `this._fatal(...)` and returns
`false` for an unresolvable Node binary; this path has no equivalent
guard).

**Fix:** Treat an unresolvable base the same way as an unresolvable Node
path:

```js
_resolveConfigDir() {
  const xdg = SourcererAPI.getEnv("XDG_CONFIG_HOME");
  const home = SourcererAPI.getEnv("HOME");
  const base = xdg || (home && `${home}/.config`);
  if (!base) {
    this._fatal("Neither XDG_CONFIG_HOME nor HOME is set -- cannot resolve a config directory.");
    return null;
  }
  return `${base}/sourcerer`;
}
```

and have `start()` bail out when it gets `null`, mirroring the
`_resolveSidecar()` failure path.

## Info

### IN-01: Cookie-parsing and constant-time token comparison logic is duplicated between the stock and Sourcerer contributions

**File:** `theia/extensions/token-gate/src/node/token-gate-backend-contribution.ts:124-152`

**Issue:** `getTokenFromCookie`/`isTokenValid` in this file hand-roll the
same cookie-splitting and `timingSafeEqual`-with-length-check pattern that
`@theia/core`'s `BrowserConnectionTokenBackendContribution` (in
`browser-connection-token.ts`) already implements using the `cookie`
package. Functionally equivalent and both are correct, but two independent
implementations of security-sensitive parsing/comparison logic now have to
be kept in sync by hand across an upstream re-pin.

**Fix:** Not urgent, but worth a follow-up: depend on the same `cookie`
package (`@theia/core` already pulls it in transitively) for parsing, or
factor the length-check-then-`timingSafeEqual` pattern into a tiny shared
helper if `@sourcerer/*` extensions end up needing it more than once.

---

_Reviewed: 2026-08-26T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
