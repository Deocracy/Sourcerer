# Research D — Harness and Subagent Architectures for Agent Memory

**Date:** 2026-08-20
**Scope:** How production agent systems wire memory in so main-context token cost stays low, and how memory gets written/updated.
**Method:** 16 web searches + 12 primary-source fetches. Primary sources (vendor engineering blogs, official docs, arXiv) preferred; secondary sources flagged inline.

---

## 0. Executive framing

Two questions are usually conflated and should not be:

- **Read architecture** — where retrieval physically happens, and whose context window pays for the retrieved bytes.
- **Write architecture** — what mechanism turns experience into a durable artifact, and on what schedule.

Almost every production coding harness in 2025–2026 converges on the same read answer (**cheap stable index in the prefix, expensive bulk fetched just-in-time by whoever consumes it**) and the same write answer (**in-context artifacts — files, playbooks, skills — never weight updates**). The disagreements are about *how much* structure to impose on the write side and *whether* to isolate readers into subagents.

---

## 1. Memory-read architectures: where retrieval happens

### 1.1 The five patterns

| Pattern | Who pays context | Latency | Retrieval-miss risk | Prompt-cache behavior |
|---|---|---|---|---|
| **(a) Orchestrator pre-loads** | Orchestrator, every turn until compaction | Zero extra | Zero (if the right file was chosen) | **Best** — stable prefix, cached after first call |
| **(b) Subagent queries a memory tool mid-task** | Subagent only | +1 tool round trip per query | Low-moderate (query formulation) | Poor for the subagent's own suffix; irrelevant to orchestrator |
| **(c) Dedicated retrieval/research subagent returns a digest** | Subagent burns; orchestrator pays only the digest (~1–2k tok) | **Highest** — cold-start context gathering | Moderate (digest may drop what the consumer needed) | Non-fork subagent gets its **own separate cache** — no reuse of parent prefix |
| **(d) Harness auto-injects relevant memories per turn** (Mem0/Zep) | Orchestrator, per turn | +retrieval latency inline | Moderate (embedding recall) | **Worst** — injected content mutates the prefix and invalidates cache every turn unless injected at the tail |
| **(e) Just-in-time agentic file reading** (Anthropic's stated Claude Code approach) | Whoever reads, when they read | Model-paced, exploratory | Low but non-deterministic | Good — reads land in the *suffix*, prefix stays cached |

### 1.2 What Anthropic actually says

Anthropic's *Effective context engineering for AI agents* describes the JIT approach: agents "maintain lightweight identifiers (file paths, stored queries, web links, etc.)" and "dynamically load data into context at runtime using tools," mirroring "external organization and indexing systems like file systems, inboxes, and bookmarks."

Critically, they do **not** advocate pure JIT. The stated pattern is **hybrid**:

> "CLAUDE.md files are naively dropped into context up front, while primitives like glob and grep allow it to navigate its environment and retrieve files just-in-time."

That is pattern (a) for the small stable core and pattern (e) for the large variable bulk. This is the single most load-bearing finding for the GSD question: Anthropic's own harness pre-loads a curated markdown file and JIT-reads everything else.

The Claude Agent SDK post goes further and argues *against* semantic retrieval as the default:

> "Semantic search is usually faster than agentic search, but less accurate, more difficult to maintain, and less transparent."

Recommendation there: start with `grep`/`tail` over the file system; add embeddings only when speed forces it.

- https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- https://claude.com/blog/building-agents-with-the-claude-agent-sdk

### 1.3 Prompt-cache interaction — the trap nobody models

Prompt caching is prefix-matched. Anything that changes before the cache boundary invalidates the cache **and everything after it**. Practical rules that recur:

- Order content **most-stable → least-stable**: tool definitions → system prompt → reference docs → conversation history → live query.
- Excluding dynamic tool results from the cached segment was the change "with the most consistent gains across providers."
- Manus quantifies the stakes: Claude Sonnet cached input at `$0.30/MTok` vs uncached at `$3/MTok` — a **10x** delta — and Manus's average input:output ratio is roughly **100:1**, so essentially all cost is input cost. Their conclusion: *"KV-cache hit rate is the single most important metric for a production-stage AI agent."*
- Reported hit-rate wins: ProjectDiscovery went 7% → 74% hit rate from one reordering fix, cutting inference cost 59%. Claude Code is cited at a 92% cache hit rate / 81% cost reduction at scale *(secondary source — treat the exact figures as indicative)*.

**Consequence for the GSD question:** a *stable* pre-loaded learnings corpus in the orchestrator prefix is nearly free after the first request — it is cached. A *retrieval-injected* corpus that varies per turn is charged at full uncached rate every turn. Moving retrieval out of the prefix and into a mid-turn tool call is only a win if the corpus is large **and** varies; if it is small and stable, pre-loading is both cheaper and lower-latency.

- https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus
- https://www.digitalocean.com/community/conceptual-articles/prompt-caching-in-practice-hit-rate
- https://agentmarketcap.ai/blog/2026/04/11/prompt-cache-hit-rate-engineering-2026

### 1.4 The Claude Code subagent cost model (measured from the docs)

The official sub-agents docs are unusually explicit about what isolation actually costs:

- **Returns:** "Only the subagent's final summary returns to Claude. Tool calls and intermediate reasoning stay in the subagent's isolated context."
- **Startup cost:** every **non-fork** subagent loads the **full CLAUDE.md hierarchy** (`~/.claude/CLAUDE.md`, project rules, `CLAUDE.local.md`, managed policy) plus git status, plus the full content of any preloaded `skills`. The built-in **Explore** and **Plan** agents deliberately **skip CLAUDE.md and git status** "to keep research fast and inexpensive."
- **Cache:** *"Fork — prompt cache shared with main, cheaper (reuses parent's prompt cache). Non-fork — separate context = separate cache."*
- **Latency:** *"Starting fresh costs latency… a fresh subagent starts from scratch. Use a subagent when verbose output isolation outweighs context-gathering time."*

So subagent isolation is **not free**: you pay a fresh cache miss on a fresh system prompt + CLAUDE.md, plus cold-start exploration. It wins when the isolated work would otherwise dump tens of thousands of tokens of verbose output into the parent.

- https://code.claude.com/docs/en/sub-agents

### 1.5 Progressive disclosure as the reconciliation

Agent Skills are the cleanest published instance of "index in the prefix, bulk on demand":

- **Tier 1 (discovery):** name + description only, ~30–50 tokens per skill at session start. 100 skills ≈ 3–5k tokens.
- **Tier 2 (activation):** the SKILL.md body (~5k tokens) loads only when the skill triggers.
- **Tier 3 (execution):** bundled reference files read on demand.

An unused skill "costs almost nothing to keep installed." This is exactly the shape a learnings corpus should take.

- https://www.newsletter.swirlai.com/p/agent-skills-progressive-disclosure
- https://www.firecrawl.dev/blog/agent-skills

---

## 2. Context management by harnesses

### 2.1 Compaction (Claude Code)

Three tiers, per reverse-engineering of the CLI internals *(secondary sources; consistent across two independent writeups)*:

1. **Microcompaction** — continuous lightweight trimming (`src/services/compact/microCompact.ts`), sheds bulky tool outputs early.
2. **Auto-compaction** — fires at ~83% of the window (≈167k of 200k) with a ~13k-token safety buffer; the model is asked to condense the conversation into a structured "working state," then the harness rehydrates recent files, todos, and a continuation instruction. `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` is clamped by `Math.min()` so it can only trigger *earlier*, never later.
3. **Manual `/compact`.**

- https://zhanghandong.github.io/harness-engineering-from-cc-to-ai-coding/en/part3/ch09.html
- https://decodeclaude.com/compaction-deep-dive/

### 2.2 Context editing + memory tool (Claude Developer Platform) — the best published numbers

Anthropic's own reported figures:

| Configuration | Result |
|---|---|
| Context editing alone | **+29%** on internal agentic-search eval |
| Memory tool + context editing | **+39%** |
| 100-turn web-search eval | **−84% token consumption**, and completed workflows that otherwise **failed** on context exhaustion |

Mechanism: context editing "automatically clears stale tool calls and results from within the context window when approaching token limits." The memory tool is a file CRUD interface (`view/create/str_replace/insert/delete/rename`) over a `/memories` directory that the developer hosts; the API injects *"IMPORTANT: ALWAYS VIEW YOUR MEMORY DIRECTORY BEFORE DOING ANYTHING ELSE."*

Documented operational guardrails: cap individual memory files at ≤64KB and total directory at ≤10MB per user, validate paths against traversal, key roots by user, and — directly relevant here — *"Loading a bloated memory directory into context on every request consumes tokens proportionally."*

- https://claude.com/blog/context-management
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool

### 2.3 Context quarantine via subagents

Anthropic's context-engineering post states subagents return a *"condensed, distilled summary"* — **typically 1,000–2,000 tokens** — while the exploration (potentially tens of thousands of tokens) stays in the subagent. The Agent SDK post: *"subagents use their own isolated context windows, and only send relevant information back to the orchestrator, rather than their full context."*

### 2.4 Externalization instead of summarization

Two mechanisms beat summarization when applicable:

- **Structured note-taking** — the agent writes notes to files outside the window; Anthropic's Pokémon example maintains "precise tallies across thousands of game steps" and recovers strategy "after context resets."
- **Code execution over tool calls** — presenting MCP servers as typed code modules on a filesystem so the model reads tool defs on demand and filters intermediate data *inside the sandbox*. Anthropic's Drive→Salesforce example: **150,000 tokens → 2,000 tokens, a 98.7% reduction.** The same post introduces a `./skills/` directory where the agent saves working code as reusable functions — write-side memory as executable know-how.

- https://www.anthropic.com/engineering/code-execution-with-mcp

### 2.5 Why the ceiling is real: context rot

Chroma's July 2025 study tested 18 frontier models (GPT-4.1, Claude 4, Gemini 2.5, Qwen3) and found accuracy degrades non-uniformly as input grows, **well before the documented limit** — reported drops of 30–50% in some conditions. A counterintuitive result: models did *better* on shuffled haystacks than logically coherent documents. The framing that matters: this is an architectural property of attention, not a capability gap training will close. **Loading more never becomes free just because the window is big.**

- https://www.trychroma.com/research/context-rot

---

## 3. Memory-WRITE architectures ("how the learning works")

### 3.1 Six write policies

**(a) Explicit end-of-task extraction (post-mortem distillation).**
One LLM pass at the end of a bounded unit of work produces a durable artifact. This is what GSD's extract-learnings does, what Amp's `/handoff` does (*"generates a structured prompt that captures the most relevant state of the current thread and uses that as the seed for a new thread"*), and what Claude Code compaction does involuntarily.
**Wins when:** the unit of work has a clean boundary, the artifact is human-reviewable, and write volume is low. Cheapest possible write path — one call per phase.
**Fails when:** the session dies mid-way (nothing was written), or the artifact is a monolithic rewrite that degrades over time (see 3.2).

**(b) Continuous background extraction (Mem0-style).**
An LLM extracts candidate facts from every exchange and reconciles them into a store. Mem0's 2026 algorithm notably **abandoned** two-pass extraction with ADD/UPDATE/DELETE reconciliation in favor of **single-pass ADD-only** extraction, because *"the old algorithm extracted memories in two LLM passes"* with reconciliation that caused *"context [to get] destroyed."* Now: *"Every extracted fact becomes an independent record. When information changes, the new fact lives alongside the old one, and both survive."* Conflict resolution deferred to retrieval time. Reported to cut write-time LLM calls by **60–70%** without meaningful quality loss.
**Wins when:** interactions are conversational, facts are small and user-specific, and you need recall without a task boundary.
**Fails when:** writes are expensive relative to task value, or when the corpus is engineering knowledge that needs curation rather than accretion.

**(c) Reflection loops (Generative Agents, Reflexion).**
- *Generative Agents:* a memory stream of natural-language observations retrieved by `α_recency·recency + α_importance·importance + α_relevance·relevance` (min-max normalized). **Reflection fires when cumulative importance of recent observations crosses a threshold**, not on a fixed schedule; reflections are written back into the stream as thought nodes so they are retrievable alongside raw observations. That "synthesis is itself a memory" property is the reusable idea.
- *Reflexion:* verbal reinforcement — the agent reflects on task feedback and keeps reflective text in an episodic buffer for the next trial. **HumanEval pass@1 91% vs GPT-4's 80%; +20% on HotPotQA; self-reflection adds +8% absolute over episodic memory alone.** No weight updates.
**Wins when:** you get a pass/fail or execution signal and can retry.

**(d) Sleep-time compute (Letta).**
Two agents: a primary that talks and calls tools but **has no memory-edit tools**, and a sleep-time agent that owns the memory-block editing tools and runs asynchronously, rewriting the primary's in-context memory blocks. *"Reasoning during sleep time transforms 'raw context' into 'learned context'."* The architectural point is **separation of the write privilege from the actor** — the actor cannot corrupt its own memory mid-task, and consolidation never adds user-facing latency.
- https://www.letta.com/blog/sleep-time-compute/ · paper: https://arxiv.org/abs/2504.13171

**(e) Skill/procedure libraries (Voyager, Agent Skills, `./skills/`).**
Voyager stores skills as **executable code in a vector DB**, retrieved by the embedding of the task plan plus environment feedback; skills are "temporally extended, interpretable, and compositional," which "alleviates catastrophic forgetting" — explicitly without fine-tuning. Anthropic's Agent Skills and the MCP `./skills/` directory are the same idea in a harness: memory as procedure, not fact.
**Wins when:** the learning is *how to do something* rather than *what is true*. Procedures are verifiable by execution; facts are not.

**(f) Actual weight updates (fine-tuning / RL on trajectories).**
Essentially no production coding harness does this at the harness level. The recurring reasons:
- The loop — collect feedback, curate, fine-tune, eval, redeploy — runs in **weeks to months**, far slower than agents serving live users daily.
- It needs hundreds-to-thousands of high-quality trajectories per stable task.
- It only pays off when the task is stable enough that baked patterns won't be obsolete next month, and when carrying the instructions in context has become expensive enough to amortize.
- Contrast with ACE, which reports **82.3% reduction in adaptation latency and 75.1% fewer rollouts** vs comparable adaptation methods, and **91.5% latency / 83.6% dollar-cost reduction** on ingestion/generation — context adaptation is simply orders of magnitude cheaper to iterate.
The consensus statement: *for production agents the model weights are frozen at deploy time, so the actual learning surface is memory, prompts, and skills.*

- https://arxiv.org/abs/2510.04618
- https://www.letta.com/blog/continual-learning/

### 3.2 The failure mode every write policy must avoid: context collapse

ACE (Stanford / SambaNova / UC Berkeley, 2025) names the two pathologies precisely:

- **Brevity bias** — summarization drops domain-specific detail in favor of concise prose.
- **Context collapse** — iterative *full rewrites* erode detail over long runs.

ACE's fix is the design pattern worth stealing: a **Generator / Reflector / Curator** split where the Curator emits **incremental delta updates** — *"the Curator only writes the new insight and merges it into a structured and itemized Playbook with simple deterministic logic"* — using non-LLM techniques (semantic dedup, deterministic merge) rather than rewriting wholesale. Itemization also makes it possible to track which items helped and prune the rest.

Reported: **+10.6% on agent benchmarks, +8.6% on finance**; up to **+17.1% on AppWorld** learning from execution feedback alone with no ground-truth labels; matches the top production agent on the AppWorld leaderboard using a smaller open model.

**Direct implication for a markdown-learnings corpus:** append itemized entries with stable IDs; never regenerate the file wholesale. A rewrite-per-phase extraction step is a context-collapse machine.

### 3.3 Hot path vs background (LangChain's framing)

- **Hot path:** the agent decides to remember before responding. Immediate availability; adds user-visible latency. ChatGPT memory works this way.
- **Background:** asynchronous extraction after/during the conversation. No added latency; but updates are delayed and you must decide *when* to trigger.

LangChain's taxonomy also notes that **procedural memory** (weights + agent code + system prompt) is "currently uncommon to update," which matches 3.1(f).

- https://www.langchain.com/blog/memory-for-agents
- https://docs.langchain.com/oss/python/concepts/memory

### 3.4 Keep the failures

Manus's counterintuitive lesson, worth encoding in any learnings extractor: *"One of the most effective ways to improve agent behavior is deceptively simple: leave the wrong turns in the context."* Error traces suppress repeat mistakes; sanitized post-mortems that record only the final correct approach discard the highest-value signal. A learnings corpus that only records decisions and omits the rejected approaches and why they failed is throwing away most of its value.

---

## 4. Multi-agent memory topology

### 4.1 The two camps

**Cognition (Devin) — "Don't Build Multi-Agents" (June 12, 2025):**
- *Principle 1:* "Share context, and share full agent traces, not just individual messages."
- *Principle 2:* "Actions carry implicit decisions, and conflicting decisions carry bad results."
- Recommended architectures: (i) single-threaded linear agent; (ii) when the task outgrows the window, a **dedicated context-compression LLM** that distills the action history into essential details and decisions.
- Position: as of 2025, "running multiple agents in collaboration only results in fragile systems."

**Anthropic — multi-agent research system (published one day later):**
- Orchestrator-worker; lead agent plans, spawns 3–5 parallel subagents, synthesizes, then a separate citation pass.
- Lead agent **saves its plan to Memory** to survive the 200k truncation boundary.
- Subagents "function as intelligent filters," returning condensed findings.
- **Numbers:** ~**15x** the tokens of a normal chat for the multi-agent system; a single agent is ~**4x** chat; **token usage alone explains 80% of performance variance** on their browsing eval; the Opus-4-lead + Sonnet-4-subagents configuration beat single-agent Opus 4 by **90.2%** on their internal research eval.
- Named failure modes: spawning too many subagents for simple queries, endless searching for nonexistent sources, duplicated work from vague task descriptions, preferring SEO content over authoritative sources.

**Reconciliation used by most practitioners:** the disagreement is about *decisions*, not about *reading*. Parallel subagents that each make binding implementation decisions produce conflicts (Cognition is right). Parallel subagents that only **read and report** produce no conflicts (Anthropic is right). Retrieval is read-only. **A retrieval subagent is the case where both camps agree fan-out is safe.**

- https://cognition.com/blog/dont-build-multi-agents
- https://www.anthropic.com/engineering/multi-agent-research-system

### 4.2 Shared store vs per-agent memory

| System | Topology |
|---|---|
| Claude Code subagents | Per-agent context; **shared read-only substrate** via CLAUDE.md hierarchy auto-loaded into every non-fork subagent; optional persistent `memory` scope per subagent (`user`/`project`/`local`) |
| Anthropic research system | Per-agent context + shared filesystem/artifact store; lead's plan externalized to Memory |
| CrewAI | Shared crew-level store: short-term (ChromaDB RAG, in-run), long-term (SQLite, cross-run), entity memory (RAG) |
| AutoGen / AG2 | Message lists + "teachable" agents persisting learned facts to an external store |
| LangGraph / LangMem | Namespaced JSON store (`namespace` = user/org, `key` = filename), optionally vector-searchable; hot-path tools *or* background managers |
| Factory | A dedicated **Knowledge droid** indexes repo, docs and ticket history so downstream droids "share a common context store rather than re-reading the codebase each run" |
| Amp (Sourcegraph) | Per-thread context; **Oracle** subagent runs a *different model* in its own window; `/handoff` seeds a new thread from a structured digest of the old one |

### 4.3 Blackboard

The classical blackboard architecture is being rediscovered for LLM agents:
- Han & Zhang (2025): agents share all information via a blackboard, the next actor is selected from blackboard content, repeat until consensus — competitive with SOTA static and dynamic multi-agent systems "while spending less tokens."
- Salemi et al. (2025/26): a central agent posts requests to a shared blackboard and subordinate agents volunteer based on capability — **13%–57% relative improvement in end-to-end success**.

The blackboard is the middle ground between Cognition's full-trace sharing (expensive) and pure digest-passing (lossy): a shared *structured artifact* rather than a shared *transcript*.

- https://arxiv.org/abs/2507.01701
- https://arxiv.org/abs/2510.01285

### 4.4 "Digest up, brief down"

The recurring shape across all orchestrator-worker systems:

- **Down (brief):** the orchestrator writes a *task specification*, not a context dump. Anthropic's named failure mode is precisely under-specified briefs causing duplicated work. The brief must carry objective, output format, boundaries, and the tools/sources to use.
- **Up (digest):** the subagent returns synthesis, not transcript — 1–2k tokens, with **pointers** (file paths, line numbers, URLs) so the parent can escalate to full text if the digest proved insufficient. Pointers are what convert a lossy digest into a recoverable one; this is the same reversible-compression principle Manus applies to web content ("preserving URLs and file paths allows dropping webpage content… without permanent information loss").

---

## 5. Case studies with numbers

| System | Mechanism | Reported numbers | Source confidence |
|---|---|---|---|
| **Anthropic multi-agent research** | Orchestrator-worker, digest return, plan externalized to Memory | 15x chat tokens; single agent 4x; token use explains **80%** of perf variance; **+90.2%** vs single-agent Opus 4 | Primary |
| **Claude context management API** | Context editing + memory tool | **+39%** combined, **+29%** editing alone, **−84%** tokens over 100 turns | Primary |
| **Anthropic code execution w/ MCP** | Tools as filesystem code, sandbox-side filtering | **150k → 2k tokens (−98.7%)** | Primary |
| **Agent Skills** | Progressive disclosure | ~30–50 tok/skill at startup; ~5k on activation; 100 skills ≈ 3–5k tok | Secondary, consistent |
| **Claude Code compaction** | Micro / auto (~83%, 13k buffer) / manual | 167k of 200k trigger | Secondary (internals reverse-engineered) |
| **Claude Code subagents** | Isolated window; only final summary returns; fork shares cache, non-fork does not | Qualitative (docs) | Primary |
| **Mem0** | Single-pass ADD-only extraction + multi-signal retrieval | LoCoMo **92.5**, LongMemEval **94.4**, ~**6.8–7.0k tok/query** vs **25k+** full-context (3–4x); write-time LLM calls **−60–70%**; earlier gen claimed **−90%** tokens (1.8k vs 26k) | Primary (vendor — self-reported) |
| **Zep / Graphiti** | Temporal knowledge graph, episode/entity/community subgraphs | DMR **94.8%** vs MemGPT 93.4%; LongMemEval **+18.5%** accuracy with **−90%** latency | Primary (vendor + arXiv 2501.13956) |
| **ACE** | Generator/Reflector/Curator, delta updates | **+10.6%** agents, **+8.6%** finance, up to **+17.1%** AppWorld; **−82.3%** adaptation latency, **−75.1%** rollouts; **−91.5%** latency / **−83.6%** cost on ingest/gen | Primary (arXiv 2510.04618) |
| **Reflexion** | Verbal RL, episodic reflection buffer | HumanEval **91%** pass@1 vs 80%; HotPotQA **+20%**; reflection **+8%** over episodic memory alone | Primary (NeurIPS 2023) |
| **Manus** | KV-cache design, file-system context, todo.md recitation | cached `$0.30`/MTok vs `$3`/MTok (**10x**); input:output ≈ **100:1**; ~**50** tool calls/task | Primary |
| **Chroma context rot** | Long-context degradation study | 18 models; **30–50%** accuracy drops before the documented limit | Primary |
| **Blackboard (Salemi et al.)** | Shared workspace, capability-based volunteering | **+13–57%** relative end-to-end success | Primary (arXiv) |
| **Prompt cache engineering** | Prefix reordering | ProjectDiscovery **7% → 74%** hit rate, **−59%** cost; Claude Code cited at **92%** hit / **−81%** cost | Secondary |
| **Cursor / Windsurf** | Background extraction of durable facts into memories; rules are hand-written, memories are inferred | No published numbers | Secondary |
| **Factory** | Knowledge droid as shared index for downstream droids | No published numbers | Vendor docs |
| **Cognition/Devin** | Single-threaded + dedicated compression model | No published numbers; position paper | Primary |

---

## 6. Recurring architectural principles

**P1 — Split the corpus into a stable index and a variable bulk.**
Every mature system does this: skills metadata vs SKILL.md body; CLAUDE.md vs glob/grep; MCP tool names vs full schemas; Mem0's fact records vs source conversations. The index is small, stable, and lives in the cached prefix. The bulk is fetched by whoever needs it, when they need it. Pre-loading vs retrieval is a false dichotomy — you do both, to different tiers.

**P2 — The consumer retrieves, not the coordinator.**
The agent that will *use* a piece of knowledge is the one best positioned to formulate the query and judge sufficiency. Routing retrieval through the orchestrator adds a translation step, burns the most expensive context window, and produces exactly the "retrieval miss with no recovery" failure mode.

**P3 — Compression must be reversible.**
Digests carry pointers (paths, line numbers, URLs, IDs) so a lossy summary can be escalated to full text. Manus drops page content but keeps URLs; Anthropic subagents return summaries but write bulk to the filesystem; ACE keeps itemized entries rather than prose. Irreversible summarization is where context collapse starts.

**P4 — Append deltas; never rewrite wholesale.**
ACE names the failure (context collapse, brevity bias); Mem0 v2 abandoned reconciliation-on-write for ADD-only accretion for the same reason. Curation is a separate, deliberate, ideally deterministic step — not a side effect of every write.

**P5 — Isolation costs a cache miss and a cold start; spend it only where the bulk is large.**
A non-fork Claude Code subagent gets a separate prompt cache, reloads the whole CLAUDE.md hierarchy, and must rediscover context from scratch. That is worth it when it keeps 30k tokens of exploration out of the parent; it is a net loss when it keeps 3k tokens of markdown out of the parent.

**P6 — Read-only fan-out is safe; decision fan-out is not.**
This is the actual resolution of Cognition vs Anthropic. Conflicting *decisions* made in isolated contexts are what break multi-agent systems. Retrieval, search, and review are read-only and parallelize cleanly.

**P7 — The learning surface is artifacts, not weights.**
Files, playbooks, and skills, updated in minutes; fine-tuning runs in weeks and needs thousands of stable examples. Every production coding harness surveyed learns in token space. Weight updates belong to the model vendor, not the harness.

**P8 — Store procedures where you can, facts where you must.**
Voyager's executable skill library, Anthropic's `./skills/`, Agent Skills, and Cursor rules all encode *how to act*, which is verifiable by execution and composable. Fact stores (Mem0, Zep) are for what cannot be made procedural. A learnings corpus that produces reusable procedures beats one that produces reusable prose.

---

## 7. Sketch: markdown-learnings corpus + retrieval subagent in a Claude Code-style harness

### 7.1 Diagnosis of the "orchestrator pre-loads whole learnings files" pattern

It is wrong for the reason people usually cite (raw bytes in the most expensive window) **and** right for a reason people usually miss (a stable prefix is cached, hence nearly free). The decision rule:

- **Corpus < ~3–5k tokens and stable across the session** → pre-loading is correct. It is cached; retrieval would cost more in latency and tool round-trips than it saves. Do not build a retrieval subagent for this.
- **Corpus grows per phase and is mostly irrelevant to any given phase** → pre-loading is wrong, and gets worse monotonically. Split it.

Because a GSD learnings corpus grows one file per phase forever, it lands in the second case within a handful of milestones. The fix is not "move retrieval into subagents" — it is **tier the corpus**, then decide per tier.

### 7.2 The wiring

```
.planning/learnings/
  INDEX.md              # tier 1 — one line per learning, stable, cacheable
  L-0007-webview-attach.md
  L-0012-nix-rpath-space.md
  ...
```

**Tier 1 — `INDEX.md`, pre-loaded into the orchestrator prefix.**
One line per learning, ~25–40 tokens, modeled on skills metadata:

```
L-0012 | nix, linker, paths | Repo path with a space breaks cc-wrapper rpath in mkShell | ->L-0012-nix-rpath-space.md
```

100 learnings ≈ 3–4k tokens, sits above the volatile part of the prompt, cached after the first request. This is the "naively dropped in up front" half of Anthropic's hybrid, and it is what makes retrieval *targeted* rather than semantic-guesswork.

**Tier 2 — full learning files, read just-in-time by the consumer.**
The planner/researcher subagent receives the index (or the index is in CLAUDE.md-adjacent project context that subagents auto-load) and reads only the two or three files whose index lines match its phase. Plain `Read` by path. No embeddings, no vector store — matching the Agent SDK's "start with agentic search, add semantic only if speed forces it."

**Tier 3 — a `learnings-librarian` retrieval subagent, only when the index stops fitting.**
Add it when `INDEX.md` itself exceeds ~5k tokens (roughly 150+ learnings). Then:
- **Brief down:** the orchestrator sends the phase objective, the touched subsystems, and an explicit output contract — "return ≤1,500 tokens: at most 7 items, each `ID | one-line claim | file:line pointer | why it applies to this phase`; say NONE APPLY if nothing does."
- **Librarian:** greps/reads the corpus in its own window, burns whatever it needs.
- **Digest up:** ≤1.5k tokens **with pointers**, so the planner can escalate to full text on any item.
- Configure it like the built-in Explore agent: skip CLAUDE.md and git status (`includeGitInstructions: false`), minimal tool allowlist (Read/Grep/Glob), cheaper model. Otherwise the CLAUDE.md hierarchy reload eats the savings.

**What enters the orchestrator context, ever:**
1. `INDEX.md` (stable, cached).
2. The librarian's digest, if tier 3 is active (~1.5k).
3. Nothing else. Full learning files never enter the orchestrator — they enter the planner, which is the consumer.

**Who queries:** the planner (tier 2) or the librarian (tier 3). Never the orchestrator.
**Who digests:** the librarian, against an explicit output contract written by the orchestrator.

### 7.3 The write side

Keep end-of-phase extraction — it is the right policy for bounded, reviewable, low-volume engineering knowledge, and it is one LLM call per phase. Three changes, all from ACE and Manus:

1. **Append itemized deltas with stable IDs.** Each learning is its own file plus one index line. The extractor appends; it never regenerates `INDEX.md` from scratch. Dedup by ID and by grep, not by asking a model to merge prose.
2. **Give every entry a trigger condition**, not just a conclusion — "when touching X, do Y because Z." A trigger is what makes the index line matchable and turns the entry into a procedure (P8) rather than a memoir.
3. **Record the rejected approach and why it failed.** Manus's "keep the wrong stuff in" is the highest-value and most commonly discarded content in a post-mortem.

Optional, if learnings quality decays: add a periodic **curation** pass (ACE's Curator, Letta's sleep-time agent) that runs *between* phases, not during — dedupes, merges near-duplicates, prunes entries never retrieved, and rewrites index lines. Separating the curator from the actor is the point: the agent doing the work should not be rewriting its own memory mid-task.

### 7.4 What to measure before and after

- Orchestrator input tokens at planner-spawn time (should drop to index-only).
- Prompt cache hit rate on the orchestrator prefix (should *rise*, because the index is stable where whole learnings files were not).
- Retrieval-miss rate: how often the planner had to escalate past the digest to full text (if high, the digest contract is wrong, not the architecture).

---

## Sources

**Anthropic / Claude (primary)**
- https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- https://www.anthropic.com/engineering/multi-agent-research-system
- https://www.anthropic.com/engineering/code-execution-with-mcp
- https://claude.com/blog/context-management
- https://claude.com/blog/building-agents-with-the-claude-agent-sdk
- https://code.claude.com/docs/en/sub-agents
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
- https://platform.claude.com/cookbook/tool-use-automatic-context-compaction

**Other vendor engineering**
- https://cognition.com/blog/dont-build-multi-agents
- https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus
- https://www.letta.com/blog/sleep-time-compute/
- https://www.letta.com/blog/memory-blocks/
- https://www.letta.com/blog/continual-learning/
- https://docs.letta.com/guides/agents/architectures/sleeptime/
- https://mem0.ai/blog/mem0-the-token-efficient-memory-algorithm
- https://mem0.ai/research
- https://www.getzep.com/ai-agents/temporal-knowledge-graph/
- https://help.getzep.com/graphiti/getting-started/overview
- https://www.langchain.com/blog/memory-for-agents
- https://docs.langchain.com/oss/python/concepts/memory
- https://docs.factory.ai/guides/power-user/memory-management
- https://github.com/ampcode/amp-examples-and-guides/blob/main/guides/context-management/Context%20Engineering%20-%20Amp.md
- https://www.trychroma.com/research/context-rot

**Papers**
- https://arxiv.org/abs/2510.04618 — Agentic Context Engineering (ACE)
- https://arxiv.org/abs/2303.11366 — Reflexion
- https://arxiv.org/abs/2305.16291 — Voyager
- https://arxiv.org/abs/2504.13171 — Sleep-time compute
- https://arxiv.org/abs/2501.13956 — Zep temporal knowledge graph
- https://arxiv.org/abs/2507.01701 — Blackboard architecture for LLM multi-agent systems
- https://arxiv.org/abs/2510.01285 — Blackboard system for information discovery
- https://arxiv.org/abs/2603.07670 — Memory for Autonomous LLM Agents (survey)
- https://dl.acm.org/doi/fullHtml/10.1145/3586183.3606763 — Generative Agents

**Secondary / reverse-engineering (flagged where used)**
- https://zhanghandong.github.io/harness-engineering-from-cc-to-ai-coding/en/part3/ch09.html
- https://decodeclaude.com/compaction-deep-dive/
- https://www.newsletter.swirlai.com/p/agent-skills-progressive-disclosure
- https://www.firecrawl.dev/blog/agent-skills
- https://www.digitalocean.com/community/conceptual-articles/prompt-caching-in-practice-hit-rate
- https://agentmarketcap.ai/blog/2026/04/11/prompt-cache-hit-rate-engineering-2026
- https://agentpatterns.ai/patterns/multi-agent/sub-agents-fan-out/
- https://www.philschmid.de/subagent-patterns-2026
- https://localskills.sh/blog/cursor-memories-guide
- https://memnexus.ai/blog/2026-02-20-windsurf-persistent-memory
- https://dev.to/foxgem/ai-agent-memory-a-comparative-analysis-of-langgraph-crewai-and-autogen-31dp
