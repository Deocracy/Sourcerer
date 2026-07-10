---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
last_updated: "2026-07-10T06:22:22.685Z"
last_activity: 2026-07-10
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 25
  completed_plans: 25
  percent: 71
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-06)

**Core value:** A pixel-perfect, fully interactive desktop shell where the applet framework demonstrably works end-to-end — Notes proves the loop, every other applet is a believable stub.
**Current focus:** Phase 04 — applet-framework

## Current Position

Phase: 04 (applet-framework) — EXECUTING
Plan: 5 of 5
Status: Phase complete — ready for verification
Last activity: 2026-07-10

Phase 07 (assistant-harness-core): COMPLETE — all 6 plans done (07-01..07-04 automated, 07-05 live UAT gate 4/4 truths pass, 07-06 D-09 gap closure). 07-VERIFICATION.md status: passed.

Note: `state.advance-plan` tracks a single project-wide plan counter and mis-attributes advances to whichever phase this "Current Position" block names when two phases execute in parallel (landmine, repeats each time — see prior note this replaced). After 07-02's completion this was manually corrected here (via `state.update-progress`, not `state.advance-plan`): Phase 02's plan number was NOT advanced by 07-02's completion. The aggregate `completed_plans` count in frontmatter is derived from `state.update-progress`'s disk-scan (recompute it if it drifts — Phase 01 + Phase 02 + Phase 07's actual SUMMARY.md counts on disk are the source of truth, not this note's numbers, since both phases execute in parallel and this note goes stale quickly). At last recompute during 07-02's completion: Phase 01 (3) + Phase 02 (4, including 02-04) + Phase 07 (07-01, 07-02, 07-03, 07-04 = 4) = 11.

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 5
- Average duration: — min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 03 | 5 | - | - |

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
| Phase 07 P06 | 50min | 3 tasks | 9 files |
| Phase 03 P01 | 8min | 3 tasks | 8 files |
| Phase 03 P02 | 25min | 2 tasks | 3 files |
| Phase 03-persistence-layouts P03 | 20min | 2 tasks | 5 files |
| Phase 03-persistence-layouts P04 | 40min | 2 tasks | 8 files |
| Phase 03 P05 | 55m | 2 tasks | 3 files |
| Phase 04 P01 | 6min | - tasks | - files |
| Phase 04 P02 | 10min | 3 tasks | 13 files |
| Phase 04 P03 | 20min | 2 tasks | 4 files |
| Phase 04 P04 | 15min | 2 tasks | 4 files |
| Phase 04 P05 | 5min | 2 tasks | 7 files |

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
- [Phase ?]: 07-06: sessionId persists via localStorage under sourcerer:assistant:sessionId (interim, ahead of tauri-plugin-store)
- [Phase ?]: 07-06: load_session Tauri command hand-mirrors host_ai's relay/degrade shape rather than extracting a shared helper
- [Phase ?]: 03-01: DEFAULT_RAIL_ORDER duplicated into workspaceStore.ts (no static shellStore import — circular-import ban)
- [Phase ?]: 03-01: store:default verified as the plugin-store 2.x capability identifier
- [Phase ?]: 03-01: scheduleWorkspaceSave no-ops silently until registerStateSources is wired (03-02)
- [Phase ?]: 03-02: single registerStateSources call site lives in Dock.tsx (getRailSubset getter exported from shellStore.ts), avoiding a workspaceStore.ts API change
- [Phase ?]: 03-02: canary clear-at-4s uses a direct saveWorkspaceRecord({restoreCanary:false}) call with live getters, not scheduleWorkspaceSave() (which only re-persists the stale in-memory canary value)
- [Phase ?]: 03-03: absent-store first-run is not a reset — only corrupt/unmigratable persisted values trigger the .bak backup + resetOccurred() notice
- [Phase ?]: 03-04: restoreDockTree implemented as optional StateSources field
- [Phase 03]: 03-05: CloseRequested split Rust(prevent_close+emit)/JS(flushPendingSave, sole flush authority) per RESEARCH Architectural Responsibility Map
- [Phase 03]: 03-05: re-entrant CloseRequested guarded via CLOSE_CONFIRMED AtomicBool + confirm_close command, avoiding block_on-vs-spawn sequencing risk (RESEARCH Open Question 2)
- [Phase ?]: 04-01: host.open() uses panel.api.setActive() not DockviewApi.setActivePanel (that method doesn't exist on the public dockview-core 2.0.0 API)
- [Phase ?]: 04-01: host.theme is a static literal mirroring tokens.css, not getComputedStyle passthrough
- [Phase ?]: 04-02: templated.ts kept as .ts (not .tsx) - uses React.createElement instead of JSX since this tsconfig only enables JSX parsing in .tsx files
- [Phase ?]: 04-02: D-07 in-flight host.ai() abandonment implemented as a natural consequence of unmounting the React root before any pending promise settles, not a bespoke cancellation registry
- [Phase ?]: 04-02: PanelBody.test.tsx wraps render/dispose in react-dom/test-utils act() - createRoot's initial commit does not flush synchronously under jsdom without it
- [Phase 04]: 04-03: Wiki entity selection stays component-local useState (seeded ficino), no shellStore selection slice added
- [Phase 04]: 04-03: Wiki's T color object kept fully local, matching the handoff 1:1, rather than partially sourced from host.theme
- [Phase 04]: 04-03: Rule 2 - added a component-local entity picker so the Alberti Unresolved block is reachable this phase
- [Phase 04-04]: corpus/stats fallback defaults to CORPORA[0] (ficino), not sandbox — shellStore's activeCorpus seeds to the generic "Default" chrome label and doesn't match a demo corpus id; falling back to sandbox's zeroed contradictions would hide the required review CTA
- [Phase 04-04]: Library's selected document stays component-local useState (seeded doc-ficino-vita), no shellStore selection slice added
- [Phase 04-05]: AppletCatalog picker (D-18) opens applets via host.open from both Dock '+' and Rail footer; D-19 append implemented inside hydrateFromDisk so any registered appletDefs key missing from the restored railOrder appends at the end

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

Last session: 2026-07-10T06:18:06.328Z
Stopped at: Completed 04-04-PLAN.md
Resume file: None
