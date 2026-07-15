---
sketch: 003
name: wiki-reading-experience
question: "How does the canonical article read inside the Databasise applet?"
winner: "Synthesis (C's rail + A's reading column)"
tags: [wiki, provenance, reading]
---

# Sketch 003: Wiki Reading Experience

## Design Question

The moat surface: one canonical, provenanced article composed on demand. How should it read — flowing prose, structured cards, or prose with a persistent inspector? All variants must keep per-claim provenance ≤1 click and render `## Unresolved` honestly (a genuine conflict never silently collapses).

## How to View

open .planning/sketches/003-wiki-reading-experience/index.html

## Variants

- **A: Serif Reading Column** — Wikipedia-like flowing prose; every claim is a dotted-underline span, click for a provenance popover (verbatim quote, trust chip, open-source/edit/review actions). Disputed claims are amber-dashed inline; `## Unresolved` block at the end.
- **B: Attribute-Group Cards** — structured cards grouped by attribute (closest to today's Databasise webui); disputed rows amber with a DISPUTED tag; same `## Unresolved` block.
- **C: Article + Provenance Rail** — the prose column plus a persistent right-hand "claim inspector"; clicking a claim fills the rail instead of opening a popover.
- **Synthesis (WINNER)** — C's persistent claim-inspector rail framing A's centered serif reading column, with A's `## Unresolved` conflict block at the article's end.

## What to Look For

- Reading first vs scanning first: A reads like an encyclopedia, B scans like a fact sheet — which matches how you'll actually use a corpus?
- Popover (A) vs persistent rail (C): does the rail earn its 320px when you inspect many claims in a row?
- Do the amber disputed spans inside prose feel honest without wrecking the reading flow?
- Is the `## Unresolved` block at the article's end enough, or should conflicts also pin somewhere always-visible?
