---
phase: 07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a
plan: 04
subsystem: frontend-host-ai-seam
tags: [react, tauri-channel, host-ai, assistant-panel, streaming]

# Dependency graph
requires:
  - "host_ai(message, sessionId, modes, onEvent: Channel) + set_modes(modes) Tauri commands from 07-03"
  - "sidecar/src/protocol.ts canonical event shapes (07-01)"
provides:
  - "src/host/ai.ts — the frontend host.ai() / host.setModes() seam over invoke + Channel (D-01, CLAUDE.md single-seam rule)"
  - "src/assistant/AssistantPanel.tsx — minimal rail chat panel proving the streamed-chat loop end-to-end"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "host.ai() constructs a fresh Tauri Channel per turn, assigns onmessage = onEvent, resolves the returned Promise on a done event; invoke() rejection is caught and delivered as an in-band error+done pair rather than thrown, so callers never need a try/catch"
    - "mockIPC hands the mock callback the SAME object reference invoke() was called with (no serialization boundary in tests) — so args.onEvent is the real Channel instance and args.onEvent.onmessage is the handler ai.ts assigned; tests drive streamed events by calling that directly instead of reimplementing Tauri's transformCallback/runCallback plumbing"
    - "Chat state kept local (useState) per 07-CONTEXT.md discretion — no Zustand store exists yet"

key-files:
  created:
    - src/host/ai.ts
    - src/assistant/AssistantPanel.tsx
    - src/assistant/AssistantPanel.module.css
    - src/assistant/AssistantPanel.test.tsx
  modified:
    - src/App.tsx
    - src/App.module.css

key-decisions:
  - "AssistantEvent discriminated union hand-authored in src/host/ai.ts (not imported from sidecar/src/protocol.ts) since the sidecar package is a separate Node project outside the Vite/React build graph; shapes are kept verbatim-identical to protocol.ts's SidecarEvent union by inspection, per the plan's canonical_refs instruction to mirror rather than import."
  - "thinking_delta events are received by the panel's onEvent handler but intentionally not rendered (07-CONTEXT.md discretion default: suppress in the minimal panel)."
  - "AssistantPanel mounts as a simple flex sibling of AppShell inside App.tsx's .card (a new .shellRow/.shellMain pair in App.module.css) rather than wiring into any rail/dock primitive — full rail integration is explicitly deferred to Phase 2/6 per the plan's objective."
  - "Test drives the mocked host_ai Channel by calling args.onEvent.onmessage(event) directly rather than routing through window.__TAURI_INTERNALS__.runCallback's index-ordered transformCallback plumbing — mockIPC never serializes invoke() args in the test process, so this is the real object reference and exercises the exact code path production ai.ts assigns (channel.onmessage = onEvent), satisfying the plan's explicit fallback allowance (\"if direct Channel invocation is awkward, assert against the host.ai seam\")."

requirements-completed: [D-01]

# Metrics
duration: ~35min
completed: 2026-07-08
---

# Phase 07 Plan 04: Frontend host.ai() Seam + Rail Chat Panel Summary

**A typed `host.ai()` / `host.setModes()` wrapper over Tauri's `invoke()` + `Channel` API, and a minimal local-state chat panel that streams real replies into the shell end-to-end — the single frontend AI seam CLAUDE.md mandates.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3/3 complete
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- `src/host/ai.ts` exports a seven-member `AssistantEvent` discriminated union (`ready`, `thinking_delta`, `text_delta`, `tool_start`, `tool_end`, `error`, `done`) mirroring `sidecar/src/protocol.ts`'s `SidecarEvent` verbatim, plus `ai(request, onEvent)` and `setModes(modes)`. `ai()` builds a fresh `Channel<AssistantEvent>`, forwards every event to the caller (including `error` — D-06 honest-degrade is delivered, never thrown), and resolves once `done` arrives. An `invoke()` rejection itself (command couldn't be dispatched at all) is caught and turned into an in-band `error`+`done` pair rather than propagating a rejected Promise, so no caller needs a try/catch around `host.ai()`.
- `src/assistant/AssistantPanel.tsx` is a plain function component with local `useState` (message list, composer text, sending flag, Research toggle) and a `useRef`-held `nanoid()` session id (stable per mount, so turns land in one file-backed sidecar session per D-09). Sending appends a user message + an in-progress assistant message, then calls `host.ai(...)`: `text_delta` appends token-by-token, `tool_start`/`tool_end` toggle a subtle "searching {tool}…" notice, `error` marks the message as an inline "assistant unavailable: {message}" notice without disabling the composer (D-06), and `done` finalizes the turn and re-enables sending. The Research toggle calls `host.setModes(["research"])` / `host.setModes([])` and reflects active state (D-02 plumbing exercisable from the UI).
- `AssistantPanel.module.css` is styled entirely from `tokens.css` custom properties (green `--color-accent`/`--color-accent-hover` on the active Research toggle and Send button, `--radius: 0` throughout, `--border-w: 1px` borders, IBM Plex via `--font-sans`/`--font-mono`) — grep confirms no hardcoded hex/px where a token exists.
- `App.tsx` mounts `<AssistantPanel />` as a flex sibling of `<AppShell />` inside the existing `.card` (new `.shellRow`/`.shellMain` rules in `App.module.css`) — a minimal right-side placement, not a rail/dock integration (explicitly deferred to Phase 2/6).
- `AssistantPanel.test.tsx` uses `mockIPC`/`clearMocks` (mirroring `WindowControls.test.tsx`'s harness) to prove: (1) a sequence of `text_delta` events streams into one assistant message in order, (2) an `error` event renders the inline unavailable notice and the Send button stays enabled (composer usable, D-06), (3) toggling Research invokes `set_modes` with `{modes: ["research"]}`. Driving mechanism: mockIPC hands the mock callback the same object reference `ai.ts` passed to `invoke()` (no serialization boundary inside the test process), so `args.onEvent` is the real `Channel` instance and `args.onEvent.onmessage` is the exact handler `ai.ts` assigned — tests call it directly rather than re-implementing Tauri's index-ordered `transformCallback`/`runCallback` plumbing, per the plan's own fallback allowance.
- Grep gates confirmed: `invoke(` for AI appears only under `src/host/` (CLAUDE.md single-seam rule); `AssistantPanel.module.css` has zero hardcoded hex codes. `npx tsc --noEmit` is clean. Full `npx vitest run` is green: 4 test files, 15 tests, including the 3 new AssistantPanel tests.

## Task Commits

1. **Task 1: host.ai() seam — typed invoke + Channel streaming wrapper** — `8e2a47b` (feat)
2. **Task 2: Minimal AssistantPanel (composer + streamed message list + mode toggle) mounted in the app** — `83e10e3` (feat)
3. **Task 3: AssistantPanel IPC-mock test (streamed reply + honest-degrade)** — `523bf13` (test)

## Files Created/Modified

- `src/host/ai.ts` — typed `AssistantEvent` union + `ai()`/`setModes()` over `invoke`+`Channel`; the sole AI `invoke` call site
- `src/assistant/AssistantPanel.tsx` — composer, streamed thread, Research toggle, local chat state
- `src/assistant/AssistantPanel.module.css` — token-only styling (green accent, 0 radius, IBM Plex, 1px borders)
- `src/assistant/AssistantPanel.test.tsx` — mockIPC streamed-reply + honest-degrade + mode-toggle test
- `src/App.tsx` — mounts `<AssistantPanel />` beside `<AppShell />`
- `src/App.module.css` — adds `.shellRow`/`.shellMain` flex layout for the new sibling placement

## Decisions Made

See `key-decisions` in frontmatter. Summary: the `AssistantEvent` union is hand-mirrored (not imported) from the sidecar's `protocol.ts` since the sidecar is a separate Node package outside the Vite build graph; `thinking_delta` is received but suppressed in this minimal panel per the context's discretion default; the panel mounts as a plain flex sibling (not a rail/dock primitive) since full rail integration is explicitly out of scope this phase; the mockIPC test drives the Channel via the real `onmessage` reference rather than Tauri's internal callback-registry plumbing, which the plan itself flagged as an acceptable fallback.

## Deviations from Plan

None — plan executed as written. One test-authoring detail worth flagging (not a deviation, an implementation choice within Task 3's explicit discretion): the plan's `<read_first>` note anticipated driving the Channel via `window.__TAURI_INTERNALS__`'s serialized `onmessage` id and offered "assert against the host.ai seam" as a fallback if that proved awkward. Neither extreme was needed — since `mockIPC` never actually serializes `invoke()` arguments within the same JS test process, the passed `Channel` object is the identical reference `ai.ts` built, so calling `args.onEvent.onmessage(event)` directly exercises the real assignment `channel.onmessage = onEvent` in production code without any Tauri-internal plumbing simulation.

## Issues Encountered

- `expect(...).not.toBeDisabled()` failed with "Invalid Chai property" — this project has no `@testing-library/jest-dom` matcher extension installed. Fixed inline (Rule 3 — blocking issue, not a new dependency) by asserting `(el as HTMLButtonElement).disabled === false` directly instead of adding a new devDependency for one assertion.

## User Setup Required

None. This plan needs no new environment variables, keys, or manual steps. A live end-to-end smoke test (real sidecar + `CEREBRAS_API_KEY` in `sidecar/.env`, booting via `cargo run` from `src-tauri` per the CLAUDE.md landmine) remains a manual verification step outside this automated plan's scope, as noted by 07-03's summary.

## Next Phase Readiness

- `host.ai()` / `host.setModes()` are now the complete, working frontend half of the D-01 spine; any future applet or panel needing AI reaches it only through `src/host/ai.ts`.
- `AssistantPanel` is intentionally minimal (no session switcher, no rail docking) — Phase 6's ASST-01/02/03 polish can replace or extend it without touching the seam contract.
- No blockers for subsequent phase 7 plans or later phases.

## Self-Check: PASSED

- FOUND: src/host/ai.ts
- FOUND: src/assistant/AssistantPanel.tsx
- FOUND: src/assistant/AssistantPanel.module.css
- FOUND: src/assistant/AssistantPanel.test.tsx
- FOUND: commit 8e2a47b
- FOUND: commit 83e10e3
- FOUND: commit 523bf13
- `npx tsc --noEmit` — clean, no errors
- `npx vitest run` — 4 test files passed, 15 tests passed (includes AssistantPanel's 3 new tests)
- grep: `invoke(` for AI confined to `src/host/`
- grep: no hardcoded hex in `AssistantPanel.module.css`

---
*Phase: 07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a*
*Completed: 2026-07-08*
