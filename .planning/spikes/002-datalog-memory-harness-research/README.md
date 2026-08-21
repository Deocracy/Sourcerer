---
spike: 002
idea: datalog-memory-harness
name: datalog-memory-harness-research
type: research
validates: "Given the goal of a novel Datalog-based memory graph in a custom harness with small subagents, when the design space is surveyed for limitations of existing approaches, engine options, small-model leverage, and harness anatomy, then the novelty space and its constraints are mapped"
verdict: VALIDATED
related: [001]
tags: [datalog, knowledge-graph, small-models, custom-harness, limitations, neurosymbolic]
---

# Spike 002: Datalog Memory Harness Research

## What This Validates

Given the goal of a novel Datalog-based memory graph consumed through a custom harness
where small fast (~8B) subagents assist one frontier model, when the design space is
surveyed — limitations of existing approaches, Datalog engines and semantics,
small-model leverage evidence, harness anatomy — then the novelty space and its
constraints are mapped.

## Reframe from Spike 001

Spike 001 converged on pragmatic best practice for GSD-on-Claude-Code. That was the
wrong target. The actual design intent:

1. **Custom graph built in Datalog, done in a new way** — not an off-the-shelf graph
   DB, not GraphRAG. Spike 001's anti-graph-DB verdict evaluated the wrong thing.
2. **Small models (~8B) as the beneficiaries** — the memory substrate exists to make
   small models fast, high-quality, and cheap; 50 parallel frontier models is
   explicitly not the economic model.
3. **Custom harness, not Claude Code** — Claude Code's internals are opaque; the
   harness itself is part of the design. Small fast subagents assist a frontier
   model, all wired to the Datalog graph.

What the research must deliver: **limitations maps** (what existing approaches cannot
do, what a new design must beat), not best-practice recommendations.

## Research Method

Four parallel Opus deep-research subagents, each writing a full report here:

| Report | Question |
| ------ | -------- |
| research-e-datalog-substrate.md | Datalog engines (2026 maintenance-verified), semantics a designer must know, LLM∩Datalog prior art (novelty check), what Datalog buys, where it hurts |
| research-f-limitations-map.md | Failure-mode catalog of every existing approach (flat files, RAG, GraphRAG, temporal KGs, agentic search, memory products) + the cross-cutting gaps nobody solves |
| research-g-small-models.md | Does structured memory narrow the small-vs-frontier gap; what 8B models are reliable at; the real cost math incl. the 50-frontier-fan-out question; hard limits |
| research-h-custom-harness.md | Harness anatomy from open implementations; framework-vs-scratch; heterogeneous frontier+small architectures; constrained decoding; the cost of rolling your own |

## Investigation Trail

- 2026-08-20: Spike opened after Spike 001's verdicts were rejected as answering the
  wrong question (best practice, not limitations). Four Opus research agents
  dispatched.
- 2026-08-20: Report E (Datalog substrate) landed. Engine reality check: CozoDB
  upstream inactive since 2024-12, DDlog archived, XTDB 2.x dropped Datalog for SQL;
  actively-maintained embeddable options are
  Soufflé (native provenance proof trees), Nemo, Ascent/Crepe, DataScript/Datahike.
  Structural finding: no alive open engine gives Datalog + incremental view
  maintenance — assume batch fixpoint recomputation. Buys: complete deterministic
  multi-hop closure; rules as first-class retractable memory; provenance semirings
  (answers carry their source-fact sets). Limits: exact-equality joins → silent
  under-derivation (needs embedding sidecar both paths); entity resolution is the
  actual project (over-merge corrupts invisibly, propagates transitively);
  bottleneck shifts from authoring to validation. Prior art: NeuroLog (LLM→Soufflé→
  Z3), TOKI (bitemporal contradiction algebra), Scallop (differentiable). Unclaimed
  gap: agent-authored, retractable, provenance-carrying RULE base as the thing that
  accumulates.
- 2026-08-20: Report G (small models) landed. Structure narrows the gap for FORM,
  not KNOWLEDGE: with oracle retrieval ≤7B models answer only 14.6% of unknown
  questions, and retrieval context destroys 41–64pp of previously-correct answers —
  small models are transducers, never reasoners-over-the-graph. Reliable 8B menu:
  schema extraction (96.6–97% F1 with LoRA; 4B within 0.35pp), routing, reranking,
  bounded summarization; text→SQL/Cypher only with verify loops; SPARQL and
  multi-turn tool use poor. text→Datalog: zero published evidence — biggest unknown;
  build compile-and-retry. Cost math: 50× frontier fan-out ≈ $2.23/task; 50× small +
  frontier synthesis ≈ $0.24 (9.4× cheaper — thesis confirmed); BUT one frontier
  call with good structured retrieval ≈ $0.125, cheaper than both; synthesis is 95%
  of any fan-out bill. Real cascade savings 31–42%, not FrugalGPT's 98%. Levers:
  schema-validate every small-model fact before asserting (error amplification
  17×→4.4×); log frontier calls now, LoRA per task later (~20 GPU-h, 10k examples).
- 2026-08-20: Report H (custom harness) landed. Anatomy: 12 subsystems (context
  assembly, model-call layer, output parsing, permissions, tool dispatch/sandbox,
  observation truncation, budgets/termination, digests, compaction, observability,
  subagent protocol, UX); academic checklist = ETCSOVG taxonomy. Crib mini-swe-agent
  (~100 lines, >74% SWE-bench Verified) to learn; fork Pi (TS, minimal, pluggable
  compaction, local providers, no subagents) or OpenHands Agent SDK to build.
  Harness effect is large: same model, 11–48pp benchmark swings. Heterogeneous key
  result: tools + JSON-schema constraints simultaneously → 0% tool invocation on
  open-weight models; two-pass (reason free, then constrain artifact) restores 100%;
  hard schemas cost 43.5pp executable accuracy; llguidance (~50µs/token, Lark CFG —
  Datalog is a CFG) beats Outlines/XGrammar. Build-your-own costs: permission/shell
  safety, sandboxing (Cursor CVE at 9.8), prompt-cache discipline (silent 10× cost
  regression), provider churn, stopping criteria (failed runs burn 3.3× tokens).
  Memory surface: Datalog store behind MCP (schema as Resource, query as Tool) keeps
  harness choice reversible; LogicLoc precedent (LLM synthesizes Datalog, Soufflé
  runs, repair from execution feedback).

- 2026-08-20: Report F (limitations map) landed — 60-row failure table across all
  six approach families, ~70 sources. All four reports in; synthesis below.
- 2026-08-21: Correction from Chris: stop classifying CozoDB as dead/eliminated.
  Since the build is custom, fork-viability outweighs upstream activity: CozoDB is
  stable, MPL-2.0, and uniquely combines Datalog + vectors + FTS + time-travel
  embedded. Reclassified from "eliminated" to "fork-candidate (own maintenance from
  day one)". The verified facts stand (no upstream commits since 2024-12); only the
  verdict drawn from them changed.

## Results

**Verdict: VALIDATED** — the design space is mapped, the limitations are cataloged
with evidence, and the novelty space is identified. Full detail in the four
`research-*.md` reports.

### The unifying thesis

From the limitations map: **every *unfixable* failure of existing approaches lives in
statistical retrieval or LLM-judged bookkeeping; every merely *unengineered* one is
something a database with rules, provenance, and transactions has done for decades.**
That is the strongest available argument for a Datalog substrate, and it came from
the failure catalog, not from Datalog advocacy.

### Load-bearing failures a new design must beat (per approach)

- **Flat context files:** context rot is architectural (all 18 tested frontier models
  degrade with length); wholesale regeneration causes brevity bias / context
  collapse; contradictions are silently resolved, never flagged.
- **Vector RAG:** DeepMind proved representable top-k subsets are bounded by
  embedding dimension — a capacity ceiling, not an engineering gap; plus
  retrieval-state lock-in (wrong answers are stable and self-consistency can't
  catch them) and exact-identifier failure.
- **GraphRAG:** the literature is contaminated — LightRAG's 72% win rate drops to
  39% under debiased eval; only 65.8% of answer entities are in the graph at all;
  57× construction cost.
- **Temporal KGs:** LLM-judged fact invalidation is the weak point — deterministic
  `max(serial)` beats it by +10.8pp average (+21pp at 262k tokens), with named
  unpromptable failure modes (prior-override, serial-comparison drift).
- **Agentic search:** 22× tokens for worse accuracy on derivation-shaped tasks;
  41.8% coordination breakdown, 91% of which returns a confident wrong answer; can
  only find what is written, never derive.
- **Memory products:** disputed self-reported benchmarks (Zep/Mem0 LoCoMo
  84→58→75%, unresolved); Mem0's own data shows a no-memory full-context baseline
  beating it; supersession failures filed on their own trackers; heavy 2025–2026
  abandonment/pivot churn (CozoDB, Letta, Zep CE, Mem0 local MCP, KuzuDB).

### The five unclaimed gaps (the novelty claims available)

1. Deterministic supersession/invalidation with no LLM in the decision path.
2. Conflict resolution as a declared, evaluated policy (GPT-4o scores 60% on even
   single-hop conflicts).
3. Provenance-carrying derivation chains — "provenance collapse" is named in the
   literature and shipped by no one; Datalog's provenance semirings solve it
   compositionally, and Soufflé has proof trees natively.
4. Deterministic multi-hop derivation (fixpoint closure cannot miss a hop) instead
   of retrieve-and-hope or explore-and-hope.
5. Write policies measured as rigorously as reads (writers hit only 60–85% of
   optimal; 17.9–30.4% silent format corruption on weak backbones).

Prior art occupying nearby space (the novelty check): NeuroLog (LLM→Soufflé→Z3),
TOKI (bitemporal contradiction algebra), Scallop (differentiable Datalog), LogicLoc
(LLM synthesizes Datalog + repairs from Soufflé feedback), Lians (commercial
deterministic supersession). The unoccupied position: **an agent-authored,
retractable, provenance-carrying RULE base as the accumulating memory itself.**

### Design constraints the evidence imposes

**Substrate (report E):** DDlog is archived; XTDB dropped Datalog. Two candidate
classes, split by maintenance model:

- **Fork-candidate: CozoDB** (MPL-2.0, embedded, pure Rust). Upstream is inactive
  (no commits since 2024-12) but the release is stable, and since this build is
  custom anyway, forking is acceptable — adoption means owning maintenance from day
  one, priced in deliberately. What makes it worth that price: it is the only engine
  surveyed combining Datalog + HNSW vectors + FTS + time-travel in one store, which
  answers the exact-equality-join limitation *inside* the engine instead of via an
  external embedding sidecar.
- **Maintained upstreams:** Soufflé (native provenance proof trees), Nemo,
  Ascent/Crepe, DataScript/Datahike — for anything not forked.

No open engine pairs Datalog with incremental view maintenance — design for batch
fixpoint recomputation either way. The three real costs stand regardless of engine:
exact-equality joins mean silent under-derivation (CozoDB's built-in vectors/FTS
mitigate this in-store; every other engine needs an embedding sidecar on both write
and query paths); entity resolution is the actual project (over-merge corrupts
invisibly and propagates transitively); the bottleneck shifts from authoring to
validation — determinism amplifies wrong facts as faithfully as right ones.

**Small models (report G):** structure narrows the gap for FORM, not KNOWLEDGE —
with oracle retrieval, ≤7B models answer only 14.6% of questions they don't already
know, and retrieved context destroys 41–64pp of previously-correct answers. Small
models are transducers (schema extraction 96.6–97% F1 with LoRA, 4B within 0.35pp;
routing; reranking; bounded summarization), never reasoners-over-the-graph — the
Datalog engine does the reasoning, which is precisely why the pairing works.
text→Datalog has zero published evidence: the design's biggest unknown; build
compile-and-retry. Economics: 50× small + frontier synthesis ≈ $0.24/task vs $2.23
for 50× frontier (thesis confirmed), but one frontier call with good structured
retrieval ≈ $0.125 — fan-out must justify itself on coverage, not cost. Synthesis is
95% of any fan-out bill. Schema-validate every small-model fact before assertion
(error amplification 17×→4.4×).

**Harness (report H):** 12 subsystems (ETCSOVG as checklist); harness quality swings
same-model benchmarks 11–48pp, so building one is high-leverage, not plumbing. Crib
mini-swe-agent (~100 lines, >74% SWE-bench Verified) to learn the loop; fork Pi or
the OpenHands Agent SDK to build. The decisive heterogeneous-model result: tools +
JSON-schema constraints applied simultaneously drive open-weight tool invocation to
0%; two-pass (reason free-form, then grammar-constrain the artifact) restores 100%.
llguidance (~50µs/token, Lark CFGs — Datalog is a CFG) is the constrained-decoding
choice. Put the Datalog store behind MCP (schema as Resource, query as Tool) so the
harness choice stays reversible. Budget real effort for the unglamorous tail:
permissions/sandboxing (Cursor's CVSS 9.8 CVEs were harness bugs), prompt-cache
discipline (silent 10× cost regression), stopping criteria (failed runs burn 3.3×
tokens).

### Signal for the build

The evidence supports a specific novel position: facts + rules in a Datalog store
where supersession, conflict, multi-hop derivation, and provenance are deterministic
database semantics (the things LLM bookkeeping measurably fails at), small LoRA'd
transducer models feed and query it through two-pass constrained decoding, one
frontier model reasons over derived-and-provenanced answers, and the whole store
sits behind MCP. The three risks to spike next, in kill-order: (1) text→Datalog
generation quality (no published evidence), (2) entity resolution policy (the actual
project), (3) fixpoint recomputation latency at realistic corpus size (no
incremental engine exists).
