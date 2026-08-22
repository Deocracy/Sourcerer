---
phase: 03-branded-firefox-fork
plan: 08
subsystem: testing
tags: [verification-tooling, positive-control, interrupt-safety, ci-hardening]

# Dependency graph
requires:
  - phase: 03-branded-firefox-fork (plan 02, 03)
    provides: "scripts/verify-endpoints.sh's three-layer BRAND-04 proof shape and its layer-1/layer-3 positive controls, made interrupt-safe here"
  - phase: 03-branded-firefox-fork (plan 06)
    provides: "scripts/verify-phase-03.sh's aggregator CHECKS-array shape, later plans append to"
  - phase: 03-branded-firefox-fork (plan 07)
    provides: "the tracer-slice-then-expand shape this plan continues; 03-07-SUMMARY.md's own Next Phase Readiness pointed here"
provides:
  - "scripts/verify-endpoints.sh's PREF_BACKUP_SRC/PREF_BACKUP_DST globals plus track_pref_backup/restore_pref_backup, called unconditionally from cleanup() so both trap cleanup EXIT and trap 'cleanup; exit 130' INT TERM cover the pref-file restore"
  - "scripts/verify-endpoints.sh's --interrupt-self-test mode: sends a real SIGINT into a real running layer-3 positive control and asserts the installed pref file survives byte-identical, with its own independent guard-copy safety net"
  - "scripts/verify-phase-03.sh's verify-endpoints-interrupt-self-test gate entry (10 checks total, up from 9) and eval-free function dispatch (WR-02)"
  - ".github/workflows/rebase-upstream.yml's SHA-pinned checkout action (IN-03), proven by a real successful dispatch (run 32547841783)"
affects: [03-09, 03-10]

# Actuals (#2632)
actuals:
  tokens: 3871
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "track_pref_backup/restore_pref_backup pair, called unconditionally from cleanup() -- any future check that mutates a real installed file for a positive control must register its restore this way, not via a bare local variable, so the script's own trap coverage (EXIT + INT/TERM) restores it on every exit path."
    - "'set -m' (job control), not setsid, for a self-test that needs to send a real SIGINT to a nested recursive invocation of the same script from within a non-interactive script. A plain 'cmd &' from a non-interactive shell (job control off, the default for an executed script) is forked with SIGINT/SIGQUIT already SIG_IGN (POSIX/bash background-job semantics) -- and POSIX/bash then permanently refuse to let a `trap ... INT` in the exec'd child un-ignore a signal that was 'ignored upon entry to the shell', so the recursed script's own INT trap silently never fires. `set -m` makes bash assign the backgrounded job its own fresh process group without pre-ignoring INT/QUIT, which is what actually lets a later `kill -INT -- \"-$pid\"` reach and be trapped by the child. setsid does NOT fix this and, layered under job control, actively breaks PID tracking (forces an internal fork since a process job control already made a group leader cannot setsid() without forking, decoupling $! from the real leader)."

key-files:
  created: []
  modified:
    - scripts/verify-endpoints.sh
    - scripts/verify-phase-03.sh
    - .github/workflows/rebase-upstream.yml

key-decisions:
  - "Dropped setsid in favor of 'set -m' for the self-test's own recursive child launch -- discovered live that setsid, when the launching context also uses job control, forces an extra internal fork that decouples $! from the real process-group leader, defeating negative-PID signal delivery. set -m alone gives the async job its own fresh pgid (== $!) without that fork, and critically avoids the SIG_IGN-on-background-job trap that silently defeats the child's own INT trap when job control is off (the default for a non-interactive script)."
  - "Interrupt self-test's mutation-detection grep matches the appended 'true' value specifically (pref(\"media.gmp-gmpopenh264.enabled\", true)), not the bare key name -- the pristine pref file already contains that same key set to false (one of layer 1's own asserted prefs), so a bare-key grep matched instantly on the pre-existing line and would have made the self-test send SIGINT before the control had mutated anything at all. Discovered via a genuinely vacuous first pass (see Deviations)."
  - "WR-02's guard rejects any future CHECKS entry whose function-dispatch command contains whitespace, rather than silently mis-invoking it via eval -- keeps the 'later plans append to CHECKS' contract honest per the plan's own instruction."

patterns-established: []

requirements-completed: [BRAND-03, BRAND-04, BUILD-03]

coverage:
  - id: D1
    description: "Layer-1 and layer-3 positive controls back up and restore the real installed pref file through PREF_BACKUP_SRC/PREF_BACKUP_DST and cleanup(), covered by both trap cleanup EXIT and trap 'cleanup; exit 130' INT TERM -- closing 03-VERIFICATION.md Gap 3 / CR-02"
    requirement: "BRAND-04"
    verification:
      - kind: integration
        ref: "bash scripts/verify-endpoints.sh --layer 1 --positive-control (run twice consecutively, sha256 unchanged both times); bash scripts/verify-endpoints.sh --layer 3 --positive-control (PASS, sha256 unchanged); bash scripts/verify-endpoints.sh (full non-control run, all three layers PASS) -- all executed this session, all passed as specified in 03-08-PLAN.md Task 1's acceptance criteria"
        status: pass
    human_judgment: false
  - id: D2
    description: "A real SIGINT sent to a real running layer-3 positive control mid-capture leaves the installed pref file byte-identical, proven RED (fix removed) then GREEN (fix restored), and registered as a phase gate"
    requirement: "BRAND-04"
    verification:
      - kind: integration
        ref: "bash scripts/verify-endpoints.sh --interrupt-self-test (GREEN, exit 0, ~1-2s wall time, well under the 35s window); RED demonstration with restore_pref_backup removed from cleanup() (exit 1, digest mismatch reported, guard restored the file anyway, re-confirmed sha256 equal to pre-run); bash scripts/verify-phase-03.sh lists verify-endpoints-interrupt-self-test: PASS, 10/10 PASS (up from 9) -- all executed this session, all as specified in Task 2's acceptance criteria"
        status: pass
    human_judgment: false
  - id: D3
    description: "scripts/verify-phase-03.sh's function dispatch calls checks by name instead of through eval, with a loud guard against a future whitespace-carrying CHECKS entry (WR-02); home_count/exact_count declared local (IN-02)"
    requirement: "BRAND-03"
    verification:
      - kind: integration
        ref: "grep -c 'eval' inside the case \"$cmd\" block -> 0; bash scripts/verify-phase-03.sh --quick exits 0 with allowlist-schema and desktop-entry-quick both PASS (proving function dispatch still works without eval); grep -c 'local home_count\\|local exact_count' inside run_layer2 -> 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "The CI checkout action is pinned to an immutable 40-character commit SHA (IN-03), with an auditable release comment, and a real dispatch against the pinned SHA concluded success"
    requirement: "BUILD-03"
    verification:
      - kind: integration
        ref: "grep -cE 'uses: actions/checkout@[0-9a-f]{40}' -> 1; grep -cE 'uses: actions/checkout@v[0-9]' -> 0; gh api repos/actions/checkout/commits/v4 --jq .sha matches the pinned value (11d5960a326750d5838078e36cf38b85af677262, v4.4.0); gh workflow run rebase-upstream.yml -f tag=FIREFOX_153_1_0esr_RELEASE dispatched as run 32547841783, gh run watch confirmed conclusion success in 3m30s"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-08-22
status: complete
---

# Phase 3 Plan 8: Branded Firefox Fork -- Interrupt-Safe Endpoint Controls Summary

**`verify-endpoints.sh`'s layer-1/layer-3 positive controls now back up and restore the real installed pref file through the script's own trap-covered `cleanup()`, proven interrupt-safe by a registered self-test that sends a real SIGINT mid-control -- closing 03-VERIFICATION.md's Gap 3 (CR-02) and the CI checkout action is now SHA-pinned (IN-03), proven by a real successful dispatch.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-22T02:50:00Z (approx, first read)
- **Completed:** 2026-08-22T03:05:41Z (workflow dispatch conclusion)
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- `scripts/verify-endpoints.sh` gained `PREF_BACKUP_SRC`/`PREF_BACKUP_DST` globals and `track_pref_backup`/`restore_pref_backup` helpers. `restore_pref_backup` is called unconditionally from `cleanup()` (before the `TEMP_PATHS` deletion loop), which both `trap cleanup EXIT` and `trap 'cleanup; exit 130' INT TERM` already invoke -- so the pref-file restore is now covered by the exact same mechanism that already covered `ACTIVE_PID` and `TEMP_PATHS`. `run_layer1_control()` and `run_layer3_impl()`'s control branch were rewritten to use the new helpers in place of their bare `local backup`/`mktemp`/`cp` pairs.
- A new `--interrupt-self-test` mode launches the layer-3 positive control (`bash "$0" --layer 3 --positive-control`), polls for its real pref mutation, sends a real SIGINT to its whole process group, and asserts the installed pref file's sha256 is unchanged afterward. It carries its own independent guard-copy safety net (separate from the fix under test) so a self-test that fails still leaves the real binary uncorrupted.
- `scripts/verify-phase-03.sh` registers `verify-endpoints-interrupt-self-test` (10 checks total, up from 9) and no longer uses `eval "$cmd"` for its function-dispatch branch (WR-02) -- it calls the function by name directly, with a loud guard against any future whitespace-carrying `CHECKS` entry.
- IN-02 fixed: `run_layer2_impl`'s `home_count` is now declared `local` (the prior `local mozilla_count exact_count` line declared the wrong variable name, leaving `home_count` leaking into global scope).
- `.github/workflows/rebase-upstream.yml`'s checkout action is pinned to the immutable 40-character SHA `actions/checkout` resolved from tag `v4` (`11d5960a326750d5838078e36cf38b85af677262`, corresponding to release `v4.4.0`), with a trailing comment naming the release. A real `workflow_dispatch` against `FIREFOX_153_1_0esr_RELEASE` (run `32547841783`) concluded `success` in 3m30s, confirming the pin didn't break the workflow.

## Task Commits

Each task was committed atomically:

1. **Task 1: Bring the pref-file backup under the script's own trap-covered cleanup** - `bc4431a` (fix)
2. **Task 2: Prove interrupt-safety with a real SIGINT, and register it as a phase gate** - `f53ed54` (feat)
3. **Task 3: Pin the CI checkout action by commit SHA and prove the workflow still runs** - `8baaa40` (fix)

_No TDD tasks in this plan; each commit is a single fix/feat commit._

## Files Created/Modified

- `scripts/verify-endpoints.sh` - `PREF_BACKUP_SRC`/`PREF_BACKUP_DST` globals, `track_pref_backup`/`restore_pref_backup`, `cleanup()` restore wiring, `--interrupt-self-test` mode and `run_interrupt_self_test()`, IN-02 `local` fix
- `scripts/verify-phase-03.sh` - `verify-endpoints-interrupt-self-test` CHECKS entry, WR-02 eval removal with whitespace guard
- `.github/workflows/rebase-upstream.yml` - checkout action pinned to a 40-char SHA with a release comment

## Decisions Made

- **`set -m` instead of `setsid` for the self-test's recursive child launch** -- discovered live that layering `setsid` under job control forces an extra internal fork (a process job control already made a group leader cannot `setsid()` without forking), decoupling `$!` from the real process-group leader and breaking PID-based signal targeting. `set -m` alone gives the backgrounded job its own fresh pgid equal to `$!`, and -- critically -- avoids the POSIX/bash rule that a plain `cmd &` from a non-interactive shell (job control off, the default for an executed script) is forked with SIGINT/SIGQUIT already `SIG_IGN`, which then permanently blocks the exec'd child's own `trap ... INT` from ever installing (`trap`'s own documented restriction: "signals ignored upon entry to the shell cannot be trapped or reset"). Without this fix the self-test would send a real SIGINT that the recursed script could never actually catch.
- **Mutation-detection grep matches the appended `true` value specifically**, not the bare `media.gmp-gmpopenh264.enabled` key -- the pristine pref file already contains that same key set to `false` (one of layer 1's own asserted prefs), so an initial bare-key-name grep matched instantly on the pre-existing line, making the self-test send SIGINT before the control had mutated anything at all (a genuinely vacuous first pass -- see Deviations).

## Deviations from Plan

### Auto-fixed Issues (Rule 1 -- bugs found and fixed during implementation, before this plan's own tasks were considered done)

**1. [Rule 1 - Bug] `setsid` + job control incompatibility silently defeated the self-test's own SIGINT delivery**
- **Found during:** Task 2, first live run of `--interrupt-self-test`.
- **Issue:** The plan's action text specified launching the layer-3 control "under `setsid`". A first implementation attempt combined `setsid bash "$0" ... &` with `set -m` (needed separately to avoid SIGINT being pre-ignored on a plain background job from a non-interactive script). `setsid`, when the launching shell already has job control assigning the async job its own process group, cannot call `setsid()` without forking (it is already a group leader) -- this produces an extra fork whose real PID differs from the captured `$!`, so `kill -INT -- "-$!"` targeted a process group with nothing running in it (`kill: (-N) - No such process`).
- **Fix:** Dropped `setsid` entirely; `set -m` alone gives the backgrounded job its own fresh process group (pgid == `$!`) without the extra fork, which is what `setsid` was providing anyway in this recursive-same-script context.
- **Files modified:** `scripts/verify-endpoints.sh`
- **Verification:** `kill -INT -- "-$group_pid"` now correctly reaches and terminates the child; confirmed via minimal reproduction (`trap-test2.sh` under `set -m` vs under `setsid` layered on `set -m`) before applying the fix to the real self-test.
- **Committed in:** `f53ed54` (Task 2 commit; this was resolved before the task's own commit, not a follow-up fix)

**2. [Rule 1 - Bug] Mutation-detection grep matched the pref file's pre-existing (unmutated) content**
- **Found during:** Task 2, second live run -- the self-test reported PASS with `observed the mutated pref after 0s`, but a manual reproduction with instrumented timing showed the sha256 was identical to the pre-run value even at the moment of "observed mutation," which is only possible if no real mutation had occurred yet.
- **Issue:** The self-test's poll loop grepped for the bare string `media.gmp-gmpopenh264.enabled`. The pristine (unmutated) pref file already contains this exact key, set to `false` (it's one of layer 1's own asserted prefs, visible via `layer1_check`'s `PASS media.gmp-gmpopenh264.enabled` line). The bare-key grep therefore matched instantly, before the control had appended anything, making the self-test send SIGINT essentially immediately regardless of whether real mutation had occurred -- a vacuous "always green" test.
- **Fix:** Changed the grep to `grep -qE 'pref\("media\.gmp-gmpopenh264\.enabled",[[:space:]]*true\)'`, matching the appended line's specific `true` value.
- **Files modified:** `scripts/verify-endpoints.sh`
- **Verification:** Re-ran the RED demonstration (restore removed from `cleanup()`) with the corrected grep: it now correctly detects the real mutation and reports a genuine digest mismatch (`d4b5c4f...` vs the pre-run `72700958...`), proving the earlier PASS had been vacuous and the corrected version is not.
- **Committed in:** `f53ed54` (Task 2 commit; caught and fixed before the task's own commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 -- bugs discovered while implementing and self-verifying Task 2, both corrected before that task's commit landed; neither reached a committed state in its broken form).
**Impact on plan:** Both fixes were necessary for the self-test to be a genuine (non-vacuous) proof rather than an assertion of intent -- exactly the failure mode this plan exists to prevent, caught by the plan's own mandatory RED-demonstration requirement. No scope creep; both fixes are confined to `run_interrupt_self_test()`.

## Issues Encountered

None beyond the two deviations documented above, both resolved during Task 2's own implementation and verification loop.

## Verbatim Verification Output

**Precondition sha256** (Task 1, before any change): `727009586545c3b325f19d4e780a5e8b7332f360c65715ab2f3172331def2e02` for `objdir/dist/bin/browser/defaults/preferences/firefox-branding.js` (`media.gmp-manager.url=""`, `media.gmp-gmpopenh264.enabled=false`).

**RED -- `--interrupt-self-test` with `restore_pref_backup` removed from `cleanup()`:**
```
$ bash scripts/verify-endpoints.sh --interrupt-self-test
verify-endpoints: interrupt self-test...
verify-endpoints: interrupt self-test observed the mutated pref after 1s -- sending SIGINT to the control's process group
verify-endpoints: interrupt self-test FAIL -- pref file digest mismatch after interrupt
  expected: 727009586545c3b325f19d4e780a5e8b7332f360c65715ab2f3172331def2e02
  observed: d4b5c4fee5ef44994f724686b4930fe944ae0a4ec190076ccd67801ea0865924
115a116,117
>
> pref("media.gmp-gmpopenh264.enabled", true);
(exit 1)
```
Safety net proven: `sha256sum objdir/dist/bin/browser/defaults/preferences/firefox-branding.js` immediately after this RED run == `727009586545c3b325f19d4e780a5e8b7332f360c65715ab2f3172331def2e02` (the self-test's own guard copy restored the file even though the self-test itself failed).

**GREEN -- fix restored:**
```
$ bash scripts/verify-endpoints.sh --interrupt-self-test
verify-endpoints: interrupt self-test...
verify-endpoints: interrupt self-test observed the mutated pref after 1s -- sending SIGINT to the control's process group
verify-endpoints: interrupt self-test PASS -- pref file digest unchanged after interrupt (727009586545c3b325f19d4e780a5e8b7332f360c65715ab2f3172331def2e02)
(exit 0, wall time ~2s)
```

**Pre-plan aggregator check count:** 9 (per 03-07-SUMMARY.md's post-plan count)
**Post-plan aggregator check count:** 10 (adds `verify-endpoints-interrupt-self-test`)

```
$ bash scripts/verify-phase-03.sh
  check-patch-surface: PASS
  check-patch-surface-self-test: PASS
  apply-patches-self-test: PASS
  fetch-upstream-self-test: PASS
  allowlist-schema: PASS
  verify-branding-identity-dev: PASS
  verify-branding-identity-release: PASS
  verify-branding-identity-brand-ftl-control: PASS
  verify-endpoints: PASS
  verify-endpoints-interrupt-self-test: PASS
verify-phase-03: PASS -- all checks passed   (exit 0)
```

**CI run:** run id `32547841783`, dispatched against `FIREFOX_153_1_0esr_RELEASE`, `gh run watch` confirmed all steps green and `conclusion: success` in 3m30s -- compares against the pre-existing run `32543353637` (03-06's dispatch, also success), confirming the SHA pin (`actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0`) did not break the workflow.

**Final state:** `sha256sum objdir/dist/bin/browser/defaults/preferences/firefox-branding.js` == `727009586545c3b325f19d4e780a5e8b7332f360c65715ab2f3172331def2e02`, identical to the Task 1 precondition value, after every command run in this plan.

## Known Stubs

None -- every code path added is real and exercised by the verification above; no mock/placeholder data paths.

## Threat Flags

None -- this plan modifies only verification tooling (two bash scripts) and a CI workflow's action pin. No new network endpoints, auth paths, or file-access patterns beyond the pre-existing pref-file read/write the positive controls already performed; the SHA pin is a supply-chain hardening change, not a new surface.

## User Setup Required

None -- no external service configuration required. The CI dispatch used the existing `gh` CLI authentication already available in this environment.

## Next Phase Readiness

- All three of 03-VERIFICATION.md's Gap 3 (CR-02) acceptance criteria are closed: the pref-file backup is trap-covered, proven interrupt-safe by a real SIGINT with a registered RED-then-GREEN self-test, and idempotent across repeated control runs.
- The three advisory findings scoped to this plan (WR-02, IN-02, IN-03) are all fixed and verified.
- `bash scripts/verify-phase-03.sh` exits 0 with 10/10 PASS as of this plan's last commit; the pref file's sha256 is unchanged from the phase's clean pre-run state throughout.
- Remaining open item from `03-VERIFICATION.md`: Gap 2 (the endpoint allowlist's three-Mozilla-host wording mismatch against the roadmap/REQUIREMENTS text) is out of this plan's scope and remains for a subsequent gap-closure plan (03-09 or 03-10 per 03-07-SUMMARY.md's Next Phase Readiness).
- No blockers.

---
*Phase: 03-branded-firefox-fork*
*Completed: 2026-08-22*

## Self-Check: PASSED

All claimed files found on disk (`scripts/verify-endpoints.sh`, `scripts/verify-phase-03.sh`, `.github/workflows/rebase-upstream.yml`, this SUMMARY.md). All claimed commits found in git history (`bc4431a`, `f53ed54`, `8baaa40`).
