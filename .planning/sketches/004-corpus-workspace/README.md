---
sketch: 004
name: corpus-workspace
question: "Where do the LightRAG components (Documents, Graph, Query) live relative to the wiki?"
winner: "A"
tags: [workspace, lightrag, navigation]
---

# Sketch 004: Corpus Workspace

## Design Question

An open corpus is more than the wiki: the LightRAG-inherited components — Documents (ingest pipeline + statuses), Knowledge Graph viewer, Query/retrieval testing — plus the curation surfaces (contradiction Queue, History) all need a home. What's the navigation shape inside one corpus pane?

## How to View

open .planning/sketches/004-corpus-workspace/index.html

## Variants

All three share the same six live sections (Wiki, Documents, Graph, Query, Queue, History) — click through every section in each variant.

- **A: Section Rail (WINNER)** — a slim labeled rail on the pane's left, grouped Corpus / Curation, with an amber pending count on Queue. VS Code activity-bar feel.
  **User note (2026-07-15):** the Graph section must be LightRAG's real interactive graph viewer (the sigma.js/graphology component from `lightrag_webui`), ported and reskinned to these tokens — NOT a rebuilt/simplified graph. The sketch's SVG was placeholder only.
- **B: Top Tabs** — one horizontal tab row across the pane top; flat, everything one click, no grouping.
- **C: Wiki-First + Tools Drawer** — the wiki IS the corpus view; a `⚒ Tools` button slides a right drawer holding Documents/Graph/Query/Queue.

## What to Look For

- Are Documents/Graph/Query *peers* of the wiki (A/B) or *plumbing behind it* (C)?
- A's grouping (Corpus vs Curation) vs B's flatness — which matches your mental model?
- In sketch 002 you chose split panes: imagine two corpora open — does each pane carrying its own rail (A) get cramped? Do tabs (B) survive narrow panes better?
- C keeps the reading experience pure but hides ingest status — is that acceptable for the daily loop?
