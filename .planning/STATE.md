---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: milestone
current_phase: 1
current_phase_name: Build Infrastructure
status: verifying
stopped_at: Completed 01-04-PLAN.md
last_updated: "2026-08-20T18:08:19.282Z"
last_activity: 2026-08-20
last_activity_desc: Roadmap created, 26/26 v1 requirements mapped
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-19)

**Core value:** A daily-drivable IDE whose substrate is a real browser (DRM, WebExtensions, site isolation inherited from Firefox), built so every later plan lands as an addition, never a rework.
**Current focus:** Phase 1 — Build Infrastructure

## Current Position

Phase: 1 (Build Infrastructure) — EXECUTING
Plan: 4 of 4
Status: Phase complete — ready for verification
Last activity: 2026-08-20 — Phase 1 execution started

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 10min | 3 tasks | 9 files |
| Phase 01 P02 | 23min | 2 tasks | 5 files |
| Phase 1 P3 | 2h18min | 2 tasks | 4 files |
| Phase 01 P04 | 20min | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Nix flake is its own phase (not folded into 2/3) — the NixOS Firefox toolchain is the project's highest unknown and blocks both tracks
- Roadmap: research's 7 phases compressed to 5 (standard granularity) — xhtml gut + TheiaService merged into Phase 4; both are "the window shows Theia"
- Roadmap: UI hints suppressed on all phases — CLAUDE.md forbids GUI work beyond the rename in v4.0
- [Phase ?]: shellHook banners write to stderr, not stdout, so nix develop --command output stays machine-parseable for scripts like toolchain-baseline.sh
- [Phase ?]: Added react/react-dom 18.3.1 (exact) to theia/applications/browser/package.json -- @theia/core's peer dependency, missing from the researched 11-package set (RESEARCH.md Open Question 1)
- [Phase ?]: node-pty D-10 proof is a real PTY spawn-and-echo test, not theia rebuild:browser or a build/Release/pty.node file check -- both are false signals for this package (it ships prebuilds/ only)
- [Phase ?]: firefox devShell now overrides stdenv to pkgs.llvmPackages.stdenv (clang) -- inputsFrom copies nativeBuildInputs/buildInputs from firefox-esr-153-unwrapped but not its own buildStdenv, and the real derivation builds under overrideCC llvmPackages.stdenv
- [Phase ?]: firefox shellHook unsets AS/LD/NM/AR/RANLIB/OBJDUMP/OBJCOPY/READELF/SIZE/STRINGS/STRIP -- nixpkgs bintools-wrapper exports these as bare tool names, which Firefox's moz.configure treats as an explicit override and uses without routing ASFLAGS through the compiler driver
- [Phase ?]: fetch-upstream.sh re-run identity check compares resolved commit SHAs, not git describe --tags --exact-match -- the mirror tags this release with both _RELEASE and _BUILD1 on the identical commit, and describe's tie-break is non-deterministic
- [Phase ?]: docs/BUILD.md documents the --ignore-scripts + explicit drivelist node-gyp rebuild install sequence, with the audit reason, so it is never simplified back to a plain yarn install
- [Phase ?]: scripts/fetch-upstream.sh is documented as run directly from the repo root (needs only git, already on host), not wrapped in nix develop .#firefox

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1: nixpkgs Firefox-toolchain attributes are unverified. Check every attribute against the nixos MCP before writing the flake (research STACK.md gap).
- Phase 4: verify the pinned Theia release is >= 1.73.1 and that the CVE-2026-61891 token check fires on plain HTTP, not only WebSocket upgrade.
- All phases: Theia has no API stability tier. Review every `@theia/*` import against `doc/Migration.md` and record it in INTERNAL-APIS.md.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-08-20T18:08:19.273Z
Stopped at: Completed 01-04-PLAN.md
Resume file: None
