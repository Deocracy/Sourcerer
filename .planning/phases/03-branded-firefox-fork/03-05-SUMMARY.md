---
phase: 03-branded-firefox-fork
plan: 05
subsystem: build
tags: [firefox-esr, branding, desktop-entry, inkscape, sccache, brand-06]

# Dependency graph
requires:
  - phase: 03-branded-firefox-fork (plan 01)
    provides: "objdir/dist/bin/sourcerer -- the dev binary this plan builds a second, distinguishable variant alongside, and the dev branding tree this plan mirrors"
  - phase: 03-branded-firefox-fork (plan 02)
    provides: "scripts/verify-branding-identity.mjs's six-surface checklist -- the desktop-entry surface this plan turns green, and the harness this plan extends with --desktop/--config-status"
  - phase: 03-branded-firefox-fork (plan 03)
    provides: "sourcerer/branding/dev/pref/firefox-branding.js's 25 real prefs -- byte-copied into the release variant unchanged"
provides:
  - "sourcerer/branding/release/ -- the second branding variant (BRAND-06), differing from dev in exactly MOZ_APP_DISPLAYNAME and the icon set"
  - "sourcerer/sourcerer.desktop, sourcerer/sourcerer-release.desktop -- identity surface 5, green for both variants with a working positive control"
  - "objdir-release/dist/bin/sourcerer -- the second and last full ./mach build this phase's budget allows, proven distinguishable from objdir/dist/bin/sourcerer three ways"
  - "scripts/verify-branding-identity.mjs's --desktop/--config-status options, a desktop-entry positive control, and a real bug fix (BIN_DIR now derived from --bin, not hardcoded to objdir)"
affects: [03-06]

# Actuals (#2632)
actuals:
  tokens: 4965
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Release branding directory is a full sibling of dev, not a delta/overlay -- every file present, content-identical except the two D-82-named surfaces (MOZ_APP_DISPLAYNAME, the icon set)"
    - "A verification script's --bin override must be honored by every internal path it derives (BIN_DIR, APP_INI_PATH), not just the ones explicitly parameterized -- deriving BIN_DIR from dirname(BIN_PATH) instead of hardcoding it is what makes the executable surface actually check the pointed-at variant"

key-files:
  created:
    - sourcerer/branding/release/moz.build
    - sourcerer/branding/release/configure.sh
    - sourcerer/branding/release/pref/firefox-branding.js
    - sourcerer/branding/release/locales/moz.build
    - sourcerer/branding/release/locales/jar.mn
    - sourcerer/branding/release/locales/en-US/brand.ftl
    - sourcerer/branding/release/locales/en-US/brand.properties
    - sourcerer/branding/release/content/moz.build
    - sourcerer/branding/release/content/jar.mn
    - sourcerer/branding/release/content/aboutDialog.css
    - sourcerer/branding/release/default{16,32,48,64,128}.png
    - sourcerer/sourcerer.desktop
    - sourcerer/sourcerer-release.desktop
  modified:
    - scripts/verify-branding-identity.mjs
    - .gitignore

key-decisions:
  - "Release icon set is the unbadged base-accent recolor (#2B6CB0), not a distinct-accent-hex set as 03-01-SUMMARY.md's prose claimed -- direct pixel inspection of the committed dev PNGs showed a real orange (#F5A623) corner-badge overlay at every size, atop the same base blue as release, not a different accent hex. The plan's own contingency rule (badged dev -> unbadged release) was applied to the empirically-observed mechanism, not the stale prose description."
  - "StartupWMClass=sourcerer in both .desktop files (not per-variant), matching the single explicit MOZ_APP_REMOTINGNAME export in .mozconfig that applies to both branding directories."
  - "Icon= in both .desktop files is an absolute path to that variant's own default128.png (plan's explicit instruction), not an icon-theme name as 03-RESEARCH.md's draft suggested -- absolute paths are host-specific by construction and repointing them on another machine is documented as plan 03-06's job."

patterns-established: []

requirements-completed: [BRAND-01, BRAND-02, BRAND-06]

coverage:
  - id: D1
    description: "Release branding directory is a full, content-complete sibling of dev, differing in exactly MOZ_APP_DISPLAYNAME and the icon set; zero Mozilla trademark assets in either tree"
    requirement: "BRAND-02"
    verification:
      - kind: integration
        ref: "Task 1 <verify> block (file existence, cmp on pref/firefox-branding.js and brand.properties, exactly one changed brand.ftl line, per-size cmp showing icon difference, trademark-asset find) -- executed this session, all passed"
        status: pass
    human_judgment: false
  - id: D2
    description: "Identity surface 5 (.desktop) is green for both variants against their own config.status, with a working positive control"
    requirement: "BRAND-01"
    verification:
      - kind: integration
        ref: "node scripts/verify-branding-identity.mjs --desktop/--config-status for both variants (all six surfaces PASS each) + --positive-control desktop-entry (correctly FAILs against stock Firefox/firefox-default) -- executed this session"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both branding variants build from the same tree into separate objdirs (dev untouched), all six identity surfaces pass for each, and their display names and icon sets are provably different by three independent signals"
    requirement: "BRAND-06"
    verification:
      - kind: integration
        ref: "objdir-release/dist/bin/sourcerer built (exit 0, 2822s); objdir/dist/bin/sourcerer sha256 unchanged before/after; verify-branding-identity.mjs full run green for both variants; per-size icon cmp differs; brand.ftl -brand-full-name differs (Sourcerer Dev vs Sourcerer) -- all executed and recorded this session"
        status: pass
    human_judgment: true
    rationale: "Whether a person can tell the two icons apart at a glance is explicitly a manual verification per 03-VALIDATION.md's Manual-Only table -- the byte-level difference is machine-proven, the visual-distinguishability judgment is not."

duration: ~65min (dominated by the 2822s/47min second full ./mach build)
completed: 2026-08-21
status: complete
---

# Phase 3 Plan 5: Branded Firefox Fork -- Release Branding Variant and Desktop Entries Summary

**The second branding variant (`sourcerer/branding/release/`) and both `.desktop` files ship, `objdir-release/dist/bin/sourcerer` is a second real build (2822s, exit 0) proven distinguishable from the dev build by three independent signals, and a real bug in the shared identity-verification harness -- `--bin` silently not propagating to the executable surface's directory -- was found and fixed while proving it.**

## Performance

- **Duration:** ~65 min (Tasks 1-2 took ~2 min combined; the phase's second and final full `./mach build` ran 2822s/~47min in the background; remaining time was verification, the harness bug fix, and this summary)
- **Started:** 2026-08-21T17:10:00-07:00 (approx, first file write)
- **Completed:** 2026-08-21T18:14:00-07:00 (approx)
- **Tasks:** 3
- **Files modified:** 19 (15 in Task 1 + `.gitignore`, 3 in Task 2, 1 in Task 3)

## Accomplishments

- `sourcerer/branding/release/` ships as a full, content-complete sibling of `sourcerer/branding/dev/`: identical `moz.build` (same three-levels-up include path), identical `pref/firefox-branding.js` (byte-for-byte, all 25 real prefs from plan 03-03), identical `locales/en-US/brand.properties`, and a `brand.ftl` differing in exactly one line (`-brand-full-name = Sourcerer` vs `Sourcerer Dev`). `configure.sh` sets `MOZ_APP_DISPLAYNAME="Sourcerer"` (no suffix). The five `defaultN.png` icons are the same `logo/LE logo.svg` recolored to the same base accent (`#2B6CB0`) as dev, but **without** the orange corner-badge overlay direct pixel inspection found in every one of dev's committed PNGs -- confirmed byte-different from dev at all five sizes. Zero Mozilla trademark assets in either tree.
- `sourcerer/sourcerer.desktop` (dev) and `sourcerer/sourcerer-release.desktop` (release): `Name=` equals each variant's own `MOZ_APP_DISPLAYNAME`; `StartupWMClass=sourcerer` in both, matching the explicit `MOZ_APP_REMOTINGNAME=sourcerer` export in `.mozconfig` rather than the channel-derived `firefox-default`/`sourcerer-default` default; `Exec=`/`Icon=` are absolute paths into each variant's own `objdir*`/branding tree. Neither file was installed under `$HOME/.local/share/applications/`.
- `scripts/verify-branding-identity.mjs` gained `--desktop <path>` and `--config-status <path>` so the desktop-entry surface can be pointed at either variant, plus a working `--positive-control desktop-entry` (substitutes the pre-branding stock values `Firefox`/`firefox-default` and confirms the real `.desktop` file's values correctly fail the comparison).
- `objdir-release/dist/bin/sourcerer` -- the phase's second and last full `./mach build` -- built clean (exit 0, 2822s mach-reported wall time) into a fully separate objdir, leaving `objdir/dist/bin/sourcerer` byte-identical (sha256 confirmed unchanged before/after). `--version` prints `Deocracy Sourcerer 153.1.0esr`.
- Both variants pass all six `verify-branding-identity.mjs` surfaces independently. Dev-vs-release distinguishability proven three ways: (1) `MOZ_APP_DISPLAYNAME` differs between `objdir/config.status` (`Sourcerer Dev`) and `objdir-release/config.status` (`Sourcerer`); (2) all five installed icon PNGs under each variant's `dist/bin/chrome/icons/default/` are byte-different; (3) identity surface 4 (`-brand-full-name`) reads two different real values from the two variants' own `brand.ftl` files.

## Task Commits

Each task was committed atomically:

1. **Task 1: The release branding variant** - `3dd2dda` (feat)
2. **Task 2: The desktop entries -- identity surface 5** - `af50e8e` (feat)
3. **Task 3: Build the release variant and prove the two are distinguishable** - `d61be8c` (fix -- includes the Task-3-discovered harness bug fix, same commit)

_No TDD tasks in this plan; each commit is a single feat/fix commit._

## Files Created/Modified

- `sourcerer/branding/release/{moz.build,configure.sh,pref/firefox-branding.js,locales/*,content/*,default{16,32,48,64,128}.png}` - the full release branding tree
- `sourcerer/sourcerer.desktop` - dev `.desktop` entry (`Name=Sourcerer Dev`)
- `sourcerer/sourcerer-release.desktop` - release `.desktop` entry (`Name=Sourcerer`)
- `scripts/verify-branding-identity.mjs` - `--desktop`/`--config-status` options, `desktop-entry` positive control, `BIN_DIR` derivation fix
- `.gitignore` - `objdir-release/` added as a sibling rule to `objdir/`

## Decisions Made

- **Release icon set is unbadged, not a different accent hex.** 03-01-SUMMARY.md's prose stated the dev/release icon differentiation mechanism was "a distinct accent hex... rather than adding a visual badge overlay." Direct pixel-level inspection of the actual committed `sourcerer/branding/dev/defaultN.png` files (done this session, since no image-processing tool with a `PIL`/`imagemagick` binary was available -- decoded the PNGs by hand via `zlib`/PNG-filter reconstruction in Python) found a real orange corner-badge (`#F5A623`, top-right, present at every one of the five sizes) layered on the same base blue (`#2B6CB0`) release also uses. This is a documentation-vs-artifact discrepancy in a prior plan's SUMMARY, not something this plan introduced. Resolved per the plan's own explicit contingency: "if the dev set was badged, the release set is unbadged" -- so release ships the plain base-blue recolor with no badge, confirmed byte-different from dev at every size.
- **`StartupWMClass=sourcerer` in both `.desktop` files**, not a per-variant value -- both branding variants share the same explicit `MOZ_APP_REMOTINGNAME=sourcerer` export in `.mozconfig`, so there is only one correct value regardless of variant.
- **`Icon=` is an absolute path to each variant's own `default128.png`**, per the plan's explicit instruction (overriding 03-RESEARCH.md's draft, which used a bare icon-theme name) -- host-specific by construction, with repointing for another machine documented as plan 03-06's responsibility.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `verify-branding-identity.mjs`'s `--bin` override silently did not reach the executable surface or `APP_INI_PATH`**
- **Found during:** Task 3, first full run against the release build with `--bin objdir-release/dist/bin/sourcerer`
- **Issue:** `BIN_DIR` was a separate constant hardcoded to `objdir/dist/bin`, independent of the `--bin`-derived `BIN_PATH`. `checkExecutable()` and `APP_INI_PATH` both used `BIN_DIR`, so pointing `--bin` at the release binary still reported on `objdir/dist/bin/sourcerer`/`objdir/dist/bin/application.ini` for those two reads -- a vacuous check for exactly the cross-variant discrimination this task's acceptance criteria require. (It went unnoticed in Task 2 because dev is the default and the values happened to coincide for `application-ini`, since `MOZ_APP_BASENAME` is identical across variants -- only `MOZ_APP_DISPLAYNAME` differs.)
- **Fix:** `BIN_DIR` is now derived as `dirname(BIN_PATH)`, so `--bin`'s override propagates to every reader that needs the binary's own directory.
- **Files modified:** `scripts/verify-branding-identity.mjs`
- **Verification:** Re-ran the full six-surface check for both dev and release -- the `executable` surface's detail line now correctly names `objdir-release/dist/bin/sourcerer` when `--bin` points there. All four positive controls (`application-ini`, `about-support`, `version`, `desktop-entry`) re-verified green after the fix. `bash scripts/verify-phase-03.sh --quick` re-run, still fully green.
- **Committed in:** `d61be8c` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 bug in the shared verification harness, discovered by actually pointing it at the second variant rather than trusting the Task 2 dev-only run).
**Impact on plan:** Correctness fix to the verification tool itself, found by exercising it against a real second input (exactly the failure mode this phase's own verification philosophy exists to catch). No scope creep -- confined to the one file plan 03-05 already touches.

## Issues Encountered

- **The coordinator's mid-task status report was premature.** After resuming from the background build wait, a status message reported the release build as complete, citing the binary's existence and size. Checked independently before trusting it: the `mach build` process (pid 1130110) was still alive (`ps` showed it running, `etime` climbing), and `objdir-release/dist/bin/sourcerer --version` failed with `Couldn't load XPCOM` -- proof the packaging step (copying shared libraries and support files into `dist/bin`) had not finished, even though the binary file itself already existed from an earlier link step. Set up a second background wait on the actual process PID rather than proceeding, and only continued once the build script's own `BUILD_EXIT_STATUS=0`/`BUILD_WALL_SECONDS=2825` markers appeared in the log and `--version` printed cleanly. No corner cut: the binary's existence was not treated as proof of a successful build.
- **sccache's real hit rate for this build is effectively zero, same as build #1.** Delta across this build: 5648 compile requests, 5043 executed, 7 cache hits, 5022 misses -- a 0.14% hit rate. This is the second of the phase's two full builds and the second time D-71's sccache wiring has not paid off measurably; recorded honestly rather than presented as a success, per the coordinator's explicit reminder not to fabricate a flattering number.

## Build Timing and Cache Stats (recorded for 03-06)

- **Command:** `cd upstream && SOURCERER_OBJDIR=objdir-release SOURCERER_BRANDING=sourcerer/branding/release MOZCONFIG=../.mozconfig nix develop ..#firefox --command bash -c './mach build'`
- **Gate before configure** (`./mach environment` with the same env, run first, before any configure/build step could clobber anything): reported `object directory:` (this mach version's actual field name, not literally `topobjdir` as 03-05-PLAN.md's prose named it) as `/home/chris/coding/sourcerer/objdir-release` -- confirmed correct before proceeding.
- **`./mach configure`:** completed in ~40s; `objdir-release/config.status` immediately confirmed `MOZ_APP_DISPLAYNAME: 'Sourcerer'`, `MOZ_APP_NAME: 'sourcerer'`, `MOZ_APP_VENDOR: 'Deocracy'`, `MOZ_APP_REMOTINGNAME: 'sourcerer'`; `objdir/config.status` re-checked and still `'Sourcerer Dev'`.
- **`./mach build`:** exit 0. Mach's own "Overall system resources" line: **Wall time 2822s** (~47min2s); this session's own wrapper stopwatch measured 2825s (the 3s difference is `nix develop` shell startup overhead, consistent with 03-01's own observation of the same gap).
- **sccache, this build's delta** (before: 117 requests/61 executed/0 hits/54 misses; after: 5765 requests/5104 executed/7 hits/5076 misses): **5648 new requests, 5043 executed, 7 hits, 5022 misses -- a 0.14% hit rate.** Consistent with build #1's finding that D-71's sccache wiring, while correctly present and functional (confirmed again: `sccache --show-stats` ran cleanly throughout), has not yet measurably paid off across either of this phase's two cold-cache full builds.
- **`objdir/dist/bin/sourcerer` sha256 before/after this build:** `3b963f7c86e0b935c1719ad9089741ed7593f05c348d9e40683ab6510fb1dd51` both times -- byte-identical, confirming the dev build was untouched.
- **Icon differentiation mechanism as actually applied:** dev = base recolor (`#2B6CB0`) **plus** an orange (`#F5A623`) corner-badge overlay, present at all five sizes (confirmed via direct PNG pixel decoding, not assumed); release = the same base recolor with **no** badge. Byte-different from dev at every size.
- **Exactly two full `./mach build` invocations exist across this phase:** build #1 in plan 03-01 (2368s, per its own SUMMARY), build #2 here (2822s).

## Known Stubs

None -- every branding file, desktop entry, and build artifact in this plan is real, installed, and verified against the actual built binaries; no mock/placeholder data paths were introduced.

## Threat Flags

None -- this plan adds a second branding variant and two static `.desktop` files, both consumed only by the developer's own machine's application launcher. No new network endpoints, auth paths, or trust-boundary schema changes.

## User Setup Required

None -- no external service configuration required. Neither `.desktop` file was installed under `$HOME/.local/share/applications/`; that install step (and the `update-desktop-database` re-registration it needs) is documented as plan 03-06's responsibility, not this plan's.

## Next Phase Readiness

- Both branding variants (`dev`, `release`) are proven to build from the same tree into independent objdirs, selected purely by `SOURCERER_BRANDING`/`SOURCERER_OBJDIR` environment variables with zero `.mozconfig` edits.
- `objdir-release/` is left on disk (not deleted) for plan 03-06 to reference if needed; disk headroom remains ample (1.3 TB free measured in 03-01, ~14GB/objdir).
- Plan 03-06 needs: the re-measured build timing and sccache-delta numbers above (not the inherited 03-01 figures), the icon-differentiation-mechanism correction (badge overlay, not accent hex), the `.desktop` install path and `update-desktop-database` step (deliberately not done here), and the absolute-path repointing note for `Exec=`/`Icon=` on another machine.
- No blockers.

---
*Phase: 03-branded-firefox-fork*
*Completed: 2026-08-21*

## Self-Check: PASSED

All claimed files found on disk (`sourcerer/branding/release/moz.build`, `configure.sh`, `pref/firefox-branding.js`, `default128.png`, `sourcerer/sourcerer.desktop`, `sourcerer/sourcerer-release.desktop`, `scripts/verify-branding-identity.mjs`, this SUMMARY.md, `objdir-release/dist/bin/sourcerer`). All claimed commits found in git history (`3dd2dda`, `af50e8e`, `d61be8c`, `cfdb6f0`).
