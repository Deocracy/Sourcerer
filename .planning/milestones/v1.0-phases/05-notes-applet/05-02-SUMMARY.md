---
phase: 05-notes-applet
plan: 02
subsystem: ui
tags: [react, host-ai, notes, applet-framework]

# Dependency graph
requires:
  - phase: 05-notes-applet
    provides: "Plan 05-01's Notes applet (two-pane CRUD, module-level store, per-tab selection) — this plan extends its editor toolbar"
provides:
  - "The Summarize AI action on Notes — host.ai() call, ephemeral inline result, honest-degrade error"
  - "Proof that the full registry → host → storage → ai loop works end-to-end through one real applet"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ephemeral request-response UI state cleared on selection change (not persisted to host.storage) — reusable by any future applet adding a one-shot AI action over an editable list-selection shape"
    - "Single try/catch over host.ai()'s Promise (never invoke a raw Tauri command) covers both in-band error events and the sidecar's 120s inactivity watchdog as one honest-degrade UI state"

key-files:
  created: []
  modified:
    - src/applets/Notes/index.tsx
    - src/applets/Notes/Notes.module.css
    - src/applets/Notes/Notes.test.tsx

key-decisions:
  - "Summary/summarizeError state cleared inside selectNote() (not a separate useEffect keyed on selectedId) — one single mutation point already existed for per-tab selection and D-03 ephemeral reset piggybacks on it directly"
  - "Error copy uses the literal HTML entity &#39; for the apostrophe in 'Couldn't summarize this note.' — avoids any ambiguity with unescaped-entity lint rules while rendering the identical DOM text the test/spec require"

patterns-established:
  - "Pattern: an applet-local async handler wraps host.ai() in try/catch/finally with three local state flags (result, in-flight, error) and resets all three on every navigation/selection change that would make a stale result misleading — the shape any future applet's first host.ai() consumer should copy"

requirements-completed: [NOTE-02]

# Metrics
duration: ~15min
completed: 2026-07-13
---

# Phase 5 Plan 2: Notes Applet — AI Summarize (NOTE-02) Summary

**Notes gets a real "Summarize" action wired to the live host.ai() seam — an accent toolbar button that calls host.ai(prompt), renders the genuine completion inline as a muted serif-italic block, and shows an honest-degrade error on failure, completing the registry → host → storage → ai loop end-to-end.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-13
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Notes is now `host.ai()`'s first real, non-mocked consumer — proving the full applet framework loop (registry → host → storage → AI) end-to-end through one real applet, closing out the phase's core value statement
- Summarize button added to the editor toolbar (accent color, disabled + "Summarizing…" label while in flight)
- Resolved completions render inline below the toolbar as a muted serif-italic block using only existing `tokens.css` values (`--font-serif`, `--color-muted`, `--fs-body`, `--lh-body`)
- One try/catch around `host.ai()`'s Promise covers both in-band error events and the 120s inactivity watchdog (Phase 7) as a single honest-degrade UI state — "Couldn't summarize this note." / "Check your connection and try again." — never a hang
- Summary is fully ephemeral (D-03): cleared on every note-selection change inside `selectNote()`, never written to `host.storage`

## Task Commits

Each task was committed atomically:

1. **Task 1: Author failing NOTE-02 tests — summarize success + summarize error (RED)** - `faa13ba` (test)
2. **Task 2: Summarize action — host.ai() call, inline ephemeral result, honest-degrade error (GREEN)** - `f3412be` (feat)

_TDD task 2 built directly on task 1's RED test file; no separate refactor commit was needed — the implementation matched the test contract on the first pass._

## Files Created/Modified
- `src/applets/Notes/index.tsx` - added `summary`/`summarizing`/`summarizeError` local state, `handleSummarize()` (try/catch/finally around `host.ai()`), the Summarize toolbar button, inline result/error blocks, and a D-03 ephemeral reset inside `selectNote()`
- `src/applets/Notes/Notes.module.css` - added `.summarize` (accent button, disabled state), `.summaryBlock` (muted serif-italic result), `.summaryError` (same typographic treatment for the honest-degrade copy) — all `tokens.css`-keyed, zero new tokens
- `src/applets/Notes/Notes.test.tsx` - extended `makeStubHost()` to accept an overridable, `vi.fn()`-wrapped `ai`; added "summarize" (success, asserts prompt content + inline render) and "summarize error" (asserts honest-degrade copy, no hang) tests

## Decisions Made
- Ephemeral reset (`setSummary(null)` / `setSummarizeError(false)`) lives inside the existing `selectNote()` function rather than a new `useEffect` — the function was already the single mutation point for per-tab selection, so D-03's "clear on note switch" requirement attaches there with no new effect/dependency array to reason about
- Summarize button carries no `aria-label` override (unlike Delete's stable-through-confirm label) — its visible text never needs to diverge from its accessible name, so plain button text is sufficient and matches the test's `getByRole("button", { name: "Summarize" })` query directly

## Deviations from Plan

None - plan executed exactly as written. The prompt string, error copy, button states, and ephemeral-reset location all matched the plan's `<behavior>`/`<action>` blocks on the first implementation pass; no auto-fixes were needed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. `host.ai()` was already wired to the live Pi sidecar by Phase 7; this plan only added a new consumer.

## Next Phase Readiness
- NOTE-02 is fully implemented and covered by automated tests (`npx vitest run src/applets/Notes/Notes.test.tsx -t "summarize"` — 2/2; `npx vitest run src/applets/Notes` — 5/5; `npx vitest run src/applets/boundary.test.ts` — 1/1 green; `npx vitest run` — 124/124 full suite green; `npx tsc --noEmit` clean)
- **Deferred to end-of-phase manual verification** (per `.planning/config.json`'s `human_verify_mode: "end-of-phase"`, and this plan's `<human-check>` which is not a `checkpoint:human-verify` gate in this autonomous plan): build+launch `sourcerer.exe` with the Pi sidecar running, click Summarize on a real note and confirm a genuine completion renders within seconds, switch notes to confirm the summary disappears (ephemeral), and stop the sidecar to confirm the honest-degrade copy renders without hanging. All three are architecturally implemented and exercised indirectly by the automated suite (mocked-host success/error paths, D-03 reset logic) but not yet observed against a real running Tauri build with a live sidecar.
- Phase 5 (notes-applet) is now feature-complete: NOTE-01 (Plan 01) + NOTE-02 (Plan 02) both implemented and green. Ready for end-of-phase human verification and phase transition.

---
*Phase: 05-notes-applet*
*Completed: 2026-07-13*

## Self-Check: PASSED

All 3 modified files confirmed present on disk with the expected changes; both task commit
hashes (faa13ba, f3412be) confirmed present in `git log --oneline --all`.
