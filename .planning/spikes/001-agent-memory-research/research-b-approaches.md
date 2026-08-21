# Research B — Competing Approaches to Persistent Agent Memory

**Date:** 2026-08-20
**Scope:** How LLM agents accumulate and retrieve durable knowledge; seven competing
architectures, their token economics, failure modes, and benchmark evidence.
**Framing case:** a corpus of deliberately-distilled `{NN}-LEARNINGS.md` files
(~5k tokens each, decisions/lessons/patterns/surprises with rationale, trigger
conditions, source pointers, cross-referenced decision IDs like `D-69` and code
symbols), consumed by planning subagents, local-first, no server preferred.

---

## 0. TL;DR

For a corpus of dozens of curated 5k-token markdown files consumed by planning
subagents, the evidence points one way: **do not build a retrieval system yet.**
Add machine-readable frontmatter and a generated index, let the agent read whole
files on demand, and hold SQLite FTS5 in reserve. Vector RAG, GraphRAG, and
temporal-KG servers all solve problems this corpus does not have (scale,
un-curated text, multi-tenancy, ambiguous natural-language recall) while
introducing costs it cannot amortize (index build, chunk boundaries, infra,
staleness).

The one genuinely valuable idea to steal from the heavyweight systems is
**temporality** — explicit supersession — because a project's learnings corpus
accumulates contradictions as decisions get reversed. That costs one frontmatter
field, not a graph database.

---

## 1. The seven approaches

### 1.1 Flat curated files loaded whole into context

**(CLAUDE.md / AGENTS.md / Anthropic memory-tool file pattern)**

**How it works.** Knowledge lives in human-authored markdown. Either the whole
file is injected into the system prompt every turn (CLAUDE.md, AGENTS.md), or the
agent is given a memory *directory* and a protocol to `view` it before starting
work (Anthropic's memory tool: `view` / `create` / `str_replace` / `insert` /
`delete` / `rename`, all client-side against storage you control, restricted to a
`/memories` prefix). The memory tool's injected system instruction is blunt:
*"IMPORTANT: ALWAYS VIEW YOUR MEMORY DIRECTORY BEFORE DOING ANYTHING ELSE… ASSUME
INTERRUPTION."*
([Anthropic memory tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool))

**Retrieval pattern.** None, or directory-listing + whole-file read. Retrieval
recall is 100% by construction if the file is loaded; the failure mode moves from
*retrieval miss* to *attention miss*.

**Token economics.** Linear in corpus size, paid on every call. A 4k-token
CLAUDE.md is "a 4,000-token tax on message one, message two, and message two
hundred"
([Tokenade](https://tokenade.net/en/articles/claude-md-token-bloat)).
The saving grace is **prompt caching**: a stable prefix reads at ~10% of input
price (Sonnet 5: $2.00/MTok → $0.20/MTok cache hit; Opus 5: $5.00 → $0.50), with
5-minute cache writes at 1.25× and 1-hour at 2×
([Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing);
[Finout summary](https://www.finout.io/blog/anthropic-api-pricing)).
Reported time-to-first-token improvement up to 85%. This is the strongest
structural argument for flat files: **static text caches; retrieval results do
not.** Any per-query retrieved payload invalidates the cache from its insertion
point onward.

**Write/update path.** A human edits the file, or the agent does (`str_replace`).
Both are cheap, auditable, diffable, and git-native. This is the highest-quality
write path of any approach here — curation happens at authoring time by someone
who understands the material.

**Failure modes.**
- **Context bloat / context rot.** Chroma's study across 18 frontier models found
  *every* model degrades with input length, non-uniformly, at *every* length
  increment — a 1M-window model still rots at 50k tokens. On LongMemEval,
  accuracy on focused ~300-token prompts was materially higher than on the same
  question with ~113k tokens of history, with Claude models showing the largest
  gap ([Chroma, Context Rot](https://www.trychroma.com/research/context-rot)).
  Practical safe budgets for 2M-window models land around 150k–400k tokens for
  high-accuracy work.
- **Distractor sensitivity.** Even a single plausible-but-wrong distractor
  reduced accuracy relative to baseline, and the effect amplifies with length.
  Twenty phases of learnings *are* twenty near-miss distractors for any given
  question.
- **Context collapse on rewrite.** Iteratively asking a model to rewrite/compress
  its own accumulated context erodes detail progressively — the ACE paper names
  this **context collapse**, alongside **brevity bias** (optimizers drift toward
  short generic instructions that shed domain specifics)
  ([ACE, arXiv 2510.04618](https://arxiv.org/abs/2510.04618)).
- **Unbounded growth.** No forgetting policy exists by default in any surveyed
  system; footprint grows monotonically
  ([Always-On Agents survey, arXiv 2606.30306](https://arxiv.org/pdf/2606.30306)).

**When it wins.** Small, curated, single-user, stable corpora where every item is
plausibly relevant; where exactness and provenance matter; where cache hits are
achievable. One independent lab puts flat `MEMORY.md` on the Pareto frontier for
cost/latency at ~$0.0015/query with caching, and estimates it covers **~80% of
solo coding-agent workflows** (<30 facts, one user, deterministic preferences)
([Agent Memory Lab](https://www.jakecuth.com/work/agent-memory-lab/)).

**When it loses.** Above the rot threshold; when facts conflict across time; when
multiple users/threads need isolation; when the same file is loaded for questions
that touch 2% of it.

---

### 1.2 Vector RAG over chunked notes

**How it works.** Split notes into chunks, embed, store in a vector index, embed
the query, return top-k by cosine similarity.

**Retrieval pattern.** Single-shot approximate nearest neighbour, usually k=5–20.

**Token economics.** Index build is cheap (embedding models run $0.02–$0.13/MTok;
a 500k-token corpus indexes for cents). Query payload is bounded and predictable:
top-10 × 500 tokens ≈ 5k tokens regardless of corpus size. Latency 5–8ms local,
10–50ms to a hosted vector DB.

**Write/update path.** Re-chunk and re-embed changed files. Incremental update is
a real engineering chore (chunk identity, deletion, drift when you change
embedding models — which silently invalidates the whole index).

**Known weaknesses.**
- **Chunking artifacts.** Chunk boundaries sever context; a rationale in one
  chunk and its trigger condition in the next retrieve independently and read as
  incoherent. Bridge and comparison questions suffer most.
- **Multi-hop.** Systems that do well single-hop fail when evidence must be
  joined across documents; single-round retrieval is provably insufficient for
  connected reasoning (MultiHop-RAG, HotpotQA, MuSiQue literature;
  [NovelHopQA, arXiv 2506.02000](https://arxiv.org/pdf/2506.02000)).
- **Relational/structural queries are not expressible.** "Every decision that
  superseded a D-1x decision" is a join, not a similarity. Embeddings have no
  operator for it.
- **Exact-identifier queries are its worst case.** Agents search with specific
  technical terms — `D-69`, `SourcererAPI.sys.mjs`, `MOZ_ARTIFACT_REVISION` —
  and dense retrieval returns *topically related* passages instead of the exact
  one. This is the single most-cited reason agent memory systems keep BM25 in
  the loop.
- **Independent head-to-head:** on single-hop factual lookup plain RAG scored
  F1 64.8 vs 63.0 for the best graph method; on multi-hop it lost, 67.0 vs 70.3
  ([RAG vs GraphRAG, arXiv 2502.11371](https://arxiv.org/pdf/2502.11371);
  [VentureBeat writeup](https://venturebeat.com/orchestration/stop-graphing-everything-when-graphrag-actually-beats-vector-rag)).

**When it wins.** Large (≫1M token), heterogeneous, un-curated corpora; fuzzy
natural-language recall; paraphrase-heavy queries; when you cannot enumerate the
vocabulary in advance.

**When it loses.** Small curated corpora where the whole thing nearly fits; exact
identifier lookup; relational queries; anything where a retrieval miss is
unrecoverable because the agent doesn't know what it didn't get.

---

### 1.3 Knowledge graphs / GraphRAG

**How it works (Microsoft GraphRAG).** At index time an LLM extracts entities and
relationships from every chunk, writes natural-language descriptions of each,
resolves duplicates, runs graph statistics and hierarchical community detection
(Leiden), then generates LLM summaries for every community at every level.
Query time offers two modes:
- **Local search** — entity-anchored; walks the neighbourhood of entities named
  in the query. Good for "tell me about X".
- **Global search** — map-reduce over community summaries; answers dataset-wide
  questions ("what are the recurring themes?") that no top-k retrieval can reach.

**Retrieval pattern.** Best-first (vector) vs breadth-first (graph global).
Microsoft frames the difference exactly that way: vector RAG "lacks awareness of
dataset breadth"; global search "ensures comprehensive coverage but without
query-specific optimization"
([LazyGraphRAG](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/)).

**Cost profile — the decisive number.** Full GraphRAG indexing runs roughly
**$20–$40 per 1M tokens** of source corpus with a frontier model, because every
chunk gets LLM entity extraction plus every entity, relationship, and community
gets an LLM-written summary. Global search queries are also expensive (map-reduce
over many community summaries).

**LazyGraphRAG** (Microsoft, 2025) defers all LLM work to query time: index uses
only NLP noun-phrase co-occurrence + community detection. Result:
**indexing cost identical to vector RAG (0.1% of full GraphRAG)**, and at a
matched-quality budget, **~700× lower query cost for global search**; at 4% of
full GraphRAG's global query cost it outperformed all competitors on both local
and global query types (5,590 AP news articles, 100 synthetic queries).

**Write/update path.** Worst of any approach. Adding one document can change
community structure; naive re-index is a full re-spend. Incremental graph update
is an active research area, not a solved feature.

**Failure modes.** Entity-extraction errors propagate everywhere downstream;
duplicate/near-duplicate entities fragment neighbourhoods; community summaries
are lossy paraphrases (a second layer of the same distillation the LEARNINGS
files already did by hand); cost scales with corpus, not with query volume.

**When it wins.** Global/thematic questions over large corpora you did *not*
write ("what are the cross-cutting risks in these 500 incident reports?");
genuine multi-hop over entities.

**When it loses.** Curated corpora — the entity extraction is re-deriving
structure a human already encoded. Small corpora — index cost dominates. Point
lookups — vector or BM25 is better and 100× cheaper.

---

### 1.4 Temporal knowledge graphs (Zep / Graphiti)

**How it works.** A three-layer graph: **episodes** (raw messages/documents,
retained for provenance) → **semantic entities and facts** (extracted edges) →
**communities** (clustered higher-level summaries). The distinguishing feature is
**bi-temporality**: every edge carries four timestamps — `t_valid` / `t_invalid`
(when the fact was true in the world) and `t_created` / `t_expired` (when the
system learned/retired it)
([Zep paper, arXiv 2501.13956](https://arxiv.org/pdf/2501.13956)).

**Fact invalidation, not deletion.** When new information contradicts an existing
edge, the system writes `t_invalid` rather than deleting. The graph can therefore
answer "what did we believe, and when?" and will never serve a superseded fact as
current. Retrieval is hybrid: semantic + BM25 + graph traversal, with reranking.

**Why temporality matters for an evolving project.** A learnings corpus is not a
set of facts; it is a *history of positions*. Phase 02 decides X; phase 07
reverses it. A retrieval system with no notion of supersession will happily
return the phase-02 rationale to a planning agent and sound authoritative doing
it. Every non-temporal approach above (flat files included) has this bug; flat
files merely make it visible to a human reader. Independent measurement puts
Zep's advantage at **+17.3pp on temporal queries** specifically
([Agent Memory Lab](https://www.jakecuth.com/work/agent-memory-lab/)) — a narrow
but real edge concentrated exactly where the other systems are weakest.

**Token economics.** Ingestion is LLM-driven (entity/edge extraction per episode)
— cheaper than full GraphRAG, more expensive than embedding. Query payloads are
small and bounded. Graphiti is open-source (20k+ stars) and runs on Neo4j or
FalkorDB; Zep is the hosted product.

**Write/update path.** Good — designed for streaming incremental ingestion, which
is precisely what GraphRAG lacks.

**Failure modes.** Extraction quality gates everything; a service dependency
(Neo4j/FalkorDB) is real infra weight for a local-first workflow; benchmark
claims are contested (see §2); ingestion cost per item rises as the store grows
because agentic consolidation must inspect existing records before merging
([Always-On Agents survey](https://arxiv.org/pdf/2606.30306)).

**When it wins.** Long-lived, multi-user, fact-churning domains (CRM, support,
health) where "what is true *now*" is the question. Temporal reasoning tasks.

**When it loses.** Small local corpora where a `superseded_by:` field in
frontmatter delivers 80% of the benefit for zero infra.

---

### 1.5 Hybrid retrieval — and the "SQLite FTS5 is enough" position

**How it works.** Run BM25/FTS and dense retrieval in parallel, fuse the ranked
lists (Reciprocal Rank Fusion: `score(d) = Σ 1/(k + rank)`, k=60 — rank-based,
therefore scale-agnostic), optionally rerank the top 50–100 with a cross-encoder.

**Evidence.**
- RRF fusion of BM25 + dense beat *both* constituents across all metrics and all
  subsets in a text-and-table benchmark, largest gain +8.1pp Recall@5 over BM25
  ([arXiv 2604.01733](https://arxiv.org/html/2604.01733v1)).
- Tuned hybrid on WANDS: NDCG 0.7497 vs BM25 0.6983 / vector 0.6953 (+7.4%).
- Reranking lifts sharply with candidate depth (0.826 @50 → 0.888 @100).
- Consensus phrasing across 2026 practitioner sources: **hybrid is the minimum
  viable baseline**; pure dense only approaches hybrid on semantically
  homogeneous corpora with a domain-tuned embedding model.

**The pragmatic position: FTS5 alone.** SQLite FTS5 gives BM25 ranking in-process
with sub-millisecond queries at agent-memory scale, in a single file, with no
service, no network hop, no embedding model to version. The argument made
repeatedly in 2026 write-ups is that *agent* memory access differs from knowledge-
base search: agents ask for exact terms ("the staging API key", a symbol name, a
decision ID), and dense retrieval returns the topic instead of the token.
Retrieval on a Pi Zero 2 W measured <3ms end-to-end vs 10–50ms for a network
round-trip to a hosted vector DB
([ZeroClaws](https://zeroclaws.io/blog/zeroclaw-sqlite-fts5-vector-hybrid-memory-explained/);
[dev.to](https://dev.to/fex_beck_27bfd4dccd05f062/why-sqlitefts5-beats-vector-dbs-for-ai-agent-memory-4inj)).
`sqlite-vec` lets you add the dense half later *in the same file* if BM25 misses
become measurable — so this is a genuinely incremental path, not a fork in the
road.

**Token economics.** Index build ≈ free. Query payload bounded. Zero marginal
infra.

**Write/update path.** `INSERT`/`DELETE` on file change; a 20-line indexer script
run from a git hook.

**Failure modes.** Vocabulary mismatch (asks "why is the build slow" when the
file says "artifact builds cut link time") — this is exactly what the dense half
fixes; no relational reasoning; no temporality unless you model it in columns.

**When it wins.** Small-to-medium corpora, exact-term-heavy queries, local-first,
no-ops constraints. Which is to say: this case.

---

### 1.6 Agentic / deferred retrieval — no index at all

**How it works.** The agent is given `grep`, `glob`, `ls`, and `read`, and finds
things the way a developer would: search, look, refine, read. No embeddings, no
preprocessing, no index to keep fresh.

**The strong claim.** Claude Code shipped an early RAG pipeline and removed it.
Boris Cherny's summary of agentic search: *"it outperformed everything. By a
lot."* Windsurf, Cline, Devin, and Sourcegraph Amp made comparable moves
([Vadim's blog](https://vadim.blog/claude-code-no-indexing/);
[SmartScope](https://smartscope.blog/en/ai-development/practices/rag-debate-agentic-search-code-exploration/)).

**The measured claim.** Amazon Science, AAAI 2026: *"Keyword search is all you
need: achieving RAG-level performance without vector databases using agentic tool
use"* — agentic keyword search reached **94.5% of RAG faithfulness with zero
vector store**, >90% on the performance metrics generally
([Amazon Science](https://www.amazon.science/publications/keyword-search-is-all-you-need-achieving-rag-level-performance-without-vector-databases-using-agentic-tool-use);
[arXiv 2602.23368](https://arxiv.org/pdf/2602.23368)).

**Anthropic's own framing.** Just-in-time context: agents "maintain lightweight
identifiers (file paths, stored queries, web links) and use these references to
dynamically load data into context at runtime." Metadata is functional — folder
hierarchy and filenames are behavioural signals. The honest caveat is stated in
the same document: *"runtime exploration is slower than retrieving pre-computed
data,"* and a hybrid (some upfront, some agent-discretion) is often optimal
([Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)).

**Token economics — the real cost.** Each hop is a tool call whose *output* enters
context. A grep that returns 500 lines to find 10 relevant ones is 490 lines of
tax, and the sequence is serial, so latency compounds. Milvus's rebuttal is the
sharpest statement of the cost side: indexed retrieval cut token usage >40% with
no recall loss in side-by-side testing; "every grep dump shovels massive amounts
of irrelevant code into the LLM, driving up costs that scale horribly with repo
size"
([Milvus](https://milvus.io/blog/why-im-against-claude-codes-grep-only-retrieval-it-just-burns-too-many-tokens.md)).
The article concedes grep's exactness and predictability, and concedes that
vector retrieval "isn't trivial" (chunking, incremental updates, scale).

A second, less obvious cost: **agentic retrieval is cache-hostile**. Every
session's tool-call sequence differs, so the conversation prefix diverges early
and prompt caching stops paying.

**Write/update path.** Nothing to maintain. This is its dominant advantage:
correctness is guaranteed to be current because the files *are* the index.

**Failure modes.** Vocabulary mismatch (grep can't find a concept nobody named);
non-determinism (two runs take different paths); unbounded worst case on large
trees; the agent may stop early and report confidently on partial evidence.

**When it wins.** Corpora with strong naming conventions and stable identifiers —
code, and *structured* markdown with IDs like `D-69`. Small file counts. When
staleness is the dominant risk. When there is no ops budget.

**When it loses.** Thousands of files; conceptual queries with no lexical anchor;
strict latency budgets.

---

### 1.7 Structured-frontmatter markdown + query-time filtering

**How it works.** Files stay human-readable prose; the *edges* move into YAML
frontmatter — `phase`, `decisions: [D-69, D-71]`, `symbols:`, `supersedes:`,
`superseded_by:`, `tags:`, `confidence:`, `updated:`. A cheap indexer (or plain
`grep`/`yq`/SQLite) filters on that metadata at query time; only matching files
are read in full.

**Precedent — this is now the mainstream agent pattern, under three names:**
- **Agent Skills progressive disclosure** (Anthropic, open-sourced Dec 2025;
  adopted by OpenAI, Google, GitHub, Cursor within weeks). Three tiers: `name` +
  `description` frontmatter at startup (~60–100 tokens per skill), full SKILL.md
  body on activation (target <5k tokens), reference files only on demand. Twenty
  skills cost ~2k tokens of metadata instead of ~40k tokens eagerly loaded
  ([Agent Skills docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview);
  [SwirlAI](https://www.newsletter.swirlai.com/p/agent-skills-progressive-disclosure)).
- **Path-scoped rules** — `.claude/rules/` with `paths:` frontmatter, invisible
  until a matching file is touched (~41% overhead reduction reported).
- **Letta Context Repositories** (2026) — git-versioned memory repo cloned
  locally; filetree visible in the system prompt; frontmatter descriptions per
  file; a `system/` directory marks what loads eagerly; agents reorganize their
  own hierarchy and move files between active and archived. Subagents write
  concurrently in isolated worktrees and merge via git
  ([Letta](https://www.letta.com/blog/context-repositories/)).

**Retrieval pattern.** Two-stage. Stage 1: always-loaded index of frontmatter
(cheap, stable, cacheable). Stage 2: full read of the 1–5 files the index
selected. Precision comes from human-authored metadata rather than from an
embedding's guess.

**Token economics.** Best-in-class for this corpus shape. 60 files × ~80 tokens
of index ≈ **5k tokens always-on** (cacheable, therefore ~$0.001/call on Sonnet 5
cache reads), plus 2–3 whole files ≈ 10–15k tokens on demand. Compare 300k tokens
to load the same corpus whole.

**Write/update path.** Human writes frontmatter at distillation time — the same
moment they were already deciding what mattered. The index is *generated*, so it
cannot drift. This is the only approach where the write path costs approximately
nothing extra.

**Failure modes.** Metadata rot if authoring discipline slips (mitigate: generate
the index in CI / a git hook and fail on missing required fields); the index is
only as good as the one-line summaries; no help for questions that cut across
tags nobody thought to add; still no full-text search inside file bodies (which
is why FTS5 pairs with it so naturally).

**When it wins.** Curated corpora authored by the people who query them; 10–200
files; a stable ID vocabulary; local-first.

**When it loses.** Un-curated dumps; corpora authored by others; thousands of
files where even the index gets long (>10k tokens ⇒ move the index into FTS5).

---

## 2. Benchmarks: what they measure and why to discount them

| Benchmark | Year | Shape | Measures | Known limits |
|---|---|---|---|---|
| **LoCoMo** | 2024 | ~300 turns, ~9k tokens, ≤35 sessions, 1,540 Qs | single-hop, multi-hop, open-domain, temporal recall | Conversations ~16–26k tokens fit trivially in a modern window; speaker misattribution; ambiguous questions with multiple valid answers; a category unusable for missing ground truth; does not score knowledge updates |
| **LongMemEval** | 2024 (ICLR 25) | 500 Qs; `_S` ≈115k tokens / ~40–50 sessions; `_M` ≈500 sessions | extraction, multi-session reasoning, temporal reasoning, knowledge update, abstention | Primarily measures *retrieval*; barely evaluates *write* quality (what deserves storing) |
| **HotpotQA / MuSiQue / MultiHop-RAG / NovelHopQA** | 2018–2026 | multi-hop QA | whether a system can join evidence across documents | Not agent-memory: no write path, no temporality, no accumulation over sessions |
| **BEAM** | 2026 | 100 conversations up to **10M tokens**, 2,000 probes, 10 capabilities | fact tracking, updates, contradiction resolution, temporal understanding, multi-hop | Designed so nothing saturates it — headline scores are low by design (Mem0: BEAM-1M 64.1, BEAM-10M 48.6) |

**Headline results worth knowing.**
- Long-context LLMs drop **30–60%** on LongMemEval-S relative to focused prompts;
  commercial assistants land at 30–70% accuracy in easier settings
  ([arXiv 2410.10813](https://arxiv.org/abs/2410.10813)).
- Independent aggregation on LongMemEval: Mastra Observational 94.87%,
  Mem0 v2 93.4%, Zep/Graphiti 71.2%, **full-context GPT-4o 62.1%**, Mem0 v1 49.0%.
  On LoCoMo: Letta *filesystem* agent 74.0%, Mem0 graph 68.5%
  ([Agent Memory Lab](https://www.jakecuth.com/work/agent-memory-lab/)).
- Structured memory frameworks beat long-context baselines on BEAM by only
  **3.5–12.7pp** — a much smaller margin than the LoCoMo-era marketing implied.
- Token cost: Mem0 reports ~6.7–7.0k tokens per retrieval vs 25k+ for full-context
  baselines — a **3–4×** reduction, not the 10× often claimed
  ([Mem0 benchmarks 2026](https://mem0.ai/blog/ai-memory-benchmarks-in-2026)).

**Caveats — read these before believing any number above.**

1. **The scores are contested by the vendors who produce them.** Zep reported
   ~84% on LoCoMo; Mem0's replication scored Zep at 58.44%; Zep's rebuttal claims
   75.14% ±0.17 and documents three methodology errors in Mem0's harness (both
   speakers assigned the `user` role; timestamps appended to message text instead
   of using the `created_at` field, breaking temporal reasoning; sequential rather
   than concurrent search, inflating latency — corrected p95 0.632s vs 0.778s
   reported). Mem0 counter-alleges Zep included an explicitly-excluded adversarial
   category ([Zep](https://blog.getzep.com/lies-damn-lies-statistics-is-mem0-really-sota-in-agent-memory/);
   [getzep/zep-papers#5](https://github.com/getzep/zep-papers/issues/5)).
   **Essentially every published agent-memory number is self-reported and
   unreplicated.**
2. **The strongest baseline is often "just paste it in."** On LoCoMo, feeding the
   whole conversation to the LLM scored ~73% against Mem0's best 68%. If a
   benchmark's corpus fits the window, memory architecture is measuring overhead,
   not capability.
3. **LLM-as-judge variance alone swings scores ~10%.**
4. **Controlled-baseline work finds the confounds are structural.** MemDelta
   (arXiv 2606.29914) argues LoCoMo and LongMemEval carry uncontrolled confounds
   that inflate reported capability, and that under controlled baselines the
   apparent gains shrink substantially.
5. **Nothing standard measures what matters most here.** No public benchmark
   scores *write* decisions (what deserves storing), forgetting/eviction,
   consolidation quality, or per-corpus curation. Cross-session continuity limits
   are unstandardized — "the field is not yet stable on what *long enough* means."
6. **None of these benchmarks is a coding-agent planning task.** They are
   multi-session *chat* recall. A curated, ID-cross-referenced engineering
   corpus is a different distribution — much higher lexical determinism, much
   lower paraphrase pressure. Expect BM25-family methods to do relatively better
   here than the chat benchmarks suggest, and dense retrieval relatively worse.

---

## 3. Token and cost math

Assumptions: Sonnet 5 at $2.00/MTok input, cache read $0.20/MTok, 5-min cache
write $2.50/MTok (Opus 5: $5.00 / $0.50). Embedding ~$0.05/MTok. Full GraphRAG
indexing $20–40 per 1M source tokens. Costs below are **per planning query**
unless marked.

### Corpus = 50k tokens (≈10 LEARNINGS files) — *today*

| Strategy | Tokens in context | Cold cost | Warm (cached) cost | Notes |
|---|---|---|---|---|
| Stuff everything | 50,000 | $0.100 | $0.010 | Fits easily; rot risk low but non-zero |
| Frontmatter index + 2 files | ~1k + 10k | $0.022 | $0.004 | Index caches; file bodies vary |
| FTS5 top-8 sections | ~6,000 | $0.012 | — | Cache-hostile payload |
| Vector RAG top-8 | ~6,000 | $0.012 + $0.0000025 index | — | Index cost is a rounding error; so is the benefit |
| Agentic grep (4 hops) | ~25,000 | $0.050 | — | Plus 4× round-trip latency |
| Full GraphRAG | ~6,000 | $0.012 + **$1–2 index** | — | Index costs 10–20× a whole year of queries |

**Verdict at 50k:** stuffing costs one cent warm. Any retrieval system here is
buying complexity to save a cent, and *losing* recall guarantees to do it.

### Corpus = 500k tokens (≈100 files) — *the realistic 12–24-month horizon*

| Strategy | Tokens in context | Cold cost | Warm cost | Notes |
|---|---|---|---|---|
| Stuff everything | 500,000 | $1.00 | $0.10 | Exceeds 200k windows; on a 1M window, deep in the rot zone (Chroma: degradation well before the limit) |
| Frontmatter index + 3 files | ~8k + 15k | $0.046 | $0.005 | Index still cacheable at ~8k |
| FTS5 / hybrid top-10 | ~8,000 | $0.016 | — | Flat in corpus size |
| Vector RAG top-10 | ~8,000 | $0.016 + $0.025 index | — | Re-embed on model change = full re-spend |
| Agentic grep (6 hops) | ~45,000 | $0.090 | — | Degrades with file count |
| Full GraphRAG | ~8,000 | $0.016 + **$10–20 index** | — | ~1,000 queries to break even, and re-index on drift |
| LazyGraphRAG | ~8,000 | ~$0.02 + ~$0.025 index | — | The only graph option whose index cost is defensible |

**Verdict at 500k:** stuffing is no longer possible *and* no longer wise.
Two-stage index+read and FTS5 converge to the same ~$0.02/query. The distinction
is maintenance, not money.

### Corpus = 5M tokens (≈1,000 files)

Context stuffing is off the table at any price. All strategies converge on
bounded ~8–15k-token payloads at ~$0.02–0.03/query; what differs is **index
maintenance cost and staleness risk**, not query cost. Full GraphRAG indexing
would run **$100–200 per rebuild**; LazyGraphRAG ~$0.25; FTS5 ~$0; agentic grep
becomes unreliable (too many files, too many false hits per term).

**The structural lesson from the table:** query cost stops differentiating above
~500k tokens. The real currencies become (a) *cache hit rate*, (b) *index
freshness*, (c) *write-path friction*. Flat files win (a) and (b) and lose on
volume; frontmatter+index wins all three until the index itself gets long.

**The cache asymmetry, stated plainly.** A stable 50k-token corpus in the prompt
prefix costs $0.010/call warm. A 6k-token *retrieved* payload costs $0.012/call
and can never be cached. **At this corpus size, retrieval is not cheaper than
stuffing — it is nominally more expensive.** Retrieval's justification at small
scale is *accuracy under context rot*, not cost. Anyone selling retrieval on
token savings below ~200k tokens of corpus is quoting the uncached number.

---

## 4. Curation vs accumulation

Two philosophies, and the tension is real:

**Accumulate everything, rank later** — Mem0, Zep, vector RAG, GraphRAG. Write is
cheap and automatic; the burden moves to retrieval and ranking. Advantage: nothing
is lost, and you don't have to know in advance what will matter. Disadvantage:
the store grows monotonically (no surveyed system prunes by default), per-ingest
cost rises with store size once consolidation must check for conflicts, and
signal-to-noise decays. The 2026 survey consensus is that *"forgetting should be
governed, not incidental"* — which is an admission that accumulation without an
explicit forgetting policy fails
([arXiv 2606.30306](https://arxiv.org/pdf/2606.30306);
[Control-Plane Placement Shapes Forgetting, arXiv 2606.15903](https://arxiv.org/pdf/2606.15903)).

**Distill deliberately** — CLAUDE.md, LEARNINGS files, ACE playbooks. Write is
expensive (a human or an LLM reflects and decides); retrieval is trivial because
the corpus is already the answer. This is what the GSD LEARNINGS pattern does, and
it is doing the expensive half correctly: a 5k-token distillation with rationale,
trigger condition, and source pointer is *higher-value per token* than anything
an extraction pipeline produces from raw transcripts.

**Where the two meet — ACE's finding is the important one.** Stanford/SambaNova/
Berkeley's Agentic Context Engineering separates the roles: a **Generator**
produces trajectories, a **Reflector** distills lessons, a **Curator** merges them
into the context. Its key result is negative and directly applicable: *rewriting
the whole context to integrate a new lesson destroys information* (**context
collapse**), and optimizers that compress drift toward short generic advice
(**brevity bias**). ACE's fix is **incremental delta updates to a structured
playbook** rather than monolithic rewrites — +10.6% on agent benchmarks, +8.6% on
domain reasoning, using a smaller open model
([arXiv 2510.04618](https://arxiv.org/abs/2510.04618)).

**Implication for a per-phase LEARNINGS corpus.** The per-phase file boundary is
already the right ACE-style delta granularity — each phase appends a new document
rather than rewriting a master file, so context collapse is structurally
prevented. The genuine risk is the opposite one: **no supersession mechanism.**
Accumulating deltas without marking which ones are dead produces a corpus where
old and new advice have equal standing. That is the one place this design is
weaker than a temporal KG, and the fix is a frontmatter field, not a database.

---

## 5. Decision matrix

Scoring: ●●● strong / ●● adequate / ● weak, for this class of workload.

| Approach | ≤100k corpus | 100k–1M | >1M | Point lookup (exact ID) | Conceptual/fuzzy | Multi-hop / relational | Temporal ("still true?") | Maintenance cost | Infra weight | Cache-friendly |
|---|---|---|---|---|---|---|---|---|---|---|
| **1. Flat files, loaded whole** | ●●● | ● | ✗ | ●●● | ●●● | ●●● (all present) | ● | ●●● none | ●●● none | ●●● best |
| **2. Vector RAG** | ● | ●● | ●●● | ● | ●●● | ● | ● | ●● re-embed | ●● lib or service | ● |
| **3. GraphRAG (full)** | ✗ cost | ● | ●● | ●● | ●● | ●●● | ● | ● re-index | ● heavy | ● |
| **3b. LazyGraphRAG** | ● | ●● | ●●● | ●● | ●●● | ●●● | ● | ●● | ●● | ● |
| **4. Temporal KG (Zep/Graphiti)** | ● | ●● | ●●● | ●● | ●●● | ●●● | ●●● | ●● | ● server + DB | ● |
| **5a. Hybrid (BM25+vec+rerank)** | ●● | ●●● | ●●● | ●●● | ●●● | ● | ● | ●● | ●● | ● |
| **5b. SQLite FTS5 only** | ●●● | ●●● | ●● | ●●● | ●● | ● | ●● (via columns) | ●●● trivial | ●●● one file | ● |
| **6. Agentic grep/read** | ●●● | ●● | ● | ●●● | ● | ●● (iterative) | ● | ●●● none | ●●● none | ● worst |
| **7. Frontmatter + query-time filter** | ●●● | ●●● | ●● | ●●● | ●● | ●● (via edge fields) | ●●● (via `superseded_by`) | ●●● authoring-time | ●●● none | ●●● index caches |

---

## 6. Recommendation for the described use case

**Corpus:** dozens of 5k-token deliberately-curated markdown files (≈100–300k
tokens at "dozens"). **Consumers:** planning subagents with fresh contexts.
**Constraints:** local-first, no server, human-readable source of truth.

### Tier 1 — do this now (approach 7 + 6, with 1 for the index)

1. **Add YAML frontmatter to every LEARNINGS file.** Required fields:
   `phase`, `title`, `summary` (one line, ≤25 words), `decisions: [D-xx, …]`,
   `symbols: […]`, `tags: […]`, `updated:`, and critically
   `superseded_by:` / `supersedes:`.
2. **Generate `LEARNINGS-INDEX.md` from the frontmatter** in a git hook or CI —
   never hand-maintained, so it cannot drift. One line per file: phase, title,
   summary, decision IDs, tags, live/superseded flag. At 60 files this is ~5k
   tokens, always loaded, fully cacheable.
3. **Planning subagents get the index, not the corpus**, plus instructions to
   `grep` for decision IDs / symbols and read whole files on demand. Whole-file
   reads preserve the rationale↔trigger↔source coupling that chunking would sever
   — which is precisely the coupling that makes these files valuable.
4. **Mark supersession at distillation time.** When phase N reverses a decision
   from phase M, edit phase M's frontmatter. This is the highest-value idea from
   the temporal-KG literature, obtained for one line of YAML.

Expected cost per planning query: ~5k cached index tokens (~$0.001) + 2–3 file
reads (~$0.03) — against ~$0.10–0.60 to stuff the corpus, with strictly better
accuracy because of context rot and distractor effects.

### Tier 2 — add when (and only when) a trigger fires

**Trigger:** the generated index exceeds ~10k tokens (≈120+ files), *or* planning
agents demonstrably miss files that grep should have found.

**Action:** index file *sections* into a single SQLite file with FTS5 + BM25, with
frontmatter fields as ordinary columns so `WHERE superseded_by IS NULL` and
`decisions LIKE '%D-69%'` work as plain SQL. One indexer script, one query script,
zero services, zero network. Keep the markdown as the source of truth and the
database as a disposable derived artifact — rebuildable in seconds, never
authoritative, never in git.

### Tier 3 — only if relational queries become the dominant workload

**Trigger:** questions like "show every decision that depends on D-12 transitively"
become routine rather than occasional.

**Action:** materialize the frontmatter cross-references into an `edges` table in
the *same* SQLite file and answer with a recursive CTE. This is a knowledge graph
without a graph database, and it exploits the fact that **the edges are already
authored by hand** — the whole expense of GraphRAG is LLM-extracting edges from
prose, which is work this corpus does not need done.

### Explicitly skip

- **Vector RAG.** Corpus too small for the index to pay for itself; queries are
  exact-identifier-heavy (`D-69`, `SourcererAPI.sys.mjs`) which is dense
  retrieval's documented worst case; chunking would sever exactly the
  rationale/trigger/source structure the files exist to preserve. Revisit only
  if fuzzy conceptual recall becomes the dominant failure — and then add
  `sqlite-vec` to the file you already have, not a new service.
- **Full GraphRAG.** $10–20 per rebuild at 500k tokens to re-derive structure a
  human already encoded, with no incremental update story. LazyGraphRAG is the
  only member of this family worth remembering, and only above ~1M tokens.
- **Zep/Graphiti as a service.** Its distinguishing advantage is bi-temporal fact
  invalidation over a churning fact base with many users. Here there is one user
  and a `superseded_by:` field. Taking the idea without the Neo4j is the correct
  trade.
- **Loading everything into a planning agent's context.** Already near the point
  where Chroma's measured degradation applies, and it gets strictly worse every
  phase.

### The single most important structural point

This corpus is *already curated* — the expensive, quality-determining half of
every memory system has been done by hand, better than any pipeline would do it.
Every heavyweight architecture surveyed here exists to **manufacture structure
from unstructured accumulation**. Paying for that machinery on a corpus that was
structured at authoring time is paying twice. The correct investment is not a
retrieval engine; it is making the existing structure **machine-readable**
(frontmatter), **navigable** (a generated index), and **honest about time**
(supersession).

---

## Sources

**Primary / vendor documentation**
- [Anthropic — Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Anthropic — Memory tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- [Anthropic — Managing context on the Claude Developer Platform](https://www.anthropic.com/news/context-management)
- [Anthropic — Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Anthropic — Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Microsoft Research — LazyGraphRAG: a new standard for quality and cost](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/)
- [Microsoft — GraphRAG global search docs](https://microsoft.github.io/graphrag/query/global_search/)
- [Microsoft Research — GraphRAG: improving global search via dynamic community selection](https://www.microsoft.com/en-us/research/blog/graphrag-improving-global-search-via-dynamic-community-selection/)
- [Zep — What is a temporal knowledge graph?](https://www.getzep.com/ai-agents/temporal-knowledge-graph/)
- [Neo4j — Graphiti: knowledge graph memory for an agentic world](https://neo4j.com/blog/developer/graphiti-knowledge-graph-memory/)
- [Letta — Context Repositories: git-based memory for coding agents](https://www.letta.com/blog/context-repositories/)
- [Letta — Sleep-time compute](https://www.letta.com/blog/sleep-time-compute/)
- [Letta — Agent memory](https://www.letta.com/blog/agent-memory/)

**Papers**
- [LongMemEval (arXiv 2410.10813, ICLR 2025)](https://arxiv.org/abs/2410.10813)
- [Zep: a temporal knowledge graph architecture for agent memory (arXiv 2501.13956)](https://arxiv.org/pdf/2501.13956)
- [Agentic Context Engineering (arXiv 2510.04618)](https://arxiv.org/abs/2510.04618)
- [RAG vs GraphRAG: a systematic evaluation (arXiv 2502.11371)](https://arxiv.org/pdf/2502.11371)
- [Keyword search is all you need (AAAI 2026 / arXiv 2602.23368)](https://www.amazon.science/publications/keyword-search-is-all-you-need-achieving-rag-level-performance-without-vector-databases-using-agentic-tool-use)
- [MemDelta: controlled baselines and hidden confounds in agent memory evaluation (arXiv 2606.29914)](https://arxiv.org/pdf/2606.29914)
- [Always-On Agents: a survey of persistent memory, state, and governance (arXiv 2606.30306)](https://arxiv.org/pdf/2606.30306)
- [Control-plane placement shapes forgetting (arXiv 2606.15903)](https://arxiv.org/pdf/2606.15903)
- [Vector RAG vs LLM-compiled wiki: a preregistered comparison (arXiv 2605.18490)](https://arxiv.org/html/2605.18490v1)
- [NovelHopQA: diagnosing multi-hop reasoning failures (arXiv 2506.02000)](https://arxiv.org/pdf/2506.02000)
- [From BM25 to corrective RAG: benchmarking retrieval strategies (arXiv 2604.01733)](https://arxiv.org/html/2604.01733v1)

**Studies, analyses, and practitioner reporting**
- [Chroma — Context Rot: how increasing input tokens impacts LLM performance](https://www.trychroma.com/research/context-rot)
- [Agent Memory Lab — Vector DBs vs MEMORY.md vs graphs](https://www.jakecuth.com/work/agent-memory-lab/)
- [Zep — Is Mem0 really SOTA in agent memory?](https://blog.getzep.com/lies-damn-lies-statistics-is-mem0-really-sota-in-agent-memory/)
- [getzep/zep-papers issue #5 — revisiting the 84% LoCoMo claim](https://github.com/getzep/zep-papers/issues/5)
- [Mem0 — AI memory benchmarks in 2026 (LoCoMo, LongMemEval, BEAM)](https://mem0.ai/blog/ai-memory-benchmarks-in-2026)
- [Mem0 — State of AI agent memory 2026](https://mem0.ai/blog/state-of-ai-agent-memory-2026)
- [VentureBeat — Stop graphing everything: when GraphRAG actually beats vector RAG](https://venturebeat.com/orchestration/stop-graphing-everything-when-graphrag-actually-beats-vector-rag)
- [Milvus — Why I'm against Claude Code's grep-only retrieval](https://milvus.io/blog/why-im-against-claude-codes-grep-only-retrieval-it-just-burns-too-many-tokens.md)
- [Vadim's blog — Claude Code doesn't index your codebase](https://vadim.blog/claude-code-no-indexing/)
- [SmartScope — Settling the RAG debate: why Claude Code dropped vector RAG](https://smartscope.blog/en/ai-development/practices/rag-debate-agentic-search-code-exploration/)
- [SwirlAI — Agent Skills: progressive disclosure as a system design pattern](https://www.newsletter.swirlai.com/p/agent-skills-progressive-disclosure)
- [Tokenade — CLAUDE.md: how a bloated file inflates your bill](https://tokenade.net/en/articles/claude-md-token-bloat)
- [ZeroClaws — SQLite + FTS5 + vectors vs dedicated vector databases](https://zeroclaws.io/blog/zeroclaw-sqlite-fts5-vector-hybrid-memory-explained/)
- [dev.to — Why SQLite+FTS5 beats vector DBs for AI agent memory](https://dev.to/fex_beck_27bfd4dccd05f062/why-sqlitefts5-beats-vector-dbs-for-ai-agent-memory-4inj)
- [Hybrid search: BM25, vector and reranking reference 2026](https://www.digitalapplied.com/blog/hybrid-search-bm25-vector-reranking-reference-2026)
- [Finout — Anthropic API pricing 2026](https://www.finout.io/blog/anthropic-api-pricing)
- [Hindsight — The consolidation problem in agent memory](https://hindsight.vectorize.io/blog/2026/05/21/agent-memory-consolidation)
