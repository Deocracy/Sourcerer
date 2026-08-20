---
phase: 01-build-infrastructure
plan: 03
subsystem: infra
tags: [firefox-esr, nix, mach, clang, gecko-build]

# Dependency graph
requires: ["01-01 (firefox devShell, .mozconfig, smoke-firefox.sh)"]
provides:
  - "scripts/fetch-upstream.sh -- one documented, re-runnable command materializing upstream/ at FIREFOX_153_1_0esr_RELEASE"
  - "upstream/ -- shallow git checkout of stock 153.1.0esr, untracked (D-01/D-02)"
  - "flake.nix firefox devShell now actually compiles Gecko: clang stdenv override + binutils-wrapper env-var unset"
  - ".mozconfig with --with-libclang-path, the fifth real line beyond RESEARCH.md's researched four"
  - "objdir/dist/bin/firefox -- a real, launchable stock 153.1.0esr binary, built by a full non-artifact compile"
  - "scripts/smoke-firefox.sh MOZCONFIG bug fixed -- BUILD-02's Wave 0 gate is now honestly green"
affects: ["phase 3 (BUILD-03 rebase procedure, BUILD-04 artifact-build wiring both build on this proven toolchain)"]

actuals:
  tokens: 9500
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns: ["pkgs.mkShell.override { stdenv = ... } to match a reference derivation's actual build stdenv, not just its inputsFrom inputs"]

key-files:
  created:
    - scripts/fetch-upstream.sh
  modified:
    - flake.nix
    - .mozconfig
    - scripts/smoke-firefox.sh

key-decisions:
  - "Re-run identity check in fetch-upstream.sh compares resolved commit SHAs (git rev-parse refs/tags/<TAG>) rather than `git describe --tags --exact-match HEAD` -- the mozilla-firefox/firefox mirror tags this exact release with both FIREFOX_153_1_0esr_RELEASE and FIREFOX_153_1_0esr_BUILD1 pointing at the identical commit, and `describe` breaks that tie non-deterministically (observed picking BUILD1)."
  - "firefox devShell now overrides stdenv to pkgs.llvmPackages.stdenv -- inputsFrom only copies a referenced derivation's nativeBuildInputs/buildInputs, never its own stdenv, and firefox-esr-153-unwrapped (buildMozillaMach) is built under `overrideCC llvmPackages.stdenv` (clang), not the default gcc pkgs.mkShell would otherwise supply."
  - "firefox shellHook unsets AS/LD/NM/AR/RANLIB/OBJDUMP/OBJCOPY/READELF/SIZE/STRINGS/STRIP -- nixpkgs' bintools-wrapper exports these as bare tool names for classic autotools scripts, but Firefox's moz.configure treats a pre-set AS as an explicit override and skips routing ASFLAGS's `-Wa,--noexecstack` through the compiler driver, breaking the very first assembler invocation."

requirements-completed: [BUILD-02]

coverage:
  - id: D1
    description: "One documented command materializes upstream/ as a git checkout whose HEAD is FIREFOX_153_1_0esr_RELEASE, re-runnable with no manual steps"
    requirement: "BUILD-02"
    verification:
      - kind: other
        ref: "./scripts/fetch-upstream.sh -> cloned in 438s, 5.6G; second run -> 0.012s, no re-clone; commit-SHA identity check MATCH"
        status: pass
    human_judgment: false
  - id: D2
    description: "nix develop .#firefox plus ./mach build compiles stock 153.1.0esr to completion with no toolchain install outside the shell"
    requirement: "BUILD-02"
    verification:
      - kind: other
        ref: "full ./mach build completed: Wall time 3224s (~54min), 14G peak objdir, objdir/dist/bin/firefox executable"
        status: pass
    human_judgment: false
  - id: D3
    description: "mach bootstrap never appears in the build log"
    requirement: "BUILD-02"
    verification:
      - kind: other
        ref: "grep -cE 'mach[[:space:]]+bootstrap' .mozbuild/*.log -> 0 across both captured logs"
        status: pass
    human_judgment: false
  - id: D4
    description: "The built binary launches and reports 153.1.0esr"
    requirement: "BUILD-02"
    verification:
      - kind: other
        ref: "MOZCONFIG=../.mozconfig ./mach run --version -> 'Mozilla Firefox 153.1.0esr'"
        status: pass
    human_judgment: false
  - id: D5
    description: "upstream/ and build output stay untracked; git status clean after a full build"
    requirement: "BUILD-02"
    verification:
      - kind: other
        ref: "git -C upstream status --porcelain -> empty; git status --porcelain at repo root -> empty (excluding pre-existing unrelated dirty state from before this plan)"
        status: pass
    human_judgment: false
  - id: D6
    description: "scripts/smoke-firefox.sh exits 0"
    requirement: "BUILD-02"
    verification:
      - kind: other
        ref: "./scripts/smoke-firefox.sh -> smoke-firefox: PASS, exit 0"
        status: pass
    human_judgment: false

duration: 2h18min
completed: 2026-08-20
status: complete
---

# Phase 1 Plan 3: Firefox Upstream Fetch + Full Compile Summary

**`scripts/fetch-upstream.sh` materializes stock Firefox ESR 153.1.0esr into `upstream/` in one re-runnable command (438s/5.6G on this host), and a full non-artifact `./mach build` inside the `firefox` shell now actually compiles it end-to-end (3224s, 14G objdir) into a launchable binary reporting `153.1.0esr` -- after fixing three real gaps in the `firefox` devShell's toolchain (clang stdenv, binutils-wrapper env-var leakage, libclang path) and one bug in the Wave 0 smoke harness.**

## Performance

- **Duration:** 2h18min
- **Started:** 2026-08-20T15:32:00Z
- **Completed:** 2026-08-20T17:50:00Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- `scripts/fetch-upstream.sh` -- clones `mozilla-firefox/firefox` at tag `FIREFOX_153_1_0esr_RELEASE` with `--depth 1` (RESEARCH.md's measured-faster variant, not the blobless filter that stalled), safely re-runnable via a commit-SHA identity check
- `upstream/` materialized: 5.6G on disk, cloned in 438s (real-host figure RESEARCH.md's Open Question 2 asked for -- the sandboxed research session could only estimate 800MB-1GB/throttled; the real host transferred faster and the extracted tree is larger than the packed estimate, as expected)
- Full non-artifact compile of stock 153.1.0esr completed: 3224s wall time (~54min) on 16 cores, 14G peak `objdir/`, zero `mach bootstrap` invocations, zero WASI-sysroot failures
- `objdir/dist/bin/firefox` launches and `./mach run --version` reports `Mozilla Firefox 153.1.0esr`
- `scripts/smoke-firefox.sh` now genuinely passes (`smoke-firefox: PASS`), closing plan 01-01's honestly-RED Wave 0 gate for BUILD-02
- D-13 toolchain baseline (`toolchain-baseline.txt`) still matches after a real compile -- the first moment PITFALLS #2 (cbindgen/rustc FFI drift) could have fired, and it didn't

## Task Commits

Each task was committed atomically:

1. **Task 1: Write and run the one documented upstream materialization command** - `78643ee` (feat)
2. **Task 2: Full non-artifact compile of stock 153.1.0esr and launch the result** - `78e9de8` (fix -- see Deviations; the fix and the acceptance proof landed together since every gap was discovered while running the proof itself)

## Files Created/Modified
- `scripts/fetch-upstream.sh` (created) -- the D-04 documented command; depth-1 clone, robust re-run identity check
- `flake.nix` (modified) -- firefox devShell: `stdenv = pkgs.llvmPackages.stdenv` override, `unset AS LD NM AR RANLIB OBJDUMP OBJCOPY READELF SIZE STRINGS STRIP` in shellHook
- `.mozconfig` (modified) -- added `ac_add_options --with-libclang-path="$LIBCLANG_PATH"` (fifth line, beyond RESEARCH.md's researched four)
- `scripts/smoke-firefox.sh` (modified) -- version-check invocation now passes `MOZCONFIG`, matching the build invocation two lines above it

## Decisions Made
- Depth-1 clone confirmed as the right default per RESEARCH.md's leaning: 438s/5.6G on the real host, no re-timing surprises.
- Re-run identity check in `fetch-upstream.sh` uses `git rev-parse refs/tags/$TAG^{commit}` compared to `HEAD`, not `git describe --tags --exact-match` -- see Deviations below for why.
- `firefox` devShell now builds on `pkgs.llvmPackages.stdenv` rather than the default gcc-based `pkgs.mkShell` stdenv, matching what `firefox-esr-153-unwrapped` (`buildMozillaMach`) actually compiles under.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `git describe --tags --exact-match HEAD` is non-deterministic when a commit carries multiple tags**
- **Found during:** Task 1, first run of `./scripts/fetch-upstream.sh`
- **Issue:** The `mozilla-firefox/firefox` mirror tags this exact release with both `FIREFOX_153_1_0esr_RELEASE` and `FIREFOX_153_1_0esr_BUILD1`, pointing at the identical commit `468445e58d3acc7e4e059be99856daff1f2ae8f1`. `git describe --tags --exact-match HEAD` picked `BUILD1` on this host -- the commit checked out is correct (the pinned release), but a literal string comparison against `FIREFOX_153_1_0esr_RELEASE` (as both my initial script and the plan's own `<verify>`/acceptance criteria specify) is not reliable. This is also why the plan-level `<verification>` step 2 (`git -C upstream describe --tags --exact-match HEAD` prints `FIREFOX_153_1_0esr_RELEASE`) does not reliably hold as literally written -- it currently prints `FIREFOX_153_1_0esr_BUILD1` on this checkout, though the underlying commit is identical either way.
- **Fix:** `fetch-upstream.sh`'s re-run check now resolves `refs/tags/$TAG^{commit}` and compares the SHA to `HEAD` directly -- unambiguous regardless of how many other tags share that commit.
- **Files modified:** `scripts/fetch-upstream.sh`
- **Verification:** Confirmed `git -C upstream rev-parse HEAD` equals `git -C upstream rev-parse refs/tags/FIREFOX_153_1_0esr_RELEASE^{commit}` (both resolve to `468445e...`); re-run of `fetch-upstream.sh` correctly no-ops in 0.012s.
- **Committed in:** `78643ee` (Task 1 commit)

**2. [Rule 1 - Bug] `firefox` devShell had no clang -- `inputsFrom` does not copy a derivation's own stdenv**
- **Found during:** Task 2, first `./mach build` attempt
- **Issue:** `./mach build` failed immediately: `ERROR: Could not find clang to generate run bindings for C/C++.` `inputsFrom = [ pkgs.firefox-esr-153-unwrapped ]` only copies that derivation's `nativeBuildInputs`/`buildInputs` -- it does not copy the derivation's own build `stdenv`. Reading `pkgs/build-support/build-mozilla-mach/default.nix` confirmed `buildStdenv = overrideCC llvmPackages.stdenv (...)` -- the real build uses clang, while `pkgs.mkShell`'s default `stdenv` is gcc-based, giving the shell `gcc`/`g++` and no `clang`/`clang++` at all.
- **Fix:** Changed the firefox devShell to `(pkgs.mkShell.override { stdenv = pkgs.llvmPackages.stdenv; }) { inputsFrom = [...]; ... }`.
- **Files modified:** `flake.nix`
- **Verification:** `nix develop .#firefox --command which clang clang++` now resolves; `nix flake check` still passes; D-13 toolchain baseline still matches (rustc/cargo/cbindgen unaffected).
- **Committed in:** `78e9de8` (Task 2 commit)

**3. [Rule 1 - Bug] Leftover nixpkgs autotools env vars (`AS`, `LD`, etc.) broke Firefox's own toolchain detection**
- **Found during:** Task 2, second `./mach build` attempt (after fixing #2)
- **Issue:** After fixing clang, the build failed on the very first `.s` file (NSPR's `os_Linux_x86_64.s`): `Assembler messages: Fatal error: invalid listing option ','`. nixpkgs' bintools-wrapper setup hook exports `AS`/`LD`/`NM`/`AR`/`RANLIB`/`OBJDUMP`/`OBJCOPY`/`READELF`/`SIZE`/`STRINGS`/`STRIP` as bare tool names, for classic autotools `./configure` scripts. Firefox's own `moz.configure` (`build/moz.configure/toolchain.configure`) treats a pre-set `AS` env var as an explicit `--with-as`-style override and uses it *without* routing through the C compiler driver -- but `-Wa,--noexecstack` (added by `flags.configure` for `building_with_gnu_compatible_cc`) is compiler-driver-only syntax, invalid when passed straight to the raw assembler.
- **Fix:** Added `unset AS LD NM AR RANLIB OBJDUMP OBJCOPY READELF SIZE STRINGS STRIP` to the firefox shellHook. `CC`/`CXX` (clang/clang++, correctly set) are untouched.
- **Files modified:** `flake.nix`
- **Verification:** `./mach configure` re-ran cleanly; `config.status` now shows `AS: [.../clang-wrapper.../clang]` instead of raw `as`; `Configure complete!`.
- **Committed in:** `78e9de8` (Task 2 commit)

**4. [Rule 1 - Bug] bindgen's libclang lookup does not consult `LIBCLANG_PATH`**
- **Found during:** Task 2, third `./mach build` attempt (after fixing #2 and #3, hit at the `./mach configure` stage before recompiling)
- **Issue:** `ERROR: Could not find libclang to generate rust bindings for C/C++.` Reading `build/moz.configure/bindgen.configure`'s `bindgen_libclang_path` showed it parses `clang -print-search-dirs`'s "libraries" section for a `.../clang/<version>` directory pattern -- the standard single-package clang install layout. Nix ships `libclang.so` in a *separate* `clang-*-lib` store path, only discoverable via the `LIBCLANG_PATH` env var (correctly exported by the shell's setup hooks), which this lookup path never reads.
- **Fix:** Added `ac_add_options --with-libclang-path="$LIBCLANG_PATH"` to `.mozconfig` -- the documented escape hatch named directly in the `die()` message.
- **Files modified:** `.mozconfig`
- **Verification:** `./mach configure` completed (`Configure complete!`); the subsequent full build succeeded through Rust/gkrust compilation, which depends on bindgen-generated FFI headers.
- **Committed in:** `78e9de8` (Task 2 commit)

**5. [Rule 1 - Bug] `scripts/smoke-firefox.sh`'s version check was missing `MOZCONFIG`**
- **Found during:** Task 2, first run of `./scripts/smoke-firefox.sh` after the successful full compile
- **Issue:** The script's build step correctly passes `MOZCONFIG='$MOZCONFIG_FILE' ./mach build`, but its version-check line two statements later invoked `./mach run --version` with no `MOZCONFIG` at all. Without it, `mach` cannot resolve which objdir/build state to use and failed with "It looks like you tried to run a mach command from an invalid context ... has_build_or_shell". This script was authored in plan 01-01; the bug was invisible until an actual full build made the version-check path reachable.
- **Fix:** Added the same `MOZCONFIG='$MOZCONFIG_FILE'` prefix to the `./mach run --version` invocation.
- **Files modified:** `scripts/smoke-firefox.sh`
- **Verification:** Re-ran `./scripts/smoke-firefox.sh` end-to-end -> `smoke-firefox: PASS`, exit 0. The re-run's build step was a genuine no-op incremental build (14s), confirming the earlier failures were the actual cause, not incremental-build flakiness.
- **Committed in:** `78e9de8` (Task 2 commit)

---

**Total deviations:** 5 auto-fixed (all Rule 1 - bugs discovered live while running the phase's own acceptance proof; none required Rule 4 architectural discussion -- every fix was a shell/config correction, never a change to Gecko source or to the plan's locked decisions)
**Impact on plan:** All five fixes were required for Task 2's acceptance criteria to hold honestly. No scope creep -- `flake.nix`'s theia devShell (from 01-01, unrelated to this plan) was left untouched per the orchestrator's explicit instruction, and no `patches/`/`sourcerer/` directories or artifact-build wiring were introduced.

## Issues Encountered

**Non-blocking caveat, not fixed further:** `git -C upstream describe --tags --exact-match HEAD` (the plan's own `<verification>` step 2, and originally its acceptance-criteria text for Task 1) prints `FIREFOX_153_1_0esr_BUILD1` rather than `FIREFOX_153_1_0esr_RELEASE` on this checkout, because both tags point at the identical commit and `git describe`'s tie-break is implementation-defined. `fetch-upstream.sh`'s own logic no longer depends on this (see Deviation #1), but anyone running the plan's literal `<verification>` command by hand should expect this and should instead verify identity via `git rev-parse refs/tags/FIREFOX_153_1_0esr_RELEASE^{commit}` against `HEAD` -- both resolve to `468445e58d3acc7e4e059be99856daff1f2ae8f1`, the correct pinned release.

## User Setup Required
None. No external service configuration required; this is a pure local build-toolchain proof.

## Next Phase Readiness
- `upstream/` exists at the pinned tag with a real git revision identity, ready for Phase 3's `patches/`/`sourcerer/` layout to be added around it (D-03).
- The `firefox` devShell now genuinely compiles Gecko end-to-end -- Phase 3's rebase CI can build on this proven toolchain instead of re-discovering these four gaps.
- D-13 toolchain baseline (`toolchain-baseline.txt`) confirmed stable through a real compile; Phase 3's rebase CI has a real, exercised baseline to diff against, not just a captured-but-unverified one.
- `scripts/smoke-firefox.sh` is a genuinely green Wave 0 gate for BUILD-02 -- future changes to the firefox shell can be checked against it directly.
- Both Phase 1 dev shells (`theia` from 01-02, `firefox` from this plan) are independently proven; Phase 1's overall success criterion 2 (ROADMAP) is met.
- No blockers.

---
*Phase: 01-build-infrastructure*
*Completed: 2026-08-20*

## Self-Check: PASSED

All declared artifacts found on disk: `scripts/fetch-upstream.sh` (created), `flake.nix`, `.mozconfig`, `scripts/smoke-firefox.sh` (modified), this SUMMARY. `objdir/dist/bin/firefox` exists and is executable. Both commit hashes (`78643ee`, `78e9de8`) confirmed present in `git log --oneline --all`.
