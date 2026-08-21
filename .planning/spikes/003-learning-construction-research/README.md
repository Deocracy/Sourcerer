---
spike: 003
idea: datalog-memory-harness
name: learning-construction-research
type: research
validates: "Given the write-side of a learnings memory, when surveyed for embedding utility, rejected complex schemes, construction pipelines, and entry anatomy, then we know whether embeddings belong in the design, which ambitious schemes failed and why, how learnings should be built, and how an entry should be structured"
verdict: PENDING
related: [001, 002]
tags: [embeddings, memory-construction, entry-schema, write-policy, graveyard, limitations]
---

# Spike 003: Learning Construction Research

## What This Validates

Given the write-side of a learnings memory, when surveyed for embedding utility,
rejected complex schemes, construction pipelines, and entry anatomy, then we know:
whether embeddings belong in the design at all, which more-ambitious learning schemes
were proposed and lost (and whether their blockers were fundamental or
circumstantial), how learnings should be built, and how a learning entry should be
structured.

## Questions Behind This Spike

Spikes 001–002 mapped the field, the limitations, and the substrate. Three open
questions drive this one:

1. **Is embedding useful?** Spike 002 assumed "an embedding sidecar on write and
   query paths" as the fix for Datalog's exact-equality joins. That assumption was
   never itself examined.
2. **Has something more complex been proposed that is too slow or bad for context?**
   The graveyard of ambitious memory schemes — hierarchical, self-organizing,
   neural, replay-based — and what killed each.
3. **How are learnings built, and are there better ways?** The write-side pipeline
   taxonomy and its measured quality — plus **how a learning entry should be
   structured** (fields, format, trigger conditions, dual prose/structured
   representation).

## Research Method

Four parallel Opus deep-research subagents, each writing a full report here:

| Report | Question |
| ------ | -------- |
| research-i-embeddings-utility.md | Embeddings for dedup / entity resolution / task→trigger matching vs lexical vs small-LLM judging — evidence, failure modes, minimal footprint verdict |
| research-j-rejected-schemes.md | The graveyard: hierarchical trees, self-organizing graphs, episodic replay/CBR, neural memory, OS schemes, multi-store architectures — why each lost, fundamental vs circumstantial |
| research-k-construction-pipelines.md | Write-side taxonomy (post-mortem, in-situ, continuous, induction, consolidation, contrastive, critique loops), write-quality metrics, LLM write pathologies, evidence-backed upgrades |
| research-l-entry-structure.md | Entry anatomy across shipped systems + CBR/production-rule/design-rationale classics; trigger-condition fields; format effects on reader and 8B writer; dual representation; recommended schema |

## Investigation Trail

- 2026-08-21: Spike opened; four Opus research agents dispatched in parallel.

## Results

PENDING — awaiting research agents.
