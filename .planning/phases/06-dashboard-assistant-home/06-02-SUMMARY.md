---
phase: 06-dashboard-assistant-home
plan: 02
subsystem: ui
tags: [react, assistant, host-ai, session-management, tokens-css]

requires:
  - phase: 07-assistant-harness-core-headless-pi-sidecar-behind-the-host-a
    provides: "Real host.ai()/host.loadSession()/host.setModes() seam (Channel-based streaming, sessionId minting, CR-01 alphanumeric alphabet, D-09 restart-reload)"
provides:
  - "Multi-session Dashboard Assistant panel: session chips (real + read-only seed transcripts), header chrome (history/new-session icons, demo model picker), session switching/close, ⌘↵ send gated to real sessions"
  - "sessionSeeds.ts: SessionEntry model, 2 authored demo transcripts (one carrying a guaranteed-parseable Proposal marker for Plan 06-03), newRealSession() helper"
  - "Six --asst-* design tokens in tokens.css for Plans 06-03/06-04 to consume without further tokens.css edits"
affects: [06-03-assistant-proposals, 06-04-assistant-resize]

tech-stack:
  added: []
  patterns:
    - "Session-list-backed panel state: sessions: SessionEntry[] (real + seed) with activeSessionId selection, replacing a single useRef sessionId"
    - "Seed-then-conditionally-overwrite message load: local turns render immediately on session-switch, host.loadSession only overwrites when it returns non-empty history — preserves a freshly-minted session's local greeting without fighting the async reload"

key-files:
  created:
    - src/assistant/sessionSeeds.ts
  modified:
    - src/assistant/AssistantPanel.tsx
    - src/assistant/AssistantPanel.module.css
    - src/assistant/AssistantPanel.test.tsx
    - src/styles/tokens.css

key-decisions:
  - "Real-session persistence key generalized from sourcerer:assistant:sessionId (single id) to sourcerer:assistant:sessionIds (JSON array) — corrupt/malformed JSON falls back to minting one fresh real session (T-06-02-02), never throws at mount"
  - "Message-load effect seeds `messages` from the session entry's local `turns` first, then only overwrites with host.loadSession's history if that history is non-empty — this is what makes a freshly-minted real session show its greeting immediately without waiting on (and getting wiped by) an async empty-history reload"
  - "Send button becomes icon-labeled (aria-label 'Send message') while keeping its existing visible 'Send' text, so both the new UI-SPEC aria-label contract and the untouched Phase 7 getByText('Send') test intent are satisfied"
  - "Session-chip close is purely a local 'closedIds' filter (non-destructive) — does not delete localStorage-persisted real-session ids or seed data, matching the UI-SPEC's 'no confirm, non-destructive' contract"

patterns-established:
  - "Seed sessions (kind: 'seed') never call host.ai()/host.loadSession() — gated entirely on activeKind === 'real', consumed by Plans 06-03/06-04"

requirements-completed: [ASST-01]

duration: ~40min
completed: 2026-07-14
---

# Phase 06 Plan 02: Multi-Session Dashboard Assistant Summary

**Grew the Phase 7 single-session AssistantPanel into a multi-session panel with real + read-only seed session chips, header chrome (history/new-session icons, demo model picker), and gated ⌘↵ send — all against the unchanged `host.ai()`/`host.loadSession()` seam.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-07-14T19:45:07Z
- **Tasks:** 2 completed
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- `sessionSeeds.ts` authored with a typed `SessionEntry` model, 2 read-only demo transcripts sourced from the handoff's dc.html staged sessions ("Casey · human" style), one carrying a guaranteed-parseable `Proposal —` + blockquote marker for Plan 06-03, and `newRealSession()` reusing the CR-01 alphanumeric alphabet
- Six handoff-literal `--asst-*` tokens landed in `tokens.css` (header-h, width-default, resize-handle-w, closed-w, thread-pad, session-chip) so no later assistant plan needs to touch `tokens.css`
- `AssistantPanel.tsx` grown from a single `useRef` sessionId to a session-list model: session chips switch threads, seeds render read-only canned transcripts with a disabled composer, real sessions replay history via the unchanged `host.loadSession()` seam, "Start new session" mints + selects a fresh real session showing its greeting, and ⌘↵ sends via `host.ai()` gated to real sessions only
- Full TDD cycle: RED commit added 8 new behavior tests + adapted 5 existing D-01/D-09 tests to the generalized `sourcerer:assistant:sessionIds` storage key; GREEN commit implemented the panel — all 15 tests in the file (138 across the whole suite) pass

## Task Commits

1. **Task 1: Author sessionSeeds.ts + add --asst-* tokens** - `fde0067` (feat)
2. **Task 2: Grow AssistantPanel into a multi-session panel** - `34fc2a7` (test, RED) + `b3f6682` (feat, GREEN)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `src/assistant/sessionSeeds.ts` - SessionEntry model, 2 seed transcripts (one with an authored Proposal marker), newRealSession() helper
- `src/assistant/AssistantPanel.tsx` - multi-session panel: session list, header chrome, gated composer/send, seed-vs-real message loading
- `src/assistant/AssistantPanel.module.css` - session chip/row/header-icon/history-list/controls-row classes; thread padding switched to `--asst-thread-pad`
- `src/assistant/AssistantPanel.test.tsx` - 8 new behavior tests + 5 existing tests adapted to the new `sessionIds` list key and icon-labeled send button
- `src/styles/tokens.css` - 6 new `--asst-*` tokens

## Decisions Made
- Generalized the D-09 restart-reload persistence key from a single sessionId to a JSON array of real-session ids (`sourcerer:assistant:sessionIds`), per the plan's explicit architecture instruction — T-06-02-02 mitigated via try/catch + fresh-session fallback.
- Chose "seed-then-conditionally-overwrite" for message loading (see key-decisions above) rather than an unconditional clear-then-reload, so a freshly minted session's local greeting isn't wiped by an async empty-history response from `host.loadSession()`. This is a Rule 1 correctness fix over a literal "clear messages" reading of the plan text — the resulting behavior matches the plan's own stated acceptance bullet ("shows the new-session greeting").
- Kept the Send button's existing visible "Send" text alongside a new `aria-label="Send message"`, rather than converting to a bare icon, to satisfy the UI-SPEC's icon-only aria-label contract without invalidating the Phase 7 test's `getByText("Send")` intent (test was still updated to query by the new aria-label for consistency with new tests).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Message-load effect seeds from local `turns` before calling `host.loadSession`**
- **Found during:** Task 2 (multi-session panel implementation)
- **Issue:** A literal "clear messages then call host.loadSession" implementation would wipe a freshly-minted real session's local greeting the moment the (necessarily empty, since it has no JSONL yet) history reload resolved — contradicting the plan's own behavior bullet "'Start new session' mints... and shows the new-session greeting."
- **Fix:** The effect now seeds `messages` from the session entry's local `turns` synchronously, and only overwrites with `host.loadSession`'s replayed history if that history is non-empty. This still exercises the unchanged D-09 history-replay branch for real sessions loaded from a persisted id list (which have `turns: []` locally and a real reload to fill in).
- **Files modified:** src/assistant/AssistantPanel.tsx
- **Verification:** New test "Start new session mints a new real session and shows the new-session greeting" passes; existing D-09 restart-reload tests (mount-time history replay, empty-turns honest-degrade) still pass unchanged.
- **Committed in:** b3f6682 (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for correctness against the plan's own stated acceptance bullet; no scope creep — no new event shapes, no seam changes, no architecture beyond what the plan specified.

## Issues Encountered
- Vitest reports 8 "Unhandled Rejection" warnings (`window.__TAURI_INTERNALS__.transformCallback is not a function`) from `host.loadSession()`'s `Channel` construction firing on session-switch in tests that don't mock the `load_session` command. This is a pre-existing `@tauri-apps/api/mocks` limitation carried over from the Phase 7 test suite (the original single-session panel also called `host.loadSession` unconditionally on mount without every test mocking it) — not a regression introduced by this plan. All 15 tests in the file (and all 138 across the suite) pass; the warnings are informational only.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 06-03 (assistant proposals) can now parse `sessionSeeds.ts`'s authored `Proposal —` blockquote in the `seed-careggi` transcript and extend the `case "done":` branch left untouched this plan.
- Plan 06-04 (assistant resize) can consume the 6 `--asst-*` tokens already in `tokens.css` without further token edits.
- No blockers.

---
*Phase: 06-dashboard-assistant-home*
*Completed: 2026-07-14*
