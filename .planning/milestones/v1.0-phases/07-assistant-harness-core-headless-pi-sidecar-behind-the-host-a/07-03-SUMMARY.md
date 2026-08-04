---
phase: 07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a
plan: 03
subsystem: shell-backend
tags: [tauri, rust, sidecar, channel, host-ai, process-manager]

# Dependency graph
requires:
  - "sidecar/ NDJSON stdio protocol (protocol.ts) from 07-01"
provides:
  - "host_ai(message, sessionId, modes, onEvent: Channel) Tauri command — the real backend behind host.ai() (D-01)"
  - "set_modes(modes) Tauri command forwarding the mode seam"
  - "SidecarProcess: spawns/owns the Node Pi sidecar for the app lifetime, pumps NDJSON stdout by id"
  - "Honest-degrade (D-06): dead/absent sidecar or stuck turn -> exactly one error+done pair, never a hang or Err"
affects: [07-04]

# Tech tracking
tech-stack:
  added:
    - "tokio 1.x (sync, time features) — async mpsc channels + per-turn timeout guard for host_ai"
  patterns:
    - "Sidecar dir resolved from CARGO_MANIFEST_DIR at compile time (repo-root/sidecar), not runtime cwd — survives cargo run vs a packaged binary"
    - "Blocking std::thread NDJSON stdout pump feeds tokio::sync::mpsc::UnboundedSender per request id; host_ai awaits recv() inside its async command body"
    - "degrade_events() extracted as a pure Vec<Value>-returning helper so D-06's error+done shape is unit-testable without a live Tauri Channel"

key-files:
  created:
    - src-tauri/src/sidecar.rs
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/commands/ai.rs
  modified:
    - src-tauri/src/lib.rs
    - src-tauri/Cargo.toml
    - src-tauri/Cargo.lock

key-decisions:
  - "Dev-spawn via std::process::Command (not tauri-plugin-shell): custom #[tauri::command]s don't require a capabilities entry, and the plan's discretion note explicitly allows spawning node directly for dev; production bundling stays deferred."
  - "Stdout pump runs on a plain std::thread (blocking BufReader::lines()), not a tokio task — avoids needing tokio's process/io-util features; the reader dispatches into a Mutex<HashMap<id, tokio::sync::mpsc::UnboundedSender>> so the async host_ai command can .await rx.recv() from the tauri/tokio runtime it already runs on."
  - "120s bounded per-turn timeout (tokio::time::timeout) added around rx.recv() beyond what the plan's acceptance criteria literally required, to make the 'bounded timeout guard' requirement concrete rather than aspirational prose."
  - "degrade_events() split out as a pure function returning the two JSON values (rather than only a method that calls Channel::send) specifically so the D-06 unit test doesn't need a live tauri::ipc::Channel, which cannot be constructed outside an app/webview context."

requirements-completed: [D-01, D-06]

# Metrics
duration: ~35min
completed: 2026-07-08
---

# Phase 07 Plan 03: Rust Spine (host_ai Command + Sidecar Process Manager) Summary

**Rust owns the Node Pi sidecar for the app lifetime and exposes `host_ai`/`set_modes` Tauri commands that stream sidecar NDJSON events to the webview over a Channel, degrading honestly (error+done, never a hang) when the sidecar is down.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3/3 complete
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- `SidecarProcess` (`src-tauri/src/sidecar.rs`) spawns `node --experimental-strip-types src/index.ts` with `cwd` resolved to `<repo-root>/sidecar` via `CARGO_MANIFEST_DIR` (mirrors the sidecar's own `package.json` `start` script exactly, per 07-01's launch contract), captures piped stdin/stdout/stderr, and stores the handle plus a `write_line`/`register`/`unregister` API in Tauri managed state.
- A dedicated blocking thread pumps sidecar stdout line-by-line, defensively skips malformed or id-less lines (T-07-13), and dispatches each parsed event to whichever `tokio::sync::mpsc` sender is registered for that request id. A separate stderr thread logs diagnostics only — never env or key material (T-07-11), verified by grep.
- `commands/ai.rs` implements `host_ai(message, session_id, modes, on_event: Channel<Value>)`: writes a `prompt` line, awaits events for that turn's id, relays each verbatim to the Channel, and stops on `done`. `set_modes(modes)` forwards a `setModes` line.
- D-06 honest-degrade covers all three failure modes: `write_line` error (sidecar never spawned/dead), listener channel closing unexpectedly, and a 120s per-turn timeout — each produces exactly one `error` event then one `done` event over the Channel and returns `Ok(())`, never `Err`, never a hang.
- `lib.rs` registers `mod sidecar; mod commands;`, adds `invoke_handler![host_ai, set_modes]`, and constructs+manages the `SidecarProcess` inside `.setup()`. A failed spawn is logged but does not abort app launch (verified: no `.expect()`/`.unwrap()` on the spawn path).
- No `capabilities/default.json` change was needed — custom `#[tauri::command]`s registered via `invoke_handler` don't require a capability entry (only plugin-backed permissions do), so the flat permission list is untouched.
- `cargo build` and `cargo test` are both green: 4 unit tests cover `write_line`/`set_modes_line` returning `Err` on an absent child (never panicking), `register`/`unregister` listener bookkeeping, and `degrade_events()` producing exactly one `error` then one `done` JSON value pair.

## Task Commits

1. **Task 1: Node sidecar process manager (spawn, own, pump stdio) + Cargo deps** — `3b6767e` (feat)
2. **Task 2: host_ai + set_modes commands with Channel streaming and honest-degrade** — `79450df` (feat)
3. **Task 3: Register commands, spawn sidecar in setup(), extend capabilities** — `d8875b3` (feat)

## Files Created/Modified

- `src-tauri/src/sidecar.rs` — `SidecarProcess` spawn/own/pump/write_line/register/unregister; 3 unit tests
- `src-tauri/src/commands/ai.rs` — `host_ai` + `set_modes` commands, `degrade_events()` pure helper, 1 unit test
- `src-tauri/src/commands/mod.rs` — re-exports `ai`
- `src-tauri/src/lib.rs` — `mod` declarations, `invoke_handler`, `.setup()` sidecar spawn + `app.manage(...)`
- `src-tauri/Cargo.toml` — added `tokio` (`sync`, `time` features; already present transitively via `tauri`, now pinned directly for the listener channels + timeout)
- `src-tauri/Cargo.lock` — regenerated for the new direct `tokio` dependency

## Decisions Made

See `key-decisions` in frontmatter. Summary: dev-spawn via raw `std::process::Command` (no `tauri-plugin-shell`, no new capability needed); blocking-thread stdout pump feeding async `tokio::sync::mpsc` channels so `host_ai` can `.await` naturally; bounded 120s per-turn timeout made concrete rather than left as unenforced prose; `degrade_events()` split into a pure, Channel-free function specifically to make the D-06 behavior unit-testable (a live `tauri::ipc::Channel` cannot be constructed outside an app/webview context, so the acceptance criteria's "unit test, sidecar mocked/absent" is satisfied at the event-shape level rather than through a full Channel round-trip).

## Deviations from Plan

None — plan executed as written. The one build error encountered (missing `tauri::Manager` trait import for `app.manage(...)`) was fixed inline during Task 3 as a normal compile-error correction, not a deviation from the plan's intent.

## Issues Encountered

None blocking. `cargo build`/`cargo test` were clean after the single import fix above.

## User Setup Required

None new. A real `CEREBRAS_API_KEY` in `sidecar/.env` (per 07-01's summary) remains a prerequisite for exercising a *live* streamed turn end-to-end — that live smoke test is expected in 07-04 (frontend wiring) or a manual check, not this plan.

## Next Phase Readiness

- The command surface (`host_ai(message, session_id, modes, on_event)` / `set_modes(modes)`) matches the `<interfaces>` block in this plan exactly — 07-04 (frontend Channel wiring) can `invoke()` against it without drift.
- `SidecarProcess` is managed state (`State<'_, SidecarProcess>`), reachable from any future command that needs to write to or read from the sidecar.
- No blockers for 07-04. One thing worth a live smoke test once a real API key is in place: booting the app via `cargo run` from `src-tauri` (not `cargo tauri dev`, per the CLAUDE.md landmine) and confirming the sidecar's `{"type":"ready"}` line appears on stderr diagnostics and a real `host_ai` turn streams `text_delta`/`done` events into the webview.

## Self-Check: PASSED

- FOUND: src-tauri/src/sidecar.rs
- FOUND: src-tauri/src/commands/ai.rs
- FOUND: src-tauri/src/commands/mod.rs
- FOUND: src-tauri/src/lib.rs (invoke_handler + setup present)
- FOUND: commit 3b6767e
- FOUND: commit 79450df
- FOUND: commit d8875b3
- `cargo build` — Finished, no errors
- `cargo test` — 4 passed, 0 failed

---
*Phase: 07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a*
*Completed: 2026-07-08*
