# Research C — LLM Agent Memory: Tool Landscape

**Date:** 2026-08-20 (repo metrics pulled 2026-08-20/21 via GitHub API)
**Scope:** concrete products/libraries for agent memory — architecture, maturity, MCP availability, offline capability, and fit for a local-first Claude Code harness.
**Use case being scored against:** GSD produces curated markdown learnings files per project phase. Wanted: a queryable memory layer subagents hit instead of loading whole files. Local-first, NixOS, no always-on server preferred. Already running an MCP code knowledge graph (codebase-memory-mcp) and an FTS5 context index (context-mode).

---

## 0. Executive summary

Three things changed the landscape since 2024 and most blog comparisons have not caught up:

1. **The embedded-graph substrate died and was reborn.** KuzuDB — the SQLite-of-graphs everyone was building local-first agent memory on — was archived 2025-10-10 when Apple acqui-hired the team. Two MIT forks now carry it: **LadybugDB** (1.6k stars, very active, ships its own MCP server) and Kineviz **bighorn** (132 stars). Graphiti has formally **deprecated** its Kuzu backend; Cognee shipped "Ladybug/Kuzu" as its *default* graph store.
2. **The "memory startup" tier has consolidated toward hosted.** Zep deprecated its self-hostable Community Edition (April 2025). Mem0 **archived its standalone MCP server** (2026-03-24) and now documents a hosted `mcp.mem0.ai` endpoint. Letta retired its V1 server, turned `letta-ai/letta` into a landing page, and moved development to `letta-code` — a *competing coding-agent harness*, not a memory library.
3. **Anthropic shipped first-party memory.** Claude Code has had per-project auto memory at `~/.claude/projects/<project>/memory/` (MEMORY.md index + on-demand topic files, subagent-scoped) — which this machine is **already using**. The API-side `memory` tool went GA on the Messages API (no beta header), and "Dreaming" (async memory consolidation, 2026-05-06) landed for Managed Agents.

**Net effect for this use case:** most of the named candidates are either (a) hosted-first, (b) require an always-on server (Neo4j/FalkorDB/Postgres/Qdrant), or (c) are LLM-extraction pipelines that would re-derive knowledge that GSD's learnings files *already state explicitly and curated by hand*. The genuinely local, genuinely embedded, genuinely-MCP intersection is small.

---

## 1. Master comparison table

Stars / activity pulled from the GitHub API on 2026-08-20/21. "MCP" = ships or documents a first-party MCP server. "Offline" = can run with zero network and zero separate server process.

| # | Tool | Stars | Last push | License | Storage / retrieval | Graph? | Temporal? | MCP | Offline / embedded |
|---|------|-------|-----------|---------|---------------------|--------|-----------|-----|--------------------|
| 1 | **Mem0** (`mem0ai/mem0`) | 63,725 | 2026-08-20 | Apache-2.0 | Vector store (Qdrant/Chroma/pgvector, 20 backends) + optional graph; LLM extract→dedupe→update pipeline | optional | no (versioned facts, not bi-temporal) | **hosted only** (`mem0-mcp` archived 2026-03) | partial — needs Qdrant/Postgres + local Ollama |
| 1b | OpenMemory MCP (Mem0) | — | — | Apache-2.0 | Docker + Postgres + Qdrant, SSE transport | no | no | yes (self-run) | no — Docker stack, always-on |
| 2 | **Graphiti** (`getzep/graphiti`) | 30,147 | 2026-08-21 | Apache-2.0 | Bi-temporal KG; hybrid semantic + BM25 + graph traversal | **yes** | **yes (bi-temporal)** | **yes** (`mcp_server/`, HTTP transport) | no — FalkorDB (default) / Neo4j / Neptune; Kuzu backend **deprecated** |
| 2b | Zep (`getzep/zep`) | 4,855 | 2026-08-19 | Apache-2.0 | — | yes | yes | cloud | **CE deprecated Apr 2025** — cloud only |
| 3 | **Letta** (`letta-ai/letta`) | 24,325 | 2026-08-16 | Apache-2.0 | Memory blocks (core/archival), OS-style paging, sleep-time compute | no | no | yes (agent-side, consumes MCP) | **repo is now a landing page**; V1 server on `archive` branch |
| 3b | `letta-ai/letta-code` | 3,076 | 2026-08-20 | Apache-2.0 | Active source: agent harness + terminal UI + App Server | — | — | — | it is a rival harness to Claude Code |
| 4 | **Cognee** (`topoteretes/cognee`) | 30,158 | 2026-08-20 | Apache-2.0 | ECL pipeline → KG + vectors; default **Ladybug/Kuzu** graph + **LanceDB** vectors + SQLite relational | **yes** | partial | **yes** (`cognee-mcp`, stdio, `uvx`) | **yes** — default stack is fully embedded |
| 5 | **MS GraphRAG** | 35,598 | 2026-08-19 | MIT | Batch index → entity/community graph + community summaries; global/local/DRIFT search | **yes** | no | no | yes (parquet on disk) but **expensive batch indexing**; "not an officially supported Microsoft offering" |
| 5b | LazyGraphRAG | — | — | — | Deferred-summarization variant | yes | no | no | **not shipped as OSS** — research/Azure only |
| 6 | **LlamaIndex PropertyGraphIndex** | 51,777 | 2026-08-20 | MIT | Composable KG index; sub-retrievers (LLMSynonym, VectorContext, TextToCypher, CypherTemplate) | **yes** | no | docs-MCP only | yes with `SimplePropertyGraphStore` + `SimpleVectorStore`, but that is in-memory/JSON toy tier |
| 7 | **LangMem** (`langchain-ai/langmem`) | 1,619 | 2026-08-11 | MIT | Semantic/episodic/procedural memory *on top of* a LangGraph `BaseStore` | no | no | no | depends on store; **PyPI stuck at 0.0.30 (Oct 2025)**, no GH releases |
| 8 | **neo4j-graphrag-python** | 1,259 | 2026-08-20 | (Apache-ish, NOASSERTION) | First-party Neo4j retrievers + KG builder pipeline | **yes** | no | via `neo4j-contrib/mcp-neo4j` (979★, last push 2026-04) | **no — requires a Neo4j server** |
| 9 | **HippoRAG / HippoRAG 2** | 3,954 | 2026-07-29 | MIT | OpenIE → KG + Personalized PageRank retrieval | **yes** | no | no | yes, but **research code**: last tagged release v1.0.0 (2025-02-27) |
| 10a | **txtai** | 12,897 | 2026-08-19 | Apache-2.0 | Embeddings DB = sparse + dense vector index **+ graph network + relational (SQLite)** in one artifact | **yes** | no | no first-party MCP | **yes — fully embedded, single directory, offline** |
| 10b | **ChromaDB** | 29,112 | 2026-08-21 | Apache-2.0 | Vector store (Rust core) | no | no | `chroma-mcp` (587★, **stale: last push 2025-09**) | yes (persistent client) |
| 10c | **LanceDB** | 11,219 | 2026-08-21 | Apache-2.0 | Embedded columnar vector store (Lance format) | no | no | no first-party | **yes** |
| 10d | **sqlite-vec** | 8,030 | 2026-05-18 | Apache-2.0 | SQLite extension, vector KNN | no | no | n/a | **yes** — but **still v0.1.9 (2026-03), pre-1.0, 3 months quiet** |
| 10e | **SQLite FTS5** | (stdlib) | — | Public domain | BM25 full-text in the SQLite you already have | no | no | n/a | **yes** — zero dependency |
| 10f | **LadybugDB** (Kuzu successor) | 1,626 | 2026-08-20 | MIT | Embedded columnar property graph; Cypher, HNSW vectors, BM25 FTS, PageRank/community detection; single `.lbug` file | **yes** | no | **yes** (`LadybugDB/mcp-server-ladybug`, on PyPI) | **yes** |
| 10g | Kineviz **bighorn** (Kuzu fork) | 132 | 2026-08-10 | MIT | Kuzu fork | yes | no | no | yes |
| 10h | ~~KuzuDB~~ | 4,026 | 2025-10-10 | MIT | — | — | — | — | **ARCHIVED** (Apple acqui-hire) |
| 10i | DuckDB graph | 40,483 | 2026-08-20 | MIT | `duckpgq` property-graph extension is a community extension, not core | partial | no | via generic DuckDB MCP | yes |
| 11 | **Claude Code auto memory** | — | — | proprietary | `~/.claude/projects/<project>/memory/` — MEMORY.md index (first 200 lines / 25KB auto-loaded) + on-demand topic files; per-subagent scopes (`memory: user|project|local`) | no | no | n/a (native) | **yes — already running on this machine** |
| 11b | Anthropic `memory` tool (API) | — | — | proprietary | Client-implemented file CRUD under `/memories`; **GA on Messages API**, no beta header | no | no | n/a | yes — you implement the backend |
| 11c | Anthropic "Dreaming" | — | — | proprietary | Async memory consolidation between sessions (orient → consolidate → emit reviewable diff), shipped 2026-05-06 | no | no | n/a | Managed Agents (hosted) |
| 11d | MCP reference `memory` server | 89,728 (monorepo) | 2026-08-20 | MIT | JSON-file knowledge graph: entities / relations / observations; exposes `memory://knowledge-graph` resource with `resources/updated` notifications | **yes** | no | **yes** (`npx @modelcontextprotocol/server-memory`) | **yes** — but substring search only |
| 12a | **basic-memory** | 3,693 | 2026-08-21 | **AGPL-3.0** | Markdown files (source of truth) + local SQLite index; wikilink graph; MCP-native | yes (link graph) | no | **yes** | **yes — "just files plus a local SQLite index. No servers required."** |
| 12b | **LightRAG** (HKUDS) | 39,036 | 2026-08-21 | MIT | Dual-level KG retrieval; **defaults: NetworkX graph + NanoVectorDB + JSON KV — all file-based** | **yes** | no | community only | **yes** |
| 12c | **MemOS** (MemTensor) | 10,855 | 2026-08-20 | Apache-2.0 | "Memory OS": plaintext/activation/parametric memory, hybrid retrieval, skill reuse | yes | partial | community | partial |
| 12d | **supermemory** | 28,974 | 2026-08-20 | MIT | Memory + context engine; "can be run fully locally" but hosted-first product | yes | no | yes (hosted-first) | claimed |
| 12e | **A-MEM** (`agiresearch/A-mem`) | 1,152 | 2025-12-12 | MIT | Zettelkasten-style self-organizing notes with link evolution | yes | no | no | yes — **research code, 8 months quiet** |
| 12f | `doobidoo/mcp-memory-service` | 1,901 | 2026-05-30 | Apache-2.0 | Local persistent memory, REST + MCP | yes | no | **yes** | yes |
| 12g | ConPort (`context-portal`) | 764 | 2026-01-27 | Apache-2.0 | Project-specific KG memory-bank MCP server | yes | no | **yes** | yes — but **7 months quiet** |
| 12h | memobase | 2,851 | 2026-01-11 | Apache-2.0 | User-profile long-term memory | no | no | yes | partial — 7 months quiet |
| 12i | fast-graphrag | 3,846 | 2025-11-01 | MIT | PageRank-based GraphRAG | yes | no | no | yes — **9 months quiet** |
| — | Google **Memory Bank** (ADK 2.0 / Gemini Enterprise, 2026-05-19) | — | — | proprietary | Identity-scoped persistence primitive | no | no | n/a | no — GCP hosted |
| — | OpenAI | — | — | proprietary | Stateful Assistants API **deprecating 2026-08-26**; Responses + Conversations API; `file_search` vector store | no | no | n/a | no |

---

## 2. Per-tool assessment

### 1. Mem0 / OpenMemory MCP

**Architecture.** Two-phase LLM pipeline: an extraction call pulls candidate facts from a conversation turn, then an update call reconciles them against retrieved neighbours (ADD / UPDATE / DELETE / NOOP). Storage is a vector store (Qdrant default; ~20 backends incl. Chroma, pgvector, LanceDB) plus a relational metadata store, plus an optional graph store (Neo4j/Memgraph/Neptune) for the "graph memory" tier. Python OSS package is Apache-2.0, v2.0.7 (June 2026); the JS side tags separately (`ts-v3.1.6`, 2026-08-11). 63.7k stars, daily commits — by far the largest OSS mindshare in this category.

**Integration.** Python/TS SDK is the primary path. **The MCP story is the problem:** `mem0ai/mem0-mcp` was **archived 2026-03-24**, and Mem0's documented MCP entrypoint is now `https://mcp.mem0.ai/mcp` — hosted, OAuth, nothing on your machine. OpenMemory (the local-first product) runs as a Docker stack: Postgres + Qdrant + an SSE-transport MCP server, with a web dashboard. Community self-hosted MCP wrappers exist (e.g. `elvismdev/mem0-mcp-selfhosted`, Qdrant + Neo4j + Ollama) but are one-person projects.

**Fit — poor.** Three strikes: (a) the local MCP path is a Docker-compose always-on stack, which is exactly what was ruled out; (b) the whole value proposition is *LLM-extracting facts from conversational noise* — GSD learnings files are already hand-curated distilled facts, so you'd be paying LLM extraction cost to lossy-compress something already compressed; (c) known operational sharp edges — no auth and open CORS by default, and a pgvector embedding-dimension bug that hard-fails if you ever swap embedders after first write.

### 2. Zep + Graphiti

**Architecture.** Graphiti is a **bi-temporal** knowledge graph engine: each edge carries both valid-time (when the fact was true in the world) and system-time (when we learned it), so superseded facts are invalidated rather than deleted, and you can query "what did we believe on date X". Episodes (text / message / JSON) are LLM-extracted into entities and edges, incrementally — no batch re-index. Retrieval is hybrid: cosine similarity + BM25 + graph traversal, with reranking. This is the most *architecturally interesting* option in the list, and the temporal model maps well onto "phase 02 decided X, phase 05 reversed it".

**Maturity.** 30.1k stars, pushed daily, v0.29.3 (2026-07-27), Apache-2.0. Real production users.

**Integration & MCP.** First-party MCP server in `mcp_server/` — episode management, entity management, semantic/hybrid search, group_id scoping, graph maintenance. Default transport is **HTTP at `localhost:8000/mcp/`**, default DB is **FalkorDB in the same container**, default LLM `gpt-5.5` + OpenAI embeddings. Alternative LLM/embedder providers include Anthropic, Gemini, Groq, and **Sentence Transformers** (so local embeddings are possible; local *extraction* is warned against — small models break structured output).

**The disqualifiers.**
- **Zep Community Edition was deprecated April 2025.** Self-hosting means running raw Graphiti; Zep itself is cloud-only now.
- **No embedded backend any more.** Requirements are Neo4j 5.26 / FalkorDB 1.1.2 / Neptune — and **Kuzu 0.11.2 is explicitly marked deprecated** in the README (it died with Kuzu). So Graphiti now mandates an always-on server process, on NixOS, forever.
- **Security:** CVE-2026-32247 (GHSA-gg5m-55jj-8m5g), Cypher injection via unsanitized `SearchFilters.node_labels`, fixed in 0.28.2. Notably it was **exploitable through prompt injection** — the MCP server mapped `entity_types` straight into node labels. Not disqualifying on its own (it's patched), but it is a reminder that an LLM-driven Cypher surface is an injection surface.
- **Cost:** every ingested episode is 1+ LLM extraction call.

**Fit — architecturally the best match, operationally the worst.** Bi-temporal decision history is genuinely what you'd want for "which decisions are still live". But it demands FalkorDB or Neo4j running permanently, and an LLM call per learnings file ingested. If the always-on constraint ever relaxes, revisit this first.

### 3. Letta (MemGPT lineage)

**What it was.** MemGPT's OS-metaphor memory hierarchy: an in-context "core memory" block the agent edits with tools (append/replace), plus out-of-context archival and recall memory it pages in via search. Memory blocks are **shareable across agents** — edit one block, every attached agent sees it. Sleep-time compute runs a background agent that rewrites the memory state during idle periods (the same idea Anthropic later shipped as Dreaming).

**What it is now — the elimination.** `letta-ai/letta` (24.3k stars) is now effectively **a landing page**: the README states the current source lives in `letta-ai/letta-code`, and the V1 server source has been moved to an `archive` branch. Latest GitHub release on the old repo is `0.16.8` (2026-05-14). `letta-code` (3,076 stars, Apache-2.0, created 2025-10-25) is *an agent harness with a terminal UI, App Server, desktop and web apps* — i.e. **a direct competitor to Claude Code**, not a memory layer you bolt onto one. The company blog ("Letta's Next Phase", 2026-03-16) frames this pivot explicitly. Server-side sleep-time agents are also being replaced with a client-side subagent system.

**Fit — eliminated.** Adopting Letta means adopting Letta's harness. Letta's MCP support is *inbound* (Letta agents consume MCP servers), not outbound (there is no first-party "Letta memory as an MCP server for someone else's agent" — the third-party `oculairmedia/letta-mcp` fills that gap). Also note stdio MCP transport in Letta is Docker-only. Wrong shape entirely.

### 4. Cognee

**Architecture.** An ECL (Extract–Cognify–Load) pipeline: ingest documents → LLM builds a knowledge graph → store graph + vectors + relational metadata, then search across all three. The notable 2026 development is that **the default stack is fully embedded**: graph = **Ladybug/Kuzu** (run in a dedicated worker process, with retry on on-disk lock contention), vectors = **LanceDB**, relational = **SQLite**. Optional backends: Neo4j, Postgres/PGVector, Turso, Neptune. A "whole memory layer on Postgres" mode exists (pgvector + Postgres-as-graph) but the Postgres graph backend is explicitly **a demo feature — the production version is a licensed commercial product**.

**Maturity.** 30.2k stars, Apache-2.0, v1.5.0 (2026-08-15), with `.devN` tags shipping daily. Genuinely active. Note the commercial-gating pattern above — worth watching whether more of the graph tier moves behind the license line.

**MCP.** First-party `cognee-mcp`, stdio, installable via `uvx`, documented explicitly for Claude Code (`claude mcp list` verification in the README). This is the correct integration shape.

**Fit — the strongest of the "real memory framework" tier.** It is the only heavyweight framework here whose *default* configuration is server-free and embedded, and it has a first-party stdio MCP server. Costs: it is a big Python dependency tree; it wants an LLM for the cognify step (Ollama-capable but slow); and it will re-derive a graph from text you already curated. Also its default graph engine is a 10-month-old fork of an abandoned database — that risk is real but is shared by everything embedded-graph right now.

### 5. Microsoft GraphRAG (and LazyGraphRAG)

**Architecture.** Batch pipeline: chunk → LLM entity/relationship extraction → Leiden community detection → LLM-generated community summaries at multiple hierarchy levels → parquet on disk. Query modes: *global* (map-reduce over community summaries, for "what are the themes"), *local* (entity-neighbourhood), and *DRIFT* (hybrid, follow-up-question guided).

**Maturity.** 35.6k stars, MIT, v3.1.1 (2026-07-18), active. But the README carries two warnings that matter: **"the provided code serves as a demonstration and is not an officially supported Microsoft offering"**, and **"GraphRAG indexing can be an expensive operation… start small."** Versioning is rough — you're told to re-run `graphrag init --force` between minor bumps and run a migration notebook between majors or re-index.

**LazyGraphRAG** — the deferred-summarization variant that cuts indexing cost by ~99% — was announced by MSR but **has not shipped as a standalone open-source package**; it surfaces in Azure products, not in `microsoft/graphrag`. Do not plan around it.

**MCP.** None first-party.

**Fit — poor.** It's a corpus-analysis tool ("what are the themes across 10,000 documents"), not an agent memory store. Incremental update is its weak point and your workload is *append one learnings file per phase*. Expensive batch re-index for a corpus of a few dozen curated markdown files is absurd.

### 6. LlamaIndex memory / KG modules / PropertyGraphIndex

**Architecture.** `PropertyGraphIndex` is a composable labelled-property-graph index. Construction is pluggable (`SimpleLLMPathExtractor`, `SchemaLLMPathExtractor`, `ImplicitPathExtractor`). Retrieval composes sub-retrievers over the graph: `LLMSynonymRetriever` (keyword/synonym expansion), `VectorContextRetriever` (embedding hit → walk `path_depth` hops out), `TextToCypherRetriever`, `CypherTemplateRetriever`, plus `CustomPGRetriever`. Defaults are LLMSynonym + VectorContext. Separately, LlamaIndex has `Memory` / memory-block primitives (static, fact-extraction, vector) on the agent side.

**Storage.** `SimplePropertyGraphStore` (in-memory + JSON persist) works offline but is toy-tier; anything serious points at Neo4j, Nebula, Memgraph, TiDB. If the graph store lacks vector support you also carry a separate vector store.

**Maturity.** 51.8k stars, MIT, extremely active — but note the repo description has drifted to *"the leading document agent and OCR platform"*, which tells you where the company's attention is.

**MCP.** No memory MCP server. They host a *docs* MCP server (`developers.llamaindex.ai/mcp`), which is a different thing.

**Fit — mediocre.** Excellent as a construction kit if you were writing your own MCP server and wanted retrieval primitives. As a drop-in memory layer: no MCP surface, and the offline store is not production-grade. Heavy framework tax for a small benefit.

### 7. LangChain / LangGraph memory (LangMem)

**Architecture.** LangMem is a thin SDK over LangGraph's `BaseStore`, offering semantic (facts), episodic (interaction summaries), and procedural (agent rewrites its own system prompt) memory, in both "active" (tool-call) and "background" (subconscious consolidation) modes. It is explicitly **not standalone** — no store backend, no memory.

**Maturity — the red flag.** 1,619 stars, MIT, repo pushed 2026-08-11 (so not dead), but **the latest PyPI release is 0.0.30 from 2025-10-27** — ten months with commits but no release, and still a `0.0.x` version number. Reported p95 search latency around 60s marks it as a background-consolidation tool, not an interactive retrieval layer. Legacy LangChain memory classes (`ConversationBufferMemory` et al.) were deprecated in LangChain 1.0; LangMem survived that transition but has not graduated.

**MCP.** None.

**Fit — eliminated.** You would be adopting LangGraph (a whole agent runtime) to get a store you'd then have to expose over MCP yourself, from a package that hasn't cut a release in ten months.

### 8. Neo4j GraphRAG ecosystem (`neo4j-graphrag-python`)

**Architecture.** Neo4j's first-party package: a `SimpleKGPipeline` for LLM-driven graph construction, plus a family of retrievers — `VectorRetriever`, `VectorCypherRetriever` (vector hit then Cypher expansion), `HybridRetriever` (vector + full-text), `Text2CypherRetriever` — and a `GraphRAG` orchestration class. It also wraps external vector DBs (Weaviate, Pinecone, Qdrant) for hybrid setups.

**Maturity.** 1,259 stars, 1.18.0 (2026-06-24), pushed 2026-08-20. Well-maintained, well-documented, backed by a company that isn't going anywhere. Licence shows as NOASSERTION on the API (Apache-based with Neo4j additions — read it if you adopt).

**MCP.** Not in this package; `neo4j-contrib/mcp-neo4j` (979 stars, MIT) provides Cypher / memory / Aura MCP servers — but last push 2026-04-10, so 4 months quiet.

**Fit — eliminated on the hard constraint.** It requires a Neo4j server. That is a JVM daemon running permanently. Directly contradicts "no always-on server". Everything else about it is good.

### 9. HippoRAG / HippoRAG 2

**Architecture.** Neurobiologically-motivated: OpenIE extracts a schemaless KG ("artificial hippocampal index"), query entities are linked into it, and **Personalized PageRank** propagates relevance across the graph in a single retrieval step — one-shot multi-hop, no iterative LLM retrieval loop. HippoRAG 2 (ICML 2025, *"From RAG to Memory: Non-Parametric Continual Learning for LLMs"*) adds passage nodes and deeper query-to-graph integration, improving associative multi-hop and sense-making without regressing simple lookups. It is materially cheaper to index than GraphRAG, RAPTOR, or LightRAG — this is its headline claim and it is credible.

**Maturity — the problem.** 3,954 stars, MIT, last push 2026-07-29, but the **only tagged release is v1.0.0 from 2025-02-27**. It's an academic reference implementation with a research-shaped API and dependency set. No packaging discipline, no MCP, no ops story.

**Fit — poor as a product, valuable as an idea.** The PPR-over-a-small-graph retrieval trick is the single most interesting *technique* in this survey for a small curated corpus, and it is a few hundred lines to reimplement over any graph store. Steal the algorithm, don't adopt the repo.

### 10. Lightweight / local options

- **txtai** (12,897★, Apache-2.0, v9.12.0 2026-07-30) — the sleeper. Its "embeddings database" is explicitly *a union of sparse and dense vector indexes, a graph network, and a relational database* in one persistable artifact, with no server. That is hybrid BM25+vector+graph retrieval, embedded, offline, from one dependency, from a maintainer with a six-year track record of steady releases. No first-party MCP server, so you'd write ~100 lines of MCP wrapper.
- **ChromaDB** (29,112★) — solid embedded/persistent vector store, Rust core. `chroma-mcp` exists (587★) but **last pushed 2025-09-17** — 11 months stale. Treat the MCP server as unmaintained.
- **LanceDB** (11,219★, v0.37.1 2026-08-10) — the best pure embedded vector store here: columnar Lance format, zero-copy, no server, very active. No first-party MCP. Already Cognee's default vector backend.
- **sqlite-vec** (8,030★) — beautiful idea (vector KNN as a loadable SQLite extension, runs anywhere including WASM), but **still v0.1.9 (2026-03-31), last push 2026-05-18**. Pre-1.0 and three months quiet. Fine for a prototype; don't build a durable index format on it yet.
- **SQLite FTS5** — the baseline (see §5). Public domain, in every SQLite build, BM25 ranking, zero dependencies. Already what context-mode uses.
- **KuzuDB — dead.** Archived 2025-10-10, same day v0.11.3 shipped, after Apple acqui-hired Kùzu Inc. (later confirmed by an EC filing). **If any 2025 blog post recommends Kuzu for local agent memory, that post is stale.**
- **LadybugDB** (1,626★, MIT, pushed 2026-08-20) — the live Kuzu successor. Embedded columnar property graph, single `.lbug` file, Cypher, **HNSW vector indexes + BM25 full-text + PageRank/community detection built in**, Arrow/DuckDB/Parquet interop, **and a first-party MCP server** (`LadybugDB/mcp-server-ladybug`, on PyPI). 1000+ commits and 20+ releases since the fork. Genuinely the "SQLite for graphs, with an MCP server" slot. Risk: ten months old, one primary sponsor, 1.6k stars.
- **Kineviz bighorn** (132★) — the other Kuzu fork. Much smaller. Note for the record only.
- **DuckDB** (40,483★) — `duckpgq` property-graph support is a *community* extension, not core, and SQL/PGQ remains experimental. DuckDB is excellent; DuckDB-as-graph-store is not a load-bearing choice.

### 11. Anthropic-native options — what actually exists in 2026

This tier is under-rated in every third-party comparison, and one of these is **already running on this machine**.

- **Claude Code auto memory.** On by default (`autoMemoryEnabled` in `~/.claude/settings.json`; `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` to kill). Each project gets `~/.claude/projects/<project>/memory/`, keyed off the git repo so **all worktrees share one memory directory**. Structure is exactly the pattern this spike is chasing: a `MEMORY.md` index whose **first 200 lines / 25KB load every session**, plus topic files read **on demand**. Subagents get their own scoped memory via the `memory: user | project | local` frontmatter field. This is a curated-index + lazy-load architecture, natively, with zero infrastructure.
- **CLAUDE.md hierarchy.** Managed-policy → user (`~/.claude/CLAUDE.md`) → project (`./CLAUDE.md`) → local (`./CLAUDE.local.md`), all loaded in full at launch; subdirectory CLAUDE.md files load on demand when Claude reads files there. `@path` imports expand at launch (4 hops max). `.claude/rules/` scopes instructions to file types or subdirectories. Anthropic's own guidance is to keep CLAUDE.md under ~200 lines.
- **The `memory` tool (Messages API).** **Generally available — no beta header required**, on all Claude 4+ models. It is a *client-implemented* file CRUD contract (`view`, `create`, `str_replace`, `insert`, `delete`, `rename`) over a virtual `/memories` prefix that **you** map to real storage. Pairs with **context editing** (auto-clearing stale tool results) and server-side compaction. Because you implement the backend, `/memories` could be backed by a query layer rather than a filesystem — that's the interesting hook. Security burden is on you: path-traversal validation, size caps, expiry.
- **"Dreaming"** (2026-05-06, Managed Agents). Async between-session memory consolidation modelled on hippocampal replay: orientation (read current memory, find what's been touched) → consolidation (merge duplicates, prune stale, elevate recurring patterns) → output (rewritten memory as a **reviewable diff**). Same idea as Letta's sleep-time compute, now first-party. Hosted-only, so not directly usable here, but the *reviewable-diff* pattern is worth copying for GSD learnings curation.
- **MCP reference `memory` server** (`npx -y @modelcontextprotocol/server-memory`). Still a live reference server (**not** in `servers-archived`). Knowledge graph of entities / relations / observations in a JSON file; exposes the whole graph as an MCP **resource** at `memory://knowledge-graph` and emits `notifications/resources/updated` on mutation. Deliberately minimal — **substring search only**, no embeddings, no ranking. A starting point, not an answer.

### 12. Notable things not on the original list

- **LightRAG** (HKUDS, **39,036★**, MIT, pushed 2026-08-21) — the biggest omission. Dual-level retrieval (low-level entity + high-level theme) over an LLM-extracted KG, incrementally updatable, and — critically — **its default storage is entirely file-based: NetworkX for the graph, NanoVectorDB for vectors, JSON for KV**. Runs fully offline with Ollama, no server. Optional Postgres/Neo4j/Milvus/Qdrant/Redis backends when you outgrow it. EMNLP 2025. No first-party MCP (community wrappers exist).
- **MemOS** (MemTensor, 10,855★, Apache-2.0) — 2025-2026 "memory operating system": plaintext / activation / parametric memory tiers, hybrid retrieval, cross-task skill reuse, claims ~35% token savings. Fast-growing, China-origin, worth watching; heavier than needed here.
- **supermemory** (28,974★, MIT) — memory + context engine, claims fully-local operation but is a hosted-first product with an app around it.
- **A-MEM** (`agiresearch/A-mem`, 1,152★, MIT) — the Zettelkasten-style agentic memory paper you asked about: notes with atomic content + generated keywords/tags, autonomous link generation between related notes, and *memory evolution* where new notes trigger revision of old ones. Conceptually the closest published system to "GSD learnings as a self-linking note graph". **Last push 2025-12-12 — 8 months quiet. Research code.**
- **fast-graphrag** (3,846★) — PageRank-based GraphRAG, **last push 2025-11-01, 9 months quiet**.
- **ConPort** (`context-portal`, 764★) — project-specific KG memory-bank MCP server, exactly the right shape, but **last push 2026-01-27, 7 months quiet**.
- **`doobidoo/mcp-memory-service`** (1,901★, Apache-2.0, pushed 2026-05-30) — local persistent memory with REST + MCP, targets Claude and agent pipelines. Reasonable middle option.
- **Google Memory Bank** (I/O, 2026-05-19, with ADK 2.0) — identity-scoped persistence primitive in the Gemini Enterprise Agent Platform. GCP-hosted. Listed for comparison only.
- **OpenAI** — the stateful Assistants API is **deprecating 2026-08-26**, replaced by the stateless Responses API plus a Conversations API; agent memory is `file_search` over a hosted vector store. Also hosted-only.

---

## 3. MCP availability — the decisive filter

**First-party MCP server, actively maintained:**

| Tool | Invocation | Transport | Needs a server? |
|------|-----------|-----------|-----------------|
| MCP reference `memory` | `npx -y @modelcontextprotocol/server-memory` | stdio | no (JSON file) |
| **Cognee** | `uvx cognee-mcp` | **stdio** | no (embedded defaults) |
| **basic-memory** | CLI-installed | stdio | no (files + SQLite) |
| **LadybugDB** | `mcp-server-ladybug` (PyPI) | stdio | no (single `.lbug` file) |
| Graphiti | `mcp_server/` (Docker) | **HTTP** `:8000/mcp/` | **yes** — FalkorDB/Neo4j |
| Qdrant | `mcp-server-qdrant` (1,505★, official) | stdio | yes — Qdrant |
| Neo4j | `neo4j-contrib/mcp-neo4j` (979★, 4mo quiet) | stdio | yes — Neo4j |
| Mem0 | `https://mcp.mem0.ai/mcp` | HTTP | **hosted only** |
| OpenMemory (Mem0) | Docker compose | SSE | yes — Postgres + Qdrant |
| `doobidoo/mcp-memory-service` | pip/uvx | stdio | no |
| ConPort | uvx | stdio | no (7mo quiet) |
| Chroma | `chroma-mcp` (587★) | stdio | no — **11mo stale** |

**No first-party MCP server at all:** txtai, LanceDB, sqlite-vec, LightRAG, HippoRAG, GraphRAG, LlamaIndex (memory), LangMem, `neo4j-graphrag-python`, MemOS.

**Fully offline / embedded (no separate daemon, no network):** MCP reference memory, basic-memory, Cognee (default config), LadybugDB, bighorn, txtai, LanceDB, Chroma (persistent), sqlite-vec, SQLite FTS5, LightRAG (default config), HippoRAG, A-MEM, GraphRAG (post-index), Claude Code auto memory.

**The intersection — actively maintained + first-party stdio MCP + fully embedded — is exactly four: Cognee, basic-memory, LadybugDB, and the MCP reference memory server.**

---

## 4. Shortlist

### #1 — Claude Code auto memory + a thin FTS5/MCP index over the learnings files

The honest top pick, and it is mostly already installed. Claude Code's auto memory at `~/.claude/projects/<project>/memory/` is *already* the architecture this spike is looking for: a small always-loaded `MEMORY.md` index (200 lines / 25KB cap) pointing at topic files that load only when needed, with per-subagent scoping via the `memory:` frontmatter field, keyed by git repo so worktrees share one store. The gap is not storage and not lazy loading — it is **ranked retrieval across many phase files**, which is a `ctx_search`-shaped problem you have already solved once with context-mode's FTS5 index. The lazy move is to point an FTS5 index at `.planning/**/NN-LEARNINGS.md`, expose two MCP tools (`search_learnings`, `get_learning_section`), and let MEMORY.md carry the pointers. That is maybe 200 lines, no new daemon, no LLM extraction cost, no NixOS packaging problem, nothing to rot. It also composes with `codebase-memory-mcp` rather than duplicating it. If ranked FTS5 turns out insufficient — specifically if you need "which decisions superseded which" — that is the signal to escalate, and only then.

### #2 — Cognee (`uvx cognee-mcp`)

The best of the real memory frameworks, and the only heavyweight one whose *default* configuration is server-free: Ladybug/Kuzu graph + LanceDB vectors + SQLite relational, all embedded, with a first-party **stdio** MCP server documented against Claude Code. 30.2k stars, Apache-2.0, shipping daily. If you want an actual knowledge graph over GSD learnings — entity extraction, cross-phase relationship discovery, hybrid graph+vector retrieval — this is the one to try, and `uvx` means the NixOS story is "add uv, done" rather than a Docker stack. Three caveats to go in with eyes open: the cognify step needs an LLM per document (Ollama works but is slow, and for hand-curated learnings files you're paying to re-derive structure you already wrote by hand); the Postgres-graph tier is explicitly demo-only with the production version licensed commercially, so watch that line; and its default graph engine is a ten-month-old fork of a database its original vendor abandoned.

### #3 — LadybugDB + ~150 lines of your own MCP server (or basic-memory if you want it off the shelf)

The build-your-own option, now viable because the substrate came back. LadybugDB is the live MIT successor to Kuzu: single-file embedded columnar property graph with Cypher, **HNSW vector indexes and BM25 full-text built in**, plus PageRank and community detection — meaning hybrid keyword + vector + graph retrieval in one file with no daemon, and it ships a first-party MCP server on PyPI. You'd write a schema (Phase → Decision → Surprise → Pattern, edges for supersedes/depends-on/contradicts) and populate it from GSD's own extract-learnings step, which knows the structure already and needs no LLM re-extraction. This is where HippoRAG 2's Personalized-PageRank retrieval becomes cheap to steal — it's a few dozen lines over a graph you already have. Risk is concentration: 1.6k stars, ten months old, one main sponsor. If you'd rather not own code, **basic-memory** (3,693★, pushed daily, markdown-as-source-of-truth + local SQLite index + native MCP, "no servers required") is the drop-in equivalent — but it is **AGPL-3.0**, which matters if any of this ever ships inside Sourcerer.

### Baseline comparator — "build nothing: SQLite FTS5 + frontmatter"

Add YAML frontmatter to each `NN-LEARNINGS.md` (phase, date, tags, supersedes), index the files with SQLite FTS5, expose one MCP `search` tool returning ranked sections. Cost: a few hours. Dependencies: zero (FTS5 is in every SQLite; context-mode already does exactly this). Failure modes: none that aren't a `rm` and a re-index away. What it cannot do: multi-hop association ("what else did we learn about the linker that the words 'rpath' don't appear in"), and temporal supersession reasoning beyond what the frontmatter states.

**This baseline is not a strawman — it is the thing to beat, and none of the surveyed tools clearly beat it at this corpus size.** GSD learnings files number in the dozens, not the millions; they are *already* hand-distilled, which removes the main reason to run LLM extraction; and the retrieval question is usually lexical ("what did we decide about the Nix dev shell"). Graph and temporal machinery earns its keep at scale, across noisy uncurated input, or when the question is genuinely associative. Adopt #2 or #3 only after the baseline demonstrably fails on a real query you actually asked — and note that #1 is mostly the baseline plus the native memory directory you already have.

---

## 5. Sources

**Repo metrics** — GitHub REST API (`/repos/{owner}/{repo}`, `/releases`), queried 2026-08-20/21.

**Vendors and docs**
- Mem0 — https://github.com/mem0ai/mem0 · https://mem0.ai/blog/introducing-openmemory-mcp · https://mem0.ai/blog/self-host-mem0-docker · https://docs.mem0.ai/open-source/graph_memory/overview · https://mem0.ai/blog/state-of-ai-agent-memory-2026
- Zep / Graphiti — https://github.com/getzep/graphiti · https://github.com/getzep/graphiti/blob/main/mcp_server/README.md · https://blog.getzep.com/announcing-a-new-direction-for-zeps-open-source-strategy/ · https://www.getzep.com/ai-agents/temporal-knowledge-graph/ · https://neo4j.com/blog/developer/graphiti-knowledge-graph-memory/ · https://www.falkordb.com/blog/building-temporal-knowledge-graphs-graphiti/
- Graphiti CVE — https://github.com/getzep/graphiti/security/advisories/GHSA-gg5m-55jj-8m5g · https://advisories.gitlab.com/pkg/pypi/graphiti-core/CVE-2026-32247/
- Letta — https://github.com/letta-ai/letta · https://github.com/letta-ai/letta-code · https://www.letta.com/blog/our-next-phase/ · https://www.letta.com/blog/sleep-time-compute/ · https://docs.letta.com/guides/mcp/overview
- Cognee — https://github.com/topoteretes/cognee · https://docs.cognee.ai/how-to-guides/deployment/mcp · https://docs.cognee.ai/setup-configuration/graph-stores
- Microsoft GraphRAG — https://github.com/microsoft/graphrag
- LlamaIndex — https://developers.llamaindex.ai/python/framework/module_guides/indexing/lpg_index_guide/
- LangMem — https://github.com/langchain-ai/langmem · https://rywalker.com/research/langmem
- Neo4j GraphRAG — https://neo4j.com/docs/neo4j-graphrag-python/current/ · https://github.com/neo4j-contrib/mcp-neo4j
- HippoRAG — https://github.com/OSU-NLP-Group/HippoRAG · https://arxiv.org/pdf/2502.14802 · https://openreview.net/forum?id=LWH8yn4HS2
- txtai — https://neuml.github.io/txtai/ · https://neuml.github.io/txtai/embeddings/
- sqlite-vec — https://github.com/asg017/sqlite-vec
- LightRAG — https://github.com/HKUDS/LightRAG · https://pypi.org/project/lightrag-hku/
- A-MEM — https://github.com/agiresearch/A-mem

**Kuzu death and successors**
- https://www.theregister.com/software/2025/10/14/kuzudb-graph-database-abandoned-community-mulls-options/
- https://thedataquarry.com/blog/from-kuzu-to-ladybug/ · https://szarnyasg.org/posts/kuzu-forks/ · https://gdotv.com/blog/kuzu-legacy-embedded-graph-database-landscape/
- https://ladybugdb.com/ · https://docs.ladybugdb.com/ · https://github.com/LadybugDB/ladybug · https://github.com/LadybugDB/mcp-server-ladybug · https://pypi.org/project/mcp-server-ladybug/
- https://github.com/Kineviz/bighorn

**Anthropic-native**
- https://docs.claude.com/en/docs/claude-code/memory · https://code.claude.com/docs/en/memory
- https://docs.claude.com/en/docs/agents-and-tools/tool-use/memory-tool · https://platform.claude.com/docs/en/managed-agents/memory
- https://www.anthropic.com/news/context-management
- Dreaming (2026-05-06): https://thenewstack.io/anthropic-agent-memory-dreaming/ · https://letsdatascience.com/blog/anthropic-dreaming-claude-managed-agents-self-improving-may-6
- MCP reference memory server: https://github.com/modelcontextprotocol/servers/tree/main/src/memory

**MCP memory server comparisons (secondary, cross-checked against repos)**
- https://mnemoverse.com/docs/library/memory-mcp-servers-compared · https://mcp.directory/blog/claude-code-memory-mcp-servers-2026 · https://chatforest.com/guides/best-memory-mcp-servers/ · https://tryxlr8.ai/blogs/best-open-source-ai-memory-frameworks-2026

**Other vendors (comparison)**
- Google Memory Bank / ADK 2.0 — https://enterprisedna.co/resources/news/google-gemini-agent-platform-memory-runtime-identity-ga-2026/ · https://codimite.ai/blog/enterprise-agent-memory-in-2026-what-to-keep-what-to-avoid-google-adk-gemini/
- OpenAI Assistants API deprecation — https://turingpost.substack.com/p/openais-shared-memory-agents-googles

**Confidence notes.** Repo stars/dates/licenses/archive status: HIGH (primary API). Kuzu archival and the Apple acqui-hire: HIGH (multiple independent outlets + the archived repo itself). Zep CE deprecation, Letta repo move, mem0-mcp archival: HIGH (primary repos/blogs). Anthropic "Dreaming" specifics: MEDIUM — consistently reported across several secondary outlets, not verified against a primary Anthropic announcement page. Harvey's "6x" figure: vendor-reported, treat as marketing. LangMem's 60s p95 latency: single secondary source, unverified.
