---
phase: 03-branded-firefox-fork
plan: 01
subsystem: infra
tags: [firefox-esr, gecko, moz.configure, branding, sccache, nix, patch-stack]

# Dependency graph
requires:
  - phase: 01-build-infrastructure
    provides: pinned FIREFOX_153_1_0esr_RELEASE upstream/ checkout, firefox devShell, toolchain baseline
provides:
  - "objdir/dist/bin/sourcerer -- a real, launchable, Sourcerer-branded Firefox-ESR binary"
  - "patches/010-sourcerer-identity.patch -- the phase's entire Gecko patch surface (one hunk, one file)"
  - "scripts/apply-patches.sh -- idempotent patch replay with a non-vacuous (D-75) assertion per patch"
  - "scripts/fetch-upstream.sh D-76 classifier -- accepts pristine or fully-patched upstream/, hard-fails anything else, re-creates the branding overlay symlink on a fresh clone, settable TAG"
  - "scripts/check-patch-surface.sh -- executable guard against a compiled-file patch, with a proven-red positive control"
  - "sourcerer/branding/dev/ -- full Sourcerer Dev branding tree, no Mozilla trademark assets"
affects: [03-02, 03-03, 03-04, 03-05, 03-06]

# Actuals (#2632)
actuals:
  tokens: 6909
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: [pkgs.sccache (Nix devShell), inkscape (icon pipeline, host tool, no new dependency)]
  patterns:
    - "git apply --3way + before/after git hash-object comparison is the only mechanism that catches a silently-adopted patch (D-75) -- git apply --3way exits 0 with a completely silent no-op on already-adopted content"
    - "Gecko patch surface confined to a single hunk in browser/moz.configure -- vendor/UA/telemetry flags all land in one file so BUILD-03's rebase-conflict surface stays minimal"
    - "Branding overlay via a relative symlink (upstream/sourcerer -> ../sourcerer) registered in upstream/.git/info/exclude -- is_read_allowed does pure string-prefix matching, no realpath call, so a symlink inside topsrcdir satisfies it"
    - "Clean-tree gate as a set-equality classifier (actual dirt vs patch-stack-declared dirt), not a subtraction -- catches drift in both directions (Gecko modified outside the stack, or a patch silently not applied)"

key-files:
  created:
    - patches/010-sourcerer-identity.patch
    - scripts/apply-patches.sh
    - scripts/check-patch-surface.sh
    - sourcerer/branding/dev/moz.build
    - sourcerer/branding/dev/configure.sh
    - sourcerer/branding/dev/pref/firefox-branding.js
    - sourcerer/branding/dev/locales/en-US/brand.ftl
    - sourcerer/branding/dev/locales/en-US/brand.properties
    - sourcerer/branding/dev/content/jar.mn
    - sourcerer/branding/dev/default{16,32,48,64,128}.png
  modified:
    - flake.nix
    - .mozconfig
    - scripts/fetch-upstream.sh

key-decisions:
  - "sccache lands in the firefox devShell (D-71): pkgs.sccache buildInput + RUSTC_WRAPPER=sccache set after the existing AS/LD/NM unset line, never before -- smoke-tested (version, wrapper var, clang still resolves)"
  - "-brand-product-name stays Firefox in brand.ftl (resolves 03-RESEARCH.md assumption A1) -- consistent with D-78's byte-identical-UA rationale, since a small set of compatibility strings interpolate this specific term"
  - "MOZ_SERVICES_HEALTHREPORT flipped to False alongside MOZ_NORMANDY in the same hunk (resolves Open Question 1) -- 'code not compiled cannot be re-enabled at runtime'"
  - "Dev icon set differentiated from the eventual release set (D-82/BRAND-06) by accent hex choice at generation time, recorded here so 03-05 picks a distinctly different hex"

patterns-established:
  - "scripts/*.sh: set -euo pipefail for linear mutators (apply-patches.sh, check-patch-surface.sh, fetch-upstream.sh), reserving set -uo pipefail for aggregators (verify-phase-03.sh, not yet written)"
  - "Every new guard script ships a --self-test mode exercising a mktemp -d fixture, never the real upstream/ or patches/, cleaned up with find <dir> -delete"

requirements-completed: [BUILD-03, BUILD-04, BRAND-01, BRAND-02]

coverage:
  - id: D1
    description: "Full ./mach build produces objdir/dist/bin/sourcerer reporting Sourcerer identity across all build-time surfaces (--version, application.ini, config.status)"
    requirement: "BRAND-01"
    verification:
      - kind: integration
        ref: "plan verify block: test -x objdir/dist/bin/sourcerer; --version equality; application.ini Name/Vendor grep; config.status six-variable check -- all executed this session, all passed"
        status: pass
    human_judgment: false
  - id: D2
    description: "sourcerer/branding/dev/ ships a complete, Linux-gtk branding tree with zero Mozilla trademark assets carried forward"
    requirement: "BRAND-02"
    verification:
      - kind: integration
        ref: "find sourcerer/branding/dev -iname '*.icns' -o -iname '*.ico' -o -iname Assets.car -o -iname '*.VisualElementsManifest.xml' -- executed, empty output"
        status: pass
    human_judgment: false
  - id: D3
    description: "scripts/apply-patches.sh replays the patch stack idempotently and fails loudly (naming the patch) on a silently-adopted or already-applied patch"
    requirement: "BUILD-03"
    verification:
      - kind: integration
        ref: "second consecutive run of scripts/apply-patches.sh against the applied tree -- executed, exit 1, names 010-sourcerer-identity.patch"
        status: pass
    human_judgment: false
  - id: D4
    description: "scripts/fetch-upstream.sh's D-76 classifier accepts pristine or fully-applied upstream/, hard-fails other dirt in both directions, re-creates the branding overlay on a fresh clone, and TAG is settable"
    requirement: "BUILD-03"
    verification:
      - kind: integration
        ref: "bash scripts/fetch-upstream.sh --self-test (four classifier cases) + real re-run after rm -rf upstream && fetch-upstream.sh -- all executed, all passed"
        status: pass
    human_judgment: false
  - id: D5
    description: "scripts/check-patch-surface.sh rejects a compiled-file patch target and rejects an empty patches/ directory, both with a proven-red positive control"
    requirement: "BUILD-04"
    verification:
      - kind: integration
        ref: "bash scripts/check-patch-surface.sh --self-test (planted compiled-file patch) + real one-patch stack -- both executed, both passed as expected"
        status: pass
    human_judgment: false
  - id: D6
    description: "sccache is wired into the firefox devShell and does not break the existing clang/bintools-unset arrangement"
    requirement: "BUILD-04"
    verification:
      - kind: manual_procedural
        ref: "nix develop .#firefox --command bash -c 'sccache --version && echo RUSTC_WRAPPER=$RUSTC_WRAPPER && clang --version' -- executed this session, printed sccache 0.17.0 / RUSTC_WRAPPER=sccache / clang 21.1.8"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-08-21
status: complete
---

# Phase 3 Plan 1: Branded Firefox Fork -- End-to-End Tracer Summary

**A full `./mach build` of Firefox-ESR 153.1.0esr under Sourcerer identity -- `objdir/dist/bin/sourcerer` reports `Deocracy Sourcerer 153.1.0esr`, one patch hunk, one symlinked branding overlay, and two executable guards (adopted-patch detection, compiled-file boundary) both proven red-by-design.**

## Performance

- **Duration:** ~20 min (verification, patch replay, and commits this session; the underlying full Gecko compile ran 2368s / ~39m28s in a prior session on this same working tree)
- **Started:** 2026-08-21T21:35:01Z (session resumed from an already-authored, uncommitted working tree)
- **Completed:** 2026-08-21T22:50:10Z
- **Tasks:** 3
- **Files modified:** 21 (19 in Task 1, 1 in Task 2, 1 in Task 3)

## Accomplishments

- A real, launchable Sourcerer-branded Firefox-ESR binary: `objdir/dist/bin/sourcerer --version` prints exactly `Deocracy Sourcerer 153.1.0esr`; `application.ini` carries `Name=Sourcerer`/`Vendor=Deocracy`; `config.status` reports all six identity variables (`MOZ_APP_BASENAME`, `MOZ_APP_NAME`, `MOZ_APP_VENDOR`, `MOZ_APP_REMOTINGNAME`, `MOZ_APP_UA_NAME`, `MOZ_APP_DISPLAYNAME`) correctly; no stale `dist/bin/firefox` survived the rename.
- The entire Gecko patch surface is one hunk in `browser/moz.configure` (`MOZ_SERVICES_HEALTHREPORT`/`MOZ_NORMANDY` to `False`, `MOZ_APP_VENDOR` to `Deocracy`, `MOZ_APP_UA_NAME` implied to `Firefox`), replayed by `scripts/apply-patches.sh`, whose before/after blob-hash assertion is proven to catch the silent-no-op failure mode `git apply --3way` was empirically shown to produce on already-adopted content.
- `scripts/fetch-upstream.sh`'s clean-tree gate (D-76) now distinguishes the phase's legitimate dirt from an out-of-band Gecko edit in both directions, re-materializes the `upstream/sourcerer -> ../sourcerer` branding overlay symlink on a fresh clone, and accepts a `TAG` override for a future rebase -- all four proven via `--self-test` plus a real `rm -rf upstream && fetch-upstream.sh` re-materialize.
- `scripts/check-patch-surface.sh` guards the artifact/patch-surface boundary with a working positive control (a planted compiled-file patch is correctly rejected) and refuses to pass on an empty `patches/` directory.
- `sourcerer/branding/dev/` ships a complete Linux-gtk branding tree (five recolored icon PNGs from `logo/LE logo.svg`, Fluent/properties brand terms, a placeholder pref file) with zero Mozilla trademark assets carried forward.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end branded binary -- one path, one build** - `75b8943` (feat)
2. **Task 2: Teach the clean-tree gate to classify expected dirt (D-76)** - `9d1865f` (feat)
3. **Task 3: check-patch-surface.sh -- the compiled-file boundary, with a red control** - `4c3235b` (feat)

_No TDD tasks in this plan; each commit is a single feat commit._

## Files Created/Modified

- `flake.nix` - `firefox` devShell gains `pkgs.sccache` and `RUSTC_WRAPPER=sccache` (D-71)
- `.mozconfig` - parameterised `MOZ_OBJDIR`, `--with-app-basename=Sourcerer`, `--with-distribution-id=org.deocracy`, `--disable-crashreporter`, `--with-ccache=sccache`, `--with-branding=${SOURCERER_BRANDING:-sourcerer/branding/dev}`, exported `MOZ_APP_REMOTINGNAME=sourcerer`
- `patches/010-sourcerer-identity.patch` - the phase's entire Gecko patch surface
- `scripts/apply-patches.sh` - idempotent, non-vacuous patch replay (D-74/D-75)
- `scripts/fetch-upstream.sh` - D-76 clean-tree classifier, branding overlay re-creation, settable `TAG`
- `scripts/check-patch-surface.sh` - D-72/D-73 compiled-file boundary guard
- `sourcerer/branding/dev/{moz.build,configure.sh,pref/firefox-branding.js,locales/*,content/*,default{16,32,48,64,128}.png}` - the Sourcerer Dev branding tree

## Decisions Made

- **sccache placement and ordering (D-71):** added as a `buildInputs` entry alongside `inputsFrom`, with `RUSTC_WRAPPER=sccache` exported after the existing `unset AS LD NM AR RANLIB OBJDUMP OBJCOPY READELF SIZE STRINGS STRIP` line -- smoke-tested green (sccache 0.17.0, `RUSTC_WRAPPER=sccache`, clang 21.1.8 still resolves).
- **`-brand-product-name` stays `Firefox`** in `brand.ftl` (resolves 03-RESEARCH.md Assumption A1) -- consistent with D-78's byte-identical User-Agent rationale, since this specific Fluent term is what a small set of "requires Firefox" compatibility strings interpolate.
- **`MOZ_SERVICES_HEALTHREPORT` flipped to `False`** alongside `MOZ_NORMANDY` in the same hunk (resolves Open Question 1) -- "code that is not compiled cannot be re-enabled at runtime" is D-84's own stated rationale, and this costs zero extra files since it's the same hunk.
- **Dev-vs-release icon differentiation (D-82/BRAND-06):** the dev branding directory's icon set was generated at a distinct accent hex from what plan `03-05`'s release set will use, rather than adding a visual badge overlay -- simpler to implement correctly with the same `inkscape` pipeline, and the two branding directories already differ in `configure.sh`'s `MOZ_APP_DISPLAYNAME` (`Sourcerer Dev` vs `Sourcerer`), so BRAND-06's "visibly distinguishable" criterion is satisfied by two independent signals.
- **`--with-app-basename` and `--with-app-name` are not both passed** -- `MOZ_APP_NAME` derives from basename automatically; passing both is a configure error avoided per CONTEXT.md's own warning.

## Deviations from Plan

None - plan executed exactly as written. This session resumed a working tree where a prior session had already authored all of Task 1's non-build artifacts (branding tree, patch file, `apply-patches.sh`), Task 2's `fetch-upstream.sh` classifier, and Task 3's `check-patch-surface.sh`, and had already run the one full `./mach build` this plan's budget allows (2368s wall, producing the correctly-identified binary) -- but `upstream/` itself had been removed afterward (disposable per D-74) and none of it was committed. This session's actual work was: re-materializing `upstream/` via `scripts/fetch-upstream.sh` (a fresh 646s shallow clone), re-applying the patch stack, running every acceptance-criteria command in the plan's `<verify>` and `<acceptance_criteria>` blocks fresh against the re-materialized tree, running the D-71 sccache smoke test, and committing the three tasks atomically. No code was authored or altered from what was already on disk; every check specified by the plan was independently re-run and independently confirmed to pass in this session, not merely inherited from git history.

## Issues Encountered

- **sccache compile-request count not recoverable.** The plan's action step 8 asks to record `sccache --show-stats`' compile-request count after the build. The full build that produced `objdir/dist/bin/sourcerer` ran in a prior session (2368s, before this session started); that build's `sccache` server process has since recycled, so its actual hit/miss counters are gone. `sccache --show-stats` run in this session reports `0` across the board -- a fresh daemon, not a false zero from the real build. The D-71 acceptance criterion itself (sccache present, `RUSTC_WRAPPER=sccache`, clang still resolves) is independently verified and passes; only the incidental "record the compile-request count" documentation ask in the `<output>` section is unmet, and no compiled-define change remains in this plan's scope to trigger a fresh, budget-compliant recompile to re-derive it (the phase's two-full-build budget is already spent: this plan's build, plus `03-05`'s reserved second build). Recorded here rather than fabricated.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `objdir/dist/bin/sourcerer` is a proven, launchable, identity-correct binary that plans `03-02` through `03-06` build on directly (BRAND-03/04 endpoint work, the Wave-0 verification harness, the rebase CI, the release branding variant, and docs).
- The `upstream/` -> `patches/` -> `sourcerer/` mechanism chain (symlink overlay, patch replay, clean-tree classifier) is proven end-to-end and gated by two executable guards, so no downstream plan is left assuming an unverified mechanism.
- `sourcerer/branding/dev/pref/firefox-branding.js` is a deliberate, documented placeholder (empty `startup.homepage_*`/`app.update.url.*` prefs, `devtools.selfxss.count`) -- plan `03-03` fills in the real endpoint allowlist and telemetry prefs (BRAND-04); this is not a gap, it is the plan's own stated boundary.
- No blockers. `strace` availability for D-88's filesystem-layer check (03-RESEARCH.md Assumption A4) remains unverified and is `03-02`'s concern, not this plan's.

---
*Phase: 03-branded-firefox-fork*
*Completed: 2026-08-21*
