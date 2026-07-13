# Phase 5: Notes Applet - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 5-notes-applet
**Areas discussed:** List ordering & delete flow, AI summary persistence, Multi-tab behavior, Per-tab memory

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| List ordering & delete flow | Sort order, edit-bump, post-delete selection | ✓ (delegated) |
| AI summary persistence | Saved with note vs ephemeral | ✓ (delegated) |
| Multi-tab behavior | Live mirror vs refresh-on-focus vs last-write-wins | ✓ (delegated) |
| Per-tab memory | What the instance slot remembers; deleted-note fallback | ✓ (delegated) |

**User's choice:** "You pick what is best in your best judgment" — all four areas delegated
to Claude wholesale; no per-area questions were asked.

---

## Claude's Discretion

User delegated everything. Claude's calls (locked in CONTEXT.md D-01..D-07):
- Recently-updated-first ordering, edit bumps to top; delete selects next note down.
- Summaries ephemeral, never persisted.
- One shared in-memory notes store (vanilla zustand inside the Notes module) → live
  multi-tab mirror by construction; debounced host.storage writes; last-write-wins.
- Per-tab memory = selected note ID only; silent fallback when missing.

Remaining implementation-level discretion (storage blob shape, IDs, timestamps, debounce
interval, summarize prompt, untitled label) left to planner/executor.

## Deferred Ideas

- Markdown/rich text, persisted summaries, corpus graduation, search/tags/pinning — see
  CONTEXT.md `<deferred>`.
