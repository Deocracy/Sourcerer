---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: milestone
current_phase: 2
current_phase_name: Sourcerer Theia Extensions
status: executing
stopped_at: Phase 3 context gathered
last_updated: "2026-08-21T21:32:50.961Z"
last_activity: 2026-08-21
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 17
  completed_plans: 11
last_activity_desc: Phase 3 planning complete
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-19)

**Core value:** A daily-drivable IDE whose substrate is a real browser (DRM, WebExtensions, site isolation inherited from Firefox), built so every later plan lands as an addition, never a rework.
**Current focus:** Phase 2 — Sourcerer Theia Extensions

## Current Position

Phase: 2 (Sourcerer Theia Extensions) — EXECUTING
Plan: 7 of 7
Status: Ready to execute
Last activity: 2026-08-21

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
| Phase 02 P01 | 45min | 1 tasks | 13 files |
| Phase 02 P02 | 45min | 3 tasks | 5 files |
| Phase 02 P03 | 55min | 3 tasks | 8 files |
| Phase 02 P04 | 45min | 3 tasks | 7 files |
| Phase 02 P05 | ~2h | 3 tasks | 12 files |
| Phase 02 P06 | 40min | 3 tasks | 12 files |
| Phase 02 P07 | 90min | 3 tasks | 8 files |

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
- [Phase ?]: 02-01: @sourcerer/branding tsconfig.json uses the full theia-ide base.tsconfig.json compilerOptions (skipLibCheck, lib:[...,dom], declaration) -- the abbreviated set fails tsc -b on @theia/core's own .d.ts files
- [Phase ?]: 02-01: verify-branding.mjs polls for the favicon link itself, not just window.theia.container -- container is assigned before onStart contributions run, so a container-only wait races the DOM mutation
- [Phase ?]: 02-01: .gitignore's Theia build-output lib/ rule anchored to theia/**/lib/ -- the unanchored form also silently excluded scripts/lib/ (hand-written source)
- [Phase ?]: 02-01: sourcererPrivilegedJs read in-page via Object.getOwnPropertySymbols(window) -- FrontendApplicationConfigProvider stores config behind a bare Symbol(), no fixed lookup key or DI token exists externally
- [Phase ?]: 02-02: verify-uri-roundtrip.mjs resolves Theia DI services (OpenerService, WidgetManager, TabUriRegistry) via Inversify _bindingDictionary reflection and a minimal URI shim, since the real classes are unreachable from an external BiDi evaluation context -- an informal contract Plan 06/07 must not break with an instanceof URI check
- [Phase ?]: 02-02: bash trap cleanup EXIT INT TERM does not terminate a script on INT/TERM (bash resumes after a non-EXIT trap returns unless it exits) -- verify-phase-02.sh splits into trap cleanup EXIT plus trap 'cleanup; exit N' INT TERM
- [Phase ?]: Added @types/react@18.3.31 and @types/react-dom@18.3.7 as devDependencies (type-only, exact-pinned) -- react ships no bundled types and @theia/core lists both as optional peers Yarn Classic never auto-installs; approved by the coordinator after independent verification, per the phase's no-new-dependency stop-and-report rule.
- [Phase ?]: Welcome widget verification resolves SourcererWelcomeViewContribution directly and calls openView({reveal:true}) rather than the toggle command -- toggleView() closes an already-open main-area widget instead of re-revealing it, and a fresh headless profile always has it open via initializeLayout() already.
- [Phase ?]: 49-package @theia/* set exact-pinned (D-19); theia rebuild:browser corrected to reflect its actual output (generic message, not a per-module skip list)
- [Phase ?]: Two isBound-guarded rebinds (SourcererAIFirstPerspectiveContribution, SourcererAIConfigurationViewContribution) neutralize @theia/ai-ide's first-boot layout forcing without touching AIActivationService (D-22)
- [Phase ?]: onStart()/onDidInitializeLayout() in @sourcerer/customize's contributions never await their file read -- awaiting a user-storage: read inside a lifecycle hook that startContributions() itself awaits deadlocks app boot (the RPC connection that read needs stabilizes around/after that same chain resolves).
- [Phase ?]: scripts/lib/firefox-bidi.mjs's withFirefoxPage gained a screenshot() export (same-session BiDi capture) -- Plan 02's captureScreenshot fires on the page's early load event, before a Theia SPA settles, and cannot see the rendered app.
- [Phase ?]: 02-06: TabUriRegistry discovers view: targets at runtime from AbstractViewContribution instances (cross-checked against the static coverage table), not a hard-coded lookup -- turns a mis-transcribed table id into a startup console.error instead of a silent no-op
- [Phase ?]: 02-06: AbstractViewContribution.openView()'s return value is unreliable for a view: URI target when viewContainerId differs from widgetId -- it resolves via viewId (the container's part), not effectiveWidgetId (the container); ViewUriOpenHandler re-fetches the widget by name after calling openView() for its side effect
- [Phase ?]: 02-06: AI chat widget non-extractable (D-27) fix checks for an already-created widget via WidgetManager.getWidgets() in addition to subscribing to onDidCreateWidget -- another AI contribution's own onStart can create the widget first, and onDidCreateWidget only fires once, on first creation
- [Phase ?]: 02-07: TerminalUriOpenHandler and SourcererOutputOpenHandler stay bare OpenHandlers, not WidgetOpenHandler subclasses -- WidgetOpenHandler.doOpen defaults an unattached widget's area to 'main', wrong for Terminal's real 'bottom' default; delegating to each widget's own in-tree contribution reuses Theia's already-correct placement logic
- [Phase ?]: 02-07: fixed a live bug in @theia/output's own OutputContribution.open() -- it validated the output: scheme and then discarded the channel, never selecting it; opening output:B after output:A left selectedChannel pinned on A
- [Phase ?]: 02-07: terminalIdentityOptions({created,id,title} all equal) is a single shared helper used by both the auto-mint path and the terminal-open-handler's stale-name fresh-shell path -- WidgetManager dedups on stableJsonStringify({factoryId,options}), so any drift between the two call sites would fork a duplicate widget

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

Last session: 2026-08-21T19:32:45.574Z
Stopped at: Phase 3 context gathered
Resume file: .planning/phases/03-branded-firefox-fork/03-CONTEXT.md
