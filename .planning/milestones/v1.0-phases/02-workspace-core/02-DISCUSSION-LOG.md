# Phase 2: Workspace Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-07
**Phase:** 2-workspace-core
**Areas discussed:** Rail drag-to-dock fidelity (1 founder call; other 3 gray areas delegated to Claude)

---

## Gray-area triage

Phase 2 is heavily UI-SPEC-cleared (02-UI-SPEC.md locks all visuals/interaction/tokens; CLAUDE.md
locks the stack; the prototype provides the porting reference). Four candidate gray areas were
surfaced:

| Candidate | Disposition |
|-----------|-------------|
| Persistence boundary (P2↔P3) | Delegated to Claude → defaulted (D-02) |
| Floating-window rework depth | Delegated to Claude → defaulted (D-03) |
| Rail drag-to-dock fidelity | **Discussed — founder call (D-01)** |
| Req-text vs UI-SPEC reconcile | Delegated to Claude → recorded as settled (D-04) |

User response to the multiSelect: *"Ask me the question that you need answered because most of these
look like you can figure them out."* → Narrowed to the single genuine founder-appetite question.

---

## Rail drag-to-dock fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| Full 28%-zone preview (to spec) | Complete green-overlay 5-zone drag-out exactly as UI-SPEC locks it. Highest fidelity, most fragile part of the phase. | ✓ |
| MVP: drop = new tab, polish later | Drop opens a new tab in the active group; defer the 28%-zone overlay + directional split to a later polish pass. | |
| Full zones, no live preview overlay | Directional 5-zone drop but skip the render-during-drag green overlay; resolve by cursor position at release. | |

**User's choice:** Full 28%-zone preview (to spec)
**Notes:** Founder explicitly accepted this as the phase's highest-risk item, choosing full fidelity
over an MVP de-risk. Captured as D-01 with researcher/planner flags (bespoke↔dockview `api.addPanel`
seam; sequence as its own slice with a new-tab fallback path).

---

## Claude's Discretion

- **D-02 Persistence boundary** — stay live in Zustand; wire only the dockview-native serialize/restore
  + Wiki→Library fallback that DOCK-03 requires (placeholder localStorage key + canary). Defer the full
  persistence contract (schemaVersion, migration, named layouts, flush-on-close, tauri-plugin-store,
  whole-workspace state) to Phase 3.
- **D-03 Chrome rework staging** — chrome/token deltas first, then the Tauri `transparent:true`
  floating rounded window as its own commit paired with a Phase-1 DPI + drag re-verify.
- **D-04 Req-text vs UI-SPEC** — dockview-native docking/splits/resizers supersede the roadmap's literal
  "5px resizers + prototype preview UI"; DOCK-02/03 verify against dockview's themed behavior. Recorded
  so the verifier doesn't false-flag.

## Deferred Ideas

None — discussion stayed within phase scope. Adjacent items (persistence, right assistant rail, Home
overlay/metro dashboard, real applet bodies, corpus-switcher behavior) are already roadmap-scoped to
Phases 3/4/5/6.
