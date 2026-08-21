---
phase: 03-branded-firefox-fork
plan: 02
subsystem: testing
tags: [verification-harness, webdriver-bidi, strace, moz-log, firefox-esr, endpoint-allowlist]

# Dependency graph
requires:
  - phase: 03-branded-firefox-fork (plan 01)
    provides: "objdir/dist/bin/sourcerer -- the real, launchable, Sourcerer-branded binary this entire plan's harness runs against"
provides:
  - "scripts/verify-branding-identity.mjs -- BRAND-01's six-surface identity checklist, each an exact string/boolean equality with a coverage guard and three working positive controls"
  - "sourcerer/endpoint-allowlist.json -- the single machine-readable source of truth for every allowed/denied endpoint and pref, read by verify-endpoints.sh layers 1 and 3"
  - "scripts/verify-endpoints.sh -- BRAND-04's three proof layers (static prefs, strace filesystem, MOZ_LOG network), each with a working positive control observed going red"
  - "scripts/verify-phase-03.sh -- the phase's single re-runnable aggregator, --quick and full modes"
  - "scripts/apply-patches.sh --self-test -- a self-contained, proven-red control for D-75's adopted-patch assertion, reverse-deriving a byte-identical fixture rather than hand-typing one"
  - "scripts/lib/firefox-bidi.mjs's binPath parameterisation and --remote-allow-system-access -- reusable by 03-05's release-branding verification"
affects: [03-03, 03-05, 03-06]

# Actuals (#2632)
actuals:
  tokens: 15745
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every negative assertion ships a --positive-control that has been OBSERVED going red this session, not just written -- application-ini, about-support, and version surfaces; all three endpoint layers; apply-patches' D-75 assertion"
    - "Positive-control fixtures are derived from the real artifact (reverse-applying the real patch against a copy of the real post-patch file; substituting the real stock Firefox value) rather than hand-typed, so the fixture's identity (blob hash, live binary output) is provably the thing being tested, not a lookalike"
    - "External bash/node checks in an aggregator run under setsid so a SIGINT's process-group kill reaches whatever they background two layers deep, mirroring verify-phase-02.sh's own SERVER_PID/kill -- \"-$PID\" idiom"

key-files:
  created:
    - scripts/verify-branding-identity.mjs
    - sourcerer/endpoint-allowlist.json
    - scripts/verify-endpoints.sh
    - scripts/verify-phase-03.sh
  modified:
    - scripts/lib/firefox-bidi.mjs
    - scripts/apply-patches.sh

key-decisions:
  - "About:support (identity surface 3) IS live-evaluable with --remote-allow-system-access -- empirically confirmed both directions this session (throws upstream's own 'unsupported operation' error without the flag, reads the live application-box value with it), so it is NOT degraded to 03-VALIDATION.md's Manual-Only table as the plan's contingency allowed."
  - "Layer 2's positive-observation anchor changed from a '.mozilla' substring to a $HOME-prefix match -- the research-assumed 'nsXREDirProvider hardcodes .mozilla on every build' claim did not hold up under repeated live testing (AppendNative(\".mozilla\") only fires for specific, lazily-queried directory keys, not on every headless screenshot run); $HOME-prefix activity (hundreds of hits every run, the real ~/.config/deocracy/sourcerer profile) is the reliable substitute."
  - "Two Remote Settings companion hosts (content-signature-2.cdn.mozilla.net, firefox-settings-attachments.cdn.mozilla.net) added to the allowlist under the existing D-83 carve-out after a real layer-3 run surfaced them -- an omission from the first draft, not a new decision."
  - "Layer 3's per-child MOZ_LOG filename order corrected to <base>.child-N.moz_log (child postfix before the extension), not <base>.moz_log.child-N as first written -- confirmed against GeckoChildProcessHost.cpp:945-967 after the wrong glob left 29 empty stray log files in /tmp across this session's testing."

patterns-established:
  - "scripts/verify-phase-03.sh: set -uo pipefail aggregator, CHECKS list later plans append to, --quick flag for the browser-free subset, setsid + group-kill for interrupt safety"

requirements-completed: [BUILD-03, BRAND-01, BRAND-02, BRAND-03, BRAND-04, BRAND-06]

coverage:
  - id: D1
    description: "BiDi driver parameterised (binPath option, --remote-allow-system-access) and repointed at the renamed sourcerer binary; Phase 2's five browser-driven checks still pass unmodified"
    requirement: "BRAND-01"
    verification:
      - kind: integration
        ref: "bash scripts/verify-phase-02.sh -- executed this session, all 5 checks PASS"
        status: pass
    human_judgment: false
  - id: D2
    description: "verify-branding-identity.mjs's six-surface identity checklist runs against the real binary: 5 surfaces green, desktop-entry red for its stated (expected) reason, coverage guard and 3 positive controls all proven"
    requirement: "BRAND-01"
    verification:
      - kind: integration
        ref: "node scripts/verify-branding-identity.mjs --positive-control version/application-ini/about-support (all exit 0); node scripts/verify-branding-identity.mjs (full run, exit 1 naming only desktop-entry); coverage-guard break test -- all executed this session"
        status: pass
    human_judgment: false
  - id: D3
    description: "endpoint-allowlist.json is a valid, complete hosts[]/prefs[] schema with the Remote Settings cadence correctly recorded at 24h"
    requirement: "BRAND-04"
    verification:
      - kind: integration
        ref: "node -e schema-validation one-liner (plan's own <verify> block) -- executed, PASS; grep -c '6 hours' returns 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "verify-endpoints.sh's three layers each have a working positive control observed going red this session; layer 2's real run is reliably green (zero touches to $HOME/.mozilla/firefox); layer 1 and layer 3 are red for real, load-bearing, recorded reasons"
    requirement: "BRAND-03, BRAND-04"
    verification:
      - kind: integration
        ref: "bash scripts/verify-endpoints.sh --layer 1/2/3 --positive-control (all exit 0); bash scripts/verify-endpoints.sh (full, and per-layer) -- all executed this session, layer 2 re-run 3x for reliability"
        status: pass
    human_judgment: false
  - id: D5
    description: "apply-patches.sh --self-test proves D-75's adopted-patch assertion catches a real silent no-op (not a plain conflict), without touching upstream/ or patches/"
    requirement: "BUILD-03"
    verification:
      - kind: integration
        ref: "bash scripts/apply-patches.sh --self-test -- executed this session; upstream/ git status byte-identical before/after"
        status: pass
    human_judgment: false
  - id: D6
    description: "verify-phase-03.sh aggregates every Phase 3 check with a per-check PASS/FAIL table, --quick mode, unknown-argument rejection, and SIGINT safety (no leaked sourcerer process, even mid-layer-3)"
    requirement: "BUILD-03"
    verification:
      - kind: integration
        ref: "bash scripts/verify-phase-03.sh --quick (exit 1, only desktop-entry-quick red); bash scripts/verify-phase-03.sh --nonsense (exit 1, FAIL message); SIGINT delivered mid-layer-3 twice this session (exit 130, zero leaked sourcerer processes both times)"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-08-21
status: complete
---

# Phase 3 Plan 2: Branded Firefox Fork -- Wave-0 Verification Harness Summary

**BRAND-01's six-surface identity checklist, BRAND-04's three-layer endpoint/telemetry prover, and the phase aggregator -- all committed before 03-03/03-05's actual fixes, each negative assertion proven capable of failing by an observed-red positive control, with two real bugs (a flaky positive-observation anchor, a wrong MOZ_LOG child-file glob) and one allowlist gap found and fixed live rather than left for a later plan to discover.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-21T22:36:00Z (approx.)
- **Completed:** 2026-08-21T23:31:10Z
- **Tasks:** 3
- **Files modified:** 6 (2 created + 1 modified in Task 1; 2 created in Task 2; 1 created + 1 modified in Task 3, with a same-task follow-up fix to the Task-2 file)

## Accomplishments

- `scripts/lib/firefox-bidi.mjs`'s `withFirefoxPage`/`captureScreenshot` gained a `binPath` option (default repointed from the removed `objdir/dist/bin/firefox` to `objdir/dist/bin/sourcerer`) and `--remote-allow-system-access`, empirically proven both necessary and sufficient for live `about:support` evaluation -- confirmed by two matched scratch runs, one throwing upstream's own "unsupported operation" error without the flag, one reading the live value with it. `bash scripts/verify-phase-02.sh` still exits 0 unmodified.
- `scripts/verify-branding-identity.mjs`: BRAND-01's six-surface checklist (executable name, `application.ini`, live `about:support`, `brand.ftl`'s `-brand-full-name`, `.desktop`, `--version`), every surface an exact string/boolean equality, a coverage guard, and three working `--positive-control` modes (application-ini, about-support, version) -- all three observed exiting 0 this session against the real stock-Firefox substitute values.
- `sourcerer/endpoint-allowlist.json`: the single machine-readable hosts/prefs source of truth for D-83 through D-87 -- Remote Settings and its two companion CDN hosts, Google Widevine and Safe Browsing as documented `allow` waivers; AUS, Normandy, telemetry, captive portal, push, sponsored tiles, region lookup, and OpenH264 as `deny`. Cadence correctly recorded at 86400s/24h.
- `scripts/verify-endpoints.sh`: three proof layers, each with a positive control proven red this session -- static prefs (layer 1), exact-path `strace` (layer 2, BRAND-03), and anchored `MOZ_LOG=nsHostResolver:5` host extraction (layer 3), with exact-or-dot-suffix allowlist matching that correctly rejects a contains-match attack.
- `scripts/apply-patches.sh --self-test`: proves the D-75 post-apply assertion catches a genuine `git apply --3way` silent no-op (not a plain conflict) by reverse-applying the real patch against a copy of the real post-patch file to derive a byte-identical fixture -- confirmed the fixture's blob hash matches the patch's own "before" index line, which is what makes the second apply a true 3-way merge.
- `scripts/verify-phase-03.sh`: the phase's one re-runnable aggregator, `--quick` (browser-free subset) and full modes, `setsid`-backed interrupt safety confirmed by two live SIGINT tests mid-`layer 3` with zero leaked `sourcerer` processes both times.

## Task Commits

Each task was committed atomically:

1. **Task 1: Parameterise the BiDi driver, then write the six-surface identity checklist** - `c52f831` (feat)
2. **Task 2: The endpoint allowlist and its three proof layers** - `3cea8e9` (feat)
3. **Task 3: Phase aggregator, and a self-contained control for the adopted-patch assertion** - `9524f83` (feat)

_No TDD tasks in this plan; each commit is a single feat commit. Task 3's commit also carries a same-task follow-up fix to Task 2's `verify-endpoints.sh` (the layer-2 positive-observation anchor and the layer-3 MOZ_LOG glob), discovered while running the aggregator, not deferred._

## Files Created/Modified

- `scripts/lib/firefox-bidi.mjs` - `binPath` option on `withFirefoxPage`/`captureScreenshot`; default repointed to `sourcerer`; `--remote-allow-system-access` added to `withFirefoxPage`'s spawn argv
- `scripts/verify-branding-identity.mjs` - BRAND-01's six-surface checklist, `--bin`/`--expect-display-name`/`--positive-control`/`--help`
- `sourcerer/endpoint-allowlist.json` - hosts[]/prefs[] machine-readable allowlist
- `scripts/verify-endpoints.sh` - three-layer endpoint/telemetry prover, `--layer`/`--positive-control`/`--help`
- `scripts/apply-patches.sh` - `--self-test`, `apply_patch_with_assertion()` extracted for reuse
- `scripts/verify-phase-03.sh` - the phase aggregator, `--quick`/full

## Decisions Made

- **About:support is live-evaluable, no degradation needed.** Task 1's `<read_first>` flagged this as an open empirical question with a documented fallback (move to 03-VALIDATION.md's Manual-Only table). Settled directly: `--remote-allow-system-access` makes `script.evaluate` against the parent-process `about:support` context work, confirmed by a paired positive/negative scratch test before writing the assertion.
- **Layer 2's positive-observation anchor is `$HOME`-prefix activity, not a `.mozilla` substring.** The research doc's "nsXREDirProvider hardcodes `.mozilla` on every build" claim is true of the *source code* but not of every *runtime invocation* -- `AppendNative(".mozilla"_ns)` is reached only when specific, lazily-queried directory keys (native-messaging manifests, the legacy update root) are actually requested, which a plain `--headless --screenshot about:blank` run does not always trigger. Confirmed by re-running layer 2 back-to-back and observing it pass once, then fail, then pass again on the `.mozilla`-substring gate while the profile-directory activity (`$HOME/.config/deocracy/sourcerer`) was present and consistent every single time. Switched the gate to `$HOME`-prefix presence; re-verified reliably green across three consecutive runs afterward.
- **Two Remote Settings companion hosts added to the allowlist mid-task**, not deferred to 03-03: `content-signature-2.cdn.mozilla.net` (content-signature verification) and `firefox-settings-attachments.cdn.mozilla.net` (attachment CDN, used by CRLite -- one of D-83's own stated reasons for keeping Remote Settings). Both are structurally part of the feature D-83 already carves out; omitting them from the first draft was an oversight in this plan's own research pass, not new scope.
- **Layer 3's MOZ_LOG child-file naming corrected**: `GeckoChildProcessHost.cpp:945-967` appends `.child-N` to the (extension-stripped) base *before* the logging backend re-adds `.moz_log`, producing `<base>.child-N.moz_log` -- not `<base>.moz_log.child-N` as first written from the research doc's prose description. The wrong glob matched nothing, silently missing per-child logs (all observed empty in practice, so no host-extraction data was actually lost) and, more concretely, leaving 29 empty stray files in `/tmp` across this session's repeated testing. Fixed in both the read and cleanup code paths.
- **`--quick` mode's `.desktop`/`config.status` equality check is a standalone inline check**, not a call into `verify-branding-identity.mjs`'s default six-surface run -- that run's `about-support` surface launches a real browser, exactly what `--quick` exists to avoid, and Task 3's own file scope does not include re-touching `verify-branding-identity.mjs`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Layer 2's `.mozilla`-substring positive-observation gate was unreliable**
- **Found during:** Task 3, while running the full aggregator repeatedly to record its output
- **Issue:** `verify-endpoints.sh --layer 2`'s real (non-control) run intermittently reported `FAIL -- zero .mozilla path components observed` even though the binary's actual filesystem behavior (real profile at `~/.config/deocracy/sourcerer`, zero touches to `~/.mozilla/firefox`) was correct and consistent every run -- the specific `.mozilla`-substring probe nsXREDirProvider.cpp only reaches under certain lazily-queried directory keys, not on every invocation.
- **Fix:** Replaced the positive-observation anchor with a `$HOME`-prefix match (hundreds of hits every run, proving genuine profile-adjacent activity was captured), keeping the exact-prefix `$HOME/.mozilla/firefox` negative assertion unchanged.
- **Files modified:** `scripts/verify-endpoints.sh`
- **Verification:** Three consecutive real `--layer 2` runs, all PASS; `--layer 2 --positive-control` re-confirmed PASS afterward.
- **Committed in:** `9524f83` (Task 3 commit)

**2. [Rule 1 - Bug] Layer 3's MOZ_LOG child-file glob matched the wrong filename shape**
- **Found during:** Task 3, investigating 29 stray `/tmp/sourcerer-hostresolver-*` files left over from this session's testing
- **Issue:** The read and cleanup code used `"${log_base}.moz_log.child-"*`, but `GeckoChildProcessHost.cpp:945-967` appends the `.child-N` postfix before the logging backend re-adds `.moz_log`, so the real files are `<base>.child-N.moz_log`. The wrong glob silently matched nothing (harmless in this session since every child log observed was 0 bytes) but left every per-child log file un-cleaned-up.
- **Fix:** Corrected the glob in both the `cat` (read) and `rm -f` (cleanup) statements to `"${log_base}".child-*.moz_log`, and corrected the header comment's description of the naming order.
- **Files modified:** `scripts/verify-endpoints.sh`
- **Verification:** Re-ran layer 3; zero stray files remained afterward (previously 29 accumulated across the session).
- **Committed in:** `9524f83` (Task 3 commit)

**3. [Rule 1 - Bug] `endpoint-allowlist.json` was missing two legitimate Remote Settings companion hosts**
- **Found during:** Task 2, running the real layer-3 network capture for the first time
- **Issue:** A real 20-second capture surfaced `content-signature-2.cdn.mozilla.net` and `firefox-settings-attachments.cdn.mozilla.net` as resolved hosts absent from the allowlist -- both are structurally part of Remote Settings (content-signature verification and the attachment CDN CRLite itself uses), the same feature D-83 already carves out.
- **Fix:** Added both as `allow` entries under the existing D-83 rationale.
- **Files modified:** `sourcerer/endpoint-allowlist.json`
- **Verification:** Re-ran layer 3; both hosts no longer appear in the violation list.
- **Committed in:** `3cea8e9` (Task 2 commit)

**4. [Rule 3 - Blocking-fix precursor] Node `process.argv` off-by-one in `-e` invocations**
- **Found during:** Task 2, first live run of layer 1
- **Issue:** `node -e '...'` scripts destructured `process.argv` assuming a script-path slot at index 1 (as in normal `node script.js arg1 arg2` invocation); with `-e` there is no such slot, so `binDir`/`allowlistPath` were read one position off, throwing `ERR_INVALID_ARG_TYPE`.
- **Fix:** Corrected the destructuring in both `layer1_check` and `allowlist_host_allowed` to `[, binDir, allowlistPath] = process.argv`.
- **Files modified:** `scripts/verify-endpoints.sh`
- **Verification:** Layer 1 and layer 3 both run correctly afterward.
- **Committed in:** `3cea8e9` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (3 Rule 1 bugs, 1 Rule 3 blocking fix)
**Impact on plan:** All four are correctness fixes to the verification harness itself, discovered by actually running every check live rather than trusting the research doc's predictions -- exactly the failure mode ("a negative check without a demonstrated-red positive control proves nothing") this whole plan exists to prevent. No scope creep; nothing outside `scripts/verify-endpoints.sh` and `sourcerer/endpoint-allowlist.json` was touched by the fixes.

## Expected Reds (recorded per the plan's own table)

Full aggregator output (`bash scripts/verify-phase-03.sh`), this session:

```
verify-phase-03: summary
  check-patch-surface: PASS
  check-patch-surface-self-test: PASS
  apply-patches-self-test: PASS
  allowlist-schema: PASS
  verify-branding-identity: FAIL
  verify-endpoints: FAIL
verify-phase-03: FAIL -- see summary above
```

| Check | State observed this session | Reason | Turns green in |
|---|---|---|---|
| identity surfaces 1 (executable), 2 (application.ini), 4 (brand-full-name), 6 (version) | GREEN | plan 03-01 already branded them | -- |
| identity surface 3 (about:support) | GREEN | `--remote-allow-system-access` proven sufficient for live parent-process evaluation this session (no degradation needed) | -- |
| identity surface 5 (`.desktop`) | RED | `sourcerer/sourcerer.desktop` does not exist | `03-05` |
| endpoints layer 1 (prefs) | RED, 4 pref mismatches named | `pref/firefox-branding.js` is still the Task-1 placeholder (all 4 prefs at stock Firefox values) | `03-03` |
| endpoints layer 2 (strace) | **GREEN** (confirmed reliably across repeated runs after the positive-observation fix) | real profile lands at `~/.config/deocracy/sourcerer`; zero touches to `~/.mozilla/firefox` | -- (already correct; not a 03-03 dependency) |
| endpoints layer 3 (MOZ_LOG) | RED, 6 hosts named: `cloudflare-dns.com`, `detectportal.firefox.com`, `example.org`, `ipv4only.arpa`, `location.services.mozilla.com`, `push.services.mozilla.com` | captive portal / push / region-lookup prefs not yet disabled (03-03's job); the four TRR-related hosts (`cloudflare-dns.com`, `example.org`, `ipv4only.arpa`, plus the confirmation mechanism) are a genuinely new finding this session -- not named in D-83 through D-88 -- and are **not silently allowlisted or resolved here**; flagged below as an open item for 03-03's planner | `03-03` (pref-gated hosts) + a fresh decision needed for TRR |
| BRAND-06 dev-vs-release compare | not yet run | no release build exists | `03-05` |

**Note on layer 2:** the "Expected reds" table in `03-02-PLAN.md` marked this "unknown -- must be run and recorded". It is recorded here as reliably **GREEN**, not red -- BRAND-03's profile-isolation requirement is already satisfied by plan 03-01's build, independent of 03-03's pref work.

**Open item for 03-03 (or a dedicated decision) -- TRR host resolution.** A real 20s layer-3 capture resolves `cloudflare-dns.com` (Firefox's default DoH/TRR provider), `example.org` (TRR's confirmation-NS probe), and `ipv4only.arpa` (network-capability/DNS64 detection) even with no page navigation completing successfully in this headless sandbox. None of D-83 through D-88 name TRR at all. This plan deliberately does **not** resolve it -- doing so would be a runtime-pref decision (`network.trr.mode` or an allowlist waiver) outside the locked decisions this plan implements. Recorded here so 03-03's planner sees it as a real, load-bearing finding rather than rediscovering it from a fresh red.

## Known Stubs

None -- every script in this plan runs against real build artifacts and real live processes; no hardcoded/mock data paths were introduced.

## Threat Flags

None -- this plan adds verification tooling only; no new network endpoints, auth paths, or trust-boundary schema changes.

## Issues Encountered

None beyond the four deviations documented above -- all four are the plan's own explicit purpose (catching wrong or vacuous checks before 03-03/03-05 build on top of them).

## User Setup Required

None - no external service configuration required. `strace` was confirmed present at `/run/current-system/sw/bin/strace` (the plan's stated precondition), so no devShell change was needed.

## Next Phase Readiness

- `scripts/verify-phase-03.sh` is the one command (`--quick` or full) plans 03-03 through 03-06 run to check their own progress against this phase's full requirement set.
- 03-03 has three concrete, named targets from this session's real layer-1/layer-3 runs: the four placeholder prefs in `sourcerer/branding/dev/pref/firefox-branding.js`, and the captive-portal/push/region-lookup prefs layer 3 flagged.
- 03-03's planner should also address the TRR open item above -- either an explicit allowlist waiver (if TRR is being kept, matching D-83's own precedent for Remote Settings) or a pref change to disable it, with the reasoning recorded the same way D-83 through D-88 are.
- 03-05 can reuse `scripts/verify-branding-identity.mjs --bin <release-binary> --expect-display-name Sourcerer` directly for its dev-vs-release differ assertion (surface 4's cross-variant check), and `apply_patch_with_assertion()` is already exported as a reusable function for any future patch stack growth.
- No blockers.

---
*Phase: 03-branded-firefox-fork*
*Completed: 2026-08-21*

## Self-Check: PASSED

All claimed files found on disk (`scripts/verify-branding-identity.mjs`, `sourcerer/endpoint-allowlist.json`, `scripts/verify-endpoints.sh`, `scripts/verify-phase-03.sh`, `scripts/lib/firefox-bidi.mjs`, `scripts/apply-patches.sh`). All claimed commits found in git history (`c52f831`, `3cea8e9`, `9524f83`).
