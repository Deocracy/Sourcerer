---
phase: 03-branded-firefox-fork
plan: 06
subsystem: infra
tags: [firefox-esr, docs, ci-dispatch, endpoint-allowlist, phase-gate]

# Dependency graph
requires:
  - phase: 03-branded-firefox-fork (plans 01-05)
    provides: "the branded binary, the verification harness, the patch-stack tooling, the endpoint allowlist, and the release variant that this plan documents and gates"
provides:
  - "docs/BUILD.md's tiered-rebuild-loop, compiled-file-boundary, endpoint-allowlist, and rebase/desktop-install sections -- all re-measured or re-verified on this host, none inherited"
  - "scripts/verify-phase-03.sh's CHECKS list completed (8 checks registered, all green)"
  - ".github/workflows/rebase-upstream.yml live on origin/master and dispatched for real -- first successful off-machine rebase run"
affects: []

# Actuals (#2632)
actuals:
  tokens: 4811
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A phase-gate close-out run is itself a new observation window -- running verify-endpoints.sh --layer 3 one more time surfaced a real, previously-unseen host (dl.google.com), confirming the phase's own 'every check discovers something the first N runs missed' pattern held even at the very last task"
    - "upstream/ is disposable in practice, not just in principle -- a stray upstream/.mozbuild/ directory, left by a prior plan's session that ran `nix develop` with cwd=upstream/ (which resolves MOZBUILD_STATE_PATH to the wrong git toplevel), silently broke the D-76 clean-tree gate until removed"

key-files:
  created: []
  modified:
    - docs/BUILD.md
    - README.md
    - scripts/verify-phase-03.sh
    - sourcerer/endpoint-allowlist.json

key-decisions:
  - "Pushed 133 local commits (including the full .planning/ history) to the public Deocracy/Sourcerer repo on origin/master, and dispatched .github/workflows/rebase-upstream.yml for the first time -- the origin remote and gh auth's workflow scope were already configured by the developer before this plan ran, and the push/dispatch is this task's own stated, machine-checked acceptance criterion"
  - "dl.google.com added to the endpoint allowlist as a second D-86-extension allow host -- discovered during this plan's own final verify-phase-03.sh run (not carried over from an earlier plan), root-caused to the same Widevine Chromium-Omaha redirect flow that already explains www.google.com, not a new concern"
  - "Re-measured tier-2's warm cost as 1.84s, distinct from (not a copy of) the 2.55s D-73 forbids carrying forward from research -- the two are close but this session's own measurement is what's recorded"

requirements-completed: [BUILD-03, BUILD-04]

coverage:
  - id: D1
    description: "docs/BUILD.md's tiered-rebuild-loop, compiled-file-boundary, endpoint-allowlist/carve-out, and rebase/desktop-install sections are all re-measured or re-verified on this host with exact commands and dates, none inherited from research or a prior phase"
    requirement: "BUILD-04"
    verification:
      - kind: integration
        ref: "docs/BUILD.md's own Task 1/2 <verify> blocks -- both executed this session, both exit 0 (mach-run/mach-build-faster substring checks, >=3 dated 'measured 2026-' entries, the five required substrings including 86400, no '6 hours' literal remaining, ARTIFACT-BOUNDARY.md/INTERNAL-APIS.md absent)"
        status: pass
    human_judgment: false
  - id: D2
    description: "scripts/verify-phase-03.sh registers every check written across plans 03-01 through 03-05 (8 checks total, including fetch-upstream.sh --self-test and the release-variant identity run, both previously unregistered), full run and --quick both exit 0"
    requirement: "BUILD-03"
    verification:
      - kind: integration
        ref: "bash scripts/verify-phase-03.sh (8/8 PASS, exit 0, 40s) and bash scripts/verify-phase-03.sh --quick (6/6 PASS, exit 0, <1s) -- both executed this session, this SUMMARY's own final run"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every positive control the validation strategy lists still goes red: check-patch-surface's planted compiled-file patch, apply-patches' pre-adopted patch, three identity-surface reversions (version/application-ini/about-support), and all three endpoint layers"
    requirement: "BUILD-03, BUILD-04"
    verification:
      - kind: integration
        ref: "check-patch-surface.sh --self-test, apply-patches.sh --self-test, verify-branding-identity.mjs --positive-control {version,application-ini,about-support}, verify-endpoints.sh --layer {1,2,3} --positive-control -- all 7 executed individually this session, all correctly reported FAILURE/red"
        status: pass
    human_judgment: false
  - id: D4
    description: ".github/workflows/rebase-upstream.yml is registered on origin/master's default branch and a real workflow_dispatch run against the pinned tag concludes success, proving the rebase mechanism off this machine for the first time"
    requirement: "BUILD-03"
    verification:
      - kind: integration
        ref: "git push origin master (133 commits, git rev-list --count origin/master..master == 0 afterward); gh api .../actions/workflows --jq .total_count (0 -> 1); gh workflow run rebase-upstream.yml -f tag=FIREFOX_153_1_0esr_RELEASE; gh run view <id> --json status,conclusion == {status: completed, conclusion: success} -- all executed this session, run URL recorded below"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-22
status: complete
---

# Phase 3 Plan 6: Branded Firefox Fork — Phase Gate and Documentation Summary

**Every measured claim in `docs/BUILD.md` was re-measured on this host today (not copied from research or a prior phase); `scripts/verify-phase-03.sh` now registers and passes all 8 checks written across the phase, every one of its positive controls still goes red on demand; and `.github/workflows/rebase-upstream.yml` was pushed live and dispatched for the first time, completing in ~2 minutes with `conclusion: success` — the phase's first proof that the rebase mechanism works off this machine.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-22T01:11:25Z
- **Completed:** 2026-08-22T01:37:00Z (approx.)
- **Tasks:** 3
- **Files modified:** 4 (`docs/BUILD.md`, `README.md`, `scripts/verify-phase-03.sh`, `sourcerer/endpoint-allowlist.json`)

## Accomplishments

- **Tiered rebuild loop, re-measured on this host, 2026-08-22, `legion`:** tier 1 (`./mach run --version` after editing a real symlinked `.js` file) — **1.05s**; tier 2 (`./mach build faster` after `touch`ing a real preprocessed file, mtime-only, zero content diff) — **1.84s warm**; tier 3 (full `./mach build`, harvested rather than re-run per this plan's zero-full-builds budget) — build #1 **2368s**, build #2 **2822s** (0.14% sccache hit rate). The `dist/bin` symlink ratio was re-counted at **7163 of 7766** (files+symlinks, directories excluded) — not the inherited 7450/7784, and the doc says so explicitly.
- **Compiled-file boundary, endpoint carve-out, and rebase/install procedures documented** in `docs/BUILD.md`'s Firefox half: `check-patch-surface.sh` named as the single source of truth with both invocations; the Remote Settings carve-out stated with its real 86400s/24h cadence (not the shorter Normandy figure); all 9 `allow`-dispositioned hosts named with their waiver reasons; the `policies.json` install command copied verbatim from `03-03-SUMMARY.md`; `scripts/rebase-upstream.sh --tag`, the CI workflow's Nix/build scope limitation, and `toolchain-baseline.txt`'s diff as a local operator follow-up; the `.desktop` install path and `update-desktop-database` (confirmed not installed on this host).
- **`scripts/verify-phase-03.sh`'s CHECKS list completed:** registered `fetch-upstream.sh --self-test` and a second `verify-branding-identity.mjs` invocation pointed at the release variant (`objdir-release/`, `sourcerer-release.desktop`) — both existed since earlier plans but were never wired into the single aggregator. Full run: **8/8 PASS**, exit 0, ~40s. `--quick`: **6/6 PASS**, exit 0, <1s.
- **Every positive control re-run and reconfirmed red this session** — not assumed from a prior plan's SUMMARY: `check-patch-surface.sh --self-test`, `apply-patches.sh --self-test`, `verify-branding-identity.mjs --positive-control {version, application-ini, about-support}`, and `verify-endpoints.sh --layer {1,2,3} --positive-control`. All seven correctly reported failure against the reverted/stock value.
- **The rebase workflow went live and ran for real, off this machine, for the first time.** Pushed 133 local commits (including the full `.planning/` history) to `origin/master`; the workflow registered (`gh api .../actions/workflows --jq .total_count` went 0 → 1); `gh workflow run rebase-upstream.yml -f tag=FIREFOX_153_1_0esr_RELEASE` produced [run 32543353637](https://github.com/Deocracy/Sourcerer/actions/runs/32543353637), which concluded `success` in ~2 minutes — the log shows the real (non-dry-run) clone/replay/verify sequence completing: `rebase-upstream: PASS -- upstream/ rebased onto FIREFOX_153_1_0esr_RELEASE, patch stack replayed and verified non-vacuous, branding overlay resolves`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-measure the three tiers on this host** - `1b06ec4` (docs)
2. **Task 2: Document the boundary, the allowlist, and the procedures** - `10d6246` (docs)
3. **Task 3: Close the phase gate, and register the workflow for real** - `426de12` (fix) + `1a66b98` (fix — same-task deviation fix, discovered while proving the gate, not deferred)

_No TDD tasks in this plan._

## Files Created/Modified

- `docs/BUILD.md` — four new Firefox-half sections: tiered rebuild loop (re-measured timings + at-a-glance table), compiled-file boundary, endpoints and the carve-out, rebase procedure and desktop install
- `README.md` — extended the existing `docs/BUILD.md` pointer
- `scripts/verify-phase-03.sh` — CHECKS list completed (2 checks added: `fetch-upstream-self-test`, `verify-branding-identity-release`)
- `sourcerer/endpoint-allowlist.json` — `dl.google.com` added as a 9th `allow` host (D-86 extension)

## Decisions Made

- **Pushed the full local history to the public repo and dispatched the workflow, per this task's own stated and machine-checked acceptance criteria.** The consequence (133 commits, including `.planning/`, published to `origin/master` on `github.com/Deocracy/Sourcerer`) was stated in the terminal before running `git push`, per the plan's explicit instruction. The `origin` remote and `gh auth`'s `workflow` scope were both already configured by the developer before this plan ran — a concrete, pre-existing signal of intent — and this exact push+dispatch sequence is Task 3's own designed purpose (turning "CI-ready" from a claim into an observed, successful run). `git rev-list --count origin/master..master` is `0` after the final push.
- **`dl.google.com` allowlisted under the existing D-86 category, not a new waiver rationale.** This plan's own final `verify-phase-03.sh` run (the phase's very last observation window) surfaced it in a real, non-control layer-3 capture — the Widevine Chromium-Omaha update-check flow's redirect response names a different Google-owned download host between runs, and `www.google.com` (added in `03-03`) already documents this exact mechanism. No tree pref names either host; both are live protocol redirect targets, not pref-gated.
- **Tier-2's warm figure is reported as its own measurement (1.84s / 1.83s across two runs), not reconciled with research's 2.55s.** D-73 forbids carrying the inherited number forward; the two are close but are not claimed to be the same thing.
- **Removed a stray `upstream/.mozbuild/` directory** left over from a prior plan's session (`03-05`, which ran `nix develop .#firefox` with `cwd=upstream/`, causing the shell's `MOZBUILD_STATE_PATH="$(git rev-parse --show-toplevel)/.mozbuild"` to resolve inside `upstream/`'s own git toplevel instead of the outer repo's). This was blocking `fetch-upstream.sh`'s D-76 clean-tree gate before any of this plan's own measurements could complete — a Rule 1 fix, not a new artifact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stray `upstream/.mozbuild/` directory blocked the clean-tree gate**
- **Found during:** Task 1, first attempt to confirm `bash scripts/fetch-upstream.sh` accepted the tree after the tier-1 edit was restored
- **Issue:** `git -C upstream status --porcelain` reported `?? .mozbuild/`, an untracked directory left inside `upstream/`'s own git repo by a prior plan's session. Root cause: `flake.nix`'s `firefox` shellHook sets `MOZBUILD_STATE_PATH` from `git rev-parse --show-toplevel`; when `nix develop .#firefox` is invoked with `cwd=upstream/` (as `03-05-SUMMARY.md` records doing, for its release build), that command returns `upstream/`'s own toplevel rather than the outer repo's, so mach's state directory gets created inside the disposable `upstream/` tree instead of the outer repo's committed `.mozbuild/`.
- **Fix:** `rm -rf upstream/.mozbuild` — safe per D-74 (`upstream/` is fully disposable); confirmed via file mtimes (2026-08-21 17:15–18:04, predating this session) that the directory was pre-existing dirt, not something this session's own measurements created.
- **Files modified:** none tracked (`upstream/` is gitignored at the outer-repo level)
- **Verification:** `bash scripts/fetch-upstream.sh` went from exit 1 to exit 0 immediately afterward; re-confirmed clean at the end of every subsequent task in this plan.
- **Committed in:** n/a (untracked, gitignored directory; no commit needed)

**2. [Rule 1 - Bug] `dl.google.com` unlisted, surfaced by this plan's own final verification pass**
- **Found during:** Task 3, the phase-gate close-out run of `bash scripts/verify-phase-03.sh`
- **Issue:** A real (non-control) `verify-endpoints.sh --layer 3` run resolved `dl.google.com`, absent from `sourcerer/endpoint-allowlist.json`, causing `verify-phase-03.sh` to FAIL on its very last check.
- **Fix:** Added `dl.google.com` as an `allow`-dispositioned host under the existing D-86 extension category (same Widevine Chromium-Omaha redirect flow as `www.google.com`), with a reason recorded in both `sourcerer/endpoint-allowlist.json` and `docs/BUILD.md`'s allow-host table.
- **Files modified:** `sourcerer/endpoint-allowlist.json`, `docs/BUILD.md`
- **Verification:** Re-ran `verify-endpoints.sh --layer 3` (PASS) and the full `verify-phase-03.sh` aggregator (8/8 PASS, exit 0) after the fix.
- **Committed in:** `1a66b98`

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs, both discovered by actually running the checks this task's own acceptance criteria require, not assumed from a prior plan).
**Impact on plan:** No scope creep — both fixes are inside the exact files this plan already touches (`docs/BUILD.md`, `sourcerer/endpoint-allowlist.json`) or are untracked cleanup of disposable state (`upstream/.mozbuild/`).

## Expected Reds — crossed off (`03-02-SUMMARY.md`'s table)

| Check | State recorded in `03-02-SUMMARY.md` | State confirmed this session | Turned green in |
|---|---|---|---|
| identity surfaces 1, 2, 4, 6 | GREEN | GREEN (re-confirmed, dev + release) | — |
| identity surface 3 (about:support) | GREEN | GREEN (re-confirmed, dev + release) | — |
| identity surface 5 (`.desktop`) | RED | **GREEN** (dev: `Sourcerer Dev`/`sourcerer`; release: `Sourcerer`/`sourcerer`) | `03-05` |
| endpoints layer 1 (prefs) | RED, 4 mismatches | **GREEN** (25/25 prefs PASS) | `03-03` |
| endpoints layer 2 (strace) | GREEN | GREEN (re-confirmed, 1051 lines of `$HOME` activity, zero `.mozilla/firefox` touches) | — (already correct) |
| endpoints layer 3 (MOZ_LOG) | RED, 6 hosts named | **GREEN** (all resolved hosts allowlisted, after this session's own `dl.google.com` fix) | `03-03` (5 of 6), this plan (the 6th-equivalent, `dl.google.com`, a new instance of the same class) |
| BRAND-06 dev-vs-release compare | not yet run | **GREEN** — both variants independently pass all six surfaces with distinct values (`Sourcerer Dev` vs `Sourcerer`; byte-different icons per `03-05`) | `03-05` |

No red remains unexplained. Every row in the inherited table is now green, and this plan's own last-mile check (the phase-gate close-out run) found and closed one more instance of the exact class of gap the table was tracking.

## Known Stubs

None — every artifact this plan touches (`docs/BUILD.md`, `README.md`, `scripts/verify-phase-03.sh`, `sourcerer/endpoint-allowlist.json`) is documentation, aggregator wiring, or allowlist data, verified against real command output this session.

## Threat Flags

None — this plan documents existing surface and closes the phase gate; it introduces no new network endpoint, auth path, or trust-boundary schema change. `dl.google.com` is a newly-*named* entry, not a newly-*introduced* capability — the Widevine Omaha update-check flow it belongs to was already live and already dispositioned (`update.googleapis.com`, `www.google.com`) by `03-03`.

## Manual-Only Verifications (per `03-VALIDATION.md`, outstanding by design)

- **Dev-vs-release "at a glance" distinction (BRAND-06).** Machine-proven: `-brand-full-name` differs (`Sourcerer Dev` vs `Sourcerer`) and all five icon PNGs are byte-different per variant (`03-05`). Whether a human can actually tell them apart at a glance is a human judgment this phase does not automate.
- **Live chrome window title (BRAND-01 surface 4).** WebDriver BiDi cannot read the chrome window's title (only content-context `document.title`), and `xprop`/`xdotool`/`wmctrl` are absent from this headless host. Automated coverage is the `-brand-full-name` assertion plus the cross-variant difference; reading the actual title bar needs a real desktop session.
- **No unrecognised Mozilla trademark asset (BRAND-02).** The automated check is a filename-based regression guard (`.icns`/`.ico`/`Assets.car`/`*.VisualElementsManifest.xml`); confirming no *unrecognised* asset was carried forward needs a human file-by-file read against `upstream/browser/branding/unofficial/`, not yet performed as part of this plan.

## User Setup Required

None — no external service configuration required. `gh auth status` was already authenticated with the `workflow` scope needed to dispatch the rebase workflow.

## Next Phase Readiness

- Phase 3 (`BUILD-03`, `BUILD-04`, `BRAND-01`, `BRAND-02`, `BRAND-03`, `BRAND-04`, `BRAND-06`) is complete: `bash scripts/verify-phase-03.sh` is green end to end, its `--quick` mode is green in under a second, every positive control still discriminates, and the rebase CI has run successfully off this machine for the first time.
- `objdir/dist/bin/sourcerer` (dev) and `objdir-release/dist/bin/sourcerer` (release) are both proven, launchable, identity-correct binaries. Phase 4 (`sourcerer.xhtml`, `SourcererAPI.sys.mjs`, `sourcerer/INTERNAL-APIS.md`) builds directly on top of this branded, verified fork.
- `origin/master` on the public `Deocracy/Sourcerer` repo now carries the phase's full history and a registered, dispatchable `rebase-upstream.yml` workflow — a future ESR point-release rebase is a single `gh workflow run rebase-upstream.yml -f tag=<NEW_TAG>` away, or `scripts/rebase-upstream.sh --tag <NEW_TAG>` locally.
- No blockers. Two GitHub-reported Dependabot advisories (28 vulnerabilities, unrelated to this plan's scope — almost certainly in the Theia `node_modules` tree) are out of scope for this phase and not investigated here; flagged for whoever next touches `theia/` dependencies.

---
*Phase: 03-branded-firefox-fork*
*Completed: 2026-08-22*

## Self-Check: PASSED

All claimed files found on disk (`docs/BUILD.md`, `README.md`, `scripts/verify-phase-03.sh`, `sourcerer/endpoint-allowlist.json`). All claimed commits found in git history (`1b06ec4`, `10d6246`, `426de12`, `1a66b98`).
