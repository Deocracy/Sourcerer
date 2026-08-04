---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Container Platform
status: Context gathered — ready for `/gsd-plan-phase 8`
stopped_at: Phase 8 context gathered; Nix-native rule adopted milestone-wide
last_updated: "2026-08-04T04:19:37.398Z"
last_activity: 2026-08-04 — Phase 8 discussed and rescoped; Nix-native decision adopted milestone-wide
progress:
  total_phases: 12
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-03)

**Core value:** A pixel-perfect, fully interactive desktop shell where the applet framework demonstrably works end-to-end — Notes proves the loop, every other applet is a believable stub.
**Current focus:** v2.0 Container Platform — Phase 8 (Spike K, Nix-native substrate service) is next, on the Windows box.

## Current Position

Phase: 8 — Spike K: Nix-Native Substrate Service (not started)
Plan: —
Status: Context gathered — ready for `/gsd-plan-phase 8`
Last activity: 2026-08-04 — Phase 8 discussed and rescoped; Nix-native decision adopted milestone-wide
Progress: [------------] 0/12 phases

**Two-host reminder:** every v2.0 phase states its execution host in ROADMAP.md. NixOS is the dev host; the Windows box runs Phases 8, 10, 12, 14, 17 and the UAT legs of 11, 15, 18, 19. A phase whose UAT silently assumes the dev host will strand.

## Performance Metrics

**Velocity:**

- Total plans completed: 18
- Average duration: — min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 03 | 5 | - | - |
| 4 | 5 | - | - |
| 06 | 8 | - | - |

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
| Phase 05-notes-applet P01 | 45min | 3 tasks | 7 files |
| Phase 05 P02 | 15min | 2 tasks | 3 files |
| Phase 06 P01 | 15min | 2 tasks tasks | 4 files files |
| Phase 06 P02 | 40min | 2 tasks | 5 files |
| Phase 06 P03 | 35min | 2 tasks tasks | 5 files files |
| Phase 06 P05 | 25min | 2 tasks | 8 files |
| Phase 06 P04 | 20min | 2 tasks | 5 files |
| Phase 06 P06 | 50min | 3 tasks | 8 files |
| Phase 06 P07 | 5min | 3 tasks | 8 files |
| Phase 06 P08 | 8min | 3 tasks | 2 files |

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
- [Phase 05-01]: List pane shows no rows (not a duplicate empty-state message) when notes.length===0 - only the editor pane's empty state carries No notes yet copy
- [Phase 05-01]: Notes' shared module-level store is a deliberate app-lifetime singleton (D-04); Notes.test.tsx uses vi.resetModules() + dynamic import for isolation
- [Phase 05-01]: Delete button keeps a stable aria-label (Delete note) through the two-step confirm; only its visible text flips to Delete for real?
- [Phase ?]: [Phase 05-02]: Ephemeral summarize reset (summary/summarizeError) lives inside selectNote() rather than a separate useEffect - piggybacks on the single existing per-tab-selection mutation point
- [Phase ?]: [Phase 05-02]: Summarize button carries no aria-label override (unlike Delete) - its visible text never diverges from its accessible name
- [Phase ?]: 06-01: asstWidth/assistantOpen added to WorkspaceRecordV1.rail (not a new top-level slice); no schemaVersion bump
- [Phase ?]: 06-01: homeOpen/lastResolvedProposal/pendingCardMint are session-only (never persisted) - ephemeral D-06 hand-off + Home overlay visibility
- [Phase ?]: 06-02: sourcerer:assistant:sessionIds JSON array replaces the single sessionId key; corrupt JSON falls back to minting one fresh real session (T-06-02-02)
- [Phase ?]: 06-02: message-load effect seeds from a session entry's local turns before calling host.loadSession, only overwriting on non-empty history - preserves a freshly-minted real session's greeting
- [Phase 06-03]: Proposal attachment runs at both seed-transcript load and streamed done branch (not only done) so the guaranteed-parseable seed-careggi demo can surface its proposal
- [Phase 06-03]: focusedProposalId auto-sets to the newly-surfaced proposal on attachment, so y/d/n work immediately without requiring an explicit click first
- [Phase 06]: 06-05: Home section state is local useState seeded from DEFAULT_SECTIONS this plan (no persistence/drag) - Plan 06-06 swaps in host.storage-backed slice
- [Phase 06]: 06-05: DiviChip/LogoCluster both drive shellStore.homeOpen as the single Home-visibility signal, replacing the stale railApplet==Home comparison (RESEARCH Pitfall 4)
- [Phase ?]: 06-04: reopen-from-closed restores persisted asstWidth unless it's below a sane floor (<44), rather than always resetting to 280
- [Phase ?]: 06-04: full-snap width computed as hostWidth-160 at pointerup time, not a dedicated full-width constant
- [Phase 06-06]: Minted cards register by mutating the shared cardDefs Record directly (mirrors Notes' 05-01 module-singleton precedent), avoiding a merged-lookup prop threaded through SortableCard/OverlayCard
- [Phase 06-06]: dirtyRef guards Home.tsx's mount-time loadSections() resolution against clobbering a drag/mint that lands before the disk read settles (Rule 1 fix)
- [Phase ?]: 06-07: assistantFull modeled as a session-only (non-persisted) zustand field; asstWidth still carries the real pixel width, restored via a closure-local prevWidth on exit from full (mirrors prototype rightPrev), avoiding a workspace.json schema bump
- [Phase ?]: 06-07: liveWidth is a parallel piece of hook state to liveSnap (not derived), cleared together in the existing WR-06 teardown; a window resize dispatch on each pointermove substitutes for the prototype's direct relayout() call to keep dockview in step with the drag
- [Phase ?]: 06-08: railSnap.ts thresholds confirmed matching the prototype 1:1 (no changes) - jank was entirely missing live-relayout during drag
- [Phase ?]: 06-08: reused useAssistantResize's shared teardown() + window resize-dispatch pattern verbatim for useRailDrag (WR-06 parity), keeping the two bespoke-pointer resize hooks structurally identical

### Roadmap Evolution

- v2.0 Container Platform roadmapped (2026-08-04): 12 phases (8-19) derived from `.planning/research/CONTAINER-PLATFORM-PLAN.md` (verifier-revised) with P-labels preserved — P0→8, P1→9, P2→10, P2b→11, P2c→12, P3a→13, P3b→14, P4→15, P5→16, P6→17, P7→18, P8→19. All 34 v2.0 requirements mapped, no orphans.
- Two-track sequencing: Track 1 (shell tree, serial) 8→9→10→11→12→15→17→18→19; Track 2 (separate repos, parallel) Phase 13 alongside 10/11 and Phase 16 alongside 17/18; join points at 14 (needs 10+13) and 19 (needs 18+16).
- Phase 7 added (2026-07-07): Assistant Harness Core — real headless Pi sidecar behind host.ai(). Pulls "Real backend behind host.ai()" forward from the v2 deferral. Standalone, depends on Phase 1 only, buildable in parallel with Phases 2–5. De-risked by spikes 001–005.

### Pending Todos

None yet.

### Blockers/Concerns

- [v2.0 Phase 10]: `security.csp = null` acceptance from v1.0 Phase 1 EXPIRES here by construction (multiwebview panes + container-served UIs). `src-tauri/tauri.conf.json` still reads `"csp": null`. Real CSP is a Phase 10 deliverable, not a nice-to-have.
- [v2.0 Phase 8]: the local `nixos.wsl` image was deleted 2026-08-03 — re-download NixOS-WSL 2605.7.2 and verify sha256 `e7180ad555fdcb8e1e057e2ef056de467603a5e502ff8531053738371be3f6b9`; re-verify the `SourcererSpike` distro is still registered on the Windows box (the "1 day of pure work" budget assumed it was warm).
- [v2.0 AI, 2026-08-04]: spike B (GPU-in-WSL2) marked resolved on the user's report of a separate successful test — **the evidence location was never recorded**. Get the one-liner (which machine/distro, what ran) before Phase 15 plans the Ollama catalog app's GPU variants. Decision set: `.planning/research/AI-PROVIDER-ARCHITECTURE.md`.
- [v2.0 Nix-native, 2026-08-04]: the OCI-image app layer is **retired as the default path** milestone-wide. Stale OCI language may still linger in `.planning/research/CONTAINER-PLATFORM-PLAN.md` (P0 spike-K row, P4/P5 bodies) — that file was NOT rewritten, only `CONTAINER-PLATFORM.md` §5 carries a supersession banner. Treat ROADMAP.md + REQUIREMENTS.md as authoritative where they disagree with the plan file.
- [v2.0 Phase 19]: security baseline is thinner than this file implied — `01-SECURITY.md` is the only SECURITY.md in the repo (Phases 02-07 have none, including the Phase 07 Pi sidecar's real trust boundary), and `workflow.security_enforcement` is `false` so `/gsd-secure-phase` no-ops until flipped back. Worth settling before Phase 15/16 threat-modelling, not after.
- [v2.0 calendar]: this milestone is wait-dominated (30-90 min closure builds, physical reboot UAT, clean-machine tests, Store certification queues in days). Plan counts hold; wall-clock roughly doubles vs v1.0.

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
| uat_gap | Phase 05 Notes: 3 pending human UAT scenarios (05-HUMAN-UAT.md, status partial) | Deferred — never live-tested | v1.0 close 2026-07-14 |
| verification_gap | Phase 05: 05-VERIFICATION.md status human_needed | Deferred — pending Phase 5 live UAT | v1.0 close 2026-07-14 |
| verification_gap | Phase 06: 06-VERIFICATION.md status human_needed | Satisfied by live retest 2026-07-14 (06-HUMAN-UAT.md resolved); status field never flipped | v1.0 close 2026-07-14 |
| audit | v1.0 milestone audit never run (/gsd-audit-milestone) | Skipped by user decision at close | v1.0 close 2026-07-14 |
| polish | Rail resize feel vs demo prototype (DEFERRED-1 in 06-HUMAN-UAT.md) | Deferred by user ("not perfect but let's move on") | v1.0 close 2026-07-14 |
| review | Phase 06 Info findings IN-01..IN-07 (06-REVIEW.md) | Open, low severity | v1.0 close 2026-07-14 |
| security | /gsd-secure-phase 3 outstanding | Open | v1.0 close 2026-07-14 |

## Session Continuity

Last session: 2026-08-04T04:19:37.387Z
Stopped at: Phase 8 context gathered; Nix-native rule adopted milestone-wide
Resume file: .planning/phases/08-spike-k-nix-native-substrate-service/08-CONTEXT.md

## Operator Next Steps

- Plan the first v2.0 phase with `/gsd-plan-phase 8` (runs on the Windows box — re-import the NixOS-WSL image first)
