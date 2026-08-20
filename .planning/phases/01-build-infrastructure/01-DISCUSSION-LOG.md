# Phase 1: Build Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-20
**Phase:** 1-Build Infrastructure
**Areas discussed:** Firefox source acquisition, Theia workspace shape, Firefox build depth, Flake pinning strategy

The user selected all four gray areas, asked for a reasoned recommendation on
the first, then directed Claude to proceed with its recommendations for the
rest. Every recommendation below is recorded with the evidence it rests on.

---

## Firefox source acquisition

**Question:** What is `upstream/` physically — how does the pinned ESR 153 source get into the working tree?

| Option | Description | Selected |
|--------|-------------|----------|
| Gitignored fetch target | `upstream/` in `.gitignore`; fetched on first use (Zen's `engine/` pattern). Small repo, fast clone, pristine upstream. Cost: fresh clone needs a multi-GB download. | ✓ |
| Committed vendored tree | Full ESR source committed. Offline clone-and-build, auditable in git history. Cost: multi-GB repo, unreviewable rebase commits, slow `git` operations. | |
| Git submodule | Submodule pinned to the mirror at the ESR tag. Explicit pin, one-line rebase bump. Cost: submodule ergonomics, large mirror history. | |

**User's choice:** Asked for the recommendation and its reasoning rather than picking directly, then accepted it.

**Notes:** Recommendation rested on four points — (1) an extracted ESR tree is
~2.5 GB / ~250k files, which permanently degrades every git operation in this
repo and makes each rebase one unreviewable commit; (2) BUILD-04's
`MOZ_ARTIFACT_REVISION` needs upstream to have revision identity, which a
committed snapshot lacks; (3) Nix content-addressed fetching supplies the
reproducibility the vendored tree was supposed to buy, and fails loudly on
byte drift; (4) Zen Browser ships a Firefox fork this way today. The submodule
option was rejected because the CI rebase job must replay `patches/` onto the
new tag either way, so the submodule adds ergonomics cost for no gain.

A sub-decision was settled inside the accepted option: `upstream/` is a
**shallow git checkout at the tag**, not an extracted tarball, because
`git am` gives BUILD-03's fail-loudly-on-conflict behaviour for free and
preserves the revision identity BUILD-04 needs. The nixpkgs-supplied
`firefox-153.1.0esr.source.tar.xz` was noted as a legitimate fallback.

---

## Theia workspace shape

| Option | Description | Selected |
|--------|-------------|----------|
| Real `theia/` workspace | Phase 1 builds the actual yarn workspace (root `package.json` + `applications/browser`) that Phase 2 extends with `@sourcerer/*`. | ✓ |
| Throwaway proof app | Phase 1 only proves the `theia` shell works, using a `@theia/cli`-generated app that Phase 2 replaces. | |

**User's choice:** Deferred to Claude's recommendation.

**Notes:** The real workspace satisfies success criterion 1 at identical cost
to a throwaway, and a throwaway guarantees Phase 2 opens with rework. Layout
mirrors `eclipse-theia/theia-ide` (yarn workspaces, Lerna, `applications/*` +
`theia-extensions/*`), minus Lerna and minus `applications/electron`. "Stock"
was defined explicitly: the workspace ships zero `@sourcerer/*` extensions in
Phase 1, so branding cannot leak forward from Phase 2.

---

## Firefox build depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full compile | Hours, but exercises the whole C++/Rust toolchain and would catch cbindgen/rustc drift. | ✓ |
| Artifact build | Minutes, but downloads prebuilt Gecko — proves almost nothing about the shell's compiler toolchain. | |
| Both | Full compile as acceptance, artifact build wired and documented alongside. | |

**User's choice:** Deferred to Claude's recommendation.

**Notes:** The roadmap sequences this phase first because the NixOS Firefox
toolchain is the project's highest unknown; an artifact-only proof would leave
that unknown standing while appearing to satisfy the criterion. PITFALLS #2
(cbindgen/rustc FFI drift) is only observable through a full compile. "Both"
was rejected as scope creep — artifact-build wiring is BUILD-04, a Phase 3
requirement — but Phase 1 must keep it landable, which the git-checkout
decision above already does.

---

## Flake pinning strategy

| Option | Description | Selected |
|--------|-------------|----------|
| `nixos-unstable`, pinned by `flake.lock` | Tracks the channel that actually carries ESR 153. | ✓ |
| Release channel (25.11) | More conservative update cadence. | |
| Fixed rev, no channel | Maximum stability, manual bumps. | |

**User's choice:** Deferred to Claude's recommendation.

**Notes:** Settled by verification rather than preference — `nixos-25.11` has
no `firefox-esr-153` derivation at all (its `packages/` directory contains only
`firefox-esr-140.nix`), so stable was not a viable option. `flake.lock` pins an
exact rev regardless, so the channel choice only governs update cadence.

Two footguns were identified and closed in the same area:
`firefox-esr-unwrapped` is an alias that resolves to 140 on 25.11 and 153 on
unstable, so the flake must name `firefox-esr-153-unwrapped` explicitly; and
bare `pkgs.nodejs` aliases to Node 24, so the flake must name `nodejs_22`.

---

## Claude's Discretion

- Developer entry surface for the "documented commands" (`README.md` vs
  `docs/BUILD.md` vs a shellHook banner)
- direnv `.envrc` support
- Whether a CI skeleton lands in Phase 1 (leaning: no — BUILD-03 owns rebase CI)
- Exact shallow-clone mechanics (`--depth 1 --branch <tag>` vs blobless clone)

## Deferred Ideas

- Artifact builds and `MOZ_ARTIFACT_REVISION` → Phase 3 (BUILD-04)
- `patches/` + `sourcerer/` trees and the rebase procedure → Phase 3 (BUILD-03)
- Rebase CI workflow → Phase 3
- `@sourcerer/*` extensions and all branding → Phases 2 and 3
- Bundling a Node runtime into the shipped build → Phase 4/5 packaging
- `sourcerer/INTERNAL-APIS.md` and the artifact-build boundary → Phases 3/4
