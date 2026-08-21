# Agent Memory: Field Naming, Taxonomy, and Jargon

Research pass A — the vocabulary of the field. Compiled 2026-08-20. Sources are
2023–2026, weighted toward 2025–2026.

Framing note: this report is deliberately descriptive, not prescriptive. It maps
what the field calls things so that a later design pass can use the field's own
words instead of inventing private ones. Where a term is directly load-bearing
for a "distill each phase into a LEARNINGS file, then load it" workflow, that is
flagged inline as **[relevance]**.

---

## 1. What is this field called?

### 1.1 Verdict

**"Agent memory"** (also written "agentic memory") is the field name. It won
during 2025 and is now the term used by the two consolidating surveys, by the
commercial vendors, and by the benchmark papers.

The strongest evidence is that the December 2025 consolidating survey is simply
titled *Memory in the Age of AI Agents* (arXiv:2512.13564) and spends a section
explicitly drawing borders against the neighbouring terms — that is what a field
does once it believes it is a field. The February 2026 follow-up survey
(arXiv:2602.19320) uses "agentic memory" in its title. Both treat "agent memory"
and "agentic memory" as synonyms; "agent memory" is slightly more common in
academic titles, "agentic memory" slightly more common in vendor marketing.

### 1.2 The competing umbrella terms and where the boundaries lie

The *Memory in the Age of AI Agents* survey draws three explicit boundaries.
These are the cleanest published statements of scope in the field, so they are
worth quoting in structure:

| Term | What it covers | Boundary against "agent memory" |
|---|---|---|
| **Agent memory / agentic memory** | External, evolving cognitive state that persists across sessions and tasks and supports decision-making | The superset for this report |
| **LLM memory** | KV-cache management, architectural retention (Memorizing Transformers, RMT, state-space models) — memory *inside* the model | Model-internal; agent memory is model-external and system-level |
| **RAG (retrieval-augmented generation)** | Augmenting a single generation from a *static* external corpus | RAG's store is written once and read many times; agent memory's store is continuously rewritten by the agent's own experience |
| **Context engineering** | Treating the context window as a constrained resource to be optimally packed each turn | A *resource-management* framing. Agent memory is the broader *cognitive* framing — what the agent knows and how that evolves beyond any one window |

Two further umbrella terms are in use:

- **Cognitive architectures for LLM agents** — the academic framing, anchored by
  CoALA (arXiv:2309.02427, TMLR). This term predates the memory boom and is
  broader: memory is one of four components (memory, action space,
  decision-making, learning). Used by people who want the Soar/ACT-R lineage in
  view. Losing ground as a field label but still the standard citation for the
  memory *type* taxonomy.
- **Memory-augmented generation (MAG)** — coined by MemOS (arXiv:2505.22101) as
  a deliberate parallel to RAG, and picked up by the 2026 *Anatomy of Agentic
  Memory* survey as its unit of analysis ("MAG systems"). Narrower than agent
  memory: it names the inference-time pattern, not the discipline.
- **Memory-augmented LLMs / external memory** — older (2023–2024) and now mostly
  historical. "External memory" specifically carries the Neural Turing Machine /
  Differentiable Neural Computer / Memory Networks lineage (2014–2016), where
  memory was a differentiable read/write matrix attached to a network. That line
  did not survive into LLM practice; memory came back at the *system* level via
  RAG rather than as an architectural component. If you see "external memory"
  used unqualified today it usually just means "not in the weights".

### 1.3 Who uses which term

| Constituency | Preferred term |
|---|---|
| Academic surveys 2025–2026 | agent memory, agentic memory |
| Anthropic engineering | **context engineering**; memory appears as "structured note-taking, or agentic memory" — a *technique within* context engineering |
| LangChain / LangGraph | both: "context engineering" for the window, "long-term memory" (LangMem) for persistence |
| Letta (ex-MemGPT) | agent memory, "memory blocks", "sleep-time compute" |
| Mem0, Zep | agent memory / memory layer (product category framing) |
| CoALA lineage, cog-sci-adjacent authors | cognitive architectures for language agents |
| Infra/OS-metaphor authors (MemGPT, MemOS) | memory hierarchy, virtual context, memory OS |

**Key asymmetry to internalise:** Anthropic's house framing puts *context
engineering* on top and memory underneath it as one technique; the academic
surveys put *agent memory* on top and context engineering underneath it as the
window-packing sublayer. Both are defensible and neither is wrong — they are
looking at the same machinery from the resource side vs. the cognitive side.
**[relevance]** A LEARNINGS-file workflow sits exactly on that seam: the file is
a memory artifact, the decision of what to load is context engineering.

### 1.4 The term "context engineering" — provenance

Not an academic coinage. Tobi Lütke (Shopify CEO) posted it on X on 2025-06-19
("the art of providing all the context for the task to be plausibly solvable by
the LLM"); Andrej Karpathy amplified it days later ("the delicate art and
science of filling the context window with just the right information for the
next step"). Walden Yan at Cognition had used it earlier in 2025. It went
mainstream in mid-2025 as the declared successor to "prompt engineering". The
academic follow-up is *Context Engineering 2.0* (arXiv:2510.26493), which
retro-fits a history and a formal definition ("the context window as a
constrained computational resource").

---

## 2. The canonical memory taxonomy

There is no single taxonomy — there are three overlapping ones, and confusion
between them is the field's main terminological hazard. The 2025 survey says so
directly: "the field suffers from loosely defined terminologies and inconsistent
usage of concepts like *declarative*, *episodic*, and *semantic* memory across
different works."

### 2.1 Axis 1 — Cognitive type (episodic / semantic / procedural)

**Lineage.** Endel Tulving, *Episodic and Semantic Memory* (1972), split
long-term memory into episodic (personally-experienced events, time-stamped) vs.
semantic (generalised world knowledge, de-contextualised). Both are subtypes of
**declarative** memory in the Squire tradition, which contrasts declarative
against **procedural** (skills, know-how). Tulving later (1985) attached
consciousness types: procedural = *anoetic* (non-knowing), semantic = *noetic*
(knowing), episodic = *autonoetic* (self-knowing). Working memory as a distinct
system comes from Baddeley & Hitch (1974); the short-term/long-term split from
Atkinson–Shiffrin (1968).

**Import into LLM agents.** CoALA (Sumers, Yao, Narasimhan, Griffiths, 2023) is
the citation that did this. It maps a language agent onto working + episodic +
semantic + procedural memory and defines internal actions over them: *retrieval*
(read from long-term), *reasoning* (update working memory via the LLM), and
*learning* (write to long-term). Nearly every later taxonomy inherits from here.

Applied definitions as used in practice (LangMem's are the clearest
industry-side statement):

| Type | Cog-sci meaning | LLM-agent operationalisation | Typical storage |
|---|---|---|---|
| **Working** | Baddeley's active buffer | The context window itself, plus a scratchpad / notes file | In-context |
| **Episodic** | "What happened to me, when" | Past interaction traces, trajectories, successful/failed attempts with their circumstances | Vector store of raw or lightly-processed events; often timestamped |
| **Semantic** | "What is true" | Extracted facts, user preferences, entity/relationship graphs, distilled domain knowledge | Vector store, KV store, or knowledge graph |
| **Procedural** | "How to do it" | System prompts, rules, reusable code skills, workflows — *behaviour* rather than content | Prompt text, skill files (SKILL.md), code libraries |
| **Sensory** | Raw perceptual buffer | Rarely used; appears in a few surveys (multimodal raw input buffers) | — |

Two 2026 surveys reduce this to a three-way *functional* cut that is arguably
cleaner: **factual / experiential / working** (Memory in the Age of AI Agents).
Factual ≈ semantic; experiential ≈ episodic + procedural-learned-from-episodes;
working ≈ the window. Worth knowing because it dissolves the perennial
"is a distilled lesson episodic or semantic?" argument by putting both under
*experiential*.

**[relevance]** A LEARNINGS file is a hybrid the canonical taxonomy handles
badly: a "decision" entry is semantic (a fact about the project), a "surprise" is
episodic (a thing that happened), a "pattern" is procedural (do it this way next
time). The *experiential* label from the 2026 surveys covers all three; the
LangMem trichotomy would force you to split the file three ways. This is a real
design fork, not a naming quibble.

### 2.2 Axis 2 — Temporal horizon (short-term/working vs. long-term)

The oldest and least informative split. Short-term = in the current context
window (also "in-context memory", "core memory" in Letta terms, "working
memory"). Long-term = persisted outside it, retrieved on demand. The 2025 survey
explicitly says this binary "proves insufficient for capturing the diversity of
contemporary memory systems" — cited here mainly so you recognise it as legacy
framing when a blog post leads with it.

Sub-vocabulary worth having:
- **Core memory / memory blocks** (Letta) — a labelled, character-capped region
  of the context window that is *always* present and that the agent can rewrite
  with tools. The always-in-context tier.
- **Recall memory** (MemGPT) — searchable recent message history.
- **Archival memory** (MemGPT) — searchable arbitrary long-term text store.

### 2.3 Axis 3 — Substrate (parametric vs. non-parametric / contextual)

**Lineage.** Lewis et al., RAG (2020) coined the pairing: *parametric memory* =
knowledge in the seq2seq model's weights; *non-parametric memory* = a dense
vector index of Wikipedia accessed by a neural retriever. RAG's thesis was the
hybrid.

Modern usage splits three ways, and the naming is not settled:

| Survey / system | Substrate categories |
|---|---|
| Lewis 2020 (RAG) | parametric / non-parametric |
| Du et al. 2025 (arXiv:2505.00675) | **parametric** (implicit in weights) / **contextual** (explicit external, structured or unstructured) |
| MemOS 2025 | **parametric** (weights) / **activation** (KV caches, hidden states) / **plaintext** (editable external text) |
| Memory in the Age of AI Agents 2025 | **token-level** (human-readable text) / **parametric** (weights, incl. adapters) / **latent** (KV caches, hidden states) |

The three-way version (weights / activations / text) is now dominant and is the
more useful one, because "non-parametric" was doing too much work. Note that
"latent memory" and "activation memory" are the same thing under two names.

The 2025 survey adds a *structural* sub-axis for token-level memory:
**flat (1D)** = a list of items; **planar (2D)** = graphs and trees;
**hierarchical (3D)** = multiple abstraction layers stacked.

**[relevance]** A markdown LEARNINGS file is token-level, non-parametric,
plaintext memory. Currently flat-loaded; a redesign is essentially a choice
among flat / planar (link the entries) / hierarchical (summary layer over
detail layer).

### 2.4 Axis 4 — Subject (user-centric vs. agent-centric)

From *Rethinking Memory Mechanisms of Foundation Agents in the Second Half*
(arXiv:2602.06052). Under-used but sharp: most commercial memory products
(Mem0, OpenAI memory, Zep) are **user-centric** — they remember facts about the
human. Coding-agent memory is **agent-centric** — the agent remembers about the
*work* and about *its own past behaviour*. The benchmarks (LoCoMo, LongMemEval)
are almost entirely user-centric conversational recall, which is why they
transfer poorly to a coding-agent setting.

**[relevance]** This is the single most useful distinction for a LEARNINGS-file
design: nearly all published memory benchmark numbers are measuring something
structurally different from what a project-knowledge file does. Be wary of
importing architectures tuned to LoCoMo.

### 2.5 Axis 5 — Operations (the dynamics)

Du et al. (arXiv:2505.00675) define six atomic operations, which is the field's
most-cited operation vocabulary:

1. **Consolidation** — turn raw experience into a stored memory
2. **Updating** — revise an existing memory with new information
3. **Indexing** — build the access structures (embeddings, graph edges, keys)
4. **Forgetting** — remove or decay
5. **Retrieval** — fetch relevant memories
6. **Condensation** — compress memories to fit budget

The *Memory in the Age of AI Agents* survey uses a coarser three-phase framing:
**formation → evolution → retrieval**.

The practical implementation vocabulary (Mem0 and descendants) is a four-verb
LLM-decided write policy: **ADD / UPDATE / DELETE / NOOP**.

---

## 3. Glossary

Definitions below are the field's usage, not dictionary usage. Where a term has
a specific coining paper, it is named.

| Term | Definition | Origin / who uses it |
|---|---|---|
| **Agent memory** | External, persistent, evolving state that lets an agent carry knowledge across sessions and tasks | Field name; arXiv:2512.13564 |
| **Context engineering** | Systematic optimisation of what occupies the context window each turn, treating the window as a scarce computational resource | Lütke/Karpathy 2025-06; formalised arXiv:2510.26493 |
| **Context window management** | The mechanical subset of context engineering: eviction, ordering, truncation, budget accounting | General |
| **Working memory** | Whatever is currently in the context window (plus a scratchpad) | Baddeley 1974 → CoALA |
| **Episodic memory** | Records of specific past events/interactions, with their circumstances; "what happened" | Tulving 1972 → CoALA, LangMem |
| **Semantic memory** | De-contextualised facts and knowledge; "what is true" | Tulving 1972 → CoALA, LangMem |
| **Procedural memory** | Behaviour rules and reusable know-how — system prompts, skills, workflows; "how to do it" | Squire/Tulving → CoALA; SKILL.md, AGENTS.md in practice |
| **Declarative memory** | Umbrella for episodic + semantic | Squire; used inconsistently in LLM papers |
| **Parametric memory** | Knowledge stored in model weights | Lewis et al. 2020 |
| **Non-parametric memory** | Knowledge stored outside the weights, retrieved at inference | Lewis et al. 2020 |
| **Contextual memory** | Modern replacement for "non-parametric": explicit external memory, structured or unstructured | Du et al. arXiv:2505.00675 |
| **Activation / latent memory** | Information carried in KV caches and hidden states — neither weights nor text | MemOS; arXiv:2512.13564 |
| **Token-level memory** | Memory stored as human-readable text units. Sub-typed flat (1D) / planar (2D, graphs & trees) / hierarchical (3D) | arXiv:2512.13564 |
| **Memory consolidation** | Converting raw experience into durable stored memories; in practice ≈ extraction + summarisation + deduplication | Cog-sci term; Du et al. operation #1 |
| **Reflection** | An LLM pass over recent memories that synthesises higher-level insights, which are themselves written back as memories (recursive) | Generative Agents (Park et al. 2023) |
| **Self-reflection / verbal RL** | Converting task feedback into natural-language critique stored in an episodic buffer, to improve the next attempt without weight updates | Reflexion (Shinn et al. 2023) |
| **Summarisation** | Lossy compression of a span of history into shorter text | General |
| **Compaction** | Summarising a nearly-full conversation and restarting a fresh context window from the summary | Anthropic engineering; now standard in coding agents |
| **Condensation** | Survey term for the general compress-to-fit-budget operation | Du et al. operation #6 |
| **Structured note-taking** | The agent writes notes to a file outside the window and re-reads them later (NOTES.md, to-do lists) | Anthropic's name for the simplest agentic memory |
| **Scratchpad** | A place the model writes intermediate work that it then reads back | Nye et al. 2021, *Show Your Work* (arXiv:2112.00114); pre-dates chain-of-thought |
| **RAG** | Retrieval over a (mostly static) external corpus injected into the prompt before generation | Lewis et al. 2020 |
| **GraphRAG** | RAG where the index is an LLM-extracted entity knowledge graph, hierarchically clustered into communities, with pre-generated community summaries used to answer *global* questions | Microsoft, arXiv:2404.16130; the term is now generic |
| **Local vs. global query** | Local = answerable from specific retrieved chunks; global = requires sensemaking over the whole corpus ("what are the main themes?") | GraphRAG paper |
| **Query-focused summarisation (QFS)** | Summarising a corpus *with respect to* a question — the task GraphRAG targets | Pre-LLM IR term, revived by GraphRAG |
| **Temporal knowledge graph** | A KG whose edges carry validity intervals, so facts can be superseded rather than overwritten | Zep/Graphiti, arXiv:2501.13956 |
| **Bi-temporal model** | Tracking *both* when an event occurred and when the system learned it; every edge gets both timelines | Graphiti; borrowed from database literature |
| **Entity resolution** | Deciding that two mentions refer to the same entity and merging them into one node | Classic data-integration term; in agent memory usually deterministic ID derivation (e.g. uuid5 of a normalised name) plus LLM description merging |
| **Memory write policy** | The rule set deciding what becomes a memory, how conflicts resolve, and when memories expire. Common policies: recency-wins, source-wins, confidence-wins | Practitioner term (Mem0, Zep, Hindsight) |
| **ADD / UPDATE / DELETE / NOOP** | The four-verb write decision an LLM makes per candidate memory | Mem0 and descendants |
| **Forgetting / decay** | Removal or weakening of memories over time or disuse; often modelled on the Ebbinghaus exponential forgetting curve | MemoryBank (arXiv:2305.10250) |
| **Eviction** | The context-window analogue of forgetting: removing items from the window (OS-flavoured wording) | MemGPT lineage |
| **Salience / importance scoring** | An LLM-assigned score for how significant a memory is, used as a retrieval-ranking term | Generative Agents (Park et al. 2023) |
| **Recency–importance–relevance** | Generative Agents' retrieval score: `α_rec·recency + α_imp·importance + α_rel·relevance`, with recency an exponential decay and relevance a cosine similarity | Park et al. 2023 |
| **Memory hierarchy / virtual context** | The OS metaphor: the context window is RAM, external stores are disk, and the agent pages data between them via function calls | MemGPT (arXiv:2310.08560) |
| **Main context / external context** | MemGPT's names for in-window vs. out-of-window storage | MemGPT |
| **Recall storage / archival storage** | MemGPT's two external tiers: recent message history vs. arbitrary long-term text | MemGPT |
| **Memory blocks / core memory** | Letta's labelled, size-capped, always-in-context regions the agent rewrites with tools | Letta |
| **Self-editing memory** | The agent has tools to rewrite its own memory rather than a pipeline doing it | MemGPT → Letta |
| **Sleep-time compute** | A background agent that shares memory with the primary agent and reorganises it asynchronously, off the critical path | Letta 2025 |
| **Hot path vs. background memory formation** | Whether memory is written by tool calls during the conversation (hot path) or extracted asynchronously afterwards (background) | LangMem |
| **In-context learning (ICL)** | Behaviour change from information present in the prompt, with no weight update; vanishes when the context is removed | Brown et al. 2020 (GPT-3) |
| **Lost in the middle** | Retrieval accuracy is high when the relevant document is at the start or end of a long context and drops 20–30 points in the middle — a U-shaped curve | Liu et al. 2023 |
| **Needle in a haystack (NIAH)** | Eval method: bury a fact at varying depths in a long filler document and test retrieval | Community eval (Kamradt 2023); now a standard long-context test |
| **Context rot** | Measured degradation of output quality as input length grows, *even well below* the window limit and on trivial tasks | Chroma, 2025 |
| **Context pollution** | Irrelevant or stale content in the window degrading behaviour | Anthropic engineering |
| **Context collapse** | Failure mode where iterative monolithic rewrites of a context progressively destroy accumulated detail | ACE (arXiv:2510.04618) |
| **Brevity bias** | The tendency of summarisation-based context updates to shed specifics in favour of short generic statements | ACE |
| **Incremental delta updates** | Editing a context as itemised bullets with small merges, instead of rewriting the whole block — the fix for context collapse and brevity bias | ACE |
| **Grow-and-refine** | Letting a context grow with new items and periodically deduplicating/pruning, rather than compressing eagerly | ACE |
| **Memory-augmented generation (MAG)** | The RAG-parallel name for inference augmented by an evolving memory store | MemOS (arXiv:2505.22101) |
| **MemCube** | MemOS's unit abstraction: memory content plus provenance/versioning metadata, migratable between substrate types | MemOS |
| **Skill library** | A growing store of reusable, executable, composable skills the agent writes and later retrieves — procedural memory as code | Voyager (arXiv:2305.16291) |
| **Skill / SKILL.md** | A versionable, retrievable unit of procedural memory at uniform granularity, loaded on demand (progressive disclosure) | Agent Skills format, 2025–2026 |
| **Progressive disclosure** | Exposing only a skill's name/description until it is needed, then loading the body — keeps a large procedural library out of the window | Agent Skills |
| **Write / select / compress / isolate** | LangChain's four-bucket taxonomy of context-engineering strategies | Lance Martin / LangChain, 2025 |
| **Experiential memory** | Memory of the agent's own past *doing*, as distinct from facts about the world or the user | 2026 surveys |
| **Test-time learning / test-time training** | Improving during deployment rather than during training | TTT literature → NeurIPS 2026 TTCL workshop |
| **Stability–plasticity dilemma** | The trade-off between retaining old competence and absorbing new experience; reappears in memory systems as old vs. new memories competing for retrieval bandwidth | Continual-learning literature |

---

## 4. Papers table — the canon

Ordered roughly by lineage. "Coined" lists the terms the paper is cited for.

| Paper | Year | Coined / owns | Core idea (one paragraph) |
|---|---|---|---|
| [Tulving, *Episodic and Semantic Memory*](https://www.scirp.org/reference/referencespapers?referenceid=2919588) | 1972 | episodic, semantic | Split long-term memory into memory for personally-experienced, time-stamped events (episodic) versus de-contextualised general knowledge (semantic). Later elaborated so the two interact rather than partition cleanly, and extended in 1985 with awareness types (anoetic/noetic/autonoetic). This is the ancestor of essentially every LLM-agent memory taxonomy; the LLM literature imports the labels but usually not the interaction claim. |
| [Nye et al., *Show Your Work: Scratchpads for Intermediate Computation*](https://arxiv.org/abs/2112.00114) | 2021 | **scratchpad** | Training/prompting a model to emit intermediate steps into a "scratchpad" dramatically improves multi-step computation. Pre-dates and directly feeds chain-of-thought. The origin of "scratchpad" as the name for model-written intermediate state — which is what a working-memory notes file is a persistent version of. |
| [Lewis et al., *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks*](https://arxiv.org/abs/2005.11401) | 2020 | **RAG**, **parametric memory**, **non-parametric memory** | Combines a pre-trained seq2seq model (parametric memory) with a dense vector index of Wikipedia accessed by a neural retriever (non-parametric memory). The framing — that knowledge can live either in weights or in an indexed store, and hybrids beat either — is the substrate axis of every later taxonomy. Note RAG's store is static; that is precisely the boundary later drawn against agent memory. |
| [Park et al., *Generative Agents: Interactive Simulacra of Human Behavior*](https://dl.acm.org/doi/fullHtml/10.1145/3586183.3606763) | 2023 | **memory stream**, **reflection**, **importance score**, **recency–importance–relevance** | Simulated a town of 25 agents, each with a *memory stream* of natural-language observations. Retrieval scored each memory as a weighted sum of recency (exponential decay since last retrieval), importance (an LLM-assigned significance score), and relevance (cosine similarity to the query). Separately, a *reflection* step periodically prompts the LLM over recent memories to generate higher-level questions, answers them from memory, and writes the resulting insights back — producing a recursive abstraction hierarchy over raw experience. Both mechanisms are still the default reference design; "reflection" as a memory-system term traces here. |
| [Shinn et al., *Reflexion: Language Agents with Verbal Reinforcement Learning*](https://neurips.cc/virtual/2023/poster/70114) | 2023 | **verbal reinforcement learning**, **self-reflection** | Converts environment feedback (scalar or free-form) into a natural-language critique stored in an episodic memory buffer, which is prepended on the next attempt. Reinforcement without gradients: the "policy update" is text. The canonical citation for "an agent learns from failure without fine-tuning", and the template for any lessons-from-what-went-wrong artifact. |
| [Wang et al., *Voyager: An Open-Ended Embodied Agent with LLMs*](https://arxiv.org/abs/2305.16291) | 2023 | **skill library**, **procedural memory as code** | A Minecraft agent with three parts: an automatic curriculum, an ever-growing library of executable code skills, and an iterative prompting loop using execution errors and self-verification. Successful behaviours are banked as named, composable, retrievable programs. This is the origin of "skill library" and the strongest argument that procedural memory should be *executable and compositional*, not prose. Direct ancestor of today's SKILL.md/Agent Skills format. |
| [Zhong et al., *MemoryBank: Enhancing LLMs with Long-Term Memory*](https://arxiv.org/abs/2305.10250) | 2023 | **Ebbinghaus-curve forgetting**, memory strength | Adds a long-term memory with storage, retrieval, update, event summarisation and user-personality synthesis — and, distinctively, a forgetting mechanism modelled on the Ebbinghaus exponential decay curve, where memory strength increments on recall. The standard citation for principled decay/forgetting as opposed to unbounded accumulation. |
| [Sumers, Yao, Narasimhan, Griffiths, *Cognitive Architectures for Language Agents (CoALA)*](https://arxiv.org/abs/2309.02427) | 2023 (TMLR) | **CoALA**; the four-memory decomposition for agents | A conceptual framework, not a system. Decomposes a language agent into working / episodic / semantic / procedural memory, an action space split into external actions and internal actions, and a decision loop. Internal actions are *retrieval* (read long-term), *reasoning* (update working memory), and *learning* (write long-term). This is the paper that made Tulving's trichotomy the default vocabulary of LLM-agent memory, and the one to cite when defining terms. |
| [Packer et al., *MemGPT: Towards LLMs as Operating Systems*](https://arxiv.org/abs/2310.08560) | 2023 | **virtual context management**, **memory hierarchy**, **main/external context**, **recall/archival storage**, **self-editing memory** | Applies the OS virtual-memory metaphor: the context window is RAM (main context); a recall store (recent messages) and an archival store (arbitrary searchable text) are disk. The agent itself decides via explicit function calls what to page in and what to evict, and interrupts manage control flow. The single most influential *metaphor* in the field — every "memory tier", "paging", "eviction" usage descends from here. Evolved into the Letta framework; today "MemGPT" names the agent design pattern, "Letta" the platform. |
| [Liu et al., *Lost in the Middle: How Language Models Use Long Contexts*](https://www.semanticscholar.org/paper/1733eb7792f7a43dd21f51f4d1017a1bffd217b5) | 2023 | **lost in the middle** | Multi-document QA with the gold document placed at positions 1/5/10/15/20 of 20. Accuracy is highest at the start, nearly as high at the end, and drops 20–30 points in the middle — a U-shaped curve. The empirical foundation for "don't just stuff everything in", and the reason ordering and budget matter even with huge windows. |
| [Edge et al. (Microsoft), *From Local to Global: A Graph RAG Approach to Query-Focused Summarization*](https://arxiv.org/abs/2404.16130) | 2024 | **GraphRAG**, local vs. global queries | Standard RAG fails on *global* questions ("what are the main themes?") because they are query-focused summarisation, not retrieval. GraphRAG builds an LLM-extracted entity knowledge graph, partitions it into a hierarchy of communities (Leiden algorithm), pre-generates a summary per community, and answers global queries by map-reducing over relevant community summaries. Large gains in comprehensiveness and diversity on million-token corpora. The name is now generic for graph-indexed retrieval. |
| [Gutiérrez et al., *HippoRAG: Neurobiologically Inspired Long-Term Memory for LLMs*](https://arxiv.org/abs/2405.14831) | 2024 (NeurIPS) | **hippocampal indexing** for RAG | Models the neocortex as the LLM, an encoder as the parahippocampal region, and an open knowledge graph as the hippocampus; runs Personalized PageRank over the KG from query-linked entity seeds to perform single-step multi-hop retrieval. Up to 20% better than SOTA RAG, and 10–20× cheaper / 6–13× faster than iterative retrieval like IRCoT. HippoRAG 2 (2025) extends context integration; the companion paper is titled *From RAG to Memory: Non-Parametric Continual Learning for LLMs* (arXiv:2502.14802) — a good marker of the field's re-framing of retrieval as learning. |
| [Rasmussen et al., *Zep: A Temporal Knowledge Graph Architecture for Agent Memory*](https://arxiv.org/abs/2501.13956) | 2025 | **temporal knowledge graph** for agent memory, **bi-temporal model** | Zep's engine Graphiti incrementally builds a temporally-aware KG from conversation and business data. Every edge carries explicit validity intervals, and the model is *bi-temporal*: when the event happened and when the system ingested it are tracked separately. Facts are superseded, not overwritten, so history stays queryable. Beats MemGPT on DMR (94.8 vs 93.4) and improves LongMemEval accuracy up to 18.5% with ~90% lower latency. The reference design for "memory that must handle facts changing over time". |
| [Xu et al., *A-MEM: Agentic Memory for LLM Agents*](https://arxiv.org/abs/2502.12110) | 2025 (NeurIPS) | **agentic memory** (as a system property), Zettelkasten-for-agents | Rejects fixed memory schemas. Each new memory becomes an atomic note carrying LLM-generated contextual description, keywords and tags; the LLM then generates links to related existing notes, and — critically — *memory evolution*: a new note can trigger rewrites of the attributes and context of older notes, so the network continuously refines itself. Grounded in Zettelkasten principles (atomicity, flexible linking, continuous evolution). Reports 2×–6× multi-hop efficiency gains with token savings. The closest published analogue to a linked, self-revising set of distilled project notes. |
| [Chhikara et al., *Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory*](https://arxiv.org/abs/2504.19413) | 2025 (ECAI) | ADD/UPDATE/DELETE/NOOP write policy in production form | A two-phase pipeline — extract candidate facts from a conversation, then let an LLM decide per candidate among ADD (new), UPDATE (augment existing), DELETE (contradicts existing), NOOP (adds nothing). Mem0g adds a graph variant. Reports ~92.5 on LoCoMo and 94.4 on LongMemEval at 3–4× lower token cost than full-context. The most-copied *write policy* in the industry. |
| [Du et al., *Rethinking Memory in LLM based Agents: Representations, Operations, and Emerging Topics*](https://arxiv.org/abs/2505.00675) | 2025 | the six operations; **contextual memory** | Splits memory into parametric vs. contextual (structured/unstructured) and defines six atomic operations: consolidation, updating, indexing, forgetting, retrieval, condensation. Crossing the two axes yields four research areas: long-term, long-context, parametric modification, multi-source. The standard citation for operation vocabulary. |
| [Li et al., *MemOS: A Memory OS for AI System*](https://arxiv.org/abs/2507.03724) (earlier: [MemOS: An OS for Memory-Augmented Generation](https://arxiv.org/abs/2505.22101)) | 2025 | **MAG**, **MemCube**, parametric/activation/plaintext | Elevates memory to a first-class OS-managed resource across three substrates — parametric (weights), activation (KV caches, attention state), plaintext (editable external text) — unified by the *MemCube*, a standardised unit carrying content plus provenance and versioning metadata, which can be composed, migrated and fused, including *between* substrate types. Three-layer architecture (API / scheduling / storage). Source of the now-common three-way substrate split and of the "MAG" coinage. |
| [Zhang et al., *Agentic Context Engineering (ACE)*](https://arxiv.org/abs/2510.04618) | 2025 | **context collapse**, **brevity bias**, **incremental delta updates**, **grow-and-refine**, **playbook** | Stanford/SambaNova/Berkeley. Treats the context as a living, itemised *playbook* maintained by three roles — Generator (produces trajectories), Reflector (distils insights from successes and errors), Curator (merges insights as small structured deltas). Names two failure modes of naive rewrite-the-whole-summary approaches: *brevity bias* (specifics get compressed away) and *context collapse* (iterative monolithic rewrites destroy accumulated detail). Reports +10.6% on AppWorld, +8.6% on finance reasoning, ~86.9% latency reduction. **Directly relevant to any "distil learnings into a file" design** — it is the strongest argument against regenerating such a file wholesale each time. |
| [Hua et al., *Context Engineering 2.0: The Context of Context Engineering*](https://arxiv.org/abs/2510.26493) | 2025 | formal definition of **context engineering** | Retro-fits a history and a definition to the mid-2025 buzzword: the context window as a constrained computational resource, with the payload (instructions, knowledge, state, memory) rigorously optimised to bridge the gap between huge input capacity and limited effective use. The academic anchor to cite when the term is used. |
| [*Memory in the Age of AI Agents: A Survey*](https://arxiv.org/abs/2512.13564) | 2025-12 (rev. 2026-01) | **forms / functions / dynamics** taxonomy; scope boundaries | The consolidating survey. Organises the field along three dimensions: *forms* (token-level — flat 1D / planar 2D / hierarchical 3D; parametric — internal/external; latent — generate/reuse/transform), *functions* (factual, experiential, working), and *dynamics* (formation, evolution, retrieval). Explicitly delimits agent memory from LLM memory, RAG, and context engineering. Also compiles benchmarks and open-source frameworks and names the open frontiers: memory automation, RL integration, multimodal memory, multi-agent memory, trustworthiness. **The single best starting reference.** Paper list at [Shichun-Liu/Agent-Memory-Paper-List](https://github.com/Shichun-Liu/Agent-Memory-Paper-List). |
| [*Rethinking Memory Mechanisms of Foundation Agents in the Second Half: A Survey*](https://arxiv.org/abs/2602.06052) | 2026-02 | **substrate / cognitive mechanism / subject**; **user-centric vs. agent-centric** | Synthesises 218 papers from 2023Q1–2025Q4 into a three-axis frame: substrate (internal vs. external), cognitive mechanism (episodic/semantic/procedural/working/sensory), and *subject* — user-centric vs. agent-centric memory. The subject axis is the useful novelty: it separates "remember things about the human" products from "remember things about the work" systems. Frames memory as the enabler of self-evolving agents that learn from experience without retraining. |
| [*Anatomy of Agentic Memory: Taxonomy and Empirical Analysis of Evaluation and System Limitations*](https://arxiv.org/abs/2602.19320) | 2026-02 (rev. 2026-05) | the sceptical counterweight | Taxonomises MAG systems by four memory structures, then empirically attacks the field's evidence base: benchmarks are underscaled and saturating, metrics are misaligned with semantic utility, LLM-judge sensitivity distorts results, accuracy varies heavily by backbone model, and latency/throughput costs of memory maintenance are routinely unreported. Read this before believing any memory-system leaderboard. Repo: [FredJiang0324/Anatomy-of-Agentic-Memory](https://github.com/FredJiang0324/Anatomy-of-Agentic-Memory). |

### Benchmarks worth knowing by name

| Benchmark | What it measures | Note |
|---|---|---|
| [LoCoMo](https://arxiv.org/abs/2504.19413) (Maharana et al. 2024, popularised by Mem0) | Multi-session conversational recall: single-hop, multi-hop, temporal, open-domain. ~1,540 questions, ~300 turns / ~9,000 tokens per conversation over up to 35 sessions | Criticised by LongMemEval for short histories and for not testing recall of assistant-side information or updated user facts; also near-saturated by 2026 |
| [LongMemEval](https://arxiv.org/abs/2410.10813) (ICLR 2025) | 500 hand-written questions over five abilities: information extraction, multi-session reasoning, temporal reasoning, knowledge updates, abstention | Long-context LLMs drop 30–60% on it. The better of the two conversational benchmarks |
| DMR (Deep Memory Retrieval) | Retrieval from long dialogue history | Used by MemGPT and Zep; small and largely saturated |
| [Evo-Memory](https://arxiv.org/pdf/2511.20857) | Test-time learning with self-evolving memory across task streams | 2025; closer to agent-centric evaluation |

All conversational; all user-centric. There is no established benchmark for
project/work knowledge distillation, which is the gap a coding-agent LEARNINGS
workflow sits in.

---

## 5. How the field distinguishes "learning"

"The agent learns from experience" is ambiguous across at least six distinct
mechanisms. The field's current vocabulary:

| Mechanism | What actually changes | Names in use | Persistence | Cost |
|---|---|---|---|---|
| **Pre-training** | All weights | pre-training | Permanent | Enormous |
| **Fine-tuning / SFT** | Weights (or adapter weights) | SFT, PEFT, LoRA, "parametric modification", "in-weights learning" | Permanent | High; impossible for closed models; no continuous updating |
| **RLHF / RLAIF / RLVR** | Weights, via a preference or verifiable reward signal | RLHF, DPO, RLVR | Permanent | High; alignment-stage, not per-task |
| **In-context learning** | Nothing persists — behaviour changes only while the information is in the window | ICL, few-shot | Zero (evaporates when context clears) | Cheap per call, but pays tokens every call |
| **Retrieval / memory-as-learning** | An external store; behaviour changes because retrieval puts the right text in the window | non-parametric continual learning, experiential memory, memory-as-learning, "learning" in CoALA terms (write to long-term memory) | Durable, editable, inspectable | Cheap; the dominant practical option |
| **Context/prompt evolution** | The *instructions* themselves — a playbook or system prompt that is iteratively curated | procedural memory update, ACE, prompt evolution, self-evolving context | Durable | Cheap |
| **Skill acquisition** | A library of executable, composable programs | skill library, skill bank, Agent Skills | Durable, and *executable* rather than merely readable | Cheap; highest leverage where the task is codifiable |

Cross-cutting umbrella terms:

- **Continual learning / lifelong learning** — the classical ML framing;
  concerned with catastrophic forgetting and the stability–plasticity dilemma.
  The 2026 literature notes that external memory *appears* to sidestep this
  dilemma (nothing is overwritten, you just append) but does not actually: once
  behaviour depends on retrieval through a finite window, old and new memories
  compete for the same limited channel. That is the stability–plasticity
  trade-off in a new costume, and it is the core scaling problem for any
  append-only learnings store.
- **Test-time learning / test-time training (TTT)** — improving during
  deployment rather than during training. Now has a NeurIPS 2026 workshop
  (TTCL — Towards Test-Time Continual Learning Agents) explicitly aimed at
  "rethinking the boundaries between training and inference, memory and
  learning".
- **Self-evolving agents** — the 2025–2026 umbrella for systems that improve
  their own prompts, memory, tools, and configuration. EvoTest generalises this
  to whole-system evolution (prompt + memory + hyperparameters + tool routines).
- **Experiential learning** — ExpeL (arXiv:2308.10144) is the early citation:
  agents gather trajectories, extract cross-task insights, and reuse them
  without gradient updates.
- **Memento** (arXiv:2508.16153) — "fine-tuning LLM agents without fine-tuning
  LLMs": frames memory-based improvement as a memory-augmented MDP with
  case-based reasoning, which is the sharpest formal statement of
  memory-as-learning.

**The empirical point worth carrying forward:** 2026 work reports that direct
supervised fine-tuning on collected experience recovers only a few percent of
the gains that putting the *same* experience in context achieves. For learning
from a modest number of episodes, memory beats weights — decisively, and mostly
for sample-efficiency reasons. The tradeoff is that ICL gains vanish the moment
the experience leaves the window, which is exactly why the retrieval/write
policy is the whole ballgame.

Two named abstraction levels the 2026 literature separates within experiential
memory, worth adopting:

- **Experiences** — tactical, condition→action insights tied to specific
  contexts ("when the linker fails with a bogus rpath, check for a space in the
  repo path").
- **Skills** — higher-level procedural workflows and reusable templates,
  generalised beyond one situation.

**[relevance]** A LEARNINGS file with "decisions / lessons / patterns /
surprises" is already close to this split: lessons and surprises are
*experiences*; patterns are *skills*; decisions are semantic/factual memory and
arguably belong in a different store with different retrieval rules (decisions
are looked up by ID and must not decay; experiences are looked up by situational
similarity and should decay).

---

## 6. Terminological hazards

Things the literature genuinely disagrees about — worth naming so a design
discussion doesn't stall on them:

1. **"Episodic" is overloaded.** Some authors mean raw event logs; others mean
   distilled case memories ("this worked last time"); Reflexion means a buffer
   of self-critiques. The 2026 surveys' *experiential* label sidesteps this.
2. **"Agentic memory" means two different things.** In A-MEM it means the memory
   system is *itself* agentic (an LLM decides structure and links). In vendor
   copy it just means "memory for agents". Check which is meant.
3. **"Memory" vs. "context".** Anthropic nests memory under context
   engineering; the surveys nest context engineering under memory. Neither is
   authoritative.
4. **"Non-parametric" is being retired** in favour of contextual / plaintext /
   token-level, because the old binary can't name activation-level memory.
5. **"Consolidation"** in cog-sci means the stabilisation of a trace over time;
   in agent-memory practice it usually just means extraction + summarisation +
   deduplication at write time. The borrowed word promises more than the
   implementations deliver.
6. **Benchmark numbers are not transferable.** Per *Anatomy of Agentic Memory*:
   underscaled benchmarks, judge-sensitive metrics, strong backbone dependence,
   and unreported maintenance cost. Plus the user-centric/agent-centric mismatch
   from §2.4.

---

## Source list

Papers

- Lewis et al., RAG — https://arxiv.org/abs/2005.11401
- Nye et al., Scratchpads — https://arxiv.org/abs/2112.00114
- Park et al., Generative Agents — https://dl.acm.org/doi/fullHtml/10.1145/3586183.3606763
- Shinn et al., Reflexion — https://neurips.cc/virtual/2023/poster/70114
- Wang et al., Voyager — https://arxiv.org/abs/2305.16291
- Zhong et al., MemoryBank — https://arxiv.org/abs/2305.10250
- Sumers et al., CoALA — https://arxiv.org/abs/2309.02427
- Packer et al., MemGPT — https://arxiv.org/abs/2310.08560
- Liu et al., Lost in the Middle — https://www.semanticscholar.org/paper/1733eb7792f7a43dd21f51f4d1017a1bffd217b5
- Edge et al., GraphRAG — https://arxiv.org/abs/2404.16130
- Gutiérrez et al., HippoRAG — https://arxiv.org/abs/2405.14831
- Gutiérrez et al., From RAG to Memory (HippoRAG 2) — https://arxiv.org/pdf/2502.14802
- Rasmussen et al., Zep — https://arxiv.org/abs/2501.13956
- Xu et al., A-MEM — https://arxiv.org/abs/2502.12110
- Chhikara et al., Mem0 — https://arxiv.org/abs/2504.19413
- Du et al., Rethinking Memory in LLM based Agents — https://arxiv.org/abs/2505.00675
- MemOS (MAG) — https://arxiv.org/abs/2505.22101 and https://arxiv.org/abs/2507.03724
- ACE, Agentic Context Engineering — https://arxiv.org/abs/2510.04618
- Context Engineering 2.0 — https://arxiv.org/abs/2510.26493
- Memory in the Age of AI Agents — https://arxiv.org/abs/2512.13564
- Rethinking Memory Mechanisms of Foundation Agents in the Second Half — https://arxiv.org/abs/2602.06052
- Anatomy of Agentic Memory — https://arxiv.org/abs/2602.19320
- LongMemEval — https://arxiv.org/abs/2410.10813
- Evo-Memory — https://arxiv.org/pdf/2511.20857
- ExpeL — https://arxiv.org/pdf/2308.10144
- Memento — https://arxiv.org/pdf/2508.16153
- EvoTest — https://arxiv.org/html/2510.13220
- Managing Procedural Memory in LLM Agents — https://arxiv.org/html/2606.23127

Industry / engineering

- Anthropic, Effective context engineering for AI agents — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- LangChain, Context engineering (write/select/compress/isolate) — https://www.langchain.com/blog/context-engineering-for-agents
- LangChain, context_engineering repo — https://github.com/langchain-ai/context_engineering
- LangChain, LangMem SDK launch — https://www.langchain.com/blog/langmem-sdk-launch
- LangChain, Memory overview docs — https://docs.langchain.com/oss/python/concepts/memory
- Letta, Memory blocks — https://www.letta.com/blog/memory-blocks/
- Letta, Sleep-time compute — https://www.letta.com/blog/sleep-time-compute/
- Letta, Agent memory — https://www.letta.com/blog/agent-memory/
- Letta, Memory models: towards agents that learn — https://www.letta.com/blog/towards-agents-that-learn/
- Chroma, Context Rot — https://www.trychroma.com/research/context-rot
- Zep, What is a temporal knowledge graph — https://www.getzep.com/ai-agents/temporal-knowledge-graph/
- Neo4j, Graphiti: knowledge graph memory for an agentic world — https://neo4j.com/blog/developer/graphiti-knowledge-graph-memory/
- Mem0, Memory eviction and forgetting in AI agents — https://mem0.ai/blog/memory-eviction-and-forgetting-in-ai-agents
- Mem0, AI memory benchmarks 2026 — https://mem0.ai/blog/ai-memory-benchmarks-in-2026
- Hindsight/Vectorize, The consolidation problem in agent memory — https://hindsight.vectorize.io/blog/2026/05/21/agent-memory-consolidation
- Augment Code, Agent memory vs. context engineering — https://www.augmentcode.com/guides/agent-memory-vs-context-engineering
- AI Agent Skills as procedural memory — https://aicloudweekly.substack.com/p/ai-agent-skills-explained-the-missing
- Four types of memory for coding agents / Claude Code — https://alexop.dev/posts/four-types-memory-coding-agents-claude-code/
- NeurIPS 2026 TTCL workshop — https://ttcl-agents.github.io/

Indexes

- Agent-Memory-Paper-List — https://github.com/Shichun-Liu/Agent-Memory-Paper-List
- memorypapers.org — https://memorypapers.org/
- Anatomy of Agentic Memory repo — https://github.com/FredJiang0324/Anatomy-of-Agentic-Memory

Cognitive science

- Tulving 1972, Episodic and Semantic Memory — https://www.scirp.org/reference/referencespapers?referenceid=2919588
- Historical perspective on Tulving's episodic–semantic distinction — https://www.sciencedirect.com/science/article/abs/pii/S0028393220300373
- Rethinking the episodic/semantic distinction (2022) — https://link.springer.com/article/10.3758/s13421-022-01299-x
