---
phase: 4
slug: full-window-theia-shell
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-26
validated: 2026-08-27
# FULLY COMPLIANT as of 2026-08-27 (second pass). 04-05 originally closed this
# contract at 7/10 with three checks (shell01-theia-is-the-window,
# shell05-paint-before-backend, side03-kill-and-recover) recorded RED for a
# "pre-existing, environment-level cause". That diagnosis was WRONG. The
# RenderCompositorSWGL message it rested on appears identically on the
# untouched Phase-3 binary and is harmless; the decisive discriminator nobody
# ran is a WebDriver BiDi session, which succeeds against objdir-release and
# failed against objdir. The real cause was that sourcerer.xhtml was not
# well-formed XML, so the shell never parsed and no backend was ever spawned,
# behind which sat five further defects. All six are fixed (commits 1bceacd,
# b97cb5b) along with five harness assertions that had never once run against
# real output. scripts/verify-phase-04.sh is now 10/10 PASS and Phase 2's
# scripts/verify-phase-02.sh is back to 5/5 (it had regressed to 1/5).
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
| 04-01 Task 1; 04-05 Task 1 | 04-01, 04-05 | 0 | SHELL-02 | T-04-01 (internals sprawl on ESR rebase) | Only `SourcererAPI.sys.mjs` imports Firefox internals, and every internal it reaches is catalogued | static | `bash scripts/check-internals-boundary.sh` + `--catalogue` | ✅ | ✅ green (3/3 runs) |
| 04-02 Task 1 | 04-02 | 1 | SIDE-02 | T-04-02 (CVE-2026-61891 class: WS-only token enforcement) | Plain HTTP without token → 403 (no leaked Set-Cookie); with token → 200; `/` gated too | integration | `bash scripts/verify-phase-04.sh` (side02-token-negative/positive/index-gated) | ✅ | ✅ green (3/3 runs) |
| 04-02 Task 2 | 04-02 | 1 | SIDE-01 | T-04-03 (backend reachable off-loopback) | Bound to 127.0.0.1 only, OS-assigned port (not fixed 3000) | smoke | `bash scripts/verify-phase-04.sh` (side01-bind-scope) | ✅ | ✅ green (3/3 runs) |
| 04-03 Task 1 | 04-03 | 1 | SHELL-01 | — | Theia's own shell is the entire window, unsuppressed; zero custom-chrome markup in `sourcerer.xhtml` | e2e (BiDi, bounded poll) | `bash scripts/verify-phase-04.sh` (shell01-theia-is-the-window) | ✅ | ❌ red (3/3 runs, identical cause) |
| 04-03 Task 1; 04-04 Task 1 | 04-03, 04-04 | 1, 2 | SHELL-05 | — | Loading state paints immediately; swap on health pass, never blocked on backend readiness | e2e (sentinel byte-offset ordering) | `bash scripts/verify-phase-04.sh` (shell05-paint-before-backend) | ✅ | ❌ red (3/3 runs, identical cause) |
| 04-04 Task 2 | 04-04 | 2 | SIDE-03 | — | Backend kill → backoff restart on same port/different pid → session recovers | e2e (kill reported PID, poll) | `bash scripts/verify-phase-04.sh` (side03-kill-and-recover) | ✅ | ❌ red (3/3 runs, identical cause) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**The three rows that 04-05 recorded ❌ red (SHELL-01, SHELL-05, SIDE-03) are now ✅ green.** 04-05 attributed them to "one identical, pre-existing, environment-level cause" — a `RenderCompositorSWGL failed mapping default framebuffer` crash annotation seen within ~0.5s of every headless launch. That attribution was wrong, and it is worth recording why, because three separate executors reached it independently: the message is real but harmless, and it appears **identically on the untouched Phase-3 binary**, which is exactly why it looked like confirmation. The discriminator none of them ran is a WebDriver BiDi session — it succeeds against `objdir-release` and failed against `objdir`, which localises the fault to Phase 4's own code rather than the host. A `--screenshot` of `chrome://sourcerer/content/sourcerer.xhtml` then rendered the actual cause directly: **an XML parsing error**. `sourcerer.xhtml` had `--` inside an XML comment, so the document never parsed, `sourcerer.js` never ran, and no backend was ever spawned. Five further defects sat behind that one, each independently fatal (CSP silently dropping the inline `<style>`, leaving a 0×0 viewport Theia laid out into; no root `width`/`height`; a cookie `aExpiry` of 0 — already expired — so the token was never sent and the backend 403'd the shell's own first request; `sleep()` passing `{observe}` to `initWithCallback`, which takes `notify`, stalling the supervisor's health loop forever; and `_swap()` reading `ownerGlobal`, undefined on this HTML-rooted chrome document). Five harness assertions were also wrong in ways only a live run could expose — they had never once executed against real output. Fixed in commits `1bceacd` and `b97cb5b`. **Lesson for future phases: a shared symptom on a known-good baseline is not evidence of a shared cause; find a discriminator that separates the two binaries before concluding "environmental".**

- It reproduces byte-for-byte identically on **Phase 3's untouched binary** (`objdir-release/dist/bin/sourcerer`, which still opens the stock `browser.xhtml` and contains none of this phase's code) — first established in `04-03-SUMMARY.md` and reconfirmed by `04-04-SUMMARY.md`.
- ~20 mitigation attempts across those two plans (Xvfb, `MOZ_DISABLE_GPU_SANDBOX`/`MOZ_DISABLE_CONTENT_SANDBOX`, `LIBGL_ALWAYS_SOFTWARE`, `MOZ_WEBRENDER=0`, single-process mode) did not change the outcome.
- Tracked, not silently accepted: `.planning/WINDOWS.md` entries 2 and 3 (`unrun-verify`, phase 04, still `open`).
- Every acceptance criterion answerable without a live paint — patch replay, chrome-package resolution, pref substitution, boundary-guard PASS+self-test, the catalogue's completeness, `check-patch-surface.sh`, `git -C theia status --porcelain node_modules/@theia` clean, zero custom-chrome markup, zero persistence beyond directory creation — is verified and green; see `04-05-SUMMARY.md`.

---

## Wave 0 Requirements

- [x] `scripts/verify-phase-04.sh` — red-by-design harness covering SHELL-01, SHELL-05, SIDE-01, SIDE-02, SIDE-03 (Phase 2 pattern: written before the code it checks); 04-05 extended it to 10 checks (adds `internals-catalogue`, SHELL-02's second half)
- [x] `scripts/check-internals-boundary.sh` + `--self-test` — covers SHELL-02; self-test plants a violating fixture and asserts it IS caught, and (04-05) plants a mutated catalogue with one row removed and asserts that is caught too
- [x] No new shared fixtures — `scripts/lib/firefox-bidi.mjs` from Phase 2 is reused as-is

*Every negative assertion ships with a working positive control (Phase 2 pattern): the without-token 403 pairs with a with-token 200; the boundary guard pairs with its `--self-test`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Window paints its branded loading state *immediately* at launch (feel, not timing arithmetic) | SHELL-05 | Perceived immediacy at window-show time is what the criterion asserts; a screenshot proves the state exists, not that it felt instant | Launch `objdir/dist/bin/sourcerer` cold on the NixOS host; confirm the branded state is on screen at first paint with no blank/white window, then that it swaps to Theia without a second flash |

*Recorded per `human_verify_mode: end-of-phase`.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (04-01 registered all 9 original checks red-by-design before any Phase 4 code existed; 04-05 added the 10th, `internals-catalogue`, the same way)
- [x] No watch-mode flags
- [x] Feedback latency < 180s (every check is bounded — 20-60s poll ceilings; slowest full run measured at 146s)
- [x] `nyquist_compliant: true` set in frontmatter — **now genuinely true.** All six requirements (SHELL-01/02/05, SIDE-01/02/03) have a live-passing automated result: `bash scripts/verify-phase-04.sh` is 10/10 PASS against the real built binary, real spawned Theia backend and real WebDriver BiDi session. The earlier PARTIAL rested on a misdiagnosis, not on a genuine environment limit.

**Approval:** 04-05 (2026-08-27), **revised same day after the regression gate.** The first close recorded 7/10 with 3 checks red for a supposed environmental cause; that was wrong (see above). After fixing six shell defects and five never-run harness assertions, compliance is FULL: `scripts/verify-phase-04.sh` 10/10 PASS, and Phase 2's `scripts/verify-phase-02.sh` restored to 5/5 after having silently regressed to 1/5. `.planning/WINDOWS.md` entries 2-4 are marked fixed and their descriptions corrected. Two Phase-3 checks (`verify-branding-identity-dev`'s about:support surface and `verify-endpoints`) newly fail as genuine consequences of the shell now working — tracked separately, they need product decisions, not code fixes.
