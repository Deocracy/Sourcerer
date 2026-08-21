# How Agent Learnings Are Built — The Write-Side Pipeline

**Research track K — construction pipelines**
Date: 2026-08-21 · Sources: 2024–2026 primary literature (arXiv, ACL, ICML) plus practitioner reports

---

## Frame

The reader's current pipeline is **end-of-phase distillation**: an LLM reads a completed
project phase's artifacts and writes curated markdown entries (Decisions with rationale,
Lessons with root cause + context, Patterns with when-to-use, Surprises with impact), each
with provenance pointers.

This report maps every alternative construction method, the published evidence on write
quality, and what "better" looks like with citations.

**Headline finding.** End-of-phase distillation is a defensible and well-supported baseline —
it is essentially ExpeL/ReasoningBank's architecture applied to software phases. Its three
measured weaknesses are all fixable without changing the paradigm: (1) it learns
predominantly from what shipped rather than contrastively from what failed, (2) it has no
verification gate between "the LLM wrote an entry" and "the entry is in the store," and (3)
monolithic rewriting at phase boundaries invites brevity bias and context collapse. Each has
a named fix with published effect sizes.

---

## 1. The construction-method taxonomy

### 1(a) End-of-task / post-mortem distillation

The reader's current family. An LLM reads completed trajectories/artifacts and writes
durable entries.

**Reflexion** ([arXiv 2303.11366](https://arxiv.org/abs/2303.11366)) is the primitive: after
failing, the agent writes a natural-language post-mortem and prepends it to the next attempt.
No gradients, just a text file of self-critiques. Reported 91% pass@1 on HumanEval vs 80%
for GPT-4 without reflection. Note this is *within-task* retry memory, not cross-task
durable memory — it is the ancestor, not the same method.

**ExpeL** ([arXiv 2308.10144](https://arxiv.org/html/2308.10144v2)) is the closest published
analog to end-of-phase distillation and the most important single reference here. Its
insight-extraction stage is explicitly an *editing* operation over an existing entry set, not
a fresh write. The extractor LLM is given operators over the current insight set:

- `ADD` a new insight
- `EDIT` the content of an existing insight
- `UPVOTE` to agree with an existing insight
- `DOWNVOTE` to disagree

Each insight carries an **importance count** initialized to 2, incremented by UPVOTE/EDIT,
decremented by DOWNVOTE; **at zero the insight is deleted**. This is a lightweight
consolidation mechanism baked into the write path — entries earn their continued existence
across extraction runs rather than accumulating monotonically.

ExpeL's ablation is directly relevant: an agent extracting insights only from the initial
few-shot examples showed **no advantage over the ReAct baseline**. Insight quality is bounded
by experience diversity, not by extractor prompt quality. An agent gathering experience with
Reflexion (thus producing genuine fail/success pairs) outperformed one gathering with plain
ReAct (successes only).

**ReasoningBank** ([arXiv 2509.25140](https://arxiv.org/html/2509.25140v1), Google Cloud AI /
UIUC / Yale, Sept 2025) is the current state of the art in this family and the single best
template to copy. Its memory items use a fixed three-field schema — **title, description,
content** — and at most 3 items are extracted per trajectory. Crucially, it induces items
from *both* successful and failed trajectories, using an LLM binary classifier
(temperature 0.0 for determinism) to label the trajectory before extraction, with the
extractor itself run at temperature 1.0.

Measured results: on WebArena with Gemini-2.5-Flash, **+8.3 percentage points** overall
success rate over the memory-free baseline (40.5% → 48.8%), with average interaction steps
reduced by up to 1.4. Efficiency gains concentrate on *successful* trajectories — on the
Shopping subset it cut 2.1 steps from successful completions, a **26.9% relative
reduction** — confirming the agent finds the right path faster rather than merely abandoning
failures earlier. Combined with memory-aware test-time scaling (MaTTS), reported gains reach
**up to 34.2% relative effectiveness** with **16% fewer interaction steps**.

The retrieval ablation is a warning worth carrying: **success rate drops from 49.7% at k=1 to
44.4% at k=4**. Retrieving more memories actively hurt. The default is k=1. This means write
quality matters far more than write volume — a store where the single best-matching entry is
right beats a store where five plausible entries are returned.

| Method | Extraction unit | Learns from | Consolidation built in? |
|---|---|---|---|
| Reflexion | single failed attempt | failures | no (within-task only) |
| ExpeL | fail/success pairs + success sets | both | yes — vote/importance counts |
| ReasoningBank | per-trajectory, ≤3 items | both (LLM-judged) | via retrieval ranking |
| GSD-style end-of-phase | completed phase artifacts | mostly successes | manual |

**Verdict on 1(a).** Sound family, and end-of-phase distillation sits squarely in it. The gap
versus ReasoningBank/ExpeL is not the timing (end-of-task is fine) but the *inputs*: phase
artifacts are a record of what shipped. Failures, abandoned approaches, and reverted commits
are where the contrastive signal lives, and they are the part a phase's final artifacts
naturally omit.

---

### 1(b) In-situ capture vs retrospective reconstruction

**Direct A/B evidence is thin.** No paper cleanly isolates "flag the learning at the moment
it happens" against "reconstruct it from the transcript afterward" with matched entries. This
is a genuine gap in the literature and should be treated as such rather than assumed
settled.

What the literature does establish is the **credit-assignment asymmetry** that makes in-situ
capture attractive. From MemMA ([arXiv 2603.18718](https://arxiv.org/pdf/2603.18718)): the
core bottleneck is that feedback for memory construction is **sparse and delayed** — the
utility of a storage decision becomes observable only much later, when the agent fails.
In-situ capture provides *dense intermediate feedback* at the construction stage. MemMA's
mechanism is notable: rather than waiting for a future query to expose a memory failure, it
synthesizes **probe question-answer pairs after each session to verify and repair memory
before it is committed**.

The complementary practitioner finding is the **silent-failure problem**: unlike immediate
errors, a memory decision that stores the wrong thing produces slightly worse responses with
no obvious signal, and these compound. Diagnosing them requires detailed memory-operation
logs and retrospective analysis.

The emerging consensus architecture is **hybrid, not either/or**:

- a **fast, local, incremental write path** that captures candidate learnings while the agent
  works, non-blocking
- a **slow, global, reflective maintenance path** that consolidates asynchronously, since it
  does not block the current interaction

**Verdict on 1(b).** Recommend hybrid. The specific asymmetry that matters for the reader:
*surprises and failures decay fastest*. A surprise is surprising only relative to the
expectation held at that moment, and that expectation is precisely what a phase's final
artifacts no longer contain. Decisions and Patterns reconstruct fine at end-of-phase because
the artifacts encode them. Surprises and root-cause Lessons do not. Flag those in-situ; let
the rest wait. This claim is reasoned from the credit-assignment evidence, not directly
measured — flagged as such.

---

### 1(c) Continuous per-exchange extraction (Mem0-style)

Extract facts from every exchange as it happens.

Mem0 claims +26% accuracy over OpenAI Memory on LOCOMO with 91% faster responses and 90%
fewer tokens. **These numbers should be treated with caution.** Both Letta and Zep have
publicly challenged Mem0's benchmark methodology and SOTA claims; the vendor methodology
disagreement is unresolved.

The substantive write-quality critiques:

1. **Benchmark saturation masks write quality.** Small benchmarks like LoCoMo and
   LongMemEval can be materially improved by aggressive retrieval, larger context windows, or
   simply a frontier model — none of which means the memory *writer* improved. Mem0's own
   2026 state-of-the-field post concedes the next benchmark generation must measure "write
   quality, forgetting, isolation, and accuracy under realistic budgets."
2. **Fact extraction loses nuance.** Practitioners report fact-extraction memory stores
   explicit statements and fails to infer behavioral patterns — it captures what was said,
   not what it meant.
3. **Lossy extraction underperforms verbatim storage.** "Fidelity Before Structure"
   ([arXiv 2601.00821](https://arxiv.org/html/2601.00821v4)) found extracted-artifact
   pipelines trail **verbatim chunks by 15.9 points** on LoCoMo, and that graph expansion
   "mitigates the damage of extraction without repairing it." This is the sharpest published
   result against eager per-exchange extraction.
4. **Maintenance cost is a hidden scalability wall.** From the Anatomy of Agentic Memory
   empirical study ([arXiv 2602.19320](https://arxiv.org/html/2602.19320v1)): append-only
   systems incur minimal update cost, while structured architectures requiring LLM-driven
   consolidation after each interaction risk *throughput collapse*, where updates lag
   interactions and memory goes stale. MemoryOS measured **>32s latency** — impractical for
   interactive use.

**Verdict on 1(c).** Wrong fit for the reader's use case, and the evidence is unusually clear.
Per-exchange extraction targets conversational personalization (user preferences, facts about
a person), where the unit of value genuinely is a standalone fact. A project learning is a
*judgment with a rationale and a scope condition* — the thing fact extraction is measured to
be worst at. Do not adopt.

---

### 1(d) Workflow / procedure induction

Induce reusable procedures from trajectories rather than prose lessons.

**Agent Workflow Memory** ([arXiv 2409.07429](https://arxiv.org/abs/2409.07429), ICML 2025)
induces workflows — abstracted action templates — from successful trajectories into a
workflow library, retrieving relevant ones as procedural guidance. Results: **+24.6% relative
success on Mind2Web and +51.1% on WebArena**, with fewer steps on successful WebArena tasks.
Online AWM generalizes across task/website/domain, beating baselines by **8.9 to 14.0
absolute points** as train-test distribution gaps widen. It exhibits a "snowball effect"
where simple workflows compose into complex ones.

**AWM's documented limitation is the important part**: it learns *only* from successful
trajectories and has no mechanism for extracting lessons from failures, recoveries, or
inefficient executions. This is measurable, not theoretical — ReasoningBank's cross-domain
Mind2Web evaluation found **AWM fails to provide gains and even degrades** relative to the
no-memory baseline in the highest-transfer setting, while ReasoningBank (which learns from
both outcomes) improved. Success-only induction overfits to the procedures of the training
distribution.

**Voyager** ([arXiv 2305.16291](https://arxiv.org/abs/2305.16291)) contributes the single
most transferable result in this section, discussed in 1(g) below.

**Memp** ([arXiv 2508.06433](https://arxiv.org/abs/2508.06433)) treats procedural memory as a
first-class optimization object, systematically exploring build/retrieve/update strategies.

**Verdict on 1(d).** Partially applicable. The reader's "Patterns with when-to-use" entries
*are* induced procedures, and the when-to-use field is exactly the applicability condition
AWM's templates encode. Keep it. But heed the AWM-degrades-cross-domain result: a pattern
induced only from things that worked is a pattern with an unknown failure boundary. Pair
every Pattern with the counter-case that bounds it.

---

### 1(e) Consolidation passes

Periodic merge/generalize/prune over existing entries, separate from initial extraction.

**ACE — Agentic Context Engineering** ([arXiv 2510.04618](https://arxiv.org/html/2510.04618v1),
Stanford/SambaNova, Oct 2025) is the most directly actionable paper in this entire report.
It splits the write path across three roles:

- **Generator** — produces reasoning trajectories
- **Reflector** — distills concrete insights from successes and errors
- **Curator** — integrates insights into structured context updates

The separation is the point: it avoids overloading one model with evaluation *and*
integration. ACE's two mechanisms:

1. **Delta updates.** Localized, bullet-level insertions or replacements, explicitly avoiding
   global rewrites. New bullets get new identifiers and are appended; existing bullets are
   updated in place (e.g. incrementing counters).
2. **Grow-and-refine.** Deliberately grow the playbook to capture detail, then refine —
   dedup via **semantic embeddings**, prune — only when needed. Refinement can be proactive
   (after each delta) or lazy (only when the context window is exceeded).

Results: **+10.6% average over baselines on AppWorld**; offline, ReAct+ACE beats ReAct+ICL by
12.3% and ReAct+GEPA by 11.9%; online it beats Dynamic Cheatsheet by 7.6%. Critically for the
reader's setting, **ACE works without ground-truth labels**, achieving +14.8% average over
the ReAct baseline by leveraging naturally available execution signals — code execution
success or failure — to guide the Reflector. That is exactly the signal a software phase
emits for free (tests pass/fail, build succeeds, CI green).

Cost results make the case that consolidation is *cheaper*, not more expensive:

| Setting | Comparison | Latency reduction | Other |
|---|---|---|---|
| Offline (AppWorld) | ACE vs GEPA | **−82.3%** (53898s → 9517s) | −75.1% rollouts (1434 → 357) |
| Online (FiNER) | ACE vs Dynamic Cheatsheet | **−91.5%** (65104s → 5503s) | −83.6% token cost ($17.7 → $2.9) |

The savings come from delta updates plus **non-LLM-based merging and dedup** — embeddings do
the deduplication, not a language model.

**Sleep-time compute** ([arXiv 2504.13171](https://arxiv.org/html/2504.13171v1), Letta +
Stanford/Berkeley, April 2025) reframes consolidation as offline policy improvement: during
idle time, the agent improves its memory representations using data already collected,
without new environment interaction. It transforms "raw context" into "learned context." The
reported result is a Pareto improvement on the test-time compute/accuracy tradeoff — models
reach comparable performance with substantially less compute at test time. Letta's
implementation spawns a **sleep-time agent** alongside the primary agent, sharing memory
blocks, which reorganizes memory during downtime.

**Verdict on 1(e).** Highest-value addition to end-of-phase distillation, and the cost table
above removes the usual objection. See Upgrade #2.

---

### 1(f) Contrastive construction from failures vs successes

**The evidence that storing failures helps is strong and consistent.** ExpeL compares a
failed trajectory against a successful one *for the same task*, which "offers a concrete
understanding of the agent's shortcomings, highlighting the correct and incorrect actions."
ReasoningBank induces from both, where "failures supply counterfactual pitfalls that act as
negative signals." ACE's Reflector distills from "successes and errors." MCMA's ablation
found summarization (from successes) and reflection (from failures) each independently
improve performance, and combining them is best across all settings and model scales,
because they capture complementary aspects — **"learning what to do and what to avoid."**

**The critical counter-evidence — how failures are stored determines whether they help or
hurt.** This is the most important safety finding for the reader's pipeline.

Xiong et al., "How Memory Management Impacts LLM Agents"
([arXiv 2505.16067](https://arxiv.org/abs/2505.16067), ACL 2026) established the
**experience-following property**: high similarity between a task input and a retrieved
record's input produces highly similar agent *outputs*. Memory is imitated, not merely
consulted. Two failure modes follow:

- **Error propagation.** When an erroneous record is retrieved as a demonstration, its errors
  influence the current execution; if that execution is then stored, the error propagates to
  future tasks. Memory quality degrades autocatalytically.
- **Misaligned experience replay.** Seemingly correct executions can provide limited or
  actively misleading value as experiences.

Their headline mitigation: **combining selective addition with selective deletion yields a
10% absolute performance gain over naive memory growth.** Both halves are required — quality
gating on the way in, and pruning of what has gone stale.

The direct implication for storing failures: because agents *imitate* retrieved content, a
failure entry that narrates the failed approach in detail risks teaching it. The
literature-supported phrasing discipline:

- Lead with the **corrected rule**, not the failed narrative — the imperative first
- State the **trigger condition** (when does this apply?) explicitly and narrowly
- Keep the failed approach as a **bounded counter-example**, clearly marked as what *not* to
  do, subordinate to the rule
- Include the **root cause**, since that is what transfers; the symptom does not

The reader's existing "Lessons with root cause + context" schema is already close to correct.
The refinement is ordering and marking: rule first, failure marked as counter-example
second — never a neutral narrative of what happened, which reads to a retrieving agent as a
procedure to follow.

**Verdict on 1(f).** Store failures — the evidence is unambiguous — but treat phrasing as a
safety property, not a style preference. This is where end-of-phase distillation is weakest,
because completed-phase artifacts systematically omit the abandoned attempts. See Upgrade #1.

---

### 1(g) Self-training / critique loops — verify before commit

**Voyager** ([arXiv 2305.16291](https://arxiv.org/abs/2305.16291)) provides the cleanest
ablation on this question in the whole literature. New skills are added to the library
**only after self-verification confirms task completion**. GPT-4 acts as a critic, given the
agent's state and the task, and reports whether the program achieved it; if not, it critiques.

The ablation result: **removing self-verification led to buggy code accumulating in the
library.** Self-verification is the quality gate that keeps the store from degrading. This is
the empirical foundation for treating write-time verification as mandatory rather than
optional, and it composes with Xiong's error-propagation finding — an unverified store is one
where errors compound through retrieval.

**MemMA** synthesizes probe QA pairs after each session to verify and repair memory *before
commit* — the same principle applied to declarative rather than procedural memory. This is
the closest published analog to "adversarially test the entry against held-out episodes
before committing."

**Admission control.** "Memory as a Controlled Process"
([arXiv 2607.13591](https://arxiv.org/html/2607.13591v1)) decomposes memory admission as a
structured pre-storage decision over five interpretable factors: **future utility, factual
confidence, semantic novelty, temporal recency, and content-type prior**. A complementary
"Memory Worth" signal operates *after* repeated retrieval, tracking how stored memories
actually perform in practice — closing the loop from write to measured outcome.

**Verdict on 1(g).** The single highest-confidence upgrade available. Voyager's ablation is
unambiguous and the mechanism is cheap. See Upgrade #3.

---

## 2. Write-quality evaluation — how a written learning is measured

### MemAudit — the reference protocol

**MemAudit** ([arXiv 2605.02199](https://arxiv.org/html/2605.02199v1), Purdue, May 2026) is
the first protocol to isolate write quality from everything downstream. Its motivating
argument is directly relevant: existing evaluations measure final QA accuracy, which
**entangles memory writing with retrieval, prompting, and reader reasoning**. A better write
and a better retriever are indistinguishable in an end-to-end score.

The construct: a MemAudit *package* fixes an experience stream, candidate memory
representations, storage costs, semantic evidence units, future-query requirements, and a
budget — turning write-time memory selection into a **finite auditable optimization problem
with a certified denominator**. You can therefore ask "what fraction of the achievable
optimum did this writer capture?" rather than "did the system answer the question?"

Technical basis: a concave-over-modular semantic coverage objective (proven monotone
submodular) under storage and one-representation-per-experience constraints, with exact
optima from branch-and-bound, independently certified by MILP. The certification audit
reported **1,200/1,200 objective-value matches, max difference 0.0** between the two solvers —
the denominator is trustworthy. Greedy or learned references are never labeled OPT.

MemAudit evaluates exported **Mem0, A-Mem, and Letta** stores, and separates three things
end-to-end QA cannot localize: **representation quality, validity-state preservation, and
budget-aware selection effects**.

One proven result worth carrying into any scoring heuristic — **Proposition 4,
"density-only can be arbitrarily bad"**: a writer selecting entries by information density
(value per byte) can be driven arbitrarily far from optimal. Concretely, given budget B=2, a
dense-but-narrow candidate beats a costly-but-broad one on density while the optimum picks
the latter. **Do not rank candidate learnings by terseness or information density.** This is a
formal argument against the instinct to prefer compact entries, and it converges with ACE's
empirical brevity-bias finding from an entirely different direction.

**Caveat on the "writer hits 60–85% of optimal" framing** in the research brief: MemAudit
establishes the protocol and the certified denominator, and reports that real systems fall
short of optimum. A specific universal percentage band should not be quoted as an established
constant — it varies by package, budget, and system. The durable finding is the *method*
(certified denominator, write isolated from read) and the *direction* (deployed writers leave
material coverage on the table), not a fixed number.

### Supporting evaluation findings

**LLM-as-judge beats lexical metrics.** Anatomy of Agentic Memory
([arXiv 2602.19320](https://arxiv.org/html/2602.19320v1)) documents two systematic failure
modes of lexical scoring: the **Paraphrase Penalty** (correct abstractive answers punished
for low token overlap) and the **Negation Trap** (high overlap masking factual inversion). A
semantic judge kept architecture rankings stable across rubrics. If the reader scores entry
quality, score it semantically.

**Entry-level utility attribution.** Memory-R2
([arXiv 2605.21768](https://arxiv.org/html/2605.21768v1)) tackles fair credit assignment for
memory-augmented agents, improving LoCoMo F1 from 43.14 to 50.60 and BLEU-1 from 36.44 to
44.01 over Memory-R1, attributing gains to the training algorithm rather than added system
complexity. The framing to note: end-to-end memory compression creates a credit-assignment
problem because outcomes are **jointly determined** by memory updates, tool calls,
observations, and reasoning — credit for a memory update is causally entangled with
everything else. Tree-based credit assignment
([arXiv 2605.04811](https://arxiv.org/pdf/2605.04811)) and HiMPO
([arXiv 2606.16285](https://arxiv.org/pdf/2606.16285)) attack the same entanglement.

**Published metrics for rationale quality, trigger-condition precision, and provenance
completeness: none found.** This is a real gap. No benchmark scores whether a stored
rationale is *good*, whether a when-to-use condition is precisely scoped, or whether
provenance is complete. The closest proxies are MemAudit's coverage/validity decomposition
and A-MAC's five admission factors. A team wanting these metrics must define them locally —
which also means the reader's provenance-pointer discipline is ahead of what the literature
knows how to measure.

---

## 3. Generalization level at write time — episodic, semantic, or both

The tension: store the specific incident, the abstracted rule, or both linked?

### Evidence favoring linked-both, with a lazy bias

**Hierarchical storage is the converged answer.** The literature consistently organizes
memory into complementary levels: episodic memory preserving event-specific information,
semantic memory capturing abstract stable knowledge, and topic-level abstractions summarizing
recurring patterns. Episodic says *what happened in a case*; semantic says *what tends to hold
across cases*.

**MCMA** ([arXiv 2601.07470](https://arxiv.org/html/2601.07470)) is the strongest result on
abstraction level. Its diagnosis: most approaches store memory in fixed representations and
reuse it at **a single or implicit level of abstraction, which limits generalization and often
leads to negative transfer under distribution shift**. MCMA treats abstraction as a *learnable
skill* — a memory copilot trained via DPO decides how memories should be stored and at what
level, organizing them into multiple levels where lower levels retain fine-grained execution
detail and higher levels hold abstracted knowledge. Results: **ALFWorld +25.07%,
ScienceWorld +7.92%**, plus BabyAI gains, with improvements in robustness, OOD
generalization, and cross-task transfer. When no prior memory is reusable, the *copilot
itself* transfers, preserving the abstraction capability.

The key structural lesson: MCMA keeps **both levels linked** rather than choosing. Committing
to one abstraction level at write time is itself the failure mode.

**Lazy generalization has real empirical support.** The CBR review
([arXiv 2504.06943](https://arxiv.org/html/2504.06943v1)) states the classic position:
lazy learning, where generalization is delayed until a problem is actually encountered, is
"particularly well-suited for handling novelty" — the Retain phase stores problem-solution
pairs, and abstraction happens at reuse. This contrasts with eager upfront rule extraction.
Supporting this, one finding reports a **consistent preference for episodic over semantic
memory**, explicitly analogized to k-NN outperforming regression when data is abundant.

The empirical case against eager extraction is the "Fidelity Before Structure" result already
cited: extracted artifacts trailed verbatim chunks by **15.9 points**, and structure
"mitigates the damage of extraction without repairing it." Every abstraction step is lossy,
and the loss is not recoverable downstream.

**But pure-episodic fails the retrieval test.** ReasoningBank's cross-domain results show
strategy-level (semantic) memory transferring where AWM's procedure-level memory degraded.
Under-generalization produces entries that are correct but never retrieved because nothing
matches them.

### Practical resolution

| Approach | Transfers well | Fails by |
|---|---|---|
| Episodic only | near-identical situations | unretrievable trivia; no cross-context transfer |
| Semantic only | broadly, when correct | over-generalized wrong rules; negative transfer under shift (MCMA) |
| **Linked both** | **best measured (MCMA +25.07% ALFWorld)** | storage cost; link discipline required |

**Verdict on Q3.** Write both, link them, and let the abstraction be *revisable*. Concretely
for the reader: the abstracted rule is the retrievable surface, and the specific incident
(with its provenance pointer to the diff/test/commit) is what the rule is checked against
when it is reused and when it is later refined. The reader's existing provenance-pointer
design already implements the episodic half — the link is the asset. The refinement is to
treat the abstraction as a hypothesis that later episodes can sharpen or contradict, rather
than a conclusion fixed at write time.

---

## 4. LLM-specific write pathologies — named and measured

| # | Pathology | Named/measured by | What it does |
|---|---|---|---|
| 1 | **Brevity bias** | ACE (arXiv 2510.04618); Gao et al. | Optimization collapses toward short generic prompts. Documented in test-generation prompt optimization producing near-identical instructions ("Create unit tests to ensure methods behave as expected"), sacrificing diversity and omitting domain-specific detail. Also **propagates recurring errors across iterations**, since optimized prompts inherit their seeds' faults. |
| 2 | **Context collapse** | ACE (Figure 2) | Iterative monolithic rewriting by an LLM erodes multi-faceted strategies into shorter, less informative summaries, causing **sharp performance drops**. The trigger is *rewrite-the-whole-thing*, which is precisely what naive end-of-phase regeneration does. |
| 3 | **Density-only selection is unboundedly bad** | MemAudit Prop. 4 (formal proof) | A writer ranking candidates by value-per-byte can be driven arbitrarily far from optimal. Formal counterpart to brevity bias. |
| 4 | **Error propagation** | Xiong et al. (arXiv 2505.16067) | Retrieved erroneous records influence current execution; storing that execution propagates the error onward. Autocatalytic degradation. |
| 5 | **Misaligned experience replay** | Xiong et al. | Seemingly-correct executions provide limited or actively misleading value when replayed. Success is not a sufficient quality signal. |
| 6 | **Experience-following** | Xiong et al. | Agents *imitate* retrieved records rather than merely consulting them. This is what makes badly-phrased failure entries dangerous. |
| 7 | **Hindsight distortion / post-hoc rationalization** | CoT faithfulness literature | Reasoning retroactively constructed to justify a predetermined answer rather than reflecting the actual causal process. "Coherent rationales can be post-hoc fabrications." Direct threat to the "rationale" field of a Decision entry written after the fact. |
| 8 | **Sycophancy / positivity skew** | sycophancy literature | RLHF incentivizes agreement over accuracy. An agent grading its own completed phase is a structurally biased evaluator. |
| 9 | **Redundancy with pretrained knowledge** | SAGE (arXiv 2605.30711) | Writing what the model already knows. SAGE is the explicit fix — a novelty score used as a lightweight pre-filter upstream of any memory system, making a binary decision to **skip (Noop)** a candidate already explained by existing memory, or pass it through. |
| 10 | **Self-reinforcing error** | memory survey (arXiv 2603.07670) | The central risk of reflective memory: an agent that wrongly concludes "API X always fails with parameter Y" will keep acting on it, and keep confirming it. |
| 11 | **Format drift / schema burden** | Capacity Not Format (arXiv 2606.09410) | See below — schema complexity degrades weaker extractors monotonically. |
| 12 | **Maintenance-induced staleness** | Anatomy of Agentic Memory | Heavy per-write consolidation risks throughput collapse; updates lag interactions and memory goes stale (MemoryOS >32s). |

Pathologies 7 and 8 deserve emphasis because they are the two the reader's pipeline is
*most* exposed to and the two the memory literature discusses *least*. End-of-phase
distillation asks a model to explain, after the fact, why decisions were made in a phase
whose outcome it already knows. That is textbook hindsight conditioning, and the CoT
faithfulness literature says the resulting rationale can be coherent and wrong. The mitigation
is provenance-first construction (§5) — build the rationale from the commit message, the
review comment, the failing test that forced the change, rather than from a narrative
reconstruction.

---

## 5. Better-proposed methods on the 2025–2026 frontier

### 5.1 Schema-constrained extraction — helps or hurts?

**The answer is model-dependent, and the crossover is sharp.**

"Capacity, Not Format" ([arXiv 2606.09410](https://arxiv.org/html/2606.09410)) varied schema
complexity on a fixed task (MATH-Hard, 100 problems) across four levels: minimal
(answer-only, 73 chars), light (one reasoning field, 117), medium (structured steps, 177),
heavy (full nested, 1,774).

| Model | CoT (no schema) | Minimal | Light | Medium | Heavy |
|---|---|---|---|---|---|
| Sonnet 4.6 | 92.3 ±2.4 | 91.7 ±9.5 | 95.7 ±4.6 | 93.7 ±4.0 | 93.0† |
| Haiku 4.5 | 86.0 ±3.0 | 89.7 ±3.6 | 90.3 ±0.7 | 86.0 ±1.1 | **55.3 ±3.6** |
| GPT-4o | 56.3 ±1.7 | **17.0 ±2.3** | 58.7 ±1.7 | 54.3 ±1.3 | 42.3 ±3.5 |
| GPT-4o-mini | 59.0 ±3.9 | 53.7 ±4.0 | 58.3 ±2.6 | 47.1 ±5.8 | 36.3 ±3.5 |

†A replication audit produced 60% and 63% for Sonnet-heavy while all other Sonnet conditions
stayed stable; the authors attribute this to API serving-layer drift rather than a format
effect. Treat the Sonnet-heavy cell as uncertain.

Three readings:

1. **Strong models are largely immune** across light→heavy. Sonnet 4.6 stays ~93–96%.
2. **Weaker models degrade monotonically** with schema burden — the *capacity competition*
   mechanism. Haiku 4.5 falls off a cliff at heavy (90.3 → 55.3).
3. **Answer-only schemas are a distinct, worse failure**: they *suppress* reasoning rather
   than competing with it, explaining GPT-4o's collapse to 17.0%. A schema with **at least
   one free-text reasoning field is strictly better than a pure-structured one** — light was
   the best or near-best condition for every model tested.

Corroborating: grammar-constrained decoding "distorts the LLM's distribution toward
syntactically valid but semantically degraded outputs," and constrained decoding addresses
only *syntactic* validity, never whether extracted values are correct. JSONSchemaBench
([arXiv 2501.10868](https://arxiv.org/html/2501.10868v1)) evaluates 6 frameworks over 10K
real schemas on efficiency/coverage/quality; constrained decoding can speed generation ~50%,
but semantic errors persist even at full structural validity. The mitigation in the
literature is **hybrid**: reason freely first, then switch to constrained generation.

**Verdict.** Use a schema — but a *light* one with a free-text reasoning field, and reason
before formatting. The reader's four entry types (Decision/Lesson/Pattern/Surprise) with
prose rationale fields sit in the light-to-medium band, which is the measured sweet spot. Do
not add deeply nested required fields, especially if extraction ever runs on a smaller model.

### 5.2 Multi-pass write: draft → verify-against-transcript → commit

Supported by convergent evidence from three directions: Voyager's ablation (no
self-verification → buggy skills accumulate), MemMA's probe-QA verify-and-repair before
commit, and ACE's Reflector/Curator role split (evaluation separated from integration). The
ACE cost table shows the extra pass need not be expensive — ACE is *cheaper* than the
single-pass baselines it beats, because delta updates and embedding-based dedup replace
whole-context LLM rewrites.

### 5.3 Provenance-first construction

Build the entry **from the diff/test-result up**, not from narrative down. The literature
does not name this pattern, but three findings converge on it:

- ACE achieves +14.8% over baseline **without ground-truth labels** by using execution
  signals (code success/failure) to drive the Reflector — the artifact *is* the label
- the CoT-faithfulness literature says narrative rationales can be post-hoc fabrications
- "Fidelity Before Structure" shows verbatim source beats lossy extraction by 15.9 points

For a software phase, the execution signals are free and abundant: which test failed and its
message, what the diff actually changed, what the reverted commit tried, what the review
comment objected to. Anchoring each entry to one of these makes hindsight distortion much
harder — a rationale that must cite a specific failing test cannot drift into a plausible
story.

### 5.4 Rule induction from N episodes → one rule with N provenance links

The strongest structural idea, and the least well-served by existing tooling.

ExpeL implements the closest published mechanism: iteratively feeding the extractor
fail/success pairs and sampled success sets, with ADD/EDIT/UPVOTE/DOWNVOTE operators over the
existing insight set, and an importance counter that removes insights at zero. Validation is
therefore **incremental and vote-based** — an insight that recurs is upvoted, one contradicted
is downvoted out. ACE's grow-and-refine plays the same role via delta updates plus embedding
dedup, with counters incremented in place.

Neither paper reports a metric for induction *correctness* — whether the induced rule is
actually entailed by its N supporting episodes. That validation gap is real and unsolved.
MemAudit's certified denominator is the nearest available machinery but was not built for
this.

### 5.5 Human-in-the-loop curation economics

Practitioner reports, not measured studies — weight accordingly.

The recurring prescriptions: keep CLAUDE.md under ~300 lines focused on what the model would
otherwise get wrong; review MEMORY.md periodically rather than continuously; split into
topic files past ~200 lines; monthly review deleting anything referencing fixed bugs,
duplicating another entry, or never used again. The last criterion is a manual
implementation of "Memory Worth" — utility measured by actual retrieval.

The binding constraint reported by teams is that **review, not production, is the bottleneck**:
a single engineer running parallel agent sessions generates review volume faster than humans
can absorb it. This argues for machine-side gating (§5.2, SAGE novelty filtering) before
human review, so humans see candidates that are already novel and already verified.

---

## Construction-method decision matrix

| Method | Entry quality | Cost/entry | Latency to availability | Primary failure modes |
|---|---|---|---|---|
| **Reflexion-style post-mortem** | Low-moderate — narrative, unverified | Very low (1 LLM call) | Immediate | Hindsight distortion; within-task only; no consolidation |
| **End-of-phase distillation** (current) | Moderate — curated, provenance-linked | Low (1 pass/phase) | End of phase | Success-biased inputs; context collapse on rewrite; no verify gate; hindsight distortion |
| **ExpeL insight extraction** | Moderate-high — vote-consolidated | Moderate (iterative passes) | End of training set | Needs diverse experience; ablation shows no gain from few-shots alone |
| **ReasoningBank** | **High** — schema'd, both outcomes, judged | Moderate (classify + extract, ≤3/traj) | Per-task | LLM judge misclassifies outcome; k>1 retrieval hurts (49.7%→44.4%) |
| **Mem0-style per-exchange** | **Low** — lossy, nuance-blind | Very high (every exchange) | Immediate | 15.9pt below verbatim; throughput collapse; contested benchmarks |
| **AWM workflow induction** | High *for procedures* | Moderate | Offline or online | **Success-only; degrades cross-domain** |
| **Voyager skill + self-verify** | **High** — gated by execution | Moderate (+verify pass) | Per-skill | Needs executable verification; ablation: no verify → buggy library |
| **ACE grow-and-refine** | **High** — delta, no collapse | **Low** (−82% latency vs GEPA; embedding dedup) | Incremental | Store growth; needs dedup discipline |
| **Sleep-time consolidation** | High — global view | Amortized to idle | Deferred (idle window) | Staleness if idle never comes; infra cost |
| **MCMA multi-level abstraction** | **Highest measured** (+25.07% ALFWorld) | High (DPO-trained copilot) | Offline training | Requires training; heavy for small projects |
| **SAGE novelty gate** | N/A — a filter | Very low (score + skip) | Pre-write | Over-filtering genuine near-duplicates that differ in scope |

---

## The 3 most promising upgrades to end-of-phase distillation

Ordered by evidence strength × implementation cost.

### Upgrade 1 — Extract contrastively: feed failures, not just shipped artifacts

**Evidence.** ExpeL's ablation: insights from few-shots alone gave **no advantage over
ReAct**; the diverse-experience agent (fail/success pairs from Reflexion) beat the
successes-only one. ReasoningBank induces from both outcomes and gains **+8.3pp** on WebArena
where AWM — success-only — **degrades** in cross-domain transfer. MCMA: summarization and
reflection are complementary and jointly critical, "learning what to do and what to avoid."
Xiong: selective addition **plus** selective deletion = **+10% absolute** over naive growth.

**What changes.** The extractor's input set, not its prompt. A completed phase's artifacts are
a survivorship-biased sample. Feed it the reverted commits, the failing test runs that forced
a redesign, the review comments that rejected an approach, the abandoned branch. Where a
failure and its eventual fix both exist, present them **as an explicit pair** — that pairing
is ExpeL's core mechanism and is what produces a bounded rule rather than an unbounded one.

**Phrasing discipline (safety-critical, per experience-following).** Because agents imitate
retrieved records: lead with the corrected rule, state the trigger condition narrowly, keep
the failed approach as a clearly-marked bounded counter-example, and always include root
cause. Never a neutral narrative of what happened.

**Cost.** One pass, same as today. Only the inputs change.

### Upgrade 2 — Replace whole-file regeneration with ACE-style delta updates

**Evidence.** ACE names and measures both pathologies that whole-file rewriting causes:
brevity bias (collapse to short generic entries, which also **propagates errors across
iterations**) and context collapse (iterative rewriting erodes detail, "sharp performance
drops"). Delta updates plus embedding dedup fix both, and are *cheaper*: **−82.3% adaptation
latency and −75.1% rollouts vs GEPA** offline; **−91.5% latency and −83.6% token cost vs
Dynamic Cheatsheet** online. ACE gains **+10.6% average** on AppWorld and works **without
ground-truth labels** (+14.8% over ReAct) by using execution signals. MemAudit's Proposition 4
independently proves density-ranked selection can be arbitrarily far from optimal — a formal
argument against preferring terse entries.

**What changes.** Never regenerate the learnings file. Append new entries with stable
identifiers; update existing entries in place (increment a recurrence counter when a phase
re-confirms a known lesson); dedup with **embeddings, not an LLM**; prune lazily, only when
the file exceeds a size threshold. Split the write role: a Reflector that reads artifacts and
proposes insights, and a Curator that merges them into the file — never one model doing both
over the whole file.

**Cost.** Lower than today, per the table above. This is the rare upgrade that is cheaper.

### Upgrade 3 — Add a verify-before-commit gate with a novelty pre-filter

**Evidence.** Voyager's ablation is the cleanest result in the literature: skills are admitted
only after self-verification, and **removing it caused buggy code to accumulate in the
library**. MemMA synthesizes probe QA pairs to verify and repair memory **before commit**.
Xiong's error-propagation finding makes this compounding: an unverified bad entry gets
retrieved, imitated, and re-stored. A-MAC scores admission on five factors (utility,
confidence, novelty, recency, type prior). SAGE gates on novelty upstream of any memory
system, skipping candidates already explained by existing memory. Practitioners report review
volume, not production, as the bottleneck — machine gating protects human attention.

**What changes.** Two cheap checks between "LLM wrote an entry" and "entry is in the file":

1. **Novelty gate (SAGE-style).** Embed the candidate against existing entries. If already
   covered, either skip or convert to an in-place counter increment on the existing entry —
   which is also the Upgrade-2 recurrence signal. This is the redundancy fix and directly
   addresses "does the model already know this."
2. **Grounding check.** Every claim must cite its provenance pointer, and the pointer must be
   verified to exist and to actually support the claim. This is the direct antidote to
   hindsight distortion and sycophancy (§4 items 7–8): a rationale required to cite a
   specific failing test or diff cannot drift into a plausible story. Provenance-first
   construction (§5.3) is the same idea applied at draft time rather than check time.

**Cost.** Embedding call plus one verification pass. Voyager's ablation says this is the
difference between a library that stays useful and one that silently rots.

---

## What the evidence does *not* support

Stated plainly so these are not read into the report:

- **No published A/B of in-situ flagging vs retrospective reconstruction** with matched
  entries. The hybrid recommendation in §1(b) is reasoned from credit-assignment evidence,
  not measured.
- **No published metrics for rationale quality, trigger-condition precision, or provenance
  completeness.** These must be defined locally.
- **No validation metric for rule induction correctness** — whether an induced rule is
  entailed by its N supporting episodes. ExpeL's voting and ACE's counters are proxies.
- **Mem0's benchmark numbers are contested** by Letta and Zep; the methodology dispute is
  unresolved.
- **The "writer hits 60–85% of optimal" figure** should not be quoted as a constant. MemAudit
  establishes the certified-denominator method and the direction (writers leave coverage on
  the table); the specific band varies by package and budget.
- **The Sonnet-heavy schema cell (93.0)** failed replication (60%, 63%); authors attribute it
  to serving-layer drift.
- **Human-curation economics are practitioner reports**, not controlled studies.

---

## Sources

**Construction methods**
- [ExpeL: LLM Agents Are Experiential Learners](https://arxiv.org/html/2308.10144v2) — arXiv 2308.10144
- [ReasoningBank: Scaling Agent Self-Evolving with Reasoning Memory](https://arxiv.org/html/2509.25140v1) — arXiv 2509.25140 (Google Cloud AI / UIUC / Yale)
- [ReasoningBank writeup with reported numbers](https://www.marktechpost.com/2026/04/23/google-cloud-ai-research-introduces-reasoningbank-a-memory-framework-that-distills-reasoning-strategies-from-agent-successes-and-failures/) — MarkTechPost
- [Agent Workflow Memory](https://arxiv.org/abs/2409.07429) — arXiv 2409.07429, ICML 2025
- [Voyager: An Open-Ended Embodied Agent](https://arxiv.org/abs/2305.16291) — arXiv 2305.16291
- [Memp: Exploring Agent Procedural Memory](https://arxiv.org/abs/2508.06433) — arXiv 2508.06433
- [Reflexion](https://arxiv.org/abs/2303.11366) — arXiv 2303.11366
- [Trajectory-Informed Memory Generation](https://arxiv.org/html/2603.10600) — IBM, Feb 2026

**Consolidation and context evolution**
- [Agentic Context Engineering (ACE)](https://arxiv.org/html/2510.04618v1) — arXiv 2510.04618 (Stanford/SambaNova)
- [Sleep-time Compute](https://arxiv.org/html/2504.13171v1) — arXiv 2504.13171 (Letta)
- [Letta: Sleep-time Compute blog](https://www.letta.com/blog/sleep-time-compute)
- [SAGE: A Novelty Gate for Efficient Memory Evolution](https://arxiv.org/pdf/2605.30711) — arXiv 2605.30711
- [MemMA: In-Situ Self-Evolution](https://arxiv.org/pdf/2603.18718) — arXiv 2603.18718
- [The Consolidation Problem in Agent Memory](https://hindsight.vectorize.io/blog/2026/05/21/agent-memory-consolidation) — Vectorize/Hindsight

**Write quality and evaluation**
- [MemAudit: Exact Package-Oracle Evaluation for Budgeted Memory Writing](https://arxiv.org/html/2605.02199v1) — arXiv 2605.02199 (Purdue)
- [Anatomy of Agentic Memory](https://arxiv.org/html/2602.19320v1) — arXiv 2602.19320
- [Memory-R2: Fair Credit Assignment](https://arxiv.org/html/2605.21768v1) — arXiv 2605.21768
- [Memory as a Controlled Process (A-MAC)](https://arxiv.org/html/2607.13591v1) — arXiv 2607.13591
- [Tree-based Credit Assignment for Multi-Agent Memory](https://arxiv.org/pdf/2605.04811) — arXiv 2605.04811
- [Fidelity Before Structure: Verbatim Chunks Beat Lossy Artifact Extraction](https://arxiv.org/html/2601.00821v4) — arXiv 2601.00821

**Failure modes and pathologies**
- [How Memory Management Impacts LLM Agents: Experience-Following Behavior](https://arxiv.org/abs/2505.16067) — arXiv 2505.16067, ACL 2026 (Xiong et al.)
- [Where LLM Agents Fail and How They Can Learn From Failures](https://arxiv.org/abs/2509.25370) — arXiv 2509.25370
- [Memory for Autonomous LLM Agents: Mechanisms, Evaluation, Frontiers](https://arxiv.org/html/2603.07670v1) — arXiv 2603.07670
- [Chain-of-Thought Is Not Explainability](https://aigi.ox.ac.uk/wp-content/uploads/2025/07/Cot_Is_Not_Explainability.pdf) — Oxford AIGI
- [Unfaithful Explanations in Chain-of-Thought Prompting](https://papers.neurips.cc/paper_files/paper/2023/file/ed3fea9033a80fea1376299fa7863f4a-Paper-Conference.pdf) — NeurIPS 2023

**Abstraction level**
- [MCMA: Learning How to Remember](https://arxiv.org/html/2601.07470) — arXiv 2601.07470
- [Learning from Supervision with Semantic and Episodic Memory](https://arxiv.org/html/2510.19897v3) — arXiv 2510.19897
- [Review of Case-Based Reasoning for LLM Agents](https://arxiv.org/html/2504.06943v1) — arXiv 2504.06943

**Schema constraints**
- [Capacity, Not Format: Rethinking Structured Reasoning Failures](https://arxiv.org/html/2606.09410) — arXiv 2606.09410
- [JSONSchemaBench / Generating Structured Outputs from LMs](https://arxiv.org/html/2501.10868v1) — arXiv 2501.10868

**Practitioner**
- [Agent Memory Engineering](https://nicolasbustamante.com/blog/agent-memory-engineering) — Nicolas Bustamante, May 2026
- [State of AI Agent Memory 2026](https://mem0.ai/blog/state-of-ai-agent-memory-2026) — Mem0 (vendor; contested)
