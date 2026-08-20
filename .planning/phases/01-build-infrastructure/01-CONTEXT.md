# Phase 1: Build Infrastructure - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning

<domain>
## Phase Boundary

A Nix flake at the repo root exposing two dev shells — `theia` and `firefox` —
such that a developer on the NixOS host builds and runs both halves of
Sourcerer from a clean checkout, with no `mach bootstrap` and no setup steps
outside the shells. Covers BUILD-01 and BUILD-02.

This phase proves the toolchain. It ships no Sourcerer identity, no
`@sourcerer/*` extension, no Firefox patch, and no artifact-build wiring —
those are Phases 2 and 3.

</domain>

<decisions>
## Implementation Decisions

### Firefox source acquisition

- **D-01:** `upstream/` is listed in `.gitignore` and materialized on demand
  from a pinned source. The ESR tree is never committed to this repo.
  Rationale: an extracted ESR tree is ~2.5 GB / ~250k files; committing it
  makes `git status`, `git grep`, and every diff in this repo slow, and turns
  each ESR rebase into one unreviewable multi-gigabyte commit. The patch stack
  in `patches/` is the artifact that matters — upstream is replaceable, not
  owned. Reproducibility is bought instead by a content-addressed pin (D-02),
  which fails loudly on byte drift rather than silently accepting it. This is
  also the pattern Zen Browser ships a Firefox fork with today (gitignored
  `engine/`, fetched by `surfer download`).
- **D-02:** `upstream/` is a **shallow git checkout** of the canonical
  `mozilla-firefox/firefox` mirror at tag `FIREFOX_153_1_0esr_RELEASE` — not
  an extracted release tarball. — **Reversibility:** costly — BUILD-03's
  rebase procedure and BUILD-04's `MOZ_ARTIFACT_REVISION` both depend on
  upstream having a git revision identity. A git checkout gets `git am`
  fail-loudly-on-conflict semantics for free, which is exactly what BUILD-03
  asks for; switching to a tarball later means hand-rolling that conflict
  detection (which is most of what Zen's `surfer` reimplements).
  The tag is confirmed present on the mirror, alongside branch `esr153`.
- **D-03:** Phase 1 materializes into `upstream/` — the name BUILD-03 already
  reserves — not a scratch directory. Phase 3 then only adds `patches/` and
  `sourcerer/` around an already-correct layout.
- **D-04:** Materialization is **one documented command**, not a manual
  sequence. Success criterion 4 ("a second fresh clone reaches both of the
  above with the documented commands") explicitly includes the upstream fetch
  as a documented step. The honest cost of D-01 is that a fresh clone must
  download before it can build; that cost is accepted and documented, not
  hidden.

**Mechanism note for the planner:** `mach` needs a writable tree and the Nix
store is read-only, so the shape is — the flake pins the source identity, and
the documented command materializes it into writable `upstream/`.

### Theia workspace shape

- **D-05:** Phase 1 creates the **real** `theia/` yarn workspace that Phase 2
  extends. No throwaway `@theia/cli`-generated app.
  Rationale: building the real workspace satisfies success criterion 1
  identically to a throwaway at the same cost, and a throwaway means Phase 2
  opens by discarding it and re-deriving the workspace — rework, which this
  roadmap's whole framing forbids.
- **D-06:** Layout mirrors `eclipse-theia/theia-ide` (the closest analog to
  what Sourcerer composes): root `package.json` declaring yarn workspaces,
  with `applications/browser` as the only application target. **No
  `applications/electron`** — Electron is out of scope project-wide, and
  Theia's own tracker documents browser-target and electron-target native
  builds clobbering each other's build cache (PITFALLS #7).
- **D-07:** "Stock" in success criterion 1 means the workspace contains
  **zero `@sourcerer/*` extensions** in Phase 1 — the app is composed purely
  from `@theia/*`. This keeps Phase 1 honest (no branding work leaking
  forward) while leaving Phase 2 a real workspace to extend.
- **D-08:** No Lerna in Phase 1 — yarn workspaces alone. theia-ide uses Lerna,
  but for a single-application workspace it buys nothing. Add it only if
  Phase 2's multi-extension build actually needs ordered builds.
  — **Reversibility:** reversible — adding Lerna later is a root
  `package.json` change.
- **D-09:** `@theia/*` dependencies pinned to **exact** 1.74.1 (no `^`), with
  a `resolutions` block to stop transitive drift. Rationale: Theia has no
  API stability tier (PITFALLS #6), so a floating minor is a live hazard for
  Phase 2's extensions.
- **D-10:** Success criterion 3 is proven by a **real** native build —
  `yarn theia rebuild:browser` compiling node-pty / native-keymap against the
  pinned Node — not by assuming node-gyp works. `rebuild:browser` is the
  correct target (the sidecar is a Node backend serving a browser-target
  frontend, never Electron).

### Firefox build depth

- **D-11:** Phase 1's acceptance proof is **one full compile** of stock
  153.1.0esr, not an artifact build.
  Rationale: an artifact build downloads prebuilt Gecko and therefore proves
  almost nothing about the shell's C++/Rust toolchain. The roadmap puts this
  phase first precisely because the NixOS Firefox toolchain is the project's
  highest unknown — an artifact-only proof leaves that unknown standing.
  PITFALLS #2 (cbindgen/rustc FFI drift) is only detectable by a full compile;
  deferring it to Phase 3 means discovering it when it is already blocking
  branding work. Cost is a one-time multi-hour build, and D-15 means the
  toolchain used is the one nixpkgs already builds this exact version with.
- **D-12:** Artifact builds (`--enable-artifact-builds`,
  `MOZ_ARTIFACT_REVISION`) stay in Phase 3 / BUILD-04. Phase 1 must not
  *preclude* them — D-02's git checkout is what keeps them landable — but
  Phase 1 does not wire them. Wiring them here would be scope creep into
  BUILD-04.
- **D-13:** Phase 1 records the **resolved rustc and cbindgen versions** the
  flake supplies, in a form Phase 3's rebase CI can diff against. PITFALLS #2
  calls this out as re-verified every ESR rebase, so the baseline has to exist
  from the start.

### Flake pinning strategy

- **D-14:** A single `nixpkgs` flake input following **`nixos-unstable`**,
  pinned by `flake.lock`. — **Reversibility:** costly — moving to a release
  channel later means re-verifying every attribute in the flake.
  **Verified 2026-08-20:** `nixos-25.11` (the current stable) has no
  `firefox-esr-153` derivation at all — its `packages/` directory contains
  only `firefox-esr-140.nix`. Stable is not an option for this pin.
- **D-15:** The `firefox` shell uses
  `inputsFrom = [ pkgs.firefox-esr-153-unwrapped ]` — the **version-explicit**
  attribute, never the `firefox-esr-unwrapped` alias.
  — **Reversibility:** costly — the alias silently re-points when nixpkgs
  advances its ESR line, which swaps the entire toolchain underneath a pinned
  Gecko checkout. That is PITFALLS #2 arriving by accident.
  **Verified footgun:** the same alias resolves to `firefox-esr-140-unwrapped`
  on `nixos-25.11` and `firefox-esr-153-unwrapped` on `nixos-unstable`.
- **D-16:** Node is `pkgs.nodejs_22` (currently 22.22.2), referenced from one
  place and reused everywhere the pin is needed. Never bare `pkgs.nodejs` —
  that aliases to Node 24 and would reintroduce PITFALLS #7 (native module
  ABI mismatch) the moment the alias moves.
- **D-17:** Yarn comes from the nixpkgs `yarn` attribute (1.22.22, Classic).
  `corepack` is **not** enabled — its default shims target Yarn Berry, which
  is the wrong Yarn for composing a Theia application.
- **D-18:** `mach bootstrap` is never invoked. The `firefox` shell supplies
  everything bootstrap would install (PITFALLS #1); make that explicit where a
  developer will see it rather than leaving it as tribal knowledge.

### Claude's Discretion

The user did not specify these; the planner should treat the leanings as
defaults, not constraints.

- **Developer entry surface** — where the "documented commands" for success
  criteria 1 and 4 live (repo `README.md` vs a `docs/BUILD.md` vs a shellHook
  banner printed on `nix develop`). Leaning: shellHook banner listing the next
  command for that shell, with `README.md` as the canonical written copy.
- **direnv support** (`.envrc` + `use flake`) — convenience only, not required
  by any success criterion. Leaning: include, it is two lines.
- **CI skeleton in Phase 1** — the research SUMMARY suggested a CI skeleton in
  the boot phase, but BUILD-03's rebase CI is a Phase 3 requirement. Leaning:
  no CI in Phase 1; a workflow that cannot yet replay a patch stack is a stub
  that will be rewritten.
- **Exact shallow-clone mechanics** for D-02 (`--depth 1 --branch <tag>` vs a
  blobless `--filter=blob:none` clone). Both satisfy D-02; pick on measured
  clone time and on whichever survives fetching a *second* tag cleanly for the
  Phase 3 rebase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative requirements and architecture
- `docs/PRODUCT-REQUIREMENTS.md` — R1–R9, CONFIRMED 2026-08-19. The
  authoritative requirements document.
- `docs/research/sourcerer-architecture.md` — authoritative architecture;
  defines `theia/` as an independent npm workspace with an
  `applications/browser` target.
- `.planning/REQUIREMENTS.md` — BUILD-01 and BUILD-02 are this phase's
  requirements; BUILD-03/BUILD-04 are Phase 3 and constrain what Phase 1 must
  not preclude.
- `.planning/ROADMAP.md` §"Phase 1: Build Infrastructure" — the four success
  criteria this phase is verified against.

### Toolchain and pitfalls
- `.planning/research/STACK.md` — pinned versions (Firefox ESR 153.1.0esr,
  Theia v1.74.1, Node 22, Yarn Classic 1.x) and the NixOS build strategy.
  Note: its claim that nixpkgs aliases `firefox-esr = firefox-esr-153` is
  true only on `nixos-unstable` — see D-14/D-15.
- `.planning/research/PITFALLS.md` §Pitfall 1 — `mach bootstrap` fails on
  NixOS; the `firefox` shell must supply the toolchain instead.
- `.planning/research/PITFALLS.md` §Pitfall 2 — cbindgen/rustc FFI version
  drift; drives D-11, D-13, D-15.
- `.planning/research/PITFALLS.md` §Pitfall 3 — the artifact-build ceiling
  (no C/C++/Rust/WebIDL changes); drives D-12.
- `.planning/research/PITFALLS.md` §Pitfall 7 — native module ABI mismatch;
  drives D-06, D-10, D-16.
- `.planning/research/ARCHITECTURE.md` — component layout and build order.
- `.planning/research/SUMMARY.md` — synthesis; note its phase numbering is the
  pre-compression 7-phase scheme, superseded by ROADMAP.md's 5 phases.

### Project rules
- `CLAUDE.md` — hard rules (never fork Theia core, never modify Gecko, no
  custom chrome in v4.0) and the space-free-path constraint on this repo.
- `.claude/CLAUDE.md` — stack table and "What NOT to Use" list.

### External precedent (read only if the planner needs the pattern)
- `zen-browser/surfer` and `zen-browser/desktop` on GitHub — the gitignored
  upstream + patch-stack pattern D-01 follows, and the `sync-upstream.yml`
  rebase-CI shape Phase 3 will crib.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

None. The repo contains only `docs/`, `.planning/`, `CLAUDE.md`, `README.md`,
and `LICENSE` — it was reset to a clean slate on 2026-08-19. Every file in
this phase is new.

### Established Patterns

None in-repo. The patterns this phase should follow are external and named in
`<canonical_refs>`: `eclipse-theia/theia-ide` for the Theia workspace layout,
`zen-browser/desktop` for the fork layout.

### Integration Points

- `flake.nix` at the repo root is the single entry point both later phases
  depend on. Phase 2 consumes the `theia` shell; Phase 3 consumes the
  `firefox` shell.
- `theia/` becomes Phase 2's workspace root — Phase 2 adds `@sourcerer/*`
  packages into it without restructuring it.
- `upstream/` becomes Phase 3's patch target.

### Environment constraint

This repo must stay at a space-free path (`/home/chris/coding/sourcerer`).
`mkShell` appends `-rpath $PWD/outputs/out/lib` to the space-separated
`NIX_LDFLAGS`; a space in `$PWD` makes the cc-wrapper split it and every
native link step fails. Both the Firefox build and Theia's node-gyp modules
drive that linker.

</code_context>

<specifics>
## Specific Ideas

### Verification performed during this discussion (2026-08-20)

These were checked live against primary sources, not assumed. They resolve the
STATE.md blocker "Phase 1: nixpkgs Firefox-toolchain attributes are
unverified."

| Claim | Result |
|---|---|
| Tag `FIREFOX_153_1_0esr_RELEASE` exists | ✅ Present on `mozilla-firefox/firefox`, alongside branch `esr153` |
| `firefox-esr-153-unwrapped` exists in nixpkgs | ✅ `pkgs/applications/networking/browsers/firefox/packages/firefox-esr-153.nix` on master |
| That derivation's pinned version | ✅ `153.1.0esr` — an exact match for our tag |
| `firefox-esr-unwrapped` alias | ⚠️ Exists, but resolves to **140** on `nixos-25.11` and **153** on `nixos-unstable`. Do not use it (D-15) |
| `firefox-esr-153` on stable 25.11 | ❌ Absent — stable ships only `firefox-esr-140.nix` (D-14) |
| `nodejs_22` | ✅ 22.22.2 on unstable; `v22.nix` also present on 25.11 |
| `yarn` | ✅ 1.22.22 — Classic, as required |

A note on method for whoever repeats this: `search.nixos.org` (and the nixos
MCP's `search`/`info` actions, which read it) was **stale** — it reported
`firefox` at 149.0.2 and had no `firefox-esr-153` entry, while the nixpkgs
tree and NixHub both showed `firefox` at 153.0.4 as of 2026-08-14. Verify
Firefox attributes against the nixpkgs tree or NixHub, not the search index.

### Leverage available to the planner

`pkgs.firefox-esr-153-unwrapped` is built from
`fetchurl { url = "mirror://mozilla/firefox/releases/153.1.0esr/source/firefox-153.1.0esr.source.tar.xz"; sha512 = …; }`.
nixpkgs therefore already carries a hash-pinned copy of the exact source
Sourcerer targets. D-02 chose a git checkout over that tarball for revision
identity, but the tarball remains a legitimate fallback if the mirror clone
turns out to be unworkably large — and `inputsFrom` on that same derivation is
what makes D-11's full compile likely to succeed on the first attempt, since
it is the toolchain nixpkgs uses to build this exact version.

</specifics>

<deferred>
## Deferred Ideas

- **Artifact builds** (`--enable-artifact-builds`, `MOZ_ARTIFACT_REVISION`
  pinning) — Phase 3, BUILD-04. Phase 1 keeps them landable (D-02) but does
  not wire them (D-12).
- **`patches/` and `sourcerer/` trees, and the documented rebase procedure** —
  Phase 3, BUILD-03. Phase 1 only establishes `upstream/`.
- **Rebase CI** (`sync-upstream`-style workflow, fail loudly on conflict) —
  Phase 3. A CI job that cannot yet replay a patch stack is a stub.
- **`@sourcerer/*` extensions and all branding** — Phase 2 (Theia side) and
  Phase 3 (Firefox side). Phase 1's Theia app stays stock (D-07).
- **Bundling a Node runtime into the shipped build** — Phase 4/5 packaging
  concern. Phase 1 only pins the version (D-16); threading that same pin
  through to the packaged runtime is where PITFALLS #7 actually bites.
- **`sourcerer/INTERNAL-APIS.md`** (including the artifact-build boundary
  documentation PITFALLS #3 asks for) — Phase 4 creates it; Phase 3 documents
  the artifact boundary.

</deferred>

---

*Phase: 1-Build Infrastructure*
*Context gathered: 2026-08-20*
