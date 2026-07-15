# Sketch Manifest

## Design Direction

The Databasise-powered applets rendered inside Sourcerer's locked bespoke-rails design system: dark (#0a0a0b) chrome, IBM Plex (Mono labels / Sans body / Serif headings), green accent #86A38C 
used sparingly (~10%), 1px lines, 0 border-radius everywhere except the outer window card. Sketches answer how Databasise's corpus lifecycle and wiki source-of-truth surfaces should look and feel as native Sourcerer applets — not a new aesthetic. Daily loop optimizes for **resuming one corpus instantly** (user intake 2026-07-15); multi-open is first-class but secondary.

## Reference Points

- `src/styles/tokens.css` — the locked token set (renders verbatim in sketch theme)
- `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/` — the shell prototype (wiki.js / library.js stubs)
- Databasise webui (Phases 12–16, `D:\Vibe Coding\Databasise`) — proven data shapes: corpus tier profiles, contradiction queue, per-claim provenance, `## Unresolved` rendering

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | multi-corpus-launcher | How do you see and resume your corpora from Home? | B — rail list + resume panel | launcher, corpus, home |
| 002 | side-by-side-corpora | What does two corpora open at once look like? | — | layout, multi-instance, dockview |
| 003 | wiki-reading-experience | How does the canonical article read inside Sourcerer? | — | wiki, provenance, reading |
