---
phase: 06-dashboard-assistant-home
plan: 01
subsystem: shell-state-persistence
tags: [zustand, shellStore, workspace.json, persistence, schema]
dependency-graph:
  requires: []
  provides:
    - "shellStore.asstWidth/assistantOpen (persisted) + homeOpen/lastResolvedProposal/pendingCardMint (session-only)"
    - "WorkspaceRecordV1.rail.asstWidth/assistantOpen"
  affects:
    - "06-02..06-06 (all downstream Phase 6 plans read/write this slice)"
tech-stack:
  added: []
  patterns:
    - "Persisted-field template: set({...}) + scheduleWorkspaceSave() (mirrors setRailWidth)"
    - "Session-only-field template: set({...}) with no persistence call (mirrors setActivePaneId)"
    - "Optional-tolerant validation: absent-or-correctly-typed check in isValidRail (no schemaVersion bump)"
key-files:
  created: []
  modified:
    - src/persistence/workspaceStore.ts
    - src/persistence/validate.ts
    - src/store/shellStore.ts
    - src/store/shellStore.test.ts
decisions:
  - "06-01: asstWidth/assistantOpen added to WorkspaceRecordV1.rail (not a new top-level slice) - keeps the persisted shape flat, mirrors railWidth/railMode exactly, no schemaVersion bump needed"
  - "06-01: homeOpen/lastResolvedProposal/pendingCardMint are session-only (never persisted) - Home overlay visibility and the D-06 assistant-to-Home mint hand-off do not need to survive a restart"
metrics:
  duration: 15min
  completed: 2026-07-14
---

# Phase 6 Plan 1: Shell Store & Persistence Contract Layer Summary

Extended `shellStore.ts` and `workspaceStore.ts` with the Wave-1 cross-surface state contract that every downstream Phase 6 plan (Dashboard Assistant resize/open, Home overlay, D-06 card-mint hand-off) reads or writes.

## What Was Built

**Task 1 — `WorkspaceRecordV1` schema extension:**
- Added `asstWidth: number` and `assistantOpen: boolean` to `WorkspaceRecordV1["rail"]` and to `DEFAULT_WORKSPACE.rail` (defaults `280` / `true`).
- `isValidRail` in `src/persistence/validate.ts` now optional-tolerantly accepts both new fields: absent (legacy pre-Phase-6 records) or present-and-correctly-typed. No `schemaVersion` bump, no migrator — absent fields default at hydration time instead.

**Task 2 — `shellStore` slice + wiring + tests:**
- Persisted: `asstWidth`, `assistantOpen` — seeded from `seedRail` with `?? 280` / `?? true` fallback, actions `setAsstWidth`/`setAssistantOpen` follow the `setRailWidth` mutate-then-`scheduleWorkspaceSave()` template exactly. Both fields flow through `getRailSubset()` and `hydrateFromDisk()` (defaulting on absence in the loaded record).
- Session-only: `homeOpen` (seed `false`), `lastResolvedProposal` (seed `null`), `pendingCardMint` (seed `null`) — actions `setHomeOpen`, `toggleHomeOpen`, `setLastResolvedProposal`, `requestCardMint`, `clearPendingCardMint`, none of which call `scheduleWorkspaceSave()`. Kept out of `getRailSubset()` exactly like `railApplet`/`badges`.
- `shellStore.test.ts` extended with: `setAsstWidth(340)` -> `getRailSubset().asstWidth === 340` + one `scheduleWorkspaceSave` call; `hydrateFromDisk` with a record missing `asstWidth`/`assistantOpen` defaults to `280`/`true`; `toggleHomeOpen()` flips `homeOpen` and is absent from `getRailSubset()`; `requestCardMint`/`clearPendingCardMint` round-trip.

## Verification

- `npx vitest run src/persistence` — 26/26 passed.
- `npx vitest run src/store/shellStore.test.ts` — 12/12 passed (includes 5 new assertions across 4 new `describe` blocks).
- `npx vitest run` (full suite) — 22 files, 131/131 passed (unrelated `PanelBody.errorBoundary.test.tsx` console error output is expected test noise from that suite's intentional error-boundary exercise, not a failure).

## Deviations from Plan

None — plan executed exactly as written.

## Key Decisions

- `asstWidth`/`assistantOpen` live inside `WorkspaceRecordV1.rail` (not a new top-level slice) to keep the persisted shape flat and directly mirror the existing `railWidth`/`railMode` fields — avoids a schema-version bump entirely.
- `homeOpen`, `lastResolvedProposal`, `pendingCardMint` are session-only by design (HOME-01 / D-06): the Home overlay's open/closed state and the assistant's proposal hand-off are ephemeral UI signals, not durable workspace state.

## Self-Check: PASSED

- FOUND: src/persistence/workspaceStore.ts (asstWidth/assistantOpen present in type + DEFAULT_WORKSPACE)
- FOUND: src/persistence/validate.ts (optional-tolerant check present)
- FOUND: src/store/shellStore.ts (six new fields + five new actions present)
- FOUND: src/store/shellStore.test.ts (new assertions present, suite passing)
- FOUND commit 2f7a042: feat(06-01): extend WorkspaceRecordV1 with asstWidth/assistantOpen
- FOUND commit 979e249: feat(06-01): add asstWidth/assistantOpen/homeOpen/pendingCardMint slice to shellStore
