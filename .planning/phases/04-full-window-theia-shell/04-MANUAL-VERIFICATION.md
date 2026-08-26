---
phase: 04-full-window-theia-shell
date: 2026-08-27
status: blocked
# This file matches the `*-VERIFICATION.md` glob and shadows
# 04-VERIFICATION.md in gsd-tools' verification.status reader (see
# 03-MANUAL-VERIFICATION.md's own precedent note) -- `status:` here uses the
# routing-table vocabulary. `blocked` (not `passed`/`failed`) because the
# item below has not yet been observed by anyone: this session's sandboxed
# executor cannot render the window at all (the same environmental gap
# WINDOWS.md entries 2-3 already document), so there is no live human
# session in which to gather a verdict.
---

# Phase 4: Manual Verification Record

Durable evidence record for Phase 4's one human-only verification item,
carried in `04-VALIDATION.md`'s "Manual-Only Verifications" table and
required by `04-05-PLAN.md` Task 3. Built by `04-05` Task 3. The outcome
block below is filled by a human performing the item on a real desktop
session, not by this task.

## Item — Launch paint: branded state first, single swap, no flash

**Test (verbatim from `04-VALIDATION.md`):** Launch `objdir/dist/bin/sourcerer`
cold on the NixOS host — not headless, not under the verification harness.
Observe three things in order:

1. The branded loading state is on screen at first paint — no blank or white
   window precedes it.
2. The window is movable and responsive while the backend is still starting.
3. It swaps to Theia exactly once, with no second flash and no intermediate
   blank frame.

**Expected:** All three hold, in order. Window show never blocks on backend
readiness (D-94/D-95: the loading layer is a chrome-rendered deck that
paints with the window; the `<browser>` navigates to Theia exactly once,
after the health check passes).

**Why human (verbatim from `04-05-PLAN.md`):** Perceived immediacy at
window-show time is what SHELL-05's criterion asserts. A screenshot proves
the branded state exists at some point; it does not prove it *felt*
instant, that the window was actually interactive before the swap, or that
the swap itself read as a single clean transition rather than a flash — all
three are perceptual judgments a bounded poll or a byte-offset sentinel
comparison cannot make. `04-05`'s own automated `shell05-paint-before-backend`
check (see `04-05-SUMMARY.md`) proves the sentinel *ordering* is correct
(`SOURCERER_SHELL_READY` byte-offset strictly before
`SOURCERER_BACKEND_READY`, `SOURCERER_SHELL_SWAP` strictly after both) —
that is the closest an automated check can get to this criterion, and it is
not the same claim as "it looked instant to a person watching it."

**Launch command** (run from the repository root,
`/home/chris/coding/sourcerer`):

```
objdir/dist/bin/sourcerer
```

### Outcome — NOT YET OBSERVED

**This item is genuinely blocked, not skipped or assumed.** `04-05` (this
plan) is executing autonomously, in a sandboxed session with no attached
desktop display. Every attempt this phase has made to launch
`objdir/dist/bin/sourcerer` from this exact session — headless, under Xvfb,
with the GPU/content sandboxes disabled, with `LIBGL_ALWAYS_SOFTWARE`, in
single-process mode — hits the identical pre-existing failure documented in
`WINDOWS.md` entries 2 and 3: a `RenderCompositorSWGL failed mapping
default framebuffer` crash annotation within ~0.5s of launch, after which
the content process never completes IPC channel setup. `04-05`'s own live
run of `bash scripts/verify-phase-04.sh` (three consecutive times,
2026-08-27) reproduced this exact signature again on `shell01`/`shell05`/
`side03` — see `04-VALIDATION.md`'s per-task map. There is no run in this
session, headless or otherwise, in which the window has ever painted
anything at all, so there is no live human session in which to gather a
verdict — this is not a case of "the executor forgot to ask," it is that
the launch itself cannot happen from where this executor runs.

**What is filled in, honestly:**

- Observed: branded state at first paint (yes/no/description): **not
  observed — no launch in this session has reached a paintable state.**
- Observed: window movable/responsive pre-swap (yes/no): **not observed.**
- Observed: single clean swap, no flash (yes/no): **not observed.**
- Verdict (developer's own words): **pending — not yet gathered.**
- Date: **pending.**
- Observer: **pending — requires a human on a real desktop session (or a
  differently-provisioned CI runner), per the same carry-forward note
  `04-03-SUMMARY.md` and `04-04-SUMMARY.md` already recorded.**

**Why this does not get a fabricated verdict:** `04-05-PLAN.md`'s own
acceptance criteria for this item require "the developer's own words and a
date, not a paraphrase and not an assumption." Writing a "PASS" here without
anyone having watched the window would be exactly the assumption that
criterion forbids, and would silently contradict the phase's own automated
evidence that no live paint has been captured at any point in Phase 4's
execution (04-03, 04-04, 04-05 D6-equivalent findings).

**Follow-up:** Tracked as the natural resolution of `WINDOWS.md` entries 2-3
— once a launch environment exists where Firefox's headless/Xvfb
content-process bring-up completes (a real desktop session on the NixOS
host, or a differently-provisioned CI runner), re-run this item and append
its outcome below as a new dated section, following `03-MANUAL-VERIFICATION.md`'s
own precedent of appending a re-verification block rather than overwriting
the pending one above. The ROADMAP Phase 4 success-criterion text (`2. The
window paints a branded loading state immediately on launch and swaps to
Theia when the health check passes; window show never waits on backend
readiness`) is unchanged — this record does not weaken or reinterpret it.
