---
status: partial
phase: 05-notes-applet
source: [05-VERIFICATION.md]
started: 2026-07-13
updated: 2026-07-13
---

## Current Test

[awaiting human testing]

## Tests

### 1. Persistence across a real relaunch (NOTE-01)
expected: With a built `sourcerer.exe`, create/edit several notes across one or more Notes tabs, then quit and relaunch. All notes survive with content intact, and each tab restores its own last-selected note (missing/GC'd id falls back silently to the most-recent note).
result: [pending]

### 2. Live two-tab mirror (NOTE-01, D-04)
expected: Open two Notes tabs in the running app. Creating/editing/deleting a note in one tab is reflected live in the other (shared module-scope store). Deleting the note the other tab has selected repairs that tab's selection rather than showing "No notes yet" beside a populated list.
result: [pending]

### 3. Live Summarize against the real Pi sidecar (NOTE-02)
expected: With the Pi sidecar running, write a note and click Summarize — a genuine completion renders inline within the timeout; switching notes clears it (ephemeral, never leaks across notes). Stop the sidecar and click Summarize — the honest-degrade copy ("Couldn't summarize this note." / "Check your connection and try again.") appears without hanging.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
