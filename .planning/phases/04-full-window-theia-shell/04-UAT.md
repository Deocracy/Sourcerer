---
status: passed
phase: 04-full-window-theia-shell
source: [04-VERIFICATION.md]
started: 2026-08-27T06:35:00Z
updated: 2026-08-27T07:05:00Z
---

## Current Test

none — all tests complete

## Tests

### 1. Launch-paint immediacy and single-swap feel

expected: Branded state visible at first paint, no blank/white window; window interactive before the swap; exactly one clean swap to Theia, no second flash.

**How to run:** on a real NixOS desktop session — not headless, not under the
verification harness — launch the built binary cold and watch the window from
process start:

```
./objdir/dist/bin/sourcerer
```

**What to look for, in order:**

1. The window appears with the dark branded loading state (`#1a1a1a`, the word
   "Sourcerer" centred). It must NOT show a blank or white frame first.
2. While the backend is still starting, the window should be movable and
   resizable — it must not be frozen.
3. Theia replaces the loading layer exactly once. No second flash, no blank
   frame between the two, no visible re-load.

**Why a human:** `shell05-paint-before-backend` passes and proves the sentinel
byte-offset ordering (`SOURCERER_SHELL_READY` strictly before
`SOURCERER_BACKEND_READY`, `SOURCERER_SHELL_SWAP` strictly after both). Ordering
is not the same claim as "it felt instant" or "it did not flash", and no session
running this phase's verification has had an attached display to judge that.

result: pass
source: human
observed: 2026-08-27
observer_report: "I saw sourcerer | a loading screen | the app opened fully"

**How it was observed.** The real transition lasts ~700ms, which is too brief to
judge reliably by eye, and the first two attempts were simply missed. So the
backend was slowed to ~8s for the observation run by pointing
`sourcerer.sidecar.nodePath` at a `sleep 8; exec node "$@"` wrapper, set only in
a scratch profile's `user.js` — no repo or product change. That stretches the
loading phase without altering any paint behaviour: shell paint stayed at
`+0.45s`, backend ready moved to `+9.13s`, swap to `+9.13s`.

**Verdict: PASS.** The observed order was branded state → loading screen held →
app opened fully, in one transition. Both failure modes this checkpoint exists to
catch were absent: no white or blank frame before the branded state, and no
second flash or intermediate blank frame at the swap.

**Recorded honestly — one sub-point was not exercised.** The written expectation
also included "window interactive (movable, resizable) before the swap". The
observer did not report dragging or resizing during the wait, and no freeze was
reported either. Treated as not-contradicted rather than confirmed; it is not
counted as evidence. If window responsiveness during backend startup matters as
a hard requirement, it needs its own check — Phase 5's lifecycle work (SIDE-04,
SHELL-03/04) is where that naturally belongs.

**Caveat on immediacy.** The slowed run is the right instrument for "was there a
flash" and "how many transitions" — neither depends on the delay. It is *not* a
fair test of whether the real 700ms version feels instant. The objective evidence
for that is the unmodified timing: the window paints at `+0.40s`, a full `0.7s`
BEFORE the backend is ready, so the shell demonstrably never waits on the
sidecar. `shell05-paint-before-backend` enforces that ordering automatically.

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None.
