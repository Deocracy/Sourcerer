---
quick_id: 260822-i6k
slug: stream-model-docs
status: complete
date: 2026-08-22
---

# Summary

Recorded the three-layer stream model in both authoritative documents.

- `docs/PRODUCT-REQUIREMENTS.md` — new `## Product layering (stream model)`
  section (diagram, comparison table, boundary rule, consequences) before the
  v4.0 requirements. Two new entries under Open items: DeBIOS repo homes, and
  the not-yet-executed platform rename.
- `docs/research/sourcerer-architecture.md` — same model as `## Stream model
  (project layering)` before the runtime layer diagram, with an explicit note
  that the two diagrams are different axes (project ownership vs. process
  architecture). Repo & build strategy now states that the fork, patch stack,
  frontend tree, and sidecar all belong to Power Browser.

Deliberately not done: the `@sourcerer/*` → `@powerbrowser/*` rename pass, and
the DeBIOS-vs-Deocracy repo-home decision. Both logged as open items.
