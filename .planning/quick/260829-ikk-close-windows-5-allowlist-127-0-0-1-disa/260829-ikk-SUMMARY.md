---
phase: quick-260829-ikk
plan: 01
subsystem: infra
tags: [gecko-prefs, endpoint-allowlist, gmp, dns-prefetch, theia-sidecar]

requires:
  - phase: 04
    provides: the working phase-04 shell that launches a real Theia backend and frontend, which is what first surfaced the three unlisted hosts
provides:
  - "127.0.0.1 allow entry in sourcerer/endpoint-allowlist.json for the Theia sidecar loopback"
  - "github.com deny entry, closed by network.dns.disablePrefetch = true"
  - "corrected ciscobinary.openh264.org deny reason, closed by extensions.update.autoUpdateDefault = false"
  - "verify-endpoints.sh layer-3 positive control repointed at the pref the fix actually relies on"
  - "WINDOWS.md ledger entry 5 closed"
affects: [endpoint-allowlist, brand-04, verify-phase-03, verify-phase-05-gate]

actuals:
  tokens: 10342
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Trace-before-fix for Gecko unattended-callout defects: instrument media.gmp.log.level/.dump in a profile's prefs.js, correlate against the existing MOZ_LOG=nsHostResolver:5 capture, read the actual call path in upstream/ source before picking a pref."
    - "Default-branch pref files (sourcerer/branding/*/pref/firefox-branding.js) cannot satisfy prefHasUserValue()-gated per-item overrides (GMPPrefs.isSet()) -- verify a candidate pref's read path honors default-branch values before committing to it as the fix."

key-files:
  created: []
  modified:
    - sourcerer/endpoint-allowlist.json
    - sourcerer/branding/dev/pref/firefox-branding.js
    - sourcerer/branding/release/pref/firefox-branding.js
    - scripts/verify-endpoints.sh
    - .planning/WINDOWS.md

key-decisions:
  - "127.0.0.1 allow-dispositioned as the Theia sidecar loopback (phase-04 shell architecture), exact-string match only"
  - "github.com deny-dispositioned; root cause is Gecko's speculative DNS prefetch of the Theia welcome widget's repo link, closed by network.dns.disablePrefetch = true rather than removing the link"
  - "ciscobinary.openh264.org's existing deny reason corrected: media.gmp-gmpopenh264.enabled never gated GMPProvider.findUpdates()'s periodic auto-update path; the per-plugin autoupdate override (media.gmp-gmpopenh264.autoupdate) was tried first and found unusable from a default-branch pref file (GMPPrefs.isSet() requires prefHasUserValue()); the working fix is the global extensions.update.autoUpdateDefault = false, confirmed live and confirmed safe for Widevine"
  - "verify-endpoints.sh's layer-3 positive control repointed at extensions.update.autoUpdateDefault = true (in addition to the pre-existing media.gmp-gmpopenh264.enabled = true line, which had gone vacuous for this specific path)"

patterns-established:
  - "Pattern: when a candidate default-branch pref doesn't move a live-tested outcome, re-derive the actual read path in upstream/ source rather than assuming the plan's established-fact candidate list is exhaustive -- established fact 7's `.visible`/`.autoupdate` candidates were both tried and neither worked for this call path."

requirements-completed: [BRAND-04]

coverage:
  - id: D1
    description: "127.0.0.1 (Theia sidecar loopback) is an allow host in the allowlist"
    requirement: "BRAND-04"
    verification:
      - kind: integration
        ref: "bash scripts/verify-endpoints.sh --layer 3 (real run, all three layers)"
        status: pass
    human_judgment: false
  - id: D2
    description: "github.com is a deny host, closed by network.dns.disablePrefetch = true, confirmed empirically to stop resolving"
    requirement: "BRAND-04"
    verification:
      - kind: integration
        ref: "bash scripts/verify-endpoints.sh --layer 3 (real run, discriminator confirmed live)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ciscobinary.openh264.org stays deny, closed by extensions.update.autoUpdateDefault = false, traced by call site rather than hypothesised"
    requirement: "BRAND-04"
    verification:
      - kind: integration
        ref: "bash scripts/verify-endpoints.sh --layer 3 (real run) and --layer 3 --positive-control (control re-surfaces the violation)"
        status: pass
    human_judgment: false
  - id: D4
    description: "verify-endpoints.sh's layer-3 positive control still demonstrably goes red after the fix (D-88 requirement)"
    verification:
      - kind: integration
        ref: "bash scripts/verify-endpoints.sh --positive-control (all three layers)"
        status: pass
    human_judgment: false
  - id: D5
    description: "WINDOWS.md ledger entry 5 reads status fixed in both the markdown table and the fenced JSON array, with a RESOLVED description naming the fix commit"
    verification:
      - kind: other
        ref: "node -e '...' JSON-parse assertion against .planning/WINDOWS.md (see Task 3 <verify>)"
        status: pass
    human_judgment: false

duration: ~45min
completed: 2026-08-29
status: complete
---

# Phase quick-260829-ikk: Close WINDOWS.md ledger entry 5 Summary

**Traced and closed the three hosts the working phase-04 shell resolves outside BRAND-04's allowlist: 127.0.0.1 (allow, Theia sidecar), github.com (deny, closed by disabling DNS prefetch), and ciscobinary.openh264.org (deny, its existing rationale was wrong — the real fix is the global `extensions.update.autoUpdateDefault = false`, not the per-plugin `.autoupdate` pref, which cannot be set from a default-branch pref file at all).**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-08-29T20:15:00Z (approx)
- **Completed:** 2026-08-29T20:56:49Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Traced `ciscobinary.openh264.org`'s real trigger by instrumenting `media.gmp.log.level`/`.dump` in a profile's `prefs.js` and correlating against the existing `MOZ_LOG=nsHostResolver:5` capture: `GMPProvider.findUpdates()` (`GMPProvider.sys.mjs:380-451`) fires on the periodic AddonManager update timer (`reason=16`, `UPDATE_WHEN_PERIODIC_UPDATE`) regardless of `media.gmp-gmpopenh264.enabled`, runs `checkForAddons()` → `downloadLocalConfig(chrome://global/content/gmp-sources/openh264.json)` → `installAddon()`, and genuinely downloaded and extracted the real OpenH264 zip from this host.
- Discovered live that the plan's own established-fact candidate (`media.gmp-gmpopenh264.autoupdate = false`) does NOT work when set via a default-branch pref file: `GMPPrefs.isSet()` gates on `Services.prefs.prefHasUserValue()`, which a `pref()` call in `firefox-branding.js` never satisfies. Re-derived the actual working lever from `AddonManager.shouldAutoUpdate()`'s fallthrough: `extensions.update.autoUpdateDefault = false`, confirmed live to close the resolution and confirmed safe for Widevine (its own `findUpdates()` never reaches this fallback because `media.eme.enabled` defaults false on Linux).
- Added `127.0.0.1` (allow) and `github.com` (deny) to `sourcerer/endpoint-allowlist.json`, each with reasoned-decision prose citing the phase-04 architecture / Theia welcome widget source.
- Amended the existing `ciscobinary.openh264.org` deny reason with the corrected rationale (same class of correction the allowlist already recorded for Widevine on `update.googleapis.com`).
- Added `network.dns.disablePrefetch = true` and `extensions.update.autoUpdateDefault = false` to both `sourcerer/branding/dev/pref/firefox-branding.js` and `sourcerer/branding/release/pref/firefox-branding.js`, and to the allowlist's `prefs` array.
- Repointed `verify-endpoints.sh`'s layer-3 positive control at `extensions.update.autoUpdateDefault = true` after discovering the pre-existing `media.gmp-gmpopenh264.enabled = true` append had gone vacuous for this specific path.
- Confirmed all three `verify-endpoints.sh` layers, all three positive controls, the interrupt self-test, `verify-phase-03.sh` (14/14), and `verify-phase-05.sh --gate` green against the real built binary, with no remaining named ledger-5 exclusion in the gate output.
- Closed WINDOWS.md ledger entry 5 in both the markdown table and the fenced JSON array with a `RESOLVED` description naming the fix commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: Trace what actually resolves ciscobinary.openh264.org** - no commit (findings-only task; scratch files under the session scratchpad, pref file reverted to committed bytes before finishing)
2. **Task 2: Land the prefs and the three allowlist decisions** - `e13d4f2` (fix)
3. **Task 3: Prove all three layers and both controls green, then close ledger entry 5** - `548e762` (docs)

_Note: Task 2's commit already includes the layer-3 positive-control fix that emerged mid-task (the `.autoupdate` candidate not working), since that discovery happened before Task 2's commit point._

## Files Created/Modified
- `sourcerer/endpoint-allowlist.json` - Added `127.0.0.1` (allow) and `github.com` (deny) hosts; amended `ciscobinary.openh264.org`'s deny reason; added `network.dns.disablePrefetch` and `extensions.update.autoUpdateDefault` pref entries
- `sourcerer/branding/dev/pref/firefox-branding.js` - Added `network.dns.disablePrefetch = true` and `extensions.update.autoUpdateDefault = false`, each with a citation-heavy comment block
- `sourcerer/branding/release/pref/firefox-branding.js` - Same two prefs, same position, mirroring the dev file
- `scripts/verify-endpoints.sh` - Layer-3 positive control now also appends `extensions.update.autoUpdateDefault = true` (in addition to the pre-existing `media.gmp-gmpopenh264.enabled = true`), since the latter alone no longer surfaces a violation after the fix
- `.planning/WINDOWS.md` - Ledger entry 5 marked `fixed` with a `RESOLVED 2026-08-29 (e13d4f2)` description in both the table row and the JSON array

## Decisions Made
- `127.0.0.1` allow-dispositioned as architecture (Theia sidecar loopback), not a concession — exact-string host matching in `verify-endpoints.sh` means this admits only the literal address.
- `github.com` deny-dispositioned and closed via `network.dns.disablePrefetch`, not by removing the Theia welcome widget's repo link — the link is a real, wanted affordance; the pref only stops the *speculative* prefetch, not an explicit click.
- Rejected the plan's own first-choice candidate pref (`media.gmp-gmpopenh264.autoupdate`) after live-testing showed it had zero effect, because `GMPPrefs.isSet()`'s `prefHasUserValue()` gate structurally cannot see a default-branch pref file's value. Used `extensions.update.autoUpdateDefault = false` instead — broader in name but, per the traced call graph, exactly as narrow in effect for this build (Widevine's own periodic path never reaches this fallback; the real EME/DRM path is a separate, untouched call chain).
- Layer-3 positive control amended to append `extensions.update.autoUpdateDefault = true` alongside the existing `media.gmp-gmpopenh264.enabled = true`, per D-88's requirement that every negative check keep a demonstrated-red control.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's established-fact-7 pref candidate (`media.gmp-gmpopenh264.autoupdate`) does not work from a default-branch pref file**
- **Found during:** Task 2 (landing the prefs)
- **Issue:** The plan's Task 1 established facts named `media.gmp-gmpopenh264.autoupdate = false` as a narrow candidate for closing the OpenH264 auto-update path. Implementing it and testing live (real, non-control layer-3 run) showed `ciscobinary.openh264.org` still resolved — the pref had zero effect, because `GMPProvider.sys.mjs`'s `applyBackgroundUpdates` getter reads this key via `GMPPrefs.isSet()`, which calls `Services.prefs.prefHasUserValue()`. A `pref()` call in a default-preference file (`firefox-branding.js`) sets the DEFAULT branch, never the USER branch, so `isSet()` is permanently false for any value set this way, and `applyBackgroundUpdates` always falls through to `AUTOUPDATE_DEFAULT` regardless of what this repo's mechanism writes.
- **Fix:** Re-derived the actual working lever by reading `AddonManager.shouldAutoUpdate()`'s fallthrough path (`AddonManager.sys.mjs:4577-4598`): `this.autoUpdateDefault`, backed by the plain bool pref `extensions.update.autoUpdateDefault`, which IS default-branch-readable. Set to `false` in both branding pref files, confirmed live to close the resolution, and confirmed safe for Widevine by re-checking `GMPProvider.appDisabled`/`permissions` (Widevine's own `findUpdates()` never reaches this fallback because `media.eme.enabled` defaults false on Linux).
- **Files modified:** `sourcerer/branding/dev/pref/firefox-branding.js`, `sourcerer/branding/release/pref/firefox-branding.js`, `sourcerer/endpoint-allowlist.json`
- **Verification:** Live layer-3 run (real, non-control) passed clean with this pref in place; reverting it back to `media.gmp-gmpopenh264.autoupdate` and re-testing (during investigation) reproduced the failure, confirming the causal link.
- **Committed in:** `e13d4f2` (Task 2 commit)

**2. [Rule 1 - Bug] Layer-3 positive control went vacuous mid-fix**
- **Found during:** Task 2 (after landing the correct fix)
- **Issue:** `verify-endpoints.sh`'s layer-3 positive control appended only `media.gmp-gmpopenh264.enabled = true` to reproduce the ciscobinary.openh264.org violation. After the real fix (`extensions.update.autoUpdateDefault = false`) landed, this control stopped surfacing any violation — proven live by running `--layer 3 --positive-control`, which reported FAIL ("did NOT surface a violation"), since `.enabled` was never the actual gate on this path.
- **Fix:** Added `pref("extensions.update.autoUpdateDefault", true);` to the control's append block (kept the pre-existing `.enabled = true` line for continuity with the plugin's user-facing visibility), with a comment explaining why the original line alone is inert for this path. Confirmed live: the control now correctly surfaces `ciscobinary.openh264.org` as the sole new violation.
- **Files modified:** `scripts/verify-endpoints.sh`
- **Verification:** `bash scripts/verify-endpoints.sh --layer 3 --positive-control` PASS; manually re-ran the control's exact append and confirmed `ciscobinary.openh264.org` is the only unlisted host in the resolved set.
- **Committed in:** `e13d4f2` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in the plan's own trace-derived assumptions, corrected via live testing before landing)
**Impact on plan:** Both deviations were necessary corrections discovered by testing the plan's own established facts against the real build rather than trusting them as final. No scope creep — the fix still lands exactly the three allowlist decisions and prefs the plan asked for, just with the pref name corrected to one that actually works.

## Issues Encountered
None beyond the deviations documented above — both were caught and resolved within Task 2 before any commit landed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- WINDOWS.md ledger is now down to 2 open entries (1: stub, tab-uris; 7: chrome-side Marionette blocked).
- `verify-phase-05.sh --gate` PASS at `e13d4f2` (commit `548e762` postdates it with only the ledger doc close) with no named exclusion remaining — the phase-05 human-verification blockers (Items A, B, C of `05-MANUAL-VERIFICATION.md`) are unrelated to this fix and remain the only thing blocking Phase 5 sign-off.
- No blockers introduced by this work.

---
*Phase: quick-260829-ikk*
*Completed: 2026-08-29*

## Self-Check: PASSED
