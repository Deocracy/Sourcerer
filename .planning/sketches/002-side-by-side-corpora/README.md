---
sketch: 002
name: side-by-side-corpora
question: "What does two corpora open at once look like?"
winner: "A"
tags: [layout, multi-instance, dockview]
---

# Sketch 002: Side-by-Side Corpora

## Design Question

Your standing requirement: one corpus per engine process, several open at once. How should "at once" look — panes in one window, separate OS windows, or tabs with an optional split?

## How to View

open .planning/sketches/002-side-by-side-corpora/index.html

## Variants

- **A: Split Panes (dockview)** — both corpora in one Sourcerer window as resizable panes with corpus-chip headers. Drag the divider; click a pane to focus (green top edge). Path of least resistance — the shell already runs dockview-core.
- **B: Separate OS Windows** — each corpus is its own Sourcerer window and engine process; click a window to bring it forward. Truest to "one corpus per process," leans on the OS for snapping.
- **C: Corpus Tabs + Split Toggle** — browser-style corpus tabs in one window; single pane by default, a Split button shows two at once.

## What to Look For

- A vs B: do you want Sourcerer to manage the comparison layout, or the OS?
- Does A's focused-pane indicator (green top edge) make it clear which corpus receives keyboard/assistant actions?
- C's tabs are lightest for many corpora — is losing always-visible side-by-side acceptable?
- The disputed rows (amber) render in every pane: does comparison across corpora feel like the real use case?
