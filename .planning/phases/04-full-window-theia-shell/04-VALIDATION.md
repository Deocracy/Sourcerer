---
phase: 4
slug: full-window-theia-shell
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-26
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (no jest/pytest) — custom zero-dependency WebDriver BiDi harness (`scripts/lib/firefox-bidi.mjs`, Phase 2), driving the built binary directly |
| **Config file** | none — `scripts/verify-phase-02.sh` / `scripts/verify-phase-03.sh` are the established shape |
| **Quick run command** | `bash scripts/verify-phase-04.sh` (Wave 0 creates it) |
| **Full suite command** | `bash scripts/verify-phase-04.sh` — one verification script per phase, extended never sibling'd |
| **Estimated runtime** | ~60–180 seconds (browser launch + sidecar spawn + settle polls) |

---

## Sampling Rate

- **After every task commit:** Run the relevant slice of `bash scripts/verify-phase-04.sh` (e.g. the token-gate curl pair alone while building the backend extension)
- **After every plan wave:** Run `bash scripts/verify-phase-04.sh`
- **Before `/gsd-verify-work`:** Full suite green, plus `bash scripts/check-internals-boundary.sh`
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

> Task IDs are assigned by the planner; this map is seeded per requirement and the planner/executor fills task IDs as plans are written.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | SHELL-02 | T-04-01 (internals sprawl on ESR rebase) | Only `SourcererAPI.sys.mjs` imports Firefox internals | static | `bash scripts/check-internals-boundary.sh` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | SIDE-02 | T-04-02 (CVE-2026-61891 class: WS-only token enforcement) | Plain HTTP without token → 403; with token → 200 | integration | `bash scripts/verify-phase-04.sh` (token pair) | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | SIDE-01 | T-04-03 (backend reachable off-loopback) | Bound to 127.0.0.1 only, OS-assigned port | smoke | `bash scripts/verify-phase-04.sh` (bind probe) | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | SHELL-01 | — | Theia's own shell is the entire window, unsuppressed | e2e (BiDi, bounded poll) | `bash scripts/verify-phase-04.sh` (shell DOM) | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | SHELL-05 | — | Loading state paints immediately; swap on health pass | e2e (early screenshot, then poll) | `bash scripts/verify-phase-04.sh` (paint/swap) | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | SIDE-03 | — | Backend kill → backoff restart → session recovers | e2e (kill reported PID, poll) | `bash scripts/verify-phase-04.sh` (kill/recover) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/verify-phase-04.sh` — red-by-design harness covering SHELL-01, SHELL-05, SIDE-01, SIDE-02, SIDE-03 (Phase 2 pattern: written before the code it checks)
- [ ] `scripts/check-internals-boundary.sh` + `--self-test` — covers SHELL-02; self-test plants a violating fixture and asserts it IS caught
- [ ] No new shared fixtures — `scripts/lib/firefox-bidi.mjs` from Phase 2 is reused as-is

*Every negative assertion ships with a working positive control (Phase 2 pattern): the without-token 403 pairs with a with-token 200; the boundary guard pairs with its `--self-test`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Window paints its branded loading state *immediately* at launch (feel, not timing arithmetic) | SHELL-05 | Perceived immediacy at window-show time is what the criterion asserts; a screenshot proves the state exists, not that it felt instant | Launch `objdir/dist/bin/sourcerer` cold on the NixOS host; confirm the branded state is on screen at first paint with no blank/white window, then that it swaps to Theia without a second flash |

*Recorded per `human_verify_mode: end-of-phase`.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
