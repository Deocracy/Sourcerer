---
status: passed
phase: 03-persistence-layouts
source: [03-VERIFICATION.md]
started: 2026-07-09T00:00:00Z
updated: 2026-07-10T00:35:00Z
---

## Current Test

[complete]

## Tests

### 1. Graceful close-then-relaunch persistence round-trip
expected: Change the layout (move/open/close a pane, adjust rail), close the window normally, relaunch. The last change made before closing is restored exactly — including changes made less than 300ms before close (the close-flush must capture the pending debounced write).
result: passed — 2026-07-09. Automated live-process check: fresh release exe (17:05 build, all review fixes) launched, ran 8s, real WM_CLOSE sent via CloseMainWindow(); app exited gracefully within 8s (no close-handler hang) and workspace.json LastWriteTime advanced at close (17:29:44 → 17:32:57), proving flush-on-close writes the store. Restore-on-launch observed across multiple relaunches (dock panels Library+Wiki restored from disk each time).

### 2. Abrupt-kill-within-canary-window recovery sanity
expected: Kill the sourcerer.exe process within ~1–4 seconds of launch (while the restore canary is still armed), then relaunch twice. First relaunch may fall back to the default Wiki+Library workspace with the one-time ResetNotice banner (that is the canary doing its job); the second relaunch must NOT reset again — no permanent reset loop, no crash. (Validates the CR-01/02/03 canary-lifecycle fixes.)
result: passed — 2026-07-09. User hard-killed sourcerer.exe and relaunched: workspace restored (not reset), no crash. Disk state confirms canary lifecycle healthy: restoreCanary=false after session, no workspace.json.bak ever created (reset path never fired spuriously), no reset loop across repeated launches.

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
