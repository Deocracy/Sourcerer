# Research E — Datalog as the Substrate for an LLM Agent's Memory Graph

**Date of research:** 2026-08-20 / 2026-08-21. Every maintenance claim below was
checked against the actual repository (GitHub API: `pushed_at`, `archived`, last
commit dates, latest release) or the package registry (crates.io) on that date,
not from memory. Where a project's marketing and its commit log disagree, the
commit log wins.

**Framing:** the reader is designing a *novel* Datalog-based memory graph for an
LLM agent. This document is a map of the design space and its failure modes. It
is deliberately not a "use product X" recommendation — the only recommendations
here are about which *engine* is safe to build on, because building on a corpse
is the single cheapest way to lose a year.

---

## 0. Executive summary

Three findings dominate:

1. **The engine that best fits the brief on paper is dead.** CozoDB — embedded,
   Datalog + HNSW vectors + full-text + time-travel, bindings for every host
   language — is exactly the shopping list an agent-memory designer would write.
   Its last commit was **2024-12-04**, its last release **v0.7.6, 2023-12-11**,
   and dbdb.io classifies it **Abandoned**. The community fork
   (`cozo-community/cozo`) is also dead (last commit 2024-12, 10 stars, zero
   releases). Do not build a product on it. Read its design as a spec.

2. **XTDB is no longer a Datalog database.** XTDB 1.x was Datalog; XTDB 2.x
   (current, v2.1.0) is SQL:2011 bitemporal + XTQL. The bitemporality survives,
   the Datalog does not. Any plan predicated on "XTDB gives me Datalog +
   bitemporality" is out of date.

3. **The "LLM extracts facts, Datalog composes them" pattern is already
   published prior art**, most sharply in **NeuroLog** (arXiv 2606.00669, May
   2026) for vulnerability discovery, and the "deterministic supersession over a
   bitemporal fact ledger" pattern is already published in **TOKI** (arXiv
   2606.06240, June 2026) and already shipping commercially (**Lians**). A novel
   design must differ from *those*, not from Mem0/Zep/GraphRAG.

---

## 1. Engine landscape, 2026-08-20, with honest maintenance status

### 1.1 Comparison table

Legend for **Status**: **Alive** = commits within ~6 weeks. **Slow** = commits
within ~6 months, no sign of abandonment. **Dormant** = >18 months, not archived.
**Dead** = archived, or >18 months with an explicit abandonment signal.

| Engine | Deploy model | Incremental eval | Negation | Aggregation | Bindings | License | Last commit / release (verified) | Status |
|---|---|---|---|---|---|---|---|---|
| **Soufflé** | Embedded lib / CLI; compiles Datalog → parallel C++ | **No** (mainline). Research forks only — Soufflé-counting / Soufflé-elastic, PPDP'21, still an open issue (#2162) | Stratified | Yes (`min/max/count/sum`, stratified) | C++ API; no first-class Python/JS | UPL-1.0 | commit **2026-07-13**; release **2.5 (2025-03-24)** | **Alive** but release-starved (~17 mo since a tag; 132 open issues) |
| **CozoDB** (`cozodb/cozo`) | **Embedded** (also server); RocksDB/SQLite/mem | No (full re-eval; has "fixed rules"/algorithms) | Stratified | Yes | Rust, Python, Node, WASM/browser, Java, Swift, Go, C | MPL-2.0 | commit **2024-12-04**; release **v0.7.6 (2023-12-11)** | **DEAD.** dbdb.io: *Abandoned* |
| **cozo-community/cozo** (fork) | as above | — | — | — | — | MPL-2.0 | commit **2024-12-04**, 10 stars, **no releases** | **DEAD** |
| **Datomic** | Server (transactor) + peer/client library, JVM | No IVM for user queries | `not` / `not-join` (+ `or`/`or-join`) | Yes, in `:find` spec | Clojure/Java (JVM only) | **Binaries Apache-2.0 and free since Apr 2023; source is NOT open** | Actively developed inside Nubank | **Alive, closed-source** |
| **DataScript** | **Embedded, in-memory** (JVM + ClojureScript + JS) | No | `not` / `not-join` | Yes | Clojure, ClojureScript, **JS** | EPL-1.0 | commit **2026-08-15**, **v1.8.1** | **Alive**, healthy release cadence |
| **Datahike** | Embedded, **durable** (Datascript-compatible), JVM | No | as Datascript | Yes | Clojure/JVM | EPL-1.0 | commit **2026-08-20** | **Alive** |
| **XTDB 2.x** | Server (Kafka/object-store), columnar Arrow | No | SQL semantics | SQL aggregates | JDBC/Postgres wire, Clojure | MPL-2.0 | commit **2026-08-20**; release **v2.1.0 (2025-12-01)** | **Alive — but no longer Datalog.** SQL:2011 bitemporal + XTQL |
| **Google Mangle** | Embedded Go library / CLI | No | Stratified (negation) | Yes (+ function calls, optional type-checking) | **Go** only | Apache-2.0 | commit **2026-08-05** | **Alive**, but library-grade: no releases, no version tags; upstream appears to be mirroring/moving to Codeberg (`TauCeti/mangle-go`) |
| **DDlog / differential-datalog** | Compiles Datalog → Rust over differential dataflow | **Yes — its whole point** | Stratified | Yes | Rust, C, Java, Go | MIT | **archived**; last commit **2022-11-29** | **DEAD (archived by VMware)** |
| **differential-dataflow** | Rust library (not Datalog) | **Yes** | via operators | via operators | Rust | MIT | **0.25.1 (2026-07-15)**, commit 2026-08-20 | **Alive** — the substrate DDlog died on top of |
| **Feldera / DBSP** | Server + Rust crate (`dbsp`) | **Yes — DBSP, VLDB'23 best paper** | SQL semantics, incl. non-monotonic recursion | Yes | SQL front-end; Rust crate; Python/REST client | Mixed (runtime MIT; repo `NOASSERTION`) | crate **0.336.0 (2026-08-20)**, repo pushed **2026-08-21** | **Very alive** — but SQL, not Datalog syntax |
| **Hydro** (ex-Hydroflow) | Rust dataflow / distributed | Yes (dataflow) | — | — | Rust | Apache-2.0 | **2026-08-21** | **Alive**, research-forward (Dedalus lineage) |
| **egglog** | Embedded Rust lib + CLI | Rebuild/saturation, not IVM | Limited (`unstable` constructs) | Yes (lattice-ish merge fns) | Rust, Python (`egglog-python`) | MIT | **3.0.0 released 2026-08-19**, commit 2026-08-20 | **Very alive** |
| **egg** (e-graphs) | Rust lib | n/a | n/a | n/a | Rust | MIT | commit **2026-07-19** | **Alive** (maintenance mode; egglog is the successor) |
| **Clingo / ASP** | CLI + embeddable lib | No (but incremental *solving* via multi-shot) | **Default negation + classical negation, non-stratified OK** (stable models) | Yes (`#count`, `#sum`, `#min`, `#max`) | C, C++, **Python**, Lua | MIT | **v5.8.2 (2026-08-14)** | **Very alive** |
| **Scallop** | Python/PyTorch-embedded; Rust core | No | Stratified | Yes | **Python + PyTorch** | MIT | commit **2026-06-26** | **Slow** (~2 months idle; academic cadence) |
| **Ascent** | Rust **macro** — compiles at build time | No | Stratified | Lattices (built-in), BYODS | Rust only (proc-macro) | MIT | repo **2026-06-18**; crate **0.8.0 (2025-03-02)** | **Slow / stable**. Parallel variant `ascent_par` |
| **Crepe** | Rust **macro** | No | Stratified | Minimal | Rust only | Apache-2.0 | **v0.2.0 (2025-12-14)** after a long gap | **Slow but alive** |
| **Nemo** (`knowsys/nemo`) | Embedded Rust + CLI (`nmo`) + WASM/web + language bindings | No (in-memory batch) | **Stratified** | Yes | Rust, Python, **WASM/browser** | Apache-2.0 | commit **2026-08-20** | **Alive** — TU Dresden research group |
| **Percival** | Browser notebook (WASM) | No | — | — | JS/WASM | MIT | last push **2023-02-16** | **Dormant** |
| **Logica** | Compiler: Datalog → SQL (BigQuery/DuckDB/Postgres/SQLite) | Whatever the SQL backend does | Yes | Yes | Python | Apache-2.0 | **2026-08-20** | **Alive** (not on the reader's list; belongs on it) |
| **Datafrog** | Tiny Rust "toolkit for writing Datalog by hand" | No | Manual | Manual | Rust | Apache/MIT | crate **2.0.1 (2019-01-02)** | **Frozen** — but load-bearing (rustc/Polonius), 4.7M downloads |
| **RelationalAI (Rel)** | **Commercial**, Snowflake Native App coprocessor | Yes (semi-naive + IVM internally) | Yes | Yes | Snowflake / SDKs | Proprietary | GA since Nov 2024 | **Alive, closed, not embeddable** |
| **declarative-dataflow (3DF)** | Datalog over differential dataflow | Yes | — | — | Rust | MIT | last push **2020-01-20** | **DEAD** |

### 1.2 The shortlist, and why

For an **embedded, single-user, local-first agent memory** (which is what an
agent's knowledge graph is), the realistic candidates reduce to four:

- **Soufflé** — the fastest, most battle-tested Datalog with built-in
  **provenance/proof trees** (`explain`), which is unusually well matched to a
  memory corpus that carries source pointers. Costs: it is a *compiler*, not a
  database. You feed it CSV/relations and it computes a full fixpoint; there is
  no incremental update, no storage layer, no transactions, and no Python/JS
  binding. You would be running it as a subprocess over exported facts.
- **Nemo** — a modern, actively developed Rust rule engine with stratified
  negation, aggregates, **existential rules (TGDs)**, RDF-compatible datatypes,
  and Python/WASM bindings. In-memory batch evaluation. The most "designed for
  knowledge graphs" of the alive engines.
- **Ascent** (or **Crepe**) — Datalog *as a Rust macro*. No engine to ship, no
  IPC; your rules become Rust code at compile time, with lattices for
  aggregation. Cost: rules are fixed at build time (a hard constraint if you
  want the agent to *write* rules at runtime), and Ascent's crate hasn't been
  published since 2025-03 even though the repo moves.
- **DataScript / Datahike** — the only alive engines that are simultaneously
  embedded, transactional, and Datalog-queryable, with DataScript giving you a
  real **JS** binding. Cost: their Datalog is a *query language over an EAV
  store*, not a bottom-up fixpoint rule engine — recursive rules exist, but
  there is no persistent IDB, no materialised derived relations, no incremental
  view maintenance. You get "query with recursion", not "a derived-fact layer".

And the honest structural point: **no alive, embedded, open engine gives you
Datalog + incremental view maintenance in one box.** DDlog did and is archived.
Cozo did not do IVM and is dead. Feldera/DBSP does IVM brilliantly but speaks
SQL. If you want incremental derivation, you either (a) re-run a fixpoint and
eat the cost, (b) build on `differential-dataflow` or `dbsp` directly and write
your own Datalog front-end, or (c) accept batch recomputation on a schedule.
Option (c) is almost certainly correct for an agent memory of 10⁴–10⁶ facts,
where a full Soufflé/Nemo fixpoint is milliseconds-to-seconds.

---

## 2. Datalog semantics a designer must actually understand

### 2.1 Recursion and least fixpoints

A pure Datalog program is a set of Horn rules `H :- B1, ..., Bn`. Its meaning is
the **least fixpoint** of the immediate-consequence operator `T_P`: start with
the EDB (base facts), apply all rules, add whatever is derived, repeat until
nothing changes. Because `T_P` is monotone over a finite Herbrand base, this
fixpoint exists, is unique, and is reached in finitely many steps. This is where
*determinism* comes from — the same facts and rules always give the same derived
set, regardless of rule order, join order, or evaluation strategy.

That guarantee is the entire value proposition. Everything below is a way of
losing it.

### 2.2 Stratified negation

Adding `not` breaks monotonicity: adding a fact can retract a conclusion, and a
program like `p :- not q. q :- not p.` has two minimal models and no least one.
**Stratification** is the standard repair: build a dependency graph over
predicates; a program is stratified if no predicate depends *negatively* on
itself, transitively. Then evaluate stratum by stratum — by the time you
evaluate `not q`, `q` is already fully computed and closed. The result is again
unique and deterministic.

Practical consequences for a memory design:

- "This lesson is **superseded** unless something supersedes *it*" is fine
  (negation over a lower stratum). "A applies unless B applies, and B applies
  unless A applies" is not, and the engine will reject the program.
- Every engine in the table above except Clingo does exactly stratified
  negation. **Clingo/ASP is the exception**: it uses stable-model semantics and
  handles non-stratified negation by producing *multiple* answer sets — which is
  powerful for defaults/exceptions and constraint search, and a disaster if your
  memory query is supposed to return one answer.

### 2.3 Safety / range-restriction

Every variable in a rule head (and in a negated or arithmetic literal) must
appear in a **positive** body literal. Without this, a rule ranges over an
infinite domain. Engines enforce it; the practical effect is that rules like
"anything not mentioned in the corpus is unconstrained" simply cannot be
written. Defaults must be expressed over an explicitly enumerated domain.

### 2.4 No existential variables in heads — and Datalog±

Datalog heads cannot invent new values: you cannot write "every decision has
*some* rationale" and have the engine mint a rationale node. This is a feature —
it is what makes the Herbrand base finite and therefore guarantees termination.

The extension that lifts it is **Datalog±** / **existential rules** /
**tuple-generating dependencies (TGDs)**, evaluated by the **chase**, which
invents fresh nulls. The price is severe and worth stating flatly: conjunctive
query entailment under general existential rules is **undecidable**, and chase
termination is itself undecidable in general. Decidability is recovered only in
syntactic fragments — guardedness, stickiness, acyclicity/chase-termination
classes. **Nemo is the one engine in the shortlist that implements existential
rules**, which makes it interesting for ontology-shaped memory and dangerous if
you use them casually.

For a memory graph, the design implication is: **the LLM, not the rule engine,
mints new entity identifiers.** All node creation happens at write time, in the
extraction step. The rule layer only ever relates identifiers that already
exist. Keeping that line clean is what preserves termination.

### 2.5 Aggregation semantics

Aggregation (`count`, `sum`, `min`, `max`) is non-monotone in the same way
negation is: adding a fact can change a count, invalidating a conclusion derived
from the old count. Engines therefore require aggregates to be **stratified**
too — you may not aggregate over a relation that transitively depends on the
aggregate's result. Recursive aggregation ("shortest path", "confidence
propagation") is only safe when the aggregate is a **lattice meet/join** over a
well-founded order, which is precisely why Ascent and egglog expose *lattices*
rather than plain aggregates. If your memory wants "the confidence of a derived
lesson is the min of its premises' confidences", model it as a lattice, not as
`min` over a recursive relation.

### 2.6 Termination guarantees

Pure Datalog always terminates: finite EDB + no value invention ⇒ finite
Herbrand base ⇒ fixpoint in finitely many steps. Termination is lost the moment
you add any of: existential rules (§2.4), unbounded arithmetic in heads (`n+1`
generates infinitely many constants), functor/constructor terms (Soufflé's
ADTs/records, Nemo's function symbols), or `#` value-inventing built-ins. This
is not a theoretical footnote — "arithmetic in the head" is the single most
common way a hand-written Datalog memory rule turns into an infinite loop.

### 2.7 Semi-naive evaluation

The standard bottom-up algorithm. Naive evaluation re-derives every previously
known fact at every iteration; **semi-naive** (differential) evaluation tracks
only the *delta* produced by the last round and joins the delta against the full
relations, so each derivation is attempted once. Every engine in the table does
this. It is why Datalog fixpoints over 10⁶ facts are cheap. Note that semi-naive
is *within-run* incrementality; it does not give you incrementality *across*
runs when new facts arrive — that is §2.9.

### 2.8 Magic sets

Bottom-up evaluation computes everything derivable, which is wasteful when you
asked one question ("what is downstream of D-69?"). **Magic sets** is a program
rewriting that pushes the query's bindings into the rules, simulating top-down
goal-directedness while keeping bottom-up efficiency. Soufflé implements it
(`.pragma "magic-transform"`). For a memory graph this matters a lot: without
it, every question triggers a full transitive closure of the whole corpus. With
it, derivation is restricted to the reachable neighbourhood of the query. If
your engine lacks magic sets, you emulate it by seeding a `query_seed` relation
and writing your rules to be seed-guarded — worth designing for from day one.

### 2.9 Incremental view maintenance (differential dataflow → DDlog → DBSP →
Feldera)

The lineage matters because it explains what's available:

- **differential dataflow** (McSherry) generalises semi-naive to arbitrary
  changes (inserts *and* deletes) over a partially ordered timestamp lattice,
  and supports incremental *iterative* computation — i.e. incremental fixpoints.
  Alive, `0.25.1`, but it is a dataflow library: you write operators, not rules.
- **DDlog** compiled Datalog onto it and gave "change the EDB, get the delta of
  the IDB". **It is archived.** Its own literature also records that
  incrementality is not free: measurements in the Soufflé incrementalisation
  work found DDlog ~5× *slower* than non-incremental Soufflé on small updates
  (~0.04% of the EDB) in analyses with inequality constraints, because
  inequalities cannot be indexed and so defeat delta-restricted evaluation.
- **DBSP** (Budiu, Chajed, McSherry, Ryzhyk, Tannen; VLDB'23 best paper)
  reformulated the whole thing as a stream-circuit calculus with a *mechanical*
  rule for incrementalising any query, including non-monotonic recursion and
  aggregation, with a Lean-verified core. **Feldera** is the production
  implementation (`dbsp` crate 0.336.0, published 2026-08-20). It speaks SQL.
- **Soufflé's own incremental variants** (Soufflé-counting, Soufflé-elastic,
  PPDP'21) exist as papers and an open issue, not as shipped mainline features.

Design implication: incremental derivation is a *real* capability but it is
currently only purchasable in SQL clothing (Feldera) or by building on
`differential-dataflow`/`dbsp` yourself. For a memory corpus that grows a few
facts per agent turn and is queried a few times per turn, **batch
recomputation is very likely the right answer** and the honest engineering call.

### 2.10 Provenance semirings — why this section matters most

Green, Karvounarakis and Tannen (PODS 2007) showed that bag semantics,
probability, trust/access-control, and **why-provenance** are all the same
algorithm parameterised by a **commutative semiring** `(K, ⊕, ⊗, 0, 1)`:
annotate each base fact with an element of `K`, propagate `⊗` through joins and
`⊕` through unions, and read the annotation off the answer. Pick the semiring
and you pick what the annotation *means*:

| Semiring | What an answer's annotation tells you |
|---|---|
| Boolean | whether it's derivable |
| ℕ (bag) | how many derivations |
| Why-provenance (sets of sets of fact-ids) | **which sets of source facts suffice** |
| Provenance polynomials `ℕ[X]` | the full derivation structure |
| Tropical (min, +) | shortest/cheapest derivation |
| Viterbi / min-max-prob | a confidence score |
| Access-control lattice | who may see this conclusion |

This is exactly the mechanism a memory corpus with **source pointers** wants:
every derived "what applies now" fact can carry the set of source learnings that
produced it, computed by the *same* fixpoint, at no extra modelling cost.

Two practical notes. **Soufflé ships provenance natively**
(`--provenance=explain`), producing *minimal-height proof trees* with
`explain`, `setdepth`, and `subproof` commands — you can literally ask the
engine why it believes a derived fact, and it prints the derivation. **Scallop**
is built entirely around provenance semirings and makes them *differentiable*.
And the theory is subtler for recursive Datalog than for conjunctive queries —
"Revisiting Semiring Provenance for Datalog" (KR 2022) shows the naive
formal-power-series account has gaps once negation and recursion mix. If
provenance is load-bearing in your design, read that paper before committing to
a semiring.

---

## 3. Prior art at the LLM ∩ Datalog intersection — the novelty check

This is what a "brand new way" has to be new *relative to*.

### 3.1 Differentiable / neurosymbolic Datalog

- **Scallop** (Li et al., PLDI 2023; `scallop-lang/scallop`, MIT, last commit
  2026-06-26). A Datalog with recursion, negation and aggregation whose
  evaluation is made differentiable via **provenance semirings**, embedded in
  Python and composable with PyTorch modules. This is the canonical "neural
  perception + symbolic Datalog reasoning, trained end-to-end" system. If your
  design wants confidence-weighted derivation, Scallop already did the algebra.
- **Dolphin** (arXiv 2410.03348) — a later, GPU-scalable programmable
  neurosymbolic framework in the same lineage.

### 3.2 LLM writes the logic program

A large and fast-moving cluster. The recurring architecture is: LLM translates
NL → logic program → solver runs → solver errors feed back → LLM repairs.

- **ASP-Bench** (NSE@ICSE 2026, arXiv 2602.01171) — benchmark for NL → Answer
  Set Programs, explicitly agentic: the system reads `clingo` error messages and
  failed tests and iteratively repairs the program.
- **"LLMs as ASP Programmers: Self-Correction Enables Task-Agnostic
  Nonmonotonic Reasoning"** (arXiv 2604.27960) — measured ~2.18 revision rounds
  to a correct program.
- **CLMASP** — LLM + ASP for robot task planning.
- **"Intermediate Languages Matter: Formal Choice Drives Neurosymbolic LLM
  Reasoning"** (arXiv 2502.17216) — the *choice* of formal target language
  materially changes accuracy. Directly relevant: it is evidence that "Datalog
  vs ASP vs Prolog vs SMT" is a real design decision, not a taste question.
- **"Sound and Complete Neurosymbolic Reasoning with LLM-Grounded
  Interpretations"** (arXiv 2507.09751) — how to use an LLM as an oracle for
  atomic truth without destroying the logic's soundness/completeness.

### 3.3 LLM as fact extractor, Datalog as composer — the closest prior art

- **NeuroLog** (arXiv 2606.00669, 2026-05-30). Architecture: **an LLM extracts
  typed dataflow facts one function at a time; a Soufflé rule mesh composes
  those facts into cross-function findings; a Z3 post-pass filters infeasible
  ones**; a second LLM agent turns each SAT model into a crashing input. The
  paper's own related-work framing is notable — it concedes that
  static-narrowing-plus-SMT (Saturn, Pinpoint) and Datalog-with-SMT (Formulog)
  are prior art, and claims novelty only in the *composition*.

  **This is the same shape as "LLM extracts memory facts, Datalog composes
  them".** Any novelty claim must be about the memory-specific parts
  (supersession, temporal applicability, rules-as-memories), not about the
  extract-then-derive pattern itself.

- **Neurosymbolic Repo-level Code Localization** (arXiv 2604.16021) — same
  family, applied to localisation.

### 3.4 Logic-programming *agent memory* specifically

Searched hard for this; the honest finding is that it is **thin but no longer
empty**, and the two nearest neighbours arrived in mid-2026.

- **TOKI: A Bitemporal Operator Algebra for Contradiction Resolution in
  LLM-Agent Persistent Memory** (arXiv 2606.06240, 2026-06-04). Defines four
  typed contradiction-resolution operators (temporal, provenance-based,
  uncertainty-preserving, and a fourth composite) over a **bitemporal** fact
  store, with isolation guards that exclude write-time anomalies, plus a lower
  bound for boundedly nondeterministic oracles. It explicitly assumes a
  bitemporal substrate and cites **Datomic** and **XTDB** as the production
  realisations of that substrate. Scope is stated honestly as single-process.

  This is the closest published work to "stratified derivation of what applies
  now from supersession facts". It is an *algebra over a bitemporal store*
  rather than a Datalog rule layer — that gap is where novelty could live.

- **Lians** (commercial, MCP server, 2026). Local-first bitemporal agent memory
  with **deterministic supersession**, point-in-time recall, signed provenance,
  tamper-evident audit history, crypto-shred erasure, SQLite/Postgres. Its
  supersession pipeline is a three-stage cascade: metadata-key overlap →
  deterministic SUPERSEDES/CONFIRMS/ADDS → *optional* LLM adjudication for
  paraphrase only. Reports 100% supersession accuracy and 0 stale facts in top-5
  against a mem0-style baseline.

  Not Datalog. But it occupies the market position "deterministic supersession
  memory with provenance", and its 3-stage design is the pragmatic answer to the
  entity-resolution problem in §5.3.

- **Multiply** — a production multi-agent platform that ran on **Datomic**, then
  **XTDB**, then migrated *off* both to Rama (Red Planet Labs blog, 2025-03).
  A useful negative datapoint about Datalog-store operability at scale.

- **RoMem** (2026, cited in TOKI) — learns per-relation volatility and
  "phase-rotates" obsolete facts out of retrieval reach without deleting them.

### 3.5 Graph agent memory that is *not* logic-based (the field you'd be
differentiating from)

AriGraph (arXiv 2407.04363), A-MEM (arXiv 2502.12110), Cognee, Zep/Graphiti,
Mem0, KG-Agent, LogicRAG. All property-graph or vector-graph hybrids with an LLM
in the reasoning loop. The recurring published critique — and the opening for a
Datalog design — is that **graph memories rely on predefined schemas and can
only categorise new information within preset frameworks**, and that GraphRAG
multi-hop retrieval is heuristic and single-shot, so "if crucial evidence is
absent from the selected candidates, the reasoning process collapses"
(arXiv 2509.25530).

### 3.6 Rules vs embeddings for KG reasoning

Rule mining (AMIE, **AnyBURL**) extracts interpretable Horn clauses and gives
exact, explainable inference; embeddings (TransE-family) scale better and
generalise to unseen patterns but degrade on sparse entities and give no
explanation. Hybrids (RulE, arXiv 2210.14905; RPJE; AR-KGAT) inject rules into
embeddings. 2025 results report that aggressively pruned rule sets (5–30 rules
per relation, ~1,000 total) retain ~91% of AnyBURL-scale performance with 31×
speedups — i.e. **small, curated rule sets are competitive**, which is
encouraging for a hand-plus-LLM-authored memory rule base of realistic size.

---

## 4. What Datalog buys an agent memory that RAG / GraphRAG / property graphs do
not

Five things, concretely.

### 4.1 Deterministic multi-hop closure with no LLM in the loop

"Everything downstream of decision D-69" is a transitive closure:

```
downstream(X, Y) :- depends_on(Y, X).
downstream(X, Z) :- downstream(X, Y), depends_on(Z, Y).
?- downstream("D-69", Z).
```

This is one rule pair, evaluated by semi-naive fixpoint in microseconds, and it
is **complete** — it returns every downstream item, not the top-k that survived
a similarity threshold. Cypher/Gremlin can express variable-length paths too,
but Datalog composes *derived* relations recursively (a derived relation can
feed another rule), which property-graph query languages do not do natively.
Vector RAG cannot do this at all: multi-hop over embeddings is
retrieve-reason-retrieve with an LLM at each hop, which is non-deterministic,
slow, and lossy — exactly the failure mode arXiv 2509.25530 documents.

The crucial property is **recall completeness**. For questions like "what does
this change break?", a retriever that misses one hop gives a confidently wrong
answer. A fixpoint cannot miss a hop.

### 4.2 Rules as first-class memory entries

In a prose memory, "if we're touching auth, remember the token-refresh race" is
a paragraph that must be *retrieved* and then *applied* by the LLM. In Datalog
it is:

```
constraint(Task, "token-refresh-race") :- touches(Task, "auth").
```

Consequences: it fires whenever its precondition holds rather than whenever a
retriever happens to surface it; it composes with other rules (a constraint can
trigger another rule); it can be tested (assert facts, check the derived set);
and it can be **retracted precisely** — deleting one rule removes exactly the
conclusions that depended on it, which is impossible with a prose memory whose
influence is diffuse.

This is also where the design gets genuinely novel relative to §3: existing
agent memories store *facts* and let the LLM supply the rules. Storing the rules
*as memory* and letting the engine supply the inference is the inversion.

### 4.3 Stratified derivation of "what applies now"

Supersession is a negation-over-a-lower-stratum problem, which is precisely what
stratified Datalog is for:

```
superseded(L)  :- supersedes(_, L).
applies(L)     :- lesson(L), not superseded(L).
applies_to(L,T):- applies(L), scope(L, S), task_in_scope(T, S).
```

`superseded` is stratum 1, `applies` is stratum 2, `applies_to` is stratum 3.
The result is unique and order-independent. Add valid-time and it becomes
point-in-time recall:

```
applies_at(L, T) :- lesson(L), valid_from(L, F), F <= T,
                    not superseded_before(L, T).
```

Compare with the alternative: an LLM reading twelve retrieved learnings and
deciding which are stale. That decision is non-deterministic, unauditable, and
degrades as the corpus grows. TOKI's whole contribution is a formal algebra for
this problem — which is evidence both that the problem is real and that the
naive version is wrong in interesting ways.

### 4.4 Provenance-carrying answers

With a why-provenance semiring (or Soufflé's `explain`), every derived answer
comes with the set of base facts that produced it, computed by the same fixpoint
(§2.10). So "you should not do X" is returned together with "because of
learnings L-12 and L-31, via rules R4 and R9", and the proof tree is
machine-checkable rather than an LLM's post-hoc rationalisation. For a memory
corpus that already carries source pointers, the semiring makes those pointers
*compositional* — the pointer set of a derived fact is computed, not curated.

This is the capability that most cleanly beats RAG. RAG can cite *retrieved
chunks*. It cannot cite a *derivation*.

### 4.5 Incremental recomputation on new facts

Semi-naive evaluation already means a fixpoint costs O(new derivations), not
O(corpus). Across runs, true IVM (delta in → delta out) is available only via
differential-dataflow/DBSP (§2.9) — and the honest caveat is that DDlog's own
benchmarks showed incrementality can be a 5× *pessimisation* on small updates
when rules use un-indexable inequality constraints. **Be concrete and modest
here:** for an agent memory of realistic size, "recompute the whole fixpoint on
each write" is sub-second and is the right first design. Reserve IVM for the
case where measurements demand it.

---

## 5. LIMITATIONS — where Datalog hurts

### 5.1 No fuzzy or semantic matching, at all

Datalog joins on **exact term equality**. `lesson("auth token refresh")` and
`lesson("authentication token renewal")` are two unrelated constants. There is
no `~=`, no cosine similarity, no stemming, no synonymy. Every engine in §1 is
the same on this point; Cozo was the only one that put HNSW vectors *inside* the
Datalog, and Cozo is dead.

Therefore the architecture is forced: **an embedding/lexical sidecar plus LLM
entity resolution at write time, and Datalog only over already-canonicalised
identifiers.** Two sub-consequences that are easy to underestimate:

- The *query* path also needs the sidecar. "What did we learn about auth?" is a
  similarity question before it is a derivation question. The realistic shape is
  vector/BM25 → candidate entity ids → Datalog derivation seeded on those ids
  (which is also your poor-man's magic sets, §2.8).
- Anything the extractor fails to canonicalise is **invisible to inference**,
  not merely lower-ranked. In RAG a near-miss still surfaces at rank 7. In
  Datalog a near-miss produces *no join*, and therefore no derived fact, and
  therefore silence. **Datalog's failure mode is silent under-derivation**, and
  silence is much harder to notice than a bad ranking.

### 5.2 Schema and predicate design burden

Datalog demands you commit, up front, to a predicate vocabulary: is it
`decision/3`, or `decision(Id)` plus `decided_at/2` plus `decided_by/2`? Arity
changes are breaking changes across every rule. There is no `MERGE (n:Thing {…})`
escape hatch and no schema-on-read.

This is a real tax, and it is paid repeatedly, because a memory corpus's
ontology is *discovered*, not designed — you learn what predicates you needed
after six months of use. Mitigations, in order of laziness:

- **Model everything as a quad/EAV**: `fact(Entity, Attribute, Value, SourceId)`.
  One predicate, infinite attributes, no arity churn. You lose the type-checking
  and the query-planner's help; you keep your sanity. This is what
  Datomic/DataScript/RDF do, and it is why they survive schema drift.
- Keep a **thin core** of typed predicates for the handful of relations rules
  actually recurse over (`supersedes`, `depends_on`, `scope`) and leave
  everything else in the EAV soup.
- Note that Nemo's RDF-compatible model and Mangle's *optional* type-checking
  are both deliberate concessions to this problem.

### 5.3 Entity resolution is the unsolved hard part

Two learnings that name the same concept differently must become the same
constant, or §5.1 silently swallows them. This is the classic KG problem and it
is **not solved** in production systems. The documented failure modes cut both
ways:

- **Under-merging**: "the Seattle office", "the building on Pine", "the Pine
  Street location" become three nodes; queries return a third of the truth.
- **Over-merging**: two genuinely distinct entities silently collapse and the
  graph is corrupted — *and the corruption is invisible until it is expensive to
  undo*. This is worse than under-merging, because under-merging degrades recall
  while over-merging manufactures false derivations, which a Datalog engine will
  then propagate transitively and confidently.

Also worth internalising: **resolution and deduplication are different
problems.** Resolution assigns a canonical label to an existing reference;
deduplication decides whether a new node is created at all. Conflating them is a
common design bug.

The practical state of the art is a cascade like Lians': cheap deterministic
keys first, string/embedding similarity second, LLM adjudication only for the
residual paraphrase cases — plus a human-review queue and a periodic offline
consolidation pass. Budget for this as **the** dominant engineering cost of the
whole system. It is bigger than the Datalog part.

### 5.4 Expressivity cliffs

Datalog is not a general-purpose language, and it fails abruptly rather than
gracefully:

- **Aggregation** must be stratified (§2.5). "Confidence of a conclusion is a
  function of its premises' confidences, recursively" is *not* expressible as
  plain recursive aggregation — you need a lattice (Ascent), a provenance
  semiring (Scallop), or a manual iteration bound.
- **Arithmetic in heads breaks termination** (§2.6). This is the most common
  self-inflicted infinite loop.
- **Defaults and exceptions** ("this rule applies unless a more specific one
  does") require negation-as-failure and careful stratification; naive encodings
  produce non-stratifiable programs the engine rejects. Priority/specificity
  orderings must be encoded explicitly as facts and compared, not inherited.
  ASP handles this natively — at the cost of multiple answer sets.
- **No uncertainty** in the core language. Probabilities need a semiring
  (Scallop's `minmaxprob`, Viterbi) or an external layer. There is no
  "confidence 0.7" in Soufflé/Nemo/Mangle.
- **No ordering, no windows, no "the most recent three"** without aggregation
  gymnastics.
- **No existentials** (§2.4) — the engine cannot invent the entity your rule
  says must exist.

### 5.5 Rule debugging opacity

When a fixpoint produces a fact you did not expect, or fails to produce one you
did, there is no stack trace. The whole field has recognised this: Soufflé's
provenance/`explain` proof trees exist *specifically* as a debugging feature,
and there is a research line on provenance-guided rollback suggestions (arXiv
2501.09225). Even so:

- **Explaining absence is much harder than explaining presence.** `explain` will
  show you why `path(1,3)` holds. Nothing shows you why `applies(L-31)` doesn't
   — you must bisect the rule chain by hand. For a memory system whose main
  failure mode is silent under-derivation (§5.1), this is the wrong asymmetry.
- Provenance mode has real runtime and memory cost, so it is a debugging mode,
  not an always-on mode — unless you design the semiring in from the start.
- Rule interactions are non-local: adding one innocuous rule can change
  stratification and thus the meaning of unrelated negated predicates.

Budget for a rule test harness (assert fixture facts, assert expected derived
set) from the first rule. Non-negotiable.

### 5.6 The knowledge-acquisition bottleneck

This is the one that killed the field before. Cyc spent four decades hand-coding
common sense on the hypothesis that past some threshold the system could learn
on its own; the threshold never arrived. The 1980s expert-systems diagnosis was
that knowledge acquisition — getting an expert's implicit judgment into
IF-THEN rules without losing it — was the binding constraint, and it never
scaled.

**How LLM-as-extractor changes it:** the LLM removes the *transcription* cost.
It can read a session transcript and emit candidate facts and even candidate
rules at effectively zero marginal cost per item. That is genuinely new and it
dissolves the specific bottleneck (human hours per fact) that stopped Cyc.

**How it does not eliminate it — four residues:**

1. **Validation, not authoring, is now the bottleneck.** An LLM emitting 200
   candidate facts per session shifts the human cost from writing to reviewing,
   and reviewing is *harder* than writing because you must reconstruct intent.
   Unreviewed LLM-authored rules are a mechanism for injecting confident errors
   into a system whose entire selling point is determinism.
2. **Wrong facts are worse in Datalog than in prose.** A wrong prose memory
   misleads when retrieved. A wrong *fact* propagates transitively through every
   rule that touches it, and a wrong *rule* fires on every matching future
   situation. Determinism amplifies errors as faithfully as it amplifies truth.
   Datalog has no "the model probably ignored that one" safety valve.
3. **Ontology drift is still human work.** The LLM can populate a schema; it
   cannot decide that the schema was wrong. §5.2's tax is unaffected.
4. **Brittleness in open worlds is unchanged.** The 1980s failure was that rule
   systems break outside their modelled domain. A memory graph is exactly such a
   system: it will confidently return "nothing applies" for situations nobody
   modelled, and that answer is indistinguishable from "nothing applies because
   nothing should".

The honest reading of history: **the LLM changes the economics of knowledge
acquisition without changing its epistemics.** Design accordingly — treat every
LLM-authored fact and rule as a *proposal* with provenance, keep a
confidence/review status on each, make retraction cheap and total (which Datalog
is unusually good at, since removing a base fact removes exactly its
consequences), and never let an unreviewed rule into a stratum that other rules
depend on.

---

## 6. Design implications, stated plainly

1. **Do not use CozoDB**, however well it fits the brief. Dead since 2024-12,
   classified abandoned, fork also dead.
2. **Do not plan around XTDB's Datalog.** XTDB 2.x is SQL + XTQL. If you want
   XTDB, you want it for bitemporality, and you write SQL.
3. **The alive, embeddable shortlist is: Soufflé (provenance + speed, no
   storage, no bindings), Nemo (modern, KG-shaped, existentials, Python/WASM),
   Ascent/Crepe (Rust macro, no runtime engine, rules fixed at build time),
   DataScript/Datahike (real embedded store with recursive query, but no derived
   IDB layer).** Clingo if you actually need defaults/exceptions and can tolerate
   multiple answer sets. Scallop if you need differentiable confidence.
4. **No alive open engine gives Datalog + IVM.** Assume batch fixpoint
   recomputation; measure before reaching for differential-dataflow or DBSP.
5. **Design the provenance semiring in from the start** (§2.10) rather than
   bolting on explanations later. This is the capability RAG structurally cannot
   match, and Soufflé/Scallop show it is cheap when planned for.
6. **Put all value invention at write time** (§2.4). The LLM mints ids; rules
   only relate existing ids. This is what preserves termination.
7. **Assume entity resolution is the project** (§5.3), and that Datalog's
   failure mode is silence, not noise (§5.1).
8. **The novelty gap, given §3:** LLM-extracts-facts + Datalog-composes is
   published (NeuroLog). Bitemporal contradiction resolution is published (TOKI)
   and shipping (Lians). What is *not* occupied is **rules as first-class,
   agent-authored, retractable memory entries with compositional provenance,
   where the rule base itself is the thing that accumulates.** That is the
   defensible line.

---

## 7. Sources

**Repository / registry state (queried 2026-08-20 / 2026-08-21 via GitHub API
and crates.io API)**

- Soufflé — https://github.com/souffle-lang/souffle (commit 2026-07-13; release 2.5, 2025-03-24; UPL-1.0)
- CozoDB — https://github.com/cozodb/cozo (commit 2024-12-04; release v0.7.6, 2023-12-11; MPL-2.0)
- CozoDB "Abandoned" classification — https://dbdb.io/db/cozodb
- cozo-community fork — https://github.com/cozo-community/cozo (commit 2024-12-04, no releases)
- XTDB — https://github.com/xtdb/xtdb (commit 2026-08-20; v2.1.0, 2025-12-01)
- XTDB is SQL + XTQL — https://docs.xtdb.com/intro/what-is-xtdb.html
- DataScript — https://github.com/tonsky/datascript (v1.8.1, 2026-08-15)
- Datahike — https://github.com/replikativ/datahike (commit 2026-08-20)
- Datomic query/rules/negation reference — https://docs.datomic.com/query/query-data-reference.html
- Datomic free-of-licensing-fees — https://blog.datomic.com/2023/04/datomic-is-free.html and https://building.nubank.com/datomic-is-available-free-of-licensing-fees/
- Datomic source-not-open — https://dbdb.io/db/datomic
- Google Mangle — https://github.com/google/mangle (commit 2026-08-05, Apache-2.0)
- DDlog (archived) — https://github.com/vmware-archive/differential-datalog
- differential-dataflow — https://github.com/TimelyDataflow/differential-dataflow (0.25.1, 2026-07-15)
- Feldera / `dbsp` crate 0.336.0 (2026-08-20) — https://github.com/feldera/feldera
- Hydro — https://github.com/hydro-project/hydro (2026-08-21)
- egglog 3.0.0 (2026-08-19) — https://github.com/egraphs-good/egglog
- egg — https://github.com/egraphs-good/egg (2026-07-19)
- Clingo v5.8.2 (2026-08-14) — https://github.com/potassco/clingo
- Scallop — https://github.com/scallop-lang/scallop (commit 2026-06-26)
- Ascent — https://github.com/s-arash/ascent (repo 2026-06-18; crate 0.8.0, 2025-03-02)
- Crepe v0.2.0 (2025-12-14) — https://github.com/ekzhang/crepe
- Nemo — https://github.com/knowsys/nemo (commit 2026-08-20; stratified negation, aggregates, existential rules/TGDs)
- Percival (dormant, 2023-02-16) — https://github.com/ekzhang/percival
- Logica — https://github.com/EvgSkv/logica (2026-08-20)
- Datafrog 2.0.1 (2019) — https://crates.io/crates/datafrog
- declarative-dataflow / 3DF (dead, 2020) — https://github.com/comnik/declarative-dataflow
- RelationalAI GA as Snowflake Native App — https://www.relational.ai/post/relationalai-knowledge-graph-coprocessor-is-generally-available-as-a-snowflake-native-app

**Semantics, evaluation, provenance**

- Soufflé provenance / proof trees / `explain` — https://souffle-lang.github.io/provenance
- Soufflé rules and stratification — https://souffle-lang.github.io/rules
- Green, Karvounarakis, Tannen, "Provenance Semirings", PODS 2007 — https://dl.acm.org/doi/10.1145/1265530.1265535
- Karvounarakis & Green, "Semiring-Annotated Data: Queries and Provenance", SIGMOD Record — https://dl.acm.org/doi/10.1145/2380776.2380778
- Bourgaux et al., "Revisiting Semiring Provenance for Datalog", KR 2022 — https://proceedings.kr.org/2022/10/kr2022-0010-bourgaux-et-al.pdf
- Budiu, Chajed, McSherry, Ryzhyk, Tannen, "DBSP: Automatic Incremental View Maintenance for Rich Query Languages", VLDB 2023 (best paper) — https://docs.feldera.com/vldb23.pdf
- DBSP SIGMOD Record version — https://dl.acm.org/doi/10.1145/3665252.3665271
- Zhao et al., "Towards Elastic Incrementalization for Datalog", PPDP 2021 (incl. the DDlog-5×-slower measurement) — https://souffle-lang.github.io/pdf/ppdp21incremental.pdf
- Soufflé incrementalisation tracking issue — https://github.com/souffle-lang/souffle/issues/2162
- Zhao, "Provenance, Incremental Evaluation, and Debugging in Datalog" (thesis) — https://ses.library.usyd.edu.au/bitstream/handle/2123/29493/Zhao_David_thesis.pdf
- "Provenance Guided Rollback Suggestions" — https://arxiv.org/pdf/2501.09225
- Magic sets with existential quantifiers — https://www.researchgate.net/publication/261861943_Magic-Sets_for_Datalog_with_Existential_Quantifiers
- Datalog± family overview (Calì, Gottlob, Lukasiewicz) — https://www.researchgate.net/publication/221443235_Datalog_-_A_Family_of_Logical_Knowledge_Representation_and_Query_Languages_for_New_Applications_Keynote_Lecture
- Chase termination / decidability — https://arxiv.org/pdf/2005.05423 and https://arxiv.org/pdf/1810.02132 and https://hal.science/hal-05240721v1/document

**LLM ∩ logic prior art**

- Scallop (PLDI 2023) — https://arxiv.org/abs/2304.04812 and https://www.cis.upenn.edu/~mhnaik/papers/pldi23.pdf
- Dolphin (scalable neurosymbolic) — https://arxiv.org/pdf/2410.03348
- NeuroLog — LLM facts + Soufflé + Z3 — https://arxiv.org/abs/2606.00669
- Neurosymbolic Repo-level Code Localization — https://arxiv.org/pdf/2604.16021
- TOKI — bitemporal operator algebra for LLM-agent persistent memory — https://arxiv.org/abs/2606.06240
- ASP-Bench (NSE@ICSE 2026) — https://arxiv.org/html/2602.01171
- "LLMs as ASP Programmers: Self-Correction…" — https://arxiv.org/abs/2604.27960
- "Intermediate Languages Matter: Formal Choice Drives Neurosymbolic LLM Reasoning" — https://arxiv.org/pdf/2502.17216
- "Sound and Complete Neurosymbolic Reasoning with LLM-Grounded Interpretations" — https://arxiv.org/abs/2507.09751
- "Improving Rule-based Reasoning in LLMs using Neurosymbolic Representations" (EMNLP 2025) — https://aclanthology.org/2025.emnlp-main.1556/

**Agent memory, entity resolution, KG reasoning**

- Lians agent memory (bitemporal, deterministic supersession) — https://glama.ai/mcp/servers/Lians-ai/Lians
- Multiply: Datomic → XTDB → Rama — https://blog.redplanetlabs.com/2025/03/04/how-multiply-went-from-datomic-to-xtdb-to-rama/
- AriGraph — https://arxiv.org/pdf/2407.04363
- A-MEM — https://arxiv.org/pdf/2502.12110
- "Are We Ready For An Agent-Native Memory System?" — https://arxiv.org/pdf/2606.24775
- "Beyond Static Retrieval: Opportunities and Pitfalls of Iterative Retrieval in GraphRAG" — https://arxiv.org/pdf/2509.25530
- Entity resolution / canonicalization failure modes in agent KGs — https://www.decodingai.com/p/keep-knowledge-graph-clean
- "The Rise of Semantic Entity Resolution" — https://towardsdatascience.com/the-rise-of-semantic-entity-resolution/
- RulE: KG Reasoning with Rule Embedding — https://arxiv.org/abs/2210.14905
- Rule learning for KG completion (AMIE / AnyBURL survey) — https://www.emergentmind.com/topics/rule-learning-for-knowledge-graph-completion

**Symbolic-AI history**

- Lenat & Guha, "CYC: Using Common Sense Knowledge to Overcome Brittleness and Knowledge Acquisition Bottlenecks", AI Magazine 1985 — http://faculty.otterbein.edu/dstucki/inst4200/CYC1985.pdf
- Lenat & Guha, "Building large knowledge-based systems", Artificial Intelligence — https://www.sciencedirect.com/science/article/pii/000437029390093Q
- Retrospective on Cyc's failure — https://yuxi-liu-wired.github.io/essays/posts/cyc/
