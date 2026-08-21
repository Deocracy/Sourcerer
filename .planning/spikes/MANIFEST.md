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

## Spikes

| # | Idea | Name | Type | Validates | Verdict | Tags |
|---|------|------|------|-----------|---------|------|
| 001 | agent-memory-systems | agent-memory-research | research | Given the agent-memory field, when surveyed across taxonomy, approaches, tools, and harness architectures, then we can name the discipline, rank approaches for GSD's scale, and pick candidate tools | VALIDATED ✓ | memory, rag, graphrag, knowledge-graph, context-engineering |
