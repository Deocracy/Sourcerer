# Stack Research

**Domain:** Firefox-ESR fork hosting Eclipse Theia IDE (browser+IDE hybrid desktop product)
**Researched:** 2026-08-19
**Confidence:** HIGH (all pins verified against live upstream sources — GitHub mirror tags, nixpkgs source, Theia release package.json — not training-data recall)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Firefox ESR | **153.1.0esr**, tag `FIREFOX_153_1_0esr_RELEASE` | Browser substrate (`upstream/`) | ESR 153 became the current ESR line on **2026-07-21**, displacing ESR 140 (EOL **2026-09-29**). Confirmed live on the canonical git mirror `mozilla-firefox/firefox` (branch `esr153`; tag verified present via GitHub API). Pinning 140 now would mean rebasing onto 153 within weeks of shipping — pin 153 from day one. ESR 115 also still exists (EOL March 2027) but is the legacy/China-market line, not the one to build against. |
| Eclipse Theia | **v1.74.1** | IDE substrate, browser-target app | **The local reference (`/home/chris/Vibe Coding/TheiaIDE/sources/`) is already current** — v1.74.1 shipped 2026-08-06, is the latest tagged release as of this research (verified against `eclipse-theia/theia` releases and the EclipseSource "News and Noteworthy" post). v1.74 added Perspectives and an "AI First" layout — irrelevant to v4.0 scope (R1–R4b) but confirms the release is actively maintained, not stale. No newer tag to chase. |
| Node.js | **22.x** (floor) / **24.x** (nixpkgs default) | Runtime for Theia backend + build toolchain | Verified directly from `eclipse-theia/theia` v1.74.0 `package.json`: `"engines": { "node": ">=22" }`, docs state "Node 24 is the recommended default." nixpkgs `nodejs` now aliases to `nodejs_24`; `nodejs_22` is a separate attribute. Pin **`nodejs_22`** in the `theia` Nix dev shell for the safer, longer-supported floor (matches PROJECT.md's existing plan) — `nodejs_24` is a fine alternative if you'd rather track Theia's own recommended default. |
| Yarn Classic | **1.x** (`>=1.7.0 <2`) | Package manager for the Theia app workspace | This is a genuine two-answer question, resolved: the **Theia framework repo itself** (`eclipse-theia/theia`) has moved its internal build to npm workspaces + Lerna — that's an internal detail of building Theia core, not relevant to you. The **downstream "compose a Theia app" path** — `theia-ide/theia-ide` (the actual Theia IDE product, closest analog to what Sourcerer is doing) and the official theia-ide.org "Composing Applications" guide — both explicitly pin `"yarn": ">=1.7.0 <2"` and say "we are going to use yarn instead of npm (Theia default)." Since Sourcerer composes `@theia/*` + `@sourcerer/*` exactly like theia-ide does, **Yarn Classic 1.x is correct**, matching PROJECT.md's existing assumption. Gotcha: Node 22/24's `corepack enable` only shims Yarn Berry by default — install Classic explicitly (nixpkgs `yarn` package, which is Classic, or `npm install -g yarn@1.22.22`), don't rely on corepack. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@theia/cli` | matches pinned Theia release (1.74.x) | Scaffolds/builds the Theia app workspace (`theia build`, `theia start`) | Always — this is how a browser-target Theia app is assembled from `@theia/*` packages |
| `node-gyp` (transitive, via `@theia/node-pty` etc.) | whatever ships with pinned Node | Compiles native Node addons Theia depends on (terminal PTY, keymap capture) | Automatic during `yarn install` — needs the `theia` dev shell's C toolchain, not the `firefox` shell's |
| `nixpkgs` `yarn` | Classic 1.22.x (nixpkgs attribute is Classic, not Berry) | Provides yarn without corepack friction | In the `theia` Nix dev shell |
| `buildMozillaMach`-derived toolchain (rustc, cbindgen, nasm, clang/llvm, python3, cargo, gtk3, dbus, pkg-config…) | whatever nixpkgs `firefox-esr-153-unwrapped` pins | Native Gecko build/link toolchain | Consumed via `inputsFrom` in the `firefox` Nix dev shell — see NixOS section below, don't hand-assemble this list |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `surfer` (zen-browser/surfer) | Firefox-fork build/patch tool: downloads Firefox source, applies `.patch` files via `patches.sh`, wraps `mach` | Worth adopting or cribbing directly — see Zen vs Floorp comparison below. It's a small TS/Node CLI (own `package.json`), not a heavyweight framework. |
| Zen's `sync-upstream.yml` + `sync-external-patches.yml` GitHub Actions | Rebase CI pattern: pulls new upstream Firefox revision, reapplies patch stack, fails loudly on conflict | This is exactly the "CI that rebases on each ESR point release and fails loudly on conflicts" behavior R2 asks for — crib the workflow shape, point it at `esr153` instead of Zen's rapid-release branch |
| `mach` (via nixpkgs `buildMozillaMach`, not `mach bootstrap`) | Firefox build driver | `mach bootstrap` assumes apt/dnf-style system package installation and does not work on NixOS (confirmed — this is why nixpkgs ships its own `buildMozillaMach` derivation that supplies every dependency `mach bootstrap` would otherwise fetch/install) |

## Installation

```bash
# Theia dev shell (yarn workspace)
nix develop .#theia   # provides nodejs_22, yarn (classic), python3, pkg-config, stdenv.cc, libX11/libxkbfile (native-keymap)
yarn install
yarn theia build      # or: yarn --cwd applications/browser build

# Firefox dev shell (never nix-build the tree; mach drives it impurely)
nix develop .#firefox  # inputsFrom = [ pkgs.firefox-esr-unwrapped ]; gives rustc/cbindgen/nasm/clang/python3/cargo/gtk3/dbus/pkg-config
# .mozconfig: ac_add_options --enable-artifact-builds
./mach build
./mach run
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Firefox ESR 153 | Firefox ESR 140 | Only if you needed to ship *this week*, before 153's point-release history has accumulated — not a real option here since 140 is 6 weeks from EOL |
| Zen's `surfer` + workflow pattern as template | Floorp's workflow set | Floorp's `.github/workflows` are packaging/release-oriented (`assemble-release-bundle`, `publish_alpha`, `publish_release`, PPA) with no equivalently-named upstream-sync/rebase workflow visible at the top level — harder to crib the specific "rebase on new upstream, fail loudly on conflict" mechanic R2 asks for. Also note: **Zen itself currently tracks rapid-release Firefox (154.0), not ESR** — you're cribbing its *tooling shape* (surfer + sync-upstream CI), not its exact branch target; `surfer.json`/CI needs repointing at `esr153` source tarballs/branch. |
| Yarn Classic 1.x | npm workspaces | Only if you were building Theia core itself (that's genuinely npm+Lerna now) — irrelevant since you consume `@theia/*` as dependencies, you don't rebuild the framework |
| `nodejs_22` | `nodejs_24` | If you want to track Theia's own recommended default and don't need the longer Node 22 support tail; both satisfy Theia's `>=22` floor |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `mach bootstrap` on NixOS | Assumes apt/dnf system package installation; fails/conflicts with Nix's immutable, non-FHS model | `nix develop` shell with `inputsFrom = [ pkgs.firefox-esr-unwrapped ]`, then run `mach build`/`mach run` directly (skip the bootstrap step entirely — the shell already has everything `mach bootstrap` would install) |
| `nix build`-ing the Theia yarn workspace as a Nix derivation | `node-gyp` native module compilation (`@theia/node-pty`, native-keymap) needs network access to fetch matching Node headers; this is fine in an impure `nix develop` shell but fights the Nix sandbox in a pure build | Treat the Theia workspace like any other impure Node project: `nix develop` for the toolchain, plain `yarn install`/`yarn build` for the actual package build — no node2nix/npm2nix packaging attempt for v4.0 |
| `corepack enable` alone for Yarn on Node 22/24 | Corepack's default shims target Yarn Berry; Classic (`1.x`, pinned by theia-ide) isn't what you get | Install Yarn Classic explicitly — nixpkgs `yarn` package (already Classic) in the `theia` dev shell, or `npm install -g yarn@1.22.22` |
| Firefox ESR 140 as the pin | 6 weeks from EOL (2026-09-29) as of this research; you'd be rebasing to 153 almost immediately | Pin ESR 153 now |
| Assuming `mach artifact` fetches transparently on a patched ESR checkout | Artifact fetch resolves by **exact upstream revision**; once you've applied frontend patches your working tree's revision no longer matches any Taskcluster-built artifact set | Pin `MOZ_ARTIFACT_REVISION` (or equivalent mozconfig setting) to the **last unmodified upstream revision** the patch stack is based on, not your patched HEAD — since your patches are frontend-only (JS/XHTML/CSS), the C++ binary artifact from that base revision remains valid underneath them |

## Stack Patterns by Variant

**If iterating on Theia-side work only (R1 Theia-side, R4a, R4b):**
- Use `yarn watch` against the standalone browser-target Theia app at `localhost:<port>` in any ordinary browser
- No Firefox build in the loop at all — this is the fast inner loop; only touch the `firefox` shell when testing the actual embedded/supervised sidecar behavior

**If iterating on Firefox-side work (R2, R3 Firefox side, R4b's `SourcererAPI.sys.mjs`):**
- Use `--enable-artifact-builds` — you never modify compiled Gecko code, so this is minutes not hours and sidesteps most of the NixOS C++/Rust toolchain friction
- Full (non-artifact) compiles are CI-only, mirroring the Zen/Floorp pattern of local artifact/fast iteration + CI full builds for release candidates

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| Theia v1.74.1 | Node `>=22`, recommended `24` | Verified directly from the v1.74.0 tag's `package.json` `engines` field — do not trust older Theia docs pages that still say `node: ">=18"` (theia-ide.org's Composing Applications guide is stale on this specific number; the pinned release's own `package.json` is authoritative) |
| Yarn Classic `>=1.7.0 <2` | Node `>=22` | Yarn Classic is unmaintained upstream but functionally fine on modern Node; the risk is tooling assumptions (corepack), not Yarn itself breaking |
| Firefox ESR 153.1.0esr (nixpkgs `firefox-esr-153-unwrapped`) | nixpkgs `nixos-unstable` as of research date | nixpkgs already tracks `firefox-esr = firefox-esr-153` as the default `firefox-esr` attribute; `firefox-esr-140`/`firefox-esr-140-unwrapped` still exist in parallel for the outgoing line — don't accidentally pin the old attribute name |
| `@theia/node-pty` / native-keymap native modules | Need `libX11`, `libxkbfile` dev headers + `python3` + C toolchain on Linux | Add to the `theia` Nix dev shell's `buildInputs`/`nativeBuildInputs`, distinct from the `firefox` shell's toolchain |

## Sources

- `eclipse-theia/theia` GitHub — releases list, v1.74.0 `package.json` (`engines`), v1.74.1 tag date — HIGH confidence, primary source
- EclipseSource "Eclipse Theia 1.74 Release: News and Noteworthy" (2026-08-11) — HIGH confidence, official project blog
- `theia-ide/theia-ide` GitHub `package.json` (master) — HIGH confidence, primary source for the yarn-vs-npm composing-app answer
- theia-ide.org "Composing Applications" doc — MEDIUM-HIGH (confirms yarn recommendation; its Node version number is stale, superseded by the actual v1.74 `engines` field)
- `mozilla-firefox/firefox` GitHub (canonical Firefox mirror since 2025-04-30 migration off Mercurial) — branches (`esr153`, `esr140`, `esr128`, `esr115`) and tags (`FIREFOX_153_1_0esr_RELEASE` verified present) queried directly via GitHub API — HIGH confidence, primary source
- endoflife.date/firefox and whattrainisitnow.com/release/?version=esr — HIGH confidence, cross-checked ESR 153 current / ESR 140 EOL 2026-09-29 / ESR 115 EOL 2027-03 dates against each other and against the mirror's own branch list
- `NixOS/nixpkgs` `pkgs/top-level/all-packages.nix` and `pkgs/applications/networking/browsers/firefox/packages/firefox-esr-153.nix` (fetched directly via `gh api`) — HIGH confidence, primary source for `firefox-esr` attribute aliasing and the exact upstream tarball/version it pins (153.1.0esr, matching the git tag above)
- `NixOS/nixpkgs` `pkgs/development/web/nodejs/` directory listing — HIGH confidence, confirms `nodejs_22`/`nodejs_24`/`nodejs_26` attributes exist and default `nodejs = nodejs_24`
- Mozilla `firefox-source-docs.mozilla.org/contributing/build/artifact_builds.html` — MEDIUM confidence (official doc, but silent on ESR-branch-specific behavior; the revision-matching caveat is inferred from how artifact fetch is documented to work, not an explicit ESR statement — flagged as a build-time smoke-test item, not a blocker)
- `zen-browser/desktop` and `zen-browser/surfer` GitHub repos (`.github/workflows` listing, `surfer` `package.json`/README) — HIGH confidence for repo/workflow structure; MEDIUM confidence that Zen currently tracks rapid-release 154.0 rather than ESR (stated in repo metadata, not independently re-verified against a second source)
- `Floorp-Projects/Floorp` GitHub `.github/workflows` listing — HIGH confidence (directly enumerated), used for the negative comparison (no equivalent named rebase-CI workflow visible)
- ghacks.net "Firefox Switches to Two-Week Release Cycle Starting September 2026" (2026-07-14) — MEDIUM confidence (single source, but corroborated by the ESR-vs-rapid-release distinction already visible in the mirror's branch structure); confirms the September 2026 rapid-release cadence change does **not** alter ESR's own release cadence

---
*Stack research for: Firefox-ESR fork hosting Eclipse Theia IDE*
*Researched: 2026-08-19*
