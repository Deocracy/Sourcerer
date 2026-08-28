---
phase: 5
slug: lifecycle-failure-hardening
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-27
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `05-RESEARCH.md` § Validation Architecture. Task-level rows are
> filled by the planner / `/gsd-validate-phase`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bash + `scripts/lib/firefox-bidi.mjs` (zero-dependency BiDi harness) — the established Phase 2–4 pattern, not a new framework |
| **Config file** | none — `scripts/verify-phase-05.sh` (new) follows `scripts/verify-phase-04.sh`'s structure |
| **Quick run command** | `scripts/verify-phase-05.sh --quick` |
| **Full suite command** | `scripts/verify-phase-05.sh` |
| **Estimated runtime** | roughly two minutes — `--gate` prints its own measured wall time on every run (`verify-phase-05: --gate -- total runtime <N>s`). No figure is recorded here: the gate used to write one back into this cell, which dirtied the working tree on every run and left a number that was stale the moment another check was added. |

**Phase gate (D-127):** `verify-phase-05.sh` + `verify-phase-04.sh` + `verify-phase-03.sh` must all be green **at the same commit**.

---

## Sampling Rate

- **After every task commit:** the single relevant check function from `verify-phase-05.sh` (mirrors `verify-phase-04.sh`'s per-check granularity)
- **After every plan wave:** `scripts/verify-phase-05.sh` full run
- **Before `/gsd-verify-work`:** all three phase gates green at one commit (D-127)
- **Max feedback latency:** TBD (per-check granularity keeps the per-commit sample well under a full-gate run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | SIDE-04 | — | SIGKILL leaves zero descendant Node processes | integration | `verify-phase-05.sh` orphan check | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SIDE-04 | — | A planted fake leftover IS reaped on next startup (D-125 positive control) | integration | `verify-phase-05.sh` reap-control check | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SIDE-04 | — | A stale/mismatched state-file entry is NOT signalled (D-111 pidfile footgun) | integration | `verify-phase-05.sh` identity-guard check | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SIDE-05 | — | Second launch focuses existing window, spawns no second backend | integration (**non-headless display required — see Known Constraint**) | `verify-phase-05.sh` single-instance check | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SHELL-03 | — | Exhausted retry budget shows the branded error layer; unrecoverable class skips straight to it | integration | `verify-phase-05.sh` give-up check | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SHELL-03 | — | Retry re-attempts spawn and clears the error layer on success | integration | `verify-phase-05.sh` retry check | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SHELL-04 | — | Diagnostics layer reachable, shows port/pid/health/log **while the backend is down** | integration | `verify-phase-05.sh` diagnostics check | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SHELL-04 / BRAND-01 | — | Repointed about-support surface reads diagnostics-layer identity (D-120, WINDOWS #6) | integration | `scripts/verify-branding-identity.mjs` | ✅ exists, needs edit | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Negative-assertion pairing (D-125 / 02-LEARNINGS):** every negative assertion above ships a positive control. "No orphan survives" is paired with "a planted leftover IS reaped"; "a stale pid is not signalled" is its negative control.

---

## Wave 0 Requirements

- [ ] `scripts/verify-phase-05.sh` — new; reuses `verify-phase-04.sh`'s `setsid` process-group idiom (`scripts/verify-phase-04.sh:24-29,117,301-334`) plus new `/proc`-walk and state-file-planting helpers
- [ ] A **non-headless (Xvfb) launch helper**, distinct from `verify-phase-04.sh`'s `--headless` `start_shell()` — required by the SIDE-05 check (see Known Constraint below); reuse everything else from that helper, just drop `--headless`
- [ ] Framework install: none — reuses the in-repo zero-dependency BiDi harness

---

## Known Constraint (blocks the SIDE-05 check)

`gfxPlatform::IsHeadless()` forces `mDisableRemoteClient = true` (`upstream/toolkit/xre/nsAppRunner.cpp:5144`), so Firefox's remoting protocol — the mechanism SIDE-05's second-launch path depends on — is **disabled under `--headless`**, which is exactly how `verify-phase-04.sh:312` launches the shell today. The SIDE-05 assertion therefore requires a real display (Xvfb, no `--headless`).

**Open discriminator (research Open Question 2):** whether Xvfb-without-`--headless` sidesteps the RenderCompositorSWGL headless-compositor blocker behind WINDOWS #2–4, or reproduces it under a different cause. Treat as a Wave 0 discriminator test — do not assume either outcome. Per the Phase 4 lesson recorded in WINDOWS #2–4, "environmental" is not an acceptable diagnosis without a discriminator.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Daily-drivable: one full working day as the developer's IDE with no manual process cleanup and no forced relaunch | ROADMAP criterion 5 (D-126) | An automated soak is repeatable but does not exercise what "daily-drivable" means; a multi-day soak would gate the milestone on calendar time | Use Sourcerer as the primary IDE on the NixOS host for one full working day. Record in `05-MANUAL-VERIFICATION.md`: what was done, whether any manual process cleanup or forced relaunch was needed, and the verdict. Same shape as Phase 3 Items A/B and Phase 4's launch-paint item. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency target set and met
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
