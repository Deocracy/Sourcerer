# Milestones

## v1.0 Desktop Shell MVP (Shipped: 2026-07-14)

**Phases completed:** 7 phases, 35 plans, 66 tasks

**Key accomplishments:**

- Task 1 — Scaffold + frameless window (commit 99b90a9)
- Task 1 — LogoCluster + TitleBar composition (commit 09fb2c1; CSS reconciled in 0d2d8cc)
- Installed zustand 5.0.14 / nanoid / dockview-core 2.0.0 behind an approved legitimacy gate, applied the Chrome Rework token deltas (40px titlebar, green #86A38C accent, window/rail/tab token groups), and shipped the typed Zustand shell store (cycleRailMode/reorderRail/togglePin/badges) persisting the D-02 subset.
- Reworked the Phase 1 title bar to the 40px Chrome-Rework layout (DIVI chip, corpus label, rail-toggle SVG buttons around the single drag region) and added the floating rounded window (Tauri `transparent:true` + radial backdrop + 10px inner card).
- Plan:
- Built the left rail's full interaction surface — pointer-capture drag-resize with snap thresholds, Cmd/Ctrl-\\ and double-click mode cycling, 5px-threshold within-rail reorder with a drop-line indicator, and a pin-to-bottom-group toggle — mounted into the AppShell body row established by the 02-03 chrome-rework checkpoint.
- Rail rows now drag out past the rail's right edge into dockview as new panels with the full bespoke preview — floating glyph+title ghost, green 28%-edge/44%-center drop overlay resolved by a pure unit-tested `resolveDropZone`, dockview `api.addPanel({position:{referenceGroup,direction}})` on drop, and a guaranteed new-tab fallback — verified by the consolidated Phase 2 human UAT (PASSED), during which the D-03 floating inset was cut by user decision.
- One-liner:
- One-liner:
- One-liner:
- One-liner:
- One-liner:
- makeHost(instanceId, appletKey) factory assembling storage/ai/open/instanceId/theme — the five-member `host` seam applets touch, backed by a namespaced applets.json LazyStore, a promise-wrapped host.ai() over the existing Phase 7 sidecar client, and dockview focus-or-open.
- Closed the framework loop end-to-end: a static registry mapping every appletDefs key to a `{manifest, App}` module, a shared TemplatedStub carrying a subtle DEMO chip + believable per-applet demo rows, and PanelBody's dockview dispatch now renders each registered module with a live per-instance `host` instead of the old generic placeholder.
- Ported the handoff's "moat" Wiki demo verbatim into JSX — article view with trust chips, a claim-level provenance inspector, the first-class Unresolved block for Alberti's disputed birthplace, the full edit→dry-run preview→apply→undo modal flow, and review-queue/history tabs — as an ordinary `manifest` + `App({host})` applet module with a subtle DEMO chip.
- Ported the handoff's rich Library demo verbatim into JSX — corpus dashboard with Stat tiles and a contradiction-review CTA, the Ingest pipeline-queue view, Document detail with trust/status chips, and the full promote/delete write-safety ConfirmFlow (Preview → Confirm → Undo) — as an ordinary `manifest` + `App({host})` applet module with a subtle DEMO chip, wiring the dashboard's review CTA to `host.open('Wiki')` as the live cross-applet `open` seam proof.
- Replaced the Dock '+' key-cycling hack and the Rail footer's console.log no-op with one registry-fed Applet Catalog picker (LayoutsMenu-grade keyboard/click-outside behavior) driven by a session-only shellStore slice, and implemented D-19 so a registered applet key missing from a restored rail order appends at the bottom instead of being silently dropped.
- Notes replaces its templated stub with a real two-pane applet — create/edit/delete persistent notes via host.storage, a module-level zustand store mirroring edits live across tabs, and per-tab selected-note memory through the completed instanceState seam.
- Notes gets a real "Summarize" action wired to the live host.ai() seam — an accent toolbar button that calls host.ai(prompt), renders the genuine completion inline as a muted serif-italic block, and shows an honest-degrade error on failure, completing the registry → host → storage → ai loop end-to-end.
- Task 1 — `WorkspaceRecordV1` schema extension:
- Grew the Phase 7 single-session AssistantPanel into a multi-session panel with real + read-only seed session chips, header chrome (history/new-session icons, demo model picker), and gated ⌘↵ send — all against the unchanged `host.ai()`/`host.loadSession()` seam.
- Client-side `Proposal —`/blockquote marker parser plus a serif-italic proposal-quote UI in AssistantPanel with keyboard y/d/n actions and a ＋MAKE CARD CTA that writes `pendingCardMint` to `shellStore` for Home to consume.
- Bespoke pointer-capture left-edge resize grip for the Dashboard Assistant panel, reusing the rail's `railSnap.ts`/`useRailDrag.ts` pattern with an inverted right-edge drag formula, driving the persisted `asstWidth`/`assistantOpen` shellStore slice from Plan 06-01.
- Ported the design handoff's 33-entry demo card registry and all ~18 card-variant renderers into typed TSX, then wired a real `homeOpen` overlay (PINNED/FRESH/LIVING/ARCHIVE) behind DiviChip and LogoCluster, replacing DiviChip's stale `railApplet === "Home"` chrome placeholder.
- Installed dnd-kit and wired Home's four card sections into a real `DndContext`/`SortableContext`/`DragOverlay` driven by a pure, independently-tested `SectionMap` reducer, added debounced `host.storage`-equivalent persistence for section membership/order, and closed the D-06 loop by consuming `shellStore.pendingCardMint` to mint a new card into FRESH.
- Fixed two confirmed root causes of GAP-1: the title-bar right toggle now drives `shellStore.cycleAssistant()` (closed -> open -> full bounce) instead of the left rail's `cycleRailMode()`, and `useAssistantResize` now surfaces a live pixel width on every pointermove so the panel follows the drag in real time instead of snapping to its final width on release.
- Closed GAP-2 by giving the left-rail grip drag the same live-relayout + WR-06 pointercancel-teardown fix 06-07 shipped for the assistant panel, and confirmed (rather than needed to fix) that all three rail-toggle paths already cycled correctly.
- Node sidecar embedding Pi (`@earendil-works/pi-coding-agent` 0.80.3) headless behind a lean ~135-token DefaultResourceLoader-routed prompt, with a live research-mode tool-gating seam and an NDJSON stdio protocol streaming text_delta/done events.
- Finished a prior session's in-progress work: wired the already-written D-03 Databasise tool adapter and D-09 FileSessionManager into `index.ts`'s `createAgentSession` call (which no longer compiled), and authored the two missing offline test suites the plan required.
- Rust owns the Node Pi sidecar for the app lifetime and exposes `host_ai`/`set_modes` Tauri commands that stream sidecar NDJSON events to the webview over a Channel, degrading honestly (error+done, never a hang) when the sidecar is down.
- A typed `host.ai()` / `host.setModes()` wrapper over Tauri's `invoke()` + `Channel` API, and a minimal local-state chat panel that streams real replies into the shell end-to-end — the single frontend AI seam CLAUDE.md mandates.
- Human-verified the whole spine live — webview → host.ai() → Rust → Node Pi sidecar → Databasise REST — with all four end-to-end truths passing: streamed chat (D-01), Research grounding (D-03), honest degrade (D-06), and history-survives-restart (D-09, after the 07-06 gap closure).
- Added a four-layer loadSession/history replay path (sidecar protocol -> Node sidecar -> Rust Tauri command -> AssistantPanel) plus localStorage sessionId persistence, closing GAP-07-D09 so chat history survives an app restart.

---
