# Phase 5: Lifecycle & Failure Hardening - Context

**Gathered:** 2026-08-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Sourcerer cleans up after itself under any exit path and tells the user what
went wrong instead of freezing. v4.0 is daily-drivable at the end of this
phase.

Delivers: a backend-side parent-death watchdog, a sidecar state file plus
startup leftover reaping, a give-up threshold on the Phase 4 health loop, a
branded chrome-rendered error state with retry, a chrome-rendered diagnostics
layer, single-instance enforcement at two layers, and
`scripts/verify-phase-05.sh`.

Requirements: SIDE-04, SIDE-05, SHELL-03, SHELL-04.

**Also folded in:** WINDOWS ledger item #6 (`verify-branding-identity-dev`'s
about:support surface fails because `about:` pages are unreachable in the
shell) — resolved as a side effect of the diagnostics layer carrying identity.

**Not this phase:** WINDOWS ledger item #5 (the endpoint allowlist's new
hosts) — explicitly deferred, see `<deferred>`. No custom browser chrome: the
error and diagnostics layers are chrome-rendered *overlays* in the existing
`sourcerer.xhtml` deck, not a tab strip, toolbar, or URL bar. No chrome-owned
tab model, no remote-type switching, no `@sourcerer/browser-bridge`. No
SEED-001 storage work — the D-127 state file is a single JSON file, not that
store.

</domain>

<decisions>
## Implementation Decisions

### Orphan kill and leftover cleanup (SIDE-04)

- **D-109:** A `SIGKILL`ed browser runs no cleanup code, so the surviving
  mechanism lives on the **child side: the sidecar watches its own fd 0 for
  EOF and exits.** Verified reachable — `Subprocess` creates stdin as a pipe
  **unconditionally** on unix (`their_pipes.set(0, pipe(false))`,
  `upstream/toolkit/modules/subprocess/subprocess_unix.worker.js:361`), not
  only when a caller asks for a stdin pipe. The browser process therefore
  holds the write end; when it dies by any means the child sees EOF
  immediately. No polling, no timer, no race window. Theia's backend does not
  read stdin, so fd 0 is free. Lives in a backend-side `@sourcerer/*`
  contribution (alongside or beside `@sourcerer/token-gate`), not in Theia
  core.
  **Rejected:** `process.ppid` polling (detection delayed by the poll
  interval, burns a timer for the whole session) and startup-cleanup-only
  (literally fails SIDE-04's first clause — an orphan exists, just briefly).

- **D-110:** SIDE-04's second clause needs state that survives a crash, so
  **Phase 5 introduces the first persistence: a sidecar state file (pid,
  port, start time) under `THEIA_CONFIG_DIR`** — written on spawn, removed on
  clean stop, read at next startup to find leftovers. This **amends D-107**,
  which scoped "no persistence" to Phase 4. The directory already exists and
  `TheiaService._resolveConfigDir()` already `mkdir -p`s it
  (`sourcerer/shell/TheiaService.sys.mjs:132-137`).
  — **Reversibility:** reversible — one file, one writer, one reader; deleting
  it degrades startup cleanup and nothing else.
  **Rejected:** the Firefox profile directory (the sidecar's own config dir is
  where its other state already lives) and no file at all (with no recorded
  pid or port there is nothing to detect, so SIDE-04's second clause cannot
  hold).

- **D-111:** Startup cleanup **only kills a verified-ours pid.** Read the
  recorded pid, confirm it is still alive *and* that its identity matches
  what was recorded (start time, or the recorded port answering our own
  health path), then signal it. A stale pid the OS has recycled onto an
  unrelated process must never be signalled — the classic pidfile footgun.
  **Rejected:** killing whatever holds the recorded port (can kill a
  developer's own `yarn start` sidecar or an unrelated service) and killing
  by pid without verification.

- **D-112:** Phase 4 deferred "pinned port stolen during the restart gap"
  (D-104's residual risk) to this phase. It is resolved as **an unrecoverable
  case that goes straight to the SHELL-03 error state.** The already-loaded
  Theia page can only reconnect to the origin it was loaded from, so there is
  no silent recovery available; retry re-attempts the bind. D-104's
  pinned-port invariant stays intact.
  **Rejected:** reaping the squatter and rebinding (only helps when the
  squatter is our own orphan — an unrelated process still lands in the error
  state, so the error path is needed regardless).

### Give-up threshold and error state (SHELL-03)

- **D-113:** Phase 4's health loop retries indefinitely (D-103). Phase 5 adds
  a **split give-up rule: unrecoverable classes give up immediately;
  everything else gets a bounded retry budget** (attempt count or wall-clock
  ceiling) before the error state. Unrecoverable classes are the ones
  `TheiaService._fatal()` already distinguishes at its call sites:
  `sourcerer.sidecar.backendMain` unset or missing, Node not resolvable,
  spawn failure, and D-112's stolen pinned port. Retrying eight times to
  spawn a file that does not exist is noise; retrying a transient crash is
  exactly right.
  **Rejected:** a flat attempt cap alone (pointless multi-second wait on
  failures that can never succeed) and a wall-clock budget alone (a
  slow-failing spawn gets fewer attempts than a fast-failing one).

- **D-114:** The error layer **paints over the `<browser>` without navigating
  or destroying the page underneath.** Theia's own reconnect loop keeps
  running behind it; when the backend returns the layer hides and the page
  resumes with its editor state intact. This **revises D-95**, which said
  chrome does nothing visually mid-session — SHELL-03 requires a visible
  branded state, but D-95's underlying reasoning (Theia's reconnect preserves
  the session) is what makes the overlay-without-teardown shape correct.
  Verified: Theia's mid-session handling is a status-bar item plus a
  `theia-mod-offline` body class
  (`theia/node_modules/@theia/core/lib/browser/connection-status-service.js:183-188`)
  and it retries **indefinitely** — it never gives up, so the page really
  does resume on its own.
  — **Reversibility:** reversible — it is a third layer in D-94's existing
  deck, the mechanism the deck was designed for.
  **Rejected:** navigating the `<browser>` to `about:blank` behind the error
  layer (throws away exactly the state D-104 exists to preserve) and keeping
  D-95 unchanged (fails SHELL-03's "never a blank or frozen window" for the
  mid-session case).

- **D-115:** Retry **resets the backoff and respawns on the pinned port**;
  meanwhile a slow background probe keeps running, so a backend that recovers
  on its own (or a port that frees up) **auto-dismisses the error layer**
  without the user touching anything. Sufficient by D-114's verified finding:
  restarting the backend alone recovers a mid-session page.
  **Rejected:** manual-dismiss-only (a self-healed backend still shows an
  error until clicked) and restart-plus-page-reload (discards the session
  Theia would otherwise recover).

- **D-116:** The error state shows **a branded plain-language message naming
  what failed, a Retry button, and a route into the diagnostics layer** — not
  an inline log dump. Detail lives in exactly one place (SHELL-04), so it is
  implemented once rather than twice, and a non-debugging user is not shown a
  stack trace.
  **Rejected:** inline log tail on the error screen (duplicates the
  diagnostics rendering) and message-plus-retry with no route to detail
  (satisfies SHELL-03 literally but tells the user less about what went
  wrong).

### Diagnostics surface (SHELL-04) and WINDOWS #6

- **D-117:** The diagnostics surface is **a third chrome-rendered layer in
  `sourcerer.xhtml`'s existing deck**, reading `TheiaService.getState()` and
  `TheiaService.getRecentLog()` directly in the chrome process. Alive by
  construction when the backend is down — no network, no content process, no
  remote-type switching. Reuses D-94's mechanism a third time (loading,
  error, diagnostics) instead of inventing one, and sidesteps WINDOWS #6
  entirely. Both accessors already exist and already return exactly SHELL-04's
  enumerated fields (`sourcerer/shell/TheiaService.sys.mjs:100-113`).
  **Rejected:** a real `about:sourcerer` `nsIAboutModule` (matches the
  requirement's wording but the single `<browser>` is pinned
  `remoteType="web"`, so it drags in remote-type switching — post-4.0
  tab-model work the milestone defers) and a route served by the sidecar
  (dead exactly when it is needed; SHELL-04's own text forbids it).

- **D-118:** Two entry points: **a chrome-level keyboard shortcut** in
  `sourcerer.js` (a chord Theia does not claim — Theia owns most of the
  Ctrl/Alt space, so something in the Ctrl+Alt+Shift range) **and a route
  from the SHELL-03 error state** (D-116). The shortcut works at any time
  including before first load; the error-state route guarantees discovery at
  the moment it matters.
  **Not chosen:** a command-line flag to launch straight into diagnostics —
  see `<deferred>`.

- **D-119:** The diagnostics layer **also carries app identity — brand name,
  vendor, version — read chrome-side**, alongside port, PID, health status,
  restart count, and the recent log. A small addition that gives
  `verify-branding-identity.mjs` a real, reachable surface to read.

- **D-120:** **WINDOWS ledger item #6 is resolved by repointing the check, not
  by waiving it.** `verify-branding-identity.mjs`'s about-support surface
  stops reading `about:support` and reads runtime identity chrome-side
  instead — naturally from D-119's diagnostics layer. All six BRAND-01
  identity surfaces stay genuinely verified rather than one being dropped,
  and the check stays honest about what it proves. Mark #6 fixed once the
  repointed check passes on both variants.
  **Rejected:** waiving it with a documented reason (BRAND-01 loses a
  surface) and making `about:` reachable now (CHROME-01 groundwork landing
  early — the roadmap's scope gate routes this to the backlog).

### Single-instance behaviour (SIDE-05)

- **D-121:** The guard lives at **both layers.** (1) A command-line handler
  intercept so a second launch focuses the existing window and prevents the
  default open — correct UX, no stray window. (2) `TheiaService.start()`
  becomes **idempotent**, returning early if a backend is already started —
  so SIDE-05's "never spawns a second backend" is true by construction even
  if some other path opens a shell window. Verified failure mode today: a
  second launch remotes into `BrowserContentHandler.handle()` →
  `openBrowserWindow()` → `BrowserWindowTracker.openWindow()`
  (`upstream/browser/components/BrowserContentHandler.sys.mjs:398`), which
  opens a *new* window at `BROWSER_CHROME_URL` — now `sourcerer.xhtml` —
  whose `sourcerer.js` calls `TheiaService.start()` again, and `start()` has
  no guard, so it re-mints the token and calls `_spawnAndGate(firstSpawn:
  true)` → a second backend on a fresh port.
  **Rejected:** handler-only (leaves `start()` re-entrant for any future
  second window) and guard-only (user gets a second blank shell window on
  top of the first, failing SIDE-05's "focuses the existing window" clause).

- **D-122:** The existing window is found via
  **`Services.wm.getMostRecentWindow("sourcerer:main")`** — `sourcerer.xhtml`
  already declares that `windowtype`
  (`sourcerer/shell/sourcerer.xhtml:21`), so this works today with no new
  registration. One new `SourcererAPI` method, one `INTERNAL-APIS.md`
  catalogue row.
  **Rejected:** calling `BrowserWindowTracker.track(window)` from
  `sourcerer.js` — it would make more Firefox internals resolve against our
  window, which is precisely the risk: those paths assume `gBrowser`, tabs,
  and `browser.js` state that D-90's minimal window deliberately does not
  have.

- **D-123:** **A second shell window is never opened — a second launch always
  focuses the one existing window.** Matches SHELL-01's one-window design and
  leaves multi-window semantics for the chrome-owned tab model (CHROME-01) to
  decide later without inheriting a v4.0 shape.
  **Rejected:** allowing a second window sharing the one pinned-port backend
  (useful on two monitors and nearly free, but a capability SIDE-05 does not
  ask for) — see `<deferred>`.

- **D-124:** A second launch **ignores its command-line arguments and just
  focuses.** Forwarding a path into the IDE needs a Theia-side open handler
  and a chrome-to-sidecar command channel — real new capability inside a
  hardening phase. Deferred to the post-4.0 bridge, where Phase 2's URI
  schemes already give it a natural shape.
  **Rejected:** forwarding paths to Theia (new capability) and refusing to
  launch with arguments (makes the binary feel broken to anyone who types a
  path out of habit).

### Verification shape

- **D-125:** SIDE-04 is proven **automated, in both directions.** A script
  launches the built binary, `SIGKILL`s it, and asserts no descendant Node
  process survives — **paired with a positive control** that plants a fake
  leftover (a sleeping process recorded in D-110's state file) and asserts
  startup cleanup DOES reap it. Follows 02-LEARNINGS' rule that every
  negative assertion ships a positive control, and D-68's
  guard-script-with-self-test idiom. "No orphan found" is exactly the
  assertion that passes vacuously when the launch itself silently failed —
  which is how WINDOWS #2–4 stayed misdiagnosed across three plans.
  **Rejected:** orphan check without the cleanup control, and human-only
  verification (would not re-run at the next ESR rebase, which is when this
  behaviour is most likely to break).

- **D-126:** Criterion 5's "a working period" is **one full working day,
  human-recorded** in `05-MANUAL-VERIFICATION.md`: what was done, whether any
  manual process cleanup or forced relaunch was needed, and the verdict. Same
  shape as Phase 3's Items A/B and Phase 4's launch-paint item, both of which
  caught real defects.
  **Rejected:** a multi-day soak (gates the milestone on calendar time) and
  an automated soak script (repeatable, but does not exercise what
  "daily-drivable" actually means).

- **D-127:** **One new `scripts/verify-phase-05.sh`** for this phase's checks
  (established pattern: one verification script per phase, extended never
  siblinged), and the **final phase gate reruns `verify-phase-03.sh` and
  `verify-phase-04.sh` as well.** This is the last phase, so a green v4.0
  must mean every phase gate is green at the same commit — and Phase 4
  already demonstrated that a later phase can break an earlier phase's gate
  (that is exactly what WINDOWS #5 and #6 are). Also the natural place
  D-120's repointed branding check gets re-proven.
  **Rejected:** scoping the gate to Phase 5's own criteria only.

### Claude's Discretion

- Exact give-up constants: the retry-attempt cap and/or wall-clock ceiling in
  D-113, and the background auto-recovery probe interval in D-115. Pick
  sensible values and record them in the plan; Phase 4's constants
  (`RESTART_BACKOFF_INITIAL_MS` 500 → cap 5000,
  `CONSECUTIVE_FAILURES_THRESHOLD` 2) are the neighbours to stay consistent
  with.
- The exact keyboard chord for D-118, subject to not colliding with anything
  Theia claims.
- Markup, layout, and refresh cadence (live poll vs snapshot-plus-refresh) of
  the D-117 diagnostics layer, and of the D-116 error layer. Keep both
  minimal and consistent with the existing loading layer.
- D-110's state file name, format, and exact field set; and the precise
  identity check D-111 uses (process start time vs health-path probe vs
  both).
- Exact `SourcererAPI` method names and signatures for the new touchpoints
  (window lookup, command-line handler registration, process signalling,
  file read/write for the state file).
- How the D-121 command-line intercept is registered (an `nsICommandLineHandler`
  in the appropriate category ahead of `BrowserContentHandler`, versus
  another mechanism) — the researcher determines what actually wins ordering
  against the stock handler.
- Which `@sourcerer/*` package the D-109 watchdog lives in (extending
  `token-gate` versus a new sibling extension).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative requirements and architecture
- `.planning/ROADMAP.md` — Phase 5 goal and success criteria 1–5
- `.planning/REQUIREMENTS.md` — SIDE-04, SIDE-05 (lines 31–32), SHELL-03,
  SHELL-04 (lines 38–39) exact text; the placement note explaining why
  SIDE-03 sits in Phase 4 and Phase 5 owns the failure surfaces around it
- `docs/PRODUCT-REQUIREMENTS.md` — R1–R9, CONFIRMED 2026-08-19
- `docs/research/sourcerer-architecture.md` §Components 3, 3b, 4 —
  TheiaService / SourcererAPI / GUI shell; note §3 names "single-instance
  lock" as a supervisor responsibility
- `CLAUDE.md` (repo root) — hard rules: never fork/patch Theia core, never
  modify Gecko outside the patch-set model, Theia is the only GUI in v4.0,
  design for the bridge

### Prior phase decisions this phase consumes or amends
- `.planning/phases/04-full-window-theia-shell/04-CONTEXT.md` — **the primary
  input.** D-94 (the deck the error and diagnostics layers join), D-95
  (revised by D-114), D-96/D-97 (internals boundary every new touchpoint must
  respect), D-99 (chrome-set cookie), D-103 (indefinite retry, given a
  give-up threshold by D-113), D-104 (pinned port and token; its residual
  risk closed by D-112), D-105 (TERM-grace-KILL, the SIDE-04 floor), D-106
  (the ring buffer SHELL-04 reads), D-107 (amended by D-110), D-108
  (SessionStore deliberately not touched)
- `.planning/phases/02-sourcerer-theia-extensions/02-LEARNINGS.md` — BiDi
  harness pattern, bounded-poll instead of point-in-time assertion, every
  negative assertion ships a positive control (D-125 depends on this)
- `.planning/phases/03-branded-firefox-fork/03-CONTEXT.md` — D-68
  (guard-script-with-self-test idiom), D-70/D-72/D-73 (tiered rebuild and the
  compiled-file boundary that governs which tier each new file lands in)
- `.planning/WINDOWS.md` — item #6 (resolved by D-120) and item #5 (deferred);
  items #2–4's misdiagnosis is the cautionary case behind D-125

### Phase 4 code this phase extends (all in-repo, read before planning)
- `sourcerer/shell/TheiaService.sys.mjs` — the supervisor. `start()` (line 56,
  made idempotent by D-121), `stop()` (line 82), `getRecentLog()`/`getState()`
  (lines 100–113, read by D-117), `_healthLoop()` (line 240, gains D-113's
  give-up), `_restart()` (line 280), `_spawnAndGate()` (line 146, gains
  D-110's state-file write)
- `sourcerer/shell/SourcererAPI.sys.mjs` — the one anti-corruption layer;
  every new internals touch in this phase is a new method here
- `sourcerer/shell/sourcerer.xhtml` — the deck (`#sourcerer-loading` +
  `#sourcerer-content`); `windowtype="sourcerer:main"` at line 21 is what
  D-122 looks up
- `sourcerer/shell/sourcerer.js` — chrome bootstrap; `sourcererSwapToUrl`,
  and where D-118's key handler lands
- `sourcerer/shell/sourcerer-sidecar.js` — the preprocessed default-prefs
  file; any new pref for D-113's constants would go here
- `sourcerer/shell/sourcerer.css`, `sourcerer/shell/jar.mn`,
  `sourcerer/shell/moz.build` — the packaging the new layers ride
- `sourcerer/INTERNAL-APIS.md` — the self-enforcing catalogue; every new
  `SourcererAPI` touchpoint needs a row
- `theia/extensions/token-gate/src/node/token-gate-backend-contribution.ts` —
  the backend-side `@sourcerer/*` contribution D-109's watchdog extends or
  sits beside

### Firefox and Theia internals verified during this discussion
- `upstream/toolkit/modules/subprocess/subprocess_unix.worker.js:361` —
  `their_pipes.set(0, pipe(false))`: stdin is a pipe unconditionally on unix.
  The whole of D-109 rests on this line.
- `upstream/toolkit/modules/subprocess/subprocess_common.sys.mjs:596-601` —
  the `stdin` OutputPipe the parent holds
- `upstream/browser/components/BrowserContentHandler.sys.mjs:398, 488, 1240` —
  `openBrowserWindow()` → `BrowserWindowTracker.openWindow()`, the `handle()`
  entry point D-121 intercepts, and `win.location = AppConstants.BROWSER_CHROME_URL`
- `upstream/browser/modules/BrowserWindowTracker.sys.mjs:207, 503` —
  `getTopWindow()` and `track()`; the shell is never tracked, which is why
  D-122 uses `Services.wm` instead
- `upstream/toolkit/components/remote/` (`nsRemoteService.cpp`,
  `nsDBusRemoteServer.cpp`, `nsUnixRemoteServer.cpp`) — the native remoting
  path a second launch travels before reaching the content handler
- `theia/node_modules/@theia/core/lib/browser/connection-status-service.js:183-188`
  — Theia's offline UI is a status-bar item plus a `theia-mod-offline` body
  class, retrying indefinitely and never giving up. D-114 and D-115 both
  depend on this.

### Repo scripts whose idiom this phase extends
- `scripts/verify-phase-04.sh` — the script shape `verify-phase-05.sh` copies
- `scripts/verify-phase-03.sh` — rerun by D-127's final gate
- `scripts/verify-branding-identity.mjs` — its about-support surface is what
  D-120 repoints
- `scripts/check-internals-boundary.sh` — must stay green as new
  `SourcererAPI` methods land
- `scripts/check-patch-surface.sh` — the guard-with-`--self-test` shape D-125
  copies
- `scripts/lib/firefox-bidi.mjs` — the zero-dependency BiDi harness driving
  the built binary
- `docs/BUILD.md` — tiered rebuild loop; which tier each new file type lands
  in

### Deliberately not read / not acted on
- `.planning/seeds/SEED-001-sql-tab-state-machine.md` — still dormant. D-110's
  state file is a single JSON file for one purpose and is **not** the start of
  that store. Do not act on the seed's contents.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TheiaService.getState()` and `getRecentLog()` already exist and already
  return exactly SHELL-04's enumerated fields (port, pid, healthy,
  restartCount, plus the timestamped ring buffer) — D-106 built them for this
  phase. SHELL-04 is a rendering job, not a data-plumbing one.
- D-94's deck in `sourcerer.xhtml` is the mechanism both new layers join —
  the error and diagnostics layers are the second and third users of a
  pattern that already works.
- `TheiaService._resolveConfigDir()` + `SourcererAPI.ensureDirectory()`
  already create `$XDG_CONFIG_HOME/sourcerer` on every launch — D-110's state
  file has a home with no new setup.
- `SourcererAPI.killProcess(proc, graceMs)` already wraps the platform's own
  TERM→grace→KILL sequence; startup cleanup of a leftover needs a *different*
  call (signalling a bare pid we did not spawn), which is a new
  `SourcererAPI` method.
- `sourcerer.xhtml` already declares `windowtype="sourcerer:main"` — D-122's
  lookup key exists today.
- Phase 2's zero-dependency BiDi harness (`scripts/lib/firefox-bidi.mjs`)
  drives the built binary for the automated checks.
- The `@sourcerer/token-gate` backend extension is the established shape for
  backend-side code (a `BackendApplicationContribution` composed into the
  app), which D-109's watchdog follows.

### Established Patterns
- One anti-corruption layer: every new Firefox-internals touch is a named
  `SourcererAPI` method plus an `INTERNAL-APIS.md` row, enforced by
  `check-internals-boundary.sh` (D-96/D-97).
- Guard script with `--self-test` that plants a violating fixture and asserts
  it IS caught (D-68) — D-125 copies this for the leftover-reaping control.
- Every negative assertion ships a positive control (02-LEARNINGS) — "no
  orphan survives" is a negative assertion.
- Bounded poll rather than point-in-time assertion for async state
  (02-LEARNINGS).
- One verification script per phase, extended never siblinged.
- Tiered rebuild discipline (D-70/D-72): `.xhtml`/`.mjs`/`.js` edits under
  `sourcerer/shell/` are tier 1 once symlinked; `jar.mn` edits are tier 2; a
  compiled-define change is tier 3 (~50 min). Nothing in this phase should
  need tier 3 — no `moz.configure` change is planned.

### Integration Points
- `sourcerer/shell/TheiaService.sys.mjs` — give-up threshold in
  `_healthLoop()`/`_restart()`, idempotent `start()`, state-file write in
  `_spawnAndGate()`, startup leftover reap before the first spawn
- `sourcerer/shell/SourcererAPI.sys.mjs` + `sourcerer/INTERNAL-APIS.md` — new
  touchpoints: window lookup by windowtype, command-line handler
  registration, signalling a bare pid, reading/writing the state file,
  reading app identity for D-119
- `sourcerer/shell/sourcerer.xhtml` / `sourcerer.css` / `sourcerer.js` —
  error and diagnostics layers, the D-118 key handler
- `theia/extensions/<watchdog>/` — D-109's stdin-EOF watchdog, either
  extending `token-gate` or a new sibling `@sourcerer/*` package added to
  `theia/applications/browser/package.json`
- `scripts/verify-phase-05.sh` (new), `scripts/verify-branding-identity.mjs`
  (D-120 repoint)

### Environment constraint
- Repo path has no spaces (linker breaks otherwise — `CLAUDE.md`); Firefox
  work in `nix develop .#firefox`, Theia work in `nix develop .#theia`; never
  `mach bootstrap`.
- The Phase 4 lesson recorded in WINDOWS #2–4: an apparently environmental
  headless failure was six real defects, and the discriminator was a BiDi
  session succeeding against `objdir-release` while failing against `objdir`.
  Do not accept "environmental" as a diagnosis without that kind of
  discriminator.

</code_context>

<specifics>
## Specific Ideas

- Verification shape (user-confirmed): `verify-phase-05.sh` asserts
  SIGKILL-leaves-no-descendant paired with a planted-leftover positive
  control (D-125), single-instance (second launch focuses, no second backend
  spawned), the give-up-to-error-state transition, and the diagnostics layer
  reachable with the backend down. Final gate also reruns `verify-phase-03.sh`
  and `verify-phase-04.sh` at the same commit (D-127). One human item:
  criterion 5's full working day, recorded in `05-MANUAL-VERIFICATION.md`
  (D-126).
- WINDOWS #6 closes as a side effect of D-119, not as separate work: give the
  diagnostics layer identity fields, then point
  `verify-branding-identity.mjs`'s about-support surface at them.
- The three chrome layers (loading, error, diagnostics) should read as one
  family — same deck, same minimal branded treatment as the existing loading
  layer, no new visual vocabulary.

</specifics>

<deferred>
## Deferred Ideas

- **WINDOWS ledger item #5 — the endpoint allowlist's new hosts.** With a
  working shell, Gecko resolves three hosts absent from the BRAND-04
  allowlist: `127.0.0.1` (the sidecar, expected and architectural),
  `ciscobinary.openh264.org` (GMP manager, now woken by a real content page),
  and `github.com` (reached by the Theia **frontend**). Not a code defect —
  Phase 4 created a network surface D-83..D-88 never contemplated, and every
  existing allowlist entry carries a reasoned decision, so this needs a
  product/privacy call. Explicitly **not** Phase 5 scope; handle at milestone
  close or in its own gap-closure work. Note `workflow.windows_enforce` is
  currently `false`, so it does not block `/gsd-ship` today.
- **Forwarding command-line paths into the IDE** (`sourcerer some/file.ts`
  opening that file) — post-4.0. Needs a Theia-side open handler and a
  chrome-to-sidecar command channel; Phase 2's URI schemes (URI-01..04) give
  it a natural shape once the bridge exists.
- **A second shell window sharing one backend** (two-monitor daily driving) —
  post-4.0. Nearly free given the pinned port, but it invents multi-window
  semantics ahead of the chrome-owned tab model (CHROME-01).
- **`about:` page reachability / remote-type switching** — post-4.0
  (CHROME-01). Would restore `about:support`, `about:config` and friends for
  daily driving; D-120 removes the verification dependency on it in the
  meantime.
- **A `--diagnostics` command-line flag** opening the shell straight into the
  diagnostics layer — considered for D-118 and not chosen. Would be useful for
  a scripted check or a build that will not paint; revisit if the verification
  script wants it.
- **SEED-001 unified SQL store** (tabs/history/sessions/bookmarks), engine
  choice, schema, MCP organiser — still dormant until the chrome-owned tab
  model is scoped post-4.0. D-110's state file is deliberately not a step
  toward it.
- **WINDOWS ledger item #1** (Phase 2:
  `SourcererPrivilegedJsSurface.tabUriRegistry` always undefined) — untouched
  by this phase; still open.
- **`@sourcerer/browser-bridge`, chrome tab strip, URL bar** — post-4.0
  (CHROME-01/02), unchanged from Phase 2/3/4 deferrals.

</deferred>

---

*Phase: 5-Lifecycle & Failure Hardening*
*Context gathered: 2026-08-27*
