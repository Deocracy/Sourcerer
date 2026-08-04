---
phase: 05-notes-applet
fixed: 2026-07-13
source_review: 05-REVIEW.md
fix_scope: critical+warning
findings_in_scope: 7
findings_fixed: 7
findings_skipped: 2
status: fixed
verification:
  tsc: pass
  vitest: 127/127 pass
---

# Phase 5: Code Review Fix Report

**Scope:** Critical + Warning findings (7). Info findings (IN-01, IN-02) intentionally out of scope.

## Fixes Applied

| Finding | Severity | Fix | Commit |
|---------|----------|-----|--------|
| CR-01 | Critical | `scheduleNotesSave`/`flushNotesSave` now read the notes array at flush/call time instead of snapshotting at schedule time; `ensureHydrated` no longer clobbers local mutations that raced ahead (adopts disk state only when the store is still empty); mutation UI (editor + New Note button) gated on `hydrated`. Closes both the UI-wipe and the disk-clobber halves. | 1836e5c |
| CR-02 | Critical | Added a monotonic `summarizeSeqRef` token; `handleSummarize` captures a seq and only applies `setSummary`/`setSummarizeError`/`setSummarizing` when it still matches. `selectNote` bumps the token, so an in-flight `host.ai()` resolving after a note switch is discarded (D-03). | 1836e5c |
| WR-01 | Warning | `selectNote` now disarms the delete-confirmation (`clearTimeout` + `setConfirming(false)`) so consent given for one note never carries onto another. | 1836e5c |
| WR-02 | Warning | Added a repair effect: once seeded, a `selectedId` pointing at a note that no longer exists (e.g. another tab deleted it, D-04) re-points at the top note or null — the misleading "No notes yet" beside a populated list is gone. | 1836e5c |
| WR-03 | Warning | Added an unmount-flush effect (guarded on `hydrated`) — closing the panel / switching layouts within the 400ms debounce window no longer drops trailing edits, since React fires no blur on unmount. | 1836e5c |
| WR-04 | Warning | `ensureHydrated` validates the payload with an `isNote` shape guard (filters non-Note values) and `.catch`es hydrate rejection, flipping `hydrated` true so a corrupt applets.json degrades to empty instead of wedging Notes for the session. | 1836e5c |
| WR-05 | Warning | Added 3 tests using a controllable `deferred()`: D-03 no-leak-across-notes, D-06 saved-selection restore over most-recent default, CR-01 New-Note-disabled-until-hydrated. | 12666f5 |

## Skipped (out of scope — Info severity)

- **IN-01** (list rows mouse-only / no a11y) — accessibility enhancement, deferred.
- **IN-02** (relative timestamps never tick; future timestamps read "just now") — cosmetic, deferred.

## Verification

- `npx tsc --noEmit` — clean (exit 0).
- `npx vitest run` — 127/127 pass (124 prior + 3 new WR-05 tests).
- `npx vitest run src/applets/boundary.test.ts` — host-only seam still enforced.

---

_Fixed: 2026-07-13 · Fixer: Claude (inline, gsd-code-fixer agent cut off by session limit before applying)_
