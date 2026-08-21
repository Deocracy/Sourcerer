# The Graveyard: Ambitious Agent-Memory Schemes and What Killed Them

**Research thread J** — spike 003, learning-construction research
**Date:** 2026-08-21
**Frame:** The reader is designing a Datalog-family memory of curated "learnings" for coding
agents. This document catalogs richer schemes than "extract distilled notes and retrieve
them" that were *proposed and lost*, with the measured reason each lost, so the design can
avoid the traps and selectively revive the ones that failed only circumstantially.

---

## Executive summary

The single most important finding in this literature is not about any one exotic
architecture. It is a controlled ablation published in Dec 2025 ("Fidelity Before
Structure", arXiv:2601.00821) showing that **swapping verbatim conversation chunks for
LLM-extracted structured artifacts — holding model, retriever, reranker, and judge constant
— costs 15.9 points on LoCoMo and 22.0 points on LongMemEval-S**. The mechanism is *lossy
distillation*, not structure per se. Accuracy tracks how much source text survives in the
store. Adding artifacts *alongside* chunks preserves accuracy; *substituting* them forfeits
the gap.

That result is aimed squarely at the class of design the reader is building. It does not
say "don't build a curated learnings store." It says: **the curated learning must be an
index into or an augmentation of recoverable source evidence, not a replacement for it.**
A Datalog fact that carries a pointer back to the diff/file/error it was derived from is on
the right side of this finding; one that is a free-floating natural-language assertion with
the source discarded is on the wrong side.

The second-most important finding is that **curated stores degrade with growth in two
measurable, separable ways** — "skill shadowing" (distractors displace the correct entry
during selection) and "context overhead" (the enlarged in-context library degrades execution
even when selection is correct). Both have been decomposed and bounded (arXiv:2605.24050),
and a sibling paper ("Library Drift", arXiv:2605.19576) shows a self-evolving skill library
can fall *below its own no-skill baseline* silently — end-task metrics decline gradually
with no error signal.

Everything else in this graveyard is downstream of three binding constraints:

1. **LLM call cost per maintenance operation** — killed the self-organizing schemes
   (already partially relieved by falling model costs; the most revivable class).
2. **Staleness/consistency under update** — killed the hierarchical trees and the
   parametric-editing schemes (mostly *fundamental*, because it is a data-structure
   problem, not a cost problem).
3. **Context poisoning / distractor injection** — the newest and least-appreciated killer.
   It gets *worse* as models get cheaper and stores get bigger. Falling model costs make
   this constraint bind harder, not softer.

---

## The graveyard table

| # | Scheme | Claimed benefit | Measured / reported cost | Why it lost | Fundamental or circumstantial? |
|---|--------|-----------------|--------------------------|-------------|-------------------------------|
| 1 | **RAPTOR** (recursive abstractive tree) | Multi-scale retrieval; log-time tree search over abstraction levels | LLM summarization call per internal node at build; insertion/deletion invalidates cluster summaries along the whole root-to-leaf path | Build cost is one-time and tolerable; **update is the killer**. Cheap "search-and-insert" attaches a leaf but leaves ancestor summaries unchanged → silent staleness. Never solved for mutable corpora. | **Fundamental for mutable stores.** Cheap models make rebuild cheaper but do not fix the invalidation-cascade data structure. Fine for a frozen corpus; wrong for a living learnings store. |
| 2 | **MemTree** (dynamic tree memory) | Incremental tree that avoids RAPTOR's rebuild | Per-insert LLM routing/merge decisions; global reorganization pressure | Survives better than RAPTOR but sits in the "repeatedly reorganize a large global state" bucket that the 2026 agent-native memory benchmark names as the *least cost-efficient* class (O7: cost-efficiency comes from **localized** maintenance). Strong Recall@5/@10 (59.7/80.5) but weak Recall@1 vs. SimpleMem's 39.0. | **Circumstantial-ish.** The lesson generalizes: bound the blast radius of a write. A Datalog store with localized rule-scoped updates is on the right side of O7. |
| 3 | **A-MEM** (self-revising Zettelkasten links) | Autonomous link generation + memory evolution; 6× on multi-hop; 85–93% token reduction on memory ops | Three LLM decisions per memory (note construction, link evaluation, memory evolution) | Ablations confirm both modules are load-bearing — but the same design gives **three hallucination entry points per write**, and because evolution *rewrites old memories*, an error propagates instead of sitting isolated. | **Circumstantial on cost, fundamental on error propagation.** Cheap models revive the cost side. The write-amplification/propagation risk is a design flaw fixable only by making edits append-only + supersession rather than in-place mutation. |
| 4 | **MemoryBank** (Ebbinghaus forgetting curves) | Biologically-principled decay; frequently-accessed memories reinforced, neglected ones fade | Reported: forgetting-curve-based management **leads to a substantial drop in task performance** | Time-decay + recall-frequency is a "simplified one-dimensional" value estimate. Recency is a terrible proxy for the value of an engineering learning — a rule learned once and correct forever gets decayed out. | **Fundamental as specified.** Decay-by-disuse is wrong for correctness facts. Supersession-by-contradiction is the correct primitive; decay is not. |
| 5 | **Generative Agents scoring** (recency × importance × relevance) | Human-like retrieval blending three signals | An LLM "poignancy" 1–10 rating **per observation** at write time; fixed hand-set weights | The importance term is ad-hoc, the weights never learned, and the score governs *only retrieval* — not encoding depth, not forgetting. Later work explicitly positions itself against its "high labor costs". | **Circumstantial.** The per-item LLM rating is now cheap. But the fixed-weight linear blend was never validated; if revived, learn the weights or drop the term. |
| 6 | **Full episodic replay / trajectory memory** | Nothing is lost; the complete trace is always available | Stuffing full history ≈ **an order of magnitude more per turn** than a curated subset at 128K + frontier pricing. OCR-Memory's explicit trade: 18 KB → 1.47 MB per episode, retrieval 0.3 s → 1.7 s | Systems "oscillate between hoarding (drown in noise) and amnesia (lose rare vital facts)". Retrieval precision *degrades as the index grows* — more near-duplicates for the top-k slot, more chances a stale fact outscores a current one. | **Fundamental at full fidelity.** But note the tension with #12: raw trajectories lose to abstraction for *cross-domain transfer*, and win over lossy artifacts for *factual recall*. The resolution is store-both-tiers, not pick-one. |
| 7 | **Classic CBR** (retrieve–reuse–revise–retain) | 30-year-old, complete, principled learning cycle | Case-base maintenance, the "swamping"/utility problem: more cases → slower and *worse* retrieval | Classic CBR died on two bottlenecks LLMs actually fix: (a) **case representation** required hand-engineered feature vectors and similarity metrics per domain; (b) **adaptation/revise** was the hardest step and never generalized beyond substitution. LLMs supply both. | **Circumstantial — this is the most revivable entry in the graveyard.** The 2025 review (arXiv:2504.06943) is an explicit revival argument. Retrieve+reuse+retain are alive in every agent-memory paper; **revise is still the missing step** and is exactly where a Datalog store with supersession rules has an edge. |
| 8 | **Memorizing Transformers / RETRO** (retrieval in the architecture) | Decouple memorization from reasoning; kNN attention over a frozen datastore | Requires extensive architecture modification + pretraining of new encoding/cross-attention blocks; retriever retraining forces recomputing every passage embedding | Lost to the *ergonomics* of post-hoc RAG, not to a benchmark. You cannot ship an architecture change to a model you do not train. Industry standardized on RAG-as-a-layer (FAISS/Elasticsearch on top of a stock model). | **Fundamental for anyone not training the base model.** Permanently out of scope for an application-layer memory design. |
| 9 | **Titans / test-time-training memory** | Neural long-term memory module that learns to memorize at inference, surprise-gated writes | NeurIPS 2025 poster; no production deployment identified as of Aug 2026 | Remains a research artifact. Community stance is explicitly "wait and see" pending real-world validation. No commercial integration. | **Circumstantial but not actionable.** Same blocker as #8: it lives inside the model. Irrelevant to an application-layer store regardless of cost trends. |
| 10 | **Knowledge editing** (ROME / MEMIT / knowledge neurons) | Surgically write a fact into weights; no retrieval at inference | ROME: gradual forgetting → **abrupt catastrophic collapse**. MEMIT: **model collapse after ~250 sequential edits**; stable only if all 10K edits are applied in one batch — which defeats the purpose | WikiBigEdit's verdict is decisive: **"on realistic edits and at scale, efficiently implemented retrieval-augmentation outperforms any editing method"** — including on *generality*, which was editing's supposed advantage over retrieval. | **Fundamental.** Sequential arrival is the whole use case for agent learning, and sequential arrival is precisely the regime where editing collapses. This is a settled negative result. |
| 11 | **LoRA-per-project as memory** | Project knowledge in weights; no context cost at inference | A single continuously-updated adapter shows strong catastrophic forgetting; full FT still beats LoRA on final average accuracy (64.5% vs 59.5%) even after forgetting | Requires a train step per learning (latency in hours, not ms), cannot express "this fact superseded that one", and cannot be *inspected or edited by a human* — fatal for curated engineering learnings. Adapter-per-project also multiplies serving complexity. | **Fundamental for a curated store.** The killer is not cost, it is **non-inspectability and non-revisability**. A learning you cannot read, diff, or retract is not a curated learning. |
| 12 | **Sleep-time / offline consolidation fine-tuning** | Move expensive curation off the user-facing critical path | Letta's sleep-time compute: Pareto improvement on AIME/GSM, no quality sacrifice | **This one largely won** — as *context* consolidation, not as weight consolidation. The surviving form deduplicates, generalizes, and reorganizes the *store*; model weights never change. | **Survived, in reduced form.** Steal this: the schedule (offline/idle) is the good idea; the mechanism (fine-tuning) is not needed. |
| 13 | **MemGPT / LLM-as-OS paging** | Virtual memory for context; self-directed paging via function calls | Every memory action costs a reasoning turn + tool call — "token overhead and latency for simply remembering facts is significantly higher than passive memory systems"; fails outright when the model mis-calls or loops | **Compaction survived and is now universal.** What did *not* survive: (a) self-directed paging as the primary write path, (b) the full promotion/demotion tier machinery, (c) the OS metaphor's assumption that the agent is a reliable memory manager. | **Split verdict.** Compaction: won. Agent-managed paging: **circumstantial** (better tool-calling models help) but the *token overhead per remember* is structural. Passive/deterministic writes beat agentic writes on cost. |
| 14 | **Tiered memory w/ promotion & demotion** (MEMTIER and kin) | Hot/warm/cold tiers with policy-driven movement, like a cache hierarchy | Tier multipliers end up as a hand-tuned additive bonus (μ ∈ {1.0, 1.2, 1.4}) bolted onto the relevance score | The tier signal is a *prior*, not a mechanism — it degenerates into "boost the semantic tier a bit". The retrieval bottleneck is not tier placement; it is evidence completeness. | **Fundamental as motivated.** Cache hierarchies work because access cost differs by orders of magnitude per tier. In an agent store, all tiers cost the same to read. The metaphor imports machinery without importing the economics that justified it. |
| 15 | **Full CoALA multi-store** (episodic + semantic + procedural simultaneously) | Complete cognitive coverage per Tulving's trichotomy | No ablation exists showing the extra stores earn their complexity | CoALA is **a conceptual framework, not an empirical system** — the original paper (TMLR 2024) offers a taxonomy and expresses existing agents as ablations of it; it does not demonstrate that running all stores beats running one. Later critique: it does not even distinguish the *persistence semantics* of semantic vs. episodic memory — no formal difference in update mechanism, ownership scope, or decay behavior. | **Circumstantial but unproven.** Nobody has shipped a full three-store implementation with an ablation justifying it. Treat CoALA as vocabulary, never as an architecture mandate. Build one store; add a second only when you can name the query it serves that the first cannot. |
| 16 | **Soar/ACT-R-inspired LLM hybrids** | Decades of cognitive-architecture rigor; production rules + chunking | — | The symbolic cores assume cheap, reliable, exhaustive rule matching over a small working memory. LLM agents have expensive, unreliable, fuzzy matching over a huge one. The economics invert. No shipped system found. | **Fundamental as direct ports.** The *idea* of a declarative rule store with explicit conditions is sound and is the Datalog design; the *runtime* (decision cycles, conflict resolution, subgoaling) does not transfer. |
| 17 | **Heavily structured / JSON-encoded context** | Machine-parseable, schema-clean, unambiguous | Format-restriction studies: ~**10–15% reasoning degradation** under strict JSON; stricter constraints → larger drops; task-level variance exceeding 300% attributable to format alone | JSON context primes **schema-extraction mode**, which "actively suppresses the flexible inference needed for synthesis, ambiguity resolution, or code generation". On code generation specifically, GPT-4 is optimal with plain-text context and degrades on JSON encoding of the *same information*. | **Fundamental (for the consuming call).** This is the most directly actionable finding for a Datalog design: **query in structure, inject in prose.** Never hand the consuming model your tuples. |
| 18 | **Big skill/learning libraries** (Voyager-lineage) | More accumulated skills = more capable agent | Skill shadowing + context overhead decompose the pass-rate drop exactly (Δ_ctx + Δ_shd = Δ). Within oracle-only trajectories, pass rate falls **monotonically** with library size (pooled .52 → .45 at \|S\|=202) — degradation *even when selection is correct*. Sharp decline reported beyond ~64–128 skills in single-agent libraries | "More Skills, Worse Agents?" is the title and the answer. Library drift is **silent** — no error signal, metrics just sag. One ablation with aggressive retirement fell *below the no-skill baseline*, i.e. the governance mechanism itself caused harm. | **Fundamental scaling law, mitigable by discipline.** This is the ceiling every curated-learnings store hits. Mitigations that worked: an evidence floor before retirement, a router that assigns a skill to only ~73% of tasks, and a cap. Mitigation that *did not* work: explicit dedup (A5/A6 relaxed dedup slightly **beat** the default). |
| 19 | **Memory decay/forgetting as garbage collection** | Bounded store; noise sheds itself | Distractor removal improves performance for *all* systems tested; conflicting facts with equal weight → agent picks whichever the retriever scored higher this turn | Deletion is the wrong primitive. The consolidation literature's verdict: the newer fact should **supersede** the older one **through merge, not deletion** — "Deletion is not required." | **Fundamental correction, cheap to adopt.** Supersession > decay > deletion. Directly supports a Datalog design with explicit supersession rules. |
| 20 | **Unguarded persistent memory** (any scheme, security lens) | — | Memory poisoning: avg attack success 50.46%, retrieval success 41.05%; **cross-session persistence RSR averaging 64.70%** on one agent (up to 92.76% for conditional command insertion). A single adversarial write exerts long-term influence | Not a scheme that lost — a **tax on every scheme that wins**. "Aggressive memory write and retrieval policies improve performance but also expand the memory-poisoning attack surface." The main failure mode is *contextual assimilation*: poisoned entries work best when they look like legitimate task context. | **Fundamental and worsening.** Every autonomy increase in the write path is an attack-surface increase. Argues directly for gated/reviewed writes in a curated store. |

---

## Section-by-section detail

### 1. Hierarchical summarization trees

**The proposal.** RAPTOR (ICLR 2024) recursively embeds, clusters, and summarizes chunks
into a tree, then retrieves across abstraction levels — either by collapsing the tree or by
traversing it. MemTree extends this to a dynamic, directed tree where each node carries
content, embedding, topological pointers, and a depth scalar, so inserts route down the
tree instead of forcing a rebuild.

**Claimed benefit.** Retrieval at the right level of abstraction for the query; log-time
search instead of linear scan; thematic/global questions answerable without stuffing the
corpus.

**Measured cost.** One LLM summarization call per internal node at build time. The
literature is candid that this is "computationally expensive for very large datasets," and
proponents counter that query-time then stays cheap — one comparison claims flat dense
retrieval incurs ~100× higher runtime than logarithmic tree retrieval at scale.

**Why it lost (for mutable stores).** Not on build cost, and not on retrieval quality —
on **update**. The stated problem: "each insertion or deletion can in principle invalidate
cluster summaries along the affected root-to-leaf path." The pragmatic fix in the wild is a
search-and-insert that attaches the new document as a leaf under the best-matching cluster
**and leaves that cluster's summary unchanged.** That is a silent staleness bug by
construction: the summary the retriever matches against no longer describes its subtree.
Over a stream of writes, the abstraction layer drifts away from the leaves it summarizes.

**Does tree search beat flat retrieval in practice?** Mixed, and the axis matters. The
2026 agent-native memory benchmark separates early-hit precision from evidence
completeness: **SimpleMem wins Recall@1 (39.0)**, while MemTree and A-MEM win at larger
budgets (MemTree 59.7/80.5 and A-MEM 69.5/85.9 on Recall@5/@10). Structure buys *recall of
distant, multi-part evidence*; it does not buy top-1 precision. If your consuming call takes
k=3 curated facts, the tree is buying you very little.

**Verdict.** *Fundamental* for a living store. The invalidation cascade is a data-structure
property; cheaper models shorten the rebuild but do not make partial updates correct.

**Steal:** the multi-scale idea, implemented as *derived* views that can be recomputed from
a source of truth, so staleness is a cache-invalidation problem you can solve by
recomputation rather than a corruption problem you cannot detect. A Datalog store is
unusually well-suited to this — derived predicates *are* recomputable views.

### 2. Self-organizing / evolving memory graphs

**A-MEM** (arXiv:2502.12110, NeurIPS 2025) is the most ambitious: each new memory gets an
LLM-generated note (context, keywords, tags), the system finds relevant historical memories
and establishes links, and — critically — **integration can trigger updates to the
attributes of existing memories**. Reported: up to 6× improvement on complex multi-hop
reasoning and 85–93% reduction in memory-operation token usage vs. baselines. Ablations
confirm both link generation and memory evolution are load-bearing.

**The critique that matters** is not cost — it is error propagation. The published critique
states it precisely: the LLM makes organization decisions at note construction, at link
evaluation, and at memory evolution — **three opportunities per memory for a hallucination
to enter** — and because evolution means new information *modifies old memories*, a mistake
does not sit in isolation; it propagates.

**MemoryBank** models decay via Ebbinghaus forgetting curves. The measured outcome is
blunt: forgetting-curve-based memory management **leads to a substantial drop in task
performance**. The diagnosis: its value estimate is a "simplified one-dimensional method"
resting on time decay and recall frequency.

**Generative Agents'** recency × importance × relevance is the ancestor of all of this.
The mechanism: exponential recency decay, an LLM-assigned 1–10 "poignancy" importance
rating, and embedding cosine relevance. Named limitations: the importance term is produced
ad hoc, the weights are fixed and hand-set, and the score governs **only retrieval — not
encoding depth, not forgetting.** Follow-on work positions itself explicitly against its
"high labor costs."

**What happens at scale.** The consolidation literature names the three forces precisely:
*context economics* (full history ≈ 10× the per-turn cost of a curated subset, but attention
dilution is the bigger problem — "retrieved context that contains five contradictory facts
about the same entity does not produce a coherent answer, even from a strong model");
*entity drift* (the customer on Postgres in January migrated to MySQL in March; if both sit
in memory with equal weight, the agent picks whichever scored higher this turn); and *index
precision* (more documents → more near-duplicates competing for top-k → more chances a
stale fact outscores a current one).

**Verdict.** LLM-link-maintenance cost is *circumstantial* and already substantially
relieved. Drift and error propagation are *fundamental to in-place mutation* — and are
fixable by changing the primitive from mutation to append-plus-supersession.

**Steal:** A-MEM's link generation (cheap now). **Do not steal** its in-place evolution of
existing memories. And note the consolidation literature's explicit conclusion:
supersession "through merge, not deletion — **Deletion is not required.**"

### 3. Full episodic replay / trajectory memory

**The proposal.** Store complete interaction traces; retrieve and replay them. Modern
instances range from screen-activity compilation to optical context retrieval.

**Measured cost.** Full-history stuffing is roughly an **order of magnitude more expensive
per turn** than a curated subset at 128K windows and frontier pricing. OCR-Memory documents
the explicit trade of shifting cost from reasoning tokens to storage/preprocessing:
**18 KB → 1.47 MB per episode, retrieval 0.3 s → 1.7 s.**

**Why it stalls.** The hoarding/amnesia oscillation. Retrieval precision degrades as the
index grows, and full traces are the fastest way to grow it. Inference cost scales
quadratically with context length, and "modest context augmented with targeted retrieval
outperforms brute-force long context on many tasks."

**Case-based reasoning — the 30-year-old version.** The 2025 review (arXiv:2504.06943)
argues CBR is *newly viable*, and the argument is credible because LLMs dissolve exactly
the two bottlenecks that killed classic CBR:

- **Case representation** required hand-engineered feature vectors and a
  domain-specific similarity metric per application. LLMs + embeddings supply this for free.
- **Revise (adaptation)** was always the hardest R and never generalized past
  substitution-based transformation. LLMs are good at exactly this.

What killed classic CBR *additionally* was case-base maintenance — the swamping/utility
problem, where adding cases makes retrieval both slower and worse. **That problem did not
go away.** It is the same phenomenon now published as skill shadowing and library drift
(§7 below). So: retrieve, reuse, and retain transferred cleanly into 2026 agent papers;
**revise is the step still missing in practice**, and maintenance is still the unsolved
part.

**Verdict.** Full-fidelity replay: *fundamental* loss on cost and precision. CBR-as-cycle:
*circumstantial* — the most revivable entry here, with the explicit caveat that its historic
killer (case-base maintenance) remains unsolved and now has new names.

### 4. Neural / parametric memory

**Memorizing Transformers / RETRO.** The blocker is stated cleanly in the literature: a
drawback of intermediate fusion (RETRO's approach) is "the need for extensive architecture
modification and pre-training of LMs for the new encoding blocks, potentially limiting
widespread adoption," compounded by retriever training expense — improving the document
encoder forces recomputing every passage embedding in the datastore. Industry instead
standardized on post-hoc RAG (63.6% of surveyed implementations on GPT-family models, 80.5%
on standard frameworks like FAISS/Elasticsearch). Retrieval-in-architecture lost to
retrieval-as-a-layer on *deployability*, not on quality.

**Titans / test-time training.** Published Dec 2024 (arXiv:2501.00663), NeurIPS 2025
poster. As of Aug 2026: **no production deployment identified.** The consensus posture is
"wait and see" pending peer review and real-world validation. Whatever its merits, it is
inside the model and therefore outside an application-layer memory design.

**Knowledge editing (ROME / MEMIT / knowledge neurons).** This is the clearest settled
negative result in the graveyard:

- ROME under sequential editing: gradual progressive forgetting, then an **abrupt
  catastrophic phase** as edited-weight drift accumulates.
- MEMIT: **model collapse after ~250 sequential edits.** It avoids collapse only when all
  10K edits are applied *in one batch*; at batch sizes of 1, 1K, or 5K it performs well on
  the first batch and collapses on subsequent ones. As the analysis notes, batching "is
  impractical for real-world scenarios where edits arrive sequentially over time."
- WikiBigEdit's headline: **"on realistic edits and at scale, efficiently implemented
  retrieval-augmentation outperforms any editing method"** — and outperforms it *including
  on generality*, which was the one axis where editing was supposed to beat retrieval.

Sequential arrival is the entire use case for agent learning. Editing collapses under
sequential arrival. That is a complete answer to "why is editing still not used for agent
learning in production."

**LoRA-per-project.** A single continuously-updated adapter across a task stream "typically
exhibits strong catastrophic forgetting, as the same adapter weights are overwritten by
later tasks." Full fine-tuning still beats LoRA on final average accuracy (64.5% vs 59.5%)
even accounting for forgetting. But the decisive objection for a *curated* store is not
accuracy — it is that a learning encoded in adapter weights **cannot be read, diffed,
reviewed, or retracted by a human.** That disqualifies it as a substrate for curated
engineering knowledge regardless of how cheap training gets.

**Sleep-time consolidation.** The one entry in this section that *worked* — in reduced
form. Letta's sleep-time compute demonstrates a Pareto improvement, shifting load from
high-latency user interactions to idle periods without sacrificing quality. But the shipped
form consolidates **the store**, not the weights: it "deduplicates, generalizes, and
forgets, so the memory improves with use... even though the model weights did not change."
The survey's framing of the open problem — dual-buffer consolidation with a probation
period, promotion only after re-verification, dedup, and importance scoring — is a design
sketch worth taking seriously.

**Verdict.** Everything in this section that requires touching weights is *fundamental*
for an application-layer curated store. The offline *schedule* is the only transferable part.

### 5. Working-memory / OS schemes beyond MemGPT

**What survived contact with production: compaction.** Universally. Every long-running
agent runtime now compresses older message blocks into summaries and evicts raw tokens.

**What did not survive:**

- **Self-directed paging as the primary write path.** MemGPT's design routes every memory
  action through LLM reasoning plus a tool call. The consequence is documented: "the token
  overhead and latency for simply remembering facts is significantly higher than passive
  memory systems," and when the model fails to call the right function or loops, memory
  operations simply fail. Passive/deterministic writes dominate agentic writes on cost and
  reliability.
- **Promotion/demotion tier machinery.** MEMTIER's tier signal degenerates into a
  hand-tuned additive bonus (μ ∈ {1.0, 1.2, 1.4}) applied outside the relevance dot product.
  It is a prior on tiers, not a mechanism.
- **The economic premise of the OS metaphor itself.** Cache hierarchies earn their
  complexity because tiers differ in access cost by orders of magnitude. In an agent memory
  store, every tier costs the same to read — the only real cost is *context tokens spent*,
  which is a function of what you inject, not where it lives. The metaphor imports the
  machinery without the economics that justified it.

**The finding that replaces the metaphor.** The 2026 agent-native benchmark's O7:
**"the most cost-efficient memory mechanisms are those that localize maintenance to a
bounded subset of memory state, whereas mechanisms that repeatedly reorganize a large global
state are the least efficient."** That is the real design rule the OS metaphor was groping
toward, stated correctly.

**A caveat on compaction itself:** recursive summarization "can introduce latency
variability and loss of information fidelity, particularly when precise textual recall is
required" — which is the same lossy-distillation mechanism as §7's headline result.

### 6. Multi-store cognitive architectures

**Has anyone shipped a full CoALA implementation?** No evidence of one with a supporting
ablation. CoALA (TMLR 02/2024) is explicitly a **conceptual framework**: it decomposes agent
cognition into working / episodic / semantic / procedural memory following Tulving, and
demonstrates that it "can express a wide spectrum of language agents through variations and
ablations of the memory modules." It is a taxonomy that *retrofits* existing agents. It
does not present an empirical study showing that running all stores beats running fewer.

**Do the extra stores earn their complexity?** Unproven. No ablation was found
demonstrating it. Worse, the framework has a structural gap: it **does not distinguish the
persistence semantics of semantic from episodic memory** — both are simply "long-term
memory," with no formal difference in update mechanism, ownership scope, or decay behavior.
If the framework cannot say how two stores differ operationally, it cannot justify paying
for both.

**Soar / ACT-R hybrids.** No shipped LLM hybrid found. The reason is economic inversion:
symbolic cognitive architectures assume cheap, reliable, exhaustive rule matching over a
small working memory. LLM agents have expensive, unreliable, fuzzy matching over a huge one.
The declarative-rule-store *idea* transfers (and is essentially the Datalog design); the
decision-cycle runtime does not.

**Cost per step of running all stores.** The measurable proxy is the agent-native
benchmark's latency-per-query frontier, whose conclusion is O7 above: global reorganization
is the expensive thing. Multi-store designs multiply the number of things that need
reorganizing.

**Practical rule:** use CoALA as vocabulary. Add a second store only when you can name a
specific query it serves that the first store cannot answer.

### 7. Context-quality failure: schemes that hurt the consuming LLM despite good retrieval

This is the section with the most directly actionable findings for the reader's design.

#### 7a. The headline: lossy distillation beats structure, and loses

**"Fidelity Before Structure: Verbatim Chunks Beat Lossy Artifact Extraction in
Long-Conversation LLM Memory"** (arXiv:2601.00821) is a controlled ablation inside one fixed
retrieval–rerank–reasoning pipeline. Only the stored representation changes: LLM-extracted
typed artifacts vs. verbatim conversation chunks. Model, retriever, reranker, and judge are
held constant.

- **LoCoMo: 43.9% (chunks) vs. 28.0% (artifacts) — 15.9 points.**
- **LongMemEval-S: 67.4% vs. 45.4% — 22.0 points.**
- A 1-hop semantic graph **does not recover the gap.**
- **Six confound controls reproduce the effect.**
- The extracted-artifact pipeline **does not beat naive RAG** on overall accuracy.

The stated mechanism: **"lossy distillation, not structure per se: accuracy tracks how much
source text survives in the store."**

The cost analysis makes the trade explicit and is worth quoting for a designer tempted by
token savings: artifacts pack a fact into 30–60 tokens vs ~130 per chunk, and answers from
pre-structured artifacts are direct — completion tokens **5.1× smaller** (16.7 vs 85.9).
Generation cost drops 28% ($2.78 vs $3.84). But **"the $0.92 saved over chunks across 699
questions buys a 15.9-point accuracy drop: the chunks pipeline is simultaneously the most
expensive per query and the cheapest per correct answer."**

The paper's own prescription: **"structured memory should augment verbatim text rather than
replace it: adding artifacts alongside chunks preserves accuracy; substituting them forfeits
the gap."**

*(One honest limitation the authors flag: chunks abstain worse — the artifact pipeline is
better at knowing when it doesn't know.)*

#### 7b. Over-structured context degrades generation

The format-restriction literature is consistent:

- Format restrictions **significantly degrade reasoning**, with stricter constraints
  producing larger drops; strict JSON output on reasoning tasks costs roughly **10–15%**.
- Benchmarks across GPT-3.5/GPT-4 show **variance exceeding 300% on specific tasks
  attributable to format choice alone.**
- Mechanism: JSON-encoded context "primes models toward schema-following behavior... which
  is useful for structured data retrieval but **actively suppresses the flexible inference
  needed for tasks requiring synthesis, ambiguity resolution, or code generation.**"
- **On code generation specifically, GPT-4 performs optimally with plain-text context and
  degrades significantly with JSON encoding of the same information.**
- On table comprehension, Markdown key-value pairs beat CSV by ~20 points.

**Design consequence for a Datalog store: query in structure, inject in prose.** The
tuples are the *index*; what reaches the consuming model should be rendered natural
language. Handing a coding agent a serialized fact table is the documented worst case for
its primary task.

#### 7c. Fragmentation, distractors, and memory spam

- **Distractor removal improves performance for all memory systems tested**, with varying
  gains — distractors "introduce measurable difficulty," and conflict-aware use "depends on
  more than topical relevance."
- **Context rot** decomposes into three compounding mechanisms: lost-in-the-middle (30%+
  accuracy drops; a U-shape where mid-context evidence scores 20–30 points lower), attention
  dilution, and **distractor interference — semantically similar but irrelevant content
  actively misleading the model.** Critically: "when distractors are semantically similar to
  the answer, accuracy drops sharply, **and the drop grows worse with length.**"
  Near-duplicate learnings are the worst possible distractors.
- **MemConflict** finds no system dominates: "systems that perform well in one setting often
  degrade in others," and performance degrades specifically "when relevant memories are
  buried in longer histories, **mixed with semantically similar distractors**, expressed
  through implicit queries, or separated by larger conflict distances." Many failures trace
  to missing gold memory at retrieval time.
- **Memory poisoning** quantifies the adversarial version: avg attack success 50.46%,
  retrieval success 41.05%, **cross-session persistence RSR averaging 64.70%** on one agent
  (92.76% for conditional command insertion, 86.33% for explicit). The framing that matters
  for design: **"Aggressive memory write and retrieval policies improve performance but also
  expand the memory-poisoning attack surface."** Primary failure mode is *contextual
  assimilation* — poisoned memories work best when they resemble useful task context
  (a user preference, a constraint, a workflow requirement). Which is exactly what a
  curated learning looks like.

#### 7d. Library growth: the measured ceiling on any curated store

Two 2026 papers directly measure what happens as a curated library grows. This is the most
important empirical result for the reader after §7a.

**"More Skills, Worse Agents? Skill Shadowing Degrades Performance When Expanding Skill
Libraries"** (arXiv:2605.24050) decomposes the library-induced pass-rate drop exactly into
two mechanisms, with Δ_ctx + Δ_shd = Δ at every point estimate:

- **Skill shadowing** — distractor skills displace oracle skills during *selection*,
  reducing the probability the agent invokes a correct skill even though one is available.
- **Context overhead** — the enlarged context degrades *execution* quality even when
  selection is correct.

The context-overhead signature is the alarming one: within oracle-only trajectories (the
agent invoked *only* correct skills), **binary pass rate falls monotonically with library
size** — pooled .52 → .45 at |S| = 202. Fractional pass rate falls less (.87 → .80), so
**context overhead removes whole-task correctness more than partial progress.** Related
scaling reports: sharp decline beyond roughly **64–128 skills** in a single-agent library;
80K-scale registries require full retrieve-and-rerank rather than metadata-only selection.

**"Library Drift: Diagnosing and Fixing a Silent Failure Mode in Self-Evolving LLM Skill
Libraries"** (arXiv:2605.19576) on MBPP+ hard-100 (3 seeds) shows the failure is silent —
"end-task metrics decline gradually with no explicit error signal." Its ablation table is
full of lessons that invert intuition:

| Condition | Gain | Note |
|---|---|---|
| Default | **+0.328** | baseline 0.258 → peak 0.658; router assigns a skill to 73% of tasks; 50 active / 89 retired |
| A1 no injection | flat floor | library drift: skills synthesized but never injected |
| A4 aggressive retirement | **below the no-skill floor** | governance actively *harmed*; bank emptied to 2 |
| A5/A6 relaxed dedup | slightly **exceeds** Default | **explicit dedup did not help** — refuted the authors' own design assumption |
| A7 cap=100 | +0.317 | comparable mean, **higher variance** |
| A8 meta refresh | +0.372 | best gain but **55% more wall time** |

The authors' own summary of the surprises: A4 "fell below the no-skill baseline — we
expected harsh retirement to underperform, but not to actively harm, confirming that **the
evidence floor is load-bearing even in principle**." And A5/A6 "refut[ed] our design
assumption that explicit dedup would help." Their practitioner guidance:
**"governance mechanisms can be counterproductive — the diagnostic recipe is what makes
failures visible and safe intervention possible."**

Read together: **measure drift before you build governance for it**, and never retire an
entry without evidence that it is actually bad.

#### 7e. The abstraction-level question: is there a published curve?

There is no single clean curve, and the honest answer is that **the literature genuinely
conflicts — and the conflict resolves by task type.**

- **Abstraction wins for cross-domain transfer.** "Memory Transfer Learning: How Memories
  are Transferred Across Domains in Coding Agents" (arXiv:2604.14004) compares four
  representations at increasing abstraction — Trajectory, Workflow, Summary, Insight —
  across 6 coding benchmarks, improving average scores 3.7%. Trajectory and Workflow "remain
  task-specific," while Summary and Insight "exhibit greater generality" (confirmed by rising
  Davies-Bouldin and LISI indices showing weaker benchmark-level cluster separation).
  Its core finding: **"the primary transferable value lies in meta-knowledge."** Reported
  elsewhere in this line: abstracted entries at **+3.9 points vs raw trajectory storage at
  +1.2 points**, with gains largest for long multi-step tasks and growing with memory
  density. Instance-specific artifacts in raw traces "act as noise hindering adaptation to
  new contexts."
- **Raw detail wins for factual recall.** §7a's result is the counterweight: "the main
  performance boundary is **the amount of recoverable evidence the representation
  preserves**, rather than whether it applies stronger abstraction or deeper structure."
- **Intermediate granularity is optimal where measured.** Work across associative memory,
  metastable networks, and simulated immune repertoires found **future risk minimized at an
  intermediate granularity** — a genuine sweet spot rather than a monotone preference — and
  that the optimal level **climbs a rung as the prediction horizon grows.**
- **Multi-granularity beats any single granularity.** MemGAS (arXiv:2505.19549) compares
  session-, turn-, summary-, and keyword-level stores: **"single-granularity settings
  underperform compared to multi-granularity approaches in both QA and retrieval tasks,"**
  and a learned entropy-based router over granularities beats naive concatenation of them.

**Synthesis:** abstraction helps *transfer* and hurts *recall*; the two are different jobs.
The empirically supported design is **two tiers with a pointer between them** — an abstracted,
generalizable learning that the retriever matches on, carrying a link to the verbatim
evidence it was derived from, so a task needing detail can follow the pointer. That is
precisely the shape §7a prescribes ("augment verbatim text rather than replace it") and what
MemGAS's router result supports.

### 8. Cross-cutting: binding constraints and which have moved

| Scheme | Single binding constraint | Has it moved since proposal? | Revived by cheaper/faster models? |
|---|---|---|---|
| RAPTOR | Staleness under update (invalidation cascade) | No — data structure, not cost | **No** |
| MemTree | Global reorganization cost per write | Partially (cheaper calls) | **Partially** — but O7 says localize maintenance regardless |
| A-MEM | LLM call cost per link/evolution op **+** error propagation | Cost: yes, ~10×. Propagation: no | **Partially** — adopt links, reject in-place mutation |
| MemoryBank decay | Wrong value model (recency ≠ correctness) | No | **No** — needs a different primitive |
| Generative Agents scoring | LLM importance rating per item | Yes, largely dissolved | **Yes**, if weights are learned rather than hand-set |
| Full episodic replay | Context economics + index precision | Cost fell; **precision loss did not** | **No** — precision is the binder, not price |
| Classic CBR | Case representation + adaptation + case-base maintenance | First two dissolved by LLMs; **maintenance did not** | **Largely yes** — best revival candidate, maintenance still owed |
| RETRO / Memorizing Transformers | Requires training the base model | No | **No** (out of scope by construction) |
| Titans / TTT | Lives inside the model; unvalidated in production | No | **No** (out of scope by construction) |
| ROME / MEMIT editing | Collapse under *sequential* edits | No — worsens with more edits | **No** — settled negative result |
| LoRA-per-project | Non-inspectable, non-retractable | No | **No** — the blocker isn't cost |
| Sleep-time consolidation | Was latency on critical path | **Yes — solved by moving offline** | **Already won** (as store consolidation) |
| MemGPT agentic paging | Token+latency overhead per remember; tool-call reliability | Reliability improved; overhead structural | **Partially** — compaction won, agentic writes did not |
| Tiered promotion/demotion | Metaphor lacks the cost asymmetry that justifies tiers | No | **No** |
| Full CoALA multi-store | Unproven benefit; no ablation | No | **Unknown — nobody has run the experiment** |
| Soar/ACT-R ports | Inverted matching economics | No | **No** |
| JSON-heavy context | Schema-mode suppression of flexible inference | No — it's a model behavior | **No** — mitigate by rendering prose |
| Large skill/learning libraries | Shadowing + context overhead scaling | No — **grows with library size** | **No — cheaper models make stores bigger, so this binds harder** |
| Unguarded persistent writes | Poisoning attack surface | No — grows with write autonomy | **No — worsens** |

**The meta-observation.** Model costs falling ~10× relieved exactly one class of constraint:
**per-item LLM maintenance operations.** That revives A-MEM-style link generation,
Generative-Agents-style per-item scoring, and offline consolidation passes — all of which
were priced out and now are not.

It relieves **none** of the constraints that actually killed the rest. Worse, cheap models
make it *easier* to write more memories, which strengthens the two constraints that scale
with store size: **shadowing/context overhead (§7d) and poisoning surface (§7c)**. The
binding constraint for a 2026 design has moved from *"can we afford to maintain this?"* to
*"can we keep the store small, current, and non-distracting as it grows?"*

---

## Implications for a Datalog-family curated-learnings store

Stated as design rules, each traceable to a measured result above:

1. **Never discard the source.** Every learning carries a pointer to the verbatim evidence
   it was derived from (§7a: 15.9–22.0 points). Structured learnings *augment*; they do not
   *replace*.
2. **Query in structure; inject in prose.** Datalog is the index. What reaches the coding
   agent is rendered natural language (§7b: JSON context is the documented worst case for
   code generation specifically).
3. **Supersession, not deletion, not decay.** Entity drift is real; the newer fact should
   supersede the older through merge. Deletion is not required, and aggressive retirement
   measurably fell below the no-skill baseline (§2, §7d/A4). Datalog's natural fit: a
   supersedes/2 relation with derived "currently-believed" views.
4. **Append-only writes; derived views for abstraction.** A-MEM's in-place evolution
   propagates errors (§2). Recomputable derived predicates give the multi-scale benefit of
   trees without the invalidation cascade (§1).
5. **Localize maintenance.** O7 from the agent-native benchmark: bounded-subset updates are
   the cost-efficient class; global reorganization is the expensive one (§5).
6. **Budget the injected set hard, and expect the ceiling.** Pass rate falls monotonically
   with library size *even when selection is correct* (§7d). Plan for a router that declines
   to inject on a meaningful fraction of tasks — the Library Drift default injected on 73%.
7. **Instrument drift before building governance for it.** Explicit dedup did not help;
   harsh retirement actively harmed. "The diagnostic recipe is what makes failures visible"
   (§7d).
8. **Gate the write path.** Poisoning persists cross-session at up to 64.70% RSR, and
   aggressive write policies expand the attack surface in direct proportion to the
   performance they buy (§7c).
9. **Two tiers, one pointer.** Abstracted learning for transfer; verbatim evidence for
   recall; a link between them. Multi-granularity beat every single granularity tested
   (§7e).
10. **Consolidate offline.** The one parametric-adjacent idea that shipped — and it shipped
    as *store* consolidation, not weight consolidation (§4).

**One thing the graveyard says is genuinely unclaimed:** classic CBR's **Revise** step.
Retrieve, reuse, and retain all transferred into 2026 agent memory. Revise did not — no
current system systematically revises a stored learning when applying it reveals it was
wrong. A Datalog store with explicit conditions and supersession rules is unusually
well-positioned to be the first thing that does, and the maintenance problem that killed
classic CBR (swamping) is exactly what §7d re-measures under new names.

---

## Sources

**Controlled ablations and negative results (highest value)**
- Fidelity Before Structure: Verbatim Chunks Beat Lossy Artifact Extraction — https://arxiv.org/abs/2601.00821
- More Skills, Worse Agents? Skill Shadowing Degrades Performance — https://arxiv.org/html/2605.24050v1
- Library Drift: Diagnosing and Fixing a Silent Failure Mode — https://arxiv.org/html/2605.19576v1
- WikiBigEdit: Understanding the Limits of Lifelong Knowledge Editing — https://arxiv.org/abs/2503.05683
- Model Editing at Scale leads to Gradual and Catastrophic Forgetting — https://aclanthology.org/2024.findings-acl.902/
- Rebuilding ROME: Resolving Model Collapse during Sequential Model Editing — https://arxiv.org/pdf/2403.07175
- Spectral Characterization and Mitigation of Sequential Knowledge Editing Collapse — https://arxiv.org/pdf/2601.11042
- Are We Ready For An Agent-Native Memory System? — https://arxiv.org/html/2606.24775
- MemConflict: Evaluating Long-Term Memory Systems Under Memory Conflicts — https://arxiv.org/html/2605.20926v1

**Hierarchical / tree memory**
- RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval — https://arxiv.org/html/2401.18059v1
- RAPTOR (ICLR 2024 proceedings) — https://proceedings.iclr.cc/paper_files/paper/2024/file/8a2acd174940dbca361a6398a4f9df91-Paper-Conference.pdf
- Hierarchical Abstract Tree for Cross-Document RAG — https://arxiv.org/pdf/2605.00529
- MEMTIER: Tiered Memory Architecture and Retrieval Bottleneck Analysis — https://arxiv.org/html/2605.03675v1

**Self-organizing / evolving memory**
- A-MEM: Agentic Memory for LLM Agents — https://arxiv.org/abs/2502.12110
- A-MEM: Zettelkasten for agents (critique — error propagation) — https://blog.alphasmanifesto.com/2026/04/11/a-mem-zettelkasten-for-agents/
- MemoryBank: Enhancing LLMs with Long-Term Memory — https://www.emergentmind.com/papers/2305.10250
- Learn to Memorize: Optimizing LLM-based Agents with Adaptive Memory Framework — https://arxiv.org/pdf/2508.16629
- The Consolidation Problem in Agent Memory — https://hindsight.vectorize.io/blog/2026/05/21/agent-memory-consolidation
- Memory for Autonomous LLM Agents: Mechanisms, Evaluation, Emerging Frontiers — https://arxiv.org/html/2603.07670v1
- What to Keep, What to Forget: A Rate–Distortion View of Memory Compaction — https://arxiv.org/html/2607.08032v1

**Episodic replay / CBR**
- Review of Case-Based Reasoning for LLM Agents — https://arxiv.org/abs/2504.06943
- Retrieval, reuse, revision and retention in CBR (Aamodt & Plaza lineage) — https://www.iiia.csic.es/~mantaras/RRRR.pdf
- OCR-Memory: Optical Context Retrieval for Long-Horizon Agent Memory — https://arxiv.org/html/2604.26622v1
- Key challenges in designing agent episodic memory (AWS) — https://aws.amazon.com/blogs/machine-learning/build-agents-to-learn-from-experiences-using-amazon-bedrock-agentcore-episodic-memory/

**Neural / parametric memory**
- Titans: Learning to Memorize at Test Time — https://arxiv.org/abs/2501.00663
- Titans OpenReview (NeurIPS 2025) — https://openreview.net/forum?id=8GjSf9Rh7Z
- Continual Learning and Memory: Titans and End-to-End Test-Time Training — https://shuaichenchang.github.io/posts/2026/continual-learning-1/
- Reliable, Adaptable, and Attributable Language Models with Retrieval (RETRO adoption barriers) — https://arxiv.org/pdf/2403.03187
- Sleep-time Compute (Letta) — https://www.letta.com/blog/sleep-time-compute/ · paper https://arxiv.org/abs/2504.13171
- Low-Rank Adaptation for Foundation Models: A Comprehensive Review — https://arxiv.org/pdf/2501.00365
- Merge before Forget: A Single LoRA Continual Learning via Continual Merging — https://arxiv.org/pdf/2512.23017

**OS metaphor / working memory**
- MemGPT: Towards LLMs as Operating Systems — https://arxiv.org/pdf/2310.08560
- Letta (MemGPT) Walkthrough: How Self-Managing Agent Memory Works (2026) — https://sureprompts.com/blog/letta-memgpt-walkthrough

**Multi-store cognitive architectures**
- Cognitive Architectures for Language Agents (CoALA), TMLR 2024 — https://arxiv.org/abs/2309.02427
- The Missing Knowledge Layer in Cognitive Architectures for AI Agents (CoALA critique) — https://arxiv.org/pdf/2604.11364

**Context quality**
- The Context Format Decision: JSON vs Markdown vs Plain Text — https://tianpan.co/blog/2026-05-07-context-format-decision-agent-reasoning-json-markdown-plain-text
- Capacity, Not Format: Rethinking Structured Reasoning Failures — https://arxiv.org/pdf/2606.09410
- Diagnosing and Mitigating Context Rot in Long-horizon Search — https://arxiv.org/html/2606.29718
- Context Rot: Why LLMs Degrade as Context Grows — https://www.morphllm.com/context-rot
- Lost in the Middle, and In-Between — https://arxiv.org/pdf/2412.10079
- From Untrusted Input to Trusted Memory: Memory Poisoning Attacks in LLM Agents — https://arxiv.org/html/2606.04329v1
- Memory Poisoning Attack and Defense on Memory Based LLM-Agents — https://arxiv.org/html/2601.05504v2
- Hidden in Memory: Sleeper Memory Poisoning in LLM Agents — https://arxiv.org/pdf/2605.15338

**Abstraction level / granularity**
- Memory Transfer Learning: How Memories are Transferred Across Domains in Coding Agents — https://arxiv.org/html/2604.14004v1
- Towards Multi-Granularity Memory Association and Selection (MemGAS) — https://arxiv.org/html/2505.19549v1
- Structurally Aligned Subtask-Level Memory for Software Engineering Agents — https://arxiv.org/html/2602.21611
- Dynamic Agent Skills: A Lifecycle Survey and Taxonomy of Evolving Skill Libraries — https://arxiv.org/html/2607.10113v1
