---
phase: 02-sourcerer-theia-extensions
plan: 02
subsystem: testing
tags: [webdriver-bidi, firefox-headless, inversify, yarn-integrity, uri-scheme]

requires:
  - phase: 02-sourcerer-theia-extensions (plan 01)
    provides: "scripts/lib/firefox-bidi.mjs -- shared zero-dependency WebDriver BiDi driver for objdir/dist/bin/firefox, and scripts/verify-branding.mjs as the calling-convention precedent"
provides:
  - "scripts/diff-theia-core.sh -- criterion-2 proof (zero changes inside theia/node_modules/@theia/*), two-stage (yarn check --integrity, then a fresh-resolve diff), --quick flag for per-commit sampling"
  - "scripts/lib/firefox-bidi.mjs gains captureScreenshot(url, outputPath) -- the --headless --screenshot launch mode Plan 05's pixel comparison consumes"
  - "scripts/verify-dev-flag-off.mjs -- the CUST-02 proof with a positive control (--expect-bound), evaluating Symbol.for('SourcererPrivilegedJs') isBound() in the running page"
  - "scripts/verify-uri-roundtrip.mjs -- table-driven URI-01..URI-04 proof (21 view: rows + settings: + terminal:, plus the four D-51 carve-outs), red by design until Plan 06/07 land"
  - "scripts/verify-phase-02.sh -- sequencing driver owning app lifecycle (build/start/poll/teardown) for every phase-02 check"
affects: [02-03, 02-04, 02-05, 02-06, 02-07]

actuals:
  tokens: 8745
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Resolving a Theia DI service from an external WebDriver BiDi evaluation context by walking Inversify's internal container._bindingDictionary and matching the bound identifier's .toString()/.name against a well-known name -- necessary because bare Symbol()/class identifiers minted inside the bundle are unreachable by reference from outside it (same root cause as D-64's Symbol.for requirement, applied to core's own OpenerService/WidgetManager, which are NOT Symbol.for)."
    - "A minimal URI-compatible shim object (scheme, path.toString()/.base/.ext, toString(skipEncoding), Proxy fallback for unknown methods) in place of @theia/core's real URI class, for the same external-evaluation-context reason -- documented as the load-bearing assumption Plan 06/07 must not break by adding an instanceof URI check to any handler."
    - "bash trap cleanup EXIT INT TERM is insufficient for a script that must actually terminate on interrupt -- bash resumes script execution after a non-EXIT trap handler returns unless it calls exit itself. Split into trap cleanup EXIT plus trap 'cleanup; exit N' INT TERM."

key-files:
  created:
    - scripts/diff-theia-core.sh
    - scripts/verify-dev-flag-off.mjs
    - scripts/verify-uri-roundtrip.mjs
    - scripts/verify-phase-02.sh
  modified:
    - scripts/lib/firefox-bidi.mjs

key-decisions:
  - "diff-theia-core.sh's yarn check --integrity must be called with --ignore-scripts to match the flag yarn install was run with (Phase 1's audited install sequence) -- yarn records install flags in node_modules/.yarn-integrity and check fails with an unrelated-looking 'Flags don't match' error otherwise."
  - "diff-theia-core.sh's stage-2 fresh-resolve copies every applications/*, extensions/* workspace member package.json into the temp dir alongside the root manifest, not just the root -- the root package.json declares zero @theia/* dependencies itself (they live in the workspace members), so copying only the root resolves nothing and silently 'passes' with an empty node_modules/@theia."
  - "verify-uri-roundtrip.mjs resolves OpenerService/WidgetManager/TabUriRegistry via Inversify _bindingDictionary reflection and constructs a minimal URI-shim rather than a real @theia/core URI instance -- both are unreachable from an external BiDi evaluation context (no bare-module import in the page, no DI-bound identifier for either), documented in the script's own header as the informal contract Plan 06/07 must honor."
  - "verify-uri-roundtrip.mjs's per-row check pre-creates the widget via widgetManager.getOrCreateWidget(factoryId, undefined) before opening by URI, as a Wave-0 approximation of D-46's 'menu path first, then URI path' full coverage -- a per-row command-id table isn't available from this phase's research; Plan 06 Task 3 is where full menu-command coverage against a real running app lands."
  - "verify-phase-02.sh splits its cleanup trap into `trap cleanup EXIT` plus `trap 'cleanup; exit 130' INT TERM` -- a single `trap cleanup EXIT INT TERM` left an orphaned backend on :3000 when SIGINT arrived before SERVER_PID was assigned, because bash resumes the rest of the script after a non-EXIT trap handler returns unless it explicitly exits."

requirements-completed: [CUST-02, URI-01, URI-02, URI-03]

coverage:
  - id: D1
    description: "scripts/diff-theia-core.sh proves criterion 2 (zero changes inside theia/node_modules/@theia/*) mechanically -- two-stage (yarn check --integrity, then a fresh-resolve diff against a mktemp install), --quick flag for the per-commit sampling rate, catches a deliberate tamper and cleans up its temp directory unconditionally."
    verification:
      - kind: integration
        ref: "nix develop .#theia --command bash scripts/diff-theia-core.sh --quick and full mode, both PASS on a clean tree; a deliberate byte appended to theia/node_modules/@theia/core/package.json makes the full-mode run FAIL, restoring the file returns it to PASS"
        status: pass
    human_judgment: false
  - id: D2
    description: "scripts/lib/firefox-bidi.mjs gains captureScreenshot(url, outputPath) -- a --headless --screenshot launch mode sharing the same process/profile cleanup discipline as withFirefoxPage, for Plan 05's pixel comparison to consume."
    verification:
      - kind: integration
        ref: "captureScreenshot('about:blank', <path>) against the live objdir/dist/bin/firefox writes a file whose first 8 bytes are the PNG magic number; pgrep -fc objdir/dist/bin/firefox unchanged before/after, no leftover temp profile"
        status: pass
    human_judgment: false
  - id: D3
    description: "scripts/verify-dev-flag-off.mjs proves CUST-02 with a working positive control -- default mode asserts isBound() false, --expect-bound inverts the assertion, both branches reachable against the same running app before @sourcerer/customize exists."
    requirement: "CUST-02"
    verification:
      - kind: e2e
        ref: "node scripts/verify-dev-flag-off.mjs http://localhost:3000 against a theia build (lib/) artifact: default mode PASS (isBound false), --expect-bound FAIL as expected (token not yet registered); process hygiene confirmed stable across pass, fail, and SIGINT-mid-flight runs"
        status: pass
    human_judgment: false
  - id: D4
    description: "scripts/verify-uri-roundtrip.mjs is a red-by-design, table-driven proof for URI-01/URI-02/URI-03 covering all 21 view: rows (the five RESEARCH corrections, the one D-43 omission), settings:, and terminal:, plus the four D-51 carve-outs that never gate the exit code."
    requirement: "URI-03"
    verification:
      - kind: e2e
        ref: "node scripts/verify-uri-roundtrip.mjs http://localhost:3000 (and --scheme view / --scheme settings / --scheme terminal): all 23 non-carve-out rows correctly FAIL today (TabUriRegistry not bound), exit code 1 -- expected until Plan 06/07 land. Table content verified against the exact RESEARCH sec4 corrections and the D-43 exclusion list."
        status: pass
    human_judgment: false
  - id: D5
    description: "scripts/verify-phase-02.sh sequences diff-theia-core.sh, verify-branding.mjs, verify-dev-flag-off.mjs, verify-uri-roundtrip.mjs, owning the app's full lifecycle (optional build, start, poll-for-port, always-teardown) and exiting non-zero if any check fails."
    verification:
      - kind: integration
        ref: "bash scripts/verify-phase-02.sh full run: diff-theia-core/verify-branding/verify-dev-flag-off PASS, verify-uri-roundtrip correctly FAILs, overall exit 1; app torn down cleanly (curl to :3000 fails afterward). SIGINT sent early in the run (before SERVER_PID assignment) reproduced an orphaned backend under the original single-trap form, resolved by splitting the EXIT trap from the INT/TERM trap; re-verified clean (no orphan process, port down, no leftover Firefox process or temp profile) at multiple interrupt points."
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-20
status: complete
---

# Phase 2 Plan 02: Wave 0 Verification Harness (diff, dev-flag, URI round-trip, sequencing driver) Summary

**Four checked-in scripts that prove phase-02's remaining Wave 0 verification surface before the code they check exists -- a checksum-diff proof for zero @theia/* drift, a positive-controlled CUST-02 proof, a red-by-design table-driven URI round-trip proof against the FactoryId table, and the driver that sequences all phase-02 checks with full app-lifecycle ownership.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3 completed
- **Files modified:** 5 (4 created, 1 extended)

## Accomplishments
- `scripts/diff-theia-core.sh` implements 02-RESEARCH.md sec5's two-stage mechanism (`yarn check --integrity` for cheap per-commit sampling, a fresh-resolve `diff -rq` against a `mktemp` install for the CI-grade authoritative check) as one script with a `--quick` flag, catches a real tamper inside `@theia/core/package.json`, and cleans up its temp directory unconditionally.
- `scripts/lib/firefox-bidi.mjs` gains `captureScreenshot(url, outputPath)`, a separate `--headless --screenshot` launch mode (no BiDi socket) sharing the driver's process/profile cleanup discipline, ready for Plan 05's pixel comparison.
- `scripts/verify-dev-flag-off.mjs` asserts `window.theia.container.isBound(Symbol.for('SourcererPrivilegedJs'))` in the running page against a `theia build` (`lib/`) artifact, with `--expect-bound` as the positive control the RESEARCH Assumptions Log (A1) requires -- both branches verified reachable live.
- `scripts/verify-uri-roundtrip.mjs` transcribes 02-RESEARCH.md sec4's FactoryId table verbatim (21 `view:` rows including all five corrections and the one D-43 omission, plus `settings:` and `terminal:`), asserting D-53's round-trip (`registry.uriOf(widget).toString(true) === input` and the singleton-count check that catches D-46's `options: {}` fork) per row. Since `@sourcerer/tab-uris` does not exist yet, this required solving two reflection problems documented in the script's header: resolving Theia's DI services from an external BiDi evaluation context (Inversify `_bindingDictionary` walk) and constructing URI-compatible values without the real `@theia/core` `URI` class (a minimal shim). Verified red today (all 23 non-carve-out rows FAIL for the expected reason), as Wave 0 requires.
- `scripts/verify-phase-02.sh` sequences all four phase-02 checks, owning the app's full lifecycle (optional `--build`, `theia start` in the background, poll-for-port, always-teardown via trap). A live SIGINT test caught and fixed a real bug in the original single-trap form (see Deviations).

## Task Commits

1. **Task 1: scripts/diff-theia-core.sh -- the criterion-2 proof** - `bbc426e` (feat)
2. **Task 2: scripts/verify-dev-flag-off.mjs -- the CUST-02 proof, plus the screenshot helper** - `21c48d0` (feat)
3. **Task 3: scripts/verify-uri-roundtrip.mjs and the verify-phase-02.sh driver** - `0d5aca6` (feat)

## Files Created/Modified
- `scripts/diff-theia-core.sh` - criterion-2 proof, two-stage, `--quick` flag
- `scripts/lib/firefox-bidi.mjs` - gained `captureScreenshot(url, outputPath)` export
- `scripts/verify-dev-flag-off.mjs` - CUST-02 proof with `--expect-bound` positive control
- `scripts/verify-uri-roundtrip.mjs` - table-driven URI-01..URI-04 proof, red by design
- `scripts/verify-phase-02.sh` - sequencing driver, owns app lifecycle

## Decisions Made
See `key-decisions` in frontmatter for the five load-bearing decisions: the `--ignore-scripts` flag-matching requirement for `yarn check --integrity`, copying workspace-member manifests into the fresh-resolve temp dir, the DI-reflection and URI-shim mechanisms `verify-uri-roundtrip.mjs` uses (an explicit informal contract for Plan 06/07), the Wave-0 approximation of D-46's menu-then-URI check, and the `verify-phase-02.sh` trap split.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `yarn check --integrity` failed with a misleading "Flags don't match" error**
- **Found during:** Task 1, first live run of `diff-theia-core.sh --quick`
- **Issue:** `theia/node_modules/.yarn-integrity` records the flags `yarn install` was run with (`ignoreScripts`, per Phase 1's audited `--ignore-scripts` install). `yarn check --integrity` without the same flag reports an unrelated-looking "Flags don't match" failure instead of a content-integrity result.
- **Fix:** Added `--ignore-scripts` to the `yarn check --integrity` invocation.
- **Files modified:** `scripts/diff-theia-core.sh`
- **Verification:** `nix develop .#theia --command bash scripts/diff-theia-core.sh --quick` now exits 0 on a clean tree.
- **Committed in:** `bbc426e` (part of Task 1 commit)

**2. [Rule 1 - Bug] Fresh-resolve stage produced an empty `node_modules/@theia`**
- **Found during:** Task 1, first live run of the full (non-`--quick`) mode
- **Issue:** The plan's action text copies only `theia/package.json` and `theia/yarn.lock` into the temp dir. `theia/package.json`'s own `dependencies` is empty -- every `@theia/*` dependency is declared by the `applications/*`/`extensions/*` workspace members, so a root-only copy resolves nothing at all, producing a silently vacuous PASS (empty directory diffed against empty directory).
- **Fix:** Also copy every `applications/*/package.json` and `extensions/*/package.json` into matching subdirectories of the temp dir before `yarn install --ignore-scripts --frozen-lockfile` -- exactly the fallback the plan's own action text names ("if yarn refuses the manifest, copy the workspace members' package.json files").
- **Files modified:** `scripts/diff-theia-core.sh`
- **Verification:** Full-mode run now resolves real `@theia/*` packages into the temp `node_modules/@theia`, diffs correctly against the repo tree, and catches a deliberate tamper.
- **Committed in:** `bbc426e` (part of Task 1 commit)

**3. [Rule 1 - Bug] `diff -rq` output went to stdout, not stderr**
- **Found during:** Task 1, code review before commit
- **Issue:** The plan's example script piped `diff -rq`'s own output directly, which prints to stdout regardless of the surrounding `||` branch, contradicting the plan's stated contract ("the diff output on stderr").
- **Fix:** Captured `diff -rq`'s output into a variable and explicitly `echo`'d it to stderr in the FAIL branch.
- **Files modified:** `scripts/diff-theia-core.sh`
- **Verification:** Tamper test confirms the diff detail appears on stderr.
- **Committed in:** `bbc426e` (part of Task 1 commit)

**4. [Rule 1 - Bug] `verify-uri-roundtrip.mjs`'s URI shim crashed unrelated OpenHandlers**
- **Found during:** Task 3, first live run of the `output:` carve-out probe
- **Issue:** `OpenerService.getOpener()` calls every registered handler's `canHandle(uri)`, not just the scheme-matching one. An in-tree handler unrelated to the scheme under test called `uri.withoutFragment()` on the shim, which only implemented `scheme`/`path`/`toString`, crashing the whole probe (`uri.withoutFragment is not a function`) instead of returning a clean 0 from the unrelated handler.
- **Fix:** Wrapped the shim in a `Proxy` that returns a chainable no-op for any method it does not implement, so probing by unrelated handlers cannot crash the row under test. Real assertions only ever read `scheme` and `toString(true)`, both still defined directly.
- **Files modified:** `scripts/verify-uri-roundtrip.mjs`
- **Verification:** The `output:` carve-out probe now fails cleanly with a resource-provider-not-registered message (still correctly red -- the package isn't installed yet) instead of crashing.
- **Committed in:** `0d5aca6` (part of Task 3 commit)

**5. [Rule 1 - Bug] `verify-phase-02.sh`'s single trap left the app orphaned on SIGINT**
- **Found during:** Task 3, live SIGINT testing per the plan's process-hygiene acceptance criterion
- **Issue:** `trap cleanup EXIT INT TERM` does not actually terminate a bash script on INT/TERM -- bash resumes the rest of the script after a non-`EXIT` trap handler returns, unless that handler calls `exit` itself. A SIGINT delivered before `SERVER_PID` was assigned ran `cleanup()` as a no-op, then the script continued straight through a full normal run, and the theia backend it eventually started was left running on `:3000` with no further chance to clean it up.
- **Fix:** Split into `trap cleanup EXIT` plus `trap 'cleanup; exit 130' INT TERM`, so an interrupt explicitly exits (which still fires the EXIT trap once more afterward -- harmless, `cleanup()` is idempotent against an already-dead PID).
- **Files modified:** `scripts/verify-phase-02.sh`
- **Verification:** Repeated the identical early-SIGINT test after the fix: port `:3000` correctly down afterward, no orphaned `theia/applications/browser` process. Also verified clean teardown on a normal full run and on SIGINT mid-checks (Firefox process count and temp-profile directories unchanged before/after in all cases).
- **Committed in:** `0d5aca6` (part of Task 3 commit)

---

**Total deviations:** 5 auto-fixed (all Rule 1 -- bugs blocking task completion or its own `<verify>`/acceptance criteria).
**Impact on plan:** All five were required for the plan's own verification steps to pass honestly (not vacuously); no scope creep beyond what the plan already specified. Deviation 4 (the URI-shim Proxy fallback) and the DI-reflection/URI-shim mechanism itself (see key-decisions) are the one place this plan exercised genuine discretion beyond the plan's action text, because no locked decision specifies how an external BiDi evaluation context resolves a not-yet-existing extension's DI services -- documented in the script's own header as the informal contract Plan 06/07 must honor.

## Issues Encountered
None beyond the five auto-fixed deviations above.

## User Setup Required
None -- no external service configuration required.

## Next Phase Readiness
`scripts/verify-phase-02.sh` and its four constituent checks are ready to gate Plan 03 onward. `scripts/verify-uri-roundtrip.mjs`'s DI-reflection and URI-shim mechanism is a load-bearing informal contract for Plan 06 (`view:`/`settings:`) and Plan 07 (`terminal:`, remaining reverse lookups): as long as neither handler does an `instanceof URI` check, and `@sourcerer/tab-uris` binds `TabUriRegistry` under its class identifier (the ordinary `bind(TabUriRegistry).toSelf()` idiom, not a bare `Symbol()`), this script will turn green without modification once those plans land. If either assumption breaks, this script needs a matching update -- flagged here so a future reader does not have to rediscover it live. No blockers.

## Self-Check: PASSED

All 5 created/modified files confirmed present on disk (verified below); all three task commits (`bbc426e`, `21c48d0`, `0d5aca6`) confirmed in `git log`.
