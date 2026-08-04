---
phase: 04-applet-framework
plan: 03
subsystem: applet-framework
tags: [react, jsx, wiki, provenance, edit-flow, vitest, testing-library]

requires:
  - phase: 04-applet-framework
    plan: 02
    provides: "src/shell/registry.ts (Wiki override entry already wired), src/applets/Wiki/index.tsx (Plan-02 templated shell being replaced)"
provides:
  - "src/applets/Wiki/index.tsx — the rich Wiki demo (article view, provenance inspector, first-class Unresolved block, edit→dry-run preview→apply→undo, review queue, history) as manifest + App({host}) JSX"
  - "src/applets/Wiki/wikiContent.ts — the Ficino/Alberti corpus slice (ARTICLES/FALLBACK/REVIEW) as typed data, separated from the component"
  - "src/applets/Wiki/Wiki.module.css — host container + the shared DEMO chip class"
  - "src/applets/Wiki/Wiki.test.tsx — article render, edit→preview reachability, review queue, and Unresolved-block coverage"
affects: [04-04, 04-05, phase-05-notes]

tech-stack:
  added: []
  patterns:
    - "Local hex color literals (T object) kept module-scoped for a ported rich demo, never promoted into tokens.css, even where they duplicate existing token values — matches the handoff's own inline color-object shape 1:1 rather than reading host.theme"
    - "Component-local entity-selection state (useState, no shared store slice) for a rich demo whose shared-store analog (store.js's selection.Wiki) has no counterpart in this repo's shellStore yet"

key-files:
  created:
    - src/applets/Wiki/wikiContent.ts
    - src/applets/Wiki/Wiki.module.css
    - src/applets/Wiki/Wiki.test.tsx
  modified:
    - src/applets/Wiki/index.tsx

key-decisions:
  - "No shellStore `selection` slice added this phase (plan-sanctioned discretion) — Wiki's open entity is component-local useState seeded to \"ficino\""
  - "Rule 2 addition: a small inline entity picker (Ficino / Alberti chips) was added since nothing else in Phase 4 drives Wiki's selection — without it the Alberti Unresolved block (a must_haves truth) would be unreachable in this plan's scope"
  - "T color object kept fully local (including the entries that already mirror tokens.css, e.g. bg/panel/accent) rather than partially sourced from host.theme, for exact 1:1 fidelity with the handoff's own inline object and to avoid a two-source-of-truth color path inside one ported module"
  - "MONO/SERIF/SANS font strings reference var(--font-mono/serif/sans) instead of re-declaring the literal font-stack strings, since those tokens are stable and this avoids drift if the font stack ever changes"

patterns-established:
  - "Rich, verbatim-ported demo modules keep their source handoff's local color-literal object entirely scoped to the module, even for values that coincidentally match existing design tokens — avoids a partial-token/partial-literal split within one ported file"

requirements-completed: [FWK-03]

duration: 20min
completed: 2026-07-10
---

# Phase 04 Plan 03: Rich Wiki Demo Port Summary

**Ported the handoff's "moat" Wiki demo verbatim into JSX — article view with trust chips, a claim-level provenance inspector, the first-class Unresolved block for Alberti's disputed birthplace, the full edit→dry-run preview→apply→undo modal flow, and review-queue/history tabs — as an ordinary `manifest` + `App({host})` applet module with a subtle DEMO chip.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed (feat + test)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- Replaced the Plan-02 `TemplatedStub`-backed `Wiki/index.tsx` shell with the full ported demo: `TrustChip`, `DocRow`, `Provenance`, `Claim`, `Unresolved`, `EditFlow` (edit → preview → applied stages), `Tab`, and the top-level `Wiki` component — every `h(...)` call converted to JSX, no `React.createElement`, no CDN-hosted React import, no leftover mount function
- Moved the hand-authored Ficino/Alberti corpus (`ARTICLES`, `FALLBACK`, `REVIEW`) into `wikiContent.ts` as typed data (`WikiArticle`, `WikiClaim`, `WikiUnresolved`, `WikiReviewItem`, etc.), separated from the component per the plan
- Kept the handoff's local `T` color object (including amber `#D8C69C`/amberBg `#1E1C17`/warm `#B8A06E`/red `#B05A4E`, which have no `tokens.css` counterpart) fully module-scoped — verified `tokens.css` gained zero new amber/warn tokens
- Added the shared D-12 DEMO chip (mirroring `TemplatedStub.module.css`'s exact treatment: mono, `--color-faint`, subtle border, never accent) to the Wiki header
- Preserved all React state shape from the port: `view`, `entity`, `selClaim`, `edit`, `edited`, `review`, `toast`
- Added a component-local entity picker (Rule 2) so the Alberti Unresolved block stays reachable without a shellStore `selection` slice this phase
- Wrote `Wiki.test.tsx` covering: article title + claim render + DEMO marker; EDIT → (textarea change, since PREVIEW is gated on an actual edit) → PREVIEW CHANGES → dry-run diff + APPLY affordance; REVIEW QUEUE tab rendering rows; switching to Alberti renders the first-class Unresolved block with both Genoa/Venice candidates

## Task Commits

1. **Task 1: Port wiki.js content + components to JSX module** - `d9015a5` (feat)
2. **Task 2: Wiki component test — article + edit-flow reachability + DEMO chip** - `4568f36` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/applets/Wiki/index.tsx` - the rich Wiki demo module (manifest + App({host})), replacing the Plan-02 override shell
- `src/applets/Wiki/wikiContent.ts` - typed Ficino/Alberti corpus + review-queue data
- `src/applets/Wiki/Wiki.module.css` - host container + DEMO chip class
- `src/applets/Wiki/Wiki.test.tsx` - component coverage (4 tests)

## Decisions Made
- **No new shellStore slice:** Wiki's selected entity is `useState("ficino")`, not a shared-store field — the plan explicitly sanctioned this as low-risk discretion since a dedicated shell selection store isn't required this phase.
- **Rule 2 entity picker addition:** a minimal inline chip row (Ficino / Alberti) was added because nothing else in Phase 4 wires a selection into Wiki, and without a way to switch entities the Alberti Unresolved block — one of this plan's own `must_haves.truths` — would be structurally unreachable. This is scoped entirely inside `index.tsx`, adds no new files, and is styled to match the existing mono/faint chrome (not a new visual language).
- **Fully-local T object:** rather than partially sourcing `T.bg`/`T.accent`/etc. from `host.theme` and only keeping the amber/warm/red literals local, the entire color object was kept local (matching the ported handoff 1:1) to avoid a split-source-of-truth inside one file. `host` is still accepted per the `AppletModule["App"]` contract but unused, matching `TemplatedStub`'s own precedent of not destructuring an unused `host`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added a component-local entity picker**
- **Found during:** Task 1 (porting `wiki.js`)
- **Issue:** The ported demo reads its open entity from `store.getState().selection.Wiki`, which this repo's `shellStore` doesn't have (by plan design). Without any replacement, the component would always render Ficino and the Alberti Unresolved block — a `must_haves.truths` requirement of this plan — would be unreachable.
- **Fix:** Added a small inline mono chip row (`ENTITY` label + one chip per `ARTICLES` key) directly above the tab body, calling the same `entity`/`view`/`selClaim` reset logic the original store-subscription effect used.
- **Files modified:** `src/applets/Wiki/index.tsx`
- **Verification:** `Wiki.test.tsx`'s "shows the first-class Unresolved block when switching to the Alberti entity" test passes; manual `tsc --noEmit` clean.
- **Committed in:** `d9015a5` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical addition, directly required to satisfy this plan's own must_haves truth)
**Impact on plan:** No scope creep — a minimal, chrome-consistent addition needed to make an explicitly required interaction (Unresolved block) reachable at all.

## Issues Encountered
- Initial acceptance-criteria grep (`esm.sh|React.createElement|mountWiki` == 0) failed because the module's own header comment *described* the adaptations using those literal strings. Reworded the comment to describe the change without repeating the literal banned tokens; re-ran the grep to confirm 0.
- The `EditFlow`'s `PREVIEW CHANGES →` button is `disabled` until the textarea value actually changes (`changed = val.trim() !== claim.val`), matching the ported handoff exactly. The first test draft clicked EDIT then immediately clicked PREVIEW without editing the textarea, which silently no-op'd (disabled buttons don't dispatch click handlers in jsdom). Fixed by firing a `change` event on the textarea before clicking PREVIEW.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FWK-03 (Wiki tier-1) is complete: the rich, faithful Wiki demo is live behind the registry's existing Wiki override entry — `registry.ts` was not touched, so this plan ran independently of Plan 04 (Library) and Plan 05 (catalog).
- `npx tsc --noEmit` clean; full `npm test` 101/101 green (97 pre-existing + 4 new Wiki tests).
- No new tokens were added to `tokens.css` — verified via grep (`amber|--color-warn` count stays 0).
- Wiki's entity picker is a Phase-4-scoped stand-in; if a later phase adds a shared `selection` store slice (e.g. for rail-driven cross-applet selection), this picker's local `useState` should be reconciled with it rather than left as a second source of truth.

---
*Phase: 04-applet-framework*
*Completed: 2026-07-10*

## Self-Check: PASSED

All 4 created/modified files verified present on disk; both task commit hashes (d9015a5, 4568f36) verified present in git log.
