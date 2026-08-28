---
phase: 05-lifecycle-failure-hardening
verified: 2026-08-28T04:00:00Z
status: human_needed
score: 4/5 must-haves verified (automated surface complete; human surface pending)
behavior_unverified: 3
overrides_applied: 0
human_verification:
  - test: "Item A — use Sourcerer as the primary IDE on the NixOS host for one full working day"
    expected: "No manual process cleanup, no forced relaunch; if the error state appears, Retry recovers the session with editor state intact; developer records the verdict in 05-MANUAL-VERIFICATION.md"
    why_human: "ROADMAP success criterion 5 is explicitly human-only (D-126) — a soak, automated or multi-day, does not exercise what 'daily-drivable' means. This has genuinely not happened yet: 05-MANUAL-VERIFICATION.md Item A reads 'pending' in every field."
  - test: "Item B — click the Retry button by hand while the branded error layer is visible, with open editor tabs beforehand"
    expected: "The error layer clears and the previously-open editor tabs/content are still present, with no reload"
    why_human: "Chrome-context Marionette automation is blocked on Linux — capabilities.alwaysMatch['moz:windowless'] is gated to AppInfo.isMac only (Capabilities.sys.mjs:708-720), confirmed live against a raw Marionette socket client (WINDOWS.md entry 7). No automated harness in this repo can click a chrome-window button. The underlying TheiaService.retry()->_restart() code path IS exercised end-to-end by shell03-auto-dismiss-on-selfheal's recovery probe (same code path, per D-115), but the literal click has never been observed. 05-MANUAL-VERIFICATION.md Item B reads 'pending' in every field."
  - test: "Item C — press Ctrl+Alt+Shift+D with the backend down and read the rendered diagnostics fields"
    expected: "Diagnostics layer opens over the error state showing populated port, pid, health status, restart count, recent log, and brand/vendor/version; pressing the chord again closes it"
    why_human: "Same Discriminator B platform gate as Item B — no automated harness can press a chrome-context key chord or read rendered DOM text on this Linux build. shell04-diagnostics-with-backend-down automates only the two halves that do not need chrome-context driving (the startup identity sentinel's population, and the Details control shipping enabled/undisabled in the markup). ATTEMPTED 2026-08-28 and FAILED — see the Post-Verification Update section below. The attempt never reached the chord: both deck overlays were already painted over Theia at startup because the CSP dropped their inline style attributes (WINDOWS.md entry 8). That regression is now fixed and guarded, but Item C itself has NOT been re-performed against the fixed build and 05-MANUAL-VERIFICATION.md Item C still reads 'pending' in every outcome field."
behavior_unverified_items:
  - truth: "SHELL-03: pressing the physical Retry button clears the error layer and the previously-open editor session survives untouched"
    test: "Force the error state (kill the backend mid-session), click Retry, confirm the layer clears and editor tabs/content are intact"
    expected: "Error layer hidden; no navigation of the content browser; editor state exactly as before the outage"
    why_human: "Presence + wiring is proven (button exists, is bound to sourcererRetry(), which calls the same retry()->_restart() path the auto-dismiss probe already exercises live) but the literal DOM click event has never been dispatched by anything — chrome-context automation is platform-blocked, not merely unimplemented."
  - truth: "SHELL-04: the Ctrl+Alt+Shift+D chord opens the diagnostics layer with the backend down, and the rendered fields show real values"
    test: "Press the chord with no backend running, read port/pid/health/restart-count/log/identity off the layer, press again to close"
    expected: "All seven fields populated and correct; toggle closes on a second press"
    why_human: "sourcererShowDiagnostics() is code-reviewed to read only chrome-process state (TheiaService.getState()/getRecentLog()/SourcererAPI.getAppIdentity(), no network, textContent only) and the identity sentinel it shares is independently proven live, but no automated harness can dispatch the key chord in a chrome window on this platform."
  - truth: "ROADMAP criterion 5: Sourcerer is daily-drivable — a working day produces no manual process cleanup and no forced relaunch"
    test: "Use Sourcerer as the primary IDE for one full working day, recording cleanup/relaunch/error-state incidents"
    expected: "Zero manual cleanups, zero forced relaunches, any error-state occurrence recovered by Retry"
    why_human: "This is inherently a human, real-time, real-workload observation — no automated proxy can establish it. It has not occurred yet."
---

# Phase 5: Lifecycle & Failure Hardening Verification Report

**Phase Goal:** Sourcerer cleans up after itself under any exit path and tells the user what went wrong instead of freezing. v4.0 is daily-drivable at the end of this phase.
**Verified:** 2026-08-28T04:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Post-Verification Update — 2026-08-28: Item C attempted, FAILED, regression found and fixed

**Everything below this section predates the update and is left unedited as the original record.** Two facts it asserts are now known to have been wrong at the time it was written, and both are corrected here rather than silently rewritten there.

### What happened

The developer attempted **Item C** (press Ctrl+Alt+Shift+D with the backend down) by hand against the built binary. The attempt **FAILED before reaching the chord**. On launch the window showed a near-black screen with an empty log box and a Close button. Clicking Close revealed the branded *error* layer underneath it; clicking Retry on that revealed the real, correctly-branded Theia IDE.

Both deck overlays — `#sourcerer-error` (z-index 2) and `#sourcerer-diagnostics` (z-index 3) — were being painted over a perfectly healthy Theia from startup. Theia was never at fault: it reached `ready` and initialised its workbench in every launch log, and `SOURCERER_DIAGNOSTICS` never appeared, proving `sourcererShowDiagnostics()` had never run. The layers were visible without any code showing them.

### Root cause

Phase 5 hid both overlays with an inline **style attribute** — `style="display:none;"` — added in `f944f5e` (05-02, error layer) and `339db40` (05-03, diagnostics layer), while `sourcerer.css` gave both base rules `display: flex`. The shell document's own CSP, `default-src chrome:` with no `style-src` and no `'unsafe-inline'`, predates them (`f835f6e`, 04-03) and drops inline style **attributes** as well as inline `<style>` elements. The attribute was inert, the stylesheet won, and both layers painted. Phase 5 broke what Phase 4 delivered: pre-Phase-5 the body held only `#sourcerer-loading`, which has no inline style and is hidden by JS.

A secondary defect rode along: `sourcerer.js` decided toggle direction with `diagnosticsElement.style.display !== "none"`, which reads `""` once the inert attribute is removed — so the first chord press would have hidden an already-hidden layer, leaving the chord dead on first use even after the CSP issue was fixed.

### Why no automated gate caught it

`verify-phase-05.sh` was 12/12 green and `--gate` PASS the entire time the product was unusable. Nothing in this repo could observe the shell's own rendered chrome state: WebDriver BiDi's `browsingContext` tree contains only the content `<browser>`, so `captureScreenshot` photographs the healthy Theia *underneath* two opaque chrome overlays, and chrome-context Marionette is platform-blocked on Linux (WINDOWS.md entry 7). The defect was found by a human doing a manual item, which is exactly what this phase's own artifacts routed to a human — and exactly the class of failure that routing exists to catch.

### Fix and new guards (commits `014b0d9`, `def0143`, `b3a287d`, `b30dff7`)

- `014b0d9` — both `style="display:none;"` attributes deleted from `sourcerer.xhtml`; `#sourcerer-error` and `#sourcerer-diagnostics` base rules in `sourcerer.css` changed `display: flex` → `display: none`; the toggle read in `sourcerer.js` changed to `window.getComputedStyle(diagnosticsElement).display !== "none"`. No `'unsafe-inline'` was added to the CSP. The error layer does not share the read pattern — its handlers only ever write `.style.display`.
- `def0143` — new static check **`shell-csp-inline-attrs`** in `verify-phase-05.sh`, registered outside the `--quick` guard. Asserts the CSP meta is still present and still free of `'unsafe-inline'`, then scans every markup/script file `jar.mn` actually ships (file list derived from `jar.mn`, not hardcoded) for inline `style=`/`on*=` attributes and `setAttribute("style"|"on…")`. Comments are blanked newline-preserving before matching; a self-test against a known-bad fixture demands exactly 2 offenses. Proven to go **red** on the pre-fix markup (`git show 339db40:sourcerer/shell/sourcerer.xhtml` → rc=1, lines 36 and 43). Side effect: `--quick` previously iterated an empty array and printed PASS having asserted nothing; it now runs one real check.
- `b3a287d` — new runtime sentinel **`SOURCERER_DECK_STATE`**, emitted from `dumpDeckState()` at the end of `sourcererSwapToUrl` and `sourcererShowError`, reporting the resolved `display` of all three deck layers. `verify-phase-04.sh`'s `shell05-paint-before-backend` requires all three `"none"` at the swap; `verify-phase-05.sh`'s `shell03-budget-exhausted-error` requires `"error"` **not** `"none"` as a positive control, so a sentinel hardcoded to `"none"` cannot satisfy both. The true pre-fix tree emits `{"loading":"none","error":"flex","diagnostics":"flex"}` — the original bug reproduces on demand and this check goes red on it.
- `b30dff7` — the two SIDE-04/SIDE-05 orphan scans were machine-global `pgrep -f 'backend/main.js'` sweeps that could not tell the harness's own backend from any other Theia backend on the box (a pre-existing fragility, blame `2bb7288e`/`c3dd54d3`, not introduced by the fix). Both now scan only process groups the run itself created.

Check counts are now **13** in `verify-phase-05.sh` (was 12) and **10** in `verify-phase-04.sh` (unchanged; `shell05-paint-before-backend` now additionally carries the deck-state assertion).

### Corrections to the record below

1. Everywhere the original report says `verify-phase-05.sh` has **12 checks / 12/12 PASS**, the current count is **13 checks / 13/13 PASS**. The `--gate` commit hash `3d12834…` in the original report is likewise superseded; `--gate` has since been re-run PASS at `b30dff7` (125s, same single named known-open exclusion: `verify-endpoints`, WINDOWS.md ledger entry 5).
2. The original report's Required-Artifacts row for `sourcerer.xhtml`/`.css`/`.js` reads "✓ VERIFIED — three deck layers present". That was true of *presence* and remains true; it was **not** true of rendered behaviour, and nothing in the original verification could have distinguished the two. The `SOURCERER_DECK_STATE` assertion is what now closes that gap.

### Human items are still pending — none of them passed

Items **A**, **B** and **C** all remain genuinely **unperformed against the fixed build**. Item C was attempted once, failed on the regression, and has not been retried; Items A and B have not been attempted at all. `05-MANUAL-VERIFICATION.md` still reads `pending` in every outcome field, correctly. `status: human_needed` is unchanged.

### Open items deliberately NOT fixed

Recorded here and in `.planning/WINDOWS.md` (entries 9, 10, 11) so they stay tracked:

- **MED-01 (open)** — `SOURCERER_SUPERVISED=1` is read by the watchdog but never deleted from `process.env`, and `_spawnAndGate` uses `environmentAppend: true`, so the marker inherits into every subprocess the Theia backend later spawns (integrated terminal, task runner, debug adapter). The same environment object already resets `SOURCERER_TOKEN_DISABLE` for exactly this hazard. Latent — nothing else in this repo reads the variable — but that fact, not scoping, is the only defence.
- **MED-02 (open)** — `_pumpOutput` buffers every backend stdout/stderr line into the diagnostics ring buffer with no redaction, and the diagnostics layer renders that buffer verbatim. The shell never logs the token itself and the sentinels are proven token-free, but any dependency that prints `process.env` (which carries `SOURCERER_TOKEN`) would flow unredacted into a now-reachable in-app panel — new exposure surface created by SHELL-04.
- **State-file litter (open)** — the CR-01 profile-scoping fix creates one `~/.config/sourcerer/sidecar-state-<profile>.json` per profile path and nothing ever reaps them. **151** have accumulated in the real user config dir as of 2026-08-28, almost all from harness runs against `mktemp` profiles. Cheapest remedy: point `XDG_CONFIG_HOME` at the harness temp dir in `verify-phase-05.sh`'s launch helpers so test runs never touch the real config dir — `_resolveConfigDir` already honours `XDG_CONFIG_HOME` ahead of `HOME`.

Also still open, untouched, and named here only so they are not lost: `sourcererRetry()` hides the error layer with a direct CSSOM write instead of calling `sourcererHideError()`, so `TheiaService._errorShown` stays true and a *failing* retry leaves the user on a blank branded splash with no message and no Retry control; the error layer's Details button is bound to a toggle; `sourcererHideDiagnostics` emits no sentinel although its own comment promises one on every call; and `--gate` mutates a tracked file as a side effect, dirtying the working tree on every run.

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SIGKILL on the browser leaves zero backend processes behind, and a leftover backend from a previous crash is detected and cleaned up on the next startup | ✓ VERIFIED | Ran `bash scripts/verify-phase-05.sh` myself: `side04-sigkill-no-orphan`, `side04-leftover-reaped`, `side04-stale-identity-not-signalled` all PASS. Backend-side watchdog (`parent-watchdog-backend-contribution.ts`) self-terminates on stdin EOF only when `SOURCERER_SUPERVISED=1`; startup reap (`TheiaService._reapLeftover`) signals a recorded pid only after an exact `/proc/<pid>/stat` start-tick match. One sub-claim — state-file removal on a genuinely clean quit — is code-review-only, not live-exercised (this build installs no SIGTERM handler and ignores SIGINT, so no signal-based clean-quit trigger exists in this sandbox; 05-01-SUMMARY.md D6, honestly flagged there as `human_judgment: true`, not silently assumed true). |
| 2 | Launching Sourcerer while it is already running focuses the existing window and spawns no second backend | ✓ VERIFIED | `side05-second-launch-focuses` and `side05-no-second-backend` PASS in the run I executed, live against a real display (`start_shell_display`, not headless — headless disables Firefox's remoting protocol entirely, confirmed in 05-RESEARCH.md and re-confirmed live in 05-02). A different-profile positive control in the same check proves the guard is profile-scoped, not a global break of second launches. `TheiaService._started` makes `start()` idempotent by construction as a second, independent layer. |
| 3 | When the backend dies and restart exhausts its backoff, the user sees a branded chrome-rendered error state with a retry that works — never a blank or frozen window | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED (mechanism VERIFIED, literal click not exercised) | The give-up/error-state machinery is fully automated and I ran it myself: `shell03-unrecoverable-immediate-error`, `shell03-budget-exhausted-error`, `shell03-auto-dismiss-on-selfheal` all PASS. `#sourcerer-error` exists, is styled consistently with the loading layer, carries a Retry control wired to `sourcererRetry()` → `TheiaService.retry()` → the same `_restart()` code path the auto-dismiss probe already exercises live end-to-end. What is **not** proven: a human or automated agent has never physically clicked the Retry button and observed the layer clear with editor state intact — chrome-context Marionette automation is platform-blocked on Linux (WINDOWS.md #7), not an oversight. Routed to human item B, currently `pending`. |
| 4 | A diagnostics page shows the sidecar's port, PID, health status, and recent log output, and stays reachable while the backend is down | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED (identity/markup halves VERIFIED, live chord-driven read not exercised) | `shell04-diagnostics-with-backend-down` PASS (confirmed in the run I executed): the `SOURCERER_APP_IDENTITY` startup sentinel is populated with the backend genuinely unreachable, and the error layer's Details control ships enabled in the markup. `sourcererShowDiagnostics()` is code-reviewed to read only `TheiaService.getState()`/`getRecentLog()`/`SourcererAPI.getAppIdentity()` (no network), render via `textContent` (`grep -c innerHTML sourcerer.js` = 0, confirmed by me), and toggle symmetrically. What is **not** proven: nothing has ever pressed Ctrl+Alt+Shift+D in a live chrome window and read the seven rendered fields off the screen — same platform block. Routed to human item C, currently `pending`. |
| 5 | The developer uses Sourcerer as their daily IDE on the NixOS host for a working period without a manual process cleanup or a forced relaunch | ✗ NOT YET PERFORMED (backstop truth, human-only by design) | This has genuinely not happened. `05-MANUAL-VERIFICATION.md` Item A exists with complete instructions and every outcome field reading `pending`. D-126 explicitly rejected automated/multi-day soaks as the wrong instrument for what "daily-drivable" means. This is not a code gap — there is nothing further this repo's automated tooling can do to establish it. |

**Score:** 2/5 truths fully verified by both presence and behavior; 2/5 present-and-wired with the mechanism proven but the literal human action unexercised (platform-blocked, not skipped); 1/5 not yet attempted (human-only by design, zero automatable proxy). No truth FAILED.

### Required Artifacts

All artifacts named in the five plans' `must_haves.artifacts` blocks exist, are substantive (no stub bodies, no placeholder returns), and are wired — confirmed by direct reads and by the automated checks that exercise them, not by SUMMARY claims alone:

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `theia/extensions/token-gate/src/node/parent-watchdog-backend-contribution.ts` | Backend-side parent-death watchdog | ✓ VERIFIED | Read in full; arms only on `SOURCERER_SUPERVISED==='1'`, self-terminates via `SIGTERM` on stdin `end`/`close`/`error`, idempotent guard flag. |
| `sourcerer/shell/SourcererAPI.sys.mjs` | State-file R/W/remove, `/proc` start-tick read, bare-pid signalling, `getAppIdentity()`, `getProfileDir()`, `findShellWindow()`/`focusWindow()` | ✓ VERIFIED | All named methods present (`grep` confirmed: `signalBarePid`, `getProfileDir`, etc.); catalogued in `INTERNAL-APIS.md`, confirmed by `check-internals-boundary.sh --catalogue` PASS which I ran myself. |
| `sourcerer/shell/TheiaService.sys.mjs` | State-file write/reap, split give-up rule, `_showError`/`_hideError`/`retry()`/`_recoveryProbeLoop`, `_started` idempotency guard, per-profile state key (CR-01 fix) | ✓ VERIFIED | Read the relevant sections; `_profileStateKey()` and `_stateFilePath` suffixing confirmed present (CR-01 fix, commit `70f9454`, one commit before HEAD). |
| `sourcerer/shell/sourcerer.xhtml`/`.css`/`.js` | Error layer, diagnostics layer, window globals, sentinels, XUL chord | ✓ VERIFIED | `xmllint --noout` passes per SUMMARY (re-confirmed structurally by grep); three deck layers present; `innerHTML` count is 0 (confirmed live by me). |
| `sourcerer/shell/components.conf` | Static XPCOM single-instance command-line-handler registration | ✓ VERIFIED | File exists; `moz.build` declares it; entry name `a-sourcerer` sorts ahead of stock handlers (confirmed by live-passing `side05-*` checks, which depend on this ordering actually working). |
| `scripts/verify-phase-05.sh` | Aggregator with `--quick`/`--only`/`--gate` and 12 named checks | ✓ VERIFIED | Ran it myself: 12/12 PASS, and `--gate` PASS (124s, matching the ~125s recorded estimate). |
| `scripts/verify-branding-identity.mjs` | `runtime-identity` surface replacing `about-support` | ✓ VERIFIED | `grep -c about:support` returns 0 per SUMMARY; the `--gate` run I executed shows `verify-branding-identity-dev: PASS`, `verify-branding-identity-release: PASS`. |
| `.planning/phases/05-lifecycle-failure-hardening/05-MANUAL-VERIFICATION.md` | Human record for the daily-drive criterion and chrome-context hand-offs | ✓ VERIFIED (as an artifact) / items themselves ⚠️ pending | File exists, all instructions filled, no `TBD`/`TODO` (confirmed: `grep -c 'TBD\|TODO'` — see below), every verdict line honestly reads `pending`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `TheiaService._spawnAndGate` | State file writer/reader | `writeStateFile`/`readStateFile`/`_reapLeftover` | ✓ WIRED | One writer, one reader, same field shape (`pid`, `port`, `startTicks`, `writtenAt`); confirmed by `side04-leftover-reaped`/`side04-stale-identity-not-signalled` passing live. |
| `TheiaService._spawnAndGate` environment | Watchdog contribution | `SOURCERER_SUPERVISED` env marker | ✓ WIRED | `side04-unsupervised-backend-survives` PASS proves the watchdog stays inert without the marker; the marker is set only in `_spawnAndGate`'s environment object. |
| Error layer Retry button | `TheiaService.retry()` | `sourcererRetry()` global | ✓ WIRED (mechanism), ⚠️ UNVERIFIED (physical click) | Code-reviewed wiring confirmed; `shell03-auto-dismiss-on-selfheal` exercises the identical `_restart()` path via the recovery probe, but no click has ever been dispatched. |
| Diagnostics layer | `TheiaService.getState()`/`getRecentLog()` + `SourcererAPI.getAppIdentity()` | `sourcererShowDiagnostics()` | ✓ WIRED (mechanism), ⚠️ UNVERIFIED (physical chord press) | Renders only these accessors' return values as text nodes; no network path; not live-driven. |
| `components.conf` category entry | Stock browser command-line handler | Ascending string-sort of entry names (`a-sourcerer` < `m-browser` < `x-default`) | ✓ WIRED | Live-proven: `side05-second-launch-focuses` and `side05-no-second-backend` both PASS, which is only possible if the handler actually intercepts before the stock default-open handler runs. |
| `verify-phase-05.sh --gate` | `verify-phase-04.sh`, `verify-phase-03.sh` | Invoked as external processes, aggregated | ✓ WIRED | I ran `--gate` myself: it printed three per-script sections and one verdict line, named the Phase 3 `verify-endpoints` exclusion explicitly by ledger id and reason, and exited 0 at commit `3d12834212eb4bb453174a37a2bbb7b66db33f7e` (current HEAD). |

### Behavioral Spot-Checks (run by me, not from SUMMARY claims)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full Phase 5 check suite | `bash scripts/verify-phase-05.sh` | `12/12 PASS` (all four SIDE-04 checks, `harness-display-available`, all three SHELL-03 checks, `shell04-diagnostics-with-backend-down`, both SIDE-05 checks, `cr01-different-profile-backend-survives`) | ✓ PASS |
| Combined single-commit gate | `bash scripts/verify-phase-05.sh --gate` | `124s` runtime; Phase 5 section PASS; Phase 4 section PASS; Phase 3 section PASS-WITH-EXCLUSIONS (named `verify-endpoints`, ledger entry 5); overall `--gate PASS -- commit 3d12834212eb4bb453174a37a2bbb7b66db33f7e` | ✓ PASS |
| Internals boundary guard | `bash scripts/check-internals-boundary.sh && --catalogue && --self-test` | All three PASS | ✓ PASS |
| CR-01 fix wiring | `grep -n "_profileStateKey\|getProfileDir" sourcerer/shell/TheiaService.sys.mjs sourcerer/shell/SourcererAPI.sys.mjs` | Both present and used to suffix `_stateFilePath` | ✓ PASS |
| MED-01 review finding still open | `grep -n SOURCERER_SUPERVISED theia/.../parent-watchdog-backend-contribution.ts` | Env var is read but never `delete`d after arming — no mitigation present | Confirms REVIEW.md's finding is still live, as expected (explicitly deferred) |
| MED-02 review finding still open | `grep -n "redact\|replaceAll(this._token" sourcerer/shell/TheiaService.sys.mjs` | No redaction pass exists on the log ring buffer | Confirms REVIEW.md's finding is still live, as expected (explicitly deferred) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SIDE-04 | 05-01 | Zero orphaned processes under any kill, leftover reap on next startup | ✓ SATISFIED | 4/4 automated checks PASS, live-run by me; CR-01's profile-scoping bug (a genuine correctness gap discovered post-hoc by code review, not by this plan's own test suite) is fixed and now has its own passing regression check. |
| SIDE-05 | 05-04 | Second launch focuses window, spawns no second backend | ✓ SATISFIED | 2/2 automated checks PASS live on a real display, with a profile-scoped positive control. |
| SHELL-03 | 05-02 | Branded error state with working Retry | ✓ SATISFIED for the give-up/error-state machinery; ? NEEDS HUMAN for the literal Retry click | 3/3 automated checks PASS; Retry's physical click routed to `05-MANUAL-VERIFICATION.md` Item B, `pending`. |
| SHELL-04 | 05-03 | Diagnostics page, reachable with backend down | ✓ SATISFIED for identity/markup; ? NEEDS HUMAN for the live chord-driven read | 1/1 automated check PASS; chord press routed to Item C, `pending`. |

No orphaned requirements — REQUIREMENTS.md's Phase 5 row set (SIDE-04, SIDE-05, SHELL-03, SHELL-04) exactly matches the four plans' declared `requirements:` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `theia/extensions/token-gate/src/node/parent-watchdog-backend-contribution.ts` | 25 | `SOURCERER_SUPERVISED=1` is read but never cleared/consumed (REVIEW.md MED-01) | ⚠️ Warning | Latent env-var leakage to any subprocess the Theia backend later spawns (e.g. an integrated terminal). Not exploitable by anything currently in this repo; explicitly deferred by the developer per the task brief, not silently missed — confirmed still absent by my own grep. |
| `sourcerer/shell/TheiaService.sys.mjs` | 326 (`_pushLog`) | No redaction pass on raw backend stdout/stderr before buffering into the diagnostics ring buffer (REVIEW.md MED-02) | ⚠️ Warning | The project's own sentinels are proven token-free (`grep -c SOURCERER_TOKEN` on sentinel lines = 0), but arbitrary backend/dependency output that happened to print `process.env` would flow unredacted into the new diagnostics UI panel. Theoretical, not proven exploitable; explicitly deferred, confirmed still absent by my own grep. |
| — | — | No `TBD`/`FIXME`/`XXX` debt markers found in any Phase 5 file modified this phase (`grep -c 'TBD\|TODO'` on `05-MANUAL-VERIFICATION.md` returns 0, confirmed) | — | — |

No 🛑 blockers. CR-01 (the one critical finding) is fixed and verified with a real regression check at HEAD-1 (`70f9454`), one commit before HEAD (`3d12834`, docs-only). MED-01 and MED-02 are real, honestly-documented, explicitly-deferred robustness gaps — not phase-goal blockers, since no must_have truth or prohibition in the five plans required closing them (the prohibitions that DO exist — "never surface the token in the error/diagnostics layer or its sentinel" — are independently verified true by direct grep).

### Human Verification Required

3 items, all already correctly identified and routed by the phase's own artifacts — not new findings from this verification:

#### 1. Item A — One full working day as the primary IDE (ROADMAP criterion 5)

**Test:** Use Sourcerer (`objdir/dist/bin/sourcerer`) as the primary IDE on the NixOS host for one full working day.
**Expected:** No manual process cleanup, no forced relaunch, and if the error state ever appears, Retry recovers the session with editor state intact.
**Why human:** D-126's own reasoning — an automated or multi-day soak does not exercise what "daily-drivable" means. This has not happened yet; `05-MANUAL-VERIFICATION.md` Item A is entirely `pending`.

#### 2. Item B — Retry recovers the session with editor state intact (SHELL-03)

**Test:** Get to a working Theia session with open editors, kill the backend (`pkill -f 'backend/main.js'`), wait for the branded error layer, click Retry.
**Expected:** Error layer clears; editor tabs/content survive untouched.
**Why human:** Chrome-context Marionette automation is confirmed platform-blocked on Linux (`Capabilities.sys.mjs:708-720`, `moz:windowless` is `AppInfo.isMac`-only) — no automated harness in this repo can click a chrome-window button. The underlying recovery code path IS proven live via the auto-dismiss recovery probe; only the physical click is unproven. `05-MANUAL-VERIFICATION.md` Item B is `pending`.

#### 3. Item C — Diagnostics layer via the chord, backend down (SHELL-04)

**Test:** Force the unrecoverable error state (nonexistent `backendMain` path), press Ctrl+Alt+Shift+D.
**Expected:** Diagnostics layer opens showing populated port/pid/health/restart-count/log/identity; chord again closes it.
**Why human:** Same platform block as Item B. The identity sentinel and markup-level enablement of the Details control ARE proven live; the actual chord press and on-screen field read are not. `05-MANUAL-VERIFICATION.md` Item C is `pending`.

### Gaps Summary

No automated-surface gaps. Every automatable truth in this phase — SIDE-04 in both directions, SIDE-05 in both directions, the SHELL-03 give-up/retry/auto-dismiss state machine, and the SHELL-04 identity/markup surface — passes a live check I ran myself (`bash scripts/verify-phase-05.sh`: 12/12 PASS; `--gate`: PASS at commit `3d12834212eb4bb453174a37a2bbb7b66db33f7e`, with the one expected Phase 3 exclusion named explicitly by ledger id, not silently passed). The single critical code-review finding (CR-01, the shared-state-file cross-profile SIGTERM bug) is fixed one commit before HEAD with its own live-run regression check.

What remains is entirely the human surface this phase's own plans deliberately, honestly routed away from automation rather than fabricating:

1. **ROADMAP criterion 5** (daily-drivable) — has never been attempted. This is not a shortfall of this phase's engineering; it is a criterion that by design requires a human using the product for a real working day, and none has occurred yet.
2. **The literal Retry click** (SHELL-03) and **the literal diagnostics chord press** (SHELL-04) — both blocked by a confirmed, evidence-backed platform limitation (chrome-context Marionette/`moz:windowless` gated to macOS only on this Firefox ESR tree), not an implementation gap. The underlying code paths both mechanisms depend on ARE exercised live by other automated checks (the auto-dismiss recovery probe for Retry; the identity sentinel for diagnostics), so this is "presence and mechanism proven, one specific human action unobserved" — not "untested."

Two deferred code-review findings (MED-01, MED-02) are real but explicitly out of scope for this phase's must-haves and were knowingly deferred by the developer rather than silently dropped by the executor.

**Overall assessment:** the phase's automated surface is complete and genuinely green — I re-ran every check myself rather than trusting the SUMMARYs, and the results match what the SUMMARYs claimed. The phase's human surface (3 items) is honestly `pending`, not fabricated, and correctly blocks the milestone from being called done until a human completes them. This is exactly the state the task brief predicted: "Phase 5's automated surface is complete while its human-verification surface is not."

---

*Verified: 2026-08-28T04:00:00Z*
*Verifier: Claude (gsd-verifier)*
