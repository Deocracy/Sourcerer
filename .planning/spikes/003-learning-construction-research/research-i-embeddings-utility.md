# Are Embeddings Actually Useful in a Symbolic/Structured Agent-Memory System?

**Research spike 003-I** — evidence for and against, not advocacy
**Date:** 2026-08-21
**Scope:** A Datalog-family memory store of 100–1000 curated "learnings" (decision/lesson/pattern; each with rationale, trigger condition, provenance to decision-IDs and code symbols).

---

## Executive summary

The prior research proposed "an embedding sidecar on write and query paths" as the standard fix for exact-equality joins failing on near-miss naming. The 2024–2026 literature does not support that fix for this corpus shape. The strongest single finding: **embedding-cosine similarity measures how much the *wording* changed, not whether the *meaning* held** — and for curated rule/trigger text, those two quantities are *anti-correlated*, because a reversal is a one-word edit while a faithful restatement replaces every word.

Three roles were proposed for embeddings. The evidence supports **one, partially** (entity/alias resolution as a *candidate generator only*), and argues against the other two (dedup — lexical wins; task→trigger matching — the failure is structural, not tunable).

---

## 1. The core structural argument against embeddings here

### 1.1 Frias 2026 — the most directly applicable evidence in the literature

[Similarity Gates Approve Reversals: A Validity Audit of Embedding-Cosine Thresholds in Agent Systems](https://arxiv.org/abs/2608.10216) (arXiv:2608.10216, submitted 2026-08-10) audits exactly the gate class proposed here — **deduplication filters, semantic caches, drift guards, and answer-grader gates** — as a measurement instrument.

| Finding | Number |
|---|---|
| Meaning-breaking mutations caught by the audited production drift guard | **0 of 56** |
| Cosine of `"withhold the study drug…"` → `"Administer the study drug…"` | **0.9608** (firing line: 0.60) |
| Range of all 56 mutation cosines | **0.832 – 0.9997** — threshold unreachable *by construction* |
| Faithful controls the guard fired on | **0 of 15** (cosines 0.869–0.993) — it approved everything |
| Best balanced accuracy across 90 config×threshold×task cells | **never exceeded 0.700; median 0.525** (chance = 0.5) |
| Best balanced accuracy in the deployed direction, *tuned on the test data itself* | **0.573 in-sample / 0.550 held-out** |
| Decision AUROC under a naively-built (unstratified) corpus | **exactly 0.000 in 13 of 18 cells**; ≤0.040 in all 18 |
| Decision AUROC under overlap-stratified evaluation | 0.440–0.815; production config **0.535 / 0.440** |

**Per mutation class** (AUROC, in-sample / held-out) — note the worst classes are the operationally dangerous ones:

| Mutation class | AUROC | Relevance to a learnings store |
|---|---|---|
| Modal downgrade (`must` → `should`) | **0.000 / 0.125** | "never do X" → "prefer not to do X" — a real supersession |
| Quantity/unit drift | 0.160 / 0.067 | thresholds in trigger conditions |
| Constraint deletion | 0.480 / 0.467 | a dropped precondition on a trigger |
| Negation | 0.433 / 0.442 | the class folklore blames — *not even the worst* |

**The mechanism** (§3 of the paper, and this is why it does not tune away): negation and its relatives (scope inversion, modal weakening, quantity change) are **additive/minimal edits** — they insert or swap a token and keep the rest. A faithful restatement is **substitutive** — it replaces tokens. Measured: the natural reversal sits at token-Jaccard **≈0.72** with its anchor; the faithful full rewrite sits at **≈0.06**. Horn (1989) is cited for why this is linguistic before it is statistical — negation is the *marked* member of the affirmative–negative pair, expressed by operating on an affirmative base rather than by composing a fresh sentence. **It is a property of how people write, not an artifact of one corpus.**

Attempted repairs that failed: an **encoder swap** and an **overlap-conditioned gate** (0.750 in-sample → **0.533 held-out**, i.e. chance on separately-authored data).

> Critical methodological warning for anyone benchmarking this themselves: a hand-authored eval corpus **inherits the same confounder and returns an inverted verdict** (AUROC 0.000). The paper's own first hand-authored corpus failed its manipulation check (within-stratum overlap 0.721 vs 0.520, permutation p=0.014). If you test an embedding dedup gate on pairs you wrote by hand, you will likely measure the opposite of the truth.

*Limitations, stated by the author (§10):* small factorial corpus (10 pairs/cell, most per-stratum CIs touch chance); single-annotator labels; one end-to-end deployed system; one project's register; adversarial review was by LLM agents, not independent humans; no human replication yet. The field-level claim the data support is the direction and mechanism, not the precise cell values.

### 1.2 Negation blindness — corroborating literature

- [Enhancing Negation Awareness in Universal Text Embeddings](https://arxiv.org/abs/2504.00584) (arXiv:2504.00584): binned STS-B by human-annotated similarity into five groups and compared `Sim(S1,S2)` against `Sim(S1, neg(S1))`. Finding: "a significant lack of negation awareness in these models, often interpreting negated text pairs as semantically similar." Across models tested, **average cosine for the negation and antonym subsets exceeded the average cosine of the genuinely-highly-similar subset** — reported in the 0.93–0.999 band.
- [Learning Robust Negation Text Representations](https://arxiv.org/pdf/2507.12782) (Truong, Verspoor, Cohn, Baldwin, 2025) — negation- and hedging-robust training data exists ([jina negation-dataset-v2](https://hf.co/datasets/jinaai/negation-dataset-v2)), which is itself the admission that stock embedders lack it. Note Frias found modal downgrade (hedging) was the *worst* class even though it is an explicit target of this training data.
- [Semantics at an Angle: When Cosine Similarity Works Until It Doesn't](https://arxiv.org/pdf/2504.16318) — general treatment of cosine's validity limits.
- [Revealing the Blind Spot of Sentence Encoder Evaluation by HEROS](https://arxiv.org/pdf/2306.05083) — the negation/antonym blind spot is invisible to standard STS evaluation.

**Implication for this design:** a learnings corpus is *made of* modal-strength and polarity distinctions. `"Always pin the ESR tag"` vs `"Never pin the ESR tag"`; `"prefer X"` vs `"require X"`. These are the *exact* pairs cosine cannot separate, and the pairs a supersession/dedup mechanism most needs to separate correctly.

### 1.3 Calibration — cosine is not a probability

Frias observed five *shipped* operating points across frameworks, i.e. no agreed threshold exists. Thresholds do not transfer across encoders, corpora, or text registers; the in-sample→held-out collapse of the overlap-conditioned gate (0.750→0.533) is the concrete demonstration. Any fixed cutoff (`0.85`, `0.9`) in a design doc is an unvalidated free parameter, not a calibrated decision boundary.

---

## 2. Exact identifiers — quantified

The corpus carries provenance to **decision-IDs and code symbols**. This is dense retrieval's documented worst case.

### 2.1 EntityQuestions — the canonical measurement

[Simple Entity-Centric Questions Challenge Dense Retrievers](https://aclanthology.org/2021.emnlp-main.496.pdf) (Sciavolino, Zhong, Lee, Chen; EMNLP 2021) established that DPR "significantly underperforms BM25" on simple entity-centric questions, with performance robust for head entities and **degrading quickly for tail entities**.

| Source study | Metric | DPR (dense) | BM25 (lexical) | Gap |
|---|---|---|---|---|
| SPAR ([arXiv:2110.06918](https://arxiv.org/pdf/2110.06918)) | Acc@20 | 56.6% | **70.8%** | **−14.2 pts** |
| SPAR | Acc@100 | 70.1% | **79.2%** | −9.1 pts |
| Zero-shot QGen ([arXiv:2204.07496](https://arxiv.org/pdf/2204.07496)) | Top-20 | 51.1% | **71.2%** | **−20.1 pts** |
| Zero-shot QGen | Top-100 | 63.8% | **79.8%** | −16.0 pts |
| BM25 Query Augmentation ([arXiv:2305.14087](https://arxiv.org/pdf/2305.14087)) | Acc@20 | 68.4% | **72.0%** | −3.6 pts |

The spread across studies (3.6 to 20.1 pts) reflects different DPR training, but the **sign is consistent in every study**: lexical wins on rare-entity exact-match.

### 2.2 The failure is silent and confident

The characteristic failure mode: dense retrieval returns the *nearest* embedding to `PROD-SKU-7842X`, which is `PROD-SKU-7842Y` — **wrong answer, high confidence**. Applied here: `SourcererAPI.sys.mjs` vs `SourcererAPI.sys.mts`, or decision-ID `D-041` vs `D-047`, or `firefox-esr-153` vs `firefox-esr-140`. Near-miss identifiers are precisely what an embedding sidecar was proposed to *fix*, and they are what it is worst at. This is the design's central irony: **the sidecar's stated justification is its own weakest case.**

Corroborating 2026 practitioner benchmarks: BM25 outperformed SOTA dense retrieval on financial documents because they are "full of identifiers, numbers, and exact terminology that dense embeddings smooth over" ([From BM25 to Corrective RAG](https://arxiv.org/html/2604.01733v1) — among first-stage retrievers, "BM25 outperforms dense retrieval on **all** metrics"). See also [Dense RAG Fails on Rare Terms](https://tensoria.fr/en/blog/hybrid-search-reranking) and [Hybrid Search in Production: Why BM25 Still Wins on the Queries That Matter](https://tianpan.co/blog/2026-04-12-hybrid-search-production-bm25-dense-embeddings).

### 2.3 Compositional/relational meaning

No embedding model represents `A supersedes B` as distinct from `B supersedes A` reliably — bag-of-meaning representations do not encode argument order or relational direction. Frias's scope-inversion and modal-downgrade classes are the empirical shadow of this. **A Datalog store represents this natively and exactly**; an embedding sidecar cannot contribute to it and can only corrupt it by proposing false-equivalence merges.

---

## 3. The honest three-way comparison, per role

### Role A — Near-duplicate detection between curated entries

| Method | Evidence | Verdict |
|---|---|---|
| **MinHash / SimHash / char n-gram** | "No neural embedding has been able to **consistently outperform MinHash** for robust near-duplicate detection" — [RETSim, arXiv:2311.17264](https://arxiv.org/pdf/2311.17264). 24-byte MinHash ≈ 64-bit SimHash performance. Weakness: typo-sensitivity, and Jaccard≈0 for same-idea-different-words. | **Strong default** |
| **Embedding cosine** | Frias: 0/56 meaning-breaking mutations caught; dedup filters named explicitly as an audited gate class. Catches paraphrase-dupes that MinHash misses — but *also* "catches" negations as dupes. | **Reject as a gate**; the false-merge is destructive (two entries with opposite advice merged into one) |
| **LLM judge (pairwise at write time)** | 84–92% agreement with human annotators on binary tasks; reads polarity and modality correctly. Cost is trivial at write-time-only (see §5). | **Best accuracy tier** |

At write time you compare **one new entry against ≤1000 existing** — you can afford a lexical prefilter plus an LLM adjudication on the top handful. Note that a semantic-dedup library like [SemHash](https://github.com/MinishLab/semhash) exists and is fast (1.8M records in 83s on CPU), but it is built for *training-corpus* dedup where a false merge costs one row out of millions. Here a false merge silently deletes a curated decision. **Precision requirements are inverted from the tool's design point.**

### Role B — Entity/alias resolution (two learnings naming the same concept differently)

This is the **only role with a genuine embedding case**, and it is a candidate-generation case.

- The real problem is vocabulary mismatch: `PTO` vs `Paid Time Off`; here, `sidecar` vs `Theia backend` vs `supervised Node process`.
- Lexical methods return **Jaccard ≈ 0** on these — a true miss, not a soft one, and the miss is silent.
- [VLDB: Pre-trained Embeddings for Entity Resolution](https://www.vldb.org/pvldb/vol16/p2225-skoutas.pdf) (12 models, 17 benchmark datasets) — SentenceBERT-class models outperform static embeddings for blocking; the literature's consistent framing is embeddings for **blocking (recall-oriented candidate generation)**, with a separate **matcher** making the decision. See also [Towards Universal Dense Blocking for Entity Resolution](https://arxiv.org/pdf/2404.14831) and the VLDB Journal 2025 in-depth analysis.
- Crucially, the ER literature has *never* proposed cosine-threshold-as-decision. Blocking is explicitly recall-first, precision-later.

**But**: at N≤1000 with a curated vocabulary, the cheaper answer is an **explicit alias table in the Datalog store itself** — `alias(Term, Canonical)` — populated by the LLM at write time when it introduces a new term. That is a symbolic solution to a symbolic problem, it is inspectable, correctable, and it composes with joins. Embeddings would be a probabilistic re-derivation of a fact you can simply *record*.

### Role C — Soft-matching a task description to trigger conditions

**This is the role the evidence most clearly rejects.**

The claim `cosine(task, trigger) > θ ⟹ this learning applies` is a similarity-implies-applicability inference. Frias's paper is a direct audit of that inference class and finds balanced accuracy median **0.525** — coin-flip. And *applicability* is strictly harder than the *sameness* he measured: a trigger condition like `"when adding a native Node module to the Theia workspace"` must match a task that shares almost no vocabulary with it, while *not* matching the superficially-similar `"when adding a Node module to the Firefox build"` — high lexical overlap, wrong applicability. Both of cosine's failure directions fire at once.

Rule applicability is a **logical** relation (does the task satisfy the trigger's preconditions?), not a geometric one. A Datalog store can *evaluate* preconditions. An embedding can only note that two strings look alike.

---

## 4. Hybrid ranking, rerankers, and LLM-as-matcher

### 4.1 Do published hybrid gains transfer to short structured text?

Mostly **no** — the gains are measured on passage retrieval over large corpora, and both drivers weaken here.

| Evidence | Number | Transfers? |
|---|---|---|
| RRF over BM25-only, general | **+0.033 mean nDCG@10** | Modest even in its home setting |
| "To reach recall@1000 of 0.98 you need both sparse and dense" | recall@1000 | **No** — irrelevant at N=1000 total, where recall@1000 is 1.0 by definition |
| WANDS e-commerce (short structured records) | RRF beats both BM25-alone and KNN-alone; **bigger gains from field-level boosting** (e.g. product-name field) than from fusion itself | Partially — and it argues for **structured field boosting**, which a Datalog store does natively |
| BM25 value vs corpus size | "BM25 relatively **more** valuable for smaller corpora, where IDF statistics are meaningful and distinctive"; dense matters more "as your corpus grows to tens of thousands of chunks" | **Against dense** at this scale |

The N=100–1000 regime sits on the wrong side of every one of these crossovers.

### 4.2 Rerankers as the accuracy tier

| Tier | Latency | Cost | Accuracy |
|---|---|---|---|
| Bi-encoder (embedding) cosine | ~1ms | ~free | baseline; median 0.525 balanced acc on decision tasks (Frias) |
| Cross-encoder (MiniLM/TinyBERT) | ~50ms / 20 docs | free self-hosted (Cohere Rerank ≈ $2/1k requests) | "80% of the win for 20% of the cost" |
| LLM reranker | +1–3s (listwise 4–6s) | input tokens × docs | **+5–8%** over listwise cross-encoders; matches/approaches cross-encoders zero-shot out-of-domain |

Sources: [ZeroEntropy: Should You Use LLMs for Reranking?](https://zeroentropy.dev/articles/should-you-use-llms-for-reranking-a-deep-dive-into-pointwise-listwise-and-cross-encoders/), [ZeroEntropy: Choosing a Reranking Model](https://zeroentropy.dev/articles/ultimate-guide-to-choosing-the-best-reranking-model-in-2025/), [SciRerankBench](https://arxiv.org/pdf/2508.08742).

Note the common practitioner recommendation already concedes the point: *"add an LLM-as-judge gate on the top-5 only — LLM-as-judge is the flexible scalpel for the last, tricky 5%."* In this design the "tricky 5%" (polarity, modality, applicability) **is the whole task**.

### 4.3 LLM-as-matcher accuracy

- **84–92% agreement with human annotators** on binary relevance/applicability judgments; ≥85% overall agreement across most languages; one judge at 92.67%.
- Llama-8B-class judges show high correlation with human annotation ([Kirichenko et al. 2025](https://arxiv.org/pdf/2606.19544) and the ICLR 2025 [Trust or Escalate](https://proceedings.iclr.cc/paper_files/paper/2025/file/08dabd5345b37fffcbe335bd578b15a0-Paper-Conference.pdf)).
- Documented caveat: LLM judges are **over-confident** about their agreement with an annotator majority — so use them for *ranking/filtering*, and keep a human in the loop for destructive operations (merge, supersede).

**Comparison for the applicability question specifically:** embedding cosine ≈ 0.525 balanced accuracy (Frias, on the closest-analogous task) vs LLM judge ≈ 0.84–0.92 agreement. This is not a close call.

### 4.4 The deliberate no-embeddings architecture — published precedent

**Yes, this exists, and it is the strongest single citation for the proposed architecture.**

[Keyword search is all you need: Achieving RAG-Level Performance without vector databases using agentic tool use](https://arxiv.org/abs/2602.23368) — Subramanian et al., **Amazon / AAAI 2026** ([Amazon Science page](https://www.amazon.science/publications/keyword-search-is-all-you-need-achieving-rag-level-performance-without-vector-databases-using-agentic-tool-use)).

Design: Amazon Bedrock Knowledge Base + Titan Text Embeddings V2 (the RAG baseline) vs a **ReAct agent with only `pdfmetadata`, `rga`, `pdfgrep`** — same LLM (Claude 3 Sonnet, 200K ctx, temp 0.001), same six datasets, same eval harness.

| Dataset | Faithfulness (Agent/RAG → attainment) | Context Recall | Answer Correctness |
|---|---|---|---|
| PaulGrahamEssay | 0.8662 / 0.9056 → 95.65% | 87.70% | 79.91% |
| Llama2Paper | 0.7252 / 0.8199 → 88.45% | 70.56% | 87.42% |
| BlockchainSolana | 0.8122 / 0.8627 → 94.15% | 99.62% | **99.97%** |
| LLM Survey paper | 0.8061 / 0.8121 → 99.26% | 98.71% | **99.51%** |
| **Average** | **94.52%** | **88.05%** | **91.48%** |

FinanceBench: the keyword agent **beat** RAG by ~6 percentage points. The paper notes the approach performed best on **technical documentation and complex financial documents**, and is "particularly useful in scenarios requiring **frequent updates to knowledge bases**" — both of which describe a learnings store precisely.

**Industry corroboration:** Windsurf, Cline, Devin, and Sourcegraph Amp have dropped vector search for tool-driven search in code contexts.

**Important caveat on transfer:** that agent had *unstructured PDFs* and had to grep. Your store is *already structured* — you have real predicates, typed provenance, and joins. Symbolic candidate generation here is strictly stronger than `pdfgrep`. The paper's result is therefore a **lower bound** on what symbolic-first can achieve in your setting.

---

## 5. Maintenance costs the retrieval papers skip

| Cost | Evidence | Impact at N=100–1000 |
|---|---|---|
| **Index staleness on edit/supersession** | Standard practice is periodic full re-index; between runs the system "operates on increasingly stale data." Every learning edit invalidates its vector. | A supersession-heavy corpus edits *constantly*. Every write path needs a re-embed hook, and every missed hook is a **silent** wrong answer. |
| **Model-version migration** | "Different embedding models operate in different vector spaces that can't be meaningfully compared without re-embedding." A 250-person SaaS re-embedding 180M chunks: **~6 engineer-weeks + ~$12,000**. | Cost scales with corpus, so ~$0 here — but the *engineering* cost (migration script, eval suite to validate, rollback path) is nearly fixed regardless of N. You pay the complexity, not the compute. |
| **Ongoing ops overhead** | Monitoring/eval pipelines, corpus-freshness checks, drift detection "add **15–30%** to base inference costs" and create "a vast web of brittle scripts." | Pure overhead — there is no retrieval-quality problem at N=1000 that needs solving. |
| **Storage** | 1000 entries × 768 dims × 4 bytes = **~3 MB** (~1.5 MB at 384 dims). | Negligible. Storage is *not* the argument against embeddings; correctness and maintenance are. |

Sources: [Embedding Models in Production: Selection, Versioning, and the Index Drift Problem](https://tianpan.co/blog/2026-04-09-embedding-models-production-versioning-index-drift), [Different Embedding Models, Different Spaces](https://medium.com/data-science-collective/different-embedding-models-different-spaces-the-hidden-cost-of-model-upgrades-899db24ad233), [I Updated My Embedding Model and My RAG Broke](https://decompressed.io/learn/rag-observability-postmortem), [Pixeltable embedding management guide](https://www.pixeltable.com/blog/embedding-management-guide).

### 5.1 The do-nothing baseline — does any index structure earn its complexity below 10k?

**No.** [Operational Advice for Dense and Sparse Retrievers: HNSW, Flat, or Inverted Indexes?](https://arxiv.org/abs/2409.06464) (Jimmy Lin, Waterloo) — the only paper to give empirical operational advice on this — states flat brute-force indexes "represent another viable option, **particularly for smaller corpora and for rapid prototyping**," and documents that flat gives **exact** scores as ground truth while HNSW costs both indexing time and a non-deterministic effectiveness degradation (scores vary per trial because construction is non-deterministic).

Practical thresholds from vendor guidance (Milvus/Zilliz, Redis, Weaviate): flat is appropriate below ~10k vectors and practical to ~50k where exact results matter; HNSW's 50–200× speedup at 95–99% recall only matters when linear scan is actually too slow.

**Arithmetic for this corpus:** 1000 × 768 float32 = 3 MB. A single NumPy `matmul` against that is **sub-millisecond**. An ANN index at this scale is strictly worse: slower to build, approximate instead of exact, non-deterministic, and an extra dependency.

**And the tier below that:** at write time you compare one entry against ≤1000. Pairwise LLM comparison against a lexically-prefiltered top-10 costs a handful of cheap calls **once per write**, on a corpus that grows by a few entries a week. This is the baseline any embedding proposal must beat, and on the accuracy numbers in §3 and §4.3, it does not lose.

---

## 6. Small embedding models — 2026 state

If embeddings are used at all, these are the current options.

| Model | Params | Dims | Notes |
|---|---|---|---|
| **granite-embedding-30m** (IBM) | 30M | 384 | English; bottom of the cost ladder |
| **EmbeddingGemma-300M** (Google DeepMind) | 300M | 768 (Matryoshka → 512/256/128) | Gemma 3-derived, 2048-token ctx, released 2025-09-04, Gemma license. [arXiv:2509.20354](https://arxiv.org/html/2509.20354v2) |
| **Qwen3-Embedding-0.6B** | 600M | 1024 | 32K ctx, **Apache 2.0**, supports user-defined instructions (task-conditioned embeddings) |
| **granite-embedding-278m** | 278M | — | multilingual; strong zero-shot code retrieval (no CoIR training data) — [arXiv:2508.21085](https://arxiv.org/pdf/2508.21085) |
| **Voyage code-3 / Gemini Embedding** | API | — | Top-tier for *code* retrieval specifically; not local |
| **jina-embeddings-v4** | 3B (Qwen2.5-VL) | — | multimodal/multilingual; heavy for this use |

Code-specific evaluation lives in **CoIR** ([arXiv:2407.02883](https://arxiv.org/pdf/2407.02883)) — 8 subtasks, 14 languages, 10 datasets, 2M+ entries — created precisely because MTEB lacked dedicated code-retrieval evaluation. Caveat: **MTEB v2 (2026) scores are not comparable to v1**, and rankings shift across leaderboard splits.

### 6.1 Does an 8B generative model beat a dedicated embedder on this text?

For **similarity**, no — that is not what a generative model computes, and a 0.6B embedder produces a vector in ~1ms where an 8B model needs a forward pass over a prompt.

For **applicability judgment**, yes, decisively — and applicability is the actual question. An 8B judge reaches 84–92% agreement with human annotators on binary judgments (§4.3) on a task where cosine sits at ~0.525 balanced accuracy (§1.1). The two are not substitutes: the embedder answers "are these strings alike?", the judge answers "does this rule apply here?". **Only the second question matters for a trigger-condition store**, and the reader is already paying for an LLM in the agent loop.

---

## 7. The honest case *for* embeddings

Stating this fairly, because the brief asked for evidence, not advocacy:

1. **Vocabulary mismatch is real and lexical methods fail silently on it.** `sidecar` / `Theia backend` / `supervised Node process` return Jaccard ≈ 0. BM25 does not degrade gracefully here — it returns nothing, with no signal that it missed. This is the one failure mode a symbolic store genuinely shares.
2. **Entity-resolution literature does endorse embeddings for blocking** — 12 models × 17 datasets (VLDB), consistently useful as recall-oriented candidate generation.
3. **Cost is genuinely trivial at this scale** — ~3 MB, sub-ms brute-force scan, a 30M–300M-param local model. Nothing about the *resource* argument opposes embeddings.
4. **Hybrid fusion is consistently non-negative** — RRF is "a reliable no-tuning baseline"; adding dense to sparse rarely *hurts* ranking (as distinct from *gating*, which Frias shows does hurt).

The rebuttal to (1) is not that the problem is fake — it is that an **explicit alias table** solves it exactly, inspectably, and composably, where embeddings solve it probabilistically and uninspectably. The rebuttal to (4) is that ranking and gating are different operations: fusion is safe, thresholded decisions are not.

---

## 8. Verdict

**For a corpus of 100–1000 curated learnings with trigger conditions and exact IDs:**

### Per role

| Role | Verdict | Use instead |
|---|---|---|
| **Near-duplicate detection** | ❌ **Embeddings not justified** | Char n-gram / MinHash prefilter → **LLM adjudication** on top-k at write time. Never auto-merge on cosine (Frias: 0/56, and a false merge destroys a curated entry). |
| **Entity/alias resolution** | ⚠️ **Weakest justification of the three, and still optional** | An explicit `alias(Term, Canonical)` **table in the Datalog store**, written by the LLM when it introduces a new term. Embeddings only if that table proves insufficient in practice — and then as *blocking only*, never as decision. |
| **Task → trigger matching** | ❌ **Embeddings actively harmful** | **Symbolic candidate generation** (predicate/tag/provenance joins over code symbols and decision-IDs) → **small-LLM applicability judgment**. Applicability is a logical relation; cosine measures wording overlap and scores ~0.525 balanced accuracy on the closest-audited analogue. |

### Recommended architecture — no embeddings

```
write:  new learning
          → lexical near-dup prefilter (trigram/MinHash over normalized text)
          → LLM adjudicates top-5: duplicate / supersedes / distinct
          → LLM emits alias(Term, Canonical) rows for any new vocabulary
          → assert into Datalog with provenance

query:  task description
          → LLM extracts symbols/IDs/tags mentioned  (+ alias expansion)
          → Datalog join → candidate learnings (typically <20)
          → LLM judges applicability per candidate, cites trigger condition
          → inject the ones that actually apply
```

This is the [Keyword search is all you need](https://arxiv.org/abs/2602.23368) architecture (94.5% faithfulness attainment, zero vector store) with a **stronger** candidate generator — real predicates and joins instead of `pdfgrep`.

### Minimal embedding footprint, if adopted anyway

If you want a hedge against silent vocabulary-mismatch misses, the smallest defensible version is:

1. **One model**: EmbeddingGemma-300M @ 256 dims (Matryoshka-truncated) or Qwen3-Embedding-0.6B (Apache 2.0). Local, pinned, version recorded in the store.
2. **Brute-force NumPy cosine over an in-memory float32 array.** No FAISS, no HNSW, no vector DB — at 1000×256 the whole matrix is 1 MB and the scan is sub-millisecond, exact, and deterministic. ANN below 10k vectors is strictly worse on every axis (Lin, arXiv:2409.06464).
3. **Recall-only, never a decision.** Embeddings may *add* candidates to a symbolic result set. They may never filter, merge, supersede, or dedup. **No cosine threshold appears anywhere in the codebase** — the LLM judge makes every call.
4. **Store the model ID + dimension alongside every vector**; treat a model change as a full rebuild (trivial at this N — this is the one migration cost that stays cheap here).
5. **Re-embed on every entry edit, synchronously, in the same transaction as the assert.** If that is inconvenient to guarantee, that inconvenience is the correct signal to drop embeddings entirely.

**Bottom line:** embeddings are cheap here but not *useful* here. The retrieval problem at N=1000 is already solved by the symbolic store; the remaining problem is *judgment* (does this apply? is this the same? did this supersede that?), and judgment is exactly what cosine similarity has been audited to fail at — at coin-flip balanced accuracy, in the direction of approving reversals. The embedding sidecar was proposed to fix near-miss identifier matching, which is dense retrieval's documented worst case (−14 to −20 pts vs BM25). **Start with no embeddings. Add them only if you observe a specific, logged vocabulary-mismatch miss that an alias table did not catch.**

---

## Sources

**Primary — anti-embedding evidence**
- Frias, S.E. (2026). [Similarity Gates Approve Reversals: A Validity Audit of Embedding-Cosine Thresholds in Agent Systems](https://arxiv.org/abs/2608.10216). arXiv:2608.10216. ([full HTML](https://arxiv.org/html/2608.10216)) — *the single most applicable source*
- Sciavolino, Zhong, Lee, Chen (2021). [Simple Entity-Centric Questions Challenge Dense Retrievers](https://aclanthology.org/2021.emnlp-main.496.pdf). EMNLP 2021.
- [Enhancing Negation Awareness in Universal Text Embeddings](https://arxiv.org/abs/2504.00584). arXiv:2504.00584.
- Truong, Verspoor, Cohn, Baldwin (2025). [Learning Robust Negation Text Representations](https://arxiv.org/pdf/2507.12782).
- [Semantics at an Angle: When Cosine Similarity Works Until It Doesn't](https://arxiv.org/pdf/2504.16318).
- [Revealing the Blind Spot of Sentence Encoder Evaluation by HEROS](https://arxiv.org/pdf/2306.05083).
- [RETSim: Resilient and Efficient Text Similarity](https://arxiv.org/pdf/2311.17264). arXiv:2311.17264.

**Primary — the no-embeddings architecture**
- Subramanian et al. (2026). [Keyword search is all you need: Achieving RAG-Level Performance without vector databases using agentic tool use](https://arxiv.org/abs/2602.23368). AAAI 2026 / Amazon Science. ([full HTML](https://arxiv.org/html/2602.23368v1), [Amazon Science](https://www.amazon.science/publications/keyword-search-is-all-you-need-achieving-rag-level-performance-without-vector-databases-using-agentic-tool-use))
- Lin, J. [Operational Advice for Dense and Sparse Retrievers: HNSW, Flat, or Inverted Indexes?](https://arxiv.org/abs/2409.06464). arXiv:2409.06464.

**Retrieval comparison / hybrid**
- [SPAR: Salient Phrase Aware Dense Retrieval](https://arxiv.org/pdf/2110.06918)
- [Improving Passage Retrieval with Zero-Shot Question Generation](https://arxiv.org/pdf/2204.07496)
- [BM25 Query Augmentation Learned End-to-End](https://arxiv.org/pdf/2305.14087)
- [From BM25 to Corrective RAG: Benchmarking Retrieval Strategies for Text-and-Table Documents](https://arxiv.org/html/2604.01733v1)
- [SciRerankBench](https://arxiv.org/pdf/2508.08742)
- [ZeroEntropy: Should You Use LLMs for Reranking?](https://zeroentropy.dev/articles/should-you-use-llms-for-reranking-a-deep-dive-into-pointwise-listwise-and-cross-encoders/)
- [Hybrid Search in Production: Why BM25 Still Wins on the Queries That Matter](https://tianpan.co/blog/2026-04-12-hybrid-search-production-bm25-dense-embeddings)
- [Dense RAG Fails on Rare Terms](https://tensoria.fr/en/blog/hybrid-search-reranking)

**Entity resolution**
- [Pre-trained Embeddings for Entity Resolution: An Experimental Analysis](https://www.vldb.org/pvldb/vol16/p2225-skoutas.pdf) (VLDB, 12 models × 17 datasets)
- [An in-depth analysis of pre-trained embeddings for entity resolution](https://link.springer.com/article/10.1007/s00778-024-00879-4) (VLDB Journal, 2025)
- [Towards Universal Dense Blocking for Entity Resolution](https://arxiv.org/pdf/2404.14831)

**LLM-as-judge**
- [Trust or Escalate: LLM Judges with Provable Guarantees](https://proceedings.iclr.cc/paper_files/paper/2025/file/08dabd5345b37fffcbe335bd578b15a0-Paper-Conference.pdf) (ICLR 2025)
- [Reliability without Validity: A Systematic, Large-Scale Evaluation of LLM-as-a-Judge Models](https://arxiv.org/pdf/2606.19544)

**Embedding models / maintenance**
- [EmbeddingGemma: Powerful and Lightweight Text Representations](https://arxiv.org/html/2509.20354v2)
- [CoIR: A Comprehensive Benchmark for Code Information Retrieval](https://arxiv.org/pdf/2407.02883)
- [Granite Embedding R2 Models](https://arxiv.org/pdf/2508.21085)
- [Embedding Models in Production: Index Drift](https://tianpan.co/blog/2026-04-09-embedding-models-production-versioning-index-drift)
- [Different Embedding Models, Different Spaces: The Hidden Cost of Model Upgrades](https://medium.com/data-science-collective/different-embedding-models-different-spaces-the-hidden-cost-of-model-upgrades-899db24ad233)
- [SemHash](https://github.com/MinishLab/semhash)
