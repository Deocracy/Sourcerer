---
phase: 04-applet-framework
plan: 04
subsystem: applet-framework
tags: [react, jsx, library, corpus, documents, confirm-flow, vitest, testing-library]

requires:
  - phase: 04-applet-framework
    plan: 02
    provides: "src/shell/registry.ts (Library override entry already wired), src/applets/Library/index.tsx (Plan-02 templated shell being replaced)"
provides:
  - "src/applets/Library/index.tsx — the rich Library demo (corpus dashboard, ingest, document detail, non-destructive promote/delete ConfirmFlow) as manifest + App({host}) JSX"
  - "src/applets/Library/libraryContent.ts — the corpora/documents/stats/activity demo data, typed and separated from the component"
  - "src/applets/Library/Library.module.css — host container + the shared DEMO chip class"
  - "src/applets/Library/Library.test.tsx — dashboard render, host.open('Wiki') review CTA, Ingest/Document view chips, and non-destructive delete confirm-flow coverage"
affects: [04-05, phase-05-notes]

tech-stack:
  added: []
  patterns:
    - "Local hex color literals (T object) kept module-scoped for a ported rich demo, matching Wiki's precedent — never promoted into tokens.css even where entries duplicate existing token values"
    - "Read-only shellStore selector for corpus context (useShellStore((s) => s.activeCorpus)) with a graceful fallback to the fullest demo corpus when the shared session-only value doesn't match a demo id — component-local useState for the selected document (no shellStore selection slice)"

key-files:
  created:
    - src/applets/Library/libraryContent.ts
    - src/applets/Library/Library.module.css
    - src/applets/Library/Library.test.tsx
  modified:
    - src/applets/Library/index.tsx

key-decisions:
  - "No shellStore selection slice added this phase (plan-sanctioned discretion) — Library's selected document is component-local useState seeded to \"doc-ficino-vita\""
  - "Corpus/stats fallback defaults to CORPORA[0] (ficino) rather than sandbox — matches store.js's own `activeCorpus: saved.activeCorpus || 'ficino'` default and keeps the review CTA (a must_haves truth) reachable, since shellStore's activeCorpus seeds to the generic \"Default\" chrome label used by TitleBar, which doesn't match any demo corpus id"
  - "T color object kept fully local (including entries that already mirror tokens.css) for exact 1:1 fidelity with the handoff's own inline object, matching Wiki's precedent — avoids a two-source-of-truth color path inside one ported module"

patterns-established:
  - "Rich, verbatim-ported demo modules keep their source handoff's local color-literal object entirely scoped to the module, and read shared shell state (where present) with a graceful demo-data fallback rather than crashing or rendering an empty/misleading state on a session-only value that predates the demo's own corpus concept"

requirements-completed: [FWK-03]

duration: ~15min
completed: 2026-07-10
---

# Phase 04 Plan 04: Rich Library Demo Port Summary

**Ported the handoff's rich Library demo verbatim into JSX — corpus dashboard with Stat tiles and a contradiction-review CTA, the Ingest pipeline-queue view, Document detail with trust/status chips, and the full promote/delete write-safety ConfirmFlow (Preview → Confirm → Undo) — as an ordinary `manifest` + `App({host})` applet module with a subtle DEMO chip, wiring the dashboard's review CTA to `host.open('Wiki')` as the live cross-applet `open` seam proof.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-10T05:59:05Z
- **Completed:** 2026-07-10T06:06:58Z
- **Tasks:** 2 completed (feat + test)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- Replaced the Plan-02 `TemplatedStub`-backed `Library/index.tsx` shell with the full ported demo: `TrustChip`, `StatusChip`, `Wire`, `Tab`, `Stat`, `Dashboard`, `Ingest`, `DocDetail`, `ConfirmFlow` (promote|delete), and the top-level `Library` component — every `h(...)` call converted to JSX, no `React.createElement`, no CDN-hosted React import, no leftover mount function
- Moved the corpora/documents/stats/recent-activity/ingest-queue/chunk-preview demo data into `libraryContent.ts` as typed data (`LibraryCorpus`, `LibraryCorpusStats`, `LibraryDoc`, etc.), separated from the component per the plan
- Wired the dashboard's review CTA (`onReview`) to `host.open('Wiki')` — the plan's live proof that FWK-04 `open` works from a real applet, exercised by the review CTA click
- Kept the handoff's local `T` color object (including amber/amberBg/warm/red, which have no `tokens.css` counterpart) fully module-scoped — verified `tokens.css` gained zero new amber/warn tokens
- Added the shared D-12 DEMO chip (mirroring `TemplatedStub.module.css`/`Wiki.module.css`'s exact treatment: mono, `--color-faint`, subtle border, never accent) to the Library header
- Preserved all three views (DASHBOARD/INGEST/DOCUMENT) and the write-safety modal, keeping promote/delete non-destructive (component state only, no data actually removed)
- Read `useShellStore((s) => s.activeCorpus)` for corpus context (Rail.tsx's established selector idiom) with a fallback to the fullest demo corpus (`ficino`) when the value doesn't match a demo id, rather than crashing or silently hiding the contradiction-review CTA
- Wrote `Library.test.tsx` covering: dashboard render (corpus heading + Stat tile) + DEMO marker; review CTA click calling `host.open('Wiki')`; INGEST view status chips (PROCESSING/FAILED); DOCUMENT view trust/status chips for the default selection; and the delete ConfirmFlow reaching its "DELETED ✓" applied state with an UNDO/REVERT affordance (non-destructive)

## Task Commits

1. **Task 1: Port library.js to JSX module wired to host.open** - `99b70d7` (feat)
2. **Task 2: Library component test — views + host.open + confirm flow + DEMO chip** - `9393cb8` (test)

## Files Created/Modified
- `src/applets/Library/index.tsx` - the rich Library demo module (manifest + App({host})), replacing the Plan-02 override shell
- `src/applets/Library/libraryContent.ts` - typed corpora/documents/stats/activity/ingest-queue/chunk-preview data
- `src/applets/Library/Library.module.css` - host container + DEMO chip class
- `src/applets/Library/Library.test.tsx` - component coverage (5 tests)

## Decisions Made
- **No new shellStore slice:** Library's selected document is `useState("doc-ficino-vita")`, not a shared-store field — the plan explicitly sanctioned this as low-risk discretion since a dedicated shell selection store isn't required this phase.
- **Corpus fallback defaults to ficino, not sandbox:** shellStore's `activeCorpus` is a session-only chrome value (TitleBar's corpus crumb, seeded to the literal string `"Default"`), with no relationship to Library's demo corpus ids (`ficino`/`medici`/`sandbox`). Falling back to `CORPUS_STATS.sandbox` (0 contradictions) would silently hide the review CTA — a `must_haves.truths` requirement of this plan. Falling back to `CORPORA[0]`/`CORPUS_STATS.ficino` instead matches the original handoff `store.js`'s own default (`activeCorpus: saved.activeCorpus || 'ficino'`) and keeps the demo's richest, most representative state visible by default.
- **Fully-local T object:** matching Wiki's precedent, the entire color object was kept local rather than partially sourcing from `host.theme`, avoiding a split-source-of-truth inside one file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corpus/stats fallback silently hid the required review CTA**
- **Found during:** Task 2 (writing `Library.test.tsx` and discovering the dashboard rendered "No open contradictions" instead of the review CTA on default render)
- **Issue:** The initial port's fallback used `CORPUS_STATS.sandbox` (0 contradictions) when `shellStore`'s `activeCorpus` (session-only, seeded to `"Default"`) didn't match a demo corpus id — this made the dashboard's review CTA, and thus the `host.open('Wiki')` proof this plan exists to demonstrate, unreachable without a rail-driven corpus switch that doesn't exist yet.
- **Fix:** Changed the fallback to `CORPORA[0]`/`CORPUS_STATS[CORPORA[0].id]` (the `ficino` entry, which has `contradictions: 5`), matching the original handoff `store.js`'s own default-to-`'ficino'` behavior.
- **Files modified:** `src/applets/Library/index.tsx`
- **Verification:** `Library.test.tsx`'s "calls host.open('Wiki') when the review CTA is clicked" test passes; `npx tsc --noEmit` clean; full `npm test` 106/106 green.
- **Committed in:** `9393cb8` (Task 2 commit)

**2. [Rule 1 - Bug] Header comment literally repeated a banned porting-adaptation token**
- **Found during:** Task 1 acceptance-criteria grep (`esm.sh|React.createElement|mountLibrary` == 0), same class of issue Plan 03 (Wiki) hit and documented
- **Issue:** The module's own header comment described the source's dropped `mountLibrary` helper by name, causing the literal-token grep to find 1 match even though no actual `mountLibrary` code remained.
- **Fix:** Reworded the comment to describe the change ("mount-into-element helper") without repeating the literal banned token.
- **Files modified:** `src/applets/Library/index.tsx`
- **Verification:** `grep -c "esm.sh|React.createElement|mountLibrary" src/applets/Library/index.tsx` == 0.
- **Committed in:** `99b70d7` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs — one a genuine reachability bug affecting a must_haves truth, one a cosmetic grep-token wording fix)
**Impact on plan:** No scope creep — both fixes are directly inside this plan's own ported file, discovered via its own acceptance criteria and test-writing process.

## Issues Encountered
- `screen.getByText` collided on several ported UI elements that legitimately repeat text in two places (e.g. "CURATED"/"PROCESSING" chips render in both a summary row and a detail view; "DELETE DOCUMENT" appears as both a button label and a modal heading). Resolved by using `getAllByText(...).length` assertions or a `{ selector: "button" }` filter where the test only cares that at least one match exists or specifically means the interactive control, mirroring `Wiki.test.tsx`'s resilient query-by-text discipline.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FWK-03 (Library tier-1) is complete: the rich, faithful Library demo is live behind the registry's existing Library override entry — `registry.ts` was not touched, so this plan ran independently of Plan 03 (Wiki, already complete) and Plan 05 (catalog).
- `npx tsc --noEmit` clean; full `npm test` 106/106 green (101 pre-existing + 5 new Library tests).
- No new tokens were added to `tokens.css` — verified via grep (`amber|--color-warn` count stays 0).
- Both rich demo ports (Wiki, Library) now independently prove `host.open()` cross-applet focus-or-open works from a real applet, not just from shell chrome.

---
*Phase: 04-applet-framework*
*Completed: 2026-07-10*

## Self-Check: PASSED

All 4 created/modified files verified present on disk; both task commit hashes (99b70d7, 9393cb8) verified present in git log.
