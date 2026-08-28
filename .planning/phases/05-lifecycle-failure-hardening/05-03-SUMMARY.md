---
phase: 05-lifecycle-failure-hardening
plan: 03
subsystem: infra
tags: [firefox, xul-keyset, app-identity, branding, diagnostics, theia, sourcerer]

# Dependency graph
requires:
  - phase: 05-lifecycle-failure-hardening
    plan: 02
    provides: "The error layer, its previously-inert Details control, the give-up/error-state sentinel shapes, and scripts/verify-phase-05.sh's start_shell/--only harness"
  - phase: 05-lifecycle-failure-hardening
    plan: 01
    provides: "TheiaService.getState()/getRecentLog() accessors this plan's diagnostics layer renders unchanged"
provides:
  - "SHELL-04 in full -- a chrome-rendered diagnostics layer shows the sidecar's port/pid/health/restart-count/recent-log plus the running application's brand/vendor/version, reachable via a reserved Ctrl+Alt+Shift+D chord or the error layer's Details control, reading chrome-process state only so it stays alive while the backend is dead"
  - "SourcererAPI.getAppIdentity() -- the one accessor both the startup identity sentinel and the diagnostics layer read, so they can never disagree"
  - "WINDOWS.md #6 closed by repointing verify-branding-identity.mjs's third surface (runtime-identity) at that same accessor, not by waiving it"
  - "scripts/verify-phase-05.sh's shell04-diagnostics-with-backend-down check"
affects: [05-04, 05-05]

actuals:
  tokens: 15094
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "AppConstants.MOZ_APP_VERSION_DISPLAY reached via the same module-level lazy-getter block as Subprocess/ctypes -- AppConstants is on FORBIDDEN_PATTERNS in full, so it is imported nowhere else and every occurrence line is catalogued individually (guard's own per-line grain)"
    - "Diagnostics sentinel is written on EVERY call to the show global, open or close (toggle) -- not just on open -- so 'call it twice' is a symmetric, verifiable contract (two calls, two sentinels, final state hidden), matching Task 1's literal acceptance criteria over the plan's looser prose paraphrase"
    - "verify-branding-identity.mjs's runtime-identity surface launches the built binary headless and reads a stdout sentinel directly (spawn + regex, mirroring firefox-bidi.mjs's own spawn-and-wait shape) instead of driving a WebDriver BiDi session -- zero dependency on ./lib/firefox-bidi.mjs for this surface now"

key-files:
  created: []
  modified:
    - sourcerer/shell/SourcererAPI.sys.mjs
    - sourcerer/shell/sourcerer.xhtml
    - sourcerer/shell/sourcerer.css
    - sourcerer/shell/sourcerer.js
    - sourcerer/INTERNAL-APIS.md
    - scripts/verify-branding-identity.mjs
    - scripts/verify-phase-05.sh
    - .planning/WINDOWS.md

key-decisions:
  - "Toggle semantics win over the plan's must_haves prose: 'calling the show global twice leaves the layer hidden and produces exactly two sentinel lines' (Task 1 acceptance criteria) and the recorded decision 'the same chord closes the layer when it is already open' both specify toggle-with-a-sentinel-on-every-call; the must_haves line 'opening the layer twice ... emits one state change' doesn't type-check under toggle (the second call is a close, not a second open) and is read as a loose paraphrase, not a separate requirement -- implemented as literal toggle, sentinel on every call."
  - "AppConstants.MOZ_APP_VERSION_DISPLAY (not a new SourcererAPI.readFile-style accessor) backs the version field -- it's the exact preprocessor substitution about:support's own version string already used (upstream/browser/config/version_display.txt), so the repointed check and the diagnostics layer read the identical build-time constant the old about-support surface implicitly trusted."
  - "objdir-release was stale since 2026-08-21 -- it predates the entire shell-window feature (introduced 2026-08-26, commit f835f6e), so it had no sourcerer/shell/ chrome content wired in at all. This was invisible under the OLD about-support surface (which drove a normal about:support page, never the shell's own chrome window) and only surfaced once the runtime-identity surface needed the shell's own SOURCERER_APP_IDENTITY sentinel. Fixed with the one documented full release rebuild (docs/BUILD.md's SOURCERER_OBJDIR=objdir-release SOURCERER_BRANDING=sourcerer/branding/release ./mach build) -- Rule 3 (auto-fix blocking issue), not a package install and not an architectural change. Took 247s wall time (sccache-warm delta build), not the ~47min docs/BUILD.md measured for a from-scratch release build."
  - "shell04-diagnostics-with-backend-down automates only what this repo can automate without chrome-context driving: the startup identity sentinel's population (fully automated, no driver needed) and the error layer's Details control being present/enabled in the shipped markup (the plan's own named fallback). Opening the diagnostics layer itself needs chrome-context automation, confirmed blocked on Linux by 05-02's Discriminator B (moz:windowless is AppInfo.isMac-only) -- routed to the human record rather than fabricated as a pass, matching 05-02's identical treatment of the Retry-button click."

patterns-established:
  - "verify-branding-identity.mjs surfaces that need a live process read now have two shapes side by side: BiDi-page-driven (about:support's replacement pattern, still used by nothing else currently) and spawn-and-scrape-stdout (runtime-identity) -- future surfaces needing chrome-only data should prefer the latter; it needs no WebDriver session at all."

requirements-completed: [SHELL-04]

coverage:
  - id: D1
    description: "The diagnostics layer shows port, pid, health status, restart count and recent log, reading chrome-process state only (TheiaService.getState()/getRecentLog(), never the network) -- reachable at any time including while the backend is down"
    requirement: SHELL-04
    verification:
      - kind: e2e
        ref: "bash scripts/verify-phase-05.sh --only shell04-diagnostics-with-backend-down"
        status: pass
      - kind: unit
        ref: "Code review: sourcererShowDiagnostics reads TheiaService.getState()/getRecentLog() and SourcererAPI.getAppIdentity() only, renders via textContent (grep -c innerHTML sourcerer.js == 0), no network call anywhere in the function"
        status: pass
    human_judgment: true
    rationale: "Opening the layer itself and reading its rendered port/pid fields needs chrome-context driving (the chord or the Details click), confirmed blocked on Linux by 05-02's Discriminator B (WINDOWS.md #7, scripts/lib/firefox-marionette.mjs does not exist). The identity half (SOURCERER_APP_IDENTITY, alive with the backend down) and the markup half (Details control present/enabled) are automated; the live rendered-fields read is not, and is routed to the human record rather than asserted."
  - id: D2
    description: "The diagnostics layer also shows the running application's brand name, vendor and version, read from the running process (SourcererAPI.getAppIdentity()) rather than a build file"
    requirement: SHELL-04
    verification:
      - kind: e2e
        ref: "Live run: SOURCERER_APP_IDENTITY {\"name\":\"Sourcerer\",\"vendor\":\"Deocracy\",\"version\":\"153.1.0esr\"} emitted at startup, independent of the backend"
        status: pass
      - kind: e2e
        ref: "node scripts/verify-branding-identity.mjs (dev) and --variant release, runtime-identity surface, both PASS"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reachable by a reserved Ctrl+Alt+Shift+D chord immune to a focused content page, and from the error state's Details control (now enabled, no longer inert)"
    requirement: SHELL-04
    verification:
      - kind: unit
        ref: "Code review: XUL <keyset>/<key reserved=\"true\"> registered in sourcerer.js after TheiaService.start(); #sourcerer-error-diagnostics has no disabled attribute in sourcerer.xhtml (asserted by shell04-diagnostics-with-backend-down)"
        status: pass
    human_judgment: true
    rationale: "Actually pressing the chord or clicking Details and observing the layer open needs chrome-context driving, blocked on Linux (same Discriminator B gap as D1). Routed to the human record."
  - id: D4
    description: "Toggle/idempotency: calling the show global while the layer is visible hides it (same chord opens and closes); neither call throws; exactly one sentinel per call"
    requirement: SHELL-04
    verification:
      - kind: unit
        ref: "Code review: sourcererShowDiagnostics's wasVisible branch flips display and writes the sentinel on both paths; no exception path in either branch"
        status: pass
    human_judgment: true
    rationale: "Same Discriminator B gap -- verifiable live only via chrome-context driving of the two-calls-in-a-row scenario Task 1's acceptance criteria describes. Implementation reviewed and matches the spec; not live-exercised."
  - id: D5
    description: "The startup identity sentinel and the diagnostics layer read the same identity accessor, so the repointed branding check and the rendered surface can never disagree"
    requirement: SHELL-04
    verification:
      - kind: unit
        ref: "grep -n getAppIdentity sourcerer/shell/sourcerer.js -- called from both the startup-sentinel line and sourcererShowDiagnostics, same SourcererAPI import, no duplicate accessor"
        status: pass
    human_judgment: false
  - id: D6
    description: "WINDOWS ledger item #6 is fixed by repointing verify-branding-identity.mjs's third surface at the diagnostics-layer identity accessor, not by waiving it; all six branding-identity surfaces PASS on both build variants"
    requirement: SHELL-04
    verification:
      - kind: e2e
        ref: "node scripts/verify-branding-identity.mjs && node scripts/verify-branding-identity.mjs --variant release (6/6 surfaces each, PASS)"
        status: pass
      - kind: e2e
        ref: "node scripts/verify-branding-identity.mjs --positive-control runtime-identity (correctly reports FAILURE against the stock Firefox value)"
        status: pass
      - kind: integration
        ref: "bash scripts/verify-phase-03.sh (verify-branding-identity-dev/release both PASS; only verify-endpoints stays red, under the separately-deferred WINDOWS #5)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Nothing that grants access to the backend appears on the diagnostics surface or in its sentinel -- no per-launch token, no cookie value"
    requirement: SHELL-04
    verification:
      - kind: unit
        ref: "Code review: SOURCERER_DIAGNOSTICS sentinel JSON carries only port/pid/healthy/restartCount/name/vendor/version/logLines -- no this._token reference anywhere in sourcererShowDiagnostics or getAppIdentity"
        status: pass
    human_judgment: false
  - id: D8
    description: "Every new Firefox internal reached in this plan has a named SourcererAPI method and a matching sourcerer/INTERNAL-APIS.md row; the boundary guard stays green"
    requirement: SHELL-04
    verification:
      - kind: unit
        ref: "bash scripts/check-internals-boundary.sh && bash scripts/check-internals-boundary.sh --catalogue && bash scripts/check-internals-boundary.sh --self-test"
        status: pass
    human_judgment: false

duration: ~70min
completed: 2026-08-28
status: complete
---

# Phase 5 Plan 3: The Diagnostics Layer and the Repointed Identity Check Summary

**A third chrome-rendered deck layer shows the sidecar's port/pid/health/restart-count/log plus the running app's brand/vendor/version -- reachable via Ctrl+Alt+Shift+D or the error layer's now-live Details control -- and the branding-identity checklist's third surface now reads that same `SourcererAPI.getAppIdentity()` accessor instead of an unreachable `about:support` page, closing WINDOWS.md #6 by repointing rather than waiving it.**

## Performance

- **Duration:** ~70 min
- **Completed:** 2026-08-28
- **Tasks:** 2
- **Files modified:** 8 (0 created)

## Accomplishments

- **`SourcererAPI.getAppIdentity()`**: never-throw read of `Services.appinfo.name`/`.vendor` and `AppConstants.MOZ_APP_VERSION_DISPLAY`, added to the existing module-level lazy-getter block (`AppConstants` is on the boundary guard's forbidden-pattern list in full). Live-verified on a real launch: `SOURCERER_APP_IDENTITY {"name":"Sourcerer","vendor":"Deocracy","version":"153.1.0esr"}`.
- **The diagnostics layer** (`#sourcerer-diagnostics`) joins the deck as the third member in `sourcerer.xhtml`/`sourcerer.css`, same visual family as loading/error, above both in stacking order. `sourcererShowDiagnostics()`/`sourcererHideDiagnostics()` window globals render port/pid/health/restart-count/name/vendor/version as text nodes (never markup) plus the recent log in a monospace scrollable block, and toggle: calling show while visible hides it. A `SOURCERER_DIAGNOSTICS` sentinel (seven field values plus log-line count, never the log text, never a credential) is written on every call, open or close.
- **The `Ctrl+Alt+Shift+D` chord** (D-118): a reserved XUL `<keyset>`/`<key>`, registered after `TheiaService.start()`, immune to a focused content `<browser>` swallowing it. The error layer's previously-inert Details control is now wired to the same global with its `disabled` attribute and 05-03 marker comment removed.
- **The startup identity sentinel**: `SOURCERER_APP_IDENTITY` written once, unconditionally, right after the existing sidecar-prefs sentinel and before `TheiaService.start()` -- so it never depends on a live backend, a display, or a driver. Read by the same accessor the diagnostics layer uses.
- **`INTERNAL-APIS.md`**: three new catalogue rows (the `AppConstants` lazy import, the `Services.appinfo` read, the `MOZ_APP_VERSION_DISPLAY` read), with a shared "Identity row" threat paragraph stating the layer renders state and identity only and carries no credential. Every row shifted by the edit was renumbered and cross-checked against `check-internals-boundary.sh --catalogue`'s own output (18 occurrence lines, all now matched).
- **WINDOWS.md #6 closed by repointing, not waiving.** `verify-branding-identity.mjs`'s third surface, renamed `runtime-identity`, now launches the built binary headless with a throwaway profile and reads `SOURCERER_APP_IDENTITY` off stdout directly (spawn + regex, no WebDriver BiDi session, dropping the file's dependency on `./lib/firefox-bidi.mjs` for this surface). All six surfaces PASS on both the dev and release variants; the positive control correctly reports FAILURE against the stock Firefox value.
- **`objdir-release` was stale** (last built 2026-08-21, predating the entire shell-window feature, commit `f835f6e`, 2026-08-26) -- invisible under the old about-support surface, which never touched the shell's own chrome window. Surfaced the moment `runtime-identity` needed it; fixed with the one documented full release rebuild.
- **`shell04-diagnostics-with-backend-down`** added to `scripts/verify-phase-05.sh`: launches with `backendMain` pointed at a nonexistent path (no backend ever spawns), asserts `SOURCERER_SHELL_ERROR` is `recoverable:false`, the startup identity sentinel is populated, and the error layer's Details control is present/enabled in the shipped markup.

## Task Commits

1. **Task 1: The diagnostics layer, the identity accessor, and the chord** -- `339db40` (feat)
2. **Task 2: Reachable with the backend down, and the repointed identity surface** -- `c78379a` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `sourcerer/shell/SourcererAPI.sys.mjs` -- `getAppIdentity()`; `AppConstants` added to the lazy-getter block
- `sourcerer/shell/sourcerer.xhtml` -- `#sourcerer-diagnostics` layer (fields container, log block, close control); `#sourcerer-error-diagnostics` no longer disabled
- `sourcerer/shell/sourcerer.css` -- `#sourcerer-diagnostics`'s rule blocks, same family as loading/error, highest z-index; dropped the now-vestigial `:disabled` rule
- `sourcerer/shell/sourcerer.js` -- `sourcererShowDiagnostics`/`sourcererHideDiagnostics` globals, the reserved chord, the startup identity sentinel, the Details-button wiring simplified (no longer typeof-guarded)
- `sourcerer/INTERNAL-APIS.md` -- three new rows (identity accessor's touchpoints); every shifted row renumbered
- `scripts/verify-branding-identity.mjs` -- `about-support` surface replaced by `runtime-identity` (spawn+stdout-sentinel read); `withFirefoxPage`/`firefox-bidi.mjs` import dropped
- `scripts/verify-phase-05.sh` -- `shell04-diagnostics-with-backend-down`
- `.planning/WINDOWS.md` -- entry 6 marked `fixed`, resolved at `c78379a`

## Decisions Made

See `key-decisions` in frontmatter for the full list with citations. Summary:

- Toggle semantics (sentinel on every call, open or close) implemented literally per Task 1's acceptance criteria and the D-118 recorded decision, over the must_haves prose's looser "opens" paraphrase.
- `AppConstants.MOZ_APP_VERSION_DISPLAY` is the version source, matching the same preprocessor constant `about:support` itself used.
- `objdir-release`'s staleness was a genuine pre-existing gap (Rule 3 blocking-issue fix), not something this plan's edits caused -- fixed with the project's own documented rebuild command.
- `shell04-diagnostics-with-backend-down` automates exactly what this repo can automate without chrome-context driving; the rest is routed to the human record, matching 05-02's precedent for the Retry button.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `objdir-release` was stale, predating the entire shell-window feature**
- **Found during:** Task 2, first run of `node scripts/verify-branding-identity.mjs --variant release`
- **Issue:** `objdir-release/dist/bin/browser/chrome/browser/content/sourcerer/` did not exist at all -- the release objdir was last built 2026-08-21, before `sourcerer/shell/jar.mn`'s sourcerer entries were introduced (commit `f835f6e`, 2026-08-26). The old about-support surface never exercised the shell's own chrome window (it drove a plain `about:support` page), so this gap was invisible until `runtime-identity` needed the shell's `SOURCERER_APP_IDENTITY` sentinel.
- **Fix:** Ran the project's own documented full release rebuild: `SOURCERER_OBJDIR=objdir-release SOURCERER_BRANDING=sourcerer/branding/release MOZCONFIG=../.mozconfig ./mach build` inside `nix develop .#firefox`. Completed in 247s (sccache-warm delta build, not the ~47min docs/BUILD.md measured for a from-scratch build).
- **Files modified:** None (build-output directory, gitignored)
- **Verification:** `node scripts/verify-branding-identity.mjs --variant release` now PASSes 6/6; `bash scripts/verify-phase-03.sh`'s `verify-branding-identity-release` check PASSes
- **Committed in:** N/A (no source change; the rebuild is reproducible from the existing `.mozconfig`/scripts, not a repo artifact)

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking issue), confined to build-environment staleness discovered by this plan's own verification, not caused by this plan's edits. No scope creep -- no architectural changes, no new dependencies, no npm/PyPI packages added.

## Issues Encountered

- **Chrome-context driving remains blocked on Linux** (05-02's Discriminator B, `WINDOWS.md` #7, unchanged by this plan). The diagnostics layer's live open-and-read behavior (D1/D3/D4 above) is code-reviewed and matches the spec but is not live-exercised by any automated check in this repo -- `scripts/lib/firefox-marionette.mjs` does not exist and cannot be made to work against `windowtype="sourcerer:main"` on this platform (`Capabilities.sys.mjs:708-720` gates `moz:windowless` to `AppInfo.isMac` only). `shell04-diagnostics-with-backend-down` automates the two halves that don't need a driver (the startup identity sentinel's population, and the Details control's presence/enabled state in the shipped markup) and names the gap explicitly rather than fabricating a pass. A future BiDi-capable chrome driver, or a manual chord-press/click during `05-05`'s human working-day verification (D-126), should close this -- same recommendation 05-02 recorded for the Retry button.

## User Setup Required

None -- no external service configuration required.

## Threat Flags

None -- `getAppIdentity()` is a read-only accessor over already-privileged, already-local data (`Services.appinfo`, a build-time preprocessor constant); it introduces no new network endpoint, auth path, file-access pattern, or schema change at a trust boundary.

## Next Phase Readiness

- SHELL-04 holds in the built binary for everything this repo can automate without chrome-context driving: `bash scripts/verify-phase-05.sh` exits 0 (9/9, including the new `shell04-diagnostics-with-backend-down`), `bash scripts/verify-phase-04.sh` exits 0 (10/10), `node scripts/verify-branding-identity.mjs` and its `--variant release` both exit 0 (6/6 surfaces each, third surface now `runtime-identity`), and `bash scripts/check-internals-boundary.sh`/`--catalogue`/`--self-test` all exit 0.
- `WINDOWS.md` #6 is fixed (resolved at commit `c78379a`); #7 (chrome-context driving blocked on Linux) remains open and unchanged by this plan -- it is a platform gate, not a defect this phase's scope can close.
- `objdir-release` is now current with the shell-window feature; future plans in this phase touching the shell no longer need to rediscover this staleness.

---
*Phase: 05-lifecycle-failure-hardening*
*Completed: 2026-08-28*

## Self-Check: PASSED

All modified/created files and both task commit hashes verified present on disk / in git log.
