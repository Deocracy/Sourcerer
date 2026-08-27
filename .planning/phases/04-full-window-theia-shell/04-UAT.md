---
status: testing
phase: 04-full-window-theia-shell
source: [04-VERIFICATION.md]
started: 2026-08-27T06:35:00Z
updated: 2026-08-27T06:35:00Z
---

## Current Test

number: 1
name: Launch-paint immediacy and single-swap feel
expected: |
  Branded state visible at first paint, no blank/white window; window
  interactive (movable, resizable) before the swap; exactly one clean swap to
  Theia, no second flash or intermediate blank frame.
awaiting: user response

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

result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
