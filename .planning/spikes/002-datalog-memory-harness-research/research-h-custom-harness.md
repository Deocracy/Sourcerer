# Research H — Building a Custom Agent Harness

**Spike:** 002-datalog-memory-harness-research
**Date:** 2026-08-20
**Scope:** what a coding-agent harness is internally, which open implementations to crib, heterogeneous frontier+small-model harnesses, memory-store integration surfaces, and the honest cost of rolling your own.

**Reader frame (given, not researched):** Claude Code reads as a black box. The target design is one frontier model orchestrating small fast (~8B) subagents over a custom Datalog knowledge-graph memory.

**Confidence legend:** `[P]` primary source (repo, official docs, paper). `[S]` secondary (analysis blog, vendor post). `[?]` single-source / unverified — treat as a lead, not a fact.

---

## 0. The one-paragraph answer

A harness is not one thing; it is twelve subsystems, of which the agent loop is the smallest and easiest. The loop is ~100 lines — `mini-swe-agent` proves it and scores >74% on SWE-bench Verified with it. Everything expensive lives around the loop: context assembly and compaction, prompt-cache discipline, the permission/sandbox layer, subagent spawn-and-digest, retry/error contracts, and session persistence. Published evidence says these choices move benchmark scores 11–48 percentage points on a fixed model, which is 3–10× larger than the model upgrades papers celebrate. So the harness is worth owning — but "owning the harness" and "writing all of it" are different decisions, and the middle paths (Claude Agent SDK, forking Pi or the OpenHands SDK) preserve nearly all of the not-a-black-box goal.

---

## 1. Anatomy of a coding-agent harness

### 1.1 The loop, drawn

```
                      ┌──────────────────────── SESSION STORE ─────────────────────────┐
                      │  append-only event log · resumable · replayable · forkable     │
                      └───────────────▲───────────────────────────┬────────────────────┘
                                      │ persist every event       │ resume / fork
                                      │                           │
  ┌───────────────────────────────────┴───────────────────────────▼───────────────────┐
  │                              1. CONTEXT ASSEMBLY                                  │
  │  system prompt · project files (CLAUDE.md/AGENTS.md) · tool catalogue (JSON       │
  │  schemas) · skill/prompt-template summaries · retrieved memory · message history  │
  │  ── ordered STABLE→VOLATILE so the prompt cache prefix survives ──                │
  └───────────────────────────────────┬───────────────────────────────────────────────┘
                                      │ assembled messages[]
                      ┌───────────────▼───────────────┐
                      │      2. MODEL CALL LAYER      │◄── provider adapters, retry w/
                      │  cache breakpoints · streaming│    backoff, 429/5xx failover,
                      │  token accounting · budgets   │    dialect normalisation
                      └───────────────┬───────────────┘
                                      │ assistant message (text + tool_calls | raw text)
                      ┌───────────────▼───────────────┐
                      │      3. OUTPUT PARSING        │  native tool_use blocks, OR
                      │  format-error counter → retry │  regex/fenced-block extraction,
                      │  N strikes → abort            │  OR grammar-constrained decode
                      └───────────────┬───────────────┘
                                      │ Action
                      ┌───────────────▼───────────────┐
                      │   4. PERMISSION / POLICY      │  allow · deny · ask · mode
                      │  path scoping, arg-level rules│  hooks (deterministic veto)
                      └───────────────┬───────────────┘
                                      │ approved Action
                      ┌───────────────▼───────────────┐
                      │   5. TOOL DISPATCH + SANDBOX  │  bash/read/write/edit/search,
                      │  timeouts · output truncation │  MCP clients, subagent spawn,
                      │  cwd & env persistence        │  container/seccomp/landlock
                      └───────────────┬───────────────┘
                                      │ Observation (truncated, formatted)
                      ┌───────────────▼───────────────┐
                      │  6. OBSERVATION FORMATTING    │  head/tail truncation, exit
                      │  templating into a user msg   │  codes, stderr policy, images
                      └───────────────┬───────────────┘
                                      │
                      ┌───────────────▼───────────────┐
                      │  7. TERMINATION / BUDGET      │  submit-detection, step limit,
                      │  cost limit, wall-clock limit │  cost limit, stall detection
                      └───────────────┬───────────────┘
                          continue ◄──┤──► done → 8. RESULT + DIGEST
                                      │
                      ┌───────────────▼───────────────┐
                      │  9. COMPACTION TRIGGER        │  fires when tokens > threshold:
                      │  summarise → new window       │  summary + pinned files + notes
                      └───────────────────────────────┘

  Cross-cutting: 10. OBSERVABILITY (traces, token/cost metering, trajectory dumps)
                 11. SUBAGENT PROTOCOL (spawn w/ own window+model+tools, return digest)
                 12. UX / TRANSPORT (TUI, streaming render, interrupt, RPC/JSON modes)
```

### 1.2 The twelve subsystems, with evidence

The academic version of this checklist is the **ETCSOVG taxonomy** from *Stop Comparing LLM Agents Without Disclosing the Harness* (arXiv 2605.23950) `[P]`: seven layers — **E**xecution (runtime substrate, sandboxing, step/task budgets), **T**ool (tool list, schemas, error contract), **C**ontext (window cap, compression/retrieval policy, persistent memory), **S**cheduling (agent loop, retry and escalation rules), **O**bservability (logged artifacts, traces), **V**erification (validation, self-checking, anomaly detection), **G**overnance (permission model, side-effect boundaries, human approval points). The paper proposes a "Harness Card" disclosure for benchmark submissions. **Use ETCSOVG as your build checklist** — it is the closest thing to a normative spec for "what a harness is."

| # | Subsystem | What it actually decides | Reference implementation to read |
|---|---|---|---|
| 1 | Context assembly | What the model sees each turn and in what order | Pi `system-prompt.ts` (~300 words); Aider repo map; Claude Agent SDK "what consumes context" table |
| 2 | Model call layer | Provider dialects, streaming, retries, failover, budgets | LiteLLM (used by OpenHands SDK as its LLM layer); `minisweagent/models/` |
| 3 | Output parsing | Native tool-calling vs text extraction vs grammar-constrained | mini-swe-agent (bash-in-fenced-block, no tool API); vLLM tool parsers |
| 4 | Permission/policy | Which tool calls execute at all | Claude Agent SDK `allowedTools`/`disallowedTools`/`permissionMode`; OpenCode per-agent permissions |
| 5 | Tool dispatch + sandbox | Blast radius | OpenHands `Workspace` (local process or Docker); Codex CLI (Rust, seatbelt/landlock) |
| 6 | Observation formatting | Truncation policy — the single largest token sink | SWE-agent ACI (100-line file viewer, match-list-only search) |
| 7 | Termination/budget | When to stop, and how to stop *wrong* loops | mini-swe-agent `step_limit` / `cost_limit` / `wall_time_limit_seconds` |
| 8 | Result + digest | What a run returns to its caller | Anthropic subagent digest pattern (see §5.3) |
| 9 | Compaction | Survival past the context window | OpenHands Condenser; Claude Code/SDK auto-compaction; Pi customisable compaction |
| 10 | Observability | Whether you can debug anything | OpenHands append-only `EventLog`; mini-swe-agent trajectory JSON |
| 11 | Subagent protocol | Isolation + digest contract | Claude Agent SDK `agents` param (per-agent prompt, tools, **model**) |
| 12 | UX/transport | Interactive TUI, print/JSON, RPC, SDK | Pi's four modes: interactive, print/JSON, RPC, SDK |

### 1.3 The loop is genuinely ~100 lines

`SWE-agent/mini-swe-agent` (MIT, Python, 6,648 stars, last pushed 2026-08-17) `[P]` is the single best artefact for understanding harness anatomy, because it *deliberately* strips everything optional and still scores **>74% on SWE-bench Verified** (README claim; an earlier announcement cited 65%, so the number has moved with models — treat ">74%" as the current README figure) `[P]`.

Its `DefaultAgent` (`src/minisweagent/agents/default.py`) is the whole loop `[P]`:

- `AgentConfig` dataclass: `system_template`, `instance_template`, `step_limit`, `cost_limit`, `wall_time_limit_seconds`, `max_consecutive_format_errors`, `output_path`.
- `run()` — loop `step()` until a terminating exception.
- `step()` — literally `return self.execute_actions(self.query())`.
- `query()` — check limits, call the model, track cost and call count.
- `execute_actions()` — `self.env.execute(action)` per action, then append formatted observation messages.
- `add_messages()`, `get_template_vars()`, `_render_template()` (Jinja2 with `StrictUndefined`), `serialize()`/`save()`.

Design choices worth stealing wholesale:

1. **Linear, append-only history.** Every step appends; nothing is edited in place. The README calls this out as the reason it is easy to debug and to use for fine-tuning data.
2. **No tool-calling API.** The model emits a bash command in a fenced block; the harness extracts and runs it. This makes the harness model-agnostic — it works with any model that can write shell, including local ones with no function-calling training. **This is directly relevant to the ~8B subagent plan.**
3. **One tool: bash.** Everything else (read, edit, search, test) is a shell invocation. Zero tool-schema maintenance.
4. **`StrictUndefined` templating.** Prompt assembly fails loudly on a missing variable instead of silently emitting an empty string. Cheap, high-value.
5. **Three orthogonal budgets** (steps, dollars, wall-clock) plus a *consecutive format error* counter. That fourth one is the guard against a small model that cannot produce parseable output — it aborts instead of burning the budget.

The contrast: SWE-agent proper (MIT, 20,093 stars) built an elaborate **Agent-Computer Interface** — linter-gated edits, a 100-line-window file viewer with scroll/search, a directory search that lists only matching filenames `[P]`. The SWE-agent docs now say, at the top of the ACI page: *"We now recommend mini-swe-agent instead of SWE-agent: Same performance, much more simple & flexible."* `[P]` That is the strongest single data point against elaborate tooling for its own sake — but note *what survived*: the ACI insight that **observation truncation policy is a first-class design decision** is still true, it just moved from bespoke tools into "how you format bash output."

### 1.4 The event-log model (the other reference shape)

The **OpenHands Software Agent SDK** (MIT, Python, 1,012 stars, active 2026-08-21) `[P]` is the well-factored production version of the same idea. Its architecture paper (arXiv 2511.03690) and docs describe:

- A **stateless `Agent`** that is a pure function from event history → next event.
- A **`Conversation`** that runs the loop and owns an **append-only `EventLog`**.
- A **`Workspace`** (local process or Docker container) that executes Actions and returns Observations.
- An **LLM wrapped by LiteLLM** for provider portability.
- Typed events: `ActionEvent` for tool calls, `ObservationBaseEvent` subclasses for results, all deriving from `LLMConvertibleEvent` (Pydantic, immutable, ID + timestamp + source).

The error taxonomy is worth copying verbatim `[P]`:

| Event | LLM sees it? | Effect |
|---|---|---|
| `AgentErrorEvent` (has `tool_name`, `tool_call_id`) | **Yes** — sent as a tool message so the model can recover | conversation continues |
| `ConversationErrorEvent` (no tool ids, source "environment") | **No** | run loop → ERROR, `run()` raises `ConversationRunError` |

That distinction — *"is this error the model's problem or the operator's problem?"* — is the retry/error policy in one line, and most home-grown harnesses get it wrong by feeding infrastructure failures back to the model, which then hallucinates workarounds.

OpenHands also condenses context automatically when the window approaches its limit, via summarisation `[P]`.

### 1.5 Compaction, specifically

Anthropic's *Effective context engineering for AI agents* (2025-09-29) `[P]` names three long-horizon techniques:

1. **Compaction** — summarise a near-full window, reinitialise a new window from the summary. Described as "the first lever."
2. **Structured note-taking** — the agent writes notes to a file outside the window and re-reads them after a reset. A file-based memory tool shipped in public beta with Sonnet 4.5.
3. **Sub-agent architectures** — specialised subagents with clean windows; each may burn tens of thousands of tokens and return **only a condensed 1,000–2,000 token digest**.

That digest ratio is the actual subagent protocol. It is also the reason subagents are a context strategy first and a parallelism strategy second.

Claude Agent SDK docs confirm the compaction trigger is automatic and threshold-based `[P]`. The SDK also documents the per-source context cost table (system prompt every request; CLAUDE.md full content every request but prompt-cached; built-in tool schemas every request; **MCP tool schemas deferred by default via tool search**; skill descriptions as short summaries with full content loaded on invocation) `[P]`. That last one — progressive disclosure of skills, deferred MCP schemas — is a non-obvious subsystem most custom harnesses omit and then wonder where 15k tokens went.

### 1.6 Prompt-cache management (the subsystem nobody plans for)

Anthropic prompt caching mechanics, relevant to any harness that hits Claude `[P]/[S]`:

- Up to **4 cache breakpoints** per request, each with a **20-content-block lookback window**.
- Cache **writes cost 1.25×** the normal input rate; **reads cost 0.10×** (90% discount).
- Default TTL **5 minutes**; a **1-hour** option at a higher write rate.
- Invalidation is **hierarchical and prefix-ordered**: change any content block and that block plus everything after it is invalidated.

The harness consequences, which are pure engineering discipline and easy to get wrong `[S]`:

- Tool definitions must be **byte-identical and in the same order** every request. If your tool list comes out of a dict or set, sort it by name — non-deterministic ordering silently kills the cache.
- Anything volatile (current time, token counters, todo state) must go at the **end** of the prompt, never the top.
- With a 20-block lookback, agents need **intermediate breakpoints roughly every 18 blocks**; that covers about 54 content blocks ≈ 18–27 agent steps before degrading to partial caching.
- Reported production cache hit rates cluster **50–80%**; below that, it is a bug.

For a heterogeneous harness this matters twice: the frontier orchestrator wants a long stable cached prefix, while small-model workers typically get no caching benefit at all from a local vLLM/llama.cpp server unless you configure prefix caching there separately.

---

## 2. How black a box is Claude Code, actually?

Less than it feels, on three independent axes.

**Axis 1 — the loop is documented and re-usable.** The **Claude Agent SDK** explicitly states it "gives you the same tools, agent loop, and context management that power Claude Code, programmable in Python and TypeScript" `[P]`. It documents: the gather-context → take-action → verify-work cycle; what consumes context per source; automatic compaction; `allowed_tools` / `disallowed_tools` / `permission_mode` and their evaluation order; scoped rules like `Bash(npm *)`; custom tool handlers; MCP servers; per-agent subagent definitions with their own system prompt, tool restrictions, and **model override**; and `ResultMessage.total_cost_usd` with per-model token breakdown when subagents run `[P]/[S]`. The SDK's own comparison table names the three tiers honestly: Agent SDK (loop provided), CLI (interactive), Client SDK ("you implement the tool loop yourself") `[P]`.

**Axis 2 — the prompts are extracted.** Multiple public repos host reverse-engineered Claude Code system prompts, validated against Anthropic's officially published prompts `[S]`. The prompt is not the secret.

**Axis 3 — the source leaked.** On **2026-03-31**, a stray `.map` source-map file shipped inside `@anthropic-ai/claude-code` **v2.1.88**: ~**59.8 MB**, ~**512,000 lines** of unobfuscated TypeScript across ~**1,900 files**, including internal feature gates that were meant to be stripped `[S — multiple secondary reports, not verified against the artefact]`. Claude Code remains **proprietary** under Anthropic's Commercial ToS; no OSI licence `[S]`. Reading leaked source is a legal question, not a technical one — flagging, not recommending.

**Verdict for the reader:** the black-box complaint is mostly about *inspectability at runtime*, not about the algorithm being secret. If the real want is "I can see and change every decision in the loop," the Agent SDK gets ~80% of the way and Pi/OpenHands SDK get ~100% — without writing a provider layer.

---

## 3. Open reference implementations — current state (verified 2026-08-20/21 via GitHub API)

| Project | Stars | Licence | Lang | Last push | Shape | Crib it for |
|---|---:|---|---|---|---|---|
| **SWE-agent/mini-swe-agent** | 6,648 | MIT | Python | 2026-08-17 | ~100-line loop, bash-only, linear history | **The loop itself.** Best teaching artefact in existence. |
| SWE-agent/SWE-agent | 20,093 | MIT | Python | 2026-08-17 | ACI-heavy, config-driven | ACI/tool-design lessons; docs now point to mini |
| **OpenHands/software-agent-sdk** | 1,012 | MIT | Python | 2026-08-21 | Stateless Agent + EventLog + Workspace + LiteLLM | **Production architecture.** Event model, error taxonomy, condenser, sandbox |
| OpenHands/OpenHands | 84,654 | MIT | TS | 2026-08-21 | Full product on top of the SDK | Docker action-execution server, UI |
| **earendil-works/pi** | 94,566 | MIT | TS | 2026-08-20 | Minimal harness: 4 tools, ~300-word prompt, extensions | **Best fork target.** Compaction/context hooks are first-class |
| anomalyco/opencode | 199,631 | MIT | TS | 2026-08-21 | Full terminal agent, provider-agnostic | Per-agent model+permission config; LSP integration |
| openai/codex | 108,888 | Apache-2.0 | Rust | 2026-08-21 | Terminal agent, Rust | OS-level sandboxing (seatbelt/landlock) |
| aaif-goose/goose | 53,101 | Apache-2.0 | Rust | 2026-08-21 | General agent, MCP-native, recipes | MCP extension model; moved from `block/goose` to the Agentic AI Foundation (Linux Foundation) `[S]` |
| Aider-AI/aider | 48,370 | Apache-2.0 | Python | **2026-05-22** | Edit-format-centric pair programmer | **Repo map** (tree-sitter + graph ranking into a token budget). Note: ~3 months without a push — verify maintenance before depending on it |
| huggingface/smolagents | 28,912 | Apache-2.0 | Python | 2026-07-21 | Library; `CodeAgent` vs `ToolCallingAgent` | Code-as-action pattern |

Notable ecosystem churn to be aware of `[S], single-source`: Gemini CLI reportedly retired 2026-06-18 for a closed successor; Roo Code archived May 2026; OpenCode dropped Claude Pro/Max login after a dispute with Anthropic. Verify before relying on any of these.

### 3.1 Aider's repo map — the one context-assembly idea worth copying `[P]`

Aider sends a **concise map of the whole git repo**: file list plus key symbols with their defining lines, elided with `⋮...`. When the full map exceeds budget, it ranks it — *"a graph ranking algorithm, computed on a graph where each source file is a node and edges connect files which have dependencies"* — and emits only the highest-ranked portions that fit. Budget is `--map-tokens`, default **1k tokens**, dynamically expanded when no files are in the chat.

This is the closest existing analogue to the Datalog-graph plan: a structural graph over code, ranked and serialised into a fixed token budget as *auto-injected context* rather than as a tool call. Worth deciding deliberately which of those two surfaces the Datalog store uses (see §6).

### 3.2 smolagents' `CodeAgent` `[P]/[S]`

smolagents' thesis: have the model write **Python code** that calls tools, rather than emit JSON tool calls. Claimed benefit: ~30% fewer steps and LLM calls, better performance on complex benchmarks, natural composability (loops, conditionals, variable reuse across tool calls in one action) `[S — HF blog and derivative posts]`. `ToolCallingAgent` remains the stable option for models fine-tuned on structured tool calls.

The relevance to ~8B workers is double-edged: code-as-action removes the JSON-schema burden (good for weak models) but demands syntactically valid Python plus safe execution (bad for weak models, and a sandbox requirement). mini-swe-agent's bash-in-a-fence is the lower-capability version of the same trick and is the safer default for 8B.

---

## 4. Framework vs from-scratch

### 4.1 What each option imposes and handles

| Option | Stars / licence (2026-08-21) | Imposes | Handles for you | Loop visible? |
|---|---|---|---|---|
| **Raw loop (own code)** | — | Everything | Nothing | Totally |
| **Claude Agent SDK** | proprietary lib, Anthropic | Claude-family models; Anthropic's tool set and permission semantics | Loop, built-in tools, compaction, prompt caching, permissions, subagents w/ per-agent model, MCP, cost accounting | Documented, configurable, not editable |
| **Pi** (`earendil-works/pi`) | 94,566 / MIT | TypeScript; a minimal opinionated core | Multi-provider auth (30+ backends incl. local), sessions, compaction, skills, AGENTS.md/SYSTEM.md, 4 modes (interactive/print-JSON/RPC/SDK) | Fully — it *is* the loop, and compaction/context are extension points |
| **OpenHands Agent SDK** | 1,012 / MIT | Python; Pydantic event model | Event log, condenser, sandboxed Workspace, LiteLLM provider layer, replay | Fully |
| **LangGraph** | 40,139 / MIT | Graph/state-machine mental model, its state and checkpoint types | Durable execution, checkpointing, streaming, human-in-the-loop primitives | Behind a graph abstraction |
| **PydanticAI** | 19,423 / MIT | Python typing discipline | Typed/validated outputs, model-agnostic; V2 (Jun 2026) described as a "harness-first redesign" with a capabilities primitive `[S]` | Mostly |
| **Agno** | 41,813 / Apache-2.0 | Its agent/team abstractions | High-throughput multi-agent runtime | Partly |
| **CrewAI** | 57,403 / MIT | Role/crew metaphor | Role-based multi-agent teams, pluggable memory/knowledge/RAG backends (1.14) `[S]` | Poorly |
| **AG2** (AutoGen fork) | 4,881 / Apache-2.0 | Conversational multi-agent metaphor | Group chat orchestration | Poorly |
| **Mastra** | 27,343 / NOASSERTION | TypeScript stack | Workflows, agents, evals for TS teams | Partly |
| **DSPy** | 37,463 / MIT | Programs-not-prompts; compilation step | Prompt/weight optimisation as compilation | Different axis — it optimises *what you send*, not *how you loop* |
| **LiteLLM** | 56,886 / NOASSERTION | Nothing structural | Provider normalisation to OpenAI Chat Completions incl. **error-class mapping**, routing, failover | N/A — it is subsystem #2 only |

**Note DSPy is orthogonal, not an alternative.** If the reader wants a Datalog-query-generating small model that reliably produces correct queries, DSPy's optimiser-over-few-shots is a plausible tool *inside* their harness, not a replacement for it.

### 4.2 The "just write the loop" position

Anthropic's *Building effective agents* (Dec 2024, still the canonical statement) `[P]`: *"the most successful implementations weren't using complex frameworks or specialized libraries. Instead, they were building with simple, composable patterns."* The post now carries an editorial note that the tooling landscape has changed and points to Managed Agents — i.e. Anthropic itself has moved from "write the loop" toward "here is a hosted loop," which is a useful signal about where the difficulty actually is (not the loop; the infrastructure around it).

The 2026 consensus position from the secondary literature `[S]` is a good decision rule: **build the raw loop until you hit a specific named pain, then adopt a framework to solve that pain, not on principle** — and when you do adopt one, *wrap* the loop rather than surrender it: you should still be able to point at where the model decides and where your code acts.

### 4.3 Evidence that the harness moves scores (the numbers)

From *Stop Comparing LLM Agents Without Disclosing the Harness* (arXiv 2605.23950) `[P]`, which is the best single citation for this:

| Comparison | Effect |
|---|---|
| Claude Opus 4.5 on SWE-bench Pro: SEAL standardized scaffold vs Claude Code | **45.9% → 55.4%** (9.5 pp, model fixed) |
| Terminal-Bench 2 pass@1, model fixed, harness changed | **69.7% → 77.0%** (7.3 pp) |
| Holistic Agent Leaderboard, SWE-bench Verified Mini, same model across scaffolds | double-digit gaps; single-model swings **up to ~48 pp** |
| Third-party monitoring, SWE-bench Verified, scaffold-only variation | **11 pp** (GPT-5), **15 pp** (Kimi K2 Thinking) |
| Adding *one* search subagent (WarpGrep) to otherwise identical infra | **flips the SWE-bench Pro ranking** between two frontier models |
| For scale: what papers report as a meaningful model advance | **2–4 pp** |

The paper's framing is the important part: *"Every step in this pipeline (context construction, tool invocation, parsing, retry, summarization, and stopping) is a harness decision."* And: harness substitutions *"routinely dwarf"* reported model advances.

Corroborating secondary reports `[S]`: SWE-bench Pro showing a 22-point swing from scaffold changes alone; three agent systems running identical Claude Opus 4.5 producing 50.2%–55.4%.

**Implication for the reader:** this cuts both ways. A well-built custom harness can beat a generic one with the same model — but a mediocre custom harness loses ~10–15 pp against Claude Code with the *same* model. Harness work is high-variance, not free upside.

---

## 5. Heterogeneous harnesses: frontier orchestrator + small local workers

### 5.1 Does the pattern work?

Yes, with caveats, and there is real evidence for the *shape*.

**Anthropic's multi-agent research system** `[S — widely reported from Anthropic's June 2025 engineering post]` is the canonical precedent: an Opus lead delegating to Sonnet subagents. Reported: **+90.2%** over single-agent Opus on research tasks; **~15× the tokens** of a chat interaction; **token usage explained ~80% of performance variance**. That last number is the most important and the most sobering: much of the multi-agent win is *buying more compute*, not clever architecture. A frontier-orchestrator + 8B-worker design deliberately inverts that trade — it spends *fewer* frontier tokens — so do not expect the +90% to transfer.

**Cost-side precedents** `[S], single-source each — treat as leads:`
- A Fable 5 orchestrator directing Sonnet 5 workers retained **96%** of an all-Fable team's BrowseComp score at **46% less cost**.
- A small on-device model paired with a frontier cloud model on long-document tasks, with the problem decomposed into focused subtasks run in parallel locally, recovered **~98%** of frontier quality at a fraction of cost.
- Databricks internal benchmark: on Opus 4.8 at xhigh thinking, **Pi** had the highest pass rate of any harness tested at significantly lower cost than Claude Code and Codex, because it sent **~3× less context per turn**.

**Serving-layer version of the pattern.** vLLM's *Micro-Agent* work (2026-06-29) `[P]` pushes the orchestration *below* the API: one model name (`vllm-sr/auto`), and the router internally decides whether to run a single backend, escalate to a stronger model, fan out to candidates, judge disagreement, or run a bounded workflow — *"the router controls the budget, policy, topology, trace, and failure mode."* Related: **vLLM Semantic Router**, which routes by cost, latency, privacy, safety, and modality across local, private, and frontier models `[S]`. Worth knowing this exists: some of what the reader plans to build in the harness can instead live in the serving layer, where it is reusable.

**Three-tier pattern in the wild** `[S]`: Tier 1 = quantised 1B–14B models (Qwen3-8B, Llama 3.3-8B, Gemma 3-4B, Phi-4-mini) via Ollama/llama.cpp/vLLM for classification, extraction, formatting, routing, template completion; higher tiers escalate. **Note what Tier-1 tasks are: transformations, not decisions.** That is the correct job description for an 8B subagent.

### 5.2 The capability cliff — the thing that will bite

`[S — consistent across several 2026 sources, no single authoritative benchmark found]`: there is a **tool-calling capability cliff around ~7B parameters**. Below it: near-zero tool invocation rates, confabulated answers in place of tool use, catastrophic failure on multi-step tool chains. Above it, and especially in tool-specialist fine-tunes (e.g. ToolACE-8B), reliable tool calling becomes achievable. The proposed mechanism: deciding *whether* a tool is needed requires holding the task frame and the tool-evaluation frame simultaneously, and small models run out of working memory.

At ~8B the reader is sitting **just above the cliff edge**, which means:

1. **Do not ask 8B workers to decide whether to use a tool.** Give each worker one job and one mandatory output shape. The orchestrator decides; the worker transforms.
2. **Prefer the mini-swe-agent contract** (emit text in a known shape, harness extracts) over native tool-calling APIs, which small models handle unevenly.
3. **Budget a format-error counter per worker** (`max_consecutive_format_errors`) and escalate to the frontier model on strike-out.
4. Multi-step chains inside a worker are where 8B fails. Keep worker trajectories to 1–3 steps.

### 5.3 The subagent spawn/digest protocol

The contract to implement, distilled from Anthropic's guidance `[P]` and the Claude Agent SDK's `agents` parameter `[P]/[S]`:

```
spawn(worker):
    fresh context window          (no inheritance of orchestrator history)
    own system prompt             (narrow: one job)
    own tool subset               (least privilege)
    own model                     (← this is the heterogeneity hook)
    own budgets                   (steps, tokens, wall-clock)
    input: a self-contained task string + any pinned facts
return:
    a digest, 1,000–2,000 tokens  (not the trajectory)
    + structured status: ok | partial | failed | needs-escalation
    + token/cost accounting rolled up to the parent
```

The Claude Agent SDK supports exactly this today — per-agent description, system prompt, restricted tool access, and *optionally a different model* — with `ResultMessage.total_cost_usd` carrying a per-model breakdown when subagents run `[S]`. **This is the single strongest argument for the SDK middle path**: the heterogeneous-model design the reader wants is a config field there, not a project.

Notably, **Pi deliberately ships no sub-agents** `[P]` — so a Pi fork means building §11 yourself (it is not hard, but it is not free either).

### 5.4 Dialect and prompt-format handling

Two layers, and you want both:

- **Provider normalisation:** LiteLLM normalises every provider to the OpenAI Chat Completions shape, *including mapping each provider's error types onto OpenAI exception classes* `[S]` — that error mapping is the part that matters for retry policy and the part people forget. OpenHands SDK uses LiteLLM for exactly this `[P]`. OpenRouter does the same at the gateway rather than library level `[S]`.
- **Local-serving tool dialects:** vLLM and SGLang each need a **tool-call parser** matched to the model family (Hermes, Mistral, Llama, Qwen, DeepSeek variants), and the parsers are a known source of breakage — e.g. empty `tool_calls` when `reasoning_content` is present, and an xgrammar segfault with `--tool-call-parser` on DeepSeek-V3 `[S — GitHub issues]`. vLLM's own RFC #39848 admits *"vLLM does not currently have a robust and unified approach to tool calling"* and proposes region-scoped guided decoding with tool-aware grammars `[P]`. Critically: **when structural-tag support is unavailable, vLLM extracts tool calls from raw text, so arguments may be malformed or violate the parameter schema** `[P]`.

That last sentence is the whole reason §5.5 exists.

### 5.5 Constrained decoding — the enabling technology, and its tax

**The engines** (all verified live 2026-08-20/21):

| Engine | Stars | Licence | Approach | Cost profile |
|---|---:|---|---|---|
| **llguidance** (guidance-ai) | 844 | MIT | Rust Earley parser + lazy lexer automata; masks computed **on the fly** | **~50 µs CPU/token** (128k tokenizer), **negligible startup** `[P]` |
| **XGrammar** (mlc-ai) | 1,828 | Apache-2.0 | Stack-based character parser + precomputed masks | Fast steady-state; **precomputation "often runs into seconds"** `[P — llguidance's comparison]`. Default structured-output backend for vLLM/SGLang/TensorRT-LLM `[S]` |
| **Outlines** (dottxt-ai) | 15,657 | Apache-2.0 | FSM built from constraints, masks precomputed for all states | Fast sampling but **inherently limits constraint complexity, significant startup cost and memory overhead** `[P]`; reported 40 s–10 min compile times on complex schemas and lowest compliance rate in JSONSchemaBench due to timeouts `[S]` |
| llama.cpp grammars | — | MIT | Character-level backtracking parser, no lexer | Slower; elegant but inefficient `[P]` |
| LM-format-enforcer | — | MIT | Pure Python dynamic masks | Slower `[P]` |

**JSONSchemaBench** (arXiv 2501.10868) `[P]` — 10K real-world JSON schemas, six frameworks (Guidance, Outlines, llama.cpp, XGrammar, OpenAI, Gemini), measuring declared coverage, empirical coverage, compliance, and efficiency. Headline: **Guidance had the highest empirical coverage on six of eight datasets**, llama.cpp led on the other two (domain-specific Washington Post; the hard JSON Schema Store). **Closed-source grammar engines had the lowest coverage**, last on all but one dataset. LM-only (schema in prompt, no constraint) is acceptable on easy/medium schemas and **drops sharply on hard and domain-specific ones** — which is precisely the regime a custom Datalog query language lives in.

**Now the bad news — the constraint tax.** Two 2026 papers, both directly aimed at the reader's plan:

1. ***The Constraint Tax: Measuring Validity-Correctness Tradeoffs in Structured Outputs for Small Language Models*** (arXiv 2605.26128) `[P]`. Findings: *"In the main GPU aggregate, hard schemas improve syntax while reducing answer accuracy. In the calendar tool-call analogue, hard schema decoding keeps validity at 100.0% but loses **43.5 points of executable accuracy**."* Also: results are **serving-stack-dependent** — Qwen replicates across vLLM and SGLang, SmolLM2 does not; one config only worked after an SGLang RMSNorm compatibility patch. Conclusion: *"the constrained decoder is part of the model interface"* — pin checkpoint, tokenizer, decoding engine, schema, hardware, and serving patches. Not all constraints are a tax: **rationale-bearing schemas and *delayed* constraints improved executable accuracy**, and the paper's advice is to test whether the model should **solve before the answer is constrained into an executable object**.

2. ***Constraint Tax in Open-Weight LLMs: Tool Calling Suppression Under Structured Output Constraints*** (arXiv 2606.25605) `[P]`. This one is a landmine. Three conditions: T1 (tools on, schema off) → **100% tool invocation rate across all models**. T2 (tools on, schema on) → **tool execution disappears completely; zero valid tool calls in any session**, despite unchanged tool definitions and task. T3 (tools off, schema on) → schema compliance fine. Reproduced across multiple open-weight families, parameter scales, deployment environments, and inference stacks. Their hypothesis is **Constraint Priority Inversion** — schema satisfaction dominates action selection. Their mitigation, **Transparent Two-Pass Execution** (decouple tool execution from schema-constrained response generation), restored: TIR 0% → 100%, JSON compliance stayed 100%, end-to-end success 0% → 100%, 5–8 tool calls/session `[P]`.

**The design rule that falls out of both papers, and it is the single most actionable finding in this report:**

> **Never apply an output grammar to a turn in which the small model must also decide to call a tool.** Split it: pass 1 = free-form reasoning/acting (no constraint, or a permissive one); pass 2 = constrain the final artefact (the Datalog query, the JSON digest). Constrain *late*, and let the model reason in text before the answer is squeezed into a shape.

This maps cleanly onto the reader's architecture: the 8B worker reasons freely about what the orchestrator asked, then emits its Datalog query or digest under a grammar in a second, cheap pass.

---

## 6. Exposing a custom Datalog knowledge store to models

### 6.1 The three integration surfaces

| Surface | Mechanism | Cost | When it wins |
|---|---|---|---|
| **Tool call** | `query_graph(datalog: string)` in the tool catalogue; model composes queries | Tokens per call; requires query-language fluency; a decision the model can get wrong | Open-ended exploration; agent-driven retrieval |
| **Auto-injected context** | Harness runs fixed queries pre-turn, serialises results into the prompt | Fixed token cost every turn; **prompt-cache friendly if stable**, cache-hostile if it changes each turn | Always-needed facts (Aider's repo map is exactly this) |
| **MCP server** | Store speaks MCP; any harness can mount it | Extra process + protocol; **MCP tool schemas can be deferred** (Claude SDK defers by default via tool search) | Harness-neutrality — the store outlives the harness choice |

Anthropic's own framing favours **just-in-time retrieval over pre-loading** for long-horizon work `[P]`, plus **structured note-taking** to a store outside the window. Aider is the counter-example proving auto-injection works when the injected artefact is small, ranked, and budgeted (1k tokens by default) `[P]`.

**Recommendation for this project:** build the Datalog store as an **MCP server** and additionally expose a thin auto-inject path for a small ranked "graph summary." MCP makes the store harness-neutral — which directly de-risks the entire harness decision, because the memory layer then survives switching from a custom harness to the Agent SDK to a Pi fork. MCP's data layer is JSON-RPC 2.0 with three server primitives — **Tools** (executable actions incl. database queries), **Resources** (contextual data such as file contents or database records), **Prompts** (reusable templates, e.g. few-shot examples) — each with `*/list` discovery and dynamic listings `[P]`. Note for planning: **MCP sampling is deprecated as of protocol version 2026-07-28** `[P]` — do not design a callback-to-the-model flow around it.

The MCP docs give the exact recipe for a query-language store `[P]`: *"consider an MCP server that provides context about a database. It can expose tools for querying the database, a resource that contains the schema of the database, and a prompt that includes few-shot examples for interacting with the tools."* That is schema-as-Resource + few-shot-as-Prompt + query-as-Tool, which is precisely the three-part answer to "how do you make a model fluent in your query language."

### 6.2 Precedent: agents generating logic/graph queries

**Graph databases (mature).** Neo4j's `mcp-neo4j-cypher` extracts the graph schema so agents can generate Cypher; `mcp-neo4j-memory` stores entities/observations/relationships and retrieves relevant subgraphs `[S]`. The general MCP-knowledge-graph pattern is middleware translating JSON-RPC calls into native graph queries (Cypher, Kuzu Cypher, GQL, SPARQL) `[S]`. Memgraph documents an end-to-end LangGraph+MCP agent over graphs `[S]`.

**Datalog specifically (thin but real).**

- **LogicLoc** (arXiv 2604.16021, *Neurosymbolic Repo-level Code Localization*) `[P]` is the closest published analogue to the reader's design. Static analysis extracts program facts into a structured IR; on a natural-language query the **LLM agent synthesises a Datalog query**; **Soufflé** executes it against the pre-extracted facts. It adds a **neuro-symbolic feedback loop and mutation-based repair**, so the LLM iteratively refines queries from execution outcomes. Reported benefits: better structural reasoning **and reduced token consumption** vs traversal-by-tool-call. They introduce **KA-LogicQuery**, 25 purely-logical keyword-agnostic queries, to expose the "keyword shortcut" bias in retrieval-style localization. Their rationale for Soufflé over CodeQL is worth noting: *"it offers a clean relational syntax well-suited for LLM generation"* and CodeQL's engine ships binary-only under a separate licence.
- A CEUR workshop paper evaluates **open-source LLMs for Datalog / Answer Set Programming semantic parsing** — pilot datasets of domain queries with Datalog ground truths, zero-shot and one-shot prompting `[P — retrieved, not deeply read]`.

**Query-language fluency, the three techniques, in the order to try them:**

1. **Schema in prompt** (as an MCP Resource) — cheapest, works for frontier models, degrades on hard/unfamiliar schemas per JSONSchemaBench's LM-only results.
2. **Few-shot examples** (as an MCP Prompt) — the standard fix; LogicLoc-style repair loops build on this.
3. **Grammar-constrained generation of the query itself** — llguidance takes **context-free grammars in a Lark variant**, with embedded JSON schemas and regexes `[P]`. **Datalog is a CFG.** This is the exact tool for making an 8B model emit syntactically valid Datalog every time. Apply it in the *second* pass only (§5.5).
4. **Execute-and-repair** — LogicLoc's mutation-based repair; the deterministic engine's error message is a far better teacher than a schema.

**Warning, restated:** technique 3 without technique's §5.5 split will silently suppress tool use in open-weight models.

---

## 7. The honest cost of rolling your own

### 7.1 The long tail that Claude Code has already paid for

**Permissioning.** One analysis puts it bluntly `[S]`: *"Only 1–2% of agent code is actual AI logic. The other 98% — permission systems, hook composition, sandboxing, context management, subagent delegation — is what determines whether your agent is safe to run in production."* And the hard part is that **shell safety is contextual**: allowlists and approval prompts only go so far, because a "safe" command name says nothing about its arguments.

**Sandboxing.** *Don't build a coding agent sandbox yourself* `[S]` enumerates what a real one needs: persistent volumes across start/stop, backup and recovery, timeouts and resource limits, source-control integration, image registries, identity providers, editor integrations, secrets and env management, RBAC, MCP support, LLM/API gateway integration, caching. Plus the structural hole: **the agent's own API calls legitimately need outbound network access**, so network isolation is never clean unless you proxy agent traffic through your own endpoint.

**The security surface is not theoretical.** 2026 evidence `[S — security vendor and press reporting]`:
- **CVE-2026-50548 / CVE-2026-50549** ("DuneSlide"), both **CVSS 9.8**: prompt-injected commands manipulated working-directory and symlink-validation logic in Cursor to overwrite the sandbox helper and write outside the workspace. Patched in Cursor 3.0 (2026-04-02); all prior versions affected.
- Microsoft found a path in **Semantic Kernel** turning prompt injection into host-level RCE — *"a single prompt was enough to launch calc.exe."*
- A **vm2** CVE wave turned agent frameworks using it as an isolation layer into host-RCE vectors.
- Pillar's study sorted agent sandbox failures into four modes: denylists that cannot keep pace with the OS; workspace config that is really code; "safe" command lists that trust a name over its arguments; privileged local daemons outside the box entirely.

Note that **every one of these is a harness bug, not a model bug**. A coding agent ingests untrusted content by design (cloned repos, dependency READMEs, PR diffs, issue titles). If you write the tool-execution layer, you own this class of vulnerability, and the vendors with security teams are still shipping 9.8s.

**Terminal UX.** Streaming render, interrupt handling, diff display, resumable sessions, session forking. Invisible until absent; individually small; collectively months.

**Provider failover and API churn.** LiteLLM exists because normalising ~100 providers — including error-class mapping — is a full-time job. Every model release changes something (thinking blocks, tool-call formats, cache semantics, reasoning content fields).

**Cache management.** §1.6. A silently mis-ordered tool list is a 10× cost regression with no error message.

### 7.2 Benchmark evidence that naive harnesses waste money

- **Failure is where the money goes.** On Long-Horizon Terminal-Bench, failed attempts use **3.3× more tokens** and **1.4× more time** than successful ones, and consume **63% of total evaluation cost while being only 43% of attempts** `[S]`. The named cause: *"agents without reliable planning and stopping criteria may keep exploring without making progress."* Stopping criteria are subsystem #7, and they are the cheapest thing in the harness to get right.
- **More tool calls ≠ better.** One system made far more tool calls than every other and the extra calls did not raise its pass rate `[S]`.
- **Cost spread is 400×.** Per-task costs on SWE-bench Verified from **$0.08 to $32.00**, driven by model pricing *and scaffold design* `[S]`.
- **Token efficiency is a harness property.** Some configurations exceed **1M tokens/task** against a benchmark average of ~563K `[S]`.
- **Multi-agent is expensive by construction.** ~15× tokens; token usage explains ~80% of the performance variance `[S]`.

### 7.3 Maintenance burden

The harness is coupled to a moving target on three axes simultaneously: model APIs (new params, new content-block types), serving stacks (vLLM/SGLang tool parsers, per-model grammar quirks — see the SmolLM2/RMSNorm case in §5.5), and protocol versions (MCP deprecated sampling at `2026-07-28`). None of that work produces a feature. It is the tax that framework users do not pay.

### 7.4 What you actually get in return

Be fair to the build case:

1. **Heterogeneous routing on your own terms** — the SDK gives per-subagent model choice, but not "route this decision by measured difficulty to a local 8B."
2. **A memory layer that is first-class rather than a tool call** — auto-injection with your own ranking, Aider-style.
3. **Inspectability** — the actual complaint. Every prompt, every truncation, every compaction decision visible and diffable.
4. **Score upside** — the same evidence that says a bad harness costs 10–15 pp says a good one gains it.
5. **No provider lock-in** — mini-swe-agent's no-tool-API contract runs on anything that writes shell.

---

## 8. Recommendation: three middle paths, ranked

| Path | Preserves "not a black box"? | Build cost | Heterogeneous models | Datalog memory | Verdict |
|---|---|---|---|---|---|
| **A. Claude Agent SDK + MCP Datalog server** | Loop documented and configurable; not editable. Anthropic-only models. | Days | Per-subagent model override — **but Claude-family only**, so no local 8B workers | MCP server, schemas deferred by default | Fastest to value. **Fails the core requirement**: local 8B workers are not reachable. |
| **B. Fork Pi (MIT, TS, 94.5k stars, active)** | **Fully.** ~300-word system prompt, 4 tools, custom compaction is a documented extension point, 30+ providers incl. local | Weeks | Provider-agnostic by design; **sub-agents deliberately absent — you build §11** | MCP absent by design (Pi skips it) — you add MCP client or call the store directly from an extension | **Best fit.** You inherit sessions, compaction, multi-provider auth, 4 run modes; you write only the two things you actually care about (subagent routing, memory injection). |
| **C. Fork OpenHands Agent SDK (MIT, Python, active)** | **Fully.** Event log, condenser, LiteLLM, sandboxed Workspace | Weeks | LiteLLM underneath → any provider incl. local vLLM/llama.cpp | Add a Tool; condenser hook for injection | Best if the team is Python-first or wants replayable event logs and a real sandbox out of the box. |
| **D. From scratch on mini-swe-agent's skeleton** | Totally | Months to production | Total control | Total control | **Read it, don't ship it.** Correct as a learning exercise and as the shape of your loop; wrong as a production plan once you count §7.1. |

**Concrete recommendation:** read `minisweagent/agents/default.py` end to end (30 minutes, and it is the whole idea), then **fork Pi or the OpenHands SDK** rather than starting empty, and put the Datalog store behind **MCP** so the harness choice stays reversible. Adopt three rules from the evidence above regardless of path:

1. **Late constraints.** Small models reason free-form first; grammar-constrain the artefact in a second pass. Never grammar + tool-choice in the same turn (arXiv 2606.25605: tool invocation goes to **zero**).
2. **Stable-to-volatile prompt ordering with sorted tool schemas**, and budget the cache like a resource. It is a 10× cost lever with no error message when you get it wrong.
3. **Hard budgets and a format-error counter per agent**, including workers. Failed runs are where 63% of the money goes.

---

## Sources

**Primary — repos and official docs**
- mini-SWE-agent — https://github.com/SWE-agent/mini-swe-agent · agent source: https://raw.githubusercontent.com/SWE-agent/mini-swe-agent/main/src/minisweagent/agents/default.py
- SWE-agent ACI — https://swe-agent.com/latest/background/aci/
- OpenHands SDK events — https://docs.openhands.dev/sdk/arch/events · repo: https://github.com/OpenHands/software-agent-sdk
- Claude Agent SDK overview — https://platform.claude.com/docs/en/agent-sdk/overview · agent loop: https://platform.claude.com/docs/en/agent-sdk/agent-loop
- Anthropic, *Building effective agents* — https://www.anthropic.com/engineering/building-effective-agents
- Anthropic, *Effective context engineering for AI agents* — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Anthropic prompt caching — https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Aider repo map — https://aider.chat/docs/repomap.html
- MCP architecture — https://modelcontextprotocol.io/docs/learn/architecture
- Pi — https://pi.dev/ · https://github.com/earendil-works/pi
- OpenCode — https://github.com/sst/opencode (→ anomalyco/opencode) · Codex CLI — https://github.com/openai/codex · Goose — https://github.com/aaif-goose/goose
- smolagents — https://huggingface.co/docs/smolagents/en/index · https://huggingface.co/blog/smolagents
- llguidance — https://github.com/guidance-ai/llguidance
- vLLM tool calling — https://docs.vllm.ai/en/stable/features/tool_calling/ · RFC #39848: https://github.com/vllm-project/vllm/issues/39848
- SGLang tool parser — https://docs.sglang.ai/advanced_features/tool_parser.html
- vLLM Micro-Agent — https://vllm.ai/blog/2026-06-29-micro-agent-frontier-models

**Primary — papers**
- *Stop Comparing LLM Agents Without Disclosing the Harness* — https://arxiv.org/html/2605.23950v1
- *The OpenHands Software Agent SDK* — https://arxiv.org/html/2511.03690v1
- *JSONSchemaBench* — https://arxiv.org/html/2501.10868v3
- *The Constraint Tax: Validity-Correctness Tradeoffs in Structured Outputs for SLMs* — https://arxiv.org/html/2605.26128v1
- *Constraint Tax in Open-Weight LLMs: Tool Calling Suppression* — https://arxiv.org/html/2606.25605v1
- *Neurosymbolic Repo-level Code Localization* (LogicLoc) — https://arxiv.org/html/2604.16021
- *A Preliminary Evaluation of Open-Source LLMs for Datalog* — https://ceur-ws.org/Vol-4117/paper_aspocp_4.pdf
- *Long-Horizon Terminal-Bench* — https://zli12321.github.io/LHTB/

**Secondary — analysis, vendor, press (lower confidence)**
- https://futureagi.com/blog/coding-agent-harness-benchmark/ · https://www.digitalapplied.com/blog/swe-bench-verified-june-2026-benchmark-vs-scaffolding-analysis
- https://danoprean.com/posts/claude-code-vs-goose-vs-opencode-vs-pi-2026/ · https://explainx.ai/blog/top-10-open-closed-source-agent-harnesses-2026 · https://composio.dev/content/best-ai-agent-harnesses
- https://codeongrass.com/blog/agent-permission-layer-architecture/ · https://ona.com/stories/dont-build-a-coding-agent-sandbox
- https://thehackernews.com/2026/07/critical-cursor-flaws-could-let-prompt.html · https://www.microsoft.com/en-us/security/blog/2026/05/07/prompts-become-shells-rce-vulnerabilities-ai-agent-frameworks/ · https://labs.cloudsecurityalliance.org/research/csa-research-note-ai-coding-agent-sandbox-escapes-20260722-c/
- https://arize.com/blog/how-cheap-models-changed-multi-agent-economics/ · https://vllm-semantic-router.com/ · https://tanhdev.com/series/slm-playbook/part-1-slm-hybrid-architecture/
- https://www.kdnuggets.com/5-small-language-models-for-agentic-tool-calling · https://localaimaster.com/blog/small-language-models-guide-2026
- https://neo4j.com/developer/genai-ecosystem/model-context-protocol-mcp/ · https://memgraph.com/blog/end-to-end-llm-agents-with-memgraph-langgraph-mcp
- https://fast.io/resources/claude-code-open-source-status-guide/ · https://www.openhands.dev/blog/is-claude-code-open-source
- https://www.zenml.io/llmops-database/building-a-multi-agent-research-system-for-complex-information-tasks
- https://langfuse.com/blog/2025-03-19-ai-agent-comparison · https://buildingagenticai.com/blog/when-to-use-an-agent-framework/

**Repo metadata** verified 2026-08-20/21 via GitHub API (`gh api repos/<owner>/<name>`): stars, SPDX licence, language, last push, archived flag — table in §3.
