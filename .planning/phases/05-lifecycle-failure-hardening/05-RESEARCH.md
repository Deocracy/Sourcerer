# Phase 5: Lifecycle & Failure Hardening - Research

**Researched:** 2026-08-27
**Domain:** Firefox chrome-JS process lifecycle (XPCOM command-line handlers, js-ctypes signalling, IOUtils atomic file writes) + Theia Node.js backend lifecycle (stdin-EOF watchdog)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

CONTEXT.md for this phase is exceptionally complete: D-109 through D-127 are
locked decisions, most already verified against upstream `file:line`
references during discussion. This research does not re-litigate any of
them — it closes the six items CONTEXT.md explicitly hands to the
researcher (see `<specifics>` below) and reports what changes as a result.

### Locked Decisions (verbatim from 05-CONTEXT.md `<decisions>`)

**Orphan kill and leftover cleanup (SIDE-04)**
- **D-109:** stdin-EOF watchdog on the backend (child) side — `Subprocess`
  creates stdin as a pipe unconditionally on unix
  (`upstream/toolkit/modules/subprocess/subprocess_unix.worker.js:361`).
  Lives in a backend-side `@sourcerer/*` contribution, not Theia core.
- **D-110:** first persistence — a sidecar state file (pid, port, start
  time) under `THEIA_CONFIG_DIR`, amending D-107. Directory already exists
  (`TheiaService._resolveConfigDir()`, `sourcerer/shell/TheiaService.sys.mjs:132-137`).
- **D-111:** startup cleanup only kills a verified-ours pid (alive AND
  identity matches recorded start time or health path) — never a stale pid
  the OS recycled.
- **D-112:** stolen pinned port during the restart gap is unrecoverable →
  SHELL-03 error state, not silent recovery.

**Give-up threshold and error state (SHELL-03)**
- **D-113:** split give-up rule — unrecoverable classes (`_fatal()`'s
  existing call sites: `backendMain` unset, Node unresolvable, spawn
  failure, D-112's stolen port) give up immediately; everything else gets a
  bounded retry budget (attempt count and/or wall-clock ceiling).
- **D-114:** error layer paints over `<browser>` without navigating or
  destroying the page — Theia's own reconnect (status-bar item +
  `theia-mod-offline` body class,
  `theia/node_modules/@theia/core/lib/browser/connection-status-service.js:183-188`)
  retries indefinitely and keeps running behind it. Revises D-95.
- **D-115:** retry resets backoff and respawns on the pinned port; a slow
  background probe auto-dismisses the error layer if the backend
  self-heals.
- **D-116:** error state = branded plain-language message + Retry button +
  route into diagnostics. No inline log dump (SHELL-04 owns detail).

**Diagnostics surface (SHELL-04) and WINDOWS #6**
- **D-117:** third chrome-rendered layer in `sourcerer.xhtml`'s existing
  deck, reading `TheiaService.getState()`/`getRecentLog()` directly in
  chrome. Alive by construction when the backend is down. Both accessors
  already exist (`sourcerer/shell/TheiaService.sys.mjs:100-113`).
- **D-118:** two entry points — a chrome-level keyboard shortcut in
  `sourcerer.js` (Ctrl+Alt+Shift range, not claimed by Theia) and a route
  from the SHELL-03 error state. Not chosen: a `--diagnostics` CLI flag.
- **D-119:** diagnostics layer also carries app identity (brand, vendor,
  version) read chrome-side.
- **D-120:** WINDOWS #6 resolved by repointing `verify-branding-identity.mjs`'s
  about-support surface at D-119's diagnostics layer, not waiving it.

**Single-instance behaviour (SIDE-05)**
- **D-121:** guard at both layers — (1) a command-line handler intercept so
  a second launch focuses the existing window and prevents the default
  open; (2) `TheiaService.start()` becomes idempotent. Verified failure
  mode today: `BrowserContentHandler.handle()` → `openBrowserWindow()` →
  `BrowserWindowTracker.openWindow()`
  (`upstream/browser/components/BrowserContentHandler.sys.mjs:398`) opens a
  *new* window whose `sourcerer.js` re-calls unguarded `TheiaService.start()`.
- **D-122:** existing window found via
  `Services.wm.getMostRecentWindow("sourcerer:main")` —
  `sourcerer.xhtml` already declares that `windowtype`
  (`sourcerer/shell/sourcerer.xhtml:21`).
- **D-123:** a second shell window is never opened — a second launch always
  focuses the one existing window.
- **D-124:** a second launch ignores its command-line arguments and just
  focuses. Forwarding paths deferred to the post-4.0 bridge.

**Verification shape**
- **D-125:** SIDE-04 proven automated, both directions — SIGKILL +
  assert-no-descendant, paired with a positive control that plants a fake
  leftover (a sleeping process recorded in the state file) and asserts
  startup cleanup reaps it.
- **D-126:** criterion 5 ("a working period") is one full working day,
  human-recorded in `05-MANUAL-VERIFICATION.md`.
- **D-127:** one new `scripts/verify-phase-05.sh`; the final phase gate
  reruns `verify-phase-03.sh` and `verify-phase-04.sh` too.

### Claude's Discretion (verbatim from 05-CONTEXT.md)

- Exact give-up constants: retry-attempt cap and/or wall-clock ceiling
  (D-113), background auto-recovery probe interval (D-115). Neighbours:
  `RESTART_BACKOFF_INITIAL_MS` 500 → cap 5000, `CONSECUTIVE_FAILURES_THRESHOLD` 2.
- Exact keyboard chord for D-118, not colliding with anything Theia claims.
- Markup, layout, refresh cadence of the D-117 diagnostics layer and D-116
  error layer. Keep minimal, consistent with the existing loading layer.
- D-110's state file name, format, exact field set; the precise identity
  check D-111 uses (start time vs health-path probe vs both).
- Exact `SourcererAPI` method names/signatures for the new touchpoints.
- **How the D-121 command-line intercept is registered** — the researcher
  determines what actually wins ordering against the stock handler. *(This
  research answers the mechanism; the planner still picks exact names.)*
- Which `@sourcerer/*` package the D-109 watchdog lives in (extending
  `token-gate` vs. a new sibling extension).

### Deferred Ideas (OUT OF SCOPE — verbatim from 05-CONTEXT.md `<deferred>`)

- WINDOWS ledger item #5 (endpoint allowlist's new hosts) — product/privacy
  call, not Phase 5.
- Forwarding command-line paths into the IDE — post-4.0 bridge.
- A second shell window sharing one backend (two-monitor) — post-4.0.
- `about:` page reachability / remote-type switching — post-4.0 (CHROME-01).
- A `--diagnostics` command-line flag — considered, not chosen.
- SEED-001 unified SQL store — still dormant.
- WINDOWS ledger item #1 (`tabUriRegistry` always undefined) — untouched.
- `@sourcerer/browser-bridge`, chrome tab strip, URL bar — post-4.0.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIDE-04 | Quitting or killing the browser (incl. SIGKILL) leaves zero orphaned backend processes — process-group kill semantics plus startup cleanup of leftovers | `## Architecture Patterns` Pattern 2 (bare-pid signalling), Pattern 3 (stdin-EOF watchdog), Pattern 4 (atomic state file); `## Common Pitfalls` (zombie kill-0 false positive, /proc/pid/stat parsing, identity-check choice); `## Validation Architecture` SIDE-04 row |
| SIDE-05 | Launching Sourcerer a second time focuses the existing window and never spawns a second backend | `## Architecture Patterns` Pattern 1 (command-line handler ordering, the researcher-assigned item); `## Common Pitfalls` (headless disables remoting); `## Validation Architecture` SIDE-05 row |
| SHELL-03 | Backend dies, restart fails → branded chrome-rendered error state with working retry | `## Architecture Patterns` Pattern 5 (give-up classification hook into `_restart()`); `## Code Examples` give-up shape; `## Validation Architecture` SHELL-03 row |
| SHELL-04 | Diagnostics page shows sidecar port, PID, health status, recent log | `## Architecture Patterns` Pattern 6 (reserved XUL keyset shortcut); reuses already-existing `getState()`/`getRecentLog()` (no new data plumbing); `## Validation Architecture` SHELL-04 row |
</phase_requirements>

## Summary

Every open question CONTEXT.md left for this researcher resolves cleanly
against this ESR-153 tree's actual C++/JS source, with one finding that
changes the verification shape materially: **`gfxPlatform::IsHeadless()`
(`upstream/gfx/thebes/gfxPlatform.cpp:1231-1237`) forces
`mDisableRemoteClient = true`** (`upstream/toolkit/xre/nsAppRunner.cpp:5144`),
which means Firefox's native remoting protocol — the entire mechanism SIDE-05
depends on — is **compiled out of the second-launch path whenever
`MOZ_HEADLESS`/`--headless` is set**. `scripts/verify-phase-04.sh`'s existing
`start_shell()` launches with `--headless`
(`scripts/verify-phase-04.sh:312`). A verify-phase-05.sh single-instance
check that reuses that helper unmodified will vacuously pass (second launch
starts its own independent instance, never remotes, "no second backend" is
trivially unverifiable) or vacuously fail — either way it proves nothing.
SIDE-05's automated check needs a **real X11 display** (Xvfb without
`--headless`), which the existing WINDOWS #2–4 headless-compositor gap may or
may not also affect — this needs the same live-launch discriminator
discipline STATE.md already established, not a fresh "environmental" excuse.

D-121's command-line-handler ordering question resolves definitively:
`nsCategoryManager`'s `command-line-handler` category is enumerated in
**ascending `strcmp` order of the category entry name**
(`upstream/xpcom/components/nsCategoryManager.cpp:210-213`), which is exactly
why Gecko's own entries are named `l-*`/`m-*`/`x-*`/`y-*`
(`upstream/browser/components/components.conf:30`,
`upstream/toolkit/components/components.conf:11`). A Sourcerer handler
registered under an entry name that sorts before `m-browser` (e.g.
`a-sourcerer`) runs, checks `Services.wm.getMostRecentWindow("sourcerer:main")`,
and — if found — focuses it and sets `cmdLine.preventDefault = true` before
`nsDefaultCommandLineHandler` (category `x-default`, always last) reaches the
`else if (!cmdLine.preventDefault) { openBrowserWindow(...) }` branch
(`upstream/browser/components/BrowserContentHandler.sys.mjs:1722`) that would
otherwise open the second window. The registration itself needs **zero new
patches**: `patches/020-sourcerer-shell.patch:12` already adds
`DIRS += ["../sourcerer/shell"]` to `browser/moz.build`, so
`sourcerer/shell/moz.build` can declare `XPCOM_MANIFESTS += ["components.conf"]`
and a new `sourcerer/shell/components.conf` purely inside the `sourcerer/`
tree, exactly like `upstream/browser/components/taskbartabs/components.conf`
does for its own handler.

Priorities 2–6 are equally concrete: bare-pid signalling needs js-ctypes
(`kill(2)` via `resource://gre/modules/ctypes.sys.mjs`) because
`Subprocess.sys.mjs` has no "attach to arbitrary pid" API at all; the D-109
watchdog's cleanest shutdown path is `process.kill(process.pid, 'SIGTERM')`
because Theia's own `BackendApplication` already installs a graceful
`SIGTERM` handler that runs `@preDestroy` hooks
(`theia/node_modules/@theia/core/lib/node/backend-application.js:117-121`);
`IOUtils.writeJSON`'s `tmpPath` option gives D-110's state file real
write-then-rename atomicity for free; the entire Ctrl+Alt+Shift chord space
is unclaimed anywhere in the pinned `@theia/*` packages (zero matches on a
repo-wide grep); and Firefox's own `reserved="true"` XUL `<key>` mechanism
(tested directly in `upstream/browser/base/content/test/permissions/browser_reservedkey.js`)
is the verified, content-focus-immune shortcut primitive — stronger and more
authoritative than a raw `addEventListener('keydown')` on the chrome window,
which CONTEXT.md's own phrasing had left ambiguous.

**Primary recommendation:** register the single-instance guard as a static
`components.conf` entry (`command-line-handler: 'a-sourcerer'`) whose
constructor lives inside `SourcererAPI.sys.mjs` (the one file
`check-internals-boundary.sh` exempts from the `Ci./Cc[/Services.` scan),
implement D-111's identity check as a plain `/proc/<pid>/stat` start-time
comparison (not a health-probe — a health-probe cannot pass against D-125's
synthetic `sleep` positive control), and build `verify-phase-05.sh`'s
single-instance and error-state checks against a non-headless Xvfb display,
never `--headless`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Orphan detection & signalling (SIDE-04) | Browser/Chrome (Firefox parent process) | — | Only the chrome process outlives the backend and can read `THEIA_CONFIG_DIR`'s state file at next startup; no browser-tier code exists |
| Self-termination on parent death (SIDE-04) | Backend (Node/Theia, child process) | — | Only the child can observe its own fd 0 EOF; this is D-109's entire premise |
| Single-instance guard (SIDE-05) | Browser/Chrome | — | `nsICommandLineHandler`/`Services.wm` are chrome-process-only XPCOM surfaces; Theia has no visibility into "is another OS process launching" |
| Give-up threshold & backoff (SHELL-03) | Browser/Chrome | — | Already lives in `TheiaService.sys.mjs`'s `_healthLoop()`/`_restart()`; Phase 5 only adds a classification branch, doesn't move the loop |
| Error/diagnostics rendering (SHELL-03/SHELL-04) | Browser/Chrome | — | D-94's deck (`sourcerer.xhtml`) is chrome-rendered by design — must stay alive when the backend (and therefore any content-tier rendering) is down |
| Diagnostics data (port/pid/health/log) | Browser/Chrome | — | Already fully owned by `TheiaService.getState()`/`getRecentLog()`; no backend-tier read needed or possible when the backend is the thing that's down |

## Standard Stack

This phase adds **no new npm/PyPI/crates packages**. Every mechanism below
is either a Firefox XPCOM/WebIDL API already shipped in the pinned ESR 153
tree, or a Node.js stdlib stream/process API. `Package Legitimacy Audit` is
therefore not applicable — verified by reading the actual API surfaces in
`upstream/` (see citations throughout).

### Core (Firefox chrome-side APIs used, all in-tree, ESR 153)

| API | Source | Purpose | Why Standard |
|-----|--------|---------|--------------|
| `nsICommandLineHandler` + `command-line-handler` category | `upstream/toolkit/components/commandlines/nsICommandLineHandler.idl` | Intercepts a second launch's command line before the default window opens | The exact mechanism `BrowserContentHandler`/`taskbartabs`/`RemoteAgent`/DevTools all use — no alternative exists in this architecture |
| `ctypes` (js-ctypes) | `upstream/toolkit/components/ctypes/ctypes.sys.mjs` | Calls libc `kill(2)` on a bare pid Subprocess never spawned | `Subprocess.sys.mjs` (verified, see below) has no "attach to arbitrary pid" API; js-ctypes is Gecko's documented FFI for exactly this gap [CITED: MDN "Using js-ctypes"] |
| `IOUtils.writeJSON`/`readJSON`/`remove` | `upstream/dom/chrome-webidl/IOUtils.webidl:63-146,542-630` | D-110's atomic state file (write, read at startup, remove on clean stop) | `tmpPath` gives write-then-rename atomicity natively; already used elsewhere in the tree for exactly this pattern |
| `Services.wm.getMostRecentWindow` | `upstream/xpcom/ds/nsIWindowMediator.idl:75` | D-122's existing-window lookup | Already locked/verified in CONTEXT.md; confirmed here against the IDL signature |
| XUL `<keyset>`/`<key reserved="true">` | `upstream/browser/base/content/browser-sets.inc.xhtml:133-143`, tested in `upstream/browser/base/content/test/permissions/browser_reservedkey.js` | D-118's chrome-level keyboard shortcut, immune to a focused content `<browser>` swallowing it | This is literally how Firefox's own global shortcuts (Ctrl+T, Ctrl+L, etc.) are implemented — verified, not a raw DOM listener guess |

### Supporting

| API | Purpose | When to Use |
|-----|---------|-------------|
| `nsUnixRemoteServer::HandleCommandLine` (`upstream/toolkit/components/remote/nsUnixRemoteServer.cpp:59-123`) | Confirms the remote-launch path constructs a fresh `nsCommandLine` with `state = STATE_REMOTE_AUTO` and calls `Run()` | Background only — no code change here, but explains why the handler doesn't need to special-case remote vs. initial state (absence of an existing window already disambiguates) |
| `proc(5)` `/proc/<pid>/stat` field 22 (`starttime`) [CITED: man7.org/linux/man-pages/man5/proc_pid_stat.5.html] | D-111's identity check | Compare recorded vs. current start time on the recorded pid before signalling |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `strcmp`-ordered `command-line-handler` category entry | Dynamic `Services.catMan.addCategoryEntry()` at runtime from `sourcerer.js` | Works for the *second-launch* case (registration happens well before any remote command arrives — remoting is profile-keyed, not timing-keyed, see `upstream/toolkit/xre/nsAppRunner.cpp:5342-5358`) but still needs the handler registered as an XPCOM component (`nsIComponentRegistrar.registerFactory`), which is more code and less precedent than a static `components.conf` entry that costs zero new patches. Rejected: more moving parts for no benefit. |
| js-ctypes `kill(2)` | Shelling out to `/bin/kill` via `Subprocess.call` | Works, but spawns a whole process to send one signal, and reintroduces exactly the "is this really our subprocess" ambiguity Subprocess.call's API is built around (it wants to own the child, not fire-and-forget signal an unrelated pid) |
| `/proc/<pid>/stat` start-time identity check | Health-path probe (D-111's other named option) | The health probe **cannot pass against D-125's synthetic positive control** — a planted `sleep` process has no `/sourcerer/health` endpoint, so the identity check under test would incorrectly refuse to reap it. Start-time comparison works uniformly for both the real backend and the synthetic control. |

## Architecture Patterns

### System Architecture Diagram

```
 Second `sourcerer` launch (any argv)
        │
        ▼
 nsUnixRemoteServer::HandleCommandLine()          [already-running process]
   (or nsDBusRemoteServer → same call)
   Init(argc, argv, STATE_REMOTE_AUTO) → Run()
        │
        ▼
 nsCommandLine::EnumerateHandlers()
   catman->EnumerateCategory("command-line-handler")
   → entries sorted by strcmp(entryName) ascending
        │
        ├─► 'a-sourcerer'  (NEW: SourcererAPI single-instance handler)
        │     Services.wm.getMostRecentWindow("sourcerer:main")
        │       found?  → win.focus(); cmdLine.preventDefault = true
        │       absent? → no-op (this is the initial launch)
        │
        ├─► 'm-browser'    (nsBrowserContentHandler — processes --flags,
        │                   no-op on a bare launch, doesn't check preventDefault)
        │
        └─► 'x-default'    (nsDefaultCommandLineHandler)
              urilist empty
                └─ else if (!cmdLine.preventDefault)
                     → openBrowserWindow()   ◄── SKIPPED when 'a-sourcerer' set it
                └─ else: no window opened, existing window already focused


 TheiaService.start()  [in-process guard, D-121's second layer]
   if already started → return early (idempotent)
   else → mint token, spawn, health-gate  (Phase 4's existing sequence)


 Backend (Node/Theia child)                        Chrome (Firefox parent)
   process.stdin (fd 0, pipe, unconditional          TheiaService._spawnAndGate()
   on unix — Subprocess ensures this)                  on ready: IOUtils.writeJSON(
     .resume(); .on('end'/'close', () => {              stateFile, {pid, port, startTime},
       process.kill(process.pid, 'SIGTERM')             {tmpPath: stateFile+'.tmp'})
       // reuses BackendApplication's own
       // SIGTERM → gracefulShutdown() → exit         TheiaService.stop()
     });                                                 IOUtils.remove(stateFile,
                                                            {ignoreAbsent:true})

 Browser SIGKILLed  ──►  fd 0 write end closes  ──►  backend sees 'end' ──► self-SIGTERM ──► exits
                                                       (no polling, no race window)

 Next startup  ──►  read stateFile (if present)
                       │ pid alive? (kill -0 style check)
                       │ AND /proc/<pid>/stat field22 == recorded startTime?
                       ├─ yes (verified ours) → ctypes kill(pid, SIGTERM) [graceful] → verify gone
                       └─ no  (stale/recycled) → never signal; just proceed to spawn


 _healthLoop() / _restart()  [give-up classification, SHELL-03]
   _spawnAndGate() failure
     ├─ unrecoverable class (backendMain unset / node unresolvable /
     │  spawn failure / D-112 stolen pinned port)
     │     → give up immediately → sourcererShowError(reason)
     └─ everything else (transient crash, timeout)
           → bounded retry budget (attempt cap and/or wall-clock ceiling)
           → exhausted → sourcererShowError(reason)
                            │
                            ▼
                  Error layer paints over <browser> (D-114, no navigate)
                  Retry → resets backoff, respawns pinned port (D-115)
                  Background probe → auto-dismiss on self-heal
                  Diagnostics route → reads getState()/getRecentLog() (D-117)
```

### Recommended Project Structure

No new top-level directories. New files land inside the existing tree:

```
sourcerer/shell/
├── components.conf          # NEW — XPCOM_MANIFESTS entry, D-121's
│                             #   command-line-handler registration
├── moz.build                # EDIT — add XPCOM_MANIFESTS += ["components.conf"]
├── SourcererAPI.sys.mjs     # EDIT — new methods: window lookup+focus,
│                             #   the CLH constructor itself (must live here,
│                             #   the one file exempt from
│                             #   check-internals-boundary.sh), bare-pid
│                             #   ctypes kill, state-file read/write/remove,
│                             #   app-identity read
├── TheiaService.sys.mjs     # EDIT — idempotent start(), state-file write in
│                             #   _spawnAndGate(), leftover reap before first
│                             #   spawn, give-up classification in _restart(),
│                             #   error/diagnostics show/hide hooks
├── sourcerer.js              # EDIT — reserved XUL <key> registration,
│                             #   sourcererShowError/sourcererRetry/
│                             #   sourcererShowDiagnostics globals
├── sourcerer.xhtml           # EDIT — two new deck layers (error, diagnostics)
└── sourcerer.css             # EDIT — minimal styling, same family as loading layer

theia/extensions/token-gate/  (or a new sibling @sourcerer/* package)
└── src/node/
    └── *-backend-contribution.ts  # EDIT or NEW — stdin-EOF watchdog in
                                    #   initialize(): process.stdin.resume()
                                    #   + .on('end'/'close', ...)

scripts/
├── verify-phase-05.sh        # NEW — D-127
└── verify-branding-identity.mjs  # EDIT — D-120 repoint
```

### Pattern 1: Command-line-handler ordering (D-121, the assigned item)

**What:** Register a new XPCOM component under the `command-line-handler`
category with an entry name that sorts before `m-browser`.

**Verified mechanics:**
1. `nsCommandLine::EnumerateHandlers()` calls
   `catman->EnumerateCategory("command-line-handler", ...)`
   (`upstream/toolkit/components/commandlines/nsCommandLine.cpp:405-441`)
   and invokes **every** registered handler's `handle()` regardless of
   `preventDefault` — nothing short-circuits the enumeration except a
   handler returning `NS_ERROR_ABORT`.
2. `CreateEntryEnumerator()` sorts category entries by
   `strcmp(CategoryEntry::Cast(aA)->Key(), CategoryEntry::Cast(aB)->Key())`
   ascending (`upstream/xpcom/components/nsCategoryManager.cpp:210-213`) —
   this is *why* every existing Gecko handler is named with a sort-order
   prefix: `m-browser`/`m-sps`/`m-devtools`/`m-remote`/`m-marionette`/
   `m-vrbrowser`/`m-layoutdebug` (all `m-`), `l-windows-default`/
   `l-taskbar-tabs` (both `l-`, before `m-`), `x-default` (last),
   `y-default` (after `x-`) — confirmed by grepping every
   `components.conf` in the tree
   (`upstream/browser/components/components.conf:30`,
   `upstream/browser/components/profiles/components.conf:10`,
   `upstream/browser/components/shell/components.conf:13`,
   `upstream/browser/components/taskbartabs/components.conf:10`,
   `upstream/devtools/startup/components.conf:14`,
   `upstream/gfx/vr/components.conf:11`,
   `upstream/layout/tools/layout-debug/src/components.conf:17`,
   `upstream/remote/components/components.conf:11,23`,
   `upstream/toolkit/components/components.conf:11`).
3. `nsBrowserContentHandler.handle()` (category `m-browser`) never checks
   `cmdLine.preventDefault` — it only opens windows in response to explicit
   flags (`--browser`, `--new-window`, etc.), so it's a safe no-op on a
   bare launch regardless of ordering
   (`upstream/browser/components/BrowserContentHandler.sys.mjs:488-703`).
4. `nsDefaultCommandLineHandler.handle()` (category `x-default`, always
   last by the sort above) is where the actual "open a window because
   nothing else did" decision lives:
   `} else if (!cmdLine.preventDefault) { ... openBrowserWindow(cmdLine, lazy.gSystemPrincipal); }`
   (`upstream/browser/components/BrowserContentHandler.sys.mjs:1722-1735`).
   Setting `preventDefault = true` in any handler that runs before this one
   stops the second window from ever opening.
5. **Registration needs zero new patches.** `sourcerer/shell/moz.build` is
   already a first-class `DIRS` member of `browser/moz.build`
   (`patches/020-sourcerer-shell.patch:12`: `DIRS += ["../sourcerer/shell"]`).
   Adding `XPCOM_MANIFESTS += ["components.conf"]` to that same
   `moz.build`, plus a new `sourcerer/shell/components.conf`, is a pure
   `sourcerer/` tree change — the same mechanism
   `upstream/browser/components/taskbartabs/moz.build:29-30` uses for its
   own handler (`upstream/browser/components/taskbartabs/components.conf`).
6. The remote-launch path (D-Bus and Unix-socket both) funnels through
   `nsUnixRemoteServer::HandleCommandLine()`, which builds a fresh
   `nsCommandLine`, calls `Init(argc, argv, lf, nsICommandLine::STATE_REMOTE_AUTO)`
   (`upstream/toolkit/components/remote/nsUnixRemoteServer.cpp:114`), then
   `Run()` (`:123`) — inside the *already-running* process, well after that
   process's own startup completed. A static `components.conf` registration
   (resolved once, at component-manifest load time) is unconditionally
   already active by the time this fires; no dynamic/runtime registration
   race exists.
7. `nsRemoteService` keys remoting on the **profile path**
   (`gRemoteService->SetProfile(profilePath)`,
   `upstream/toolkit/xre/nsAppRunner.cpp:5342-5358`), not on any
   `.desktop`/D-Bus registration file — so two launches of the same binary
   sharing the same (already-branded, per BRAND-03) profile directory
   remote into each other correctly with no extra setup.

**Example (new `sourcerer/shell/components.conf`):**
```python
# Source: pattern verified against upstream/browser/components/taskbartabs/
# components.conf and upstream/browser/components/components.conf (ProcessSelector,
# 'categories' dict shape, no import needed for ProcessSelector/buildconfig --
# both are injected by the build system's exec environment for this file).
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
The `esModule` URI is the exact one already resolved at runtime today via
`ChromeUtils.importESModule("chrome://sourcerer/content/SourcererAPI.sys.mjs")`
(`sourcerer/shell/sourcerer.js:22`) — components.conf's `esModule` field
accepts any URI the module loader can resolve, chrome:// included (not only
resource://, contra the upstream examples which all happen to be
resource://).

**Boundary constraint (important, non-obvious):** the handler's `handle()`
implementation needs `ChromeUtils.generateQI(["nsICommandLineHandler"])` and
`Ci.nsICommandLine.STATE_INITIAL_LAUNCH`-shaped constants — both are
`Ci.`-pattern touches, which `check-internals-boundary.sh`'s
`FORBIDDEN_PATTERNS` list forbids everywhere under `sourcerer/shell/`
**except** `SourcererAPI.sys.mjs`
(`scripts/check-internals-boundary.sh:28-45`, `BOUNDARY_FILE_BASENAME`).
The constructor function named in `components.conf` above must therefore be
exported from `SourcererAPI.sys.mjs` itself, not a new sibling `.sys.mjs`
file — otherwise the guard script fails on a real internals touch.

### Pattern 2: Signalling a bare pid from chrome JS (D-111)

**What:** `Subprocess.sys.mjs` has no API to signal a pid it did not spawn —
verified by reading its full public surface
(`upstream/toolkit/modules/subprocess/Subprocess.sys.mjs:48-209`): `call`,
`getEnvironment`, `pathSearch`, `connectRunning` (attaches to fds, not a
pid). `SourcererAPI.killProcess(proc, graceMs)` (`sourcerer/shell/SourcererAPI.sys.mjs:142-144`)
wraps `proc.kill(graceMs)`, which only exists on a `Process` object
Subprocess itself created. A leftover from a previous run is a bare pid
read out of the state file — a different problem needing js-ctypes.

**Example:**
```javascript
// Source: resource://gre/modules/ctypes.sys.mjs (verified,
// upstream/toolkit/components/ctypes/ctypes.sys.mjs:1-17) + standard
// js-ctypes libc pattern [CITED: MDN "Using js-ctypes"].
const { ctypes } = ChromeUtils.importESModule("resource://gre/modules/ctypes.sys.mjs");

function killBarePid(pid, signal) {
  const libc = ctypes.open("libc.so.6"); // Linux-only; this project is Linux-only (CLAUDE.md)
  try {
    const kill = libc.declare(
      "kill", ctypes.default_abi, ctypes.int, ctypes.int, ctypes.int
    );
    return kill(pid, signal) === 0; // -1 on ESRCH (already gone) or EPERM
  } finally {
    libc.close();
  }
}
```

**Identity check (D-111), verified against `proc(5)`:**
```javascript
// Source: [CITED: man7.org/linux/man-pages/man5/proc_pid_stat.5.html]
// "(22) starttime %llu ... Since Linux 2.6, the value is expressed in
// clock ticks (divide by sysconf(_SC_CLK_TCK))."
// Field 2 (comm) is parenthesized and may itself contain spaces/parens --
// find the LAST ')' before splitting, never split on the first space.
async function readStartTimeTicks(pid) {
  const text = await IOUtils.readUTF8(`/proc/${pid}/stat`);
  const afterComm = text.slice(text.lastIndexOf(")") + 2); // skip ") "
  const fields = afterComm.split(" ");
  return fields[19]; // field 22 overall, index 19 counting from field 3
}
```

**Why start-time, not the health-path probe (the other D-111 option):**
D-125's positive control plants a *synthetic* leftover — "a sleeping
process recorded in D-110's state file" — which has no
`/sourcerer/health` HTTP endpoint at all. An identity check based on
probing that endpoint would correctly refuse to reap the real backend's
imposters but would also **incorrectly refuse the synthetic control itself
never gets a chance to prove reaping works**, since it can never construct
a passing health response. Start-time comparison works identically for the
real backend and the synthetic control, and is the only identity signal
that survives D-125's own test design.

### Pattern 3: Backend-side stdin-EOF watchdog (D-109)

**Verified:**
- `Subprocess` creates stdin as a pipe unconditionally on unix — already
  cited in CONTEXT.md D-109
  (`upstream/toolkit/modules/subprocess/subprocess_unix.worker.js:361`).
- Theia's `BackendApplication` never touches `process.stdin` anywhere —
  confirmed by grepping the compiled `@theia/core` backend
  (`theia/node_modules/@theia/core/lib/node/backend-application.js`, zero
  matches for `process.stdin`), so fd 0 is genuinely free.
- `BackendApplication`'s constructor already installs `SIGTERM`/`SIGINT`
  handlers that call `gracefulShutdown()`, whose comment states it exists
  "so that root-scoped singletons get their `@preDestroy` hooks invoked
  before exit" (`theia/node_modules/@theia/core/lib/node/backend-application.js:117-121`).
- Non-TTY stdin (a pipe, which this always is) starts in flowing mode on
  modern Node, but explicitly calling `.resume()` before attaching the
  listener is the documented-safe pattern regardless of stream-mode
  history [CITED: nodejs.org/api/process.html].

**Recommended shape** (mirrors `SourcererTokenGateContribution`'s
established `initialize()` hook,
`theia/extensions/token-gate/src/node/token-gate-backend-contribution.ts:29-42`):
```typescript
initialize(): void {
    // ... existing token-gate logic (or new sibling contribution) ...
    process.stdin.resume();
    process.stdin.on('end', () => {
        // Reuses BackendApplication's own graceful-shutdown path
        // (SIGTERM -> gracefulShutdown() -> @preDestroy hooks -> exit)
        // instead of duplicating cleanup logic here.
        process.kill(process.pid, 'SIGTERM');
    });
    process.stdin.on('error', () => {
        process.kill(process.pid, 'SIGTERM');
    });
}
```
`'error'` is included defensively — an abruptly closed pipe (vs. a clean
EOF) can surface as an `EPIPE`/`ECONNRESET`-class error on some Node
versions rather than a clean `'end'`; both paths must converge on the same
self-termination call.

### Pattern 4: State-file atomicity (D-110/D-111)

**Verified against the actual WebIDL** (`upstream/dom/chrome-webidl/IOUtils.webidl`):
- `write()`/`writeUTF8()`/`writeJSON()` all accept `WriteOptions.tmpPath`:
  *"If specified, write the data to a file at `tmpPath` instead of directly
  to the destination. Once the write is complete, the destination will be
  overwritten by a move."* (`:65-83`, dictionary at `:542-569`). A crash
  mid-write leaves, at worst, a stale/partial `tmpPath` file and an
  **untouched** `path` — never a half-written state file.
- `writeJSON()` signature: `Promise<WriteJSONResult> writeJSON(DOMString path, any value, optional WriteJSONOptions options = {})` (`:110`).
- `remove()`'s `RemoveOptions.ignoreAbsent` **defaults to `true`** (`:613-630`)
  — `stop()`'s cleanup call needs no existence check first.

**Example:**
```javascript
// Source: verified WebIDL, upstream/dom/chrome-webidl/IOUtils.webidl:63-146,542-630
async function writeStateFile(statePath, { pid, port, startTime }) {
  await IOUtils.writeJSON(
    statePath,
    { pid, port, startTime },
    { tmpPath: `${statePath}.tmp` }
  );
}

async function removeStateFile(statePath) {
  await IOUtils.remove(statePath); // ignoreAbsent defaults true
}
```

### Pattern 5: Give-up classification hook (D-113/D-114/D-115)

**Current shape (verified, `sourcerer/shell/TheiaService.sys.mjs`):**
`_restart()` (`:280-306`) calls `_spawnAndGate(false)` in an unconditional
`for (;;)` loop with exponential backoff (`RESTART_BACKOFF_INITIAL_MS` 500 →
`RESTART_BACKOFF_CAP_MS` 5000, `:23-24`) and **never gives up** — this is
D-103's Phase-4 behaviour, explicitly documented in the function's own
comment (`:274-279`, "retrying indefinitely (D-103: Phase 4 has no give-up
threshold)"). `_fatal()` (`:435-438`) currently only logs; it has no
"stop retrying" or "tell chrome to show an error" effect. `_spawnAndGate()`
returns a bare `false` on every failure path (`:169,190,195,206`,
plus the D-104 port-mismatch fatal inside `_pumpOutput` at `:361-366`) —
the caller cannot currently distinguish *why* it failed.

**What Phase 5 needs to add (not prescribing exact names — Claude's
Discretion covers those):**
1. `_spawnAndGate()`'s failure return needs to carry a classification
   (e.g. `{ ok: false, recoverable: boolean }`) instead of bare `false`, so
   `_restart()`'s loop can check it. The four D-113-named unrecoverable
   fatals map onto known return sites: `backendMain` unset / node
   unresolvable happen only in `_resolveSidecar()` (called once from
   `start()`, never from the restart path — so they can only ever be the
   *first* launch's give-up case), spawn failure is `:168`'s catch, and
   D-112's stolen port manifests as the `readyPromise` rejecting before
   `SOURCERER_BACKEND_READY` ever prints (`:189`'s fatal) when the child
   process dies immediately on an `EADDRINUSE` bind failure.
2. `_restart()`'s loop needs a bounded-budget counter for the *recoverable*
   branch (attempt cap and/or wall-clock ceiling — Claude's Discretion for
   exact constants) in addition to today's unconditional retry.
3. On give-up (either branch), `TheiaService` needs a chrome-facing signal
   — following the existing `_swap()` precedent
   (`:427-433`, calls `this._browserElement.ownerDocument.defaultView.sourcererSwapToUrl(...)`),
   the natural shape is a parallel `sourcererShowError(reason)` global
   exposed by `sourcerer.js`, called the same way. D-114 requires this NOT
   touch `_browserElement.src` — only the chrome document's own overlay
   layer.
4. D-115's retry button needs a `sourcererRetry()` global that resets the
   give-up state and re-enters `_restart()` (or re-triggers
   `_spawnAndGate` directly) on the pinned port — and a slow background
   probe (interval is Claude's Discretion) that calls the same
   auto-dismiss path without user action.

### Pattern 6: Reserved global keyboard shortcut (D-118)

**Verified:** grepping every compiled `@theia/*` package in
`theia/node_modules/@theia/` for any three-modifier chord
(`ctrlcmd+alt+shift+*` or `ctrl+alt+shift+*`) returns **zero matches** —
the entire space is free. The only `alt+shift`/`shift+alt` two-modifier
chords claimed anywhere are `alt+shift+c`, `shift+alt+f`, `shift+alt+f3`,
`shift+alt+f5` — none of them three-modifier, so any
`ctrl+alt+shift+<letter>` is unambiguously unclaimed.

**Mechanism — Firefox's own reserved-shortcut primitive, not a raw
listener:** `browser.xhtml`'s global shortcuts are XUL `<key>` elements
inside a `<keyset id="mainKeyset">`
(`upstream/browser/base/content/browser-sets.inc.xhtml:133-183`), several
marked `reserved="true"` (e.g. `key_newNavigator`,
`key_newNavigatorTab`, `:136-139`). `reserved="true"`'s semantics are
directly tested: `browser_reservedkey.js` dynamically creates
`document.createXULElement("keyset"/"key")` with
`key.setAttribute("reserved", "true"/"false")` and asserts the reserved
one still fires under conditions the non-reserved one doesn't
(`upstream/browser/base/content/test/permissions/browser_reservedkey.js:1-40`).
`sourcerer.xhtml`'s root is an `<html>` element with the same
`xmlns:xul="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"`
alias `browser.xhtml` itself uses (`sourcerer/shell/sourcerer.xhtml:19-20`
vs. `upstream/browser/base/content/browser.xhtml:8-10`), so the identical
`document.createXULElement`/`<keyset>` mechanism is available from
`sourcerer.js`.

**Recommended shape:**
```javascript
// sourcerer.js — created dynamically, not declared statically in the
// .xhtml, to keep the chord itself in one JS-owned place.
const keyset = document.createXULElement("keyset");
const key = document.createXULElement("key");
key.setAttribute("id", "sourcerer-diagnostics-key");
key.setAttribute("modifiers", "accel,alt,shift"); // pick the free letter
key.setAttribute("key", "D"); // placeholder -- confirm free on target keymap
key.setAttribute("reserved", "true"); // wins over the focused content <browser>
key.addEventListener("command", () => sourcererShowDiagnostics());
keyset.appendChild(key);
document.documentElement.appendChild(keyset);
```
**Note for the planner:** `document.createXULElement` is not in
`check-internals-boundary.sh`'s `FORBIDDEN_PATTERNS` list today (only
`Services.`/`Cc[`/`Cc.`/`Ci.`/`Cr.`/`Cu.`/`Components.classes`/
`Components.interfaces`/`AppConstants`/`ChromeUtils.import`/
`ChromeUtils.defineESModuleGetters`/`nodePrincipal`/`fixupAndLoadURIString`,
`scripts/check-internals-boundary.sh:28-45`), so it is not currently
flagged as an internals touch. Whether the planner wants it routed through
`SourcererAPI` anyway (for consistency with SHELL-02's stated intent, even
though the guard script doesn't require it) is a judgment call worth a plan
review, not something this research prescribes.

### Anti-Patterns to Avoid

- **`process.ppid` polling for D-109:** already rejected in CONTEXT.md — a
  poll interval delays detection and burns a timer for the whole session.
  Re-confirmed here: no reason to revisit, the stdin-EOF mechanism is
  strictly better and already verified reachable.
- **Health-probe as D-111's sole identity check:** incompatible with
  D-125's synthetic positive control (see Pattern 2 above) — don't let the
  plan pick this branch of D-111's "Claude's Discretion" wording without
  the caveat.
- **Reusing `verify-phase-04.sh`'s `--headless` shell launcher unmodified
  for SIDE-05's check:** headless disables remoting entirely (see Common
  Pitfalls) — the check would prove nothing, not merely be flaky.
- **A raw `addEventListener('keydown')` on the chrome window for D-118:**
  not proven immune to a focused, remote content `<browser>` swallowing the
  event; the XUL `<key reserved="true">` mechanism is the verified,
  tested-in-tree alternative.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file write | A manual temp-file-write + rename dance | `IOUtils.writeJSON(path, value, {tmpPath})` | Already implements write-then-rename atomicity natively (`upstream/dom/chrome-webidl/IOUtils.webidl:65-83`); a hand-rolled version would just re-derive the same two-step sequence with more surface for bugs |
| Graceful subprocess shutdown (already-spawned child) | A custom SIGTERM→wait→SIGKILL sequence | `SourcererAPI.killProcess(proc, graceMs)` (already exists, wraps `proc.kill(graceMs)`) | D-105 already established this; unchanged by Phase 5, only cited here because D-111's bare-pid case is the one place it does NOT apply (that pid has no `Process` handle) |
| Chrome-immune global keyboard shortcut | A window-level `keydown` listener plus manual `stopPropagation`/capture-phase tricks | XUL `<keyset>`/`<key reserved="true">` | This is Firefox's own primitive for exactly this problem, verified via its own test suite |
| Second-instance detection | A lock-file-and-PID-check scheme invented from scratch | `nsICommandLineHandler` category + `Services.wm.getMostRecentWindow` | Firefox already has a full native remoting protocol (D-Bus/Unix-socket) solving exactly this; the app only needs to plug into the existing `command-line-handler` category, not reimplement IPC |

**Key insight:** every mechanism this phase needs already exists somewhere
in the ESR-153 tree Sourcerer forks — the work is entirely "wire the
existing Gecko/Theia primitive into `sourcerer/`'s own code," never
"invent a new primitive." That is the same shape Phase 4 already
established (D-105's `killProcess` wrapping the platform's own kill
sequence is the precedent).

## Common Pitfalls

### Pitfall 1: `--headless` silently disables the entire remoting protocol
**What goes wrong:** A verify-phase-05.sh check that launches the built
binary with `--headless` (copying `verify-phase-04.sh`'s existing
`start_shell()` helper, `scripts/verify-phase-04.sh:312`) and then launches
it a second time to test SIDE-05 will see the second launch start its own
**independent** instance — never remoting into the first — because
`gfxPlatform::IsHeadless()` returns true whenever `MOZ_HEADLESS` is set
(`upstream/gfx/thebes/gfxPlatform.cpp:1231-1237`), and
`nsAppRunner.cpp:5144` unconditionally sets `mDisableRemoteClient = true`
in that case, which skips `gRemoteService->StartClient()` entirely
(`upstream/toolkit/xre/nsAppRunner.cpp:5360-5398`).
**Why it happens:** headless mode is what every other verification script
in this repo uses (there's no real display in the sandboxed executor
session, per STATE.md's existing Phase-4 blocker), so it's the path of
least resistance to copy.
**How to avoid:** SIDE-05's automated check needs a real (even virtual via
Xvfb) `DISPLAY`, launched **without** `--headless`/`MOZ_HEADLESS`. This may
re-encounter the RenderCompositorSWGL headless-compositor issue WINDOWS.md
already tracks (entries #2–4) — or may not, since that issue is specific to
headless compositor setup and Xvfb-without-`--headless` is a materially
different code path. Apply the same live-launch discriminator discipline
STATE.md's Phase-4 lesson demands: don't accept "environmental" without
comparing behavior across `objdir` vs `objdir-release`, or across headless
vs. Xvfb, the way WINDOWS #2–4 finally got diagnosed.
**Warning signs:** a SIDE-05 check that passes on the very first attempt
with zero setup, or one where "second backend never spawned" is true
because the SECOND process crashed/exited before spawning anything (not
because it was remoted away).

### Pitfall 2: `/proc/<pid>/stat` field-splitting on the wrong delimiter
**What goes wrong:** Field 2 (`comm`, the executable's basename) is
parenthesized and **can itself contain spaces or parentheses** — splitting
the whole line on spaces before locating the closing `)` misaligns every
field after it, including field 22 (`starttime`).
**Why it happens:** the naive `line.split(" ")[21]` looks correct for the
overwhelmingly common case (`comm` values without spaces) and will pass
every manual test the author tries against `node`/`sleep`.
**How to avoid:** find the **last** `)` in the line (not the first — a
`comm` value like `(my (weird) name)` breaks a first-`)` search too), slice
everything after it, then split the remainder on spaces and count from
field 3 (index 0 of the remainder).
**Warning signs:** works in every local test, fails only against a process
whose executable name happens to contain a space or paren — exactly the
kind of thing that stays invisible until it doesn't.

### Pitfall 3: `kill -0`-style aliveness checks see zombies as "alive"
**What goes wrong:** A recently-SIGKILLed child that hasn't been reaped yet
is a zombie (`Z` state) — its pid still exists and still answers a
liveness probe successfully, so a bounded-poll verification loop asserting
"pid is gone" can flap or false-negative during the brief zombie window.
**Why it happens:** `kill(pid, 0)` (the `ctypes`-based liveness check) only
tests pid existence + permission, not process state.
**How to avoid:** for the D-125 automated check specifically, either poll
long enough to cross the reap window (the parent — `setsid`'s leader, or
`init`/systemd's user-manager subreaper — reaps promptly, typically
sub-second) or check `/proc/<pid>/status`'s `State:` line for `Z` and treat
zombie as "as good as gone" for the assertion's purposes.
**Warning signs:** an intermittent, non-reproducible-on-rerun failure in
the SIGKILL-leaves-no-descendant check.

### Pitfall 4: `nsBrowserContentHandler.handle()`'s flag-processing runs
**unconditionally, even after `preventDefault` is already set**
**What goes wrong:** it would be reasonable to assume setting
`preventDefault = true` early stops *all* subsequent handlers from doing
anything — it doesn't. `nsCommandLine::EnumerateHandlers()` calls every
registered handler's `handle()` regardless
(`upstream/toolkit/components/commandlines/nsCommandLine.cpp:434`,
`EnumRun` never checks the flag). `nsBrowserContentHandler.handle()`
processes `--browser`/`--new-window`/`--file`/etc. flags unconditionally.
**Why it happens:** the name "preventDefault" suggests an event-style
short-circuit; it's actually just a shared boolean flag each handler
individually chooses to respect (or not) for its *own* specific action.
**How to avoid:** this is a non-issue for D-121's bare-launch (no-flags)
case specifically — `m-browser`'s flag branches simply don't fire when
there are no matching flags — but matters if the plan ever needs the
single-instance handler to also swallow flags (D-124 explicitly says it
doesn't: "ignores its command-line arguments and just focuses"). Confirms
D-124 is the simpler, already-correct choice.
**Warning signs:** N/A for this phase's chosen design (D-124 already
sidesteps it) — documented so a future plan revisiting D-124 doesn't
re-introduce the ambiguity blind.

## Code Examples

See Patterns 1–6 above for verified, cited code shapes covering:
command-line-handler registration (`components.conf`), bare-pid `kill(2)`
via js-ctypes, `/proc/<pid>/stat` identity check, the stdin-EOF watchdog,
`IOUtils.writeJSON`/`remove` atomicity, and the reserved XUL keyboard
shortcut. No further code examples are needed beyond those.

## State of the Art

Not applicable in the usual "library X deprecated Y" sense — every API
this phase touches is a stable, long-lived Gecko/Node primitive with no
recent replacement. One note worth flagging:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `--no-remote` CLI flag to control remoting | Argument is now a stripped no-op (`upstream/toolkit/xre/nsAppRunner.cpp:4739-4740`: "Strip the now unsupported no-remote command line argument") | Somewhere before ESR 153 (exact version not determined this session) | Verification scripts must not rely on `--no-remote` to force two independent instances for testing purposes — it does nothing; `MOZ_NEW_INSTANCE=1` or `--new-instance` (`:4742-4746`, sets `mDisableRemoteClient = true`) is the current equivalent, and `MOZ_HEADLESS`/`--headless` has the same side effect as an unintended consequence (Pitfall 1) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Node's non-TTY `process.stdin` starts in flowing mode automatically on modern Node, but `.resume()` is still the documented-safe explicit call | Pattern 3 | Low — `.resume()` is a no-op if already flowing; worst case is defensive code that wasn't strictly necessary, not a correctness bug |
| A2 | `sysconf(_SC_CLK_TCK)` (needed to convert `/proc/<pid>/stat` field 22 ticks to seconds) is not required for D-111's identity check, since a raw tick-count *equality* comparison (recorded vs. current, same units, same host) needs no conversion at all | Pattern 2 | Low — equality comparison sidesteps the conversion entirely; only matters if a future feature needs the actual wall-clock start time, not this phase |
| A3 | Exactly when `--no-remote` became a stripped no-op (vs. still functioning) in Gecko's history was not independently re-verified beyond this ESR-153 checkout's own comment | State of the Art | Low — doesn't affect this phase's design, since the plan should use `MOZ_HEADLESS`/`MOZ_NEW_INSTANCE` awareness regardless of `--no-remote`'s history |

**All claims about this repo's own source files (`upstream/`, `sourcerer/`,
`theia/`, `scripts/`) are `[VERIFIED: file:line]`** — every citation above
was read directly this session, not recalled from training data. The three
assumptions above are the only claims resting partly on general Node.js/
Linux platform knowledge rather than this repo's own source.

## Open Questions

1. **Exact wall-clock/attempt-cap constants for D-113's give-up budget**
   - What we know: neighbouring constants (`RESTART_BACKOFF_INITIAL_MS` 500,
     cap 5000, `CONSECUTIVE_FAILURES_THRESHOLD` 2) are already in
     `TheiaService.sys.mjs`.
   - What's unclear: no existing precedent for a *give-up* ceiling (Phase 4
     never had one — D-103 was explicitly indefinite).
   - Recommendation: explicitly Claude's Discretion per CONTEXT.md; the
     planner should pick something proportionate to backoff growth (e.g.
     ~6 attempts, capping wall-clock around 30-45s) and record the reasoning
     in the plan, not leave it undocumented.

2. **Does Xvfb-without-`--headless` avoid the RenderCompositorSWGL issue
   WINDOWS #2–4 tracks, or reproduce it under a different name?**
   - What we know: the existing blocker is specifically tied to
     `--headless` mode's compositor setup (per STATE.md's blocker note and
     WINDOWS.md entries 2–4); this research's Pitfall 1 independently shows
     `--headless` also disables remoting, for an unrelated reason
     (`gfxPlatform::IsHeadless()`).
   - What's unclear: whether a real (Xvfb-backed) `DISPLAY` without
     `--headless` sidesteps the compositor issue entirely, since it's a
     genuinely different code path (real X11 socket vs. no display server
     at all).
   - Recommendation: the plan's Wave 0 should attempt exactly this
     (Xvfb + no `--headless`) as a discriminator test before building the
     rest of verify-phase-05.sh's SIDE-05 checks on top of it — if it also
     fails, apply the WINDOWS #2-4 discriminator discipline (compare
     `objdir` vs `objdir-release`) rather than declaring it environmental.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Xvfb (or a real X11/Wayland display) | SIDE-05 automated verification (Pitfall 1) | Not probed this session — this executor session has no attached desktop, matching STATE.md's existing Phase-4 blocker note | — | If unavailable in the executing environment, SIDE-05's live-launch check becomes part of D-126's human working-day item rather than `verify-phase-05.sh`'s automated set — the plan should state this explicitly rather than silently skip it |
| `libc.so.6` (js-ctypes target for `kill(2)`) | D-111 bare-pid signalling | Yes — standard on any Linux/NixOS host (glibc or a compatible libc is a baseline system dependency); not independently probed via `ldconfig` this session | — | — |

**Missing dependencies with no fallback:** none identified — Xvfb has a
documented fallback (human verification) if genuinely unavailable.

**Missing dependencies with fallback:** Xvfb/display server (see above).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bash + `scripts/lib/firefox-bidi.mjs` (zero-dependency BiDi harness) — the established pattern across Phases 2-4, not a new framework |
| Config file | none — `scripts/verify-phase-05.sh` (new) follows `scripts/verify-phase-04.sh`'s structure directly |
| Quick run command | `scripts/verify-phase-05.sh --quick` (pattern from `verify-phase-04.sh`'s existing `--quick` set, `scripts/verify-phase-04.sh` check-registration block) |
| Full suite command | `scripts/verify-phase-05.sh` (no flag) — plus D-127's re-run of `scripts/verify-phase-03.sh` and `scripts/verify-phase-04.sh` at the final phase gate |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIDE-04 (orphan cleanup, negative) | SIGKILL leaves zero descendant Node processes | integration (bash + `/proc` walk) | new check function in `verify-phase-05.sh` | ❌ Wave 0 |
| SIDE-04 (leftover reap, positive control) | A planted fake leftover (`sleep`, matching state-file identity) IS reaped on next startup | integration (D-125's required pairing) | new check function in `verify-phase-05.sh` | ❌ Wave 0 |
| SIDE-04 (identity check, negative control) | A stale/mismatched state-file entry is NOT signalled (the pidfile footgun) | integration | new check function in `verify-phase-05.sh` — recommended addition beyond D-125's literal wording, closes the "recycled pid" risk D-111 names | ❌ Wave 0 |
| SIDE-05 | Second launch focuses existing window, spawns no second backend | integration, **requires non-headless display (Pitfall 1)** | new check function in `verify-phase-05.sh` | ❌ Wave 0 |
| SHELL-03 (give-up → error state) | Exhausted retry budget shows the branded error layer; unrecoverable class skips straight to it | integration | new check function in `verify-phase-05.sh` | ❌ Wave 0 |
| SHELL-03 (retry works) | Retry button re-attempts spawn and clears the error layer on success | integration | new check function in `verify-phase-05.sh` | ❌ Wave 0 |
| SHELL-04 | Diagnostics layer reachable and shows port/pid/health/log **while the backend is down** | integration | new check function in `verify-phase-05.sh` | ❌ Wave 0 |
| WINDOWS #6 (D-120) | `verify-branding-identity.mjs`'s about-support surface reads the repointed diagnostics-layer identity fields | integration | `scripts/verify-branding-identity.mjs` (existing script, repointed) | ✅ exists, needs edit |
| Criterion 5 (daily-drivable) | One full working day with no manual cleanup/forced relaunch | manual-only (D-126) | N/A — human-recorded in `05-MANUAL-VERIFICATION.md` | N/A by design |

### Sampling Rate
- **Per task commit:** relevant single check function from `verify-phase-05.sh` (mirrors `verify-phase-04.sh`'s per-check granularity)
- **Per wave merge:** `verify-phase-05.sh` full run
- **Phase gate:** `verify-phase-05.sh` + `verify-phase-03.sh` + `verify-phase-04.sh` all green at the same commit (D-127) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `scripts/verify-phase-05.sh` — does not exist yet; needs the same `setsid`-based process-group idiom `verify-phase-04.sh` already established (`scripts/verify-phase-04.sh:24-29,117,301-334`) plus the new `/proc`-walk and state-file-planting helpers
- [ ] A non-headless (Xvfb) launch helper distinct from `verify-phase-04.sh`'s existing `--headless` `start_shell()` — needed specifically for the SIDE-05 check (Pitfall 1); reuse everything else from that helper, just drop `--headless`
- [ ] Framework install: none — this reuses the zero-dependency BiDi harness already in the repo

*(No gaps beyond the new script itself and the non-headless launch variant — no new test framework, no new fixtures beyond what D-125's positive control needs.)*

## Sources

### Primary (HIGH confidence — read directly this session)
- `upstream/toolkit/components/commandlines/nsCommandLine.cpp` — handler enumeration, `Run()`, `preventDefault` semantics
- `upstream/xpcom/components/nsCategoryManager.cpp` — category entry sort order (`strcmp`, ascending)
- `upstream/browser/components/components.conf`, `upstream/browser/components/taskbartabs/components.conf`, and every other `components.conf` in the tree with a `command-line-handler` category — sort-order-prefix convention
- `upstream/browser/components/BrowserContentHandler.sys.mjs` — `nsBrowserContentHandler`/`nsDefaultCommandLineHandler` handle() logic, the `openBrowserWindow()` call site D-121 must prevent
- `patches/020-sourcerer-shell.patch` — confirms `sourcerer/shell/moz.build` is already wired into `browser/moz.build`'s `DIRS`
- `upstream/toolkit/components/remote/nsUnixRemoteServer.cpp` — remote command-line dispatch, `STATE_REMOTE_AUTO`
- `upstream/toolkit/xre/nsAppRunner.cpp` — remoting enable/disable logic, `IsHeadless()`'s effect on `mDisableRemoteClient`, profile-keyed remoting
- `upstream/gfx/thebes/gfxPlatform.cpp` — `IsHeadless()` implementation (`MOZ_HEADLESS` env var)
- `upstream/toolkit/modules/subprocess/Subprocess.sys.mjs` — full public API surface (no bare-pid signal capability)
- `upstream/toolkit/components/ctypes/ctypes.sys.mjs` — js-ctypes import shape
- `upstream/dom/chrome-webidl/IOUtils.webidl` — `write`/`writeJSON`/`remove` atomicity semantics, verbatim option docs
- `upstream/xpcom/ds/nsIWindowMediator.idl` — `getMostRecentWindow` signature
- `upstream/browser/base/content/browser-sets.inc.xhtml`, `upstream/browser/base/content/test/permissions/browser_reservedkey.js` — XUL `<keyset>`/`reserved="true"` mechanism and its own test
- `sourcerer/shell/TheiaService.sys.mjs`, `sourcerer/shell/SourcererAPI.sys.mjs`, `sourcerer/shell/sourcerer.xhtml`, `sourcerer/shell/sourcerer.js` — current implementation this phase extends
- `theia/extensions/token-gate/src/node/token-gate-backend-contribution.ts`, `token-gate-backend-module.ts` — established `@sourcerer/*` backend-contribution pattern
- `theia/node_modules/@theia/core/lib/node/backend-application.js` — confirms no `process.stdin` usage and the existing graceful `SIGTERM` path
- `scripts/check-internals-boundary.sh`, `scripts/check-patch-surface.sh`, `scripts/verify-phase-04.sh` — established guard-script and verify-script idioms this phase extends
- `scripts/verify-branding-identity.mjs` — current about-support read path D-120 repoints
- `sourcerer/INTERNAL-APIS.md` — existing catalogue-row format for new `SourcererAPI` touchpoints

### Secondary (MEDIUM confidence)
- [CITED: developer.mozilla.org "Using js-ctypes"] — `ctypes.open("libc.so.6")` + `.declare()` pattern for calling libc functions
- [CITED: man7.org/linux/man-pages/man5/proc_pid_stat.5.html] — `/proc/<pid>/stat` field 22 (`starttime`), clock-ticks-since-boot semantics
- [CITED: nodejs.org/api/process.html] — `process.stdin` flowing-mode/`resume()` semantics for non-TTY (pipe) stdin

### Tertiary (LOW confidence)
- None — every finding in this research was either verified against this repo's own source this session, or cited to an official/authoritative external doc.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; every API cited against the actual pinned ESR-153/Theia source
- Architecture: HIGH — all six researcher-assigned priorities resolved with file:line citations, including one materially significant new finding (headless disables remoting)
- Pitfalls: HIGH — four pitfalls identified, three from direct source verification, one (`/proc/pid/stat` parsing) from well-established Linux platform knowledge

**Research date:** 2026-08-27
**Valid until:** effectively pinned to this ESR-153/Theia-1.74.1 checkout — no expiry in the usual "library moves fast" sense; re-verify only if the upstream pin changes (BUILD-03's rebase procedure)
