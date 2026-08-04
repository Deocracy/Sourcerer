---
phase: 06-dashboard-assistant-home
plan: 03
subsystem: ui
tags: [react, assistant, proposal-parsing, shellStore, d06-mint-producer]

requires:
  - phase: 06-dashboard-assistant-home
    provides: "sessionSeeds.ts seed-careggi transcript (guaranteed-parseable Proposal marker), shellStore setLastResolvedProposal/requestCardMint actions (06-01)"
provides:
  - "proposalParse.ts: pure parseProposal(text) => Proposal|null marker parser (D-02), no new host.ai() event shape"
  - "AssistantPanel proposal-quote UI: serif-italic block, y/d/n keyboard actions scoped to a focused proposal, non-destructive reversible reject"
  - "D-06 producer half: approving a proposal writes lastResolvedProposal + reveals ＋MAKE CARD, which writes pendingCardMint to shellStore for Home (06-06) to consume"
affects: [06-06-home-dashboard]

tech-stack:
  added: []
  patterns:
    - "Pure marker-parser idiom (mirrors src/shell/railSnap.ts): module-level regex constants with a WHY comment, linear line-scan, discriminated Proposal|null return, no React/DOM import"
    - "Proposal attachment happens at two call sites (session-load seeding + the done branch), both funneling through the same parseProposal(text) call and auto-focusing the surfaced proposal id"

key-files:
  created:
    - src/assistant/proposalParse.ts
    - src/assistant/proposalParse.test.ts
  modified:
    - src/assistant/AssistantPanel.tsx
    - src/assistant/AssistantPanel.module.css
    - src/assistant/AssistantPanel.test.tsx

key-decisions:
  - "Proposal attachment applied at BOTH the seed-transcript load effect and the streamed done branch (not just done) — otherwise the seed-careggi demo transcript, which never fires a done event, would never surface a proposal, contradicting the plan's own verification note ('a live/seeded reply containing a proposal shows the serif-italic block')"
  - "focusedProposalId auto-sets to the newly-surfaced proposal's message id at both attachment sites, so y/d/n work immediately without requiring an explicit click first — a click/focus on any proposal block re-targets it"
  - "target parsing captures from the first § onward in the marker line's trailing text (stripping a trailing colon), matching both the plan's synthetic fixture exactly and the real seed transcript"

requirements-completed: [ASST-02]

duration: ~35min
completed: 2026-07-14
---

# Phase 06 Plan 03: Assistant Proposals (ASST-02) + D-06 Mint Producer Summary

**Client-side `Proposal —`/blockquote marker parser plus a serif-italic proposal-quote UI in AssistantPanel with keyboard y/d/n actions and a ＋MAKE CARD CTA that writes `pendingCardMint` to `shellStore` for Home to consume.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-14T19:58:44Z
- **Tasks:** 2 completed
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- `proposalParse.ts` authored as a pure, synchronous `parseProposal(text): Proposal | null` mirroring `railSnap.ts`'s pure-fn idiom — module-level marker/blockquote regex constants, a linear line-scan (no catastrophic backtracking, bounded — T-06-03-02), and a `{ target, body, raw }` return shape
- 5 boundary fixtures in `proposalParse.test.ts`: the exact `seed-careggi` transcript text (imported from `sessionSeeds.ts`), the plan's synthetic marker string (exact expected `target`/`body` match), plain prose returning `null`, a case/whitespace-tolerant variant, and a marker-with-no-blockquote returning `null`
- `AssistantPanel.tsx` grown: `ChatMessage` extended with `proposal`/`proposalResolved`/`diffOpen`; `parseProposal` invoked both when a session's seeded transcript loads (for the seed-careggi demo, which never fires a `done` event) and in the streamed `case "done":` branch (for real sessions), each auto-focusing the newly-surfaced proposal
- Proposal UI: a `proposal-quote` block (14px serif italic, left-accent border) beneath the message text, a mono-caps `[y] approve [d] diff [n] reject` action row, and a keyboard handler scoped to `focusedProposalId` (ignored while typing in the composer) driving `y`/`d`/`n`
- D-06 producer wired: `y` calls `shellStore.getState().setLastResolvedProposal(proposal.body)` and reveals ＋MAKE CARD; clicking it calls `shellStore.getState().requestCardMint({ title, foot: "from assistant" })`; `n` toggles `proposalResolved` between `null`/`"rejected"` with no confirm dialog (reversible); `d` toggles an inline `<pre>` raw view of `proposal.raw`
- 4 new `AssistantPanel.test.tsx` cases (proposal renders on the seed transcript, `y` approves + wires `requestCardMint`/`setLastResolvedProposal`, `n` rejects reversibly with no dialog, `d` toggles the raw view) — all 19 tests in the file, and all 147 across the full suite, pass

## Task Commits

1. **Task 1: proposalParse.ts pure marker parser + boundary tests** - `788c3ac` (feat, TDD RED+GREEN combined — all 5 fixtures passed on first write, no separate RED commit needed since the parser was authored directly against the pre-written fixtures)
2. **Task 2: Render proposal blocks + y/d/n + ＋MAKE CARD (D-06 producer) in AssistantPanel** - `758f6e5` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `src/assistant/proposalParse.ts` - pure `parseProposal(text)` marker+blockquote parser, `Proposal` interface
- `src/assistant/proposalParse.test.ts` - 5 boundary fixtures mirroring `railSnap.test.ts`'s structure
- `src/assistant/AssistantPanel.tsx` - proposal attachment (session-load + done branch), y/d/n keyboard handling, approve/reject/diff/make-card action functions, proposal-quote JSX
- `src/assistant/AssistantPanel.module.css` - `.proposalBlock`/`.proposalQuote`/`.proposalRaw`/`.proposalActions`/`.actionApprove`/`.actionDiff`/`.actionReject(Active)`/`.makeCard` classes
- `src/assistant/AssistantPanel.test.tsx` - 4 new ASST-02 test cases

## Decisions Made
- Proposal attachment runs at two call sites (seed-transcript load + streamed `done`) rather than only the `done` branch the plan's task text literally described — necessary because the guaranteed-parseable demo (`seed-careggi`) is a canned transcript that is seeded directly from `turns`, never streamed through a `host.ai()` `done` event. Without this, the phase's own verification note ("a live/seeded reply containing a proposal shows the serif-italic block") would be unsatisfiable for the seed path. This is a Rule 1 correctness fix over a literal reading of the task text, not scope creep — no new event shape was added (D-02 honored).
- `focusedProposalId` auto-sets whenever a new proposal surfaces (rather than requiring an explicit click first), so the y/d/n shortcuts work immediately on the newly-shown proposal per the UI-SPEC's interaction note ("keyboard y/d/n act on the currently-focused proposal only") without an extra required step; clicking/focusing a proposal block re-targets it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Proposal attachment added at the seed-transcript load site, not only the `done` branch**
- **Found during:** Task 2 (AssistantPanel proposal rendering)
- **Issue:** The plan's task text described attaching `parseProposal` only in `case "done":`. Seed sessions (including `seed-careggi`, the phase's guaranteed-parseable demo fixture) render their canned `turns` directly and never call `host.ai()`/fire a `done` event, so a literal implementation would never show the demo proposal — contradicting the plan's own `<verification>` note.
- **Fix:** Added the same `parseProposal` + auto-focus attachment to the session-load effect's `seeded` array construction (scanning backward for the last assistant turn), in addition to the unchanged `done`-branch attachment for real sessions.
- **Files modified:** src/assistant/AssistantPanel.tsx
- **Verification:** New test "renders the seed-careggi transcript's proposal as a serif-italic quote block" passes; all other done-branch-driven tests (streaming, error, D-09 history replay) unaffected.
- **Committed in:** 758f6e5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for the plan's own verification criteria to be satisfiable; no new `host.ai()` event shape, no scope creep beyond what ASST-02/D-02 requires.

## Issues Encountered
None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `pendingCardMint` is now genuinely produced (via the ＋MAKE CARD flow) for Plan 06-06 (Home dashboard) to consume and mint a card from.
- `lastResolvedProposal` is published to `shellStore` on approve, available for any future surface that wants the last-accepted proposal text.
- No blockers.

## Self-Check: PASSED

- FOUND: src/assistant/proposalParse.ts (parseProposal + Proposal interface present, no React import)
- FOUND: src/assistant/proposalParse.test.ts (5 fixtures, all passing)
- FOUND: src/assistant/AssistantPanel.tsx (proposal attachment, y/d/n keyboard handling, requestCardMint/setLastResolvedProposal wiring)
- FOUND: src/assistant/AssistantPanel.module.css (proposal-quote/action-row/makeCard classes, no new color-danger usage)
- FOUND: src/assistant/AssistantPanel.test.tsx (4 new ASST-02 tests, 19/19 in file passing)
- FOUND commit 788c3ac: feat(06-03): add proposalParse.ts pure marker parser + boundary tests
- FOUND commit 758f6e5: feat(06-03): render proposal blocks + y/d/n + MAKE CARD (D-06 producer) in AssistantPanel
- Full suite: 147/147 tests passing (`npx vitest run`); `npx tsc --noEmit` clean

---
*Phase: 06-dashboard-assistant-home*
*Completed: 2026-07-14*
