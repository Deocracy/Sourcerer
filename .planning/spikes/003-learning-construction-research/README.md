---
spike: 003
idea: datalog-memory-harness
name: learning-construction-research
type: research
validates: "Given the write-side of a learnings memory, when surveyed for embedding utility, rejected complex schemes, construction pipelines, and entry anatomy, then we know whether embeddings belong in the design, which ambitious schemes failed and why, how learnings should be built, and how an entry should be structured"
verdict: VALIDATED
related: [001, 002]
tags: [embeddings, memory-construction, entry-schema, write-policy, graveyard, limitations]
---

# Spike 003: Learning Construction Research

## What This Validates

Given the write-side of a learnings memory, when surveyed for embedding utility,
rejected complex schemes, construction pipelines, and entry anatomy, then we know:
whether embeddings belong in the design at all, which more-ambitious learning schemes
were proposed and lost (and whether their blockers were fundamental or
circumstantial), how learnings should be built, and how a learning entry should be
structured.

## Questions Behind This Spike

Spikes 001–002 mapped the field, the limitations, and the substrate. Three open
questions drive this one:

1. **Is embedding useful?** Spike 002 assumed "an embedding sidecar on write and
   query paths" as the fix for Datalog's exact-equality joins. That assumption was
   never itself examined.
2. **Has something more complex been proposed that is too slow or bad for context?**
   The graveyard of ambitious memory schemes — hierarchical, self-organizing,
   neural, replay-based — and what killed each.
3. **How are learnings built, and are there better ways?** The write-side pipeline
   taxonomy and its measured quality — plus **how a learning entry should be
   structured** (fields, format, trigger conditions, dual prose/structured
   representation).

## Research Method

Four parallel Opus deep-research subagents, each writing a full report here:

| Report | Question |
| ------ | -------- |
| research-i-embeddings-utility.md | Embeddings for dedup / entity resolution / task→trigger matching vs lexical vs small-LLM judging — evidence, failure modes, minimal footprint verdict |
| research-j-rejected-schemes.md | The graveyard: hierarchical trees, self-organizing graphs, episodic replay/CBR, neural memory, OS schemes, multi-store architectures — why each lost, fundamental vs circumstantial |
| research-k-construction-pipelines.md | Write-side taxonomy (post-mortem, in-situ, continuous, induction, consolidation, contrastive, critique loops), write-quality metrics, LLM write pathologies, evidence-backed upgrades |
| research-l-entry-structure.md | Entry anatomy across shipped systems + CBR/production-rule/design-rationale classics; trigger-condition fields; format effects on reader and 8B writer; dual representation; recommended schema |

## Investigation Trail

- 2026-08-21: Spike opened; four Opus research agents dispatched in parallel.
- 2026-08-21: Report I (embeddings) landed. Verdict: ship with NO embeddings.
  Per-role: dedup NO (lexical MinHash/trigram prefilter + LLM adjudication — a
  false merge destroys a curated decision); entity/alias resolution WEAK YES but an
  explicit alias(Term, Canonical) Datalog table solves it exactly and inspectably
  (embeddings only ever as recall-oriented blocking, never as decision);
  task→trigger matching NO, actively harmful (applicability is a logical relation;
  cosine measures wording overlap). Killer evidence: production gate audit caught
  0/56 meaning-breaking mutations; "withhold"→"administer" scored cosine 0.9608;
  balanced accuracy median 0.525; modal downgrade AUROC 0.000 — structural, not
  tunable (reversals are additive edits, restatements substitutive, so wording and
  meaning anti-correlate on the pairs that matter). Dense also loses to BM25 by
  14–20pts on rare-entity exact match — its own proposed use case. Precedent:
  Amazon/AAAI 2026 keyword-only agent hit 94.5% faithfulness, beating Titan RAG.
  If ever adopted: one 300M–0.6B local embedder, brute-force cosine in-memory, no
  ANN index, no cosine threshold anywhere, recall-only — added only on a logged
  vocabulary-mismatch miss the alias table didn't catch. Spike 002's "embedding
  sidecar on both paths" assumption is hereby retracted.
- 2026-08-21: Report J (graveyard) landed. Steal (failed circumstantially): classic
  CBR's retrieve-reuse-revise-retain cycle — LLMs dissolved its two killers
  (hand-engineered representation, adaptation), and *revise* is unclaimed by any
  2026 system (a supersession-rule store would be first); A-MEM-style links and
  per-item importance scoring (priced out at 2023 LLM costs, ~10x cheaper now —
  adopt links, reject in-place mutation); offline *store* consolidation. Dead
  fundamentally: knowledge editing (MEMIT collapses ~250 sequential edits;
  retrieval beats editing at scale), RETRO/Titans (in-model), LoRA-as-memory
  (non-inspectable, non-retractable), RAPTOR on mutable stores (ancestor-summary
  invalidation cascade), tiered promotion/demotion, decay-by-disuse. Most
  actionable context-quality findings: verbatim chunks beat LLM-extracted
  artifacts by 15.9–22.0pts in swap-only ablations — distillation is lossy;
  augment verbatim, never replace it (provenance pointers are payload, not
  metadata). JSON context degrades codegen (~10–15% reasoning hit) — query in
  structure, inject in prose. Curated stores have a measured ceiling: pass rate
  falls monotonically past ~64–128 entries even with correct retrieval, dedup
  didn't help, aggressive retirement went below baseline — unsolved, and squarely
  in this corpus's range. Abstraction wins transfer (+3.9 vs +1.2), detail wins
  recall — two tiers plus a pointer. Falling costs relieved per-item maintenance
  only; shadowing and poisoning constraints scale with store size and bind harder.
- 2026-08-21: Report K (construction pipelines) landed. End-of-phase distillation is
  a sound baseline (it is ExpeL/ReasoningBank's architecture applied to phases;
  ReasoningBank the best template — ≤3 items per trajectory, induces from both
  outcomes, +8.3pp WebArena; k=1 retrieval beat k=4). Reject Mem0-style
  per-exchange extraction (lossy, contested benchmarks). AWM workflow induction is
  success-only and degrades cross-domain. MCMA: keep linked multi-level abstraction
  — committing to one abstraction level at write time is itself the failure mode.
  Twelve named write pathologies; most exposed here: hindsight distortion and
  sycophancy (least discussed in the literature). Three evidence-backed upgrades:
  (1) contrastive extraction — successes-only shows no advantage in ablation;
  selective addition+deletion +10% absolute; phrase rule-first with failure as
  marked counter-example because agents imitate retrieved records; (2) delta
  updates with stable IDs over regeneration (ACE: +10.6% AppWorld, −82.3% latency,
  works from free execution signals); (3) verify-before-commit + novelty gate
  (Voyager ablation: no self-verification → buggy entries accumulate; duplicates
  become counter increments; provenance grounding check is the antidote to
  hindsight distortion). Caveats: "writers hit 60–85% of optimal" is not an
  established constant (method real, band varies); no published in-situ vs
  retrospective A/B; no metrics exist for rationale quality or provenance
  completeness — the provenance-pointer discipline here is ahead of what the
  literature can measure.

- 2026-08-21: Report L (entry structure) landed — 15-system field-inventory table.
  All four reports in; synthesis below.

## Results

**Verdict: VALIDATED** — all three questions answered, one spike-002 assumption
retracted, and a concrete entry anatomy recommended. Full detail in the four
`research-*.md` reports.

### Question 1 — Is embedding useful? No (retraction of spike 002's sidecar)

Ship with no embeddings. Cosine gates are structurally broken for meaning (0/56
meaning-breaking mutations caught in a production audit; reversal pairs score
~0.96; the mechanism — reversals are additive edits, restatements substitutive —
is not tunable). Dense retrieval also loses to BM25 by 14–20pts on rare exact
identifiers, its own proposed use case here. Role-by-role: dedup = lexical
prefilter (MinHash/trigram) + LLM adjudication; alias/vocabulary mismatch = an
explicit `alias(Term, Canonical)` Datalog table (exact, inspectable); task→trigger
matching = never cosine (applicability is a logical relation). A small local
embedder (300M–0.6B, brute-force in-memory, recall-only, no thresholds) is the
documented later addition, triggered only by logged misses the alias table fails
to catch. Where report K suggested an "embedding novelty gate" at write time, the
resolution is report I's: implement the novelty gate lexically + LLM-adjudicated;
embeddings are not required for it.

### Question 2 — What richer schemes were proposed and lost?

Worth stealing (blockers were circumstantial, now dissolved): classic CBR's
retrieve-reuse-revise-retain cycle — LLMs removed its two killers, and *revise* is
unclaimed by any 2026 system (a supersession-rule store would be the first);
A-MEM-style inter-entry links and per-item importance scoring (priced out at 2023
LLM costs); offline *store* consolidation. Dead for fundamental reasons: knowledge
editing (collapses ~250 sequential edits; retrieval beats editing at scale),
neural memory (Titans/RETRO — lives inside the model), LoRA-as-memory
(non-inspectable, non-retractable), RAPTOR-style summary trees on mutable stores
(ancestor-invalidation cascade), tiered promotion/demotion, decay-by-disuse
(recency is a bad proxy for correctness).

The three context-quality results that constrain everything:

1. **Verbatim beats distilled by 15.9–22.0pts** in swap-only ablations —
   distillation is lossy and a graph doesn't recover it. Entries must carry and
   point to verbatim evidence; provenance is payload, not metadata.
2. **Structured context hurts weak readers, not frontier ones** ("Capacity, Not
   Format": Sonnet-class unaffected, small models drop up to 36pp; JSON degrades
   codegen ~10–15%) — query in structure, inject in prose.
3. **Curated stores have a measured ceiling**: performance falls monotonically
   past ~64–128 entries even with correct retrieval; dedup didn't fix it,
   aggressive retirement made it worse. Unsolved in the literature, squarely in
   this corpus's range — budgeted selection and supersession are the design's
   answer, and they are exactly its claimed novelty.

### Question 3 — How should learnings be built, and structured?

Construction: end-of-phase distillation is the sound baseline (it is
ExpeL/ReasoningBank's architecture; ReasoningBank the best template — ≤3 entries
per trajectory, both outcomes, k=1 retrieval beat k=4). Rejected: per-exchange
extraction (lossy), success-only workflow induction (degrades cross-domain).
Three evidence-backed upgrades:

1. **Contrastive extraction** — successes-only extraction shows no advantage in
   ablation; feed reverted commits, failing tests, rejected reviews as explicit
   pairs; phrase rule-first with the failure as a marked counter-example, because
   agents imitate retrieved records.
2. **Delta updates with stable IDs**, never wholesale regeneration (ACE: +10.6%,
   −82.3% latency, driven by free execution signals).
3. **Verify-before-commit** — provenance grounding check (the antidote to
   hindsight distortion) plus a lexical novelty gate; duplicates become counter
   increments (Voyager ablation: without self-verification, bad entries
   accumulate).

Structure — the recommended anatomy (seven fields, four required): frontmatter
`id`/`type`/`scope`/`created` (closed enums) + optional `superseded_by`; then
title and sections **When** (a natural-language *situation* sentence — the
highest-leverage field: keeping it separate rather than concatenated lifts
retrieval Recall@10 70.6→74.5 training-free, →83.8 weighted), **Claim** (one
claim, positive form — negated prohibitions are followed unreliably (77%
violation under simple negation) and retrieve for exactly the queries they should
block; rewrite as guard-rails), **Why** (rationale — a minority field in LLM
systems but standard in ADR/CBR; keep it), **Evidence** (verbatim specifics — the
anti-brevity-bias field), **Source** (pointers). Excluded deliberately: numeric
confidence (proposed everywhere, evidenced nowhere), free-text tags (folksonomy
drift), writer-authored inter-entry links (derivable in Datalog). Markdown with
flat headings over constrained JSON: schema-referenced markdown takes 8B
non-compliance from ~68% to 2–3% while validating as cheaply as JSON.

**Dual representation: yes, one-directional.** Prose is canonical; Datalog facts
are mechanically projected by a parser, never co-authored — if no model writes
both representations, drift is structurally impossible. Corollary: every field
the engine needs must be mechanically extractable; anything needing semantic
interpretation stays prose-only.

The convergence worth noting: the five-slot anatomy recurring across all fifteen
surveyed systems (identity, claim, applicability, provenance, lifecycle) maps 1:1
onto CBR's 30-year-old Problem/Solution/Outcome/Justification. The existing
LEARNINGS shape is already a CBR case with the Problem field demoted to a prose
line — the redesign is a promotion, not an invention.

### Open questions only experiment can settle

The two that most threaten the design: (1) does an 8B writer produce a genuine
*situation* in the When field, or a restated topic; (2) does the trigger field
improve *application*, not just retrieval — all published evidence measures
retrieval. These join the existing kill-order list (text→Datalog quality, entity
resolution, fixpoint latency) as candidates for the first build spike.
