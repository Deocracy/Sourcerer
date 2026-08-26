# Phase 4: Full-Window Theia Shell - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Launching Sourcerer opens one window that spawns and health-gates the Theia
sidecar and presents it full-window as the entire interface, with every
Firefox-internals touch funnelled through one file.

Delivers: `sourcerer.xhtml` (the startup window), `SourcererAPI.sys.mjs` (the
single anti-corruption layer), `TheiaService.sys.mjs` (the backend
supervisor), a `@sourcerer/*` backend extension enforcing the per-launch
token, `sourcerer/INTERNAL-APIS.md`, and `scripts/verify-phase-04.sh`.

Requirements: SHELL-01, SHELL-02, SHELL-05, SIDE-01, SIDE-02, SIDE-03.

**Not this phase:** orphan/SIGKILL hardening, single-instance behaviour,
exhausted-backoff error state, diagnostics page (all Phase 5: SIDE-04,
SIDE-05, SHELL-03, SHELL-04). No custom browser chrome of any kind — Theia's
own shell is the entire UI, unsuppressed. No tab model, no persistence layer
(see SEED-001 guardrails in decisions).

</domain>

<decisions>
## Implementation Decisions

### Window substitution (SHELL-01)

- **D-89:** `sourcerer.xhtml` becomes the startup window by repointing
  `BROWSER_CHROME_URL` to `chrome://sourcerer/content/sourcerer.xhtml` via a
  patch hunk in `upstream/browser/moz.configure` (currently line 19:
  `imply_option("BROWSER_CHROME_URL", "chrome://browser/content/browser.xhtml")`).
  Every consumer follows the constant — verified in-tree:
  `browser/modules/BrowserWindowTracker.sys.mjs:396`,
  `xpfe/appshell/AppWindow.cpp:2240`,
  `dom/clients/manager/ClientOpenWindowUtils.cpp:262`. Upstream
  `browser.xhtml` stays byte-untouched.
  — **Reversibility:** costly — the option is `set_as_define=True`
  (`toolkit/moz.configure:60-70`), so changing it regenerates
  `mozilla-config.h` and costs one full tier-3 rebuild (~50 min measured) in
  either direction. Once set, editing `sourcerer.xhtml` itself is tier 1.
  **Rejected:** repointing the `jar.mn` entry (window masquerades as
  browser.xhtml; jar.mn churns more across rebases) and a startup observer
  that suppresses the default window (fights BrowserContentHandler/BrowserGlue
  for first-window ownership).

- **D-90:** `sourcerer.xhtml` is **minimal, written from scratch** — one
  `<browser>` element, the loading-state deck, imports of our own modules
  only. It does NOT include `browser.js`, `gBrowser`, browser-sets, or any
  browser.xhtml init machinery. Phase 4 needs none of it (no tabs, no popups
  to re-host), and every line not imported is a line that cannot break on ESR
  rebase. The post-4.0 chrome milestone decides then whether to grow this
  file or restart from a gutted browser.xhtml — nothing in v4.0 welds that
  choice.

- **D-91:** The single `<browser>` runs **remote content**
  (`type="content" remote="true"`): the Theia page gets an ordinary content
  process with site isolation, never chrome privileges. (Claude discretion,
  recorded as a decision because it is security-relevant.)

### Build registration and patch layout

- **D-92:** The build learns about shell code via one patch hunk adding
  `DIRS += [...]` in `upstream/browser/moz.build`, pointing (through the
  existing `upstream/sourcerer` symlink, `scripts/fetch-upstream.sh:106`) at
  `sourcerer/shell/`. Our own `moz.build` + `jar.mn` inside `sourcerer/shell/`
  register `chrome://sourcerer/content/` and everything under it. All real
  content lives in our tree; jar.mn edits land at tier 2; `.xhtml`/`.mjs`
  edits are tier 1 once symlinked into `dist/bin`.
  **Rejected:** runtime `chrome.manifest` in `distribution/` (legacy path,
  outside jar/omni packaging, diverges from how everything else ships).

- **D-93:** New build wiring lives in a **new `patches/020-sourcerer-shell.patch`**
  carrying the `BROWSER_CHROME_URL` hunk and the `DIRS` hunk.
  `010-sourcerer-identity.patch` stays identity/configure only. One patch per
  concern; `scripts/apply-patches.sh` already replays in numeric order and
  its blob-hash non-vacuity assertion applies unchanged. Both hunks must pass
  `scripts/check-patch-surface.sh` (they do — config files, not compiled
  sources).

### First paint and swap (SHELL-05)

- **D-94:** The branded loading state is a **chrome-rendered layer in a
  stack/deck inside `sourcerer.xhtml`** — loading layer on top, the
  `<browser>` underneath. The overlay paints with the window (no network, no
  sidecar involvement); the `<browser>` performs exactly one navigation — to
  the Theia URL — once the health check passes. Window show never waits on
  backend readiness. Phase 5's SHELL-03 error state becomes another layer of
  the same deck rather than a new mechanism.
  **Rejected:** a loading page inside the `<browser>` (content-process
  lifecycle entangles with the real navigation; SHELL-03 requires
  chrome-rendered anyway).

- **D-95:** When the backend dies mid-session and the health loop restarts
  it, chrome does nothing visually — **Theia's own reconnect UI** handles the
  gap (`frontendConnectionTimeout` is already pinned in the app config, Phase
  1). Editor state survives in the loaded page; criterion 5's "session
  recovers without relaunching" is Theia's reconnect doing its job. The
  chrome overlay only ever shows pre-first-load.

### Internals boundary (SHELL-02)

- **D-96:** "Firefox internal" is defined **maximally**: any
  `ChromeUtils.importESModule` of a module outside `chrome://sourcerer/`,
  plus `Services.*`, `Cc`/`Ci`/XPCOM, and `AppConstants`. `sourcerer.xhtml`
  and `TheiaService.sys.mjs` import only our own modules; every escape hatch
  is a named method on `SourcererAPI.sys.mjs`. TheiaService is a *consumer*
  of the boundary — it gets Subprocess, prefs, observers, and cookies through
  SourcererAPI, never directly. Zero judgment calls in the rule keeps the
  guard script trivial and the ESR-rebase audit surface exactly one file.

- **D-97:** Criterion 4 is proven by a **checked-in guard script**
  `scripts/check-internals-boundary.sh`: scans `sourcerer/` (excluding
  `SourcererAPI.sys.mjs`) for the forbidden patterns, exits 1 on any hit, and
  ships a `--self-test` that plants a violating fixture and asserts it IS
  caught — the exact shape of `check-patch-surface.sh` and the D-68 idiom
  (negative assertions get scripts). Runs in `verify-phase-04.sh` and at
  every future rebase. `sourcerer/INTERNAL-APIS.md` is the human catalogue:
  file:line, purpose, and threat notes — its threat section inherits Phase
  2's D-29 (`ai-terminal` arbitrary execution) and D-66 (token does not
  protect page/assets; WS origin validator passes absent-Origin callers).

### Token gate (SIDE-02)

- **D-98:** The stock Theia token is insufficient by design — verified in
  `theia/node_modules/@theia/core/lib/node/hosting/browser-connection-token.js`:
  the backend mints its own UUID and its `expressMiddleware` **issues the
  cookie to any HTTP caller**, enforcing only on WS upgrade and opt-in
  routes. Sourcerer replaces the trust root: **TheiaService mints the token
  and passes it in the spawn environment**; a new `@sourcerer/*` backend
  extension (a `BackendApplicationContribution` pushing a handler onto
  `EarlyExpressMiddleware` — the seam core itself uses for the stock cookie
  bootstrap, and the seam D-63 already identified) **403s every HTTP request
  without the token, index.html and static assets included**, closing D-66's
  "anything reaching 127.0.0.1:PORT can load the page" gap. No Theia core
  patch; composes into the app like Phase 2's extensions.
  — **Reversibility:** reversible — one extension package and one env var.
  **Rejected:** rebinding stock `BrowserConnectionToken` to our value (stock
  enforcement stays WS-plus-opt-in, so plain HTTP still passes and SIDE-02
  explicitly fails; extra middleware is needed anyway, so the rebind buys
  nothing).

- **D-99:** The browser presents the token as a **chrome-set cookie**:
  SourcererAPI sets the token cookie for `http://127.0.0.1:<port>` via the
  cookie service *before* the `<browser>` ever navigates. Every request —
  page, assets, WS upgrade — carries it automatically and the token never
  appears in a URL. One SourcererAPI method, catalogued in INTERNAL-APIS.md.
  **Rejected:** token as query param on first load (token lands in URL
  history/logs; backend needs issue-on-first-load logic).

### Spawn contract (SIDE-01)

- **D-100:** TheiaService locates the sidecar via **Firefox prefs with dev
  defaults**: `sourcerer.sidecar.nodePath`, `.backendMain`, and related
  prefs, read through SourcererAPI, defaults baked in a default-prefs file
  pointing at this repo's `theia/` workspace and the pinned Node 22. Works
  when launched from the `.desktop` file (no shell env needed), survives
  daily-driver use; DIST-02/03 later ship different defaults with no code
  change. "Bundled" has no installer meaning until DIST — in v4.0 the dev
  tree is the bundle.
  **Rejected:** env vars at browser launch (a `.desktop`-launched browser has
  none; daily-driving would need a wrapper script) and a hardcoded relative
  path from the binary (welds the dev tree layout into chrome code).

- **D-101:** The spawn environment permanently carries Phase 2's D-55
  settings: `THEIA_CONFIG_DIR=$XDG_CONFIG_HOME/sourcerer` (with `mkdir -p`)
  and explicit `VSX_REGISTRY_URL` — this phase is their declared permanent
  home. Port binding follows SIDE-01's own text: bind port 0, read the
  assigned port back.

- **D-102:** No workspace is passed to the sidecar. **Theia's stock
  behavior** applies: its own last-workspace memory (persisted under
  `THEIA_CONFIG_DIR`) reopens the last workspace; first run shows the stock
  getting-started/open-workspace flow. Zero new pref semantics; the
  daily-driver feel is Theia behaving like itself.
  **Rejected:** a `workspaceDir` pref (duplicates workspace memory Theia
  already keeps; fights File > Open Workspace).

### Health loop and restart (SIDE-03)

- **D-103:** The health check probes a **tiny token-gated health endpoint
  exposed by the same `@sourcerer/*` backend extension** — one probe proves
  both liveness and that the token gate is enforcing (two criteria, one
  request). TheiaService polls it fast during the startup gate, slower
  steady-state; on crash or probe failure it restarts the backend with
  exponential backoff capped at a few seconds, **retrying indefinitely in
  Phase 4**. Phase 5 adds the give-up threshold and branded error state on
  top without changing the loop's shape.
  **Rejected:** probing `GET /` (pulls the whole index; 200 proves assets,
  not services) and process-alive-only (a wedged backend never fails; the
  SHELL-05 gate would paint Theia's connection-error page).

- **D-104:** **Port and token are per browser launch, not per spawn.** The
  first spawn binds port 0; every health-loop restart passes that same port
  explicitly, because the already-loaded Theia page reconnects to the origin
  it was loaded from — a fresh port would make reconnect impossible and
  silently break criterion 5. The token is likewise minted once per browser
  launch; the chrome-set cookie stays valid across restarts.
  — **Reversibility:** costly — getting this wrong is invisible until a
  crash-recovery test; the decision exists precisely because "bind 0 every
  spawn" reads correct and is not. Residual risk (pinned port stolen by
  another process during the restart gap) is a Phase 5 exhausted-backoff
  case, not handled here.
  **Rejected:** fresh port + forced page reload per restart (destroys loaded
  page state Theia's reconnect would preserve).

### Shutdown and logs

- **D-105:** Normal quit: TheiaService observes quit (via a SourcererAPI
  method wrapping the quit observer, e.g. `quit-application-granted`),
  **stops the health loop first** (quit never races a restart), sends
  SIGTERM, waits a short bounded grace for clean exit, then SIGKILL. Bounded
  so quit never hangs the browser. Phase 5 layers process-group kill
  semantics and startup leftover-cleanup on top (SIDE-04).
  **Rejected:** immediate SIGKILL (no flush; Phase 5 rebuilds the ordering
  anyway).

- **D-106:** TheiaService captures backend stdout/stderr into a **bounded
  in-memory ring buffer** (a few hundred lines) from day one, mirrored to
  the browser console for dev visibility. Phase 5's diagnostics page
  (SHELL-04, "recent log output") reads the buffer that already exists — no
  retrofit. Cost now: a few lines.

### SEED-001 storage guardrails

- **D-107:** Phase 4 introduces **no persistence of its own**. Port, PID,
  token, and log buffer are per-launch in-memory state; nothing writes
  session files, and no dependence on Firefox's SessionStore
  (`sessionstore.jsonlz4`) is added. This leaves the storage ground unbuilt-on
  for SEED-001's unified SQL store, whose first real consumer (the
  chrome-owned TabModel) is post-4.0.

- **D-108:** `sourcerer/INTERNAL-APIS.md` carries a line cataloguing
  SessionStore as a **deliberately-not-touched** internal, so the future
  store lands on clean ground. SEED-001 itself stays dormant — capture only,
  no schema or engine work in this milestone (engine choice SQLite vs DuckDB
  remains open in the seed).

### Claude's Discretion

- Exact deck/stack markup and loading-state visuals in `sourcerer.xhtml`
  (branded name + the BRAND-06 dev indicator already distinguishes dev
  builds; keep it minimal).
- Health-poll intervals and backoff constants (fast-gate vs steady-state
  numbers) — pick sensible values, record them in the plan.
- Exact SourcererAPI method names and signatures.
- How the assigned port is read back from the backend (stdout parse vs other
  mechanism) — researcher determines what the Theia backend actually
  announces; SIDE-01's bind-0-read-back contract is what's fixed.
- Ring buffer size and grace-period duration.
- Keyboard/quit shortcut handling in the minimal window (whatever XUL gives
  for free; no custom keybinding work this phase).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative requirements and architecture
- `docs/PRODUCT-REQUIREMENTS.md` — R1–R9, CONFIRMED 2026-08-19
- `docs/research/sourcerer-architecture.md` §Components 3, 3b, 4 —
  TheiaService / SourcererAPI / GUI shell architecture; §Repo & build strategy
- `.planning/REQUIREMENTS.md` — SHELL-01/02/05, SIDE-01/02/03 exact text
  (lines 28–40); phase-mapping note explaining why SIDE-03 is Phase 4
- `.planning/ROADMAP.md` — Phase 4 goal and success criteria 1–5

### Prior phase decisions this phase consumes
- `.planning/phases/02-sourcerer-theia-extensions/02-CONTEXT.md` — D-55
  (THEIA_CONFIG_DIR/VSX_REGISTRY_URL, lands here permanently), D-62/D-63
  (EarlyExpressMiddleware seam, build-time flag), D-66 (token/origin threat
  notes → INTERNAL-APIS.md), D-29 via deferred section
- `.planning/phases/02-sourcerer-theia-extensions/02-LEARNINGS.md` — BiDi
  harness pattern, bounded-poll pattern, `--headless --screenshot` fires
  before SPA settles, drivelist relink gotcha
- `.planning/phases/03-branded-firefox-fork/03-CONTEXT.md` — D-70/D-72/D-73
  (tiered rebuild + compiled-file boundary), D-74/D-75 (patch replay
  assertions), deferred section naming this phase's deliverables
- `docs/BUILD.md` — tiered rebuild loop, compiled-file boundary (D-72),
  measured build costs; §Firefox half for the dev loop this phase extends

### Firefox internals verified during this discussion (file:line, in `upstream/`)
- `browser/moz.configure:19` — `BROWSER_CHROME_URL` imply_option (patch
  target for D-89)
- `toolkit/moz.configure:60-70` — `BROWSER_CHROME_URL` is
  `set_as_define=True` → tier-3 rebuild when changed
- `browser/modules/BrowserWindowTracker.sys.mjs:396`,
  `xpfe/appshell/AppWindow.cpp:2240`,
  `dom/clients/manager/ClientOpenWindowUtils.cpp:262` — consumers of the
  constant (why repointing it is sufficient)
- `toolkit/modules/subprocess/Subprocess.sys.mjs` — spawn API,
  `options.environment` semantics (D-101)

### Theia internals verified during this discussion
- `theia/node_modules/@theia/core/lib/node/hosting/browser-connection-token.js`
  — stock token: issues cookie to any caller, enforces WS + opt-in only
  (why D-98 replaces it)
- `theia/node_modules/@theia/core/lib/node/hosting/backend-hosting-module.js:31-35`
  — where stock token/validators bind (what our extension coexists with)
- `theia/node_modules/@theia/core/lib/node/backend-application.js:72,174-217`
  — `--hostname` CLI param, `server.listen(port, hostname)` path (SIDE-01
  bind target)
- `theia/applications/browser/package.json` — app config incl.
  `frontendConnectionTimeout: 3000` (D-95) and the start script whose env
  (D-55) moves into the spawn contract

### Repo scripts whose idiom this phase extends
- `scripts/apply-patches.sh` — patch replay + non-vacuity assertion (020
  patch rides this)
- `scripts/check-patch-surface.sh` — guard-script-with-self-test shape that
  `check-internals-boundary.sh` copies
- `scripts/verify-phase-03.sh` — verification script shape for
  `verify-phase-04.sh`

### Project rules
- `CLAUDE.md` (repo root) — hard rules: never fork/patch Theia core, never
  modify Gecko outside the patch-set model, Theia is the only GUI, design
  for the bridge
- `.planning/seeds/SEED-001-sql-tab-state-machine.md` — dormant; D-107/D-108
  guardrails reference it; do NOT act on its contents this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `theia/` workspace builds and runs standalone (Phase 1/2); the backend the
  supervisor spawns already exists — this phase adds one backend extension
  and the chrome side
- `upstream/sourcerer` symlink (`scripts/fetch-upstream.sh:106`) already
  routes `sourcerer/` into the build tree — D-92's DIRS hunk resolves
  through it
- Phase 2's zero-dependency WebDriver BiDi harness (Node global WebSocket,
  `--remote-debugging-port`) — drives the built Sourcerer binary for
  verification
- `patches/010-sourcerer-identity.patch` + `apply-patches.sh` — the patch
  mechanism 020 joins
- BRAND-06 dev indicator — dev builds already visually distinct; loading
  state needs no separate dev marker

### Established Patterns
- Guard script with `--self-test` planting a violating fixture (D-68,
  check-patch-surface.sh) — copied by check-internals-boundary.sh
- Bounded poll instead of point-in-time assertion for async UI state
  (02-LEARNINGS) — required for "Theia shell settled" checks
- Every negative assertion ships a positive control (02-LEARNINGS) —
  token-rejection test must pair with a with-token 200
- One verification script per phase, extended never siblinged
- Tiered rebuild discipline: know which tier each file type lands in before
  planning the dev loop (D-70/D-72)

### Integration Points
- `patches/020-sourcerer-shell.patch` → `browser/moz.configure` +
  `browser/moz.build`
- `sourcerer/shell/` → new: `sourcerer.xhtml`, `SourcererAPI.sys.mjs`,
  `TheiaService.sys.mjs`, `moz.build`, `jar.mn`
- `theia/extensions/<token-guard>/` → new `@sourcerer/*` backend extension;
  added to `theia/applications/browser/package.json` dependencies (the
  49-package freeze from Phase 2 D-23 gains one `@sourcerer/*` entry — the
  freeze governs `@theia/*` packages)
- `sourcerer/INTERNAL-APIS.md` → new; catalogued touchpoints from
  SourcererAPI + the D-108 SessionStore line
- `scripts/verify-phase-04.sh`, `scripts/check-internals-boundary.sh` → new

### Environment constraint
- Repo path has no spaces (linker breaks otherwise — CLAUDE.md); Firefox
  work in `nix develop .#firefox`, Theia work in `nix develop .#theia`;
  never `mach bootstrap`; full rebuild ~50 min, so D-89's define change
  should land once, early, in the phase

</code_context>

<specifics>
## Specific Ideas

- Verification shape (user-confirmed): `verify-phase-04.sh` = BiDi against
  the built binary asserting sourcerer.xhtml + settled Theia shell DOM
  (bounded poll), plain-HTTP-without-token → 403 with a with-token positive
  control, kill-backend-PID → poll recovery, and a
  `check-internals-boundary.sh` run. One human item only: "window paints its
  branded state immediately at launch" (end-of-phase human_verify_mode).
- The health probe doubles as the token-enforcement proof — one request,
  two criteria (D-103).
- SEED-001 discussion (2026-08-26) concluded: build nothing from it now;
  Phase 4's only obligations are D-107/D-108. Record this discussion in the
  seed's breadcrumbs.

</specifics>

<deferred>
## Deferred Ideas

- **Orphan/SIGKILL hardening, process-group kill, startup leftover cleanup**
  — Phase 5 (SIDE-04). D-105's TERM-grace-KILL is the Phase 4 floor it
  builds on.
- **Single-instance behaviour** — Phase 5 (SIDE-05).
- **Exhausted-backoff branded error state** — Phase 5 (SHELL-03); becomes
  another layer of D-94's deck.
- **Diagnostics page** — Phase 5 (SHELL-04); reads D-106's ring buffer.
- **Pinned-port-stolen-during-restart-gap handling** — Phase 5, as an
  exhausted-backoff case (D-104 residual risk).
- **SEED-001 unified SQL store (tabs/history/sessions/bookmarks), engine
  choice, schema, MCP organiser** — dormant until the chrome-owned tab
  model is scoped post-4.0. Phase 4 only keeps the ground clean
  (D-107/D-108).
- **`@sourcerer/browser-bridge`, chrome tab strip, URL bar** — post-4.0
  (CHROME-01/02), unchanged from Phase 2/3 deferrals.

</deferred>

---

*Phase: 4-Full-Window Theia Shell*
*Context gathered: 2026-08-26*
