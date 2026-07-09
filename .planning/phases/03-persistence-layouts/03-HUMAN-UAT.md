---
status: partial
phase: 03-persistence-layouts
source: [03-VERIFICATION.md]
started: 2026-07-09T00:00:00Z
updated: 2026-07-09T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Graceful close-then-relaunch persistence round-trip
expected: Change the layout (move/open/close a pane, adjust rail), close the window normally, relaunch. The last change made before closing is restored exactly — including changes made less than 300ms before close (the close-flush must capture the pending debounced write).
result: [pending]

### 2. Abrupt-kill-within-canary-window recovery sanity
expected: Kill the sourcerer.exe process within ~1–4 seconds of launch (while the restore canary is still armed), then relaunch twice. First relaunch may fall back to the default Wiki+Library workspace with the one-time ResetNotice banner (that is the canary doing its job); the second relaunch must NOT reset again — no permanent reset loop, no crash. (Validates the CR-01/02/03 canary-lifecycle fixes.)
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
