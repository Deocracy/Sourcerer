---
phase: 04-full-window-theia-shell
verified: 2026-08-27T06:30:00Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
uat:
  status: passed
  observed: 2026-08-27
  record: 04-UAT.md
  detail: 04-MANUAL-VERIFICATION.md
  note: >
    The one behavior_unverified item (SHELL-05 launch-paint immediacy and
    single-swap feel) was observed by the project owner on the NixOS host's own
    desktop session and PASSED: branded state first, held, then exactly one
    transition to Theia -- no white/blank frame, no second flash. The earlier
    "no attached display" premise was itself wrong; a Wayland session was
    available throughout, and the real obstacle was the XML defect that stopped
    the shell rendering at all. One sub-point of the expected text (window
    interactive before the swap) was NOT exercised and is recorded as
    not-contradicted rather than verified -- see 04-UAT.md and
    04-MANUAL-VERIFICATION.md, which state this explicitly rather than rounding
    it up.
re_verification:
  previous_status: gaps_found
  previous_score: 4/7
  gaps_closed:
    - "SIDE-02: backend access requires a per-launch token, enforced on plain HTTP requests, and that enforcement cannot be silently disabled by the launching environment"
    - "SHELL-02: every Firefox-internals touch goes through SourcererAPI.sys.mjs -- nothing else in sourcerer/ reaches a Firefox-privileged API"
  gaps_remaining: []
  regressions: []
behavior_unverified_items: []
human_verification:
  - test: "Launch-paint immediacy and single-swap feel"
    expected: "Branded state visible at first paint, no blank/white window; window interactive before the swap; exactly one clean swap to Theia, no second flash."
    why_human: "Perceived immediacy and 'did it flash' are not observable via sentinel byte-offset ordering -- shell05-paint-before-backend proves only sentinel byte-offset ORDERING, not how the transition reads to a person."
    result: pass
    observed: 2026-08-27
    observer: "project owner, NixOS host desktop session"
    observer_report: "I saw sourcerer | a loading screen | the app opened fully"
    method: >
      The real loading phase is ~700ms and was missed twice by eye, so the
      backend was slowed to ~8s for the observation run via a scratch-profile
      pref pointing sourcerer.sidecar.nodePath at a `sleep 8; exec node "$@"`
      wrapper. No repo, product or pref-default change; the shell's paint path
      was untouched. Shell paint stayed at +0.45s; backend ready and swap moved
      from +1.09s/+1.10s to +9.13s/+9.13s.
    not_confirmed: >
      "window interactive before the swap" was NOT exercised by the observer and
      no freeze was reported either. Recorded as not-contradicted, NOT as
      verified. If window responsiveness during backend startup is to be a hard
      requirement it needs its own check -- Phase 5 (SIDE-04, SHELL-03/04) is
      where that belongs.
    prior_premise_was_wrong: >
      Earlier passes recorded this as blocked for lack of an attached display. A
      Wayland session on seat0 (DISPLAY=:0) was available throughout. The real
      obstacle was the sourcerer.xhtml XML defect that stopped the shell
      rendering at all -- see WINDOWS.md 2-4.
---

# Phase 4: Full-Window Theia Shell Verification Report

**Phase Goal:** Launching Sourcerer opens one window that spawns and
health-gates the Theia sidecar and presents it full-window as the entire
interface, with every Firefox-internals touch funnelled through one file.
**Verified:** 2026-08-27T06:30:00Z
**Status:** human_needed
**Re-verification:** Yes -- after gap closure (commit `33c5875`, current HEAD)

## Re-Verification Summary

The prior pass (2026-08-27T01:07:24Z) recorded `gaps_found` at 4/7 with two
named gaps, both Critical/Warning findings from `04-REVIEW.md` (CR-01,
WR-01). Both are re-verified as fixed in this pass, against the current
source, not taken on `SUMMARY.md`'s or the handoff's word:

1. **CR-01 (SIDE-02)** -- `TheiaService.sys.mjs` `_spawnAndGate()` now sets
   `SOURCERER_TOKEN_DISABLE: ""` explicitly in the environment object passed
   to `SourcererAPI.spawnProcess` (line 161), with a comment explaining why:
   `environmentAppend: true` merges onto the Firefox process's own inherited
   environment, so the dev bypass variable must be cleared explicitly rather
   than relying on the launching shell being clean.

   **Independently re-tested live**, not just read: launched
   `objdir/dist/bin/sourcerer --headless` with `SOURCERER_TOKEN_DISABLE=1`
   exported in the launching shell. The backend still reached
   `SOURCERER_BACKEND_READY`, `sourcerer.js` still swapped
   (`SOURCERER_SHELL_SWAP` printed), and a subsequent unauthenticated
   `curl` to `/sourcerer/health` returned **403** -- the gate remained
   enforced. The backend's own log carries no `disable`/`DISABLED` line.
   This is the exact defeat scenario CR-01 described, and it no longer
   defeats the gate.

2. **WR-01 (SHELL-02)** -- the privileged navigation
   (`document.nodePrincipal` read, `fixupAndLoadURIString` call) moved out
   of `sourcerer.js` into a new `SourcererAPI.loadURIInBrowser(browserElement,
   url)` method (`SourcererAPI.sys.mjs:281-284`). `sourcerer.js`'s
   `sourcererSwapToUrl` now calls only `SourcererAPI.loadURIInBrowser(...)`.
   `nodePrincipal` and `fixupAndLoadURIString` were added to
   `check-internals-boundary.sh`'s `FORBIDDEN_PATTERNS` (lines 54-55), and
   both touchpoints have `INTERNAL-APIS.md` rows (lines 36-37) explaining
   the navigation and why the system principal is safe here (fixed
   loopback target, never externally-supplied input).

   **Re-run live**: `check-internals-boundary.sh` (plain run), `--self-test`,
   and `--catalogue` all PASS against the current tree.

Both fixes are narrow, match the review's own suggested patches, and touch
only the five files the fix commit's diffstat shows (`check-internals-boundary.sh`,
`INTERNAL-APIS.md`, `SourcererAPI.sys.mjs`, `TheiaService.sys.mjs`,
`sourcerer.js`). No regressions: the previously-passing five truths
(SHELL-01, SIDE-01, SHELL-02a, SIDE-03, and the artifact/link checks around
them) were re-run live in this pass as part of the full harness, not
assumed unchanged.

The one item the prior pass could not close -- SHELL-05's perceptual
immediacy/no-flash claim -- remains open for the same reason: no session
running this verification, or any prior Phase 4 session, has had an
attached desktop display. `04-MANUAL-VERIFICATION.md` still reads "NOT YET
OBSERVED," unchanged. This is not a regression and not a new gap; it is
carried forward exactly as before, now the only thing standing between
`human_needed` and `passed`.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SHELL-01: window is Theia's own shell only, no custom/Firefox chrome | ✓ VERIFIED | `sourcerer.xhtml` re-read: well-formed XML, exactly one `<xul:browser remote="true" remoteType="web">`, no menu/tool/tab-strip markup; `shell01-theia-is-the-window` re-run live, PASS |
| 2 | SHELL-05: branded loading state paints immediately, swaps to Theia on health pass, window show never blocked on backend readiness | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `shell05-paint-before-backend` re-run live, PASS (sentinel ordering only); perceptual immediacy/no-flash claim still "NOT YET OBSERVED" in `04-MANUAL-VERIFICATION.md`, unchanged since prior pass |
| 3 | SIDE-01: backend binds only 127.0.0.1, OS-assigned port, port/pid announced | ✓ VERIFIED | `side01-bind-scope` re-run live, PASS |
| 4 | SIDE-02: plain HTTP without per-launch token is rejected, and that enforcement cannot be silently disabled by the launching environment | ✓ VERIFIED (gap closed) | `side02-token-negative/positive/index-gated` PASS; `TheiaService.sys.mjs:161` now clears `SOURCERER_TOKEN_DISABLE` in the spawn environment; **independently re-tested live** with `SOURCERER_TOKEN_DISABLE=1` exported in the launching shell -- gate still enforced (403 on unauthenticated request), no disable warning logged |
| 5 | SHELL-02a: `SourcererAPI.sys.mjs` is the only file *importing* a Firefox internal, fully catalogued | ✓ VERIFIED | `internals-boundary`, `internals-boundary-self-test`, `internals-catalogue` all re-run live, PASS |
| 6 | SHELL-02b: no other file touches a Firefox-privileged API of any kind, not just the pattern-matched set | ✓ VERIFIED (gap closed) | `nodePrincipal`/`fixupAndLoadURIString` moved into `SourcererAPI.loadURIInBrowser`; both added to `FORBIDDEN_PATTERNS`; `sourcerer.js` now touches neither directly (confirmed by source read: only `SourcererAPI.loadURIInBrowser(browserElement, url)` remains); `INTERNAL-APIS.md` rows added |
| 7 | SIDE-03: killing the backend triggers backoff restart on the same port, session recovers without relaunching the browser | ✓ VERIFIED | `side03-kill-and-recover` re-run live, PASS |

**Score:** 6/7 truths verified (1 present, behavior-unverified; 0 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/check-internals-boundary.sh` | executable, `--self-test`, `FORBIDDEN_PATTERNS` covers navigation-principal APIs | ✓ VERIFIED | re-run live: `--self-test` PASS; `nodePrincipal`/`fixupAndLoadURIString` present in `FORBIDDEN_PATTERNS` (lines 54-55) |
| `scripts/verify-phase-04.sh` | executable, aggregates all phase checks | ✓ VERIFIED | re-run live end-to-end: **10/10 PASS** |
| `sourcerer/shell/SourcererAPI.sys.mjs` | anti-corruption layer, now owns `loadURIInBrowser` | ✓ VERIFIED | `loadURIInBrowser(browserElement, url)` present at lines 281-284, doc comment explains the principal choice |
| `sourcerer/shell/TheiaService.sys.mjs` | supervisor, clears `SOURCERER_TOKEN_DISABLE` before spawn | ✓ VERIFIED | line 161, `SOURCERER_TOKEN_DISABLE: ""`, with explanatory comment above it |
| `sourcerer/shell/sourcerer.js` | no direct privileged-API touch | ✓ VERIFIED | `sourcererSwapToUrl` now calls only `SourcererAPI.loadURIInBrowser(...)`; no `nodePrincipal`/`fixupAndLoadURIString` occurrence in the file |
| `sourcerer/INTERNAL-APIS.md` | one row per touchpoint, self-enforcing | ✓ VERIFIED | 16 rows (14 prior + 2 new: `fixupAndLoadURIString`, `ownerDocument.nodePrincipal`, both attributed to `SourcererAPI.sys.mjs:282-283`); `--catalogue` PASS |
| `theia/extensions/token-gate/*` | `@sourcerer/token-gate` extension, backend contribution | ✓ VERIFIED | unchanged since prior pass; `side02-token-*` PASS |
| `patches/020-sourcerer-shell.patch` | exactly two hunks, two files | ✓ VERIFIED | `check-patch-surface` (part of `verify-phase-03.sh`) PASS |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `sourcerer.js` `sourcererSwapToUrl` | `SourcererAPI.sys.mjs` `loadURIInBrowser` | direct call, no privileged API touched in `sourcerer.js` itself | ✓ WIRED | Confirmed by source read; `shell05-paint-before-backend` and `side03-kill-and-recover` exercise this path live |
| `SourcererAPI.spawnProcess` environment | `TheiaService._spawnAndGate()`'s environment object | `environmentAppend: true` merge, now with `SOURCERER_TOKEN_DISABLE` explicitly cleared first | ✓ WIRED (gap closed) | Live empirical test: inherited `SOURCERER_TOKEN_DISABLE=1` in the launching shell does not reach an enabled state in the spawned backend |
| `scripts/verify-phase-04.sh` | `scripts/check-internals-boundary.sh` | invoked as named checks | ✓ WIRED | Confirmed in live run's summary table |
| `token-gate-backend-contribution.ts` | `EarlyExpressMiddleware.handlers` | `.unshift()`, index 0 | ✓ WIRED | Unchanged since prior pass; `side02-token-*` PASS |

### Behavioral Spot-Checks / Live Re-Execution

All re-run live in this verification session:

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Full Phase 4 harness | `bash scripts/verify-phase-04.sh` | 10/10 PASS | ✓ PASS |
| Boundary self-test | `bash scripts/check-internals-boundary.sh --self-test` | Both planted fixtures correctly rejected, exit 0 | ✓ PASS |
| Boundary plain run | `bash scripts/check-internals-boundary.sh` | PASS, no forbidden patterns under `sourcerer/shell` | ✓ PASS |
| Catalogue consistency | `bash scripts/check-internals-boundary.sh --catalogue` | PASS | ✓ PASS |
| **CR-01 empirical defeat test (independent, not in the harness)** | Launched `objdir/dist/bin/sourcerer --headless` with `SOURCERER_TOKEN_DISABLE=1` exported; `curl` to `/sourcerer/health` with no cookie | Backend reached ready, shell swapped, unauthenticated request returned **403**, no disable warning in log | ✓ PASS |
| Debt-marker / stub scan | `grep -nE "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across the fix commit's five touched files | No matches | ✓ PASS |
| Git HEAD sanity | `git log --oneline -1` | `33c5875 fix(04): close both verifier gaps...` -- matches the fix commit the handoff describes | ✓ PASS |

Note: `scripts/verify-phase-04.sh`'s own `side02-token-negative/positive`
checks spawn the Theia backend directly (`node .../main.js`, clean
environment) and do not exercise `TheiaService.sys.mjs`'s environment
handling at all -- they prove the token-gate *contribution* itself works,
not that the *supervisor* clears the inherited bypass. That is why the
independent empirical test above (launching the real browser binary with
the bypass var exported) was run separately in this pass, rather than
relying on the harness's green result alone for this specific gap.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| SHELL-01 | 04-01, 04-03, 04-05 | One full-window `<browser>`, Theia's shell unsuppressed, no custom chrome | ✓ SATISFIED | Truth 1 |
| SHELL-02 | 04-01, 04-03, 04-05 | Every Firefox-internals touch through `SourcererAPI.sys.mjs`, catalogued | ✓ SATISFIED | Truths 5 and 6, both now verified |
| SHELL-05 | 04-01, 04-03, 04-04, 04-05 | Immediate branded paint, single swap, never blocked on backend | ? NEEDS HUMAN | Truth 2 -- ordering proven, perceptual claim still unobserved |
| SIDE-01 | 04-01, 04-02, 04-04, 04-05 | Bound to 127.0.0.1, OS-assigned port, announced | ✓ SATISFIED | Truth 3 |
| SIDE-02 | 04-01, 04-02, 04-05 | Per-launch token gates plain HTTP, not just WS upgrade, not defeatable by inherited environment | ✓ SATISFIED | Truth 4, gap closed and independently re-tested |
| SIDE-03 | 04-01, 04-04, 04-05 | Health loop restarts backend with backoff, session recovers | ✓ SATISFIED | Truth 7 |

No orphaned requirements: all six IDs declared across phase PLAN frontmatter
(`04-01` through `04-05`) match `REQUIREMENTS.md`'s Phase 4 traceability
rows exactly (6 of 6, all marked `[x]` / `Complete`).

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any file
touched by the fix commit (`33c5875`) or any other file under
`sourcerer/shell/`, `scripts/check-internals-boundary.sh`, or
`sourcerer/INTERNAL-APIS.md`.

### Related Findings Outside Phase 4's Requirement Scope

Unchanged from the prior pass. `WINDOWS.md` open items 5 and 6 (both
`phase: 04`, kind `unmet-truth`) remain open: Phase 4 working correctly
exposes that Gecko resolves three hosts absent from the Phase 3 `BRAND-04`
allowlist, and that `about:support` is unreachable through the shell's
single `remoteType=web` `<browser>`. Both need a product decision (widen
the allowlist; decide whether `about:` pages are unreachable-by-design
under v4.0). Neither is a Phase 4 requirement (SHELL-01/02/05,
SIDE-01/02/03) and neither is included in this report's gap accounting.
`WINDOWS.md` item 1 (Phase 02 stub, `tabUriRegistry`) is also open and
likewise out of Phase 4's scope.

Also unchanged: `04-REVIEW.md`'s WR-02 (no secret redaction in the log ring
buffer) and WR-03 (missing `HOME`/`XDG_CONFIG_HOME` silently produces a
bogus config directory) remain open in that document. Neither was named a
gap in the prior verification pass and neither maps to a failed Phase 4
truth in this pass -- they are quality/robustness findings against the
implementation, not blockers to the six SHELL-*/SIDE-* requirements this
phase's roadmap goal is scoped to. Not re-litigated here; carried forward
as-is, matching the prior verifier's judgment.

### Human Verification Required

### 1. Launch-paint immediacy and single-swap feel

**Test:** Launch `objdir/dist/bin/sourcerer` cold on a real NixOS desktop
session (not headless, not under the verification harness); watch the
window from process start.
**Expected:** Branded state visible at first paint, no blank/white window;
window interactive before the swap; exactly one clean swap to Theia, no
second flash or intermediate blank frame.
**Why human:** Perceived immediacy and "did it flash" are not observable
via sentinel byte-offset ordering -- `shell05-paint-before-backend` proves
only that `SOURCERER_SHELL_READY` precedes `SOURCERER_BACKEND_READY`
precedes `SOURCERER_SHELL_SWAP` in the log, not what a person watching the
window would perceive. No session across Phase 4's entire execution and
verification history has had an attached display to make this call;
`04-MANUAL-VERIFICATION.md` remains the durable sink for this item's
eventual observed outcome and should be updated in place (a new dated
appended section, not an overwrite) once someone runs this on a real
desktop session.

## Gaps Summary

None remaining. Both gaps from the prior pass (CR-01/SIDE-02 auth-bypass
inheritance, WR-01/SHELL-02 boundary-guard evasion) are fixed in commit
`33c5875` (current `HEAD`) and independently re-verified in this pass
against the live source and, for CR-01, against a live empirical test of
the exact defeat scenario the gap described. The phase's automated harness
is 10/10 PASS. The single remaining item -- SHELL-05's perceptual
immediacy claim -- is not a gap; it is a standing human-verification
requirement that has been open since the phase's earliest execution
sessions for lack of a display-attached environment, unrelated to and
unaffected by this pass's fix commit.

---

_Verified: 2026-08-27T06:30:00Z_
_Verifier: Claude (gsd-verifier)_
