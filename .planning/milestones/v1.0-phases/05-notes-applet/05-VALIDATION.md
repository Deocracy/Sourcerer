---
phase: 5
slug: notes-applet
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-12
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — 119 green tests from Phases 2–4) |
| **Config file** | vitest config in repo (existing) |
| **Quick run command** | `npx vitest run src/applets/Notes` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/applets/Notes`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner) | | | NOTE-01, NOTE-02 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Notes applet test file(s) — stubs for NOTE-01 (CRUD + persistence via host.storage) and NOTE-02 (host.ai() summarize loop)
- [ ] Reuse existing mocked-host test idiom from `Wiki.tsx`/`Library.tsx` applet tests

*Existing vitest infrastructure covers all phase requirements — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Notes survive app relaunch | NOTE-01 | Requires real Tauri process restart + workspace.json on disk | Build/launch sourcerer.exe detached, create note, quit, relaunch, confirm note present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
