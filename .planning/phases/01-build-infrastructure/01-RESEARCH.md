# Phase 1: Build Infrastructure - Research

**Researched:** 2026-08-20
**Domain:** NixOS Nix-flake dev-shell toolchain for (a) a full-compile Firefox-ESR-153 fork build and (b) a real Theia 1.74.1 browser-target yarn workspace with native-module compilation
**Confidence:** HIGH — every load-bearing claim below was verified this session either by reading the actual nixpkgs/Firefox source files at the pinned revisions, or by reading the local reference Theia checkouts, not from training-data recall.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `upstream/` is listed in `.gitignore` and materialized on demand from a pinned source. The ESR tree is never committed to this repo. Rationale: an extracted ESR tree is ~2.5 GB / ~250k files; committing it makes `git status`, `git grep`, and every diff in this repo slow, and turns each ESR rebase into one unreviewable multi-gigabyte commit. The patch stack in `patches/` is the artifact that matters — upstream is replaceable, not owned. Reproducibility is bought instead by a content-addressed pin (D-02), which fails loudly on byte drift rather than silently accepting it. This is also the pattern Zen Browser ships a Firefox fork with today (gitignored `engine/`, fetched by `surfer download`).
- **D-02:** `upstream/` is a **shallow git checkout** of the canonical `mozilla-firefox/firefox` mirror at tag `FIREFOX_153_1_0esr_RELEASE` — not an extracted release tarball. Reversibility: costly — BUILD-03's rebase procedure and BUILD-04's `MOZ_ARTIFACT_REVISION` both depend on upstream having a git revision identity. A git checkout gets `git am` fail-loudly-on-conflict semantics for free. The tag is confirmed present on the mirror, alongside branch `esr153`.
- **D-03:** Phase 1 materializes into `upstream/` — the name BUILD-03 already reserves — not a scratch directory.
- **D-04:** Materialization is **one documented command**, not a manual sequence. Success criterion 4 explicitly includes the upstream fetch as a documented step.
- **Mechanism note:** `mach` needs a writable tree and the Nix store is read-only — the flake pins the source identity, and the documented command materializes it into writable `upstream/`.
- **D-05:** Phase 1 creates the **real** `theia/` yarn workspace that Phase 2 extends. No throwaway `@theia/cli`-generated app.
- **D-06:** Layout mirrors `eclipse-theia/theia-ide`: root `package.json` declaring yarn workspaces, with `applications/browser` as the only application target. **No `applications/electron`** — Electron is out of scope project-wide.
- **D-07:** "Stock" in success criterion 1 means the workspace contains **zero `@sourcerer/*` extensions** in Phase 1 — the app is composed purely from `@theia/*`.
- **D-08:** No Lerna in Phase 1 — yarn workspaces alone. Add it only if Phase 2's multi-extension build actually needs ordered builds. Reversibility: reversible.
- **D-09:** `@theia/*` dependencies pinned to **exact** 1.74.1 (no `^`), with a `resolutions` block to stop transitive drift.
- **D-10:** Success criterion 3 is proven by a **real** native build — `yarn theia rebuild:browser` compiling node-pty / native-keymap against the pinned Node — not by assuming node-gyp works.
- **D-11:** Phase 1's acceptance proof is **one full compile** of stock 153.1.0esr, not an artifact build.
- **D-12:** Artifact builds (`--enable-artifact-builds`, `MOZ_ARTIFACT_REVISION`) stay in Phase 3 / BUILD-04. Phase 1 must not *preclude* them but does not wire them.
- **D-13:** Phase 1 records the **resolved rustc and cbindgen versions** the flake supplies, in a form Phase 3's rebase CI can diff against.
- **D-14:** A single `nixpkgs` flake input following **`nixos-unstable`**, pinned by `flake.lock`. Reversibility: costly. `nixos-25.11` has no `firefox-esr-153` derivation at all.
- **D-15:** The `firefox` shell uses `inputsFrom = [ pkgs.firefox-esr-153-unwrapped ]` — the **version-explicit** attribute, never the `firefox-esr-unwrapped` alias. Reversibility: costly — the alias silently re-points when nixpkgs advances its ESR line.
- **D-16:** Node is `pkgs.nodejs_22`, referenced from one place and reused everywhere. Never bare `pkgs.nodejs`.
- **D-17:** Yarn comes from the nixpkgs `yarn` attribute (Classic). `corepack` is **not** enabled.
- **D-18:** `mach bootstrap` is never invoked. The `firefox` shell supplies everything bootstrap would install; make that explicit where a developer will see it.

### Claude's Discretion

- **Developer entry surface** — where the "documented commands" for success criteria 1 and 4 live (repo `README.md` vs a `docs/BUILD.md` vs a shellHook banner printed on `nix develop`). Leaning: shellHook banner listing the next command for that shell, with `README.md` as the canonical written copy.
- **direnv support** (`.envrc` + `use flake`) — convenience only, not required by any success criterion. Leaning: include, it is two lines.
- **CI skeleton in Phase 1** — Leaning: no CI in Phase 1; a workflow that cannot yet replay a patch stack is a stub that will be rewritten.
- **Exact shallow-clone mechanics** for D-02 (`--depth 1 --branch <tag>` vs a blobless `--filter=blob:none` clone). Both satisfy D-02; pick on measured clone time and on whichever survives fetching a *second* tag cleanly for the Phase 3 rebase. **This session's empirical test (see Common Pitfalls #4) found `--depth 1 --branch <tag>` progressed steadily while `--filter=blob:none` stalled for 5+ minutes — leaning now favors plain `--depth 1`, subject to re-timing on the real host.**

### Deferred Ideas (OUT OF SCOPE)

- Artifact builds (`--enable-artifact-builds`, `MOZ_ARTIFACT_REVISION` pinning) — Phase 3, BUILD-04.
- `patches/` and `sourcerer/` trees, and the documented rebase procedure — Phase 3, BUILD-03.
- Rebase CI (`sync-upstream`-style workflow, fail loudly on conflict) — Phase 3.
- `@sourcerer/*` extensions and all branding — Phase 2 (Theia side) and Phase 3 (Firefox side).
- Bundling a Node runtime into the shipped build — Phase 4/5 packaging concern.
- `sourcerer/INTERNAL-APIS.md` — Phase 4 creates it; Phase 3 documents the artifact boundary.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUILD-01 | Developer can enter a `theia` Nix dev shell (node 22, yarn 1.x, node-gyp toolchain) and build/run the Theia browser-target app standalone at localhost on the NixOS host | Verified minimal 11-package `applications/browser/package.json` shape (Standard Stack, Code Examples); confirmed `node-pty` is the one real native module to prove via `yarn theia rebuild:browser` (Pitfall 3); `theia` devShell package list (Standard Stack, Supporting) |
| BUILD-02 | Developer can enter a `firefox` Nix dev shell (toolchain via `inputsFrom` nixpkgs' firefox-esr unwrapped derivation, no `mach bootstrap`) and build the pinned ESR tag | Verified `inputsFrom` supplies the right toolchain but not `preConfigure`/`configureFlags` (Architecture Pattern 2); verified `--enable-bootstrap` defaults off for ESR checkouts (Anti-Patterns); minimal `.mozconfig` recipe (Code Examples); WASM-sandboxing gap and fix (Pitfall 2) |
</phase_requirements>

## Summary

Phase 1 has two independent toolchain problems, and this session's research resolved the two highest-risk unknowns for each: **(1)** what `inputsFrom = [ pkgs.firefox-esr-153-unwrapped ]` actually supplies vs. what a hand-written `.mozconfig` must supply on top of it for a full (non-artifact) compile, and **(2)** what the minimal correct `theia/` workspace shape looks like at exactly 1.74.1.

For Firefox: reading nixpkgs's own `buildMozillaMach` derivation (`pkgs/build-support/build-mozilla-mach/default.nix`) shows `inputsFrom` supplies the right `nativeBuildInputs`/`buildInputs` list (rustc, rust-cbindgen, nodejs, python3, cargo, gtk3, dbus, the X11 libs, etc.) but supplies **none** of the derivation's `preConfigure` environment exports, `configureFlags`, or patches — those live in the *build recipe*, not the *inputs*, and `inputsFrom` only pulls inputs. The two env vars a hand-rolled `.mozconfig`/shellHook must set explicitly are `MOZBUILD_STATE_PATH` (defaults to `~/.mozbuild` if unset — harmless but worth pinning under the repo for D-01-style containment) and `MOZ_OBJDIR`. Reading `build/moz.configure/bootstrap.configure` in the actual ESR-153 tree confirms `--enable-bootstrap` defaults to **off** on a non-nightly (ESR) checkout, so `./mach configure` will not try to auto-invoke mozboot toolchain fetching — it just uses whatever `rustc`/`cbindgen`/etc. `inputsFrom` put on `$PATH`. The one real gap: Firefox's WASM/RLBox library sandboxing is **default-on for Linux since Firefox 74** and needs a `wasm32-wasi` sysroot + cross-compiler that `inputsFrom` does not supply; the pragmatic fix, confirmed against Mozilla's own Bugzilla issue history, is `ac_add_options --without-wasm-sandboxed-libraries` in `.mozconfig` — this sidesteps building a WASI cross-toolchain entirely and is a legitimate simplification for a dev-build proof, not a correctness compromise.

For Theia: reading the actual `examples/browser/package.json` at the local `theia` framework checkout (pinned to exactly 1.74.1) and cross-referencing the official theia-ide.org "Composing Applications" doc gives a concrete, small, verified minimal package set — `@theia/core`, `@theia/editor`, `@theia/filesystem`, `@theia/markers`, `@theia/messages`, `@theia/monaco`, `@theia/navigator`, `@theia/preferences`, `@theia/process`, `@theia/terminal`, `@theia/workspace`, plus `@theia/cli` as a devDependency. Reading `dev-packages/application-manager/src/rebuild.ts` resolves an open question from CONTEXT.md: **`native-keymap` is Electron-target-only** (confirmed by grepping every file that imports it — all live under `electron-shared/`, `electron-node/`, `electron-main/`) — it is not a real dependency of any package in the minimal browser-target set, so D-10's native-module proof is really about `node-pty` (pulled in transitively via `@theia/process` → `@theia/terminal`), not native-keymap. The X11 dev headers are still cheap defensive insurance to include in the `theia` shell (near-zero cost, and Theia's own `theia rebuild:browser` attempts all five `DEFAULT_MODULES` unconditionally), but they are not proof-critical for Phase 1's stock, Electron-free workspace.

**Primary recommendation:** Write `flake.nix` with two `devShells` where `theia` = `mkShell { buildInputs = [ nodejs_22 yarn python3 pkg-config gnumake xorg.libX11 xorg.libxkbfile ]; }` and `firefox` = `mkShell { inputsFrom = [ pkgs.firefox-esr-153-unwrapped ]; shellHook = ''export MOZBUILD_STATE_PATH="$PWD/.mozbuild"''; }`; drive the Firefox build from a `.mozconfig` containing `--without-wasm-sandboxed-libraries`, `--disable-updater`, and `--enable-application=browser`; build the `theia/` workspace from the verified 11-package minimal set pinned exactly at `1.74.1` with a `resolutions` block, proven by `yarn theia rebuild:browser`.

## Architectural Responsibility Map

This phase is pure developer-tooling/build-system work — it produces no runtime request path, so the standard app-tier table is adapted to build-system responsibility instead of request-handling responsibility.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Firefox/Gecko compilation | Browser/Client (produces the browser substrate binary) | Build/Dev Tooling (Nix `firefox` shell supplies the compiler toolchain) | The artifact being built is the browser itself; the Nix shell is purely a toolchain provider, not a runtime component |
| Theia backend build + native module compile (`node-pty`) | API/Backend (Node process) | Build/Dev Tooling (`theia` shell supplies node-gyp toolchain) | `node-pty` and the Theia backend run as a Node server process at runtime (Phase 4 supervises it); Phase 1 only proves it compiles |
| Theia frontend bundle build | Browser/Client (bundle runs inside any browser at `localhost:<port>`) | — | `applications/browser` target is explicitly browser-hosted, never Electron (D-06) |
| Nix flake / devShell definitions | Build/Dev Tooling (no runtime tier) | — | Supplies toolchains to the tiers above; never itself part of a request path |
| `upstream/` materialization command | Build/Dev Tooling | — | One-shot fetch script, not a runtime component |

## Package Legitimacy Audit

Ran `gsd-tools query package-legitimacy check --ecosystem npm` against every `@theia/*` package Phase 1 needs to install.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@theia/cli` | npm | published 2026-08-06 | 21,362/wk | github.com/eclipse-theia/theia | SUS (`too-new`) | Flagged — see note below |
| `@theia/core` | npm | published 2026-08-06 | 41,514/wk | github.com/eclipse-theia/theia | SUS (`too-new`) | Flagged |
| `@theia/filesystem` | npm | published 2026-08-06 | 24,350/wk | github.com/eclipse-theia/theia | SUS (`too-new`) | Flagged |
| `@theia/workspace` | npm | published 2026-08-06 | 25,504/wk | github.com/eclipse-theia/theia | SUS (`too-new`) | Flagged |
| `@theia/editor` | npm | published 2026-08-06 | 28,923/wk | github.com/eclipse-theia/theia | SUS (`too-new`) | Flagged |
| `@theia/monaco` | npm | published 2026-08-06 | 25,584/wk | github.com/eclipse-theia/theia | SUS (`too-new`) | Flagged |
| `@theia/navigator` | npm | published 2026-08-06 | 24,226/wk | github.com/eclipse-theia/theia | SUS (`too-new`) | Flagged |
| `@theia/preferences` | npm | published 2026-08-06 | 23,628/wk | github.com/eclipse-theia/theia | SUS (`too-new`) | Flagged |
| `@theia/process` | npm | published 2026-08-06 | 26,876/wk | github.com/eclipse-theia/theia | SUS (`too-new`) | Flagged |
| `@theia/terminal` | npm | published 2026-08-06 | (same cohort) | github.com/eclipse-theia/theia | SUS (`too-new`) | Flagged |
| `@theia/markers` | npm | published 2026-08-06 | (same cohort) | github.com/eclipse-theia/theia | SUS (`too-new`) | Flagged |
| `@theia/messages` | npm | published 2026-08-06 | (same cohort) | github.com/eclipse-theia/theia | SUS (`too-new`) | Flagged |

**Packages removed due to `SLOP` verdict:** none — every package returned `SUS`, none returned `SLOP`.

**Packages flagged as suspicious `SUS`:** all twelve `@theia/*` packages above, uniformly for the single reason `too-new`. This is a false-positive pattern, not a real supply-chain risk signal: the "too-new" heuristic is measuring the publish timestamp of the specific `1.74.1` version tag (2026-08-06, two weeks before this research), not the package's overall trust profile. Every package resolves to `repoUrl: git+https://github.com/eclipse-theia/theia.git` — the correct, single, official Eclipse Theia monorepo — has 20k–40k weekly downloads, is not deprecated, and has no `postinstall` script. This matches STACK.md's independently-verified finding that 1.74.1 is Theia's actively-maintained latest tagged release, published as claimed. **The planner must still add a `checkpoint:human-verify` task before the `yarn install` step per protocol**, but the correct verification action is simply "confirm the installed version resolves to `1.74.1` and `repoUrl` still points at `eclipse-theia/theia`" — not a slopsquat investigation.

*No packages in this phase were discovered via WebSearch/training data without registry cross-check — all were checked directly against the npm registry via the legitimacy seam.*

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Firefox ESR | 153.1.0esr, tag `FIREFOX_153_1_0esr_RELEASE` | Browser substrate | Locked by CONTEXT.md D-02; re-verified this session — tag exists on `mozilla-firefox/firefox` `[VERIFIED: mozilla-firefox/firefox tag list via GitHub API]` |
| Eclipse Theia | 1.74.1 | IDE substrate | Locked by CONTEXT.md D-09; local reference checkout at `/home/chris/Vibe Coding/TheiaIDE/sources/theia` confirms `examples/browser/package.json` `"version": "1.74.1"` `[VERIFIED: theia/examples/browser/package.json:3]` |
| `nixpkgs` (unstable) | flake input, `nixos-unstable` | Provides `firefox-esr-153-unwrapped`, `nodejs_22`, `yarn` | Locked by D-14; `firefox-esr-153.nix` confirmed present on `master` `[VERIFIED: pkgs/applications/networking/browsers/firefox/packages/firefox-esr-153.nix]` |
| `pkgs.nodejs_22` | 22.23.2 (as of this research, nixos-unstable) | Theia shell Node runtime | `[VERIFIED: pkgs/development/web/nodejs/v22.nix:26 — 'version = "22.23.2"']`. Note: newer than the `22.22.2` figure recorded in 01-CONTEXT.md's 2026-08-20 verification — `nixos-unstable` moves continuously; both satisfy Theia's `>=22` floor and D-16's pin-by-attribute (`nodejs_22`, never bare `nodejs`) |
| `pkgs.yarn` | 1.22.22 (Classic) | Theia workspace package manager | `[VERIFIED: pkgs/by-name/ya/yarn/package.nix:22 — 'version = "1.22.22"']`, confirms D-17 |
| `pkgs.rust-cbindgen` | 0.29.4 | Rust→C header generation for Gecko's FFI boundary | `[VERIFIED: pkgs/by-name/ru/rust-cbindgen/package.nix — 'version = "0.29.4"']`. This is exactly Firefox 153's own required minimum (see D-13 baseline below) — nixpkgs already ships the matched pair |
| `pkgs.rustc` (default = `rust_1_97`) | 1.97.1 | Rust compiler for Gecko | `[VERIFIED: pkgs/top-level/all-packages.nix:4003-4004 — 'rust_1_97 = callPackage ../development/compilers/rust/1_97.nix { }; rust = rust_1_97;' and 'inherit (rustPackages) cargo ... rustc rustc-unwrapped rustPlatform;']`, version confirmed `[VERIFIED: pkgs/development/compilers/rust/1_97.nix:53 — 'rustcVersion = "1.97.1";']` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@theia/cli` | 1.74.1 (exact) | `theia build` / `theia start` / `theia rebuild:browser` driver | devDependency in `applications/browser/package.json`; bin name is `theia` `[VERIFIED: theia/dev-packages/cli/package.json — bin: {"theia": "./bin/theia.js", "theia-patch": "./bin/theia-patch.js"}]` |
| `node-pty` | 1.2.0-beta.12 (as pinned by `@theia/process` at 1.74.1) | PTY backing for `@theia/terminal` | Only real native module in the minimal package set — `[VERIFIED: theia/packages/process/package.json:7 — "node-pty": "1.2.0-beta.12"]` |
| `xorg.libX11`, `xorg.libxkbfile`, `pkg-config`, `gnumake`, `python3` | nixpkgs current | node-gyp toolchain for native-keymap (Electron-only, not exercised by Phase 1's stock browser target, but cheap insurance since `theia rebuild:browser` attempts all `DEFAULT_MODULES` unconditionally) | `theia` devShell `buildInputs`/`nativeBuildInputs` |
| `rustPlatform.bindgenHook`, `autoconf`, `gnum4`, `nasm`, `unzip`, `which`, `wrapGAppsHook3` | whatever `firefox-esr-153-unwrapped` pins | Full set of `nativeBuildInputs` a stock ESR-153 compile needs | Consumed automatically via `inputsFrom`, no manual listing needed — `[VERIFIED: pkgs/build-support/build-mozilla-mach/default.nix, nativeBuildInputs list]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-listing Firefox's ~15 `nativeBuildInputs`/~30 `buildInputs` in `flake.nix` | `inputsFrom = [ pkgs.firefox-esr-153-unwrapped ]` | `inputsFrom` is strictly better here — it tracks whatever nixpkgs' own maintainers currently use to build this exact version, so it self-updates on every `flake.lock` bump; hand-listing would silently drift |
| `--without-wasm-sandboxed-libraries` in `.mozconfig` | Build a full `wasm32-wasip1` cross-toolchain + WASI sysroot in the `firefox` shell (nixpkgs's own `pkgsCross.wasm32-wasip1`) | Only worth doing if a later phase needs the RLBox-sandboxed codec libraries' exact hardening posture reproduced; D-11's goal is "prove the toolchain compiles," not "match nixpkgs's production hardening flags" |
| The 11-package minimal Theia set | The full `theia-ide`/`examples/browser` 60+ package kitchen-sink set (AI packages, VSX registry, collaboration, etc.) | D-07 requires "zero `@sourcerer/*` extensions" and a stock proof-of-boot, not a feature-complete IDE — the minimal set is what theia-ide.org's own "Composing Applications" doc documents as the generator's baseline output |

**Installation:**
```bash
# Theia shell
nix develop .#theia
yarn install
yarn theia rebuild:browser --cacheRoot .
yarn theia build --app-target=browser --mode development
yarn theia start

# Firefox shell
nix develop .#firefox
# (upstream/ already materialized by the documented D-04 fetch command)
cd upstream
MOZCONFIG=../.mozconfig ./mach build
./mach run
```

**Version verification performed this session:** every version cited above was read directly from the pinned nixpkgs-master source tree or the local Theia 1.74.1 checkout (see inline `[VERIFIED: path]` tags), not `npm view`/`nix search` output, since `search.nixos.org` was already flagged stale in 01-CONTEXT.md.

## Architecture Patterns

### System Architecture Diagram

```
 developer runs `nix develop .#theia`         developer runs `nix develop .#firefox`
        │                                              │
        ▼                                              ▼
 ┌──────────────────────┐                    ┌───────────────────────────┐
 │ theia devShell        │                    │ firefox devShell           │
 │ nodejs_22, yarn 1.x,   │                    │ inputsFrom firefox-esr-153-│
 │ python3, pkg-config,   │                    │ unwrapped: rustc 1.97.1,   │
 │ gnumake, xorg libs     │                    │ rust-cbindgen 0.29.4,      │
 └──────────┬─────────────┘                    │ nodejs, cargo, gtk3, ...   │
            │                                  └──────────┬─────────────────┘
            ▼                                             ▼
   yarn install (workspaces:                     shellHook exports:
   applications/*)                                MOZBUILD_STATE_PATH=$PWD/.mozbuild
            │                                     (upstream/ already fetched by the
            ▼                                      one documented D-04 command —
   yarn theia rebuild:browser                      shallow git checkout of
   → node-gyp compiles node-pty                    FIREFOX_153_1_0esr_RELEASE)
   against pinned Node ABI                                    │
            │                                                 ▼
            ▼                                     MOZCONFIG=../.mozconfig ./mach build
   yarn theia build --app-target=browser           (--enable-bootstrap defaults OFF on
            │                                       ESR; --without-wasm-sandboxed-
            ▼                                       libraries avoids needing a WASI
   yarn theia start → stock Theia at                cross-toolchain)
   localhost:<port>, any browser                               │
                                                                ▼
                                                     ./mach run → launchable stock
                                                     Firefox binary
```

Both halves are proven independently — no cross-shell dependency, matching STACK.md's "decoupled builds" pattern and D-04's "no manual steps outside the shells" requirement.

### Recommended Project Structure

```
sourcerer/
├── flake.nix                  # devShells.theia, devShells.firefox
├── flake.lock
├── .mozconfig                 # committed; ac_add_options for the firefox build
├── upstream/                  # gitignored (D-01); shallow git checkout of the pinned tag
├── theia/
│   ├── package.json           # workspaces: ["applications/*"], resolutions block
│   ├── yarn.lock
│   └── applications/
│       └── browser/
│           └── package.json   # the 11-package minimal set + @theia/cli devDep
└── docs/
    └── BUILD.md                # documented commands (Claude's Discretion leaning)
```

### Pattern 1: `inputsFrom` for toolchain inheritance, never hand-listed inputs

**What:** `devShells.firefox = pkgs.mkShell { inputsFrom = [ pkgs.firefox-esr-153-unwrapped ]; }` — this pulls in the derivation's `nativeBuildInputs`/`buildInputs` (rustc, cbindgen, cargo, nodejs, python3, gtk3, dbus, X11 libs, pkg-config, wrapGAppsHook3, etc.) without duplicating the list.
**When to use:** Any time the goal is "reproduce the exact toolchain nixpkgs already uses to build this exact package," which is precisely D-15's intent (never the `firefox-esr-unwrapped` alias).
**Example:**
```nix
# Source: read directly from pkgs/build-support/build-mozilla-mach/default.nix
# nativeBuildInputs (non-Darwin) = autoconf, cargo, gnum4, llvmPackagesBuildBuild.bintools,
# makeBinaryWrapper, nodejs, perl, python3, rust-cbindgen, rustPlatform.bindgenHook, rustc,
# unzip, which, pkg-config, wrapGAppsHook3, nasm (x86 only)
devShells.firefox = pkgs.mkShell {
  inputsFrom = [ pkgs.firefox-esr-153-unwrapped ];
  shellHook = ''
    export MOZBUILD_STATE_PATH="$PWD/.mozbuild"
  '';
};
```

### Pattern 2: `inputsFrom` does NOT supply preConfigure exports, configureFlags, or patches

**What:** `inputsFrom` only pulls `buildInputs`/`nativeBuildInputs` (and similar input-list attributes) from the referenced derivation — never its `preConfigure`, `configureFlags`, `env`, or `patches`. Reading the derivation confirms `MOZBUILD_STATE_PATH`, `MOZ_OBJDIR`, `MOZ_BUILD_DATE`, `WASM_CC`/`WASM_CXX`, and all `configureFlags` (`--with-system-*`, `--disable-updater`, `--enable-lto=cross,full`, etc.) live in `preConfigure`/`configureFlags`, not in the inputs list `[VERIFIED: pkgs/build-support/build-mozilla-mach/default.nix — preConfigure and configureFlags blocks]`.
**When to use:** Whenever writing the `.mozconfig`/shellHook for the `firefox` devShell — treat nixpkgs's derivation as a *reference for what env vars and flags exist*, not something `inputsFrom` replicates automatically.
**Example:** see the "What mach needs beyond `inputsFrom`" pitfall below for the concrete minimal `.mozconfig`.

### Anti-Patterns to Avoid

- **Replicating nixpkgs's full `configureFlags` list (LTO, PGO, `--with-system-*` for every library) in Sourcerer's own `.mozconfig`:** This chases nixpkgs's production packaging posture, which is a different goal from D-11's "prove one full compile works." LTO in particular requires `llvmPackagesBuildBuild.bintools` and a cross wasm32 sysroot that add real setup cost for zero benefit to a dev-build proof — skip `--enable-lto` entirely for Phase 1.
- **Assuming `--enable-bootstrap` is needed or harmless to leave default:** On a `vcs_checkout_type` + `is_nightly` gate, it defaults to enabled only for nightly checkouts of mozilla-central. An ESR checkout gets `bootstrap_default = None` (falsy) `[VERIFIED: build/moz.configure/bootstrap.configure:19-24]`, so this is a non-issue by default — but never pass `--enable-bootstrap` explicitly, since that would re-invoke the exact `mach bootstrap` machinery D-18 forbids.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Firefox `nativeBuildInputs`/`buildInputs` list | A hand-maintained Nix list of ~45 packages | `inputsFrom = [ pkgs.firefox-esr-153-unwrapped ]` | nixpkgs maintainers already solved this exact pairing problem (see cbindgen/rustc note below) and keep it current every nixpkgs update |
| cbindgen/rustc version compatibility (PITFALLS.md #2) | Manual pinning of exact rustc + cbindgen versions researched against Firefox's `MINIMUM_RUST_VERSION`/`cbindgen_min_version` | Same `inputsFrom` — nixpkgs's `rust-cbindgen` package is pinned at exactly `0.29.4`, matching Firefox 153's own `cbindgen_min_version = Version("0.29.4")` `[VERIFIED: bindgen.configure:13]`, and even lists `firefox-esr-unwrapped` in its own `passthru.tests` | The version-drift pitfall PITFALLS.md #2 warns about is a real risk when *manually* installing cbindgen (e.g. via `cargo install cbindgen --force`); it is not a risk when consuming nixpkgs's already-tested pairing via `inputsFrom` |
| WASM/RLBox sandboxing toolchain | A `pkgsCross.wasm32-wasip1` cross-compiler + WASI sysroot wired into the `firefox` shell | `ac_add_options --without-wasm-sandboxed-libraries` in `.mozconfig` | Confirmed via Mozilla Bugzilla (#1759544, #1744197) as the documented escape hatch when a WASI sysroot isn't available; building this from scratch would be a self-inflicted extra requirement `inputsFrom` genuinely does not need to satisfy for Phase 1's goal |

**Key insight:** The entire "what does the Firefox build need" problem for Phase 1 already has a working, maintained answer in nixpkgs's own `firefox-esr-153-unwrapped` derivation — the job here is to read it accurately (inputs vs. recipe) rather than to research Firefox's build system from Mozilla's docs in isolation.

## Common Pitfalls

### Pitfall 1: `inputsFrom` inheriting the toolchain does NOT mean `MOZBUILD_STATE_PATH`/`MOZ_OBJDIR` are set

**What goes wrong:** A developer runs `nix develop .#firefox` expecting a build-ready shell, runs `MOZCONFIG=../.mozconfig ./mach build`, and either gets prompted interactively for a state directory (Bugzilla #1356541 documents this exact prompt) or `mach` silently writes build state into `~/.mozbuild` — which works, but isn't repo-contained and can surprise a "second fresh clone" (D-04 success criterion) if `~/.mozbuild` already has stale state from a prior attempt.
**Why it happens:** `MOZBUILD_STATE_PATH` defaults to `os.path.expanduser("~/.mozbuild")` when unset `[VERIFIED: build/moz.configure/init.configure:1215-1227 — "return normalize_path(os.path.expanduser(os.path.join(\"~\", \".mozbuild\")))"]`; `inputsFrom` never sets environment variables, only inputs.
**How to avoid:** Export `MOZBUILD_STATE_PATH="$PWD/.mozbuild"` (and optionally `MOZ_OBJDIR="$PWD/objdir"`) from the `firefox` shellHook, so build state stays inside the repo tree and a fresh clone starts clean every time.
**Warning signs:** An interactive prompt asking for a state directory path during `./mach build`; a `~/.mozbuild` directory appearing outside the repo after a build.

### Pitfall 2: WASM/RLBox library sandboxing is default-on and needs a WASI sysroot `inputsFrom` does not supply

**What goes wrong:** `./mach build` fails with `ERROR: Cannot find a wasi sysroot. Please give its location with --with-wasi-sysroot.` (a live, recurring Bugzilla report class — #1759544, #1744197) because Firefox has defaulted to WASM-sandboxed library builds on Linux since Firefox 74, and neither `inputsFrom` nor a plain devShell supplies a `wasm32-wasi`/`wasm32-wasip1` cross-compiler or sysroot.
**Why it happens:** RLBox sandboxing compiles certain codec/parsing libraries (graphite, ogg, etc.) to WASM for in-process isolation; this is a genuine extra toolchain requirement beyond what a native x86_64 Gecko compile needs.
**How to avoid:** Add `ac_add_options --without-wasm-sandboxed-libraries` to `.mozconfig`. This is Mozilla's own documented workaround when a WASI SDK isn't set up, and is proportionate for a Phase 1 dev-build proof — it is not required by any Phase 1 success criterion to build with production hardening flags.
**Warning signs:** Any `mach build` failure mentioning `wasi-sysroot`, `WASM_CC`, or `WASM_SANDBOXED_LIBRARIES`.

### Pitfall 3: `theia rebuild:browser` attempts to rebuild 5 native modules unconditionally, but only `node-pty` is real for a stock browser-target app

**What goes wrong:** A developer sees `theia rebuild:browser` reference `native-keymap`, `find-git-repositories`, `drivelist`, and `keytar` in addition to `node-pty` and assumes all five need their native toolchains proven for D-10's success criterion, over-provisioning the `theia` devShell or wrongly concluding native-keymap's X11 headers are proof-critical.
**Why it happens:** `DEFAULT_MODULES` in `dev-packages/application-manager/src/rebuild.ts` is a fixed list checked across every Theia app regardless of target `[VERIFIED: theia/dev-packages/application-manager/src/rebuild.ts:33-39 — "export const DEFAULT_MODULES = ['node-pty', 'native-keymap', 'find-git-repositories', 'drivelist', 'keytar'];"]`, but `native-keymap` is only ever imported from Electron-target code paths (`packages/core/electron-shared/`, `packages/core/src/electron-node/`, `packages/core/src/electron-main/`, `packages/electron/`) — confirmed by grepping every file in the local 1.74.1 checkout that references it.
**How to avoid:** Treat `node-pty` compiling successfully (verifiable via `yarn theia rebuild:browser` completing and `@theia/terminal` opening a working shell) as the actual proof for D-10. Keep the X11 headers (`xorg.libX11`, `xorg.libxkbfile`) in the `theia` shell as cheap insurance — they cost nothing to include and protect against a future Phase 2 extension pulling in an Electron-shared dependency by accident — but don't block Phase 1 completion on them.
**Warning signs:** Build logs showing `native-keymap` attempted-and-skipped (expected, harmless) vs. `node-pty` actually failing to compile (the real signal to investigate).

### Pitfall 4: `--depth 1` and `--filter=blob:none` are not equivalent for a single old tag, and `blob:none` may be materially slower to start

**What goes wrong:** D-01's "Claude's Discretion" section frames `--depth 1 --branch <tag>` and `--filter=blob:none` as two options to measure and pick between. This session's empirical test (see Environment/clone data below) found `--filter=blob:none` stalled for 5+ minutes without transferring any object data, while plain `--depth 1 --branch <tag>` began streaming objects within seconds and reached 60% of a ~487k-object transfer in about 10 minutes on this session's (bandwidth-constrained) connection.
**Why it happens:** Both variants require the server to walk history back to find the tag and enumerate the ~487k objects reachable from that one commit (`Counting objects: 486742` appeared for both) — `blob:none`'s value is in *not* transferring blob content for objects outside the filter (which matters most for `git log -p`/deep history operations, not a single-commit checkout), while GitHub's server-side negotiation for the filter itself appeared to add material latency in this sandboxed environment.
**How to avoid:** Default to plain `git clone --depth 1 --branch FIREFOX_153_1_0esr_RELEASE https://github.com/mozilla-firefox/firefox.git upstream` for the D-04 documented fetch command, and re-time it on the actual NixOS host before finalizing — this session's sandbox network (1–4 MiB/s, throttled) is not representative of a real workstation's throughput, so treat the *relative* comparison (blob:none stalling vs. depth-1 progressing) as the actionable signal, not the absolute transfer time.
**Warning signs:** A `blob:none` clone showing no `Receiving objects` progress for more than a minute or two — that pattern repeated in this session's test.

## Runtime State Inventory

Not applicable — Phase 1 is greenfield (creates `flake.nix`, `theia/`, and materializes `upstream/` fresh into a repo reset to a clean slate on 2026-08-19). There is no prior renamed/refactored state to inventory. **Nothing found in this category — verified by CONTEXT.md's own "Existing Code Insights: None" statement and confirmed by this session's `git status`/repo layout check.**

## Code Examples

### Minimal `applications/browser/package.json` (Theia 1.74.1, D-07 stock/no-Electron)

```json
{
  "private": true,
  "name": "sourcerer-theia-browser-app",
  "version": "1.74.1",
  "theia": {
    "frontend": {
      "config": {
        "applicationName": "Sourcerer (dev)",
        "preferences": {
          "files.enableTrash": false,
          "security.workspace.trust.enabled": false
        }
      }
    },
    "backend": {
      "config": {
        "frontendConnectionTimeout": 3000
      }
    }
  },
  "dependencies": {
    "@theia/core": "1.74.1",
    "@theia/editor": "1.74.1",
    "@theia/filesystem": "1.74.1",
    "@theia/markers": "1.74.1",
    "@theia/messages": "1.74.1",
    "@theia/monaco": "1.74.1",
    "@theia/navigator": "1.74.1",
    "@theia/preferences": "1.74.1",
    "@theia/process": "1.74.1",
    "@theia/terminal": "1.74.1",
    "@theia/workspace": "1.74.1"
  },
  "devDependencies": {
    "@theia/cli": "1.74.1"
  },
  "scripts": {
    "rebuild": "theia rebuild:browser --cacheRoot ../..",
    "build": "yarn -s rebuild && theia build --app-target=browser --mode development",
    "start": "theia start"
  }
}
```
*Field shape and script names verified against `[VERIFIED: theia/examples/browser/package.json — theia.frontend.config, theia.backend.config blocks; scripts.rebuild = "theia rebuild:browser --cacheRoot ../.."]`; the dependency list itself is the CITED minimal set from theia-ide.org's "Composing Applications" doc, cross-checked as a strict subset of the verified 1.74.1 `examples/browser/package.json` dependency list (every package in this list is present there).* [ASSUMED: this exact 11-package set has not been build-tested this session — the planner should treat "does it actually boot with only these 11" as a verification step, not a certainty; theia-ide.org's doc describes it as the yeoman generator's output, not this specific pinned-version combination.]

### Minimal `.mozconfig` for Phase 1's full-compile proof

```
mk_add_options MOZ_OBJDIR=@TOPSRCDIR@/../objdir
ac_add_options --enable-application=browser
ac_add_options --disable-updater
ac_add_options --without-wasm-sandboxed-libraries
```
*`--disable-updater` mirrors nixpkgs's own `configureFlags` `[VERIFIED: pkgs/build-support/build-mozilla-mach/default.nix — configureFlags includes "--disable-updater"]` and is safe/expected since D-12 defers real update-channel work; `--without-wasm-sandboxed-libraries` per Pitfall 2 above.*

### Root `theia/package.json` workspace shape

```json
{
  "private": true,
  "workspaces": ["applications/*"],
  "resolutions": {
  },
  "engines": {
    "yarn": ">=1.7.0 <2",
    "node": ">=22"
  }
}
```
*`workspaces` array shape verified `[VERIFIED: TheiaIDE/sources/theia-ide/package.json — "workspaces": ["applications/*", "theia-extensions/*"]]`; Phase 1 omits `theia-extensions/*` per D-07 (no `@sourcerer/*` extensions yet) and adds it back in Phase 2.*

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `firefox-esr-unwrapped` as a stable pin | Version-explicit `firefox-esr-153-unwrapped` | nixpkgs currently re-points the alias per ESR line transition | Already captured as D-15; re-confirmed this session — the alias is still present and still resolves differently across channels |
| Manual cbindgen install (`cargo install cbindgen --force`) | Consume `pkgs.rust-cbindgen` via `inputsFrom` | N/A — this is a "use nixpkgs, not Mozilla's generic advice" correction specific to the NixOS context | Removes PITFALLS.md #2's drift risk entirely for as long as `inputsFrom` is used correctly (never overridden by a manually-installed cbindgen higher on `$PATH`) |

**Deprecated/outdated:** Nothing Firefox/Theia-side has changed since STACK.md's 2026-08-19 research; this session's findings are refinements (inputs-vs-recipe distinction, native-keymap scoping, WASM sandboxing) rather than corrections to STACK.md's pinned versions.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 11-package minimal Theia set (`@theia/core`, `editor`, `filesystem`, `markers`, `messages`, `monaco`, `navigator`, `preferences`, `process`, `terminal`, `workspace`) is sufficient to satisfy success criterion 1 ("a stock Theia browser-target IDE loads at a localhost URL") | Standard Stack, Code Examples | Low-medium — if a dependency is missing, `theia build` fails at compile time with a clear missing-import error, not a silent runtime gap; easy to detect and add one more package, but adds a plan iteration |
| A2 | `--without-wasm-sandboxed-libraries` does not prevent a "launchable stock Firefox" (D-11's bar) — RLBox sandboxing is a hardening feature, not a functional requirement for the browser to run | Common Pitfalls #2, Code Examples | Low — this is standard practice for local/dev Firefox builds (widely documented Mozilla workaround), but if Sourcerer later needs the sandboxed codec libraries for a security requirement, this flag would need revisiting (not currently in scope per D-12) |
| A3 | The empirical clone-speed comparison (blob:none stalling vs. depth-1 progressing) generalizes beyond this session's sandboxed network | Common Pitfalls #4 | Low-medium — the *relative* pattern (blob:none adds server-side negotiation overhead for a single-tag fetch) is architecturally plausible and documented as a git behavior, but the planner should still let D-01's "measure on the actual host" leaning stand as the final tiebreaker, not treat this session's numbers as final |
| A4 | `MOZ_OBJDIR=@TOPSRCDIR@/../objdir` (mozconfig syntax) is the correct way to set the object dir from `.mozconfig` rather than exporting `MOZ_OBJDIR` from the shellHook | Code Examples | Low — both are documented `mach`-supported mechanisms; if the mozconfig syntax doesn't resolve `@TOPSRCDIR@` as expected inside a Nix-shell-launched build, falling back to an explicit `export MOZ_OBJDIR=$PWD/objdir` in the shellHook (matching nixpkgs's own approach, which is 100% verified) is a trivial substitution |

## Open Questions

1. **Does the verified 11-package Theia set actually produce a working `theia start` at exactly 1.74.1?**
   - What we know: it's a strict subset of the framework's own verified `examples/browser/package.json` at this exact version, and matches theia-ide.org's documented minimal generator output.
   - What's unclear: whether any of the 11 packages has an undeclared peer/transitive dependency on a 12th package not in this list, specific to the 1.74.1 release (vs. whatever version the doc was written against).
   - Recommendation: the planner should sequence this as an early, fast-failing task (`yarn install && yarn theia build`) before layering on any other Phase 1 work — a missing package surfaces immediately as a clear error.

2. **What is the actual clone time/size on the real NixOS host (not this sandbox)?**
   - What we know: depth-1 clone of the single tag transfers on the order of several hundred MB to ~1GB of packed git objects (this session observed 573MB at 60% of 486,742 objects before research concluded, on a throttled connection — extrapolating to roughly 800MB-1GB total transfer, consistent with CONTEXT.md's independently-stated ~2.5GB *extracted working tree* figure once deltas resolve and files materialize).
   - What's unclear: real-host bandwidth and whether GitHub applies any rate-limiting specific to unauthenticated clones of this large a repo.
   - Recommendation: time the actual D-04 fetch command on the NixOS host during Phase 1 execution and record it in `docs/BUILD.md` for future contributors' expectations.

## Environment Availability

| Dependency | Required By | Available (this research session) | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Network access to `github.com/mozilla-firefox/firefox` | D-02 upstream fetch | ✓ (verified — successful partial clone this session) | — | — |
| Network access to `raw.githubusercontent.com`, `api.github.com` (nixpkgs source reads) | Research verification only, not a Phase 1 runtime dependency | ✓ | — | — |
| `nix` / NixOS host itself | Everything in this phase | Not probed this session (research ran in a non-NixOS sandbox without `nix develop` available) | — | The planner/executor must verify `nix --version` and flake support on the actual target host before executing Phase 1's plan — this is a genuine gap this research could not close from the sandbox it ran in |

**Missing dependencies with no fallback:** none identified from documentation review; the one real gap is that this research session could not itself run `nix develop`/`nix build` to smoke-test the flake, since the sandbox has no local Nix installation. **The plan must include an early task that actually runs `nix flake check`/`nix develop .#theia`/`nix develop .#firefox` on the real host as its first verification step**, since every claim about `inputsFrom` contents above is verified from *reading* the nixpkgs source, not from *evaluating* the flake.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — this phase has no application code, only build tooling. Verification is shell-script-driven smoke tests against the two dev shells. |
| Config file | none — see Wave 0 |
| Quick run command | `nix develop .#theia --command yarn --version && nix develop .#firefox --command mach --version` (shell-entry smoke check) |
| Full suite command | The two documented build sequences in "Installation" above, run end-to-end |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUILD-01 | `nix develop .#theia` + one command boots a stock Theia browser-target app at localhost | smoke | `scripts/smoke-theia.sh` — `nix develop .#theia --command bash -c "yarn install && yarn theia rebuild:browser --cacheRoot . && yarn theia build --app-target=browser --mode development && timeout 30 yarn theia start & curl -sf http://localhost:3000"` (port from Theia's default; adjust to whatever `theia start` actually binds) | ❌ Wave 0 |
| BUILD-02 | `nix develop .#firefox` builds pinned ESR tag into a launchable Firefox, never invoking `mach bootstrap` | smoke | `scripts/smoke-firefox.sh` — `nix develop .#firefox --command bash -c "cd upstream && MOZCONFIG=../.mozconfig ./mach build && ./mach run --version"` plus a `grep -L bootstrap` check over the build log | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** the relevant one of the two smoke scripts above (whichever half of the phase the task touches)
- **Per wave merge:** both smoke scripts, sequentially (they don't share state, but running both confirms neither shell's changes broke the other's isolation)
- **Phase gate:** both full build sequences green (a real `./mach build` full compile and a real `yarn theia rebuild:browser` + `theia start` reachable at localhost) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `scripts/smoke-theia.sh` — covers BUILD-01
- [ ] `scripts/smoke-firefox.sh` — covers BUILD-02
- [ ] `.mozconfig` — must exist before `scripts/smoke-firefox.sh` can run; not a test file but a required fixture
- [ ] No test framework install needed — this phase is infrastructure-only; do not introduce a test runner (e.g. bats, shellspec) for two smoke scripts — plain `bash` + `set -euo pipefail` is sufficient (ponytail: two scripts don't need a framework)

## Sources

### Primary (HIGH confidence — read directly this session)
- `pkgs/build-support/build-mozilla-mach/default.nix` (NixOS/nixpkgs, master branch) — full `buildMozillaMach` recipe: nativeBuildInputs, buildInputs, preConfigure, configureFlags, patches list and version gating
- `pkgs/applications/networking/browsers/firefox/packages/firefox-esr-153.nix` — confirms `version = "153.1.0esr"`, source tarball URL/hash
- `pkgs/by-name/ru/rust-cbindgen/package.nix` — confirms `version = "0.29.4"`, `passthru.tests` includes `firefox-esr-unwrapped`
- `pkgs/top-level/all-packages.nix` (lines ~4003-4020) — confirms default `rustc`/`cargo`/`rustPlatform` resolve to `rust_1_97`
- `pkgs/development/compilers/rust/1_97.nix` — confirms `rustcVersion = "1.97.1"`
- `pkgs/by-name/ya/yarn/package.nix` — confirms `version = "1.22.22"`
- `pkgs/development/web/nodejs/v22.nix` — confirms `version = "22.23.2"`
- `build/moz.configure/init.configure` (mozilla-firefox/firefox, tag `FIREFOX_153_1_0esr_RELEASE`) — confirms `MOZBUILD_STATE_PATH` default resolution
- `build/moz.configure/bootstrap.configure` (same tag) — confirms `--enable-bootstrap` defaults off for non-nightly checkouts
- `build/moz.configure/bindgen.configure` (same tag) — confirms `cbindgen_min_version = Version("0.29.4")`
- `build/moz.configure/rust.configure` (same tag) — confirms minimum-only rustc version enforcement (no upper bound)
- `python/mozboot/mozboot/util.py` (same tag) — confirms `MINIMUM_RUST_VERSION = "1.90.0"`
- `python/mozbuild/mozbuild/nodeutil.py` (same tag) — confirms `NODE_MIN_VERSION = Version("12.22.12")` for Firefox's own build-tooling Node requirement (separate from Theia's Node 22 pin)
- `/home/chris/Vibe Coding/TheiaIDE/sources/theia/examples/browser/package.json` (local reference checkout, pinned 1.74.1) — full dependency list, `theia` config block shape, scripts
- `/home/chris/Vibe Coding/TheiaIDE/sources/theia/dev-packages/application-manager/src/rebuild.ts` — confirms `DEFAULT_MODULES` list
- `/home/chris/Vibe Coding/TheiaIDE/sources/theia/dev-packages/cli/package.json` — confirms `@theia/cli` bin name
- `/home/chris/Vibe Coding/TheiaIDE/sources/theia-ide/package.json` and `applications/browser/package.json` (local reference checkout) — confirms `workspaces`/`resolutions` shape and `theia` config block in a downstream-composed app (not the framework's own example)
- This session's empirical `git clone` test against `github.com/mozilla-firefox/firefox` (both `--depth 1 --branch` and `--filter=blob:none` variants attempted)
- `gsd-tools query package-legitimacy check --ecosystem npm` output for all 12 `@theia/*` packages

### Secondary (MEDIUM confidence)
- Bugzilla #1759544, #1744197 ("Cannot find a wasi sysroot") and #1356541 (`MOZBUILD_STATE_PATH` prompt) — WebSearch-surfaced, cross-checked against the actual `wasiSysRoot`/`WASM_CC` handling read directly in nixpkgs's derivation
- theia-ide.org "Composing Applications" doc (fetched this session) — minimal package list and yeoman generator commands; Node version stated there (`>=18`) is stale per STACK.md's own prior finding
- firefox-source-docs.mozilla.org "Building Firefox On Linux" — 4GB RAM min/8GB+ recommended, 30GB free disk space

### Tertiary (LOW confidence)
- WebSearch synthesis on native-keymap's nixpkgs devShell pattern (`xorg.libxkbfile`, `xorg.libX11`, `pkg-config`, `gnumake`, `python3`) — not independently verified against a specific nixpkgs derivation file this session, but consistent with the already-verified `buildMozillaMach` buildInputs pattern for X11 libraries generally
- "Firefox can be built in less than 10 minutes" (from a WebSearch synthesis of Mozilla's own docs page) — treated skeptically; likely describes incremental/artifact builds, not a first full compile; D-11's own framing ("one-time multi-hour build") is the more credible planning assumption and this research found nothing to contradict it

## Metadata

**Confidence breakdown:**
- Standard stack (versions): HIGH — every version number verified by reading the actual pinned source file, not `npm view`/`nix search`
- Architecture (inputsFrom vs. recipe distinction, Theia workspace shape): HIGH — read directly from nixpkgs's derivation and the local 1.74.1 reference checkout
- Pitfalls (WASM sandboxing, MOZBUILD_STATE_PATH, native-keymap scoping): HIGH for the WASM/state-path findings (read directly from Firefox source + corroborated Bugzilla reports); MEDIUM for the native-keymap Electron-only claim's completeness (confirmed by exhaustive grep of the local checkout, but a future Theia release could change this)
- Environment Availability: LOW-MEDIUM for the flake's actual evaluability — this research could not run `nix develop`/`nix flake check` itself (no local Nix in the research sandbox); the plan must treat "flake actually evaluates on the real host" as an unverified, first-priority execution step

**Research date:** 2026-08-20
**Valid until:** ~30 days for the Theia/Firefox version pins (stable within an ESR/point-release cycle); ~7 days for `nixos-unstable`-sourced package versions (`nodejs_22`, `rustc`, `rust-cbindgen`, `yarn`) since unstable moves continuously — re-verify exact versions immediately before writing `flake.lock` if more than a few days have passed since this research.
