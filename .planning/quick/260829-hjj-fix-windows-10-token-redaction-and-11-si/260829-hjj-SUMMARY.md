---
phase: quick
plan: 260829-hjj
subsystem: security
tags: [firefox-esr, theia-sidecar, verify-harness, token-redaction, config-dir]

requires:
  - phase: 05-lifecycle-failure-hardening
    provides: TheiaService diagnostics ring buffer (_pushLog/_pumpOutput), verify-phase-05.sh launch harness, CR-01 profile-scoped sidecar state files
provides:
  - "_pushLog redacts the per-launch token before buffering, closing WINDOWS.md 10 / 05-REVIEW.md MED-02"
  - "verify-phase-04.sh and verify-phase-05.sh no longer litter the real ~/.config/sourcerer, closing WINDOWS.md 11"
affects: [05-lifecycle-failure-hardening, gsd-ship, windows-ledger]

actuals:
  tokens: 8671
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Ring-buffer redaction at the single choke point (_pushLog), not at every caller"
    - "Harness-scoped XDG_CONFIG_HOME exported for the whole verify-script run, with an explicit setsid-level override still winning for planted-fixture launches"

key-files:
  created: []
  modified:
    - sourcerer/shell/TheiaService.sys.mjs
    - scripts/verify-phase-05.sh
    - scripts/verify-phase-04.sh
    - .planning/WINDOWS.md
    - .planning/phases/05-lifecycle-failure-hardening/05-REVIEW.md
    - .planning/STATE.md

key-decisions:
  - "_pushLog's null/empty-token guard is load-bearing (replaceAll(null,...) matches literal 'null'; replaceAll('',...) splices between every character), not defensive noise"
  - "SourcererAPI.log console mirror in _pumpOutput stays deliberately unredacted -- same sink the text already came from, not a new surface"
  - "Widened Task 2 beyond the plan's two named call sites (start_shell/start_shell_display) after live evidence showed scripts/lib/firefox-bidi.mjs's own child_process.spawn also leaked into the real config dir; fixed by exporting XDG_CONFIG_HOME for the whole verify-phase-04.sh/05.sh run rather than only at the two setsid call sites"
  - "verify-phase-04.sh's start_backend() config dir preserved via a REAL_XDG_CONFIG_HOME snapshot taken before the harness override, honoring the plan's explicit 'leave start_backend alone' scope boundary"

patterns-established:
  - "verify-phase-*.sh harness scripts export a run-scoped XDG_CONFIG_HOME (not just per-invocation) so any future child process spawned by the script, including ones not yet identified, cannot write into the real user config dir"

requirements-completed: []

coverage:
  - id: D1
    description: "TheiaService._pushLog redacts the per-launch token from every line before buffering into the diagnostics ring buffer, with null/empty-token safety"
    verification:
      - kind: unit
        ref: "scripts/verify-phase-05.sh --only shell04-log-redacts-token"
        status: pass
    human_judgment: false
  - id: D2
    description: "verify-phase-05.sh and verify-phase-04.sh no longer write sidecar-state files into the real ~/.config/sourcerer; 305 stale files removed"
    verification:
      - kind: integration
        ref: "scripts/verify-phase-05.sh --only side04-sigkill-no-orphan (file count unchanged, before=after=2)"
        status: pass
      - kind: integration
        ref: "scripts/verify-phase-04.sh full run (10/10, file count unchanged, before=after=2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "WINDOWS.md entries 10 and 11 marked fixed in both the table and JSON block; 05-REVIEW.md and STATE.md updated to match"
    verification:
      - kind: other
        ref: "node gsd-tools.cjs windows status --raw (open_count 3, fixed_count 8, open ids [1,5,7])"
        status: pass
      - kind: other
        ref: "node -e JSON.parse on WINDOWS.md's fenced json block"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-29
status: complete
---

# Close WINDOWS.md 10 (token redaction) and 11 (sidecar-state litter) Summary

**Redacted the per-launch token in TheiaService's diagnostics ring buffer at its single choke point (`_pushLog`), stopped both verify harnesses from littering the real `~/.config/sourcerer` (widened mid-task to cover a `firefox-bidi.mjs` spawn path the plan's original scope missed), and closed WINDOWS.md entries 10 and 11 in the ledger and the Phase-5 review record.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files modified:** 6
- **Commits:** 3

## Accomplishments

- `TheiaService._pushLog` now scrubs `this._token` from every buffered line via `replaceAll`, with explicit null-token and empty-string-token guards (the latter catches a real splicing bug: `replaceAll("", X)` inserts `X` between every character). Guarded by a new behavioral check, `shell04-log-redacts-token`, proven red-before-green against the real shipped module.
- Both `verify-phase-05.sh` and `verify-phase-04.sh` now mint a run-scoped `HARNESS_CONFIG_HOME` and export it as `XDG_CONFIG_HOME` for the entire script run, so `TheiaService._resolveConfigDir()` (which already honors `XDG_CONFIG_HOME` ahead of `HOME`) never touches the real config directory. Deleted 305 accumulated stale `sidecar-state-_tmp_*.json` files; the 2 real-profile files survive.
- WINDOWS.md entries 10 and 11 flipped to `fixed` via `gsd-tools windows fixed`, then hand-edited (table row + JSON block, kept in sync) with the resolving commits and guards. `windows status` now reports `open_count: 3` (entries 1, 5, 7), `fixed_count: 8`.
- `05-REVIEW.md`'s MED-02 finding gets a `RESOLVED` heading and resolution note in the same style as MED-01; its status paragraph now lists LOW-01/LOW-02 as the only open findings.

## Task Commits

1. **Task 1: Redact the token in `_pushLog` and guard it with a behavioral check** - `d61b27b` (fix)
2. **Task 2: Point harness browser launches at a throwaway `XDG_CONFIG_HOME` and delete the stale state files** - `bf1d482` (fix)
3. **Task 3: Close entries 10 and 11 in the ledger and the phase record** - `279485f` (docs)

`STATE.md`'s blocker-list and "Still open and tracked" edits are staged but intentionally left uncommitted here — per this quick task's constraints, the orchestrator commits `STATE.md` in its own docs pass.

## Files Created/Modified

- `sourcerer/shell/TheiaService.sys.mjs` - `_pushLog` redacts the per-launch token before buffering
- `scripts/verify-phase-05.sh` - new `shell04-log-redacts-token` check; `HARNESS_CONFIG_HOME` exported as `XDG_CONFIG_HOME` for the whole run
- `scripts/verify-phase-04.sh` - `HARNESS_CONFIG_HOME` exported as `XDG_CONFIG_HOME`; `start_backend()`'s config dir preserved via `REAL_XDG_CONFIG_HOME` snapshot
- `.planning/WINDOWS.md` - entries 10 and 11 marked `fixed`, descriptions rewritten with resolving commits, table and JSON block kept in sync
- `.planning/phases/05-lifecycle-failure-hardening/05-REVIEW.md` - MED-02 heading marked `RESOLVED`, resolution note added, status paragraph updated
- `.planning/STATE.md` - two `Blockers/Concerns` bullets flipped to `CLOSED`, "Still open and tracked" sentence narrowed to entries 1, 5, 7 (staged, uncommitted per constraints)

## Decisions Made

- The `this._token ?` truthiness guard in `_pushLog` is load-bearing: `_token` is `null` until `start()` mints it (`replaceAll(null, ...)` would match the literal four-character string `"null"`), and an empty string would splice `[redacted]` between every character.
- The sibling `SourcererAPI.log("log", line)` mirror in `_pumpOutput` stays unredacted by design — it writes to the browser's own stdout, the same sink the text already came from; the ring buffer is the newly in-app-reachable surface the review named.
- Widened Task 2's scope beyond the plan's two named call sites (`start_shell`, `start_shell_display`) after live verification surfaced a third leak path: `scripts/lib/firefox-bidi.mjs`'s own `child_process.spawn` inherits `process.env` and is invoked from `verify-phase-04.sh`'s inline node checks, so a stray `sidecar-state-_tmp_*` file appeared after the first fix pass. Fixed by exporting `XDG_CONFIG_HOME` for the whole script run rather than only at the two setsid call sites.
- To honor the plan's explicit "leave `start_backend` alone" boundary despite the now-global `XDG_CONFIG_HOME` export, `verify-phase-04.sh` snapshots the real (possibly unset) value into `REAL_XDG_CONFIG_HOME` before the harness override, and `start_backend()`'s `config_dir` line reads that snapshot instead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 2's fix left a stray sidecar-state file via `firefox-bidi.mjs`**
- **Found during:** Task 2, first verification pass (the plan's own `verify-phase-04.sh` check)
- **Issue:** After patching only `start_shell`/`start_shell_display`'s `setsid env` invocations (the plan's literal scope), a third file (`sidecar-state-_tmp_nix_shell_..._sourcerer_firefox_bidi_....json`) appeared in the real config dir. `scripts/lib/firefox-bidi.mjs`'s `withFirefoxPage`/`captureScreenshot` spawn Firefox directly via `child_process.spawn`, inheriting `process.env` unmodified, and several `verify-phase-04.sh` checks invoke that library from inline node scripts — a launch path the plan's two-call-site scope didn't account for.
- **Fix:** Exported `XDG_CONFIG_HOME=$HARNESS_CONFIG_HOME` for the whole script run in both `verify-phase-05.sh` and `verify-phase-04.sh`, so any child process spawned anywhere in the script inherits the throwaway config dir. Preserved `start_backend()`'s real-config-dir behavior (explicitly out of scope per the plan) via a `REAL_XDG_CONFIG_HOME` snapshot taken before the export.
- **Files modified:** `scripts/verify-phase-04.sh`, `scripts/verify-phase-05.sh`
- **Verification:** Re-ran both plan verify commands after the fix — `side04-sigkill-no-orphan` (before=after=2) and a full `verify-phase-04.sh` run (10/10, before=after=2, no stray files).
- **Committed in:** `bf1d482` (Task 2 commit)

**2. [Rule 1 - Bug] Plan's Task 3 verify command reads the wrong JSON shape**
- **Found during:** Task 3 verification
- **Issue:** The plan's automated check piped `windows status --raw` into a script reading `j.open_count`/`j.fixed_count` at the top level, but the CLI's actual output nests those fields under `j.ledger`.
- **Fix:** No code change needed (the CLI output itself is correct and unrelated to this task's scope) — verified the same counts by reading `j.ledger.open_count`/`j.ledger.fixed_count` instead, confirming `open_count: 3`, `fixed_count: 8`.
- **Files modified:** None
- **Verification:** `node gsd-tools.cjs windows status --raw` piped through a corrected reader confirms the exact counts and open-id set (`[1, 5, 7]`) the plan's `<done>` criteria require.
- **Committed in:** N/A (verification-only, no file change)

---

**Total deviations:** 2 auto-fixed (1 bug found via live verification, 1 verification-command mismatch worked around)
**Impact on plan:** Both necessary to actually meet the plan's stated truths (unchanged file count across every launch path; correct ledger counts). No scope creep beyond what was needed to close the two gaps the plan's <verify> steps themselves exposed.

## Issues Encountered

None beyond the two deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WINDOWS.md is at 3 open entries (1, 5, 7), all decisions/platform-blocks rather than defects — matches this task's stated purpose.
- `verify-phase-05.sh` is 15/15 (14 prior + `shell04-log-redacts-token`); `verify-phase-04.sh` remains 10/10 with the litter fix verified live.
- `.planning/STATE.md`'s edits are staged but uncommitted, per this task's constraints — the orchestrator's docs commit should include it alongside this SUMMARY.

---
*Phase: quick*
*Completed: 2026-08-29*

## Self-Check: PASSED

All 7 claimed files found on disk; all 3 claimed commit hashes (`d61b27b`, `bf1d482`, `279485f`) found in `git log --oneline --all`.
