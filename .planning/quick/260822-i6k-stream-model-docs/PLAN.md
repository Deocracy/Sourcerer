---
quick_id: 260822-i6k
slug: stream-model-docs
date: 2026-08-22
---

# Document the three-layer stream model

Record the Upstream / Midstream / Downstream layering decision (2026-08-22) in
the two authoritative documents so it is not lost in conversation.

**Decision being recorded:** Power Browser is a midstream *platform* (Firefox
ESR + Theia, integrated, unopinionated, ships standalone). Sourcerer is a
downstream *distribution* of it (Power Browser + Databasise + curated addons +
branding). Boundary rule: Sourcerer adds, never patches.

## Tasks

1. `docs/PRODUCT-REQUIREMENTS.md` — new `## Product layering (stream model)`
   section between the intro and `## v4.0 requirements`: diagram, comparison
   table, boundary rule.
2. `docs/research/sourcerer-architecture.md` — new `## Stream model` section
   before `## Layer diagram`, distinguishing the *stream* axis (who owns what
   across projects) from the existing *runtime layer* axis (process
   architecture). Cross-reference the PRD.

## Out of scope

- Executing the `@sourcerer/*` → `@powerbrowser/*` rename across the tree.
  Decided in principle, but a separate pass.
- Deciding whether Sourcerer's repo lives under DeBIOS or Deocracy. Open.
