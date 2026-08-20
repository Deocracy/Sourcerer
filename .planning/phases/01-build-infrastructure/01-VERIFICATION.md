---
phase: 01-build-infrastructure
verified: 2026-08-20T18:15:00Z
status: human_needed
score: 4/4 must-haves verified (criterion 4 verified via non-reproducible evidence — see caveat)
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Re-run a genuinely fresh clone of the repo (git clone . <space-free-path>) and follow docs/BUILD.md's 'Verifying a fresh clone' section exactly, including the mach configure substitution documented there."
    expected: "fetch-upstream.sh, smoke-theia.sh, mach configure, and the toolchain-baseline diff all succeed with zero undocumented manual steps, matching the 01-04-SUMMARY.md figures (463s clone, 14.9s smoke-theia, 65.6s mach configure)."
    why_human: "The verifier's task instructions explicitly forbid re-running the ~54min full mach build, and the fresh-clone scratch directory from 01-04's own verification run was already deleted before this verification pass began. The claim rests entirely on 01-04-SUMMARY.md's prose; it could not be independently re-executed or its artifacts inspected. This is the single unverified link in the phase."
---

# Phase 1: Build Infrastructure Verification Report

**Phase Goal:** A developer on the NixOS host can build and run both halves of Sourcerer from a clean checkout, without `mach bootstrap` and without out-of-shell setup.
**Verified:** 2026-08-20T18:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `nix develop .#theia` + one documented command → stock Theia IDE loads at localhost | ✓ VERIFIED | Ran `./scripts/smoke-theia.sh` live: real `node-gyp rebuild` compile of `drivelist` (`CXX(target)`, `SOLINK_MODULE(target) Release/obj.target/drivelist.node` observed), `theia build` → 0 errors both targets, `yarn theia start` → `Theia app listening on http://127.0.0.1:3000.`, curl against `localhost:3000` succeeds. PASS in 15.9s. |
| 2 | `nix develop .#firefox` + build pinned `FIREFOX_153_1_0esr_RELEASE` → launchable stock Firefox, never `mach bootstrap` | ✓ VERIFIED | `objdir/dist/bin/firefox` exists, is executable, and `./mach run --version` reports `Mozilla Firefox 153.1.0esr` (ran live). `git -C upstream log -1 --format=%H` = `468445e5...` matches `git -C upstream rev-parse refs/tags/FIREFOX_153_1_0esr_RELEASE^{commit}` exactly. `.mozbuild/build.log` and `.mozbuild/smoke-firefox-build.log` both contain 0 occurrences of `mach bootstrap` (grep run live). Per verifier task instructions, the ~54min full compile itself was NOT re-run — its artifact (the binary) was verified instead. |
| 3 | Native modules compile in the `theia` shell against pinned Node 22 — node-gyp path proven by a real build, not assumed | ✓ VERIFIED | Live run showed a genuine `node-gyp rebuild` compile of `drivelist` (C++ compile + link steps visible in output, not a shipped prebuilt — drivelist 12.0.2 ships no prebuilt binary, confirmed by reading `smoke-theia.sh`'s own comment and cross-checked against the compile log). `node-pty` is NOT compiled by node-gyp (it resolves via a bundled `prebuilds/linux-x64/pty.node`) but is functionally proven live via a real PTY spawn/write/read-back test (`PTY_PROOF_42` echoed back through a real `bash` process). This is an honest split: the "node-gyp path" is proven by drivelist; node-pty's correctness is proven functionally rather than via node-gyp, exactly as 01-02-SUMMARY.md states — not overstated. |
| 4 | A second fresh clone reaches both of the above via documented commands only, no manual steps outside the shells | ⚠️ UNVERIFIED (evidence not reproducible) | 01-04-SUMMARY.md claims a fresh clone at `/home/chris/coding/sourcerer-freshclone` (now deleted) ran `fetch-upstream.sh` (463s), `smoke-theia.sh` (PASS, 14.9s), and `mach configure` (not a full `mach build`) in 65.6s, then the toolchain-baseline diff matched. I could not re-run this — the scratch directory is gone and the task instructions forbid a second multi-hour full compile. Two separate concerns, assessed separately below. |

**Score:** 3/4 truths independently, freshly verified by this pass; 1/4 (criterion 4) rests on non-reproducible SUMMARY evidence — routed to human verification, not counted as a silent pass.

### Assessment of Criterion 4's `mach configure` substitution

The literal roadmap text says a second clone must reach "both of the above" — criterion 1 (Theia boots) and criterion 2 ("builds ... into a launchable stock Firefox"). What was actually run on the second clone, per 01-04-SUMMARY.md, was `mach configure`, not a second full `./mach build`. **This is not literally "reaches criterion 2" — no second Firefox binary was ever produced.**

That said, the substitution was not an executor shortcut invented after the fact — it was pre-declared in `01-VALIDATION.md`'s Manual-Only Verifications table (row `01-04-T2`, authored 2026-08-20 at plan-seed time) with an explicit rationale: `mach configure` exercises the exact toolchain-detection surface (clang discovery, `AS`/`LD`/etc. env leakage, `LIBCLANG_PATH`) where all five real bugs in 01-03 were found, in ~66s instead of ~54min, and a second full compile would "only re-prove what the first full build already proved" since the compile step itself doesn't depend on which checkout invoked it. That reasoning is sound: nothing about `objdir` compilation is clone-specific once configure succeeds and the toolchain resolves identically (which the baseline diff confirms it did).

**Verdict on this point:** the substitution is a reasonable, pre-approved proxy for the deep-compile step, but it means the roadmap's literal "reaches ... a launchable stock Firefox" was not reproduced on a second clone — only toolchain configuration was. Routed to human verification rather than either a pass or a gap, because the underlying claim (that the fresh clone ran at all, with those timings) cannot be independently re-checked by this verifier — the directory is gone.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `flake.nix` | `devShells.theia` + `.firefox`, both entering on real host | ✓ VERIFIED | Live: `nix develop .#theia --command node --version` → v22.23.2, `yarn --version` → 1.22.22. `nix develop .#firefox --command rustc/cargo/cbindgen --version` → 1.97.1/1.97.0/0.29.4, clang/clang++ resolve. `nix flake check` → all checks passed. |
| `flake.lock` | Pins nixos-unstable | ✓ VERIFIED | Present, committed. |
| `.gitignore` | Contains `upstream/`, `objdir/`, `.mozbuild/` | ✓ VERIFIED | Confirmed in file; `git status --porcelain` shows neither directory tracked or untracked despite both existing on disk. |
| `.mozconfig` | 5 lines incl. `--with-libclang-path` | ✓ VERIFIED | Present, used successfully by the live version-check run. |
| `scripts/smoke-theia.sh` | BUILD-01 gate, real node-pty + drivelist proof | ✓ VERIFIED (ran live, PASS) | See criterion 1/3 evidence above. |
| `scripts/smoke-firefox.sh` | BUILD-02 gate | ✓ PRESENT, logic verified by inspection; NOT re-executed (would trigger a full `mach build`, forbidden by verifier task instructions) | Reads correctly: greps `.mozbuild/*.log` for `mach bootstrap`, checks version string. Its bootstrap-absence check was independently reproduced by this verifier directly against the existing logs (0 hits). |
| `scripts/fetch-upstream.sh` | One documented, re-runnable command | ✓ VERIFIED by inspection + artifact | `upstream/` HEAD matches the pinned tag's commit exactly (verified live). |
| `scripts/toolchain-baseline.sh` + `toolchain-baseline.txt` | D-13 baseline, byte-reproducible | ✓ VERIFIED | Live run: `diff <(nix develop .#firefox --command bash scripts/toolchain-baseline.sh) toolchain-baseline.txt` → exit 0, no diff. |
| `theia/package.json`, `theia/applications/browser/package.json`, `theia/yarn.lock` | Stock 1.74.1 workspace, exact pins, no Lerna/Electron/@sourcerer | ✓ VERIFIED | grep for `electron`, `@sourcerer`, `lerna`, `applicationName` all empty; all 12 `@theia/*` pinned exactly `1.74.1`. |
| `objdir/dist/bin/firefox` | Real, launchable 153.1.0esr binary | ✓ VERIFIED | Live: executable exists, `--version` reports `Mozilla Firefox 153.1.0esr`. |
| `docs/BUILD.md` | Canonical, no TBD/placeholders, no Phase 3 scope leakage | ✓ VERIFIED | Read in full; no debt markers; documents observed commands/timings; explicitly notes the `mach configure` substitution and its reasoning. |
| `README.md` "## Building" | Points to docs/BUILD.md, ≤6 lines, no duplicated commands | ✓ VERIFIED | 5-line section between "## What v4.0 is" and "## History"; no `yarn install` etc. duplicated. |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| BUILD-01 | `theia` dev shell + build/run Theia browser-target app standalone at localhost | ✓ SATISFIED | Criteria 1 and 3 both independently verified live. |
| BUILD-02 | `firefox` dev shell (via inputsFrom, no mach bootstrap) + build pinned ESR tag | ✓ SATISFIED | Criterion 2 verified live (binary + version + commit-SHA match); `mach bootstrap` absence confirmed in build logs. |

REQUIREMENTS.md marks both `[x]` — consistent with what was independently confirmed here.

### Locked Decisions (D-01 through D-18) — Mechanically Checkable Subset

| Decision | Check | Result |
|----------|-------|--------|
| D-01 `upstream/` gitignored | `.gitignore` contains it; not tracked | ✓ HELD |
| D-02 git checkout, not tarball | `upstream/.git` exists | ✓ HELD |
| D-06 no Electron target | grep `electron` in theia package.json files | ✓ HELD (0 hits) |
| D-07 no `@sourcerer/*`, no branding | grep `@sourcerer`, `applicationName` | ✓ HELD (0 hits) |
| D-08 no Lerna | grep `lerna` | ✓ HELD (0 hits) |
| D-09 exact `@theia/*` pins | all 12 packages pinned `1.74.1`, no `^`/`~` | ✓ HELD |
| D-12 no artifact-build wiring | grep `artifact`/`MOZ_ARTIFACT` in `.mozconfig`, `flake.nix` | ✓ HELD (0 hits) |
| D-15 no bare `firefox-esr-unwrapped` | `flake.nix` uses `firefox-esr-153-unwrapped` explicitly | ✓ HELD |
| D-16 no bare `pkgs.nodejs` | `flake.nix` uses `pkgs.nodejs_22` explicitly | ✓ HELD |
| D-17 corepack not enabled | grep `corepack` across flake/scripts/docs | ✓ HELD (0 hits) |
| D-18 no `mach bootstrap` invoked | grep in flake/scripts (excluding the assertion-string in smoke-firefox.sh itself); grep in actual build logs | ✓ HELD (0 real invocations; only the guard string exists) |

All mechanically checkable locked decisions held.

### Anti-Patterns Found

None. Scanned `flake.nix`, `.mozconfig`, all `scripts/*.sh`, `docs/BUILD.md`, `README.md`, `theia/package.json`, `theia/applications/browser/package.json` for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and prose placeholders — zero hits.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Theia devShell versions | `nix develop .#theia --command node/yarn --version` | v22.23.2 / 1.22.22 | ✓ PASS |
| Firefox devShell toolchain | `nix develop .#firefox --command rustc/cargo/cbindgen --version` + `which clang` | 1.97.1/1.97.0/0.29.4, clang resolves | ✓ PASS |
| `nix flake check` | `nix flake check` | all checks passed | ✓ PASS |
| Full Theia smoke gate | `./scripts/smoke-theia.sh` | PASS in 15.9s, real drivelist compile + real node-pty spawn proof + real curl against booted server | ✓ PASS |
| D-13 baseline reproducibility | `diff <(...toolchain-baseline.sh) toolchain-baseline.txt` | exit 0 | ✓ PASS |
| Firefox binary launch | `objdir/dist/bin/firefox --version` (via mach run) | `Mozilla Firefox 153.1.0esr` | ✓ PASS |
| Firefox commit identity | `git -C upstream log -1` vs tag SHA | Match: `468445e5...` | ✓ PASS |
| `mach bootstrap` absence | grep build logs | 0 occurrences | ✓ PASS |
| Full `./mach build` (54min) | NOT RE-RUN, per task instructions | N/A | SKIPPED (instructed) |
| `scripts/smoke-firefox.sh` full run | NOT RE-RUN — would trigger a full compile | N/A | SKIPPED (would duplicate the 54min build; logic verified by inspection instead) |
| Second fresh clone | NOT RE-RUN — scratch dir already deleted before this verification | N/A | SKIPPED / UNVERIFIABLE — routed to human verification |

### Human Verification Required

1. **Re-run a genuinely fresh clone** — see frontmatter for full detail. This is the one link in the phase's evidence chain that could not be independently re-checked: the 01-04 fresh-clone run's own scratch directory (`/home/chris/coding/sourcerer-freshclone`) was deleted before this verification pass, per the executor's own instructions to clean up afterward. Everything else in this phase was independently reproduced live by this verifier; criterion 4 rests on SUMMARY prose alone.

## Gaps Summary

No blocking gaps. Success criteria 1, 2, and 3 are independently, freshly verified against the live NixOS host, not merely re-read from SUMMARY prose. All mechanically-checkable locked decisions (D-01, D-02, D-06 through D-09, D-12, D-15 through D-18) hold in the actual committed files. No debt markers, no stub artifacts, no unwired scripts.

The one open item is criterion 4: the claim that a second fresh clone reached both halves using only documented commands is plausible (its timing figures are consistent with the primary clone's, and the `mach configure` substitution it used was pre-approved in 01-VALIDATION.md with sound reasoning — configure exercises exactly the toolchain-detection surface where every real bug in this phase was found), but it is (a) not a literal reproduction of "builds ... into a launchable Firefox" on the second clone, only of successful configuration, and (b) not independently re-checkable by this verifier because the scratch clone no longer exists. This is flagged as a human-verification item, not a gap, because nothing in the codebase contradicts the claim — there is simply no artifact left to check it against.

---

_Verified: 2026-08-20T18:15:00Z_
_Verifier: Claude (gsd-verifier)_
