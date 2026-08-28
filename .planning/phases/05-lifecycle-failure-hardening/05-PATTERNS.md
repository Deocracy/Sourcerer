# Phase 5: Lifecycle & Failure Hardening - Pattern Map

**Mapped:** 2026-08-27
**Files analyzed:** 12 (new + modified)
**Analogs found:** 12 / 12 (all in-repo; no external analog needed)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `sourcerer/shell/components.conf` (NEW) | config (XPCOM manifest) | event-driven (command-line dispatch) | `upstream/browser/components/taskbartabs/components.conf` | exact |
| `sourcerer/shell/moz.build` (EDIT: add `XPCOM_MANIFESTS`) | config | build-graph wiring | `upstream/browser/components/taskbartabs/moz.build` | exact |
| `sourcerer/shell/SourcererAPI.sys.mjs` (EDIT: add methods) | service (anti-corruption layer) | request-response / CRUD (file, process, window) | itself (existing file, extend in place) | exact |
| `sourcerer/shell/TheiaService.sys.mjs` (EDIT: idempotent `start()`, give-up classification, state-file I/O, leftover reap) | service (supervisor/state machine) | event-driven | itself (existing file, extend in place) | exact |
| `sourcerer/shell/sourcerer.js` (EDIT: reserved `<key>`, `sourcererShowError`/`sourcererRetry`/`sourcererShowDiagnostics` globals) | controller (chrome bootstrap) | event-driven | itself (existing file, extend in place) | exact |
| `sourcerer/shell/sourcerer.xhtml` (EDIT: two new deck layers) | component (chrome markup) | request-response (static paint) | itself — the existing `#sourcerer-loading` layer is the template for the new `#sourcerer-error`/`#sourcerer-diagnostics` layers | exact |
| `sourcerer/shell/sourcerer.css` (EDIT: styling for new layers) | component (stylesheet) | — | itself — `#sourcerer-loading` rule block is the template | exact |
| `sourcerer/shell/jar.mn` (EDIT: no new entries needed unless components.conf needs packaging — verify) | config | — | itself | exact |
| `theia/extensions/token-gate/src/node/*-backend-contribution.ts` (EDIT) or new sibling `theia/extensions/<watchdog>/src/node/*-backend-contribution.ts` (NEW) | service (backend contribution) | event-driven (stdin stream) | `theia/extensions/token-gate/src/node/token-gate-backend-contribution.ts` | exact |
| `theia/extensions/<watchdog>/src/node/*-backend-module.ts` (NEW, only if sibling package chosen) | provider (DI binding) | — | `theia/extensions/token-gate/src/node/token-gate-backend-module.ts` | exact |
| `scripts/verify-phase-05.sh` (NEW) | test (verification aggregator) | batch | `scripts/verify-phase-04.sh` | exact |
| `scripts/verify-branding-identity.mjs` (EDIT: repoint about-support surface at D-119 diagnostics fields) | test/utility | request-response | itself (existing file, edit in place) | exact |
| `sourcerer/INTERNAL-APIS.md` (EDIT: new touchpoint rows) | doc/catalogue | — | itself (existing file, append rows) | exact |

## Pattern Assignments

### `sourcerer/shell/components.conf` (NEW)

**Analog:** `upstream/browser/components/taskbartabs/components.conf`

**Full pattern to copy** (verbatim shape, adjust names):
```python
Classes = [
    {
        "cid": "{<generate-a-fresh-uuid>}",
        "contract_ids": ["@sourcerer.dev/single-instance-clh;1"],
        "esModule": "chrome://sourcerer/content/SourcererAPI.sys.mjs",
        "constructor": "SourcererSingleInstanceHandler",
        "categories": {"command-line-handler": "a-sourcerer"},
    },
]
```
Note the entry-name prefix `a-sourcerer` (must sort before `m-browser` via
`strcmp` ascending — see RESEARCH.md Pattern 1) and that `esModule` here is
`chrome://` not `resource://` (taskbartabs uses `resource:///modules/...`;
sourcerer's own module loader already resolves `chrome://sourcerer/content/`
per `sourcerer.js:22` and `jar.mn`).

**Boundary constraint:** the constructor (`SourcererSingleInstanceHandler`)
MUST be exported from `SourcererAPI.sys.mjs` itself — it needs
`ChromeUtils.generateQI` and `Ci.nsICommandLine.*` constants, both
`Ci.`-pattern touches forbidden everywhere under `sourcerer/shell/` except
`SourcererAPI.sys.mjs` (`scripts/check-internals-boundary.sh:28-45`). Do not
create a new sibling `.sys.mjs` file for it.

---

### `sourcerer/shell/moz.build` (EDIT)

**Analog:** `upstream/browser/components/taskbartabs/moz.build`

**Pattern to copy** (add this stanza; current file already has
`JAR_MANIFESTS += ["jar.mn"]` and `JS_PREFERENCE_PP_FILES`):
```python
XPCOM_MANIFESTS += [
    "components.conf",
]
```

---

### `sourcerer/shell/SourcererAPI.sys.mjs` (EDIT — extend in place)

**Analog:** itself. Every existing method is a thin named wrapper around
exactly one Firefox internal, frozen into `Object.freeze({...})`, documented
with a comment block explaining *why* the internal is needed and any
threat/footgun note. New methods must follow this exact shape.

**Imports pattern** (lines 14-22 — module-level lazy getters, add `IOUtils`
consumers need no import, it's a global; `ctypes` needs a new lazy getter):
```javascript
const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  Subprocess: "resource://gre/modules/Subprocess.sys.mjs",
  // NEW: ctypes: "resource://gre/modules/ctypes.sys.mjs",
});
```

**Method shape to copy** (`getStringPref`, lines 29-35 — never-throw wrapper
returning a fallback):
```javascript
getStringPref(name, fallback) {
  try {
    return Services.prefs.getStringPref(name, fallback);
  } catch {
    return fallback;
  }
},
```

**Bare-pid kill(2) via js-ctypes** (RESEARCH.md Pattern 2, new method,
follow this shape exactly — Linux-only per CLAUDE.md, no cross-platform
branch needed):
```javascript
killBarePid(pid, signal) {
  const libc = lazy.ctypes.open("libc.so.6");
  try {
    const kill = libc.declare(
      "kill", lazy.ctypes.default_abi, lazy.ctypes.int, lazy.ctypes.int, lazy.ctypes.int
    );
    return kill(pid, signal) === 0;
  } finally {
    libc.close();
  }
},
```

**`/proc/<pid>/stat` identity read** (RESEARCH.md Pattern 2 — new method;
copy the last-`)`-search exactly, do not naive-split on space, see Common
Pitfall 2 in RESEARCH.md):
```javascript
async readStartTimeTicks(pid) {
  const text = await IOUtils.readUTF8(`/proc/${pid}/stat`);
  const afterComm = text.slice(text.lastIndexOf(")") + 2);
  return afterComm.split(" ")[19]; // field 22 overall
},
```

**Atomic state-file write/read/remove** (RESEARCH.md Pattern 4, new
methods, mirrors the existing `ensureDirectory` one-liner-over-platform-API
shape at line 55-57):
```javascript
writeStateFile(path, value) {
  return IOUtils.writeJSON(path, value, { tmpPath: `${path}.tmp` });
},
readStateFile(path) {
  return IOUtils.readJSON(path); // caller catches NotFoundError
},
removeStateFile(path) {
  return IOUtils.remove(path); // ignoreAbsent defaults true
},
```

**Window lookup + focus for D-122** (new method, same directness as
`onQuitGranted` at lines 227-231):
```javascript
findExistingWindow() {
  return Services.wm.getMostRecentWindow("sourcerer:main");
},
focusWindow(win) {
  win.focus();
},
```

**App identity read for D-119** (new method — read from `Services.appinfo`
or `AppConstants`-equivalent already-privileged surface; follow the
never-throw-wrapper convention of `getStringPref` above).

**Existing methods to reuse unchanged:** `killProcess(proc, graceMs)`
(line 142-144) remains the correct call for the already-spawned handle
(`_proc`) — do NOT reuse it for the D-111 bare-pid case; that pid has no
`Process` object, which is exactly why `killBarePid` above is new.

**Error handling pattern across the whole file:** every wrapper either (a)
never throws and returns a safe fallback (`getStringPref`, `getIntPref`,
`pathSearch`), or (b) throws loudly with a descriptive message on a
platform-reported rejection (`setSessionCookie`'s `validation.result` check,
lines 112-116). New methods should pick (a) for read/probe operations and
(b) for a mutating operation whose silent failure would hide a real bug —
follow `setSessionCookie`'s "fail loudly instead" comment as the house
style.

---

### `sourcerer/shell/TheiaService.sys.mjs` (EDIT — extend in place)

**Analog:** itself.

**Idempotent `start()` pattern (D-121's second layer)** — copy the early-return
guard shape already used by `stop()` at lines 82-86:
```javascript
async stop() {
  if (this._shuttingDown) {
    return;
  }
  this._shuttingDown = true;
  ...
```
Apply the identical shape to `start()` (currently lines 56-73, no guard):
add a `this._started` flag, check-and-return at the top, exactly as `stop()`
checks `this._shuttingDown`.

**Give-up classification (D-113) — core pattern to extend**, `_spawnAndGate`
currently returns bare `false` on every failure path (lines 168-169,
189-191, 194-196, 205-207) and `_fatal()` (lines 435-438) only logs. Change
the return shape to `{ ok: false, recoverable: boolean }` at each of those
four sites, matching which of D-113's named unrecoverable classes each site
is (see RESEARCH.md Pattern 5, item 1, for the exact site-to-class mapping).

**Bounded retry budget — extend `_restart()`'s existing `for (;;)` loop**
(lines 287-305). The loop already has an backoff-cap pattern
(`RESTART_BACKOFF_INITIAL_MS`/`RESTART_BACKOFF_CAP_MS`, lines 23-24,
282-304) to copy verbatim for the new give-up constants:
```javascript
const RESTART_BACKOFF_INITIAL_MS = 500;
const RESTART_BACKOFF_CAP_MS = 5000;
const CONSECUTIVE_FAILURES_THRESHOLD = 2;
// NEW, same neighbourhood:
const GIVE_UP_ATTEMPT_CAP = 6;      // planner's discretion, record reasoning
const GIVE_UP_WALLCLOCK_MS = 30000; // planner's discretion, record reasoning
```
Add an attempt counter and a `Date.now()`-based deadline check inside the
loop, breaking out to a give-up path instead of looping forever — mirror
how the loop already tracks `backoffMs` as loop-local state.

**Chrome-facing signal on give-up (D-114/D-116)** — copy the existing
`_swap()` precedent exactly (lines 427-433):
```javascript
_swap() {
  if (this._swapped) {
    return;
  }
  this._swapped = true;
  this._browserElement.ownerDocument.defaultView.sourcererSwapToUrl(`http://127.0.0.1:${this._port}/`);
},
```
New sibling method `_showError(reason)` should call
`this._browserElement.ownerDocument.defaultView.sourcererShowError(reason)`
the same way — never touch `_browserElement.src`/`fixupAndLoadURIString`
(D-114's explicit constraint).

**State-file write hook** — add inside `_spawnAndGate()` right after the
existing cookie-set + `_swap()` block (lines 211-226, the `if (firstSpawn)`
branch) and also on every successful respawn: call
`SourcererAPI.writeStateFile(this._stateFilePath, { pid: this._pid, port: this._port, startTime })`.
Use the existing `_configDir` field (line 37, already resolved in `start()`
at line 64) to build the path — no new directory-resolution logic needed.

**Startup leftover reap** — new method called from `start()` before the
first `_spawnAndGate` call (i.e., inserted between lines 65 and 72), reading
via `SourcererAPI.readStateFile`, checking liveness + `readStartTimeTicks`
identity (per D-111/Pattern 2), and calling `SourcererAPI.killBarePid` only
on a verified match — never signal an unverified/recycled pid (D-111).

**Error handling / logging convention to reuse:** `_fatal()` (lines
435-438) and `_pushLog()` (lines 447-453) are the two logging primitives
every new code path should call — do not invent a third logging path.

---

### `sourcerer/shell/sourcerer.js` (EDIT — extend in place)

**Analog:** itself. The existing `sourcererSwapToUrl`/`sourcererGetBrowser`
globals (lines 42-50) are the exact template for the three new globals.

**Core pattern to copy:**
```javascript
window.sourcererShowError = function sourcererShowError(reason) {
  document.getElementById("sourcerer-error").style.display = "flex";
  // populate reason text, wire Retry button to sourcererRetry()
};
window.sourcererRetry = function sourcererRetry() {
  document.getElementById("sourcerer-error").style.display = "none";
  TheiaService.retry(); // new TheiaService method, mirrors .start()'s shape
};
window.sourcererShowDiagnostics = function sourcererShowDiagnostics() {
  const state = TheiaService.getState();
  const log = TheiaService.getRecentLog();
  // render into #sourcerer-diagnostics, toggle display
};
```

**Reserved keyboard shortcut (D-118)** — RESEARCH.md Pattern 6 gives the
exact shape (XUL `<keyset>`/`<key reserved="true">`, not a raw
`addEventListener('keydown')`):
```javascript
const keyset = document.createXULElement("keyset");
const key = document.createXULElement("key");
key.setAttribute("id", "sourcerer-diagnostics-key");
key.setAttribute("modifiers", "accel,alt,shift");
key.setAttribute("key", "D"); // confirm free on target keymap
key.setAttribute("reserved", "true");
key.addEventListener("command", () => sourcererShowDiagnostics());
keyset.appendChild(key);
document.documentElement.appendChild(keyset);
```
Place this inside the existing `DOMContentLoaded` handler (lines 17-70),
after the `TheiaService.start(browserElement)` call at line 67, following
the file's existing single-listener structure — do not add a second
`DOMContentLoaded` listener.

---

### `sourcerer/shell/sourcerer.xhtml` (EDIT — extend in place)

**Analog:** itself — `#sourcerer-loading` (line 35) is the template for two
new sibling `<div>`s in the same `<body>`, joining D-94's existing deck:
```xml
<div id="sourcerer-loading">Sourcerer</div>
<div id="sourcerer-error">
  <!-- branded message, Retry button, diagnostics-route link/button -->
</div>
<div id="sourcerer-diagnostics">
  <!-- port, pid, health, restart count, recent log, app identity -->
</div>
<xul:browser id="sourcerer-content" .../>
```
Keep the `<xul:browser>` element as the last sibling, unchanged (D-114: the
new layers paint *over* it via CSS z-index, never replace it).

> **CORRECTED 2026-08-28.** This snippet originally carried
> `style="display:none;"` on both new `<div>`s, and 05-02/05-03 followed it
> verbatim. That is a defect, not a template: this document's own CSP
> (`default-src chrome:`, no `style-src`, no `'unsafe-inline'`) drops inline
> style **attributes** as well as inline `<style>` elements, so the attribute
> is inert and the `display: flex` base rule in `sourcerer.css` wins — both
> overlays paint over Theia from startup. **Hide a deck layer with
> `display: none` in its `sourcerer.css` base rule, and show/hide it from JS
> via the CSSOM.** Read visibility with
> `window.getComputedStyle(el).display`, never `el.style.display`, which
> returns `""` for a stylesheet-driven default. Enforced by
> `verify-phase-05.sh`'s `shell-csp-inline-attrs` check. See
> `.planning/WINDOWS.md` entry 8.

---

### `sourcerer/shell/sourcerer.css` (EDIT — extend in place)

**Analog:** itself — `#sourcerer-loading` rule block (lines 25-36) is the
exact template: `position: fixed; inset: 0; z-index: 1;` over the
`#sourcerer-content` browser at `z-index: 0` (lines 38-46). New layers copy
the same `position:fixed; inset:0;` shape with a z-index at or above 1 so
they paint over the loading layer too when relevant, same color family
(`#1a1a1a` background / `#e8e8e8` text), same `font-family: sans-serif`.
Remember the file-level CSP constraint documented at the top of the file
(no inline `<style>`, everything must live in this chrome: stylesheet).

---

### `theia/extensions/token-gate/src/node/*-backend-contribution.ts` (EDIT or NEW sibling)

**Analog:** `theia/extensions/token-gate/src/node/token-gate-backend-contribution.ts`

**Imports pattern** (lines 1-6):
```typescript
import { injectable, inject } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node';
```
(drop the `express`/`http`/`crypto` imports the watchdog doesn't need).

**Core pattern — `initialize()` hook, same lifecycle stage token-gate uses**
(lines 29-42 structure), copied per RESEARCH.md Pattern 3:
```typescript
@injectable()
export class SourcererStdinWatchdogContribution implements BackendApplicationContribution {
    initialize(): void {
        process.stdin.resume();
        process.stdin.on('end', () => {
            process.kill(process.pid, 'SIGTERM');
        });
        process.stdin.on('error', () => {
            process.kill(process.pid, 'SIGTERM');
        });
    }
}
```
**Why `initialize()` and not `onStart()`:** token-gate's own comment (lines
49-51) explains `initialize()` is the earliest `BackendApplicationContribution`
hook, invoked before the HTTP server binds — matches D-109's requirement
that the watchdog be armed as early as possible, though the exact hook
timing is less critical here since stdin doesn't depend on the HTTP bind.

**Error handling pattern to reuse:** token-gate's fail-loud
`process.stderr.write(...); process.exit(78);` shape (lines 52-56, 80-84,
92-97) is the house convention for an unrecoverable backend-side condition
— not applicable to the watchdog itself (which has nothing to fail at
startup) but follow it if any new validation is added.

**Decision point flagged by RESEARCH.md (Claude's Discretion, unresolved):**
extend `token-gate-backend-contribution.ts` in place (add the stdin logic to
the existing class) vs. a new sibling `@sourcerer/*` package with its own
`*-backend-module.ts`. If a new sibling package, copy
`token-gate-backend-module.ts` verbatim as the DI-binding template:
```typescript
import { ContainerModule } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node';
import { SourcererStdinWatchdogContribution } from './stdin-watchdog-backend-contribution';

export default new ContainerModule(bind => {
    bind(SourcererStdinWatchdogContribution).toSelf().inSingletonScope();
    bind(BackendApplicationContribution).toService(SourcererStdinWatchdogContribution);
});
```
and register the new package in `theia/applications/browser/package.json`
the same way `token-gate` is already registered there.

---

### `scripts/verify-phase-05.sh` (NEW)

**Analog:** `scripts/verify-phase-04.sh`

**Structural pattern to copy wholesale** (this is the established
one-script-per-phase idiom, D-127):
- Header comment block explaining scope, `--quick` semantics, and
  "extended never siblinged" (lines 1-24 of `verify-phase-04.sh`).
- `set -uo pipefail` (deliberately no `-e` — line 24).
- `--quick` arg parsing loop (lines 28-36).
- `track_temp`/`cleanup`/trap scaffolding using `setsid` process groups for
  every spawned check (lines 38-60+) — copy verbatim, this is exactly what
  D-125's SIGKILL-and-assert-no-descendant check needs.
- `start_shell()`/`stop_shell()` pair (lines ~300-320) — **but per
  RESEARCH.md Pitfall 1, verify-phase-05.sh needs a second, non-headless
  variant of `start_shell()` for the SIDE-05 check specifically** (drop
  `--headless`, use a real/Xvfb `DISPLAY`). Keep the existing headless
  variant for every other check that doesn't need real remoting.
- `first_byte_offset()` / pid-sentinel-parsing helpers (lines ~330-360) —
  reusable unchanged for reading `BROWSER_LOG` sentinels in the new checks.
- CHECKS array + PASS/FAIL summary table pattern at the bottom of the file
  (not read this session, but named explicitly in the header comment as the
  file's own closing convention — follow it).

**D-125's positive-control pattern to copy:** `02-LEARNINGS.md`'s rule
("every negative assertion ships a positive control") plus
`scripts/check-patch-surface.sh`'s `--self-test` idiom (D-68) — plant a
synthetic `sleep &` process, write a matching state file via the same
format `TheiaService` writes, run startup cleanup, assert it WAS reaped.
Pair with a negative control: a state file whose recorded start-time
mismatches the live process, asserting it is NOT signalled.

---

### `scripts/verify-branding-identity.mjs` (EDIT — repoint, D-120)

**Analog:** itself (existing file, 505 lines). Locate its current
about-support-reading section and repoint it to read the same fields off
the new diagnostics layer instead (D-119's brand/vendor/version fields,
exposed via `TheiaService.getState()` plus the new identity accessor on
`SourcererAPI`). Read the specific about-support section with
`offset`/`limit` before editing — do not reread the whole 505-line file if
only one section needs surgery.

---

### `sourcerer/INTERNAL-APIS.md` (EDIT — append rows)

**Analog:** itself — the existing table format (one row per touchpoint,
columns `Internal | File:Line | SourcererAPI Method | Purpose | Threat
Notes`) is mandatory: `check-internals-boundary.sh --catalogue` fails on any
uncatalogued occurrence. Every new `Ci.`/`Cc[`/`Services.`/ctypes touch
added to `SourcererAPI.sys.mjs` in this phase (js-ctypes `kill`, IOUtils
state-file calls if they use a forbidden pattern, `Services.wm`,
`ChromeUtils.generateQI`, `Ci.nsICommandLine.*`) needs one new row here,
following the existing rows' voice (a plain-language purpose line plus a
named "row" threat-note paragraph where risk exists, e.g. "Bare-pid-kill
row: ...").

## Shared Patterns

### Anti-corruption boundary (D-96/D-97)
**Source:** `sourcerer/shell/SourcererAPI.sys.mjs` (whole file) +
`scripts/check-internals-boundary.sh` + `sourcerer/INTERNAL-APIS.md`
**Apply to:** every new Firefox-internals touch across this phase (window
lookup, command-line handler, bare-pid kill, state-file I/O, app-identity
read). No exceptions — this is the single hard architectural rule the
whole phase must respect.

### Never-throw read wrapper vs. fail-loud mutation
**Source:** `SourcererAPI.sys.mjs` — `getStringPref` (never-throw) vs.
`setSessionCookie` (fail-loud on rejection, lines 112-116)
**Apply to:** every new `SourcererAPI` method — decide per-method which
convention it needs and follow the existing precedent's shape exactly, not
a third pattern.

### Ring-buffer logging via `_pushLog`/`_fatal`
**Source:** `TheiaService.sys.mjs:435-453`
**Apply to:** every new TheiaService code path (give-up, state-file writes,
leftover reap) — no new logging mechanism, everything funnels through
these two existing methods so `getRecentLog()` stays the single source of
truth SHELL-04 reads.

### Deck-layer pattern (D-94, now used a 2nd and 3rd time)
**Source:** `sourcerer.xhtml` `#sourcerer-loading` + `sourcerer.css`'s
matching rule block + `sourcerer.js`'s `sourcererSwapToUrl` global
**Apply to:** the new error layer (SHELL-03) and diagnostics layer
(SHELL-04) — same `position:fixed;inset:0;z-index` stacking shape, same
color/font family, same "one JS-exposed `window.sourcererX` function toggles
its `display`" wiring convention.

### One verification script per phase, extended never siblinged
**Source:** `scripts/verify-phase-04.sh`'s own header comment (D-127
explicit rule)
**Apply to:** `scripts/verify-phase-05.sh` — mirror the structure, don't
invent a new shape.

### Guard-script-with-self-test / positive-control idiom
**Source:** `scripts/check-patch-surface.sh` (D-68) +
`02-LEARNINGS.md`'s "every negative assertion ships a positive control"
**Apply to:** `verify-phase-05.sh`'s SIDE-04 orphan-reap checks (D-125).

## No Analog Found

None — every file this phase touches has a direct, exact in-repo or
in-upstream-tree analog (see table above). This is expected: RESEARCH.md's
own conclusion is that "every mechanism this phase needs already exists
somewhere in the ESR-153 tree Sourcerer forks."

## Metadata

**Analog search scope:** `sourcerer/shell/`, `theia/extensions/token-gate/`,
`scripts/`, `upstream/browser/components/taskbartabs/` (cited directly by
RESEARCH.md as the components.conf template), `sourcerer/INTERNAL-APIS.md`
**Files scanned:** 12 read in full (all ≤ 505 lines, single-pass reads, no
re-reads) plus targeted greps/head reads of `jar.mn`, `moz.build`,
`components.conf`, `verify-phase-04.sh` header and helper sections
**Pattern extraction date:** 2026-08-27
