# Spike Manifest

## Ideas

### agent-memory-systems
Replace GSD's whole-file LEARNINGS.md context loading with a queryable memory system.
Phase learnings are already an implicit graph (learning → decision-ID, learning → artifact,
learning → code symbol); as phases accumulate, loading every file whole into the planner's
context does not scale, and GSD's loader currently skips LEARNINGS files entirely. This idea
researches the field (agent memory / context engineering), the competing storage-and-retrieval
approaches (flat files, vector RAG, GraphRAG, temporal KGs), the tool landscape, and the
harness/subagent architectures that keep token cost down — to decide what a proper
learnings-retrieval layer for GSD should look like.

**Requirements:**
- Research-only spike — no code built; deliverable is a decision-ready research report
- Deep research performed by Opus subagents, not inline

### datalog-memory-harness
Design-space research for a novel agent-memory system: a custom knowledge graph built
on Datalog (not an off-the-shelf graph DB or GraphRAG), consumed through a custom
harness (not Claude Code, which is a black box), where small fast models (~8B) act as
subagents assisting a single frontier model. The goal of research here is a
LIMITATIONS map — where existing approaches fail and what a new design must beat —
not best-practice convergence. Extends the survey work of agent-memory-systems.

**Requirements:**

- Research must catalog limitations/failure modes of existing approaches, not
  recommend "the right way" among them
- Memory substrate: custom Datalog-based graph, novel design
- Harness: custom-built; Claude Code rejected as substrate (opaque internals)
- Topology: small fast subagents (~8B) assisting a frontier model
- Economics target: small models working fast, high-quality, and cheap — 50 parallel
  frontier models is explicitly not the model
- Deep research performed by Opus subagents

## Spikes

| # | Idea | Name | Type | Validates | Verdict | Tags |
|---|------|------|------|-----------|---------|------|
| 001 | agent-memory-systems | agent-memory-research | research | Given the agent-memory field, when surveyed across taxonomy, approaches, tools, and harness architectures, then we can name the discipline, rank approaches for GSD's scale, and pick candidate tools | VALIDATED ✓ | memory, rag, graphrag, knowledge-graph, context-engineering |
| 002 | datalog-memory-harness | datalog-memory-harness-research | research | Given the goal of a novel Datalog memory graph in a custom harness with small subagents, when the design space is surveyed for limitations, engines, small-model leverage, and harness anatomy, then the novelty space and its constraints are mapped | VALIDATED ✓ | datalog, knowledge-graph, small-models, custom-harness, limitations |
