---
sketch: 005
name: wiki-navigation
question: "How do you find and move between wiki articles?"
winner: "B"
tags: [wiki, index, search]
---

# Sketch 005: Wiki Navigation

## Design Question

Clicking "Wiki" in the corpus rail (sketch 004 winner) lands you… where? The corpus has many canonical articles; how do you browse, search, and enter them before the reading view (sketch 003 synthesis) takes over?

## How to View

open .planning/sketches/005-wiki-navigation/index.html

## Variants

- **A: Article Grid + Search** — searchable card grid, one card per canonical article with summary, trust chip, unresolved badge, claim count. Closest to the existing Databasise WikiIndex.
- **B: Subject Tree + Preview** — a left tree grouped by entity type (Vessels / Organisations / People / Places) with a preview pane; groups expand/collapse, amber unresolved counts on items.
- **C: Graph as the Map** — the knowledge graph IS the navigation: click a node, see its summary in the side panel, "View article" enters the reading view. Recent-articles strip at the bottom. (Graph itself = LightRAG's real sigma.js viewer in the build, per sketch 004 note.)

## Decision (user, 2026-07-15)

- **Winner: B — subject tree + preview.** "For the wiki some type of subject tree is needed."
- **C rejected:** the wiki and the graph are two different things — they stay separate rail sections; the graph never becomes the wiki's navigation.
- **Graph section = copy LightRAG's graph viewer** (the existing `lightrag_webui` sigma.js/graphology component) — port it as-is, reskin tokens only.

## What to Look For

- Grid (A) scales by search; tree (B) scales by taxonomy; graph (C) scales by relationships — which matches how you think about a subject?
- B's entity-type grouping comes from the extraction pipeline — do those categories feel natural or mechanical?
- C makes the graph central rather than a separate section — does that collapse two rail items (Wiki + Graph) into one, and would you want that?
