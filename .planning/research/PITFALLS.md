# Pitfalls Research

**Domain:** Branded Firefox-ESR fork hosting a Theia IDE sidecar, developed solo on NixOS
**Researched:** 2026-08-19
**Confidence:** MEDIUM (Firefox/NixOS build mechanics and Theia bug-tracker findings are HIGH-confidence primary sources; fork-maintainer "lessons learned" and solo-dev process claims are web-search MEDIUM — no direct interviews)

## Critical Pitfalls

### Pitfall 1: `mach bootstrap` assumes a mutable FHS system and simply fails on NixOS

**What goes wrong:**
`mach bootstrap` tries to apt/dnf-install toolchain packages, write to system paths, and locate binaries at FHS locations (`/usr/bin`, `/usr/lib`). None of that exists on NixOS. Running the stock bootstrap flow produces cascading, hard-to-diagnose failures rather than one clear error.

**Why it happens:**
Mozilla's bootstrap tooling (`mozboot`) is written for Debian/Fedora/macOS/Windows package managers. NixOS's per-derivation, immutable `/nix/store` model is outside its assumptions, and Mozilla does not officially support NixOS.

**How to avoid:**
Never invoke `mach bootstrap`. Build a Nix dev shell (`mkShell`, `inputsFrom` the nixpkgs `firefox-esr-unwrapped` derivation) that supplies every dependency `mach` needs, then run `mach build`/`mach package` directly inside that shell. This is exactly the strategy PROJECT.md already commits to — treat it as load-bearing, not optional.

**Warning signs:** Any `mach bootstrap` output mentioning `apt`, `dnf`, `sudo`, or a package-manager name; `mach doctor` complaining about missing system packages that `nix-shell` already provides.

**Phase to address:** Boot phase (R2 own build) — the Nix flake's `firefox` dev shell must be proven to build a stock ESR checkout end-to-end before any Sourcerer-specific patches are applied.

---

### Pitfall 2: cbindgen / rustc version pinning drift breaks the Rust/C++ FFI boundary

**What goes wrong:**
Firefox's build requires cbindgen and rustc versions that are mutually compatible — not just individually "recent." `mach bootstrap`'s auto-installed cbindgen can be reported as too old; forcing `cargo install cbindgen --force` to the newest version can then make rustc look too old, or break cbindgen's output entirely. This is a live, recurring bug category in Mozilla's own tracker, not a one-off.

**Why it happens:**
cbindgen generates C headers from Rust code; its output format depends on rustc language features. Firefox's mozconfig pins exact version ranges for a reason, and ad-hoc upgrades of one tool without the other silently break the pairing.

**How to avoid:**
Pin rustc and cbindgen versions together in the Nix flake (exact versions matching what the target Firefox-ESR tag's `taskcluster`/`mozconfig` expects), and never let Nix's `rustc`/`cargo` float independently of what the checked-out Gecko tag was tested against. Re-verify the pinned pair every ESR rebase.

**Warning signs:** Build errors mentioning cbindgen version numbers, or Rust FFI headers failing to generate/parse.

**Phase to address:** Boot phase — part of nailing down the Nix flake's `firefox` shell inputs, re-verified at each 4-weekly ESR rebase (ongoing, not one-time).

---

### Pitfall 3: Artifact builds quietly cap what "own build" can touch

**What goes wrong:**
`--enable-artifact-builds` forbids any change to C, C++, or Rust source anywhere in the tree, any WebIDL definition (even the JS-implemented ones), and `histograms.json`. A change that silently falls into one of those buckets doesn't produce a build error — it produces a build that runs but doesn't reflect the change, or a confusing artifact/source mismatch.

**Why it happens:**
Artifact builds download prebuilt Gecko binaries and only recompile the front-end tree (JS/HTML/XUL/CSS) on top. Anything compiled to machine code is frozen at the artifact's version.

**How to avoid:**
This is actually a good fit for Sourcerer's stated plan (PROJECT.md: "we never modify compiled Gecko code") — but the constraint must stay true by design, not by accident. Any future feature request that would need a `nsI*` interface change, a new WebIDL binding, or Rust-side plumbing needs a flagged decision to switch that build to a full compile (in CI, not local dev) before work starts, not discovered after a broken artifact build.

**Warning signs:** A patch touches anything under `dom/`, `toolkit/components/*.rs`, `*.webidl`, or `Histograms.json`; `mach build` "succeeds" but the change has no effect at runtime.

**Phase to address:** Boot phase — document the artifact-build boundary in `sourcerer/INTERNAL-APIS.md` alongside the anti-corruption-layer touchpoints, so it's checked at the same review gate.

---

### Pitfall 4: Theia's stock backend has no authentication — the localhost sidecar is an open door by default

**What goes wrong:**
Theia's default backend has no built-in password/token auth on its HTTP surface. Worse, CVE-2026-61891 (pre-1.73.1) shows the connection token that *does* exist is enforced only on the WebSocket upgrade, not on plain HTTP GET — so `@theia/filesystem`'s HTTP download endpoints let an unauthenticated request read arbitrary files readable by the backend process (SSH keys, credential files) even with token auth nominally "on."

**Why it happens:**
Theia is designed to be fronted by a reverse proxy in server deployments (Theia Cloud, Docker images) where TLS/auth is added externally. A localhost-embedded sidecar has no such proxy layer unless one is built.

**How to avoid:**
Sourcerer's `TheiaService.sys.mjs` supervisor must bind the backend to `127.0.0.1` only (never `0.0.0.0`), generate a fresh random token per process launch, and pass it exclusively through the chrome-privileged bridge — never via a URL an ordinary web tab or extension content script could read. Pin to a Theia release ≥1.73.1 and re-verify this specific CVE class (token-enforced-on-HTTP-not-just-WS) against the changelog at every re-pin, since it's exactly the kind of regression that could resurface.

**Warning signs:** Any code path that constructs the Theia URL with the token as a visible query string logged to console/devtools; sidecar bound to a non-loopback interface; Theia pinned to a pre-1.73.1 tag.

**Phase to address:** Backend Supervisor build step (component 3 in the architecture doc) — token handling and bind-address are core supervisor design, not an afterthought. Re-verify at every Theia re-pin (ongoing).

---

### Pitfall 5: Theia's backend leaves orphaned/zombie child processes on shutdown

**What goes wrong:**
Killing Theia's main backend process does not reliably kill its children — specifically the plugin-host process, which keeps running after the backend receives SIGTERM (tracked upstream: eclipse-theia/theia #8946, #6685). The same root-cause pattern (parent doesn't reap/cascade-kill children) is independently documented across VS Code Server and code-server, so it's a structural pattern in this class of Node-backend-plus-child-processes architecture, not a Theia-specific bug that will get fixed soon.

**Why it happens:**
Node's `child_process` doesn't automatically propagate signals to grandchildren; a plain `SIGTERM` to the top-level backend PID doesn't reach a process tree unless the supervisor explicitly kills the process group/session.

**How to avoid:**
`TheiaService.sys.mjs` must launch the Theia backend in its own process group (or session) and kill the whole group on quit/crash-restart, not just the top PID. Health-check the group, not just the parent PID, when deciding whether to restart. Add an explicit "kill leftover Theia processes from a previous crashed run" check on Sourcerer startup (matching by a marker in the process's argv or an env var Sourcerer sets), since a hard-crash of the browser itself (not just the backend) can leave the sidecar tree running with no supervisor left to clean it up.

**Warning signs:** `ps aux | grep theia` showing backend or plugin-host processes after Sourcerer quits; growing resource usage across dev sessions; port-in-use errors on the next Sourcerer launch because the old backend is still holding the port.

**Phase to address:** Backend Supervisor build step (component 3) — process-group lifecycle is core supervisor logic, testable in isolation before the bridge/GUI work starts.

---

### Pitfall 6: Theia has no enforced stable/experimental API boundary — any re-pin can break `@sourcerer/*` extensions

**What goes wrong:**
Theia's own maintainers acknowledge that nearly all of its API surface is technically public with no compiler-enforced stability tier; a major release is only required when a documented-stable API breaks, but most of the surface isn't formally documented as stable at all. Breaking-change discipline relies on PR authors manually writing `doc/Migration.md` entries — a social process, not a type-checked guarantee. `eclipse-theia/theia #8194` documents an API change shipping in `@theia/core` without even a version bump.

**Why it happens:**
Theia grew from files scattered across the tree without a single curated `index.ts` public entry point, so "internal" vs "public" was never a hard boundary — extension authors reach for whatever import resolves, and so does Theia's own example code.

**How to avoid:**
Maintain `INTERNAL-APIS.md` (already planned per R3) as a strict allowlist: every `@sourcerer/*` import from `@theia/*` gets logged there with the exact package/symbol, and a new import is a deliberate decision, not an incidental `import` statement. Before each Theia re-pin, diff the allowlist against the new release's `doc/Migration.md` and grep the new `@theia/*` source for renamed/removed symbols on the allowlist before touching Sourcerer code. Prefer extension-point/contribution-based APIs (documented, contribution-oriented) over reaching into service internals.

**Warning signs:** An `@sourcerer/*` extension importing from a path containing `/browser/` or `/node/` internals rather than a package's public `index`; a Theia re-pin that compiles clean but changes runtime behavior silently (no compiler error because the API is just loosely typed, not removed).

**Phase to address:** Extension-based internals step (R3) — the allowlist discipline has to exist from the first `@sourcerer/*` extension, not retrofitted after several exist.

---

### Pitfall 7: Browser-target vs node-runtime native module ABI mismatch for the sidecar

**What goes wrong:**
Native Node addons (Theia's `node-pty` fork, any LSP-adjacent native dep) are compiled against a specific `NODE_MODULE_VERSION` ABI. A binary built against one Node version fails to load under another with an error that's clear in isolation but easy to introduce accidentally — e.g. the dev shell's Node version drifting from the bundled/packaged Node version, or CI building with a different Node than the one actually bundled into the installer. Theia's own tracker separately documents that browser-target and electron-target native builds clobber each other's build cache (`yarn theia rebuild:browser` then `rebuild:electron` is required to switch cleanly) — a reminder that "which target was this native module built for" is a recurring class of bug in this exact framework, even though Sourcerer's architecture avoids the Electron half of that specific problem by never using an Electron target.

**Why it happens:**
node-gyp bakes the target Node ABI into the compiled `.node` binary at build time; nothing at require-time re-validates it beyond a runtime crash.

**How to avoid:**
Pin one exact Node version for the entire Theia sidecar toolchain — the Nix `theia` dev shell, the CI build, and the bundled runtime shipped inside Sourcerer must all resolve to the identical Node build. Rebuild native modules (`yarn theia rebuild:browser` — the correct target since the sidecar is a Node backend serving a browser-target frontend, never Electron) as an explicit CI step keyed to that pinned version, and fail the build if the resolved Node version at rebuild time doesn't match the pin.

**Warning signs:** `The module '.../pty.node' was compiled against a different Node.js version` at sidecar startup; sidecar works from `yarn watch` in the dev shell but fails when launched from the packaged Sourcerer build (different Node source).

**Phase to address:** Backend Supervisor / bundling step — pin Node once in the Nix flake `theia` shell and thread that same pin through to packaging; verify at CI, not by hand.

---

### Pitfall 8: Patch-set drift makes the fork unrebaseable

**What goes wrong:**
A Firefox-fork patch set that isn't kept small and cleanly separated from upstream files accumulates merge conflicts on every ESR point release until a rebase becomes a multi-day archaeology exercise, at which point maintainers either freeze on an old ESR (falling behind on security patches) or do a disruptive from-scratch reapplication.

**Why it happens:**
It's tempting to directly edit upstream files in place rather than isolating changes; each direct edit is a future rebase conflict. Successful forks (Zen: absorbed a Mozilla security drop 4 days after release, no separate fork-level patching pass) stay lean specifically by minimizing direct upstream-file edits and pushing customization into new, isolated files/directories wherever possible.

**How to avoid:**
Follow the Zen model already chosen in the architecture doc (`upstream/` + `patches/` + `sourcerer/`) literally: prefer new files under `sourcerer/` over editing files under `upstream/`; when an upstream file edit is unavoidable, keep the diff minimal and single-purpose so `git rebase`/patch-apply conflicts are small and mechanical. Automate the rebase in CI and fail loudly (already planned) rather than deferring it — the whole point of the 4-weekly cadence is catching drift while each individual rebase is still small.

**Warning signs:** A CI rebase job accumulating conflict-resolution commits rather than clean fast-forwards; growing count of files under `patches/` that touch the same upstream file as a previous unrelated patch; the rebase job silently disabled or skipped for more than one release cycle.

**Phase to address:** Boot phase sets the repo structure; ongoing discipline enforced by the CI rebase job for the life of the project — flag as a standing operational risk, not a one-time build item.

---

### Pitfall 9: ESR major-version transitions land multiple breaking changes at once

**What goes wrong:**
Point releases within one ESR line are mechanically safe, but the jump to the next ESR major (e.g. 115→128) bundles several breaking changes simultaneously — redesigned UI dialogs, consolidated policy options, changed packaging — deferred and released together rather than incrementally. A fork's `SourcererAPI.sys.mjs` anti-corruption layer and any UI re-hosting work (permission prompts, downloads panel) can break in several places at once on that one transition, unlike the ~4-weekly point-release rebases.

**Why it happens:**
Mozilla batches larger internal refactors at ESR major boundaries specifically because that's the one moment enterprise deployments (and forks) expect to re-test.

**How to avoid:**
Treat each ESR major transition as its own scheduled work item, not a routine rebase — budget explicit re-test time against the full `INTERNAL-APIS.md` touchpoint catalogue, and read Mozilla's ESR release notes for the target major version before starting the rebase, not after it fails.

**Warning signs:** A routine rebase PR touching far more files than a typical ~4-weekly point-release rebase; CI rebase job failing in multiple unrelated subsystems simultaneously.

**Phase to address:** Not a v4.0 build-phase item (v4.0 pins one ESR tag and never crosses a major boundary) — flag explicitly for whichever future milestone first crosses an ESR major version, so it isn't budgeted like a routine point-release rebase.

---

### Pitfall 10: Scope creep into custom chrome/GUI work during v4.0

**What goes wrong:**
PROJECT.md is explicit that v4.0's entire GUI is default Theia full-window with only a rename (R1) — no tab strip, toolbar, URL bar, or panel work. The architecture doc's own "Build order" section describes a 6-milestone GUI rebuild (unified tab strip, bridge, re-hosted extension UI, AI sidebar) that is tempting to start pulling forward once the Theia sidecar is running, especially for a solo developer who designed that whole roadmap and can see the appeal of the next piece.

**Why it happens:**
Solo-maintainer projects fail primarily to burnout and unchecked scope creep from immediately building appealing ideas rather than triaging them against the current milestone's actual finish line — a documented pattern independent of this specific project.

**How to avoid:**
Treat "Out of Scope" in PROJECT.md as a hard gate re-checked at every phase transition, not just at kickoff. Any urge to start on tab-strip/bridge work before v4.0's daily-drivable-dev-build bar is met should become a backlog note in the architecture doc's existing 6-milestone build order, not an in-flight scope change.

**Warning signs:** A v4.0 phase branch touching `browser.xhtml`/chrome XUL/XHTML files, or any work on the Theia bridge's activate/list protocol beyond what R4b (URI-per-tab) strictly requires.

**Phase to address:** Every phase transition (`/gsd-transition`) — re-check Out of Scope against actual diff content, not just intent, each time.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|-----------------|
| Direct edits to upstream Firefox files instead of isolated `sourcerer/` additions | Faster to write the first time | Every such edit is a future rebase conflict; compounds every ~4 weeks | Only when Firefox truly offers no extension point (rare) — log it in `INTERNAL-APIS.md` when it happens |
| Skipping the Theia token/bind-address hardening because "it's only localhost, only my dev machine" | Saves supervisor design time up front | CVE-2026-61891-class file-read vulnerability is live on the exact backend this project bundles; any other process/tab on the machine can hit an unauthenticated localhost port | Never — this is a v4.0 baseline requirement, not deferrable polish |
| Importing a convenient Theia internal symbol instead of routing through a documented extension point | Ships the feature today | Silent breakage on the next re-pin with no compiler error (Theia's API has no enforced stability tier) | Never for anything that ships; acceptable only in a disposable spike explicitly thrown away before merge |
| Letting the CI ESR-rebase job go red and deferring the fix | Keeps shipping other work this week | Drift compounds; a skipped cycle turns a mechanical rebase into an archaeology project | Never beyond one release cycle — treat a red rebase job as a stop-the-line signal |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Theia backend ↔ Firefox chrome supervisor | Trusting a single top-level PID kill to tear down the backend | Launch in its own process group/session; kill the group; verify no leftover PIDs on next Sourcerer startup |
| Theia backend token | Passing the token in a URL that lands in browser history, devtools network panel, or logs | Pass the token only through the chrome-privileged JSWindowActor bridge, never as a plain query string a content-privileged context could observe |
| node-gyp native modules (node-pty) | Rebuilding for whichever target was worked on last and assuming the other target still works | Explicit `rebuild:browser` step keyed to the pinned Node version, run in CI, not "whatever happened to be in the cache" |
| ESR upstream tag | Treating a routine ~4-week point-release rebase and an ESR-major-version rebase as the same size of task | Budget ESR-major transitions as their own scheduled work item against the full `INTERNAL-APIS.md` catalogue |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Zombie Theia child processes accumulating across dev-session restarts | Growing memory/CPU from `<defunct>`/orphaned plugin-host processes; port-in-use errors on relaunch | Process-group kill + startup cleanup check (Pitfall 5) | Noticeable within a single day of iterative `yarn watch` + Sourcerer restart cycles during Theia build-out |
| Artifact-build/source mismatch silently serving stale compiled Gecko behind a rebuilt front-end | A front-end fix appears to have "no effect" | Keep artifact hash pinned to the exact upstream tag; re-fetch artifacts on every `upstream/` bump | As soon as `upstream/` moves without re-syncing the artifact fetch |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Binding the Theia backend to `0.0.0.0` instead of `127.0.0.1` | Any device on the same network segment can reach the unauthenticated-by-default backend | Supervisor hardcodes loopback bind; verify in code review, not just docs |
| Relying on Theia's connection token alone without confirming it covers plain-HTTP endpoints on the pinned version | CVE-2026-61891-class arbitrary file read even with "token auth on" | Pin ≥1.73.1, and independently verify (don't just trust the changelog) that HTTP GET endpoints enforce the token, since this exact enforcement gap already shipped once |
| Exposing the Theia bridge's `postMessage` channel without validating the sender's origin | A malicious web tab could forge bridge messages if the channel isn't scoped correctly | Bridge only from the chrome-privileged JSWindowActor pair, never a content-script-reachable `window.postMessage` listener on an ordinary page |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Sourcerer's rebrand touching only visible strings but leaving Firefox's internal profile/app-id unchanged | Auto-update or profile-migration logic silently references the wrong app identity, or collides with a real Firefox/Firefox-ESR install on the same machine | Rebrand at the `moz-app-name`/`vendor`/update-URL/profile-directory level (Zen/LibreWolf pattern), not just the visible name — verify no shared profile directory with stock Firefox |
| Treating the Theia full-window GUI as "done" once it boots, without checking welcome tab / about dialog / window title are actually rebranded | R1 looks satisfied by icon+name alone while Theia's own welcome/about surfaces still say "Theia" | Explicitly check Theia's welcome tab and about dialog against R1's checklist, not just the outer window chrome |

## "Looks Done But Isn't" Checklist

- [ ] **Rebrand (R1):** Verify Theia's welcome tab and about dialog are rebranded, not just window title/icon/installer name — Theia ships its own "About" surface that's easy to miss.
- [ ] **Own build (R2):** Verify the Nix `firefox` shell builds a stock ESR checkout with zero Sourcerer patches applied, before layering any patches — isolates "is this a Nix problem" from "is this a patch problem."
- [ ] **Backend Supervisor:** Verify a hard-kill of Sourcerer (SIGKILL to the top process, not a clean quit) leaves zero orphaned Theia/plugin-host processes — the clean-quit path is not the one that actually tests process-group handling.
- [ ] **Token auth:** Verify the token is enforced on the plain-HTTP endpoints (file download), not just the WebSocket upgrade — confirm this doesn't regress on the pinned Theia version, since it already regressed once upstream.
- [ ] **Extension-based internals (R3):** Verify `INTERNAL-APIS.md` actually lists every `@theia/*` import used by `@sourcerer/*` code — grep the source and diff against the doc, don't trust it was kept up to date by hand.
- [ ] **Sidecar lockstep:** Verify the packaged Node version bundled with the installer matches the Node version native modules were last rebuilt against — a CI check, not a manual memory item.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Patch-set drift makes a rebase fail | HIGH | Bisect `patches/` to find which patch touches the conflicting upstream file; consider re-deriving that patch against the new upstream tag from scratch rather than manually resolving conflict markers, since a hand-resolved conflict often hides a semantic mismatch |
| Theia API broke silently after a re-pin | MEDIUM | Diff the previous and new `@theia/*` releases' `doc/Migration.md`; grep `INTERNAL-APIS.md` allowlist against the new source tree for renamed/removed symbols; bisect which `@sourcerer/*` extension regressed using Theia's own example apps as a known-good baseline |
| Zombie Theia processes have accumulated across many past sessions | LOW | One-time cleanup script matching the sidecar's argv marker, run manually; then verify the process-group fix (Pitfall 5) actually prevents recurrence before trusting it fixed |
| Artifact-build cache became inconsistent with source | LOW | `mach clobber` and re-fetch artifacts; artifact builds are cheap enough (minutes) that a full re-fetch is the pragmatic fix over debugging the mismatch |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| `mach bootstrap` FHS assumptions break on NixOS | Boot phase (R2) | Nix `firefox` dev shell builds stock ESR checkout with zero mach bootstrap invocation |
| cbindgen/rustc version drift | Boot phase (R2), re-verified every ESR rebase | Pinned versions recorded in flake; CI rebase job fails loudly on mismatch |
| Artifact-build ceiling (no C/C++/Rust/WebIDL changes) | Boot phase (R2) | Documented boundary in `INTERNAL-APIS.md`; CI/review gate flags any patch touching forbidden paths |
| Theia backend has no auth by default | Backend Supervisor step | Token generation + loopback bind + HTTP-endpoint enforcement verified against pinned Theia version ≥1.73.1 |
| Orphaned/zombie Theia child processes | Backend Supervisor step | Hard-kill test leaves zero leftover PIDs |
| No enforced stable/experimental Theia API tier | Extension-based internals step (R3) | `INTERNAL-APIS.md` allowlist diffed against source at every re-pin |
| Native module ABI mismatch (node-pty) | Backend Supervisor / bundling step | CI rebuild step keyed to one pinned Node version across dev shell, CI, and packaged runtime |
| Patch-set drift / unrebaseable fork | Boot phase sets structure; enforced every ~4-weekly rebase for project lifetime | CI rebase job green; `patches/` stays small and single-purpose |
| ESR major-version transition breaking changes | Not in v4.0 (single ESR tag); flagged for the first future milestone crossing a major | Explicit scheduled re-test against `INTERNAL-APIS.md`, budgeted separately from routine rebases |
| Scope creep into GUI/chrome work | Every phase transition | Diff each phase's actual file changes against PROJECT.md Out of Scope, not just stated intent |

## Sources

- [Firefox artifact builds documentation](https://firefox-source-docs.mozilla.org/contributing/build/artifact_builds.html) — HIGH (official docs)
- [Bugzilla 1498267 — cbindgen provided with mach bootstrap is too old](https://bugzilla.mozilla.org/show_bug.cgi?id=1498267) — HIGH (primary source, Mozilla tracker)
- [Bugzilla 1528226 — rustc version should be checked before cbindgen](https://bugzilla.mozilla.org/show_bug.cgi?id=1528226) — HIGH
- [Bugzilla 1739582 — mach bootstrap fails to run](https://bugzilla.mozilla.org/show_bug.cgi?id=1739582) — HIGH
- [NixOS/nixpkgs firefox build failure issues](https://github.com/nixos/nixpkgs/issues/468479) — HIGH (primary source)
- [eclipse-theia/theia #8946 — Orphaned processes after killing the backend](https://github.com/eclipse-theia/theia/issues/8946) — HIGH (primary source)
- [eclipse-theia/theia #6685 — Theia leaves zombie processes behind](https://github.com/eclipse-theia/theia/issues/6685) — HIGH
- [eclipse-theia/theia #5676 — electron/browser target have to be rebuilt for both to work](https://github.com/eclipse-theia/theia/issues/5676) — HIGH
- [eclipse-theia/theia #8194 — API change in @theia/core without version change](https://github.com/eclipse-theia/theia/issues/8194) — HIGH
- [eclipse-theia/theia doc/api-management.md](https://github.com/eclipse-theia/theia/blob/master/doc/api-management.md) — HIGH (official docs)
- [CVE-2026-61891 — TheHackerWire](https://www.thehackerwire.com/vulnerability/CVE-2026-61891/) — MEDIUM (secondary aggregator of a real CVE; corroborated by Theia's own security-fix history pattern)
- [Zen Browser 1.21.9b security-patch turnaround coverage](https://www.linuxcompatible.org/story/zen-browser-1219b-ships-with-firefox-1530-and-a-44cve-security-patch) — MEDIUM (community/press coverage, not primary Zen documentation)
- [zen-browser-flake (NixOS packaging precedent)](https://github.com/youwen5/zen-browser-flake) — MEDIUM
- [Electron native module ABI mismatch — electron/rebuild](https://github.com/electron/rebuild) — HIGH (official Electron docs/tooling)
- [Project Red Flags for the Solo Dev](https://deliciousbrains.com/project-red-flags-for-the-solo-dev/) — MEDIUM (practitioner blog, general software domain not fork-specific)

---
*Pitfalls research for: Branded Firefox-ESR fork hosting Eclipse Theia IDE (Sourcerer v4.0)*
*Researched: 2026-08-19*
