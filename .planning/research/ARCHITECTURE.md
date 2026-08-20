# Architecture Research

**Domain:** Branded Firefox-ESR fork hosting Eclipse Theia IDE (desktop dev tool, substrate = real browser)
**Researched:** 2026-08-19
**Confidence:** HIGH — validates and concretizes the already-decided architecture in `docs/research/sourcerer-architecture.md`; no redesign proposed

This document scopes the **v4.0 subset only**: fork boots branded, Theia sidecar
supervised, Theia full-window is the sole GUI, `@sourcerer/customize` and
universal tab URIs ship. The chrome-owned tab strip, web tabs, browser-bridge,
and everything else in the master architecture sketch's milestones 2, 4, 5, 6
is out of scope for v4.0 and called out explicitly at the end of this document
so roadmap phases don't drift into it.

## Standard Architecture

### System Overview (v4.0 subset)

```
┌─────────────────────────────────────────────────────────────────┐
│ sourcerer.xhtml  (ours — replaces browser.xhtml)                │
│  v4.0 content: ONE persistent <browser remote="true"> element,  │
│  no tab strip, no toolbar, no URL bar. hidechrome/chromemargin  │
│  attributes strip stock decoration. Theia owns 100% of the      │
│  visible surface once loaded.                                   │
├─────────────────────────────────────────────────────────────────┤
│ Chrome-privileged modules (sourcerer/modules/)                  │
│  TheiaService.sys.mjs   — spawn/health-check/restart/kill       │
│  SourcererAPI.sys.mjs   — ONLY module touching Firefox internals│
├─────────────────────────────────────────────────────────────────┤
│ FIREFOX FRONTEND MACHINERY  (kept, invisible — SDK strategy)    │
│  profile/session init · Services.* · process observers ·        │
│  WebExtensions host present but unused in v4.0 (no chrome to    │
│  hang browserAction buttons on yet)                              │
├─────────────────────────────────────────────────────────────────┤
│ GECKO ENGINE  (untouched C++/Rust) — content process hosting    │
│  the single <browser>, GPU proc, socket proc                    │
└─────────────────────────────────────────────────────────────────┘
        │ Subprocess.sys.mjs spawns & supervises (child process)
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ THEIA BACKEND  (Node, 127.0.0.1:<port>, token-authenticated)    │
│  applications/browser target · node-pty · LSP servers ·         │
│  plugin host · @sourcerer/* extensions compiled in              │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | v4.0 concretization |
|-----------|-----------------|----------------------|
| `upstream/` | Pinned Firefox-ESR tag, untouched | git subtree/submodule at the pinned tag; never hand-edited |
| `patches/` | Real upstream code patches, applied at build time | Expected near-empty at v4.0 — the "gut visible UI" strategy replaces whole frontend files via the `sourcerer/` overlay rather than patching upstream code, so `patches/` is reserved for genuine Gecko/frontend-machinery deltas, not the rebrand/gut work |
| `sourcerer/` (tree) | Our frontend overlay + chrome modules + branding | See layout below |
| `sourcerer/chrome/content/sourcerer.xhtml` | Main window document, replaces `browser.xhtml` | v4.0: single `<browser>` element only (see "GUI shell" below) |
| `sourcerer/modules/TheiaService.sys.mjs` | Supervises the Theia backend child process | Subprocess.sys.mjs spawn, health-check polling, restart-with-backoff, SIGTERM→SIGKILL on quit, single-instance lock |
| `sourcerer/modules/SourcererAPI.sys.mjs` | Anti-corruption layer — sole touchpoint for Firefox internals | v4.0 surface is thin: default-chrome-URL override, quit-observer hooks, profile-dir lookup, `<browser>` crash recovery |
| `sourcerer/INTERNAL-APIS.md` | Catalogue of every internal-API touchpoint | One entry per thing `SourcererAPI.sys.mjs` touches; re-tested every ESR rebase |
| Theia npm workspace (`theia/`) | Independent build, own version lifecycle | Pinned Theia tag; `applications/browser` target (not Electron — decision D3, `05-theia-shell-customization.md`) |
| `@sourcerer/customize` | R4a — runtime CSS + dev-flagged JS layer | Build-once Theia extension, visually inert by default |
| `@sourcerer/*` Navigatable/URI extension(s) | R4b — every widget addressable by URI | Per-widget `getResourceUri()` + one `NavigatableWidgetOpenHandler` per scheme (`settings://`, `terminal://`, `chat://`, …) |
| Theia `product` extension | R1 Theia-side branding | Welcome tab, about dialog — same shape as `theia-extensions/product/` in `theia-ide` |
| CI | ESR rebase automation | Rebases `patches/` onto each ESR point release, fails loudly on conflict |
| `flake.nix` | Two isolated dev shells | `theia` (node 22, yarn 1.x, node-gyp toolchain) and `firefox` (`inputsFrom` nixpkgs' firefox-esr-unwrapped derivation, artifact-build config) |

## Recommended Project Structure

```
sourcerer/                              # repo root
├── flake.nix                           # two dev shells: theia, firefox
├── upstream/                           # pinned Firefox-ESR tag (git subtree), untouched
├── patches/                            # real upstream-code patches — near-empty at v4.0
├── sourcerer/                          # our frontend overlay + chrome modules
│   ├── branding/                       # icon, wordmark, locale strings (R1, Firefox side)
│   ├── chrome/
│   │   └── content/
│   │       └── sourcerer.xhtml         # v4.0: one <browser>, no tab strip/toolbar/urlbar
│   ├── modules/
│   │   ├── TheiaService.sys.mjs        # supervisor
│   │   └── SourcererAPI.sys.mjs        # anti-corruption layer
│   └── INTERNAL-APIS.md                # touchpoint catalogue (R3)
├── theia/                              # separate npm/yarn workspace, own lifecycle
│   ├── package.json                    # pins the Theia release tag
│   ├── applications/
│   │   └── browser/                    # Theia browser-target app (build target for v4.0)
│   └── sourcerer-extensions/
│       ├── customize/                  # @sourcerer/customize (R4a)
│       ├── navigable-*/                # @sourcerer/* Navigatable/URI work (R4b), one per widget family or grouped
│       └── product/                    # Theia-side branding (R1)
└── ci/                                 # ESR rebase automation, patch-conflict CI
```

### Structure Rationale

- **`upstream/` + `patches/` split:** Zen/Floorp pattern — keeps the diff against
  Mozilla small and mechanically rebaseable; `patches/` staying near-empty at
  v4.0 is expected and correct, not a gap. Real patch usage starts once
  milestone 2+ needs to touch frontend machinery that can't be handled by a
  full-file overlay in `sourcerer/`.
- **`sourcerer/` vs `theia/` as two independent trees:** mirrors the already-decided
  "decoupled builds" strategy (PROJECT.md Context) — the Theia sidecar boots
  standalone in any browser via `yarn watch`, with zero Firefox build in the
  loop, so this split is not organizational preference, it is the thing that
  makes the two-dev-shell setup possible at all.
- **`sourcerer-extensions/` naming:** matches the `theia-ide` repo's own
  `theia-extensions/<name>/` convention (confirmed in
  `05-theia-shell-customization.md` §6) — new extensions are added to
  `theia/applications/browser/package.json` dependencies exactly like Theia's
  own `product` extension is, so the pattern to copy already exists in the
  reference checkout.

## Architectural Patterns

### Pattern 1: Anti-corruption layer for unstable host internals

**What:** `SourcererAPI.sys.mjs` is the only module that imports Firefox
internals (`Services.*`, window/observer machinery). Everything else in
`sourcerer/` and all of `theia/` calls through it.
**When to use:** Any time the underlying platform (Firefox chrome JS) offers
no stability contract — which is the whole Firefox side (Theia's public APIs
are stable enough that discipline alone suffices there, no adapter needed).
**Trade-offs:** Buys one file to re-certify per ESR rebase instead of a full
audit; does not reduce how often upstream breaks, only how wide each break is.
Already decided (D5, `extension-model-decisions.md`) — this research confirms
it, does not introduce it.

### Pattern 2: Supervisor process with health-check-gated activation

**What:** `TheiaService.sys.mjs` does not point the `<browser>` at
`http://127.0.0.1:<port>` the instant the child process spawns — it polls a
health/readiness signal (HTTP probe or a parsed "listening" line on the
child's stdout) first, then flips the `<browser>`'s `src`. Until then the
window shows a static loading state, not a connection-refused error page.
**When to use:** Any child-process-backed localhost service driven by chrome
JS. Standard pattern for VS Code Desktop-style host/backend split.
**Trade-offs:** Adds a small amount of startup latency-hiding logic; the
alternative (set `src` immediately, let Gecko retry) produces a visible
error flash on every cold start — worse UX for a daily-driver app.

### Pattern 3: Gut-the-frontend, keep-the-machinery (SDK strategy)

**What:** `sourcerer.xhtml` replaces `browser.xhtml`'s visible DOM but keeps
Firefox's invisible init path (profile handling, session store, process
observers) running underneath, unused where not needed. Already identified
as the pragmatic middle option in `firefox-fork-browser-ide-research.md`
(option 3 of 3, "gut visible UI but keep tabbrowser/session machinery as
SDK").
**When to use:** v4.0 specifically — a true from-scratch frontend ("nobody
has sustained this" per the same research) is not worth attempting for a
single-`<browser>` window; a Zen-style restyle is unnecessary because v4.0
has no visible chrome to restyle at all.
**Trade-offs:** Machinery Firefox keeps running that v4.0 doesn't use (full
tabbrowser, most of `SessionStore`) is dead weight now but is exactly what
milestone 2 (`R5`, unified tab strip) needs alive — so it is not waste, it is
early payment for something already on the roadmap.

## Data Flow

### Startup Sequence

```
OS launches branded binary
    ↓
Gecko init → resolves default chrome URL to sourcerer.xhtml
  (override applied via SourcererAPI.sys.mjs at app-startup, not by
  patching browser.xhtml's own registration)
    ↓
sourcerer.xhtml onload → ChromeUtils.importESModule(TheiaService.sys.mjs)
    ↓
TheiaService: acquire single-instance lock → find free localhost port →
  generate auth token → Subprocess.sys.mjs spawns
  `node theia/applications/browser/lib/backend/main.js --port=N`
    ↓
TheiaService polls health endpoint / watches child stdout for ready signal
  (window shows static loading state, not a connection error, in the interim)
    ↓
Healthy → TheiaService sets the persistent <browser>'s src to
  http://127.0.0.1:N/?token=<token>
    ↓
Theia browser-target frontend boots inside that content process
  (standard Theia bootstrap: opens its own WebSocket back to the backend
  on the same port for LSP/pty/etc — orthogonal to the chrome↔backend link)
    ↓
Full-window Theia renders — its own native tab bar, activity bar, status
  bar all stay visible (nothing hides them at v4.0 — see "Do not build" below)
```

### Shutdown

```
User quits (Ctrl/Cmd-Q, window close, OS signal)
    ↓
Firefox's quit-application-requested / quit-application-granted
  observer notifications fire
    ↓
SourcererAPI-registered hook → TheiaService sends SIGTERM to child,
  waits N ms, SIGKILL if not exited
    ↓
Port + single-instance lock released → Gecko continues normal shutdown
```

### Crash / Restart Paths

Two distinct failure modes, requiring different handling:

1. **Theia backend (Node child) dies unexpectedly.** `TheiaService`'s
   `Subprocess.sys.mjs` wait-promise resolves with a non-shutdown-requested
   exit. Response: show a lightweight fallback state in the `<browser>` (a
   local `data:` URL, "Restarting IDE backend…") and respawn with backoff,
   capped retries before surfacing a persistent error + manual-reload
   control. This is the same principle as GUI consequence #8 in
   `extension-model-decisions.md` ("supervisor restarts Theia; GUI must
   degrade IDE tabs, never delete them") — v4.0 has only one surface instead
   of a tab strip, so "degrade in place" means the single `<browser>`, not a
   tab.
2. **Gecko content process hosting the `<browser>` crashes** (OOM-kill, GPU
   fault) — independent of the Node backend, which is still alive. Firefox's
   default behavior is `about:tabcrashed`; with no tab strip in v4.0 that
   default page would be user-facing and wrong. `SourcererAPI.sys.mjs` should
   listen for the `<browser>`'s `oop-browser-crashed` event and reload it
   directly against the still-running backend rather than showing the stock
   crashed-tab UI.

## Mechanism Research: Process Supervision & Full-Window Presentation

### Spawning and supervising the Theia backend

**`Subprocess.sys.mjs`** (successor to the retired `Subprocess.jsm`, moved to
the `.sys.mjs` ES-module convention) is the correct, current mechanism —
confidence HIGH, actively maintained by Mozilla, documented at
[firefox-source-docs.mozilla.org](https://firefox-source-docs.mozilla.org/toolkit/modules/subprocess/toolkit_modules/subprocess/index.html)
and implemented at
[searchfox.org/firefox-main/.../subprocess_unix.sys.mjs](https://searchfox.org/firefox-main/source/toolkit/modules/subprocess/subprocess_unix.sys.mjs).
It replaced `nsIProcess` for spawning Firefox's own Browser Toolbox process
back in Firefox 55, and Mozilla's own guidance is to migrate code off
`nsIProcess`
([bug 146475](https://bugzilla.mozilla.org/show_bug.cgi?id=146475), long
open, "nsIProcess is not fully implemented"). On Unix it uses `posix_spawn`
via js-ctypes and runs its I/O work on a worker thread rather than the main
thread — good properties for the health-check-polling pattern above, and for
piping stdin/stdout/stderr without blocking the chrome event loop.
**Recommendation: use `Subprocess.sys.mjs` for `TheiaService.sys.mjs`,
not `nsIProcess`.** This is a change from the architecture sketch's
parenthetical "(`nsIProcess` / `Subprocess.sys.mjs`)", which listed both —
this research resolves that to a single choice.

### Full-window presentation with hidden/stock chrome

Two real mechanisms exist; only one fits v4.0:

- **Kiosk mode (`--kiosk` command-line flag).** Mature, still present in
  Firefox in 2026, loads a single URL full-screen with all chrome (menus,
  awesome bar, toolbar, tabs) hidden. **Not recommended for Sourcerer**: it
  is a runtime flag on the *stock* browser window, not something a
  distributed branded app owns, and Mozilla's own kiosk documentation notes
  it intentionally restricts keyboard input (Ctrl/Alt combos) for
  point-of-sale-style lockdown — directly hostile to an IDE where Ctrl-based
  shortcuts are core to daily use. Confidence HIGH that this mechanism
  works; HIGH that it is the wrong mechanism for this product.
- **Custom main-window XHTML document with `hidechrome`/`chromemargin`
  attributes** — the mechanism the architecture sketch already assumes
  (`sourcerer.xhtml` "replaces `browser.xhtml`'s visible UI"). This is the
  same class of mechanism Zen Browser and Floorp use, and the underlying XUL
  `window` element attributes have existed since Firefox 1.0 with only minor
  churn (e.g. the `chromemargin` default value changed in Firefox 12,
  [bug 730219](https://bugzilla.mozilla.org/show_bug.cgi?id=730219)).
  Confidence HIGH — this is a live, well-precedented pattern, not a fragile
  one. **Recommendation: this is the only mechanism v4.0 should build.**
  v4.0's `sourcerer.xhtml` content is the minimal case of it: one
  `<browser remote="true">` element and nothing else — no toolbar markup, no
  tab-strip markup, because R5 (chrome-owned tabs) is out of scope for v4.0.

## Scaling Considerations

Not a multi-user/traffic-scaling system — "scale" here means growth in
product surface area across milestones, not concurrent users.

| Stage | Architecture Adjustments |
|-------|---------------------------|
| v4.0 (this milestone) | Single `<browser>`, no tab model. `TheiaService` and `SourcererAPI` carry their full v4.0 responsibility already — nothing here is a stub to be replaced, only extended |
| Milestone 2 (R5, unified tab strip) | `sourcerer.xhtml` DOM is substantially rewritten (tab strip + toolbar added); `TheiaService`/`SourcererAPI` gain new consumers (`SourcererBridge.sys.mjs`, `@sourcerer/browser-bridge`) but are not rewritten — same supervisor, more callers |
| Milestone 5+ (R7 surfacing, plugin API) | `SourcererAPI.sys.mjs` becomes the permission-check chokepoint (D6) — grows in scope, still the single file |

### Scaling Priorities

1. **First growth point:** the moment milestone 2 needs the chrome tab strip,
   `sourcerer.xhtml`'s DOM changes from "one `<browser>`" to "TabModel +
   strip + one-`<browser>`-per-web-tab + one persistent `<browser>` for
   Theia." Plan for this by keeping `TheiaService`/`SourcererAPI` ignorant of
   how many `<browser>` elements exist — v4.0 should not hard-code "there is
   exactly one `<browser>` in the document" logic inside those two modules;
   let `sourcerer.xhtml`'s own script own that count.
2. **Second growth point:** milestone 6+'s plugin-facing browser API turns
   `SourcererAPI.sys.mjs` into a permission-gated surface (D6) — no action
   needed now beyond not closing that door, which the anti-corruption-layer
   pattern already keeps open by construction.

## Anti-Patterns

### Anti-Pattern 1: Patching `browser.xhtml` in place

**What people do:** Modify the stock `browser.xhtml`/`browser.js` directly to
strip chrome down to nothing.
**Why it's wrong:** Every ESR rebase then has to re-resolve a real diff
against a file Mozilla actively changes; violates the CLAUDE.md hard rule
("never fork or patch Theia core") in spirit even though this is the Firefox
side — the same discipline (`SourcererAPI.sys.mjs` / overlay-not-patch)
applies to Firefox internals per R3.
**Do this instead:** Full-file overlay in `sourcerer/chrome/content/` that
replaces the default chrome URL registration, exactly as already decided.

### Anti-Pattern 2: Kiosk mode as the presentation mechanism

**What people do:** Reach for `--kiosk` because it is the fastest way to get
"full window, no chrome" working in an afternoon.
**Why it's wrong:** Restricts keyboard input in ways hostile to an IDE, and
is a stock-browser runtime flag rather than something the branded app owns
end to end — wrong foundation for a product where post-4.0 milestones need
full control of the same window.
**Do this instead:** Custom `sourcerer.xhtml` main-window document (see
Mechanism Research above) — costs more up front, is the correct permanent
foundation.

### Anti-Pattern 3: Setting `<browser>.src` before the backend is healthy

**What people do:** Spawn the child process and immediately point the
`<browser>` at `http://127.0.0.1:<port>`.
**Why it's wrong:** Node/Theia backend startup is not instantaneous;
first-paint becomes a visible connection-refused error before Gecko's retry
logic (if any) catches up — bad first impression on every cold start of a
daily-driver app.
**Do this instead:** Health-check-gated activation (Pattern 2 above).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|----------------------|-------|
| Theia backend (Node child process) | `Subprocess.sys.mjs` spawn, stdout/stderr pipes, HTTP health probe on `127.0.0.1:<port>` | Token-authenticated localhost per R2; token generated fresh per launch, passed via query string (acceptable since v4.0 has no visible URL bar to leak it into history) |
| Firefox ESR upstream | Pinned tag vendored into `upstream/`, rebased by CI | Never hand-edited; `patches/` carries any unavoidable deltas |
| Theia npm workspace | Own repo tree, own release cadence, versioned sidecar | Ships in lockstep with the browser build per the "sidecar lockstep" constraint in PROJECT.md |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|----------------|-------|
| `sourcerer.xhtml` ↔ `TheiaService.sys.mjs` | `ChromeUtils.importESModule`, direct calls | Chrome-privileged, same process, no serialization needed |
| `TheiaService.sys.mjs` ↔ Theia backend child | OS process (stdin/stdout/stderr pipes) + HTTP health probe | `Subprocess.sys.mjs`-mediated; the only network-shaped boundary in v4.0 |
| `sourcerer/*` ↔ Firefox internals | Exclusively through `SourcererAPI.sys.mjs` | Hard boundary per R3/D5 — no other file imports `Services.*` or touches window/observer machinery directly |
| `theia/` workspace ↔ `sourcerer/` tree | None at build time — fully decoupled | The only coupling is `TheiaService.sys.mjs` knowing the backend's launch command and port contract; this is intentionally the minimum possible coupling and matches the "decoupled builds" strategy already decided |

## Suggested Build Order (v4.0)

Dependencies, not calendar time — items on the same numbered step can run in
parallel.

**0. Two-shell Nix flake** (blocks everything). `theia` shell: node 22, yarn
1.x, node-gyp toolchain. `firefox` shell: `inputsFrom` nixpkgs'
firefox-esr-unwrapped derivation, artifact-build config
(`--enable-artifact-builds`). Verify every package attribute name against the
`nixos` MCP before writing the flake, not after a failed build — package
names were not independently re-verified in this research pass (confidence
MEDIUM on exact attribute names; HIGH on the overall two-shell approach,
which PROJECT.md already committed to).

**1. Theia sidecar, standalone** (depends on step 0's `theia` shell only —
zero Firefox build in the loop, confirming the decoupled-builds strategy).
Bootstrap the `theia/` workspace pinned to the chosen Theia tag; build and
boot `applications/browser` at localhost in any ordinary browser. This is the
validation gate before any `@sourcerer/*` work starts.

**2. Theia-side extensions, in parallel** (each depends on step 1 only, no
ordering among themselves):
- `@sourcerer/customize` (R4a)
- Per-widget `Navigatable`/URI work (R4b)
- Theia-side branding (`product` extension, R1)

**3. Firefox fork, branded, stock UI** (depends on step 0's `firefox` shell
only, independent of steps 1–2). Vendor `upstream/` at the pinned tag, get an
artifact build booting with stock Firefox chrome, then apply R1 Firefox-side
branding (icon, window title, installer name, about:) — validate branding
against the *unmodified* stock UI first, fewer moving parts to debug than
branding a UI mid-gut.

**4. `sourcerer.xhtml` gut + `SourcererAPI.sys.mjs` skeleton** (depends on
step 3). Replace `browser.xhtml`'s visible DOM with the single-`<browser>`
minimal shell; stand up the anti-corruption layer and
`sourcerer/INTERNAL-APIS.md` at the same time, since the moment chrome starts
overriding default-chrome-URL registration it is touching Firefox internals
and must go through the adapter from day one, not be retrofitted.

**5. `TheiaService.sys.mjs` + end-to-end wiring** (depends on step 1 AND step
4 — the true integration point). Spawn/health-check/restart/kill against the
already-working standalone backend from step 1; wire the healthy backend's
URL into `sourcerer.xhtml`'s `<browser>` via `SourcererAPI`. Steps 2's
extensions are already in `theia/`'s dependency graph by this point, so they
ride along automatically — no separate integration work needed for them.

**6. Crash/shutdown hardening** (depends on step 5). Single-instance lock,
SIGTERM/SIGKILL shutdown path, backend-crash restart-with-backoff,
`oop-browser-crashed` recovery. This is what makes step 5's build
daily-drivable rather than a demo.

v4.0 is "done" at the end of step 6: fork boots branded, Theia sidecar
supervised and healthy, full-window Theia is the sole GUI, R4a/R4b verified
inside the Firefox-hosted `<browser>` (re-verify the webview/codicon caveats
noted in R4a against the real Firefox-hosted build here, not against a
generic browser).

## What v4.0 Must Not Build (throwaway / scope-creep risk for later milestones)

Flagging these explicitly because they are the most likely places a phase
plan accidentally does more than v4.0 needs — either because the master
architecture sketch describes them as the *next* obvious step, or because
partially building them looks like natural progress.

| Item | Where it actually belongs | Why building it now is wrong |
|------|----------------------------|-------------------------------|
| Kiosk-mode (`--kiosk`) launcher | Nowhere — wrong mechanism entirely | Keyboard-hostile to an IDE; not the permanent foundation (see Anti-Pattern 2) |
| Any URL bar surface (Theia-side toolbar contribution *or* chrome-side) | Chrome-side, milestone 2+ (R5) | `05-theia-shell-customization.md` §7 already calls a Theia-side URL bar "throwaway" explicitly; R4b's job is only to make widgets *addressable*, not to add a visible address field anywhere |
| Hiding Theia's native tab bar via CSS | Milestone 2+, once the chrome tab strip exists to replace it | In v4.0, Theia's own tab bar/activity bar/status bar are the *entire* GUI — hiding them now with no replacement leaves the user with no way to manage editor tabs at all |
| `TabModel`, `gBrowser` web-tab creation, `SourcererBridge.sys.mjs` JSWindowActor pair, `@sourcerer/browser-bridge` postMessage protocol | Milestone 2/4 (R5) | Explicitly out of scope per PROJECT.md; none of it has a v4.0 consumer |
| Focus/keyboard arbitration policy (Ctrl-W/Ctrl-Tab/Ctrl-P chrome-vs-Theia ownership) | Milestone 2+ | Only matters once two surfaces (chrome tab strip + Theia) both want the same shortcuts; v4.0 has exactly one surface, so there is nothing to arbitrate |
| Custom plugin API namespace / permission model (D3/D6) | Milestone 6+ (D7) | Explicitly gated in `extension-model-decisions.md` on the bridge existing and its latency being measured first |
| Bundled portable Node binary, native-module prebuilds per OS/arch, installer packaging | Post-v4.0 packaging milestone | v4.0's finish line is a dev build on the NixOS host (PROJECT.md, Out of Scope); the dev shell's own `node` on `PATH` is sufficient for `Subprocess.sys.mjs` to spawn in v4.0 |
| Windows/macOS CI | Later milestone | Linux/NixOS is the only v4.0 target |

**Not throwaway, but substantially rewritten later (distinct from the above —
flag for expectations, not for scope-cutting):** `sourcerer.xhtml`'s v4.0
*contents* (bare single `<browser>`) will be significantly rebuilt when
milestone 2 adds the `TabModel`/tab-strip DOM. The *file itself* and its role
as the default chrome document are permanent; only the markup inside it at
v4.0 is a placeholder. Plan the phase so `TheiaService.sys.mjs` and
`SourcererAPI.sys.mjs` do not hard-code assumptions about there being exactly
one `<browser>` element in that document (see Scaling Considerations above) —
that one discipline is what keeps this rewrite cheap instead of a rework.

## Sources

- `docs/research/sourcerer-architecture.md` — authoritative layer diagram,
  component list, build order (validated, not redesigned, by this document)
- `docs/research/firefox-fork-browser-ide-research.md` — Electron-vs-Firefox
  verdict, "gut visible UI" strategy option
- `docs/research/tab-management-research/05-theia-shell-customization.md` —
  D1–D4 decisions, `applications/browser` as first build target, throwaway
  URL-bar finding
- `docs/research/extension-model-decisions.md` — D5/D6/D7, GUI consequence
  #8 (backend-crash degrade-in-place)
- [Subprocess Module — Firefox Source Docs](https://firefox-source-docs.mozilla.org/toolkit/modules/subprocess/toolkit_modules/subprocess/index.html) — confidence HIGH, official Mozilla docs
- [subprocess_unix.sys.mjs — searchfox](https://searchfox.org/firefox-main/source/toolkit/modules/subprocess/subprocess_unix.sys.mjs) — confidence HIGH, live source
- [Bugzilla 146475 — nsIProcess is not fully implemented](https://bugzilla.mozilla.org/show_bug.cgi?id=146475) — confidence MEDIUM (long-open bug, but corroborates the migration-away-from-nsIProcess guidance)
- [Bugzilla 730219 — chromemargin attribute behavior change](https://bugzilla.mozilla.org/show_bug.cgi?id=730219) — confidence MEDIUM, historical precedent for the mechanism's stability
- Firefox kiosk-mode documentation (Mozilla Support, IGEL knowledge base) — confidence HIGH on mechanism behavior, used here to justify *rejecting* the mechanism

---
*Architecture research for: Sourcerer v4.0 (Firefox-ESR + Theia IDE fork)*
*Researched: 2026-08-19*
