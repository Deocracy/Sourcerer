---
spike: 001
idea: agent-memory-systems
name: agent-memory-research
type: research
validates: "Given the agent-memory field, when surveyed across taxonomy, approaches, tools, and harness architectures, then we can name the discipline, rank approaches for GSD's scale, and pick candidate tools"
verdict: VALIDATED
related: []
tags: [memory, rag, graphrag, knowledge-graph, context-engineering, subagents]
---

# Spike 001: Agent Memory Research

## What This Validates

Given the agent-memory field, when surveyed across taxonomy, approaches, tools, and
harness architectures, then we can name the discipline, rank the approaches for GSD's
learnings corpus, and shortlist tools — before deciding whether GSD's whole-file
LEARNINGS.md loading should be replaced with a retrieval layer.

## Motivating Observation

GSD's `extract-learnings` output (see Sourcerer's 02-LEARNINGS.md, ~4.7k tokens for one
phase) is an implicit graph: learning → decision-ID (D-69, D-27…), learning → source
artifact, learning → code symbol, learning → learning. Today it is consumed by loading
whole files into a planner's context — and GSD's loader actually skips LEARNINGS files,
so recall depends on manual loading. At ten phases this is 40–50k tokens of mostly
irrelevant prelude. The hypothesis: retrieval inside subagents (and possibly a
graph-shaped store) is the scalable form.

## Research Method

Four parallel Opus deep-research subagents, each writing a full report into this
directory:

| Report | Question |
| ------ | -------- |
| research-a-taxonomy-jargon.md | What is this field called; the memory taxonomy; the jargon; landmark papers; what "learning" mechanisms exist |
| research-b-approaches.md | Flat files vs vector RAG vs GraphRAG vs temporal KG vs hybrid vs agentic search — trade-offs, benchmarks, token economics, decision matrix |
| research-c-tools.md | Tool landscape (Mem0, Zep/Graphiti, Letta, Cognee, GraphRAG, embedded/local options, MCP availability) with a shortlist |
| research-d-harness-architectures.md | How harnesses wire memory reads/writes; subagent retrieval topologies; write policies (extraction, reflection, sleep-time compute, fine-tuning); case studies |

## Investigation Trail

- 2026-08-20: Spike opened; four Opus research agents dispatched in parallel.
- 2026-08-20: Report A (taxonomy/jargon) landed. Field name verdict: "agent memory"
  (title term of both 2025/2026 consolidating surveys), with "context engineering" a
  sibling framing, not a synonym. Notable: "experiential memory" distinguishes
  Experiences (condition→action) from Skills (generalized workflows); ACE names
  "context collapse"/"brevity bias" as failure modes of wholesale file regeneration
  (fix: incremental delta updates); A-MEM (Zettelkasten-style linked notes) is the
  closest published analogue to LEARNINGS.md; benchmarks are user-centric
  conversational recall, so published numbers don't transfer to agent-centric project
  knowledge; SFT on experience recovers only a few percent of what the same
  experience achieves in-context.
- 2026-08-20: Report B (approaches) landed. Ranking for this corpus: (1) structured
  frontmatter + generated index + on-demand whole-file reads, (2) agentic grep/read
  (Amazon Science, AAAI 2026: 94.5% of RAG faithfulness with no vector store),
  (3) SQLite FTS5 in reserve past ~10k index tokens, (4) flat load-everything still
  correct today (~50k, one cent warm via caching), (5) temporal-KG *idea* only
  (`superseded_by:` frontmatter, no server), (6) vector RAG (chunking severs
  rationale/trigger/source coupling; worst case is exact IDs like D-69),
  (7) full GraphRAG ($10–20/rebuild to re-derive human-written edges). Decisive:
  below ~200k corpus tokens retrieval is not cheaper than cached stuffing — its
  justification is context rot, not cost. Benchmark numbers are self-reported,
  disputed (Zep/Mem0 LoCoMo at 84/58/75%), and chat-recall-shaped, not
  planning-shaped. The corpus's one structural gap is supersession tracking.
- 2026-08-20: Report D (harness architectures) landed. Read verdict: pre-load vs
  retrieve is a false dichotomy — pre-loading a *stable* small corpus is nearly free
  (cached prefix); per-turn injected retrieval (Mem0/Zep pattern) is the
  cache-hostile option. Non-fork Claude Code subagents get a separate prompt cache
  and reload the CLAUDE.md hierarchy, so a retrieval subagent is a net loss below
  ~150 learnings. Write verdict: end-of-phase extraction is right for engineering
  knowledge, but must append itemized deltas with stable IDs, never regenerate
  (ACE: brevity bias / context collapse; Mem0 abandoned reconcile-on-write).
  Numbers: Anthropic context editing + memory tool = +39% task perf / −84% tokens
  over 100 turns; subagent digests 1–2k tokens; Manus cached-vs-uncached input =
  10x price. Wiring sketch: cached INDEX.md one-liner per learning in orchestrator;
  planner reads full files by path; `learnings-librarian` subagent only past ~5k
  index tokens.
- 2026-08-20: Report C (tools) landed. Shortlist: Claude Code native memory + thin
  FTS5 MCP; Cognee; LadybugDB. Eliminations: KuzuDB archived, Letta pivoted to a
  rival harness, Zep cloud-only + Graphiti server-bound, Mem0 local MCP archived,
  LazyGraphRAG never shipped. Baseline verdict: at this scale nothing beats
  SQLite FTS5 + frontmatter. All four reports in; synthesis written to Results.

## Results

**Verdict: VALIDATED** — all four research questions answered with converging,
decision-ready findings. Full detail in the four `research-*.md` reports.

### What the field is called

**Agent memory** (title term of both 2025/2026 consolidating surveys). "Context
engineering" is a sibling framing — Anthropic nests memory under context engineering;
the surveys nest context engineering under memory. The LEARNINGS corpus is
**experiential memory** in the surveys' vocabulary: *Experiences* (condition→action
entries — the Lessons/Decisions) plus *Skills* (generalized workflows — the Patterns).
Note: nearly all published benchmarks (LoCoMo, LongMemEval) are *user-centric chat
recall*; an agent-centric engineering corpus is a different distribution, so vendor
numbers don't transfer.

### The four converging conclusions

1. **A graph DB is not justified at this scale — the graph idea is.** The edges
   (learning → D-ID, artifact, symbol) are already human-written; GraphRAG-style
   machinery would pay $10–20 per rebuild to re-derive them from prose. The winning
   form: make the existing edges machine-readable (frontmatter fields), add a
   `superseded_by:` field to steal temporal-KG fact-invalidation without a server.
   Supersession tracking is the corpus's one real structural gap.
2. **Whole-file loading is currently fine — but for cache reasons, and it will fail
   via context rot, not window overflow.** Below ~200k corpus tokens, retrieval is
   not even cheaper than a cached stuffed prefix (~1¢/call warm). The failure mode
   that eventually forces retrieval is accuracy degradation with context length
   (Chroma: 30–50% drops before the limit), arriving around ten phases of learnings.
3. **Retrieval belongs in consumers, not the orchestrator — but a dedicated retrieval
   subagent is premature.** Non-fork Claude Code subagents get a separate prompt
   cache and reload the CLAUDE.md hierarchy, so a librarian subagent is a net token
   loss below ~150 learnings / ~5k index tokens. Near-term wiring: a generated
   `INDEX.md` (one line per learning) in the cached orchestrator prefix; the
   *planner* reads full files by path on demand; escalate to a `learnings-librarian`
   subagent (Explore-style, ≤1.5k-token output contract, returns pointers) only past
   the threshold.
4. **"Training" for this problem means artifacts, not weights.** 2026 results: SFT on
   collected experience recovers only a few percent of what the same experience
   achieves in-context. The design surface is the write policy: end-of-phase
   extraction (what extract-learnings does) is the right policy for engineering
   knowledge, **but it must append itemized deltas with stable IDs and never
   regenerate wholesale** — ACE names the failure modes (brevity bias, context
   collapse); Mem0 abandoned reconcile-on-write for the same reason. Keep failed
   approaches in the corpus (Manus).

### Tool landscape verdict

At dozens of hand-curated files, **no surveyed tool beats SQLite FTS5 + structured
frontmatter**. Shortlist if/when tooling is wanted: (1) Claude Code's native
project-memory store plus a thin FTS5 MCP index (~200 lines, pattern already built
in context-mode); (2) Cognee (only heavyweight with fully-embedded defaults +
first-party stdio MCP, Apache-2.0); (3) LadybugDB embedded graph + small own MCP
server. Notable stale-advice traps: KuzuDB archived 2025-10; Letta pivoted to a
rival coding harness; Zep is cloud-only since April 2025 and Graphiti now requires a
server DB (plus CVE-2026-32247); Mem0's local MCP is archived; LazyGraphRAG never
shipped OSS.

### Signal for the build (GSD learnings layer)

Phase-able upgrade path, each step deferrable until its trigger:

1. **Now:** extract-learnings emits structured frontmatter (decision IDs, symbols,
   phases, `superseded_by:`) and appends deltas instead of regenerating; generate an
   INDEX.md; fix the loader gap so planners actually read it (index in prefix, full
   files by path).
2. **At ~10k index tokens:** add SQLite FTS5 over the frontmatter + bodies
   (frontmatter becomes columns).
3. **At ~150 learnings:** add the learnings-librarian retrieval subagent.
4. **Graph DB:** only if cross-entry traversal queries ("everything transitively
   derived from D-69") become real and frequent — none of the evidence suggests
   they will at project scale.
