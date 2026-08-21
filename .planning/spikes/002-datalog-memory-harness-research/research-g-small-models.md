# Research G — Small Models Leveraged by External Structured Memory

**Question:** Can a structured/symbolic memory substrate (a Datalog knowledge graph) make ~4B–14B models fast, cheap, *and* high-quality — and where are the hard limits?

**Date:** 2026-08-20. Evidence weighted to 2024–2026.
**Frame (given, not researched):** a harness where small fast subagents assist one frontier model, backed by a custom Datalog KG. Thesis under test: *50 parallel frontier models is not cost-effective; small models + structured memory is the interesting frontier.*

---

## 0. Verdict, up front

**The thesis is half right, and the half that is right is not the half most people mean.**

1. **"Structure narrows the gap" is TRUE for *format* and FALSE for *knowledge*.** The strongest 2026 evidence says small models are catastrophically bad at *using retrieved prose to answer questions they don't already know* — even with oracle retrieval, ≤7B models fail 85–100% of the time, and adding retrieval context *destroys* 42–100% of answers they previously got right ([arXiv 2603.11513](https://arxiv.org/abs/2603.11513)). Meanwhile the same class of model gets **+28.6pp on tool selection (49.5% → 78.1%)** purely from constrained decoding, and **+17% with 80% fewer schema-misalignment errors** purely from renaming the schema to match its pretraining priors ([arXiv 2510.07248](https://arxiv.org/abs/2510.07248)). Structure buys you *reliable form*, not *borrowed intelligence*.
2. **Therefore: use small models as transducers, not as reasoners over the graph.** Give them a closed-world job with a schema on both ends — text → facts, question → query, candidate → verdict — and they are frontier-competitive (96.6–97.0% F1 on schema extraction at 4B–8B, [arXiv 2606.08051](https://arxiv.org/abs/2606.08051)). Ask them to read 20 retrieved facts and *infer* an answer and they degrade below their own closed-book baseline.
3. **The economics claim is right but the size of the win is smaller than it looks.** The real published cascade numbers on production workloads are **31–42% cost reduction**, not the 98% headline ([arXiv 2605.18796](https://arxiv.org/html/2605.18796)) — because coordination overhead and escalation eat most of the paper margin. The genuinely large win (50–100×) is *local* 8B inference at electricity cost, not API arbitrage.
4. **The hard floor:** multi-step tool orchestration, cross-document synthesis, novel schema design, and any judgement that requires knowing what *isn't* in the graph. Those stay frontier. Reserve exactly one frontier call per task for them.

---

## 1. Does external structure narrow the small-vs-frontier gap?

### 1.1 The optimistic literature (retrieval helps small models more)

| Claim | Result | Source |
|---|---|---|
| Retrieval substitutes for parameters | LLaMA2-7B **+ retrieval** > LLaMA2-70B **closed-book** on knowledge QA | [RAG survey, arXiv 2404.10981](https://arxiv.org/pdf/2404.10981) |
| Extreme version | Open-book **7B** > closed-book **280B** on NQ and HotpotQA | ibid. (citing RETRO-line work) |
| Retriever > generator | Retrieval quality has larger effect on end RAG accuracy than generator choice | ibid. |
| Structure helps *multi-hop* specifically | Graph-guided retrieval **70.3%** vs plain vector RAG **67.0%** on multi-hop; plain RAG *wins* single-hop (**F1 64.8 vs 63.0**) | MSU/Meta unified GraphRAG study, via [VentureBeat](https://venturebeat.com/orchestration/stop-graphing-everything-when-graphrag-actually-beats-vector-rag) |
| Domain GraphRAG | Hybrid GraphRAG **80%** correct vs vector RAG **50.8%**; industry domain **90.6%** vs **46.9%** | Lettria, via same |

**Read carefully:** every one of these compares *retrieval-augmented small* to *closed-book large*. That is the right comparison for "can structure replace parameters for facts." It is **not** the comparison relevant to your harness, where the frontier model *also* has the graph.

### 1.2 The counter-evidence, which is stronger and more recent

**arXiv 2603.11513, "Can Small Language Models Use What They Retrieve?"** — the single most important paper for this design. It separates *retrieval quality failure* from *utilization failure* using a "parametric knowledge split" (questions the model can already answer vs. can't).

Oracle-context exact-match on the **unknown** split (n=756, corpus-matched):

| Model | Oracle-context accuracy |
|---|---|
| SmolLM2-360M | **0.0%** |
| Qwen2.5-1.5B | **10.0%** [7.8–12.2] |
| Qwen2.5-3B | **12.8%** [10.5–15.5] |
| Qwen2.5-7B | **14.6%** [11.9–17.6] |

Context *distraction* on the **known** split (models scoring 100% closed-book):

| Model | With dense retrieval | With oracle retrieval | Answers destroyed |
|---|---|---|---|
| Qwen2.5-1.5B | 36.0% | 43.0% | 57–64 pp |
| Qwen2.5-3B | 46.4% | 54.4% | 46–54 pp |
| Qwen2.5-7B | 48.8% | 58.4% | 41–51 pp |

Failure-mode breakdown over 2,588 oracle failures: **irrelevant generation 61–100%**, refusal 7–24%, format failures 7–8%. The dominant mode is the model *ignoring the context it was given*.

Paper's own conclusion: utilization improves *roughly log-linearly with scale* but "robust context utilization (>50% oracle EM) may require models larger than 7B." Models tested topped out at Llama-3.1-8B.

> **Design consequence:** do not build a pipeline where an 8B model receives Datalog-derived facts and is asked to *answer a question* from them. Build one where it receives facts and *transforms* them (fill this schema, rank these, emit this query). The failure mode is comprehension-under-context, not formatting.

### 1.3 Where structure *does* narrow the gap: schema on the interface

This is the actionable finding and it is well replicated.

| Intervention | Model | Before → After | Source |
|---|---|---|---|
| Grammar-constrained decoding, single-turn tool selection | Qwen2.5-7B | **49.5% → 78.1%** (+28.6pp) | [arXiv 2510.07248](https://arxiv.org/pdf/2510.07248) |
| **PA-Tool**: rename tool/param schemas to match model's *pretraining* naming conventions (training-free, uses "peakedness") | small models, MetaTool + RoTBench | **up to +17% accuracy; −80% schema-misalignment errors** | [arXiv 2510.07248](https://arxiv.org/abs/2510.07248) |
| LoRA on task-specific schema extraction | Llama-3.1-8B | **96.95% F1** on merchant-entity extraction | [arXiv 2606.08051](https://arxiv.org/abs/2606.08051) |
| Same, at 4B | Qwen 3.5 4B, JSON-only prompting | **96.60% F1** (−0.35pp vs 8B) | ibid. |
| 4-bit LoRA on narrow tasks | generic | ~**+30 pts** over base; **+5 to +15 pts over GPT-4** on the narrow task | secondary, [NeuralTrust](https://neuraltrust.ai/blog/fine-tuning-vs-prompting-cost) — *low confidence, vendor blog* |

**The mechanism matters for your Datalog design:** PA-Tool's finding is that small models hallucinate predicate/tool names that *don't exist in the schema you gave them*, because their pretraining priors override the prompt. Your Datalog predicate names are a free variable. Naming them the way the open-source corpus already names things (`file_imports/2`, not `srcRelHasDepEdge/2`) is a measurable accuracy lever, not cosmetics.

### 1.4 The counter-counter-evidence: the constraint tax

Constrained decoding is not free. Two 2026 papers ("When Correct Isn't Usable," [arXiv 2605.02363](https://arxiv.org/pdf/2605.02363); "The Constraint Tax," [arXiv 2605.26128](https://arxiv.org/pdf/2605.26128)) find that forcing schema compliance can *reduce* task correctness, because small models need to externalise intermediate state and a rigid schema denies them the scratch space. Reported penalty ~5–15pp depending on constraint complexity *(low-medium confidence — extracted from PDF summary, not the tables)*. Both recommend **two-stage reason-then-format**: free generation, then a second constrained pass that only serialises.

Also relevant: constrained decoding "incurs substantial per-inference overhead and, in some models, degrades task performance" ([arXiv 2510.07248](https://arxiv.org/pdf/2510.07248)) — which is why PA-Tool exists as the cheaper alternative.

### 1.5 Long context: the small-model effective window

Advertised ≠ effective, and this bites small models harder in absolute terms even though the *ratio* is bad for everyone.

**NoLiMa** ([arXiv 2502.05167](https://arxiv.org/html/2502.05167v3)) — needles that require associative, not literal, matching:

- **11 of 13 models** score at 32K **half or less** of their base score.
- Effective length (85%-of-base threshold) is generally **≤2K tokens** — including Llama 3.1 **70B**, which drops **94.3% → 42.7%** at 32K.
- Llama 3.1 **8B** has a weaker base score but its effective length is computed relative to that base; GPT-4o is the only model generalising meaningfully past 8K.

**RULER** ([NVIDIA](https://github.com/NVIDIA/RULER)) — only about **half** of models claiming ≥32K clear the quality threshold at 32K. Llama-3.1-8B-Instruct is a relative bright spot: **95.0% @ 4K → 87.3% @ 32K**, and notably *outperforms its own 70B sibling* — size does not predict long-context robustness *(medium confidence — figures via secondary summary of the RULER/ÌRULER line of work)*.

> **Design consequence:** budget **≤4K tokens of retrieved context per small-model call**, and treat 8K as the hard ceiling. This is a strong argument *for* a Datalog substrate over vector RAG: a query that returns 12 exact facts beats a top-k that returns 20 chunks, not because the graph is smarter but because the small model's usable window is tiny and you cannot afford to fill it with near-misses.

---

## 2. The reliable-task menu for 8B-class models in 2026

### 2.1 Task-by-task verdict

| Task | 8B-class reliability | Numbers | Verdict for the harness |
|---|---|---|---|
| **Extraction to a fixed schema** (text → facts/JSON) | **Excellent, with LoRA** | 96.75–96.95% F1 (Llama-3.1-8B); 96.60% at 4B; 94.75% at 0.8B | ✅ **Ship it.** The single best small-model job. |
| **Classification / routing** | **Excellent** | Implied by cascade routers hitting F1 0.847 (4B) vs 0.932 (12B) on production NER; routing itself is easier than NER | ✅ Ship it. |
| **Reranking / embedding** | **Excellent** | Purpose-built rerankers are sub-1B and near-frontier; not a generative task | ✅ Ship it (don't use a chat LLM for this). |
| **Summarization (single doc, bounded)** | **Good** | Not the weak spot; failure risk is silent omission, not error | ✅ Ship with a length/coverage check. |
| **Structured query generation (text→SQL)** | **Fair, task-dependent** | Zero-shot Qwen2.5-Coder-7B **66.8%** BIRD avg (Alpha-SQL); 32B → **69.7%**. Fine-tuned SLM-SQL-1.5B **67.08%** BIRD EX, **76.72%** Spider dev | ⚠️ Fine-tune or verify. ~2/3 correctness raw. |
| **text→Cypher** | **Fair** | Fine-tuned Llama-3.1-8B **0.7701** Google-BLEU vs GPT-4o **0.8017** on Neo4j Text2Cypher; SynthCypher gives **+40%** on 7–8B | ⚠️ Fine-tune. Closes most but not all of the gap. |
| **text→SPARQL** | **Poor** | Cross-language study: SQL **29.7%** exec acc, Cypher **23.9%**, **SPARQL 17.2%** | ❌ Hardest of the three. |
| **text→Datalog** | **No direct evidence** | Nothing published at 8B scale. Nearest neighbours: GPT-ASP (NL→ASP), LoRP (NL→Prolog), solver-in-the-loop training; "Intermediate Languages Matter" ([arXiv 2502.17216](https://arxiv.org/pdf/2502.17216)) finds formalism choice drives accuracy; adaptive language selection hits **96%** on composite reasoning, **+25%** over best single-language baseline | ⚠️ **Gap in the literature.** See §2.2. |
| **Verification / judging** | **Fair — and the metric lies** | 20 judges on RewardBench span **κ 0.616–0.898**; top tier (Gemini 3.1 Pro 0.898, GPT-oss-120B 0.880, Claude Opus 4.6 0.879, Claude Haiku 4.5 0.873). MT-Bench exact-match 0.80–0.85 corresponds to **κ ≈ 0.48** — moderate, not near-perfect | ⚠️ Usable for *binary, mechanical* checks. Not for quality judgement. |
| **Multi-step tool use** | **Poor** | 7B is the *practical floor*, not a comfortable point. Qwen3-1.7B: 55.5% overall / **16.9% multi-turn**. Qwen3-0.6B: 45.8% / **1.4% multi-turn** | ❌ **Do not orchestrate with 8B.** One tool call, verified, is the limit. |
| **Code editing (agentic)** | **Poor at 8B** | Best <100B open: Llama3-SWE-RL-**70B** at 41.0% SWE-bench Verified. 32B specialists reach 61–62%. Frontier: Claude Opus 4.8 ~**88.6%** | ❌ Frontier only. |
| **Instruction following (strict)** | **Surprisingly good** | Llama 3.3 8B: **92.1% IFEval** — reported as highest sub-10B in 2026 *(low confidence — SEO blog source)* | ✅ but verify per-model. |

### 2.2 The text-to-Datalog gap — the one real unknown

There is **no published 8B-scale text-to-Datalog accuracy number.** What the adjacent literature says:

- **Formalism choice is a first-class accuracy variable.** "Intermediate Languages Matter: Formal Choice Drives Neurosymbolic LLM Reasoning" ([arXiv 2502.17216](https://arxiv.org/pdf/2502.17216)) — the same model, same task, different target formalism, materially different accuracy.
- **Solver-in-the-loop is the standard fix.** Feed the Datalog engine's syntax/type error back and let the model self-correct; this is the documented mechanism for reducing DSL-generation errors ([arXiv 2512.17093](https://arxiv.org/pdf/2512.17093), [survey](https://neurosymbolic-ai-journal.com/system/files/nai-paper-877.pdf)).
- **Datalog has a structural advantage over SQL/Cypher/SPARQL for this:** it is small, uniform, has no join syntax to get wrong, and — critically — **is decidable and terminating**, so a generated query either compiles and runs or fails loudly. Unlike SQL, there is no large class of "runs fine, returns wrong answer." That converts a *correctness* problem into a *retry* problem, which small models handle.

> **Recommendation:** treat text→Datalog as text→SQL-class difficulty (~2/3 zero-shot), plan for a **compile-and-retry loop against the actual engine**, and expect a LoRA on 5–20k synthetic query pairs to be the thing that makes it production-grade — that is exactly what worked for Cypher (+40% at 7–8B).

### 2.3 Current best open ~8B models (August 2026)

*Confidence: MEDIUM. This roster comes from aggregator/SEO sources, not primary model cards. Verify each pin before committing.*

| Model | Known for | Notes |
|---|---|---|
| **Qwen3-8B** | Best all-round general reasoning at 8B; dual thinking/non-thinking modes | Apache 2.0. Strong agentic tool use vs Qwen2.5. The default pick. |
| **Qwen3-30B-A3B** (MoE) | **~8B quality at ~3B speed** — 30B total, 3B active | The efficiency sweet spot in 2026. Reasoning between 8B and 14B dense; thinking mode approaches 32B. Widely recommended as the 2026 default. |
| **IBM Granite 4.1 8B** | Highest HumanEval among sub-10B; strong tool-calling | Apache 2.0. Best coding + tool-calling at the size. |
| **Llama 3.3 8B** | Instruction following (92.1% IFEval), broadest ecosystem | Best when strict prompt compliance matters. |
| **Llama 3.1 8B** | The long-context bright spot (95.0%@4K → 87.3%@32K RULER) | Still the best-characterised 8B in the literature. |
| **Gemma 4 / Gemma 3 4B** | Apache-2.0-safe commercial use; 4B is a strong extraction model (96.24% F1) | Good small-tier option. |
| **Ministral 3 (3B / 8B / 14B)** | Apache 2.0, multimodal, 40+ languages | Dense family, drop-in. |
| **Phi-4-mini** | CPU-only viability | Only if you have no GPU. |
| **xLAM-2-8B** (Salesforce) | **Tool calling specialist** — NVIDIA cites it as beating GPT-4o and Claude 3.5 on tool calling | The one to try if tool-calling reliability is the bottleneck. |
| **DeepSeek-R1-Distill-Qwen-7B** | Reasoning distillation; NVIDIA cites it beating Claude-3.5-Sonnet and GPT-4o on reasoning benchmarks | Treat that claim as benchmark-specific. |

### 2.4 Quantization effects

| Finding | Detail | Confidence |
|---|---|---|
| INT4 gives ~8× memory reduction vs FP32, "greater accuracy trade-offs" | Generic; AWQ W4 = "minor accuracy loss," better latency and energy/token | Medium |
| AWQ > GPTQ for activation-sensitive work | AWQ preserves salient weights by activation magnitude; GPTQ minimises MSE batchwise | Medium |
| **No study found isolating quantization impact on tool-calling or JSON-schema compliance for small models** | This is a genuine literature gap | High (absence confirmed across two searches) |
| Practical inference: quantization interacts badly with *constrained* generation | Constrained decoding already flattens the distribution; INT4 flattens it further. Untested combination. | Inference, not evidence |

> **Recommendation:** run 8B at **FP16/BF16 or W8** for extraction and query generation (the accuracy-critical transducer jobs) and reserve INT4 for reranking/classification where you have a verifier downstream. Budget one afternoon to measure your own extraction F1 at Q4_K_M vs FP16 — the literature will not answer this for you.

---

## 3. The economics, with real numbers

### 3.1 Local 8B inference

*Confidence: LOW–MEDIUM. Benchmark blogs disagree with each other; the 48 tok/s and 178 tok/s figures below are from the same source family and are not reconcilable. Treat as order-of-magnitude.*

| Config | Throughput | Source |
|---|---|---|
| RTX 5090, Llama 3.1 8B Q4_K_M, single request, vLLM 0.8.3 | **~178 tok/s** | [markaicode](https://markaicode.com/benchmarks/rtx-5090-inference-benchmark/) |
| RTX 5090 vs RTX 4090, same quant, single stream | **3.2×** faster | ibid. |
| RTX 5090, Llama 3 8B FP16, batch 32 | **>850 tok/s** aggregate | [gigagpu](https://gigagpu.com/vllm-on-rtx-5090-max-throughput/) |
| RTX 4090, 7B-class, high-throughput config | **~2,400 tok/s** aggregate (claimed) | ibid. — *treat sceptically* |
| vLLM vs Ollama vs llama.cpp, same model/quant | vLLM **+6%** vs Ollama, **+14%** vs llama.cpp | ibid. |

**Electricity-only cost:**

| Item | Number |
|---|---|
| RTX 4090 under inference load | 350–400 W |
| Cost at US avg $0.13/kWh | **~$0.05/hr**, $12.50/mo at 8h/day, **$38/mo at 24/7** |
| Amortised total (card + power) | ~**$104/mo** for an RTX 4090 setup |
| Self-hosted 70B on H100, batch 8, vLLM | **$0.10–0.18 / 1M output tokens** at 85% util |

**Break-even vs API:** ~**8M tokens/month** against a GPT-4o-class blended $13/1M — described as "2–3 active coding days." Against reserved GPU capacity over 12 months, break-even sits at **2–5M tokens/day**.

> For a single-developer harness, the local 8B fleet is essentially **free at the margin** once the card exists. That, not API arbitrage, is the actual cost argument.

### 3.2 API prices, August 2026

*Confidence: MEDIUM. Aggregator sources; model names in this era are volatile. Verify before quoting.*

| Tier | Model | $/1M in | $/1M out |
|---|---|---|---|
| Frontier | Claude Opus 5 | 5.00 | 25.00 |
| Frontier | GPT-5.6 "Sol" | ~5.00 | 30.00 |
| Frontier reasoning (peak) | GPT-5.4 Pro | up to 30.00 | — |
| Mid | Claude Sonnet 5 | 2.00 → 3.00 (Sep 1) | 10.00 |
| Mid | GPT-5.4 | 2.50 | 15.00 |
| Small | Claude Haiku 4.5 | 1.00 | 5.00 |
| Small | Mistral Small 4 | 0.15 | 0.60 |
| Small | DeepSeek-V4 | 0.14 | 0.28 (cache-hit in ~0.003) |
| Micro | Gemini 2.5 Flash-Lite | 0.10 | 0.40 |
| Micro | Qwen3.7 Flash | **0.03** | **0.13** |

**Frontier-to-micro spread: ~100–170× on input, ~100–190× on output.**

### 3.3 Evaluating "50 parallel frontier models is not cost-effective"

Take a task needing 50 units of parallel work plus one synthesis. Assume each unit = 3K in / 1K out; synthesis = 30K in / 3K out.

| Architecture | Cost per task | Ratio |
|---|---|---|
| **A. 50× frontier fan-out + frontier synthesis** (Opus 5) | 50 × (3K×$5 + 1K×$25)/1M = **$2.00**; + synthesis (30K×$5 + 3K×$25)/1M = $0.225 → **$2.23** | **1.0×** |
| **B. 50× hosted-micro fan-out + frontier synthesis** (Qwen3.7 Flash workers) | 50 × (3K×$0.03 + 1K×$0.13)/1M = **$0.011**; + $0.225 → **$0.236** | **0.106× (9.4× cheaper)** |
| **C. 50× local 8B fan-out + frontier synthesis** | workers ≈ **$0.00** (electricity, sub-cent); + $0.225 → **~$0.23** | **0.10× (9.7× cheaper)** |
| **D. Single frontier call with structured retrieval** (10K in / 3K out) | (10K×$5 + 3K×$25)/1M = **$0.125** | **0.056× (17.8× cheaper)** |

**Reading of this table:**

- The reader's assertion is **correct in direction** — 50-way frontier fan-out is ~10× the cost of the same fan-out with small workers.
- But **the single frontier call with good structured retrieval is cheaper still (D beats B and C).** The synthesis call dominates the bill in every fan-out architecture. Fan-out only pays if it makes the synthesis call *better or shorter*.
- **The 50-way small fan-out and the 50-way local fan-out are within noise of each other in total cost**, because the frontier synthesis is 95% of the bill in both. Local hosting buys latency, privacy, and freedom from rate limits — it does not meaningfully move this number.

**The published reality check on cascades:**

| System | Claimed saving | Conditions |
|---|---|---|
| FrugalGPT (2023) | up to **98%** cost reduction | benchmark conditions, cascade with cheap-first |
| RouteLLM | **85%** cost reduction at 95% of GPT-4 quality on MT-Bench; routers transfer without retraining | benchmark |
| **UCCI (2026)** — *the honest number* | **31%** (95% CI [27%, 35%]) at micro-F1 0.91, on a **75,000-query production NER workload**, 4B vs 12B on H100s, **measured latency not nominal API prices** | production |
| UCCI, cost-ratio sensitivity | 31% @ ratio 3.02; **37%** @ 5.0; **42%** @ 10.0 | ibid. |

The UCCI authors explicitly note their results "use end-to-end routing on actual model outputs and measured H100 latency, **not simulated routing from global accuracies or nominal API prices**" — a direct shot at how the 98% numbers are produced. Their per-entity table also shows why fixed-rate escalation fails: the small-large gap ranges from **1.8 F1 points (focal length)** to **14.3 points (lens)** on the *same* workload.

**Also note the 2026 unified-evaluation finding:** router performance is highly benchmark-dependent; routers do best when eval distribution matches training distribution. A router tuned on someone else's traffic will not transfer to your harness.

### 3.4 Where parallel small sampling + verification actually beats one frontier call

| Result | Source |
|---|---|
| A **1B** model with **tool-based verification** outperforms an **8B** model on college-level math | KAIST & KRAFTON 2025, via secondary |
| Test-time and training-time compute are **partially substitutable**; budget-aware inference lets small models close the gap | [Scaling LLM Test-Time Compute Optimally, ICLR 2025](https://proceedings.iclr.cc/paper_files/paper/2025/file/1b623663fd9b874366f3ce019fdfdd44-Paper-Conference.pdf) |
| ELHSR lightweight hidden-state reward models beat baselines with **<0.005% of the parameters** | [arXiv 2505.12225](https://arxiv.org/html/2505.12225v1) |
| **The crucial caveat:** Vote and Filter-Vote performance is **non-monotonic** in the number of LM calls — it rises then *falls*. More calls help easy queries and *hurt* hard ones; mixed-difficulty tasks show a peak and then decline. | [Are More LM Calls All You Need?, arXiv 2403.02419](https://arxiv.org/abs/2403.02419) |

> **Design consequence:** best-of-N with a verifier is real, but **N is a tuned hyperparameter with an interior optimum, not "more is better."** Chen et al. show you can estimate the optimal N from a small number of samples. For a mixed-difficulty harness workload, expect the optimum to be small — single digits, not 50.

**The condition under which small-fan-out wins is precise:** the task must be *verifiable* (a Datalog query either compiles and returns rows, or it doesn't; an extracted fact either type-checks against the schema, or it doesn't). Where you have a cheap ground-truth oracle, parallel small sampling is excellent. Where the verifier is itself an LLM judge, §2.1 says you have replaced one uncertainty with another.

---

## 4. Architectures pairing small workers with a strong orchestrator

### 4.1 Routing and cascades

- **FrugalGPT** (Stanford 2023) — the origin: cheap model first, escalate on low confidence, up to 98% claimed reduction.
- **RouteLLM** — learned router, 85% cost cut at 95% GPT-4 quality on MT-Bench; routers trained on GPT-4/Mixtral pairs transferred to Claude-3-Opus/Llama-3 pairs without retraining. This transferability is the genuinely useful finding.
- **UCCI (2026)** — the current state of the art in *honest* cascade routing: isotonic regression maps token-level margin uncertainty to a calibrated per-query error probability; escalation threshold chosen by constrained cost minimisation. Reduces ECE **0.12 → 0.03** and beats entropy thresholding, split-conformal routing, and a FrugalGPT-style learned threshold at the same operating point. **Calibration, not the router architecture, is the lever.**

### 4.2 NVIDIA's position paper (arXiv 2506.02153) and what it actually claims

The reader's thesis has an institutional champion. Belcak et al., *Small Language Models are the Future of Agentic AI*:

| Claim | Number |
|---|---|
| Serving a 7B SLM vs a 70–175B LLM | **10–30× cheaper** in latency, energy, and FLOPs |
| Phi-2 (2.7B) | commonsense + code gen on par with 30B models, **~15× faster** |
| Phi-3 Small (7B) | matches 70B same-generation on language understanding |
| Nemotron-H (2/4.8/9B) | instruction-following + code gen comparable to dense 30B at an order-of-magnitude fewer inference FLOPs |
| Hymba-1.5B | **3.5×** token throughput; outperforms 13B on instruction following |
| xLAM-2-8B | SOTA tool calling, surpassing GPT-4o and Claude 3.5 |
| **MetaGPT** | **~60%** of LLM queries replaceable by specialised SLMs |
| **Open Operator** | **~40%** replaceable |
| **Cradle** | **~70%** replaceable |

**The S1–S6 conversion algorithm** — this is a directly usable blueprint for your harness:

1. **S1** Secure usage-data collection (encrypted logging of every LLM call in the agent).
2. **S2** Data curation and filtering — **10k–100k examples is sufficient**.
3. **S3** Task clustering — unsupervised clustering over prompts to discover the recurring sub-jobs.
4. **S4** SLM selection per cluster, by capability/benchmark fit.
5. **S5** Specialised fine-tuning — LoRA/QLoRA or full FT.
6. **S6** Iterate; retrain periodically.

**The paper's own stated counter-arguments** (they list these honestly):

1. Scaling laws still favour LLMs on general capability.
2. LLMs have a "semantic hub" for cross-domain abstraction that SLMs lack — *this is exactly the frontier-orchestrator job in your harness*.
3. Centralised LLM endpoints achieve lower per-token cost through economies of scale, partly offsetting the FLOP advantage.
4. Adoption barriers: sunk infrastructure investment, and SLMs are benchmarked as generalists rather than on task-specific evals.

**Responses to the paper** are largely enthusiastic secondary coverage ([Arize](https://arize.com/blog/nvidias-small-language-models-are-the-future-of-agentic-ai-paper/), [Galileo](https://galileo.ai/blog/small-language-models-nvidia), [Cobus Greyling](https://cobusgreyling.medium.com/nvidia-says-small-language-models-are-the-future-of-agentic-ai-f1f7289d9565)) rather than substantive rebuttal. Note the obvious institutional interest: NVIDIA sells the GPUs you'd run local SLM fleets on. The 40–70% replaceability figures are the paper's own estimates over three agent codebases, not third-party measurements.

### 4.3 Speculative patterns generalised to agents

- Token-level speculative decoding is now production infrastructure: **2–3× speedup** with **unchanged output quality**; NVIDIA reports **3.6×** throughput on H200; native support in vLLM and TensorRT-LLM; drafters propose 5–8 tokens verified in one target forward pass.
- Anthropic's Claude reportedly uses an internal draft model; Meta ships small Llamas usable as drafters for larger ones.
- **Agent-level analogue** exists in the literature ("Small Drafts, Big Verdict," [arXiv 2510.20812](https://arxiv.org/pdf/2510.20812)) but is far less mature than the token-level version.

> The token-level guarantee — *exact same output distribution* — is what makes speculative decoding safe. **The agent-level analogue has no such guarantee.** A small model drafting a plan that a frontier model "verifies" is not lossless; the frontier model is now anchored on the draft. Do not assume the token-level result transfers.

### 4.4 Distilling harness-specific skills into an 8B

The strongest concrete evidence is [arXiv 2606.08051](https://arxiv.org/abs/2606.08051), "How Small Can You Go? LoRA Fine-Tuning 270M–8B Models for Merchant Information Extraction":

| Model | Params | Best F1 | Inference (samples/s) |
|---|---|---|---|
| LLaMA 3.1-8B (rank-32 baseline) | 8B | **96.95%** | — |
| LLaMA 3.1-8B (rank-8) | 8B | 96.75% | 0.13 |
| Qwen 3.5 4B (JSON-only) | 4B | **96.60%** | 0.51 |
| Gemma 3 4B | 4B | 96.24% | 0.29 |
| Qwen 3.5 2B | 2B | 95.18% | 0.98 |
| Qwen 3.5 0.8B | 0.8B | **94.75%** | 1.32 |
| Gemma 3 1B | 1B | 93.93% | 2.16 |
| Gemma 3 270M | 270M | 87.35% | 4.09 |

- **LoRA rank 8 ≈ rank 32** (−0.20pp) at **4× smaller adapter**.
- **Total training cost: 462 GPU-hours** across 23 retained runs, plus 195h checkpoint eval, on one DGX Spark workstation. Fixed hardware breaks even against cloud "within a few hundred to a few thousand billable hours."
- **Benchmark→production transfer is reliable:** mean F1 change **−0.0081** across 14 sub-8B models on Databricks Model Serving. One exception (Aya 3.35B, −2.7 to −5.1pp) attributed to non-standard architecture.
- CoT during fine-tuning helps **+0.3 to +1.8 F1** for most models — **but Qwen 3.5 4B did better with JSON-only**, suggesting that at sufficient capacity CoT scaffolding is unnecessary for structured extraction.

> **Payoff calculation for your harness:** ~**10–40 GPU-hours** for a single task-specific LoRA (462h / 23 runs ≈ 20h per run), needing **10k–100k examples** per NVIDIA's S2. Those examples can be generated by the frontier model you already run — "use a large expensive model to label a narrow task, then fine-tune a cheap fast model on those outputs, capturing the large model's quality without paying its inference price." This is the highest-leverage move available and it is affordable on one workstation.

---

## 5. Failure modes of the small-subagent pattern

### 5.1 Error compounding

| Finding | Number | Source |
|---|---|---|
| Uncoordinated multi-agent error amplification | up to **17×** | [Augment Code](https://www.augmentcode.com/guides/why-multi-agent-llm-systems-fail-and-how-to-fix-them) *(secondary)* |
| Centralised architecture with a **validation bottleneck** | amplification contained to **~4.4×** | ibid. |
| Production failure rates for multi-agent LLM systems | **41–86.7%** | ibid. *(low confidence — vendor guide)* |
| MAST taxonomy: **14 failure modes in 3 categories** (system design, inter-agent misalignment, task verification), from 150 expert-annotated traces scaled to 1,600+ across 7 frameworks | Disobey task spec **11.8%**; step repetition **15.7%**; unaware of termination **12.4%** | [Why Do Multi-Agent LLM Systems Fail?, arXiv 2503.13657](https://arxiv.org/abs/2503.13657) |

**The 17× → 4.4× contrast is the single most actionable number in this section.** A centralised orchestrator that validates every subagent output before it enters shared state cuts error amplification by ~4×. For a Datalog graph this is nearly free: **every fact a small extractor proposes must type-check against the schema and pass integrity constraints before it is asserted.** The graph *is* the validation bottleneck. Use it.

Corollary risk, specific to your design: **a poisoned graph is worse than a poisoned context.** A bad chunk retrieved once affects one answer. A bad fact asserted once affects every future query that touches it, including the frontier model's. Facts need provenance (which extractor, which model, which source span, what confidence) and the ability to retract.

### 5.2 Coordination overhead eating the cost win

- Anthropic's own measurement: **agents use ~4× the tokens of chat; their multi-agent research system uses ~15×.** That system beat single-agent Claude Opus 4 by **90.2%** on internal eval — at ~15× tokens.
- **Token usage alone explains 80% of performance variance on BrowseComp**; tool-call count and model choice are the other two factors.
- Their stated economics: only viable for high-value research (legal due diligence, competitive intelligence, biomedical literature review). "Consumer-grade Q&A cannot absorb the multiplier."

> This is the sharpest counter to the reader's framing. Anthropic found that **for research-type tasks, the multi-agent premium is worth paying** — but the mechanism was *more tokens*, and the workers were frontier models. Swapping in 8B workers removes most of the token cost *and* most of the capability that produced the 90.2%. The design that survives both findings is: **small workers do bounded, verifiable transduction; the frontier orchestrator does all the reasoning and gets a large token budget.**

### 5.3 Small-model tool-calling failure rates

| Model | BFCL overall | BFCL multi-turn |
|---|---|---|
| Qwen3-0.6B (Prompt) | 45.76% | **1.38%** |
| xLAM-2-1b-fc-r (FC) | 53.97% | **8.38%** |
| Qwen3-1.7B (Prompt) | 55.49% | **16.88%** |

Source: [TinyLLM, arXiv 2511.22138](https://arxiv.org/pdf/2511.22138); [BFCL V4](https://gorilla.cs.berkeley.edu/leaderboard.html) (leaderboard itself is JS-rendered and not machine-fetchable).

Summary findings: **<1B fails outright** on multi-turn/parallel/multi-function; **1–3B is the edge sweet spot** for *single* function calls; **8–20B with extensive curated training is the best overall**. Below 7B you see low or zero tool-invocation rates, confabulated responses in place of tool use, and catastrophic failure on multi-step chains.

**Note the shape of the numbers:** overall accuracy degrades gracefully (45% → 55%) while multi-turn collapses (1.4% → 16.9%). Multi-turn tool use is not a harder version of single-turn — it is a different capability that small models essentially do not have.

### 5.4 The observed floor — what still needs a frontier model

| Job | Why 8B can't | Evidence |
|---|---|---|
| **Multi-step tool orchestration / planning** | multi-turn tool accuracy 1.4–16.9% at ≤1.7B; collapses well before you'd like | §5.3 |
| **Answering from retrieved context you don't already know** | 14.6% oracle EM at 7B; needs >7B for even 50% | §1.2 |
| **Cross-document synthesis at length** | effective context ≤2K–8K; 11/13 models at ≤half base score by 32K | §1.5 |
| **Agentic code editing** | best <100B open model is 70B at 41.0% SWE-bench-V vs 88.6% frontier | §2.1 |
| **Quality judgement / open-ended evaluation** | κ inflation: 0.80–0.85 exact match = κ≈0.48 | §2.1 |
| **Deciding what to ask the graph** (schema design, query decomposition, knowing what's *absent*) | no benchmark, but it is the "semantic hub" capability NVIDIA itself concedes SLMs lack | §4.2 |
| **Recovering from a failure it didn't anticipate** | MAST: unaware-of-termination 12.4%, step repetition 15.7% | §5.1 |

---

## 6. Synthesis: what this means for a Datalog-backed harness

**The architecture the evidence supports:**

```
                  frontier orchestrator (1 call, large token budget)
                         │  plans, decomposes, synthesises, decides
                         │  what to ask and what's missing
                         ▼
              ┌──── Datalog KG ────┐   ← schema is the validation bottleneck
              │  typed, constrained │      (17× → 4.4× error amplification)
              │  provenance-tagged  │
              └──────────┬──────────┘
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   8B extractor     8B query-gen     0.6B reranker
   (LoRA, schema-   (LoRA, compile-  (purpose-built,
    constrained)     and-retry)       not a chat LLM)
   96–97% F1        ~2/3 → ~90%      near-frontier
```

**Ten concrete decisions the evidence licenses:**

1. **Small models transduce; the frontier model reasons.** Never route "answer this from these facts" to an 8B.
2. **Every small-model output passes a mechanical gate before it enters the graph** — type-check, integrity constraint, or compile-and-run. This is the 17×→4.4× lever and Datalog gives it to you free.
3. **≤4K tokens of context per small-model call.** Hard ceiling 8K. The graph's job is precision, not recall.
4. **Name your Datalog predicates the way the pretraining corpus names things.** PA-Tool: +17% accuracy, −80% schema errors, training-free.
5. **Two-stage reason-then-format** for anything where constrained decoding costs correctness.
6. **Log every frontier call from day one (NVIDIA S1).** In 10k–100k examples you have a LoRA training set for whichever cluster turns out to dominate.
7. **Budget ~20 GPU-hours per task-specific LoRA.** Expect 4B to land within 0.35pp of 8B on extraction — so plan to *shrink* after you fine-tune, not before.
8. **N in best-of-N has an interior optimum.** Estimate it from samples; do not default to large N on mixed-difficulty work.
9. **Prefer one frontier call with excellent structured retrieval over any fan-out** unless the fan-out demonstrably shortens or improves that call. The synthesis call is 95% of the bill.
10. **Provenance and retraction on every asserted fact.** A poisoned graph outlives a poisoned context.

**What to prototype first, because the literature can't tell you:**
- text→Datalog accuracy at 8B, with and without a compile-and-retry loop.
- Extraction F1 at Q4_K_M vs FP16 on *your* schema.
- Whether your 50-way fan-out actually shortens the frontier synthesis call.

---

## 7. Source table

| # | Source | URL | Confidence |
|---|---|---|---|
| 1 | Can Small Language Models Use What They Retrieve? (2026) | https://arxiv.org/abs/2603.11513 | **HIGH** — primary, numbers extracted from tables |
| 2 | Small Language Models are the Future of Agentic AI (NVIDIA, Belcak et al.) | https://arxiv.org/abs/2506.02153 | **HIGH** — primary; note institutional interest |
| 3 | Don't Adapt Small LMs for Tools; Adapt Tool Schemas (PA-Tool) | https://arxiv.org/abs/2510.07248 | **HIGH** — primary |
| 4 | How Small Can You Go? LoRA 270M–8B for Extraction (2026) | https://arxiv.org/abs/2606.08051 | **HIGH** — primary, full results table |
| 5 | UCCI: Calibrated Uncertainty for Cost-Optimal Cascade Routing (2026) | https://arxiv.org/html/2605.18796 | **HIGH** — primary, production workload |
| 6 | Reliability without Validity: LLM-as-a-Judge at scale (2026) | https://arxiv.org/html/2606.19544v1 | **HIGH** — primary |
| 7 | NoLiMa: Long-Context Beyond Literal Matching | https://arxiv.org/html/2502.05167v3 | **HIGH** — primary |
| 8 | Why Do Multi-Agent LLM Systems Fail? (MAST) | https://arxiv.org/abs/2503.13657 | **HIGH** — primary |
| 9 | Are More LM Calls All You Need? (non-monotonicity) | https://arxiv.org/abs/2403.02419 | **HIGH** — primary |
| 10 | TinyLLM: SLMs for Agentic Tasks on Edge Devices | https://arxiv.org/pdf/2511.22138 | **HIGH** — primary (BFCL numbers) |
| 11 | Scaling LLM Test-Time Compute Optimally (ICLR 2025) | https://proceedings.iclr.cc/paper_files/paper/2025/file/1b623663fd9b874366f3ce019fdfdd44-Paper-Conference.pdf | HIGH |
| 12 | RULER: real context size of long-context LMs | https://github.com/NVIDIA/RULER | HIGH (benchmark), MEDIUM (the 8B figures, via secondary) |
| 13 | Intermediate Languages Matter: Formal Choice Drives Neurosymbolic Reasoning | https://arxiv.org/pdf/2502.17216 | HIGH |
| 14 | When Correct Isn't Usable: Structured Output Reliability in SLMs (2026) | https://arxiv.org/pdf/2605.02363 | MEDIUM — abstract only |
| 15 | The Constraint Tax (2026) | https://arxiv.org/pdf/2605.26128 | **LOW-MEDIUM** — PDF summary, model list looks anachronistic; do not quote the 5–15pp figure without re-checking |
| 16 | JSONSchemaBench | https://arxiv.org/pdf/2501.10868 | MEDIUM |
| 17 | Alpha-SQL / MSc-SQL / SLM-SQL / BASE-SQL (text-to-SQL by size) | https://arxiv.org/pdf/2502.17248, /2410.12916, /2507.22478, /2502.10739 | MEDIUM — via search summaries, not per-table verification |
| 18 | Neo4j Text2Cypher benchmark | https://neo4j.com/blog/developer/benchmarking-neo4j-text2cypher-dataset/ | MEDIUM |
| 19 | SynthCypher (+40% on 7–8B) | https://arxiv.org/html/2412.12612v1 | MEDIUM |
| 20 | Anthropic multi-agent research system (15× tokens, 90.2%) | https://www.anthropic.com/engineering/multi-agent-research-system (via secondary) | MEDIUM-HIGH — widely and consistently reported |
| 21 | GraphRAG vs vector RAG unified study (MSU/Meta) | https://venturebeat.com/orchestration/stop-graphing-everything-when-graphrag-actually-beats-vector-rag | MEDIUM — secondary |
| 22 | RAG survey (7B+retrieval > 70B closed-book) | https://arxiv.org/pdf/2404.10981 | MEDIUM — survey citing others |
| 23 | RouteLLM / FrugalGPT figures | via https://www.digitalapplied.com/blog/llm-model-routing-2026-cost-quality-optimization-engineering-guide | MEDIUM — secondary aggregation |
| 24 | 2026 API pricing | https://modelgrep.com/pricing, https://www.cloudzero.com/blog/llm-api-pricing-comparison/ | **MEDIUM** — aggregators; verify before committing |
| 25 | RTX 4090/5090 throughput + local TCO | https://markaicode.com/benchmarks/rtx-5090-inference-benchmark/, https://gigagpu.com/vllm-on-rtx-5090-max-throughput/, https://www.sitepoint.com/local-llms-vs-cloud-api-cost-analysis-2026/ | **LOW-MEDIUM** — sources internally inconsistent (48 vs 178 tok/s); order-of-magnitude only |
| 26 | Best open sub-10B roster 2026 | https://www.vellum.ai/open-llm-leaderboard, https://www.labellerr.com/blog/best-small-language-models-under-10b-parameters/ | **LOW-MEDIUM** — SEO aggregators; re-verify each model pin |
| 27 | Multi-agent error amplification 17× / 4.4× | https://www.augmentcode.com/guides/why-multi-agent-llm-systems-fail-and-how-to-fix-them | **LOW** — vendor guide, no methodology given; directionally consistent with MAST |
| 28 | SWE-bench Verified 2026 scores | https://epoch.ai/benchmarks/swe-bench-verified, https://arxiv.org/pdf/2502.18449 | MEDIUM-HIGH |
| 29 | Speculative decoding in production | https://introl.com/blog/speculative-decoding-llm-inference-speedup-guide-2025 | MEDIUM |
| 30 | Solver-in-the-loop ASP/Prolog generation | https://arxiv.org/pdf/2512.17093, https://neurosymbolic-ai-journal.com/system/files/nai-paper-877.pdf | MEDIUM |

### Known gaps in the evidence base

- **No published text-to-Datalog accuracy at any model size.** The nearest proxies are text-to-SQL (~2/3 zero-shot at 7B) and NL→ASP/Prolog neurosymbolic work.
- **No study isolating quantization impact on tool-calling or JSON-schema compliance for small models.** Measure it yourself.
- **BFCL V4 leaderboard is JS-rendered** and not fetchable; the small-model numbers here come from TinyLLM's reproduction, not the live board.
- **Agent-level speculative decoding** has no lossless-equivalence guarantee analogous to the token-level result. Treat "small drafts, big verifies" at the plan level as unproven.
- 2026-dated aggregator sources (pricing, model rosters, GPU throughput) are commercially motivated and mutually inconsistent. Every number marked LOW-MEDIUM above should be re-verified against a primary source before it drives a decision.
