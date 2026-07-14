# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Desktop Shell MVP

**Shipped:** 2026-07-14
**Phases:** 7 | **Plans:** 35 | **Timeline:** 9 days (2026-07-06 → 2026-07-14), 277 commits, ~15.9k LOC (TS/TSX/Rust/CSS), 203 tests green

### What Was Built
- Pixel-perfect frameless Tauri 2 shell: 40px title bar, DIVI chip, green #86A38C accent, 10px rounded window card, locally bundled IBM Plex
- Dockable workspace: dockview-core center dock, bespoke left rail (3 modes, drag-resize, reorder/pin, drag-out-to-dock), crash-safe persistence with named layouts
- Applet framework: static registry + five-member `host` seam, high-fidelity demo stubs for every applet, Notes as the real proving applet (storage + live AI summarize)
- Dashboard Assistant: multi-session panel, proposal quote blocks (y/d/n, ＋MAKE CARD), bespoke resize with snap — backed by a real headless Pi sidecar behind `host.ai()` (Phase 7)
- Metro Home dashboard: 33-card registry, 4 sections, dnd-kit drag with FLIP, debounced persistence, assistant→Home card mint

### What Worked
- The code-review gate caught criticals past green suites in **every** phase that shipped code (3 criticals in Phase 6 alone, including a functionally-broken resize) — the gate is load-bearing, never skip it
- Grow-don't-replace for cross-phase components (Phase 6 grew Phase 7's AssistantPanel) avoided a merge disaster between parallel phases
- Pattern-mapper + spike-findings memory made planning concrete: recovered exact snap thresholds and prototype algorithms instead of inventing them
- Diagnosis-first gap-closure plans (fail-pre-fix tests before fixes) turned vague "it's janky" UAT feedback into three confirmed root causes in one pass

### What Was Inefficient
- Live UAT came last, so pointer-feel bugs (dead toggle wired to the wrong rail action, no live width during drag) survived 193 green tests and required a same-day gap-closure round — a 5-minute manual smoke test after Wave 3 would have caught them earlier
- The launch landmine (debug exe loads devUrl without `--features tauri/custom-protocol`) cost a build-launch-debug cycle at UAT time
- Phase 5's human UAT was never run and got deferred at close — UAT debt compounds silently

### Patterns Established
- Executors run sequentially on the main tree (worktrees off for this repo); orchestrator owns tracking writes
- Pure-function extraction for testability: `railSnap`/`assistantSnap`/`proposalParse`/`homeCardsReducer` all unit-boundary-tested, components stay thin
- Cross-surface communication only via shellStore (no direct assistant↔home imports)
- `window` resize dispatch per pointermove is the way to make dockview follow live drags

### Key Lessons
1. jsdom cannot verify pointer interactions — any drag/resize/toggle feature needs a live human pass before its phase closes, not at milestone end
2. "Green tests + tsc clean" is necessary but never sufficient; the false-green pattern struck in Phases 3, 4, 5, and 6
3. Debug Tauri builds need `cargo build --features tauri/custom-protocol` after `npm run build`, or the exe dials the dev server
4. When two phases touch the same component, declare ownership boundaries in memory up front (Phase 02/07 boundary note prevented conflicts)

### Cost Observations
- Model mix: opus for planning, sonnet for execution/research/verification, haiku for plan-checking — no quality complaints at any tier
- Notable: the two UAT gap plans took ~13 min of execution combined because diagnosis happened at planning time with the prototype as reference

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Days | Standout process change |
|-----------|--------|-------|------|-------------------------|
| v1.0 | 7 | 35 | 9 | Code-review gate + live-UAT gap closure became the standard close loop |

### Recurring Lessons

- False-green mocked/unit tests (every phase) → keep the review gate and at least one live check per interactive feature
