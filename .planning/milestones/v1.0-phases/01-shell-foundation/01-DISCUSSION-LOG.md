# Phase 1: Shell Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 1-shell-foundation
**Areas discussed:** Foundation depth

---

## Gray-area triage

Phase 1 was found to be heavily spec-cleared: the LOCKED design handoff, the approved `01-UI-SPEC.md`, and the "Technology Stack" / "What NOT to Use" sections of CLAUDE.md already settle nearly every decision (visuals, interactions, stack, versions, fonts, drag region, omitted chrome). The DPI-at-scaling and `cargo run` vs `cargo tauri dev` items were classified as **researcher flags, not user decisions**.

The user asked directly whether any decision genuinely needed their input. Answer given: only one — foundation depth — because it is a taste/scope call rather than a technical one. All other items were taken with builder defaults.

---

## Foundation depth

| Option | Description | Selected |
|--------|-------------|----------|
| Seed foundation | Title bar + empty body AND establish the app-shell `34px 1fr` grid + full `tokens.css` (all UI-SPEC tokens). Still a thin slice: no logic/store/rail/dock. | ✓ |
| Strict thin slice | Literally title-bar-only; introduce tokens.css + grid in Phase 2 when first needed. Maximally YAGNI; risks a small Phase 2 rebuild. | |

**User's choice:** Seed foundation (Recommended)
**Notes:** Nearly free since UI-SPEC already enumerates every token; avoids a throwaway title bar rebuilt in Phase 2; every later phase mounts into the grid and consumes the tokens. → CONTEXT.md D-01.

---

## Claude's Discretion

- **State store timing (D-02):** Phase 1 stays stateless — maximized state via Tauri window events; Zustand deferred to Phase 2.
- **Scaffold reconciliation (D-03):** Keep generated Tauri/Vite dev-loop wiring, delete only the demo UI/`greet`, explicitly pin React 18.2.x, per-weight `@fontsource` imports.
- Window-control glyphs, hover states, logo SVG, and foundation folder structure — implement per UI-SPEC / CLAUDE.md conventions.

## Deferred Ideas

None — discussion stayed within phase scope.
