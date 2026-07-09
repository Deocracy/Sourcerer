---
phase: 03-persistence-layouts
plan: 01
subsystem: persistence
tags: [tauri-plugin-store, persistence, schema-migration, debounce, tdd]
requires: []
provides:
  - "WorkspaceRecordV1 unified persistence schema (schemaVersion 1)"
  - "loadWorkspaceRecord/saveWorkspaceRecord over LazyStore(workspace.json)"
  - "scheduleWorkspaceSave single 300ms debounced flush authority"
  - "registerStateSources seam for Dock + shellStore consumers (03-02)"
  - "tauri-plugin-store registered + store:default capability"
affects: [03-02, 03-03, 03-04, 05-instance-state]
tech-stack:
  added: ["@tauri-apps/plugin-store 2.4.3 (npm)", "tauri-plugin-store 2.4.3 (crates)"]
  patterns: ["migrator-map while-loop (RESEARCH Pattern 1)", "flush-time getter reads (Pitfall 3)", "validate-then-migrate-then-default on untrusted JSON (T-03-01)"]
key-files:
  created:
    - src/persistence/workspaceStore.ts
    - src/persistence/workspaceStore.test.ts
  modified:
    - package.json
    - package-lock.json
    - src-tauri/Cargo.toml
    - src-tauri/Cargo.lock
    - src-tauri/src/lib.rs
    - src-tauri/capabilities/default.json
key-decisions:
  - "DEFAULT_RAIL_ORDER duplicated into workspaceStore.ts (not imported from shellStore) — the no-circular-import acceptance criterion forbids the static import; shellStore does not export it"
  - "store:default is the verified capability identifier for plugin-store 2.x"
  - "scheduleWorkspaceSave no-ops silently if no sources registered yet (nothing coherent to flush pre-wiring)"
metrics:
  duration: ~8 min (plus blocking-human package gate)
  tasks: 3 (1 checkpoint + 2 auto)
  completed: 2026-07-09
---

# Phase 3 Plan 01: Unified Persistence Backend Summary

**One-liner:** Crash-safe versioned WorkspaceRecordV1 engine on tauri-plugin-store's LazyStore(workspace.json) — validate/migrate/default-fallback load, single 300ms debounced writer reading registered live getters at flush time.

## What Was Built

- **Task 1 (checkpoint:human-verify, blocking-human):** Package-legitimacy gate for `@tauri-apps/plugin-store` (npm) + `tauri-plugin-store` (crates.io). Executor verified npm half (tauri-apps org repo, core-team maintainers, 2.4.3); orchestrator verified crates.io half (tauri-bot owner, 2.1M downloads, same official repo). Human approved.
- **Task 2 (RED, `4a4f3fb`):** Installed both halves at 2.4.3. Registered `.plugin(tauri_plugin_store::Builder::default().build())` in `src-tauri/src/lib.rs` immediately after `tauri_plugin_opener` (Resized/`ADJUSTING_MAXIMIZE` closure untouched). Added `store:default` to `src-tauri/capabilities/default.json`. Wrote `workspaceStore.test.ts` with a hoisted Map-backed LazyStore mock covering: (a) PERS-01 round-trip, (b) PERS-03 migrate-null (schemaVersion 0, no migrator → DEFAULT_WORKSPACE), (b2) corrupt-shape fallback, (c) empty store → DEFAULT_WORKSPACE, (d) PERS-04 debounce coalescing with flush-time getter reads under fake timers. Confirmed RED (module absent). `cargo check` green.
- **Task 3 (GREEN, `7ac69bd`):** Built `src/persistence/workspaceStore.ts` — `WorkspaceRecordV1` type per the interface contract, `LATEST_SCHEMA_VERSION = 1`, `DEFAULT_WORKSPACE` (dockTree null → Dock opens Wiki+Library, D-05), one `LazyStore("workspace.json")` sink (D-09), `loadWorkspaceRecord` (try/catch whole path, shape validation, migrator-map while-loop, discard-to-default on any gap/throw — T-03-01), `saveWorkspaceRecord`, `registerStateSources` module-scope getter seam, and the single `scheduleWorkspaceSave` 300ms clear-then-reset debounce that rebuilds the record from getters at flush time. `restoreCanary` re-homed as an optional record field. All 5 tests green; full suite 42/42; `tsc --noEmit` clean.

## Verification Evidence

- `npm test -- --run src/persistence/workspaceStore.test.ts` → 5/5 passed (GREEN)
- Full suite → 7 files / 42 tests passed (no regressions)
- `cargo check --manifest-path src-tauri/Cargo.toml` → exit 0
- `npx tsc --noEmit` → exit 0
- `grep -c "tauri_plugin_store::Builder" src-tauri/src/lib.rs` → 1
- `grep "store:" src-tauri/capabilities/default.json` → present
- No static import of Dock/shellStore in workspaceStore.ts (grep 0); exactly one `LazyStore("workspace.json")` (grep 1)

## Deviations from Plan

None - plan executed exactly as written. (One planned-for note: `npm run tauri add store` was skipped in favor of explicit `npm install` + `cargo add` + hand-edits, which the plan permits and which kept each of the three edits verifiable.)

## Authentication/Human Gates

- Task 1 blocking-human package-legitimacy gate: paused, human typed "approved" after dual verification (npm by executor, crates.io by orchestrator). Normal flow, not a deviation.

## Known Stubs

- `migrators` map is intentionally empty at v1 (schemaVersion 1 is the first version — there is nothing to migrate FROM). The while-loop runner is fully exercised by the migrate-null test. Future schema bumps add entries here.
- `instanceState` slot is empty `{}` by design until Phase 5 (D-10).
- D-04's visible ResetNotice on corrupt-fallback is 03-03's scope; this plan's fallback is silent-by-contract for now (the seam returns DEFAULT_WORKSPACE; the notice wiring consumes it later).

## Threat Flags

None — both new surfaces (workspace.json trust boundary, package install) were in the plan's threat model and mitigated as specified (T-03-01 validate/discard, T-03-SC human gate).

## TDD Gate Compliance

- RED gate: `4a4f3fb` `test(03-01): ...` (tests present and failing pre-impl)
- GREEN gate: `7ac69bd` `feat(03-01): ...` (all tests pass)
- REFACTOR: not needed — implementation landed clean.

## Next

03-02 wires Dock.tsx + shellStore.ts into `registerStateSources`/`scheduleWorkspaceSave`, replacing the two Phase-2 localStorage scaffolds end-to-end.

## Self-Check: PASSED

- src/persistence/workspaceStore.ts: FOUND
- src/persistence/workspaceStore.test.ts: FOUND
- commit 4a4f3fb (RED): FOUND
- commit 7ac69bd (GREEN): FOUND
