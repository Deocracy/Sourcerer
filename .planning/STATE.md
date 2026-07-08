---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-07-08T01:42:28.122Z"
last_activity: 2026-07-08
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 14
  completed_plans: 12
  percent: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-06)

**Core value:** A pixel-perfect, fully interactive desktop shell where the applet framework demonstrably works end-to-end — Notes proves the loop, every other applet is a believable stub.
**Current focus:** Phase 02 — workspace-core (Phase 07 also in progress in parallel — see below)

## Current Position

Phase: 02 (workspace-core) — EXECUTING
Plan: 6 of 6 (02-01, 02-02 complete; next is 02-03 human-verify checkpoint)
Status: Ready to execute
Last activity: 2026-07-08

Phase 07 (assistant-harness-core, running in parallel): 4 of 5 plans complete (07-01, 07-02, 07-03, 07-04 done; only 07-05 wave 3 human-verify checkpoint remains).

Note: `state.advance-plan` tracks a single project-wide plan counter and mis-attributes advances to whichever phase this "Current Position" block names when two phases execute in parallel (landmine, repeats each time — see prior note this replaced). After 07-02's completion this was manually corrected here (via `state.update-progress`, not `state.advance-plan`): Phase 02's plan number was NOT advanced by 07-02's completion. The aggregate `completed_plans` count in frontmatter is derived from `state.update-progress`'s disk-scan (recompute it if it drifts — Phase 01 + Phase 02 + Phase 07's actual SUMMARY.md counts on disk are the source of truth, not this note's numbers, since both phases execute in parallel and this note goes stale quickly). At last recompute during 07-02's completion: Phase 01 (3) + Phase 02 (4, including 02-04) + Phase 07 (07-01, 07-02, 07-03, 07-04 = 4) = 11.

Progress: [█████████░] 86%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: — min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P02 | 14 | 3 tasks | 11 files |
| Phase 02 P01 | 12 | 3 tasks | 5 files |
| Phase 02 P02 | 18 | 3 tasks | 10 files |
| Phase 07 P01 | 70min | 3 tasks | 9 files |
| Phase 07 P03 | 35min | 3 tasks | 6 files |
| Phase 07 P04 | ~35min | 3 tasks | 6 files |
| Phase 07 P02 | 55min | 2 tasks | 8 files |
| Phase 02 P04 | 25min | 3 tasks | 7 files |
| Phase 02-workspace-core P05 | 35min | 3 tasks | 8 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Tauri 2 + React 18.2.0 + Vite + TS, no component library; pixel-perfect bespoke design.
- [Init]: Notes is the only real applet in v1; all others are high-fidelity stubs.
- [Init]: Databasise integration mode and host.ai() backend deliberately deferred — seams preserved, stubbed in v1.
- [Roadmap]: Persistence split into its own phase (Phase 3) — crash-safety + schema versioning is a distinct critical-risk subsystem per PITFALLS.md.
- [Phase ?]: 01-02: title bar wired to Tauri window API; maximize state via isMaximized()-on-onResized, stateless (D-02)
- [Phase ?]: 01-02: verify:fonts node gate proves SHELL-04 (no Google Fonts, local IBM Plex bundled)
- [Phase ?]: 02-01: shell store persists only D-02 subset; dockview-core pinned exact 2.0.0
- [Phase ?]: 02-01: locked deps installed behind approved legitimacy gate (zustand 5.0.14, nanoid ^5, dockview-core 2.0.0)
- [Phase 02-02]: Chrome Rework title bar (DIVI chip + corpus label + rail toggles) + floating rounded window (transparent:true + backdrop + 10px card) shipped; LogoCluster.tsx left unmodified (out of plan scope)
- [Phase 07]: 07-01: getModel moved to @earendil-works/pi-ai/compat in 0.80.3 (API drift from spike's 0.74.2); DefaultResourceLoader must be explicitly reload()-ed by the caller before createAgentSession, or systemPromptOverride never applies
- [Phase 07]: 07-01: sidecar runs .ts sources directly via node --experimental-strip-types (Node 22.13 has no unflagged type stripping); tsconfig is type-check-only
- [Phase 07]: 07-03: SidecarProcess dev-spawns node directly (std::process::Command, cwd resolved from CARGO_MANIFEST_DIR) — no tauri-plugin-shell, no capabilities change needed since custom invoke_handler commands don't require a capability entry
- [Phase 07]: 07-03: D-06 honest-degrade covers write_line failure, closed listener channel, and a 120s per-turn timeout — all three collapse to exactly one error+done Channel event pair, never Err/hang
- [Phase 07-04]: src/host/ai.ts hand-mirrors sidecar/src/protocol.ts's AssistantEvent shapes (not imported) since the sidecar is a separate Node package outside the Vite build graph
- [Phase 07-04]: thinking_delta events are received but suppressed in the minimal AssistantPanel (07-CONTEXT.md discretion default)
- [Phase 07-04]: AssistantPanel mounts as a plain flex sibling of AppShell in App.tsx, not a rail/dock primitive - full rail integration deferred to Phase 2/6
- [Phase 07]: 07-02: index.ts createAgentSession now awaits allModeTools() and builds one AgentSession per sessionId lazily on first prompt via FileSessionManager (D-09), replacing the eager single-session-at-boot pattern from 07-01
- [Phase 07]: 07-02: Pi's own SessionManager withholds writing a JSONL file to disk until a real assistant-role message entry exists (_persist landmine) - tests exercising D-09 round-trip persistence must append a genuine assistant message, not just custom/user entries
- [Phase 02]: Rail self-sizes from the shell store rather than AppShell computing/passing width, since the 02-03 checkpoint fixed the body row to a flat flex layout
- [Phase 02]: Rail badge renders as a 12px pill in both expanded and compact modes, following UI-SPEC literally over the prototype's plain-text expanded badge
- [Phase 02]: Pin-to-bottom-group implemented as a hover-visible per-row toggle button (togglePin) rather than a drag-into-footer gesture
- [Phase ?]: addApplet(key) always creates a fresh instance (no existing-panel activate) to satisfy DOCK-04 multi-instance coexistence
- [Phase ?]: Dock '+' tab-bar action cycles appletDefs keys instead of an Applet Catalog picker (Phase 4 scope)

### Roadmap Evolution

- Phase 7 added (2026-07-07): Assistant Harness Core — real headless Pi sidecar behind host.ai(). Pulls "Real backend behind host.ai()" forward from the v2 deferral. Standalone, depends on Phase 1 only, buildable in parallel with Phases 2–5. De-risked by spikes 001–005.

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2 research flag]: Prototype pointer-event pattern + React 18 StrictMode-safe port strategy needs deep planning research before spec.
- [Phase 1 verify]: Confirm PerMonitorV2 DPI awareness so 1px borders hold at 125%/150% scaling.
- [Scaffold]: Verify Databasise's `cargo run` vs `cargo tauri dev` launch landmine does not reproduce in a fresh scaffold.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Integration | Databasise engine (live Wiki/Library/Graph data) | Deferred to v2 | Init |
| AI | Real backend behind host.ai() | Deferred to v2 | Init |
| Applets | All applets beyond Notes (stubs only) | Deferred to later milestones | Init |
| Packaging | Installer / shipping-form polish | Deferred | Init |

## Session Continuity

Last session: 2026-07-08T01:42:20.870Z
Stopped at: Completed 02-04-PLAN.md
Resume file: None
