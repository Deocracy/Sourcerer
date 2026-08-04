---
phase: 05-notes-applet
verified: 2026-07-13T08:35:00Z
status: human_needed
score: 12/12 must-haves architecturally verified (3 require live-app observation)
overrides_applied: 0
notes:
  - "Roadmap success criterion #2 says 'receive a stub response' — 05-02-PLAN.md documents this as
     intentionally superseded by Phase 4 D-01 (host.ai() routes to the live Pi sidecar, shipped in
     Phase 7). This is a pre-existing, documented decision, not a phase-5 deviation — treated as
     satisfied, not a gap."
  - "ROADMAP.md marks this phase mode: mvp, but the phase-level goal text is not in strict
     'As a ... I want ... so that ...' format (gsd-sdk user-story.validate returns false). Each
     plan's own Phase Goal section IS in valid User Story format, so MVP-mode narrowing was applied
     at the plan level even though the roadmap phase-goal string itself doesn't pass the regex.
     Flagging as informational — did not block verification since substance is unambiguous and the
     plan-level user stories supply the missing narrowing."
---

# Phase 5: Notes Applet Verification Report

**Phase Goal:** One real applet, Notes, that exercises the entire framework loop end-to-end
(registry → host → storage → ai seam) and proves a stub can be replaced by working functionality.
**Verified:** 2026-07-13T08:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can click + New Note and a blank note is created, selected, and title-focused | VERIFIED | `store.ts:63-69` (`addNote`), `index.tsx:145-150` (`handleAddNote` → `selectNote` + `focusTitleRef`); test "create" passes |
| 2 | Editing title/body auto-saves (debounced 400ms + flush on blur), no Save button | VERIFIED | `store.ts:144-161` (`scheduleNotesSave`/`flushNotesSave`, read-at-flush per CR-01 fix); `index.tsx:248-249,281-282` (`onBlur={flush}`); no Save button in JSX; test "edit" passes |
| 3 | Editing a note bumps it to the top (most-recently-updated first) | VERIFIED | `store.ts:71-78` `updateNote` calls `sortByUpdatedDesc` on every mutation |
| 4 | Delete via two-step inline confirm; next note down selected, or empty state | VERIFIED | `index.tsx:166-178` (`handleDeleteClick`, 3s timer), `store.ts:80-89` (`deleteNote` returns next-slot id); WR-01 fix disarms confirm on selection change (`index.tsx:130-133`); test "delete" passes |
| 5 | Two open Notes tabs mirror each other's edits live via one shared module-level store | VERIFIED (architecture) / **human_needed** (live observation) | `store.ts:59` module-level `createStore` singleton imported once by `registry.ts`'s static import — guarantees shared state by construction; not exercised against two real rendered dockview panels in a running app |
| 6 | Each tab restores its own last-selected note across relaunch; missing/GC'd id falls back silently | VERIFIED | `index.tsx:68-78` (D-06/D-07 restore + fallback to `notes[0]`), WR-02 repair effect (`index.tsx:86-97`) for a note deleted by another tab; new WR-05 test "D-06: restores the saved selectedNoteId over the most-recent default" passes |
| 7 | Notes renders with `APPLET · NOTES · NOTE` eyebrow, NO DEMO chip, passes boundary test | VERIFIED | `index.tsx:207-209` eyebrow; no `.demoChip` element anywhere in JSX (grep confirmed); `npx vitest run src/applets/boundary.test.ts` green |
| 8 | Notes + selected-note-id persist and survive a real app relaunch | VERIFIED (architecture) / **human_needed** (live observation) | `host.storage.set("notes", ...)` write-through + `scheduleWorkspaceSave()` write-through of `instanceState`; both seams pre-exist from Phase 3/4 and are unit-tested at the store/instanceState boundary, but not observed against a real built `sourcerer.exe` relaunch |
| 9 | Registry override replaces the Notes stub (FWK-02 literal swap) | VERIFIED | `src/shell/registry.ts:4,25` — `import * as NotesModule ...; Notes: NotesModule,` |
| 10 | User can click Summarize and receive a real AI completion rendered inline | VERIFIED (architecture) / **human_needed** (live sidecar observation) | `index.tsx:186-201` `handleSummarize` calls `host.ai(prompt)` in try/catch; renders `summary` inline (`index.tsx:270`); tests "summarize" (mocked) pass; not observed against the live Pi sidecar |
| 11 | While in flight the button reads "Summarizing…" and is disabled | VERIFIED | `index.tsx:256,259` |
| 12 | Summary is ephemeral — clears on note switch, never persisted; no leak across notes (D-03) | VERIFIED | `index.tsx:141-142` (`selectNote` resets `summary`/`summarizeError`); CR-02 fix — `summarizeSeqRef` token guards stale resolution (`index.tsx:54-58,129-143,186-201`); new WR-05 test "D-03: an in-flight summary that resolves after a note switch does not leak across notes" passes; `store.ts`/`index.tsx` never call `host.storage.set` with summary data (grep confirmed) |
| 13 | Summarize failure renders honest-degrade copy, never a hang | VERIFIED | `index.tsx:271-276` renders "Couldn't summarize this note." / "Check your connection and try again."; test "summarize error" passes |

**Score:** 13/13 truths architecturally verified; 3 of them (5, 8, 10) additionally require live-app
observation before being fully closed — routed to human verification per `human_verify_mode: end-of-phase`.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/applets/Notes/index.tsx` | Notes applet root, two-pane CRUD + Summarize | VERIFIED | 303 lines, exports `manifest`+`App`, all behaviors present |
| `src/applets/Notes/store.ts` | module-level zustand/vanilla store, hydrate-once, debounced write-through | VERIFIED | 161 lines, `createStore`, `ensureHydrated`, `scheduleNotesSave`/`flushNotesSave` all read-at-flush (CR-01 fixed) |
| `src/applets/Notes/relativeTime.ts` | hand-written relative timestamp formatter | VERIFIED | 16 lines, exports `relativeTime` |
| `src/applets/Notes/Notes.module.css` | two-pane layout + row/active/delete/summary styling, tokens.css only | VERIFIED | 253 lines; only two literal px values (240px list-pane width, 420px max-width) both explicitly commented as an intentional exception, all colors/other sizes are `var(--...)` |
| `src/applets/Notes/Notes.test.tsx` | mocked-host tests for NOTE-01 + NOTE-02 | VERIFIED | 251 lines, 8 tests: create/edit/delete/summarize/summarize-error + 3 WR-05 additions (D-03, D-06, CR-01) |
| `src/host/instanceState.ts` | `scheduleWorkspaceSave` re-export completing the reserved seam | VERIFIED | re-exports 5 identifiers incl. `scheduleWorkspaceSave` from `../persistence/workspaceStore` |
| `src/shell/registry.ts` | `Notes: NotesModule` real registration | VERIFIED | line 4 import, line 25 map entry |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `index.tsx` | `host.storage` | `store.ts` `ensureHydrated`/`scheduleNotesSave`/`flushNotesSave` | WIRED | confirmed calls to `storage.get`/`storage.set` at both schedule sites, now read-at-flush (CR-01 fix) |
| `index.tsx` | `src/host/instanceState.ts` | `getInstanceState`/`setInstanceState`+`scheduleWorkspaceSave` | WIRED | `index.tsx:4,71,137-138` — imported directly from `instanceState.ts`, not through the `host` prop, matching the reserved-seam contract |
| `src/shell/registry.ts` | `src/applets/Notes` | static import + map entry | WIRED | `Notes: NotesModule` overrides the templated stub |
| `index.tsx` | `host.ai` | `handleSummarize` try/catch | WIRED | `index.tsx:191` single `await host.ai(...)` call inside try/catch/finally; no direct `invoke("host_ai")` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `index.tsx` note list | `notes` (from `useNotesStore`) | `store.ts` hydrated from `host.storage.get("notes", [])`, shape-validated (`isNote` filter, WR-04 fix) | Yes — real disk-backed data, not a static stub | FLOWING |
| `index.tsx` summary block | `summary` | `host.ai(prompt)` resolution, gated by `summarizeSeqRef` token | Yes — genuine Pi-sidecar completion (Phase 7 seam), not mocked in production code | FLOWING (mocked only in tests, which is correct/expected) |
| `index.tsx` selected note | `selectedId` | `getInstanceState(host.instanceId)` seeded from `workspaceStore`, with WR-02 repair effect for staleness | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite green | `npx vitest run` | 22 files, 127/127 tests passed | PASS |
| Type check clean | `npx tsc --noEmit` | exit 0, no output | PASS |
| Boundary + five-member-Host invariants | `npx vitest run src/applets/boundary.test.ts src/host/index.test.ts` | 2 files, 3/3 passed | PASS |
| Notes suite in isolation | `npx vitest run src/applets/Notes` | included in full run above; 8/8 Notes tests passed | PASS |

Notes: `PanelBody.errorBoundary.test.tsx` prints an expected `console.error("render exploded")` stack
trace during the full-suite run — this is the error-boundary test intentionally throwing to assert
recovery UI; it is not a failure (test file still counted in the 127/127 pass total, unrelated to
Notes).

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist in this repo and neither PLAN nor SUMMARY reference
probe-based verification for this phase. Step 7c: SKIPPED (no probes declared or found).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|------------|--------------|--------|----------|
| NOTE-01 | 05-01-PLAN.md | User can create, edit, and delete persistent notes in the Notes applet (stored via host.storage) | SATISFIED | Truths 1-4, 6-7, 9 above; `requirements-completed: [NOTE-01]` in 05-01-SUMMARY.md matches code |
| NOTE-02 | 05-02-PLAN.md | User can invoke AI summarize on a note through host.ai() (stub response in v1) — proving the full framework loop | SATISFIED | Truths 10-13 above; the "stub response" clause is a documented supersession (Phase 4 D-01 — host.ai() is live, not stubbed, as of Phase 7), not an unmet requirement |

Both requirement IDs declared across the two plans (`NOTE-01`, `NOTE-02`) match exactly the two IDs
REQUIREMENTS.md maps to Phase 5 — no orphaned requirements.

### Anti-Patterns Found

None. Grepped all 7 phase-modified/created files for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|coming
soon|not yet implemented|not available` — zero matches. No empty-implementation stubs (`return
null`/`return {}`/`=> {}`) in the Notes component beyond the intentional `!hydrated ? null` gate
(CR-01 fix, not a stub — it's a deliberate pre-hydration render guard). IN-01 (list rows lack
keyboard/AT access) and IN-02 (relative-time labels never tick) remain open as documented,
deliberately-deferred Info-severity items from 05-REVIEW.md / 05-REVIEW-FIX.md — cosmetic/a11y
polish, not goal-blocking.

## Human Verification Required

### 1. Persistence across a real relaunch (NOTE-01)

**Test:** Build and launch `sourcerer.exe` (detached). Create note A, edit it, create note B and
select it. Quit the app. Relaunch it.
**Expected:** Notes A and B both persist with their edited content, and note B (the tab's
last-selected note) is still selected on relaunch.
**Why human:** Requires a real Tauri build + OS-level process relaunch against the on-disk
`tauri-plugin-store` file — cannot be exercised by a mocked-host component test.

### 2. Live two-tab mirror (NOTE-01, D-04)

**Test:** With the app running, open a second Notes tab. Edit a note in one tab.
**Expected:** The edit appears live in the other tab's list/editor without a manual refresh.
**Why human:** Requires two concurrently-rendered dockview panels in a real running app; the module-
level store singleton guarantees this by construction, but the automated tests only render one
`Notes` instance at a time (with `vi.resetModules()` between tests) and cannot observe true
concurrent-panel behavior.

### 3. Live Summarize against the real Pi sidecar (NOTE-02)

**Test:** With the Pi sidecar running, open Notes, write a note, click Summarize.
**Expected:** A real completion renders inline within a few seconds. Switch notes — the summary
disappears (ephemeral). Stop the sidecar and click Summarize again — "Couldn't summarize this
note." renders without hanging.
**Why human:** `host.ai()` is mocked in all automated tests; the actual sidecar round-trip latency,
real completion content, and the 120s-watchdog/error-event failure path can only be observed against
the live Pi sidecar process (Phase 7).

## Gaps Summary

No gaps. All must-have truths, artifacts, and key links are present, substantive, and wired in the
codebase — including two Critical and five Warning defects found by `05-REVIEW.md` that were
subsequently fixed (`05-REVIEW-FIX.md`) and re-verified directly against the current source (CR-01
read-at-flush + hydration-race guard + hydrated-gated UI; CR-02 `summarizeSeqRef` token; WR-01
confirm-disarm; WR-02 repair effect; WR-03 unmount flush; WR-04 shape-validated hydrate +
non-cached-rejection; WR-05 three new regression tests). Full suite is 127/127 green and `tsc
--noEmit` is clean. The only remaining items are the three live-app observations that
`human_verify_mode: end-of-phase` deliberately defers from blocking checkpoints — these do not
indicate an architecture gap, only that they haven't yet been eyeballed against a real running
build.

---

_Verified: 2026-07-13T08:35:00Z_
_Verifier: Claude (gsd-verifier)_
