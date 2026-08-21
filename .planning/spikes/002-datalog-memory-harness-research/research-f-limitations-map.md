# Research F — The Limitations Map

**A weakness catalog of every existing agent-memory approach.**
Compiled 2026-08-20. Sources weighted toward 2024–2026 primary papers, adversarial
replications, benchmark disputes, and engineering post-mortems. Vendor marketing is
cited only where it is the disputed artifact itself.

This document deliberately produces **no best practices**. It is the failure map.

---

## 0. How to read this

Every entry is tagged with a fixability verdict:

| Tag | Meaning |
|---|---|
| **UNFIXABLE** | Follows from an information-theoretic, architectural, or economic property of the approach. A successor must change substrate, not tuning. |
| **UNENGINEERED** | Nothing prevents a fix; nobody has built or measured it. This is where a new design earns its keep cheaply. |
| **MITIGABLE** | Fixable but only by paying a cost (latency, tokens, human labor) that partially defeats the approach's original selling point. |

---

## 1. Master failure-mode table (approach × failure × evidence × fixable?)

| # | Approach | Failure mode (named term where one exists) | Evidence | Fixable? |
|---|---|---|---|---|
| 1.1 | Flat curated context (CLAUDE.md) | **Context rot** — accuracy degrades monotonically with input length on *all* 18 frontier models tested, even on trivial tasks; not a window-limit effect | Chroma, *Context Rot* (Jul 2025), 18 models incl. Claude Opus 4, GPT-4.1, Gemini 2.5, Qwen3 | **UNFIXABLE** (attention dilution is architectural) |
| 1.2 | Flat curated context | **Lost in the middle** — U-shaped positional accuracy; >30% drop for mid-context facts; 15–20 pt drop for docs at position 5–15 of 20 | Liu et al. 2023; reproduced through 2026 on 1M-token models; RoPE long-term decay + softmax concentration as mechanism | **UNFIXABLE** in-principle; per-model variance (Gemini 2.5 Flash near-flat on simple factoid NIAH) |
| 1.3 | Flat curated context | **Distractor interference** — a *single* semantically-similar distractor measurably degrades performance; 4 distractors worse; GPT-family hallucinates most, Claude least | Chroma *Context Rot*, distractor experiment | **UNFIXABLE** (a curated file cannot exclude what the task didn't predict) |
| 1.4 | Flat curated context | **Rules-file bloat** — every added line degrades adherence to lines already present; contradictions are silently resolved by the model without flagging | Practitioner post-mortems (Unblocked, Augment Code "junk drawer", Termdock); Anthropic guidance <200 lines | **MITIGABLE** (only by human curation labor) |
| 1.5 | Flat curated context | **Brevity bias** — regeneration/summarization drops domain-specific detail in favor of concise generic prose | ACE paper, arXiv 2510.04618 | **UNENGINEERED** (structured incremental delta updates fix it — ACE demonstrates) |
| 1.6 | Flat curated context | **Context collapse** — iterative full-file rewriting monotonically erodes accumulated detail across generations | ACE paper, arXiv 2510.04618 | **UNENGINEERED** (append-delta + curator role) |
| 1.7 | Flat curated context | **No selective recall** — the file is all-or-nothing; retrieval granularity = 1 | Structural; corroborated by 1.1/1.2 (the whole file competes for attention every turn) | **UNFIXABLE** for the format itself |
| 1.8 | Flat curated context | **Staleness with no detection** — instructions restating code go stale silently; no invalidation signal exists | Practitioner consensus; formalized as "temporal obsolescence" in SSGM taxonomy (arXiv 2603.11768) | **UNENGINEERED** (provenance + source-hash invalidation is buildable) |
| 1.9 | Flat curated context | **Single-file write contention** in multi-agent settings — duplicate edits, stale reads, overwritten changes; "the most common source of silent corruption in a team setup" | Multi-agent workflow post-mortems; formalized as *stale propagation* in arXiv 2606.24535 | **UNENGINEERED** (transactional store instead of a file) |
| 2.1 | Vector RAG | **Combinatorial ceiling of single-vector retrieval** — the number of distinct top-k document subsets representable is bounded by embedding dimension; grows as a degree-3 polynomial in d, not exponentially | Weller/Boratko/Naim/Lee (DeepMind), *On the Theoretical Limitations of Embedding-Based Retrieval*, arXiv 2508.21038; LIMIT benchmark | **UNFIXABLE** for single-vector dense; requires multi-vector/hybrid/non-embedding substrate |
| 2.2 | Vector RAG | **LIMIT collapse** — SOTA embedders fall below recall@100 of 20% on LIMIT-full (50k docs) on a trivially simple task; still fail on LIMIT-small (46 docs) | google-deepmind/limit | **UNFIXABLE** (same root as 2.1) |
| 2.3 | Vector RAG | **Chunking severs argument structure** — chunk boundaries cut across discourse structure; model receives fragments without their warrant | Broad practitioner + benchmark consensus; structure-aware chunking is the standard "biggest quality lift after hybrid" admission | **MITIGABLE** (structure-aware/LLM-assisted chunking = more LLM cost at write time) |
| 2.4 | Vector RAG | **Multi-hop under-retrieval** — no query decomposition means multi-hop questions under-retrieve by construction; only 65.8% of HotpotQA answer entities and 65.5% of NQ answer entities are even *present* in the retrieved/constructed structure | *RAG vs GraphRAG*, arXiv 2502.11371v3 | **UNFIXABLE** for single-shot similarity; requires derivation, not retrieval |
| 2.5 | Vector RAG | **Exact-identifier retrieval failure** — rare tokens (IDs, symbols, tickers, error codes, file paths) are precisely where dense retrieval is weakest; BM25 beats dense on identifier-dense corpora | *From BM25 to Corrective RAG*, arXiv 2604.01733; hybrid/RRF is the standard workaround | **MITIGABLE** (hybrid; but then you maintain two indexes) |
| 2.6 | Vector RAG | **Index drift / embedding staleness** — v1 and v2 vectors are not comparable; *partial* re-embedding is the dangerous variant because similarity has no temporal dimension and stale vectors score just as high as fresh ones. Full upgrade = re-encode corpus + rebuild ANN | *Drift-Adapter*, arXiv 2509.23471; multiple production post-mortems | **MITIGABLE** at real cost (Drift-Adapter recovers only 95–99% of full-re-embed recall) |
| 2.7 | Vector RAG | **Similarity ≠ relevance** — needle-question cosine similarity predicts degradation: low-similarity pairs degrade *faster* with length. Retrieval optimizes surface proximity, not evidentiary support | Chroma *Context Rot*, needle-question similarity experiment (0.445–0.829 cosine range) | **UNFIXABLE** for pure similarity scoring |
| 2.8 | Vector RAG | **Uncalibrated retrieval confidence / over-refusal** — distractors corrupt the model's uncertainty estimate; it mistakes context noise for a knowledge gap and refuses questions it can answer parametrically | AAAI 2026 line of work on retrieval-augmented over-refusal; *Trust or Abstain*, arXiv 2605.18792 | **UNENGINEERED** (calibrated abstention exists in research, not in memory products) |
| 2.9 | Vector RAG | **Retrieval-state lock-in** — repeated sampling conditions on the same defective retrieval neighborhood, so self-consistency voting *agrees on the wrong answer*. Errors are stable, therefore invisible to ensembling | arXiv 2606.22728 | **UNFIXABLE** without an independent verification channel |
| 2.10 | Vector RAG | **Retrieval poisoning** — PoisonedRAG: ASR >90% with 5 injected texts/question at k=5. AgentPoison: 82% retrieval-success, 63% end-to-end ASR at <0.1% poisoning ratio, <1% benign degradation, evasive to perplexity filters | Zou et al. PoisonedRAG; AgentPoison, arXiv 2407.12784 (NeurIPS 2024) | **UNFIXABLE** as long as writes are unauthenticated and unprovenanced; **UNENGINEERED** given provenance + write admission control |
| 3.1 | GraphRAG (LLM-extracted) | **Evaluation bias inflated the entire literature** — LightRAG's claimed 72% win-rate vs NaiveRAG falls to **39%** under debiased evaluation. Best method's advantage is "below 10% in win rate." Authors: gains "become much more moderate or even vanish" | *How Significant Are the Real Performance Gains?*, arXiv 2506.06331 | **UNFIXABLE** as a claim; the reported advantage largely wasn't real |
| 3.2 | GraphRAG | **LLM-judge position bias** — swapping answer order (AB→BA) swings win rates by >30 pts for identical methods | arXiv 2506.06331 | **UNENGINEERED** (position-randomized eval is trivial and rarely done) |
| 3.3 | GraphRAG | **LLM-judge length bias** — a 25-token difference in 200-token answers produces >50 pt win-rate gaps | arXiv 2506.06331 | **UNENGINEERED** |
| 3.4 | GraphRAG | **Trial bias** — the same comparison yields ties, wins and losses across 5 runs; single-run papers are noise | arXiv 2506.06331 | **UNENGINEERED** |
| 3.5 | GraphRAG | **Extraction error compounding** — LLM bias, hallucination, prompt sensitivity and domain-coverage gaps interact with graph structural bias to produce *compounded* distortions propagating downstream | *Analyzing Bias in LLM-Augmented KG Systems*, Applied Sciences 16(7):3410; iText2KG arXiv 2409.03284 | **UNFIXABLE** if the graph is the only representation; **MITIGABLE** if extraction is treated as a defeasible claim with provenance |
| 3.6 | GraphRAG | **Entity resolution / canonicalization failure** — coreference gaps, non-canonical entities, implicit facts, hallucinated edges. Described as *structural, not model-specific* | KG construction survey, Applied Sciences 15(7):3727 | **UNFIXABLE** by better prompting; needs deterministic identity keys |
| 3.7 | GraphRAG | **Graph coverage hole** — only **65.8%** (HotpotQA) / **65.5%** (NQ) of answer entities appear in the constructed graph at all. A third of answers are unreachable regardless of retrieval policy | arXiv 2502.11371v3 | **UNFIXABLE** for one-shot LLM extraction |
| 3.8 | GraphRAG | **Community summaries lose fine-grained evidence and raise hallucination risk on null queries**; global search "often struggles on QA" and loses to naive RAG on detail-centric questions | arXiv 2502.11371v3 | **UNFIXABLE** (summarization is lossy by definition) |
| 3.9 | GraphRAG | **Construction and retrieval cost** — KG-GraphRAG: 7,702s construction vs RAG's 135s (57×); retrieval 14,434s vs 1,724s (8×). MGRAG: 326,200 tokens and 25.8s *per query* | arXiv 2502.11371v3; arXiv 2506.06331 | **UNFIXABLE** economically at high write volume |
| 3.10 | GraphRAG | **Rebuild-on-change** — incremental indexing was a long-standing open request; the `append` path degrades "to the same as normal indexing" in the worst case, and community summaries must be recomputed | microsoft/graphrag issue #741, discussion #511 | **UNENGINEERED** (incremental maintenance is a solved problem in database theory, unsolved in GraphRAG products) |
| 3.11 | GraphRAG | **Construction-model sensitivity** — swapping GPT-4o-mini for GPT-4o substantially changes multi-hop accuracy; the "knowledge" is a function of the extractor, not the corpus | arXiv 2502.11371v3 | **UNFIXABLE** for LLM-extracted graphs |
| 3.12 | GraphRAG | **Deletion leaves orphaned edges** that themselves leak what was deleted | GDPR/erasure analyses of GraphRAG | **UNENGINEERED** |
| 4.1 | Temporal KG (Zep/Graphiti) | **LLM-driven fact invalidation is the weakest link** — replacing LLM judgment with a deterministic `max(serial)` gains **+10.8 pp** average (67.2%→78.0%), widening to **+21 pp at 262K tokens** (61%→82%) | *Don't Ask the LLM to Track Freshness*, arXiv 2606.01435 | **UNFIXABLE** by prompting; **UNENGINEERED** as a deterministic mechanism |
| 4.2 | Temporal KG | **Prior-override** — when a fact's subject has strong pretraining associations, the model emits the prior despite an explicit "newer wins" instruction and a higher serial number in context | arXiv 2606.01435 | **UNFIXABLE** in an entangled single-step free-text decision; fixed only by removing entity text from the comparison |
| 4.3 | Temporal KG | **Serial-comparison drift** — accuracy falls 75%→61% from 64K to 262K tokens purely from losing track of which version is newest | arXiv 2606.01435 | **UNFIXABLE** in-context; deterministic ordering solves it |
| 4.4 | Temporal KG | **Write-path cost** — every episode triggers multiple LLM calls (extraction + entity resolution + invalidation); write cost scales with interaction volume and you must operate a graph DB | Graphiti architecture; independent evaluations (Vaughan, Codex blog) | **UNFIXABLE** economically for LLM-mediated writes |
| 4.5 | Temporal KG | **Memory footprint dispute** — Mem0's paper reports Graphiti at 600,000+ tokens/conversation vs Mem0's 1,764; Zep disputes the configuration. *Both numbers are contested and neither is independently reproduced* | Mem0 arXiv 2504.19413; Zep rebuttal | Evidence quality itself is the failure |
| 4.6 | Temporal KG | **Server + vendor dependence** — Zep Community Edition (self-hosted, full-featured) was retired in 2025; full capability now requires Zep Cloud. Graphiti remains OSS but is the engine, not the product | Zep CE deprecation; 2026 framework comparisons | **UNFIXABLE** as a vendor property |
| 5.1 | Agentic search (grep/read) | **Coordination breakdown** — 41.8% of Deep Agentic search failures, a mode entirely absent from indexed retrieval; and in **91% of those cases the agent returned a fluent, confidently-worded answer** rather than surfacing the failure | *Deep Agentic Search for Repository-Level Code QA*, arXiv 2608.01507 | **UNFIXABLE** without an external verification oracle |
| 5.2 | Agentic search | **Non-terminating exploration loops** — 13.5% of failures vs 2.9% for semantic search; longer trajectories correlate with *lower* success | arXiv 2608.01507 | **MITIGABLE** (budgets), at the cost of recall |
| 5.3 | Agentic search | **Token cost** — 22× more input tokens (761k vs 34k per question, Qwen3-235B); $0.74 vs $0.32 per correct answer | arXiv 2608.01507 | **UNFIXABLE** economically |
| 5.4 | Agentic search | **Accuracy deficit vs indexed retrieval** — 46.2% vs 65.2% pass rate; loses on 14 of 15 Python repos | arXiv 2608.01507 | **UNFIXABLE** on this evidence for repo-scale QA |
| 5.5 | Agentic search | **Search strategy is a frontier-model skill** — Gemini 3 Flash shows a 49.6 pt gap between paradigms, Gemini 2.5 Flash only 5.6 pt. Capability is backbone-dependent, not framework-dependent | arXiv 2608.01507 | **UNFIXABLE** (you cannot ship the skill, only rent it) |
| 5.6 | Agentic search | **Context pollution** — raw tool output accumulates in-window, then triggers §1.1/1.2 context rot on the very reasoning the search was serving | Milvus critique; Morph/agentic-search analyses | **UNFIXABLE** (self-reinforcing with 1.1) |
| 5.7 | Agentic search | **No inference** — grep can only find what is *written*. It cannot derive an unstated consequence of two written facts | Structural | **UNFIXABLE** — the single clearest gap a derivation engine fills |
| 5.8 | Agentic search | **Observability void** — 68.8% of Deep tool calls execute inside delegated subagents, invisible to the orchestrator | arXiv 2608.01507 | **UNENGINEERED** |
| 6.1 | Memory products (Mem0/Zep) | **The LoCoMo dispute** — Zep claims 84%; Mem0's audit finds a Category-5 numerator/denominator error inflating by ~25.56 pp and corrects to **58.44% ± 0.20**; Zep counters that Mem0 misconfigured it and claims **75.14% ± 0.17** vs Mem0's 65.99%. Marketing pages now cite 94.7% and 92.5% | getzep/zep-papers issue #5 (filed 2025-05-08); Zep blog rebuttal; Mem0 paper arXiv 2504.19413 | **UNFIXABLE** as literature — no neutral referee exists |
| 6.2 | Memory products | **LoCoMo is too small to test memory** — 16k–26k token conversations fit inside every modern context window. **Mem0's own numbers show a full-context baseline (~73% J) beating Mem0's best (~68%)** | Zep's own admission; Mem0 paper tables; *Anatomy of Agentic Memory* saturation analysis | Benchmark is **UNFIXABLE**; the *category* is UNENGINEERED |
| 6.3 | Memory products | **LoCoMo data defects** — Category 5 unusable (missing ground truth), speaker misattribution, multimodal errors, ambiguous questions with multiple correct answers, and *no questions testing knowledge update at all* | Zep blog; LoCoMo-Plus arXiv 2602.10715 | **UNFIXABLE** for that dataset |
| 6.4 | Memory products | **Task-disclosure bias and length bias** in the standard LoCoMo protocol — disclosing the task type inflates temporal/adversarial scores; BLEU/ROUGE/F1 peak near mean ground-truth length | LoCoMo-Plus, arXiv 2602.10715 | **UNENGINEERED** |
| 6.5 | Memory products | **ADD-only drift / conflicting memories** — hash dedup catches only exact duplicates; "favorite player is Ronaldo" and "current favorite is Messi" are stored as two independent ADDs with no supersession | mem0ai/mem0 issue #5867, issue #4896, discussion #4787 | **UNENGINEERED** (this is a schema decision, not a hard problem) |
| 6.6 | Memory products | **TOCTOU write race** — two concurrent `add()` calls extracting the same fact create a permanent silent duplicate; "no error, warning, or user-visible signal" | mem0ai/mem0 issues #6515, #6531 | **UNENGINEERED** (transactional write) |
| 6.7 | Memory products | **Write quality is unmeasured** — evaluation is retrieval-side almost everywhere; MEMAUDIT finds greedy writers reach only **60–85%** of package-optimal coverage, and some retain **<50%** of recoverable facts at standard budgets | MEMAUDIT, arXiv 2605.02199 | **UNENGINEERED** — the single largest measurement vacuum in the field |
| 6.8 | Memory products | **False promotion** — correlated agent traces are counted as independent confirmations, promoting weak signals into persistent memory; degrades AUPRC and raises review overhead | *When Not to Write Memory*, arXiv 2607.02579 | **UNENGINEERED** |
| 6.9 | Memory products | **Backbone-dependent silent corruption** — structured-output format error rates: gpt-4o-mini/Nemori **17.91%**, Qwen-2.5-3B/Nemori **30.38%**. Weak models corrupt long-term memory while producing fluent short-term answers | *Anatomy of Agentic Memory*, arXiv 2602.19320 (Table 4) | **UNFIXABLE** with free-text LLM writes; **UNENGINEERED** with a validated schema/parser |
| 6.10 | Memory products | **The agency tax** — per-turn latency: full-context 1.726s, SimpleMem 1.057s, MAGMA 1.462s, **MemoryOS 32.372s**. Construction: A-Mem **15 hours**; Nemori **7.04M tokens** (5× SimpleMem) | arXiv 2602.19320 (Table 5) | **MITIGABLE** but rarely reported |
| 6.11 | Memory products | **Framework lock-in** — Letta agents run *inside* the Letta runtime; switching means rewriting the loop, tool execution, state management, and memory access. Local-mode compaction/sleep-time reflection needs provider timeouts up to 600s | Letta production reviews 2026; Letta sleep-time-compute blog | **UNFIXABLE** as a product property |
| 6.12 | Memory products | **Sleep-time compute only pays off when queries are predictable** — i.e. exactly when memory matters least | Letta's own blog | **UNFIXABLE** |
| 6.13 | Memory products | **Vendor/portability risk** — Zep CE retired 2025 (self-host path removed); MemGPT→Letta re-platforming; ~40% of AI startups founded 2024 dead within 24 months; shutdowns have destroyed user memory stores with no migration path | Zep CE deprecation; 2026 consolidation analyses; China companion-app shutdowns (Apr 2026 Interim Measures) | **UNFIXABLE** — argues for a local, inspectable, file-or-DB-backed store |
| 7.1 | Cross-cutting | **Supersession has no mechanism anywhere** — append-only stores lack explicit supersession semantics; downstream consumers cannot choose the authoritative version | arXiv 2606.24535 (*contradiction persistence*); mem0 #5867 | **UNENGINEERED** |
| 7.2 | Cross-cutting | **Conflict resolution is measurably broken** — GPT-4o memory agents reach only **60% on single-hop conflict resolution**; on MemoryAgentBench Fact Consolidation *every* evaluated system substantially underperforms even when told "newer facts have larger serial numbers" | MemoryAgentBench, arXiv 2507.05257 (ICLR 2026); arXiv 2606.01435 | **UNENGINEERED** |
| 7.3 | Cross-cutting | **Provenance collapse** — retrieved memories cannot be traced to origin, undermining debugging, auditability, and governance | arXiv 2606.24535; Eywa, arXiv 2605.30771 | **UNENGINEERED** |
| 7.4 | Cross-cutting | **Deterministic multi-hop derivation is absent** — every approach either retrieves-and-hopes (RAG), extracts-and-hopes (GraphRAG), or greps-and-hopes (agentic). None *derives* | §2.4, §3.7, §5.7 combined | **UNENGINEERED** |
| 7.5 | Cross-cutting | **Deliberate forgetting is untested** — "only MemoryAgentBench tests selective forgetting explicitly"; a forget request must propagate across every derived tier or it is only a retrieval edit | arXiv 2603.07670; *Always-On Agents*, arXiv 2606.30306; agentic unlearning arXiv 2602.17692 | **UNENGINEERED** |
| 7.6 | Cross-cutting | **Cumulative, persistent error** — unlike static RAG where errors are isolated, evolving-memory errors compound across ingestion (poisoning) → consolidation (drift) → retrieval (hallucination) | SSGM, arXiv 2603.11768 | **UNFIXABLE** without an invalidation/audit substrate |
| 7.7 | Cross-cutting | **Passive recall ≠ active use** — models scoring near-perfect on LoCoMo drop to **40–60% on MemoryArena**, where later subtasks depend on what was learned earlier | MemoryArena, arXiv 2602.16313 | Benchmark gap: **UNENGINEERED** |
| 7.8 | Cross-cutting | **Horizon mismatch** — most memory papers evaluate 10–50 sessions; production agents run thousands over months | arXiv 2603.07670 | **UNENGINEERED** |
| 7.9 | Cross-cutting | **Observability void** — memory operation logging, replay, and regression testing for memory behavior are "rarely discussed in research papers" yet essential in production | arXiv 2603.07670 | **UNENGINEERED** |
| 7.10 | Cross-cutting | **Reflective entrenchment** — an agent that once concluded "API X always errors with parameter Y" will avoid that path forever; over-generalization from limited evidence is ungated | arXiv 2603.07670 | **UNENGINEERED** (needs confidence + contradiction gating) |

---

## 2. Per-approach detail

### 2.1 Flat curated context files (CLAUDE.md-style)

**Quantified rot.** Chroma's *Context Rot* (Jul 2025) is the load-bearing citation: 18
frontier models across Anthropic, OpenAI, Google and Alibaba, and *every one* degrades with
input length at every increment tested, including on tasks as trivial as replicating a
repeated-word sequence. Position accuracy declines with length; GPT-4.1 refused 2.55% and
Claude Opus 4 2.89% of repeated-word tasks outright. On LongMemEval, the gap between a
~300-token focused prompt and the ~113k-token full prompt was large for every family, most
pronounced for Claude.

Liu et al.'s **lost-in-the-middle** result remains the canonical positional finding: >30%
degradation for mid-context relevant information, 15–20 pt drop for documents in positions
5–15 of 20. The mechanism is now well attributed — RoPE long-term decay reduces
dot-product similarity across distance, and softmax normalization concentrates attention,
reinforcing primacy and recency. This is architecture, not tuning. Some 2026 models (Gemini
2.5 Flash) show near-flat curves on *simple factoid* NIAH, which is the honest caveat: the
effect is task-dependent and shrinking on the easiest tasks, not gone on hard ones.

**The curation trap.** The practical form of the failure is that a curated file's value and
its cost grow together. Every line added degrades adherence to lines already there. Worse,
contradictions are handled by silent resolution — models "almost never flagged it to the
user and just silently picked one interpretation and kept going." Redundancy costs tokens;
contradiction costs correctness, and neither surfaces.

**Regeneration failures (ACE).** The ACE paper (arXiv 2510.04618) names the two failure
modes that matter for any system that periodically *rewrites* its own memory file:
- **Brevity bias**: optimization pressure toward concision drops the domain-specific
  insights that were the reason to write anything down.
- **Context collapse**: iterative full rewriting monotonically erodes detail; generation N+1
  is a lossy re-encoding of generation N, and losses compound.

ACE's fix — structured *incremental delta* updates with separated Generator/Reflector/Curator
roles, never a monolithic rewrite — is the clearest evidence these two are UNENGINEERED
rather than unfixable. Note the implication for a successor: **regeneration is the enemy;
accumulation with structure is the fix.**

**Multi-agent.** A single file is a shared mutable variable with no transaction. The observed
failures — duplicate strikes, stale reads, overwritten changes — are exactly the ones a
database solves and a filesystem does not.

**What a successor must do differently:** selective recall at sub-file granularity; never
regenerate wholesale; carry provenance so staleness is detectable rather than assumed; make
writes transactional.

**Unfixable:** context rot, lost-in-the-middle, distractor sensitivity, all-or-nothing recall.
**Unengineered:** brevity bias, context collapse, staleness detection, write contention.

---

### 2.2 Vector RAG

**The theoretical result.** DeepMind's *On the Theoretical Limitations of Embedding-Based
Retrieval* (arXiv 2508.21038) is the strongest available "this cannot be tuned away" claim
in the whole map. The number of top-k document subsets a d-dimensional single-vector model
can return is bounded by d, and the empirical d-vs-corpus-size relationship follows a
degree-3 polynomial — larger dimension helps, and cannot close the gap. The accompanying
LIMIT benchmark is deliberately trivial in content; SOTA embedders still fall below
recall@100 of 20% on the 50k-document configuration and still fail on the 46-document one.
The paper's own reframing is the useful one: hybrid and multi-vector retrieval are not
optimizations, they are *necessary architecture*.

**Chunking.** Chunk boundaries cut across argument structure. A claim retrieved without its
warrant, or a conclusion without its qualifying condition, is worse than no retrieval,
because it is confidently wrong. Structure-aware or LLM-assisted chunking is the standard
mitigation and it moves cost to write time — it does not remove the boundary problem, only
relocates the boundaries.

**Multi-hop and coverage.** The measured ceiling is stark: on HotpotQA only 65.8% of answer
entities are present in the retrieved structure at all. No reranking policy recovers the
missing third.

**Exact identifiers.** Rare tokens are the adversarial case for dense retrieval and the easy
case for lexical. For a memory system holding file paths, symbol names, config keys, commit
SHAs or error codes, dense retrieval is the *wrong default*, and the standard fix (hybrid +
RRF) means maintaining and tuning two retrieval systems and a fusion.

**Staleness.** *Drift-Adapter* (arXiv 2509.23471) documents the operational reality: an
embedding model upgrade requires re-encoding the corpus and rebuilding the ANN index. The
subtle failure is partial re-embedding — mixed-generation vectors are not comparable, and
because cosine similarity has no temporal dimension, a stale vector scores just as high as a
fresh one. There is no in-band signal. Drift-Adapter recovers 95–99% of full-re-embed recall
at <10 µs extra query latency, i.e. the best available mitigation still loses 1–5% of recall.

**Confidence.** Two distinct calibration failures are documented. (a) Over-refusal:
distractors corrupt the model's uncertainty estimate so it declines questions it knows
parametrically — retrieval "tricks the model into silence." (b) **Retrieval-state lock-in**
(arXiv 2606.22728): repeated samples condition on the same defective retrieval neighborhood,
so self-consistency agrees on a wrong answer. The error is *stable*, which defeats the usual
ensembling defense and makes the failure invisible to the standard confidence proxy.

**Poisoning.** PoisonedRAG achieves >90% ASR with 5 crafted texts per target question at k=5.
AgentPoison (NeurIPS 2024) attacks agent long-term memory specifically: 82% retrieval
success, 63% end-to-end attack success, at **<0.1% poisoning ratio**, with <1% degradation on
benign inputs, and resistant to perplexity-based detection and rephrasing. The economics are
brutal — a memory store that accepts unauthenticated writes is compromised by a rounding
error's worth of poisoned entries.

**What a successor must do differently:** don't rely on a single vector as the primary index;
make identity/identifier lookup exact; carry provenance so poisoned or stale entries are
identifiable and revocable; treat retrieval confidence as an unsolved measurement rather than
a score to threshold.

**Unfixable:** dimensional ceiling, similarity≠relevance, retrieval-state lock-in, multi-hop
under-retrieval by single-shot similarity.
**Mitigable at cost:** chunking, exact identifiers, embedding upgrades.
**Unengineered:** calibrated abstention, provenance-gated writes.

---

### 2.3 GraphRAG (Microsoft-style, LLM-extracted)

The most important finding in this section is not about GraphRAG's mechanics. It is that
**the reported advantage of GraphRAG over naive RAG is substantially an artifact of biased
evaluation.**

*How Significant Are the Real Performance Gains? An Unbiased Evaluation Framework for
GraphRAG* (arXiv 2506.06331) identifies three biases in the standard LLM-as-judge win-rate
protocol used across the GraphRAG literature:

- **Position bias**: presenting the same two answers as AB vs BA swings win rates by >30 pts.
- **Length bias**: a 25-token difference in a 200-token answer produces >50 pt win-rate gaps.
- **Trial bias**: identical comparisons produce ties, wins and losses across five runs.

After debiasing, LightRAG's claimed 72% win rate against NaiveRAG falls to **39%** — i.e. it
*loses*. The best method's residual advantage is "below 10% in win rate." The authors state
plainly that the reported gains "may be caused by the biases, and after eliminating the
biases, the performance gains become much more moderate or even vanish."

Any design document that cites GraphRAG's headline numbers as motivation is citing a
contaminated literature. Treat this as the single most useful piece of adversarial evidence
in the map.

**Extraction error compounding.** The KG-construction survey literature (Applied Sciences
15(7):3727; 16(7):3410) describes the error taxonomy as *structural, not model-specific*:
entity and relation canonicalization failures, coreference gaps, implicit facts never
surfaced, hallucinated edges. Crucially, LLM biases (social, representational, hallucination,
prompt sensitivity, domain-coverage) *interact* with the graph's own structural biases,
producing compounded distortion that propagates the length of the pipeline. A wrong edge is
not a wrong retrieval; it is a wrong premise that every downstream traversal inherits.

**Coverage.** arXiv 2502.11371v3 measures the hole directly: 65.8% / 65.5% answer-entity
coverage on HotpotQA / NQ. Roughly a third of the answers were never extracted.

**Community summaries.** Global search "can lose fine-grained evidence and hurt
detail-centric QA," "often struggles on QA," and raises hallucination risk on null queries.
Summarization at community level is lossy compression whose loss is invisible at query time.

**Cost.** KG-GraphRAG construction 7,702s vs RAG 135s (57×); retrieval 14,434s vs 1,724s
(8×). MGRAG burns 326,200 tokens and 25.84s *per query*. FGRAG is the honest counterexample
(3,310 tokens, 8.77s — comparable to naive RAG), which shows the cost is implementation-bound
rather than intrinsic, but the widely-deployed configurations are the expensive ones.

**Rebuild.** Incremental indexing was a long-standing open request against microsoft/graphrag
(issue #741, discussion #511). Microsoft's planned `append` path explicitly "degrades to the
same as normal indexing" in the worst case, precisely because community summaries must be
recomputed. This is the structural version of context collapse: the derived layer must be
regenerated, and regeneration is lossy and expensive.

**Extractor dependence.** Swapping GPT-4o-mini for GPT-4o materially changes multi-hop
accuracy. The graph encodes the extractor's beliefs, not the corpus's content — and the
extractor is a moving target across model releases.

**What a successor must do differently:** don't let LLM extraction be the sole authority for
graph structure; keep the source text addressable so an extraction error is correctable
without a rebuild; make derived layers incrementally maintainable rather than regenerated;
never evaluate with an un-randomized, single-trial LLM judge.

**Unfixable:** extraction compounding as sole representation, coverage holes, summary lossiness,
extractor dependence, the inflated literature.
**Unengineered:** incremental maintenance, unbiased evaluation, deletion with edge cleanup.

---

### 2.4 Temporal knowledge graphs (Zep / Graphiti)

Graphiti's bitemporal model (valid time + ingestion time, with edge invalidation on
supersession) is the closest thing in the commercial landscape to a correct data model. The
failures are in *who decides* and *what it costs*.

**The invalidation decision is delegated to an LLM, and that is the measured weak point.**
*Don't Ask the LLM to Track Freshness* (arXiv 2606.01435) is the decisive result:

- Replacing LLM judgment with structured extraction + a deterministic `max(serial)` yields
  **+10.8 pp average** (67.2% → 78.0%) on fact consolidation.
- The gap **widens with context**: +21 pp at 262K tokens (61% → 82%).
- **Prior-override**: when the subject has strong training-data associations, the model emits
  the pretrained prior despite an explicit "newer wins" rule and a higher serial in context.
- **Serial-comparison drift**: accuracy falls 75% → 61% from 64K to 262K tokens purely from
  losing track of which version is newest.

The authors argue this is structural to entangled reasoning — when filtering, prior
suppression, and generation happen in one free-text step over noisy retrieved context, the
model cannot reliably apply versioning rules. The deterministic fix works *because it removes
entity text from the comparison entirely*, denying prior-override an injection point. This is
the strongest available argument for a rule-based/deterministic derivation layer sitting
under an LLM interface, and it should be read as a direct mandate for a successor design.

**Write cost.** Every episode triggers multiple LLM calls (extraction, entity resolution,
invalidation). Write cost scales with interaction volume, and you operate a graph database.
This is the mirror image of the read-side advantage (Zep reports P95 retrieval ~300ms).

**Contested numbers.** Mem0's paper reports Graphiti at 600,000+ tokens per conversation vs
Mem0's 1,764; Zep disputes the test configuration. Neither figure has been independently
reproduced. Record it as *evidence quality failure*, not as a fact about Graphiti.

**Vendor.** Zep retired the full-featured self-hosted Community Edition in 2025. Graphiti
remains open source, but the product surface moved to Zep Cloud. For anything that must
survive a vendor, that is a hard constraint.

**What a successor must do differently:** make invalidation a deterministic function of
structured, comparable keys, not an LLM judgment call; make the write path cheap enough to run
on every interaction; own the store.

**Unfixable:** LLM-judged invalidation errors (prompting won't fix them), LLM write-path cost,
vendor dependence.
**Unengineered:** deterministic supersession — demonstrably +10 to +21 pp on the table.

---

### 2.5 Agentic search (grep / read-on-demand)

This is the approach Claude Code popularized and the one with the newest hard evidence
against it at repository scale.

*Deep Agentic Search for Repository-Level Code Question Answering: An Empirical Study*
(arXiv 2608.01507), 15 Python repositories:

| Metric | Semantic (indexed) | Deep Agentic |
|---|---|---|
| Pass rate | 65.2% | 46.2% |
| Failure rate | 21.9% | 34.4% |
| Input tokens/question (Qwen3-235B) | 34k | 761k (22×) |
| Cost per correct answer | $0.32 | $0.74 (2.3×) |
| Wins on repos | 14 / 15 | 1 / 15 (django, +3.0) |

Failure decomposition:
- **Coordination breakdown: 41.8%** of agentic failures — absent entirely from indexed
  retrieval. And **in 91% of those cases the agent still produced a fluent, confidently
  worded answer.** The failure is not just frequent; it is *silent*.
- **Non-terminating loops: 13.5%** vs 2.9% for semantic search.
- Longer exploration trajectories correlate with **lower** success — searching harder makes it
  worse, not better.
- **68.8% of tool calls execute inside delegated subagents, invisible to the orchestrator.**

**Backbone dependence.** Gemini 3 Flash showed a 49.6 pt gap between paradigms (89.3% vs
39.7%); Gemini 2.5 Flash only 5.6 pt. Search strategy is a frontier-model capability, and
stronger models widened the advantage of *semantic search*, not of agentic exploration. A
system whose retrieval quality is a function of which model you rent is not a system you own.

**Token economics.** Independent engineering analyses put agent-loop retrieval at $0.02–$0.10
per query against fractions of a cent for indexed lookup, with Anthropic's own multi-agent
research system reported at ~15× the tokens of chat. Milvus's critique ("Why I'm Against
Claude Code's Grep-Only Retrieval? It Just Burns Too Many Tokens") is the canonical
engineering-blog statement of the position; the honest counter-argument in the same debate is
that vector retrieval requires solving chunking, incremental updates, and index scale, which
grep does not.

**The steelman for grep.** It is exact, predictable, needs no index, never goes stale, and
cannot be poisoned by a write path that doesn't exist. Parallel tool calls compress latency
substantially (Relace: 12–24s → 1–2s per turn with 4× parallelism; 8 parallel greps cost
about one grep's latency). For small repos and identifier lookups it is the right answer, and
the LIMIT result (§2.1) says dense retrieval would be worse at exactly the identifier task
grep is best at.

**The structural limit that no amount of parallelism fixes:** grep can only find what is
*written*. It cannot derive an unstated consequence of two written facts. Every multi-hop
question becomes an LLM-mediated exploration loop, which is precisely where coordination
breakdown (41.8%) and non-termination (13.5%) live.

**What a successor must do differently:** keep grep's exactness and freshness; add derivation
so multi-hop does not require an exploration loop; make the search trace observable; bound
cost deterministically rather than by model judgment.

**Unfixable:** no inference, token cost of exploration, backbone dependence, context pollution.
**Mitigable:** latency (parallelism), non-termination (budgets, at recall cost).
**Unengineered:** observability of delegated search.

---

### 2.6 Memory-product platforms (Mem0, Letta, Zep, cognee)

**The benchmark dispute, in full.** This is worth stating precisely because it is the field's
clearest evidence that *no one currently knows which memory system is better*.

1. Zep publishes a blog post ("Lies, Damn Lies, & Statistics: Is Mem0 Really SOTA in Agent
   Memory?") reporting **84%** on LoCoMo and alleging Mem0 misconfigured Zep — wrong user
   model (both speakers assigned the user role), timestamps appended to message text rather
   than passed via `created_at`, and sequential rather than parallel searches inflating
   reported latency. Zep's corrected figure: **75.14% ± 0.17** vs Mem0's reported 65.99%.
2. Mem0's CTO files getzep/zep-papers issue #5 (2025-05-08) alleging Zep's 84% is arithmetically
   wrong: adversarial Category 5 answers were counted in the numerator while excluded from the
   denominator, inflating by **~25.56 pp**; Zep also modified `system_prompt` and the retrieval
   `TEMPLATE` differently from every other baseline; and reported a single run rather than a
   10-run mean. Mem0's re-evaluation: **58.44% ± 0.20**.
3. Mem0 further notes Zep added `created_at` SDK support only on 2025-05-01 — after Mem0's
   paper and after Zep's critique — so the post-hoc fix cannot retroactively justify the
   original numbers.
4. As of 2026 the marketing pages cite **94.7% (Zep)** and **92.5% (Mem0)**, both disputed,
   and independent trackers note that scores above ~93% on LoCoMo are prima facie suspect.

**The benchmark itself is the deeper problem, and Zep says so.** LoCoMo conversations average
16k–26k tokens — inside every modern context window. It contains **no questions testing
knowledge update**, the single most important memory function. Category 5 is unusable (missing
ground truth). There is documented speaker misattribution, multimodal errors, and ambiguous
questions with multiple correct answers. And **Mem0's own published numbers show a plain
full-context baseline (~73% J) beating Mem0's best configuration (~68%)** — the benchmark
cannot demonstrate that a memory system beats not having one.

LoCoMo-Plus (arXiv 2602.10715) adds two systematic distortions to the list: **task-disclosure
bias** (telling the evaluator the task type inflates temporal/adversarial scores) and **length
bias** in BLEU/ROUGE/F1 (scores peak near mean ground-truth length). On its cognitive
extension, GPT-4o falls from 62.99% to 41.94% (−21.05 pp), and Mem0 / SeCom / A-Mem converge
toward "uniformly low performance when implicit constraint preservation is required" — i.e.
the differences between products vanish once the task stops being surface recall.

**Write quality is unmeasured.** MEMAUDIT (arXiv 2605.02199) is the paper that names this
gap. Evaluated against a package-oracle, greedy writers achieve only **60–85%** of optimal
coverage, and some retain **<50%** of recoverable facts at standard budgets. Named write
failure modes: redundancy, recency bias, shallow coverage, budget exhaustion, cold-start
compounding. *When Not to Write Memory* (arXiv 2607.02579) adds **false promotion**: correlated
traces treated as independent confirmations, inflating confidence in unreliable memories and
degrading AUPRC.

**ADD-only drift, with issue numbers.** Mem0's public tracker documents the failure directly:
- #5867 — ADD-only extraction stores "favorite player is Ronaldo" and "current favorite is
  Messi" as two independent memories with no supersession.
- #4896 — ADD-only architecture implements no conflict resolution for semantically similar
  memories.
- #4787 — hash-based dedup catches exact duplicates only, not semantic duplicates or
  contradictions.
- #6515 / #6531 — TOCTOU race in `add()`: concurrent calls extracting the same fact create a
  permanent duplicate with "no error, warning, or user-visible signal."

The newer `linked_memory_ids` path relates old and new memories rather than collapsing them
to a canonical row — which preserves history but pushes the supersession decision back onto
the reader.

**Backbone-dependent silent corruption.** *Anatomy of Agentic Memory* (arXiv 2602.19320)
measures structured-output format error rates during memory operations: gpt-4o-mini/Nemori
**17.91%**, Qwen-2.5-3B/Nemori **30.38%**, Qwen-2.5-3B/SimpleMem 4.82%. Weaker models emit
invalid structure that corrupts long-term memory while still producing fluent short-term
responses — the corruption is invisible in the conversation. Graph-based and episodic
architectures are the most sensitive.

**The agency tax.** Same paper, Table 5: per-turn latency of full-context 1.726s, SimpleMem
1.057s, MAGMA 1.462s, **MemoryOS 32.372s**. Construction cost: **A-Mem 15 hours**
(super-linear); Nemori **7.04M tokens** vs SimpleMem's 1.3M. The paper's warning is that the
maintenance phase is a hidden scalability constraint that can collapse throughput as updates
fall behind interactions.

**Vendor and portability risk (2025–2026 casualties).**
- Zep **Community Edition retired (2025)** — full-featured self-hosting removed; Zep Cloud or
  build on Graphiti yourself.
- MemGPT → **Letta** re-platforming; Letta is a full runtime, so migrating away means
  rewriting the agent loop, tool execution, state management and memory access — a much
  larger commitment than a memory *layer*.
- Letta local mode: compaction and sleep-time reflection can require provider timeouts up to
  **600s** on commodity hardware.
- Letta's own admission: sleep-time compute pays off mainly when queries are predictable.
- Sector base rate: ~14,000 AI startups launched 2024; 3,800 shut in 2025 (27%); 1,800 more in
  early 2026 (13%) — ~40% failure inside 24 months.
- Shutdowns have destroyed memory stores with no export path (China's April 2026 Interim
  Measures triggered companion-app shutdowns; Doubao gave a limited save window, Qwen offered
  no migration path).

**What a successor must do differently:** measure the write policy, not just the read policy;
make supersession a schema property rather than a reader's inference; make writes transactional;
never let a weak model's free-text output become the storage format; own the store locally.

**Unfixable:** vendor risk, framework lock-in, the contaminated benchmark literature.
**Unengineered:** write-quality measurement, supersession semantics, transactional writes,
validated write schemas.

---

## 3. Cross-cutting gaps — the novelty-opportunity list

These are the failures **no current approach solves well**. Each is a defensible contribution
claim for a successor design, ordered roughly by (evidence strength × absence of solutions).

### G1. Supersession and invalidation of knowledge
Nobody has a mechanism. Flat files have no notion of a fact being replaced. Vector stores
score stale and fresh identically (cosine has no time dimension). ADD-only products store both
versions (mem0 #5867, #4896). GraphRAG must rebuild. Only temporal KGs model it — and they
delegate the decision to an LLM, which is measurably the wrong choice: deterministic
`max(serial)` beats LLM judgment by **+10.8 pp average, +21 pp at 262K tokens**, with two
named LLM failure modes (**prior-override**, **serial-comparison drift**) that the authors
argue are structural rather than promptable (arXiv 2606.01435). Multi-agent formalization calls
the append-only version **contradiction persistence** (arXiv 2606.24535).
**Claim available:** deterministic, structural supersession with no LLM in the decision path.

### G2. Conflicting-memory resolution
Measured and broken. GPT-4o memory agents reach only **60% on single-hop conflict resolution**
(MemoryAgentBench, arXiv 2507.05257). On Fact Consolidation, *every* evaluated system
substantially underperforms **even when explicitly told** that newer facts have larger serial
numbers. Most production memory systems "have no resolution policy and retrieve whichever fact
surfaces first in the similarity search." Recency-wins is the common heuristic and is wrong
for stable attributes that get re-asserted incorrectly.
**Claim available:** a declared, inspectable resolution policy (recency / source-trust /
confidence) evaluated as a first-class component.

### G3. Provenance-carrying answers and verifiability
**Provenance collapse** is a named failure mode (arXiv 2606.24535): retrieved memories cannot
be traced to origin, undermining debugging, auditability and governance. Eywa (arXiv 2605.30771)
documents the consequences — hallucination propagation with no way to distinguish verified
from repeatedly-recalled-incorrect facts; untraced belief updates; loss of the original context
needed to re-assess validity when circumstances change. The multi-agent evaluation shows it *is*
buildable: 50 depth-four derivation chains reconstructed with correct writer identity at
p50 ≈ 291ms per hop. Nobody ships it as a default.
**Claim available:** every answer carries a machine-checkable derivation chain to source.

### G4. Deterministic multi-hop derivation
Every approach hopes rather than derives. Vector RAG under-retrieves multi-hop by construction
(65.8% answer-entity coverage). GraphRAG's traversal inherits extraction errors and its global
summaries lose the fine detail multi-hop needs. Agentic search cannot infer at all — it finds
only what is written — and pays 41.8% coordination breakdown and 13.5% non-termination to
simulate inference through exploration, with 91% of coordination failures returning a
confident wrong answer. Knowledge-editing research is the parallel warning: direct edits reach
>90% accuracy but **ripple-effect success rarely exceeds 50%**, because propagating a change
through its logical consequences is the hard part, not making the change.
**Claim available:** derivation as a query, not as an agent loop — fixed cost, terminating,
inspectable.

### G5. Write policies evaluated as rigorously as read policies
The largest measurement vacuum. MEMAUDIT (arXiv 2605.02199) shows greedy writers reach only
**60–85%** of package-optimal coverage and some retain **<50%** of recoverable facts at
standard budgets, with five named write failure modes (redundancy, recency bias, shallow
coverage, budget exhaustion, cold-start compounding). *When Not to Write Memory* (arXiv
2607.02579) adds **false promotion** from correlated traces. The survey literature confirms
filtering thresholds are heuristic with "no framework to determine safe recall–precision
trade-offs per domain" (arXiv 2603.07670). Meanwhile write-side corruption is measurable and
ignored: **17.91%–30.38%** structured-output format error rates on weaker backbones silently
poisoning long-term memory (arXiv 2602.19320).
**Claim available:** an evaluated, budgeted, schema-validated write policy — with a rejection
path.

### G6. Deliberate forgetting
"Only MemoryAgentBench tests selective forgetting explicitly. Yet in any long-running
deployment, the inability to discard outdated information gradually poisons retrieval
precision" (arXiv 2603.07670). *Always-On Agents* (arXiv 2606.30306) adds the propagation
requirement: a forget request must reach every derived tier or it is "only a retrieval edit."
GraphRAG deletion leaves orphaned edges that leak what was deleted. The SSGM taxonomy lists
**index bloat** and **capacity-driven forgetting** as distinct efficiency failures — the
system forgets by accident, under pressure, rather than by policy.
**Claim available:** deletion that propagates through derivations, with tombstones and an
audit trail.

### G7. Multi-agent shared-memory consistency
Four named failure modes with no shipped solution (arXiv 2606.24535): **unauthorized leakage**
(scope violations), **stale propagation** (one agent updates state another keeps reading
stale), **contradiction persistence**, **provenance collapse**. The file-based version is worse:
concurrent edits to a single CLAUDE.md/plan file produce duplicate strikes, stale reads and
overwritten changes with no error. Cognition's *Don't Build Multi-Agents* is the strongest
practitioner statement — parallel sub-agents are fragile because context cannot be shared
thoroughly enough, and they note that "no one is putting dedicated effort into solving this
difficult cross-agent context-passing problem."
**Claim available:** a transactional shared store with scopes, supersession, and writer identity.

### G8. Agent-centric (not chat-recall) benchmarks
The benchmarks the field optimizes against measure the wrong thing. LoCoMo fits in a context
window, has no knowledge-update questions, and is beaten by a no-memory baseline on Mem0's own
numbers. MemoryArena (arXiv 2602.16313) makes the gap explicit: **models near-perfect on LoCoMo
drop to 40–60%** when later subtasks depend on what was learned earlier — passive recall vs
active, decision-relevant use. LoCoMo-Plus documents task-disclosure and length bias in the
standard protocol. The horizon is wrong too: most papers evaluate 10–50 sessions against
production agents running thousands over months (arXiv 2603.07670).
**Claim available:** evaluate on decision-relevant use over a realistic horizon; report the
**Context Saturation Gap (Δ)** vs a full-context baseline, and refuse to claim value when Δ ≈ 0.

### G9. Observability and replay
"Memory operation logging, replay tools, and regression testing for memory behavior are rarely
discussed in research papers, yet essential for reliable production deployments" (arXiv
2603.07670). Agentic search hides **68.8%** of its tool calls inside subagents. Mem0's duplicate
race is silent by design. Nothing in the landscape lets you replay a memory decision.
**Claim available:** memory as an auditable log, replayable and regression-testable.

### G10. Cumulative error containment
SSGM's central observation (arXiv 2603.11768): "unlike static RAG systems where errors are
isolated, errors in evolving memory systems are **cumulative and persistent**," compounding
across ingestion (poisoning) → consolidation (drift) → retrieval (hallucination). Named
component failures: **semantic drift** (mild preference intensified by repeated rewriting into
a preference violation), **procedural drift** (a convoluted workaround rigidifies into the
learned way), **goal/role drift**, **memory hallucination**, **memory poisoning**. Related:
**reflective entrenchment** — an agent that once concluded "API X always errors with parameter
Y" avoids that path forever, with no confidence gating on over-generalization.
**Claim available:** every stored belief is defeasible, dated, sourced, and revocable.

---

## 4. The critical literature — steelmanned both ways

### 4.1 "Agent memory is over-engineered / under-evidenced"

**The case for.** The strongest single fact is that on the field's own flagship benchmark, a
plain full-context baseline (~73% J) beats Mem0's best configuration (~68%) — from Mem0's own
paper. *Anatomy of Agentic Memory* (arXiv 2602.19320) generalizes it: most benchmarks are
underscaled relative to modern context windows (HotpotQA ~1k tokens: "trivial for context
window"; MemBench ~100k: "fits in 128k window"; only LongMemEval-M at >1M tokens has low
saturation risk). The paper proposes a **Context Saturation Gap (Δ)** — the difference between
a memory system and a full-context baseline — and argues meaningful evaluation requires Δ ≫ 0,
which most published results do not establish.

The cost side reinforces it: MemoryOS at 32.4s per turn against 1.7s for full context;
A-Mem's 15-hour construction; Nemori's 7.04M tokens. And the accuracy side is judge-dependent:
lexical metrics rank systems differently from semantic judges (AMem ranks 5th by F1, 4th
semantically; SimpleMem 4th by F1, 5th semantically), with **paraphrase penalty** and
**negation trap** as named metric failures. Anthropic's own 2026 coding-trends observation is
that most teams don't come close to filling the context window — the bottleneck is *selection*,
not capacity.

**The case against (steelman).** Saturation is a property of *today's* benchmarks, not of the
problem. Real deployments run thousands of sessions over months; nothing fits. MemoryArena's
40–60% collapse shows that when memory must actually drive decisions, everything degrades —
including full context. Context rot means "just use a bigger window" degrades as you use it.
And the cost argument runs the other way at scale: re-reading a full history every turn is
O(n) per turn and O(n²) over a session. The honest synthesis is that *memory systems are
under-evidenced, not unnecessary* — the field has been unable to demonstrate its own value
because it chose benchmarks that cannot show it.

### 4.2 "RAG is dead / long context kills RAG"

**For.** Frontier models accept enormous inputs; naive chunk-and-hope RAG is strictly worse
than putting the documents in the window; and every RAG pipeline is an operational burden
(chunking, embedding versioning, index rebuilds, hybrid fusion tuning) that the window makes
unnecessary. Claude Code shipping without RAG is the existence proof that a top-tier coding
agent doesn't need a vector database.

**Against.** Cost and latency are order-of-magnitude arguments, not preferences: reported
figures put RAG around $0.00008/query and ~1s against long context around $0.10/query and ~45s
— roughly 1,250× cheaper and dramatically faster. LaRA (2,326 test cases, 4 QA task types, 3
long-context types, 11 models) concludes there is no silver bullet and the answer depends on
model, context size, task type and retrieval characteristics. RAG framework usage reportedly
grew ~400% from 2024 to 2026 with ~60% of production LLM apps still using retrieval. And
context rot means a filled window is not a usable window.

**Where both are right, and what it means for a successor.** The consensus position — "the
naive version is dying; retrieval decides what deserves attention, long context gives room to
think" — is correct and incomplete, because it still frames the choice as *which text to
paste*. Both sides assume the memory system's job is **selection**. Neither side offers
**derivation**. G4 sits precisely in the space neither camp occupies.

### 4.3 "Grep is all you need" vs "grep burns tokens"

**For grep.** Exact, predictable, zero index, never stale, no write path to poison. The LIMIT
result says dense retrieval is *worst* at exactly the identifier lookups grep is best at.
Parallelism largely erases the latency objection (12–24s → 1–2s per turn at 4×; 8 parallel
greps ≈ one grep's latency).

**Against grep.** arXiv 2608.01507 measures it at repo scale: 46.2% vs 65.2% pass rate, 22×
input tokens, 2.3× cost per correct answer, losing on 14 of 15 repos, with 41.8% coordination
breakdown of which 91% return a confident wrong answer. Milvus's engineering critique makes
the same point economically. And Deep Agentic's advantage *shrinks* as models get stronger —
stronger backbones widened semantic search's lead.

**The synthesis a successor should take.** Grep's virtues are freshness, exactness and zero
write cost. Its ceiling is that it cannot infer. The right target is not "index vs grep" but
"exact lookup + deterministic derivation," which keeps grep's freshness properties while
removing the exploration loop that produces 41.8% + 13.5% of its failures.

### 4.4 "GraphRAG works"

**For.** On multi-hop, reasoning-intensive questions with clear entity structure, local
community search does beat naive RAG (HotpotQA F1 63.01%; MultiHop-RAG 69.01% vs 67.02%).
Explicit relationships improve logical consistency.

**Against.** arXiv 2506.06331 is close to dispositive on the *reported* magnitude: LightRAG
72% → 39% after debiasing; best method's advantage below 10 pts; "gains become much more
moderate or even vanish." Add 65.8% answer-entity coverage, 57× construction cost, community
summaries that hurt detail-centric QA, and extractor-model dependence, and the honest reading
is: GraphRAG's *structure* is right and its *construction method* (one-shot LLM extraction,
regenerated summaries, full rebuilds) is the failure. A successor that keeps the relational
structure while replacing LLM extraction with deterministic, incrementally-maintained
derivation is attacking the part that is actually broken.

---

## 5. Consolidated fixability verdict

**Fundamentally unfixable (change substrate or accept):**
context rot and lost-in-the-middle (attention architecture); the single-vector dimensional
ceiling (proved); similarity ≠ relevance; retrieval-state lock-in; extraction error
compounding as sole representation; community-summary lossiness; LLM prior-override in
invalidation decisions; agentic search's inability to infer; token economics of exploration
loops; backbone dependence of search skill; vendor risk of hosted memory.

**Merely unengineered (buildable, and where a contribution is defensible):**
deterministic supersession and invalidation; conflict-resolution policy as a declared,
evaluated component; provenance-carrying derivation chains; deterministic multi-hop
derivation; write-policy evaluation and budgeted, schema-validated writes; deliberate
forgetting that propagates through derivations; transactional multi-agent shared memory with
scopes and writer identity; agent-centric benchmarks reporting a Context Saturation Gap;
memory observability and replay; incremental maintenance of derived layers.

**The one-line reading.** The unfixable failures are all in *statistical* retrieval and
*LLM-judged* bookkeeping. The unengineered failures are all things a database with rules,
provenance and transactions has done for decades. A successor's defensible thesis is: keep the
LLM for language, and take the bookkeeping — supersession, derivation, provenance, deletion,
consistency — away from it.

---

## 6. Sources

**Long context / context rot**
- Chroma Research, *Context Rot: How Increasing Input Tokens Impacts LLM Performance* (Jul 2025) — https://www.trychroma.com/research/context-rot
- Liu et al., *Lost in the Middle: How Language Models Use Long Contexts* — https://cs.stanford.edu/~nfliu/papers/lost-in-the-middle.arxiv2023.pdf
- *Lost in the Middle: An Emergent Property from Information Retrieval Demands in LLMs* — https://arxiv.org/html/2510.10276v1
- *Lost in the Middle, and In-Between: Multi-Hop QA over Long Contexts* — https://arxiv.org/pdf/2412.10079

**Curated-context / regeneration failures**
- *Agentic Context Engineering: Evolving Contexts for Self-Improving Language Models* (ACE), arXiv 2510.04618 — https://arxiv.org/abs/2510.04618
- VentureBeat, *ACE prevents context collapse with 'evolving playbooks'* — https://venturebeat.com/ai/ace-prevents-context-collapse-with-evolving-playbooks-for-self-improving-ai
- Unblocked, *How to Audit a Bloated CLAUDE.md File* — https://getunblocked.com/blog/audit-fix-bloated-claude-md/
- Augment Code, *Your agent's context is a junk drawer* — https://www.augmentcode.com/blog/your-agents-context-is-a-junk-drawer

**Vector RAG limits**
- Weller, Boratko, Naim, Lee (DeepMind), *On the Theoretical Limitations of Embedding-Based Retrieval*, arXiv 2508.21038 — https://arxiv.org/pdf/2508.21038 ; benchmark: https://github.com/google-deepmind/limit
- *Drift-Adapter: Near Zero-Downtime Embedding Model Upgrades in Vector Databases*, arXiv 2509.23471 — https://arxiv.org/abs/2509.23471
- *When Confidence Takes the Wrong Path: Diagnosing Retrieval-State Lock-In in RAG*, arXiv 2606.22728 — https://arxiv.org/abs/2606.22728
- *Trust or Abstain? A Self-Aware RAG Approach*, arXiv 2605.18792 — https://arxiv.org/pdf/2605.18792
- *From BM25 to Corrective RAG: Benchmarking Retrieval Strategies for Text-and-Table Documents*, arXiv 2604.01733 — https://arxiv.org/html/2604.01733v1
- AAAI 2026 note on retrieval-induced over-refusal — https://www.bohrium.com/en/blog/research-notes/aaai-2026-retrieval-augmented-models-dont-know/

**Poisoning**
- *AgentPoison: Red-teaming LLM Agents via Poisoning Memory or Knowledge Bases*, arXiv 2407.12784 (NeurIPS 2024) — https://arxiv.org/abs/2407.12784
- PoisonedRAG (knowledge corruption attack on RAG) — summarized in the above and in https://arxiv.org/pdf/2605.05632
- *From Untrusted Input to Trusted Memory: A Systematic Study of Memory Poisoning Attacks in LLM Agents*, arXiv 2606.04329 — https://arxiv.org/pdf/2606.04329

**GraphRAG critiques**
- *How Significant Are the Real Performance Gains? An Unbiased Evaluation Framework for GraphRAG*, arXiv 2506.06331 — https://arxiv.org/html/2506.06331v1
- *RAG vs. GraphRAG: A Systematic Evaluation and Key Insights*, arXiv 2502.11371v3 — https://arxiv.org/html/2502.11371v3
- microsoft/graphrag incremental indexing — https://github.com/microsoft/graphrag/issues/741 ; https://github.com/microsoft/graphrag/discussions/511
- *Knowledge Graph Construction: Extraction, Learning, and Evaluation*, Applied Sciences 15(7):3727 — https://www.mdpi.com/2076-3417/15/7/3727
- *Analyzing Bias in LLM-Augmented Knowledge Graph Systems*, Applied Sciences 16(7):3410 — https://www.mdpi.com/2076-3417/16/7/3410
- *iText2KG: Incremental Knowledge Graphs Construction Using LLMs*, arXiv 2409.03284 — https://arxiv.org/pdf/2409.03284
- *Limitations of GraphRAG and the Emergence of LightRAG* — https://zenn.dev/knowledge_graph/articles/graphrag-light-rag-2025-10?locale=en

**Temporal KG / invalidation**
- *Don't Ask the LLM to Track Freshness: A Deterministic Recipe for Memory Conflict Resolution*, arXiv 2606.01435 — https://arxiv.org/html/2606.01435v1
- Zep, *What Is a Temporal Knowledge Graph?* — https://www.getzep.com/ai-agents/temporal-knowledge-graph/
- Neo4j, *Graphiti: Knowledge graph memory for an agentic world* — https://neo4j.com/blog/developer/graphiti-knowledge-graph-memory/
- D. Vaughan, *Graphiti: Should the Knowledge Flywheel Use It?* — https://codex.danielvaughan.com/2026/03/30/graphiti-agent-memory-store/

**Agentic search**
- *Deep Agentic Search for Repository-Level Code Question Answering: An Empirical Study*, arXiv 2608.01507 — https://arxiv.org/html/2608.01507v1
- Milvus, *Why I'm Against Claude Code's Grep-Only Retrieval? It Just Burns Too Many Tokens* — https://milvus.io/blog/why-im-against-claude-codes-grep-only-retrieval-it-just-burns-too-many-tokens.md (HN discussion: https://news.ycombinator.com/item?id=45041502)
- LlamaIndex, *grep vs. RAG: Choosing the Right Search Strategy for AI Agents* — https://www.llamaindex.ai/blog/is-grep-all-you-need-lexical-vs-sematic-search-for-agents
- HarrisonSec, *Agent Retrieval Is a Cost Curve Problem: Why Claude Code Doesn't Use RAG* — https://harrisonsec.com/blog/agent-retrieval-cost-curve-claude-code-grep-vs-rag/
- Relace, *Exploiting parallel tool calls to make agentic search 4x faster* — https://relace.ai/blog/fast-agentic-search
- *RAVine: Reality-Aligned Evaluation for Agentic Search*, arXiv 2507.16725 — https://arxiv.org/pdf/2507.16725

**Benchmark dispute (Zep vs Mem0)**
- getzep/zep-papers issue #5, *Revisiting Zep's 84% LoCoMo Claim: Corrected Evaluation & 58.44% Accuracy* (2025-05-08) — https://github.com/getzep/zep-papers/issues/5
- Zep, *Lies, Damn Lies, & Statistics: Is Mem0 Really SOTA in Agent Memory?* — https://blog.getzep.com/lies-damn-lies-statistics-is-mem0-really-sota-in-agent-memory/
- Mem0, *Building Production-Ready AI Agents with Scalable Long-Term Memory*, arXiv 2504.19413 — https://arxiv.org/html/2504.19413v1
- LoCoMo original — https://snap-research.github.io/locomo/
- *LoCoMo-Plus: Beyond-Factual Cognitive Memory Evaluation Framework for LLM Agents*, arXiv 2602.10715 — https://arxiv.org/html/2602.10715v1
- Penfield Labs, *Proposal: A Real Benchmark for Long-Term AI Memory Systems* — https://penfieldlabs.substack.com/p/proposal-a-new-benchmark-for-long
- *The AI-memory benchmark everyone quotes forbids saying "I don't know"* — https://dev.to/gde03/the-ai-memory-benchmark-everyone-quotes-forbids-saying-i-dont-know-o1n

**Memory-system limitations and taxonomies**
- *Anatomy of Agentic Memory: Taxonomy and Empirical Analysis of Evaluation and System Limitations*, arXiv 2602.19320 — https://arxiv.org/html/2602.19320v1
- *Governing Evolving Memory in LLM Agents: Risks, Mechanisms, and the SSGM Framework*, arXiv 2603.11768 — https://arxiv.org/html/2603.11768v1
- *Memory for Autonomous LLM Agents: Mechanisms, Evaluation, and Emerging Frontiers*, arXiv 2603.07670 — https://arxiv.org/html/2603.07670v1
- *Rethinking Memory Mechanisms of Foundation Agents in the Second Half: A Survey*, arXiv 2602.06052 — https://arxiv.org/pdf/2602.06052
- Microsoft Security, *Updating the taxonomy of failure modes in agentic AI systems* (Jun 2026) — https://www.microsoft.com/en-us/security/blog/2026/06/04/updating-taxonomy-failure-modes-agentic-ai-systems-year-red-teaming-taught-us/

**Write policy, provenance, forgetting, multi-agent**
- *MEMAUDIT: An Exact Package-Oracle Evaluation Protocol for Budgeted Long-Term LLM Memory Writing*, arXiv 2605.02199 — https://arxiv.org/pdf/2605.02199
- *When Not to Write Memory: Governing False Promotion from Correlated Agent Traces*, arXiv 2607.02579 — https://arxiv.org/pdf/2607.02579
- *Eywa: Provenance-Grounded Long-Term Memory for AI Agents*, arXiv 2605.30771 — https://arxiv.org/pdf/2605.30771
- *Governed Shared Memory for Multi-Agent LLM Systems*, arXiv 2606.24535 — https://arxiv.org/html/2606.24535v1
- *GateMem: Benchmarking Memory Governance in Multi-Principal Shared-Memory Agents*, arXiv 2606.18829 — https://arxiv.org/pdf/2606.18829
- *Always-On Agents: A Survey of Persistent Memory, State, and Governance in LLM Agents*, arXiv 2606.30306 — https://arxiv.org/pdf/2606.30306
- *Agentic Unlearning: When LLM Agent Meets Machine Unlearning*, arXiv 2602.17692 — https://arxiv.org/html/2602.17692v1
- Cognition, *Don't Build Multi-Agents* — https://cognition.com/blog/dont-build-multi-agents

**Benchmarks**
- *Evaluating Memory in LLM Agents via Incremental Multi-Turn Interactions* (MemoryAgentBench), arXiv 2507.05257, ICLR 2026 — https://arxiv.org/abs/2507.05257 ; https://github.com/HUST-AI-HYZ/MemoryAgentBench
- *MemoryArena: Benchmarking Agent Memory in Interdependent Multi-Session Agentic Tasks*, arXiv 2602.16313 — https://memoryarena.github.io/
- Label Studio, *How to evaluate agent memory* — https://labelstud.io/learningcenter/how-to-evaluate-agent-memory/

**Product/vendor evidence**
- mem0ai/mem0 issue #5867 (ADD-only creates conflicting memories) — https://github.com/mem0ai/mem0/issues/5867
- mem0ai/mem0 issue #4896 (no conflict resolution for semantically similar memories) — https://github.com/mem0ai/mem0/issues/4896
- mem0ai/mem0 discussion #4787 (dedup & contradiction at scale) — https://github.com/mem0ai/mem0/discussions/4787
- mem0ai/mem0 issues #6515 / #6531 (hash-dedup TOCTOU race → silent duplicates) — https://github.com/mem0ai/mem0/issues/6515
- Letta, *Sleep-time Compute* — https://www.letta.com/blog/sleep-time-compute/
- Letta, *Rearchitecting Letta's Agent Loop* — https://www.letta.com/blog/letta-v1-agent/
- Zep Community Edition deprecation / self-host removal — https://help.getzep.com/graphiti/getting-started/overview ; corroborated in https://www.cognee.ai/blog/guides/open-source-memory-frameworks-llm-agents
- MemX, *If Your AI Shuts Down, Do Your Memories Die?* — https://memx.app/blog/if-your-ai-shuts-down-do-memories-die/
- IdeaProof, *AI startups that failed 2023–2026* — https://ideaproof.io/failures/ai-startups

**Knowledge editing (supersession analogue)**
- *Evaluating the Ripple Effects of Knowledge Editing in Language Models*, TACL — https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00644/120576/
- *Why Does New Knowledge Create Messy Ripple Effects in LLMs?*, arXiv 2407.12828 — https://arxiv.org/pdf/2407.12828
- *ChainEdit: Propagating Ripple Effects in LLM Knowledge Editing through Logical Rule-Guided Chains*, arXiv 2507.08427 — https://arxiv.org/pdf/2507.08427

**"RAG is dead" debate**
- LightOn, *RAG is Dead, Long Live RAG: Retrieval in the Age of Agents* — https://lighton.ai/lighton-blogs/rag-is-dead-long-live-rag-retrieval-in-the-age-of-agents
- AkitaOnRails, *Is RAG Dead? Long Context, Grep, and the End of the Mandatory Vector DB* — https://akitaonrails.com/en/2026/04/06/rag-is-dead-long-context/
- byteiota, *RAG vs Long Context 2026* — https://byteiota.com/rag-vs-long-context-2026-retrieval-debate/

---

## 7. Evidence-quality caveats

- **The Zep/Mem0 numbers are unresolved.** Cite the dispute, never a side's figure as fact.
- **Graphiti's 600k-token footprint is contested** and not independently reproduced.
- **Vendor blogs (Zep, Mem0, Letta, Milvus, LightOn) are interested parties.** They are cited
  here where they are the disputed artifact or where they concede against their own interest
  (e.g. Zep documenting LoCoMo's defects, Letta documenting sleep-time compute's narrow
  applicability) — those concessions are the strongest form of vendor evidence.
- **The GraphRAG debiasing result (arXiv 2506.06331) is a single study** and deserves its own
  replication, but its methodology (position/length/trial bias) is mechanically checkable and
  its findings are consistent with the independent RAG-vs-GraphRAG evaluation.
- **arXiv preprints from 2026 cited above are largely unrefereed.** Where a claim rests on a
  single 2026 preprint (MEMAUDIT's 60–85% figure, false promotion's AUPRC result, MemoryArena's
  40–60%), treat the *direction* as reliable and the *magnitude* as provisional.
