# Databasise GUI — Design Handoff

**Date:** 2026-07-15 · **Status:** all 6 layout sketches decided (winners committed) · **UX journeys NOT yet done** (layouts only — no flows, onboarding, or state walkthroughs)

This file is the single source for continuing design work in a fresh session or another tool. It inventories every screen, every button/control made so far, and what each must wire to.

---

## 1. Product & Naming

- The app's user-facing name and title-bar wordmark is **Databasise** (user correction 2026-07-15). "Sourcerer" remains only as the repo folder / internal code identifiers.
- The app embeds the **Databasise engine** (`D:\Vibe Coding\Databasise`) as a bundled sidecar — one engine process per corpus, pinned contract v4 (REST + 59 MCP tools, `CATALOG.json`).
- Daily loop optimizes for **resuming ONE corpus instantly**; multi-open is first-class but secondary.

## 2. Design System (locked — do not reinvent)

- Token source of truth: `src/styles/tokens.css` · sketch mirror: `.planning/sketches/themes/default.css`
- Dark `#0a0a0b` bg · panels `#131418`/`#0F1013` · lines `#1e1f22` (always 1px) · text `#e6e4de`
- Accent green `#86A38C` (hover `#A3BCA8`) used ~10% · amber `#C9A227` = disputed/pending · red `#C42B1C` = destructive only
- **0 border-radius everywhere** except the 10px outer window card · 40px title bar (logo ring + wordmark + `·` + crumb)
- IBM Plex: Mono (11px uppercase tracked labels, chips), Sans (13px body), Serif (headings 22–30px, article prose 15–16px) — **bundle locally, no Google Fonts at runtime**

## 3. Decided Screens & Full Control Inventory

### 3.1 Launcher — "rail list + resume panel" (sketch 001, winner B)

File: `.planning/sketches/001-multi-corpus-launcher/index.html` (variant B)

| Control | Behavior / wiring |
|---|---|
| Corpus rail item (status dot, name, recency) | Select → main panel shows that corpus. Dot green+glow = engine running |
| `+ New corpus` button | Opens create form: tier cards, Wiki default (engine: corpus create route) |
| Resume corpus → (primary) | Opens the corpus workspace; starts engine sidecar if stopped |
| Open side-by-side (ghost) | Opens corpus in a second dockview pane (see 3.2) |
| Stats row (docs / canonical claims / contradictions / head commit) | Read from corpus status + `/wiki` + queue counts |
| Recent-activity list | From `GET /wiki/history` (entity-filterable) |

### 3.2 Multi-corpus — "dockview split panes" (sketch 002, winner A)

File: `.planning/sketches/002-side-by-side-corpora/index.html` (variant A)

| Control | Behavior |
|---|---|
| Pane header: status dot + corpus name + amber `N pending` chip | Chip → opens that corpus's Queue |
| Pane header `×` | Closes pane; remaining pane takes full width |
| Draggable divider | Resize panes (dockview-core native) |
| Click pane | Focus — green 2px top edge shows which corpus receives keyboard/assistant actions |

One engine process per corpus; each pane binds to its own sidecar.

### 3.3 Wiki article reading — "synthesis" (sketch 003: C's rail + A's column)

File: `.planning/sketches/003-wiki-reading-experience/index.html` (Synthesis tab)

| Control | Behavior / wiring |
|---|---|
| Serif reading column (centered, ~660px) | Article composed on demand: `resolve_canonical` / `/wiki/*` |
| Claim span (dotted underline) | Click → fills right-hand **claim inspector** rail |
| Disputed claim span (amber dashed) | Same, plus Review action |
| Claim inspector rail (persistent, 320px) | Shows: verbatim quote blockquote, trust chip (curated/library), source line, agreement count |
| Rail: `Open source` | Opens source chunk with span highlighted (`/wiki` chunk text route, D-06) |
| Rail: `Edit claim` | `PUT /wiki/{entity}/{attr}?dry_run=true` → back-prop diff preview → gated apply |
| Rail: `Review` (disputed only) | Opens contradiction queue at that pair |
| `## Unresolved` block (end of article, amber border) | One row per genuine conflict: attribute, both values with source+trust, `Review` button. Never silently collapsed |
| Header chips | `curated` trust chip; meta line: claim count · head version |

### 3.4 Corpus workspace — "section rail" (sketch 004, winner A)

File: `.planning/sketches/004-corpus-workspace/index.html` (variant A)

Left rail (168px), grouped:

| Rail item | Content / wiring |
|---|---|
| **Corpus:** Wiki | Subject tree + search (3.5) → article view (3.3) |
| Documents | Ingest table: name, status chip (processed=green / processing=amber with chunk progress / failed=red), chunks, facts, date. Row click → doc detail (chunks + extracted facts). `+ Ingest document` button → upload → pipeline |
| Graph | **Straight port of LightRAG's real sigma.js/graphology viewer from `lightrag_webui` — reskin tokens ONLY, never rebuild** (user requirement). Node click → node panel with "View article" |
| Query | Retrieval testing: 5 mode chips (naive/local/global/hybrid/mix), query input (Enter submits), answer block + source-chunks chip |
| **Curation:** Queue (amber count badge) | Contradiction table: attribute, value A, value B, `Resolve` (preview-then-apply gate) + `Dismiss` (provenance audit). Wiring: `POST /wiki/contradiction/{pair_key}/dismiss`, resolve routes |
| History | Timeline table: when, actor chip (human/agent/detector), action, `Revert` (non-destructive, recorded inverse: `POST /wiki/history/{entry_id}/revert`) + `Diff` |
| Settings | → 3.6 |

**Wiki and Graph are two different things — always separate rail items** (user decision, sketch 005).

### 3.5 Wiki navigation — "subject tree + preview + detailed-list search" (sketch 005, winner B + search)

File: `.planning/sketches/005-wiki-navigation/index.html` (variant B)

| Control | Behavior |
|---|---|
| Search box (above tree) | Typing replaces preview pane with **detailed result list**: name, summary, trust chip, amber unresolved badge, claim count per row (grid-level detail, list form). Clearing restores tree preview. (User requirement, mid-review) |
| Subject tree | Collapsible groups by entity type (Vessels/Organisations/People/Places — from extraction pipeline). Items show amber unresolved counts |
| Tree item click | Preview pane: article name, meta (claims · unresolved · head), summary paragraph |
| `Open article →` (primary) | Opens reading view (3.3) |

### 3.6 Settings — "one settings screen" (sketch 006, winner A)

File: `.planning/sketches/006-settings/index.html` (variant A)

Sidebar sectioned **App** / **Corpus — {name}**:

| Section | Controls / wiring |
|---|---|
| App › Providers & Keys | LLM: endpoint (base_url, OpenAI-compatible — Cerebras ref), model, API key + `Test` button. Embeddings: provider select (Voyage / OpenAI / Ollama local), key + `Test` |
| App › General | Corpora root path; "Open last corpus on launch" toggle; "Confirm destructive actions" — **always on** chip, not a toggle |
| Corpus › Feature Tier | 3 tier cards: Library / **Wiki (default)** / Wiki+Graph. Tier change previews affected sections before applying |
| Corpus › Agent Permissions | Toggles: read/query, ingest, edit canonical claims (dry-run enforced), resolve contradictions (agent-outvotes-human → PendingReview), destructive (`_confirm` elicitation required) |
| Corpus › Engine | Status (dot, pid, port) + `Restart`/`Stop`; version + pinned contract chip; storage size + `Open folder` |
| Corpus › Export / OKF | `Export .zip` (primary, trust doc embedded); `Import…` (staged, manifest-peek, gated); Live-mirror toggle. Wiring: `/export/okf/download`, `/import/okf/upload` |
| Footer (every screen) | Trust bar: "contradiction-surfaced, conservatively auto-resolved" + link to `docs/trust-and-limitations.md` (TRUST-01: required on every surface) |

## 4. Universal Patterns

- **Preview-then-apply gate** on EVERY destructive action (Databasise GateDialog pattern, GUI-07): dry-run diff → confirm → apply. Never a bare confirm dialog.
- Amber = disputed/pending, everywhere. A conflict is always visible, never auto-hidden.
- Chips are mono 10px uppercase; status dots 6px (green glow = running).
- Toasts: bottom-center, panel bg, accent border, mono 11px.
- Every interactive element has a hover state (border → `#3A3B40` or text → fg).

## 5. What Is NOT Done (next design work)

1. **UX journeys** — end-to-end clickable flows (daily loop, first-run onboarding, ingest & monitor, agent-alongside), incl. empty/loading/error states. Layouts above are the vocabulary; the flows don't exist yet.
2. Contradiction **resolve** screen itself (queue exists; the resolution flow/gate sequence is unsketched).
3. Edit-claim flow (dry-run diff presentation, apply, revert) as a sequence.
4. Scope of Sourcerer→Databasise wordmark rename in the shipped shell code.
5. Whether unresolved conflicts need an always-visible pin beyond the end-of-article block.

## 6. File Inventory

- `.planning/sketches/MANIFEST.md` — decision table (all 6 winners)
- `.planning/sketches/themes/default.css` — sketch theme mirroring locked tokens
- `.planning/sketches/00N-*/index.html` + `README.md` — sketches 001–006, winners ★-marked in tabs, decisions in README frontmatter
- Engine contract the GUI wires to: Databasise repo `CATALOG.json` / `CATALOG.md`, OpenAPI snapshot (Phase-12 contract guard)
