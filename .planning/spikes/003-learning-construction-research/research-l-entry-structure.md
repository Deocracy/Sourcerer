# How a Stored Learning Should Be Structured

**Research spike 003 — sub-question L: the anatomy of a memory entry**
Date: 2026-08-21. Sources are 2024–2026 primary literature plus the older
knowledge-representation classics that already answered parts of this question.

**Frame (given, not researched):** current entry shape is markdown — title, body
paragraph, a bold Rationale/Context/When-to-use line, Source pointers; four types
(Decision, Lesson, Pattern, Surprise). Entries will live in a Datalog-family
store where structure becomes facts/rules. Small models write; a frontier model
consumes.

---

## 0. Executive summary

Six findings drive the recommendation:

1. **Field convergence is real and narrow.** Across ten published systems and
   three classical literatures, five slots recur: *identity*, *claim/content*,
   *applicability*, *justification*, *provenance*. Everything else is
   system-specific.
2. **The trigger-condition field is the single highest-leverage field**, and it
   is the one the reader's current shape under-commits to (it is bundled into a
   prose line). Field-Aware Skill Retrieval shows keeping fields *separate*
   beats concatenating them, and Anthropic's own Skills convention makes
   "when to use" the literal retrieval key.
3. **Format effects on the consuming model are small for a frontier reader and
   large for a weak one.** "Capacity, Not Format" (2026) shows Sonnet absorbs
   JSON at no cost while Haiku drops 36.2pp. The reader is a frontier model:
   format is nearly free on the read side.
4. **Format effects on the *writing* model are the binding constraint.** An 8B
   writer is precisely the "near its limit" regime where schema complexity
   costs accuracy. Markdown-with-headings is the cheapest reliable target.
5. **Over-extraction is the dominant measured anti-pattern.** Verbatim chunks
   beat typed lossy artifacts 42.8% vs 26.5% — a 16.3pp gap. Summary-only
   entries lose the answer-critical detail. This is brevity bias at schema level.
6. **Negation is measurably unreliable.** Open-weight models endorse banned
   actions 77% of the time under simple negation, ~100% under complex negation.
   Prohibition entries must be rewritten in guard-rail (positive) form.

**Verdict on dual representation: YES, with a hard constraint** — the prose must
be the *source of truth* and the structured projection must be *derived*, never
co-authored. Details in §7.

---

## 1. Comparative field inventory

The table below is the core deliverable of Q1. Fields are normalized to common
names so the convergence is visible; the source's own terminology is in
parentheses where it differs.

| System | Identity | Claim / content | Applicability ("when") | Justification | Provenance | Lifecycle / scoring | Links | Notes |
|---|---|---|---|---|---|---|---|---|
| **MemGPT / Letta** memory block | `label` (string key) | `value` (free text) | — (implicit: block is always in context) | — | — | `limit` (char cap, default 2000), `read_only` | — | `description` field states *the block's purpose*, i.e. meta-applicability, not per-fact |
| **Mem0** | id | fact string (natural language) | — | — | source message ids | `ADD` / `UPDATE` / `DELETE` / `NOOP` op at write time | — | Flat NL facts; conflict handled by LLM-driven op selection |
| **Zep / Graphiti** | uuid | `fact` (edge), entity nodes | — | — | `episode` (source utterance/doc) | `valid_at`, `invalid_at`, `created_at`, `expired_at` — bi-temporal | entity edges | Strongest lifecycle model of any shipped system |
| **A-MEM** (NeurIPS 2025) | id | `content` | `keywords`, `tags` | `context` (contextual description) | timestamp | evolves — existing notes updated on new insert | `links` (Zettelkasten) | Closest published analog to a "note" anatomy |
| **ACE** (2510.04618) | unique bullet `id` | bullet (1–2 sentences) | section membership + `tags` | — | provenance | `helpful` / `harmful` counters | — | Itemization + counters + delta merge; no LLM rewrite of whole context |
| **Agent Workflow Memory** | workflow name | step sequence | workflow `description` (task it serves) | — | source trajectory | — | — | Induced *routines*, not facts |
| **Voyager** | skill name | executable code | description (embedded as the retrieval key) | — | generating task | verification by env | — | Description-as-key is the retrieval design |
| **Anthropic Agent Skills** | `name` (frontmatter) | SKILL.md body | **`description` must state what AND when** | — | file path | progressive disclosure tiers | reference files | Only frontmatter loads at startup — "when" *is* the index |
| **Anthropic memory tool** | file path | file contents (markdown) | directory/file naming | — | path | client-side; model-managed | cross-file refs | Deliberately unschematized — filesystem is the schema |
| **HippoRAG** | triple id | (subj, rel, obj) | — | — | passage | PPR-based salience | KG edges | Triples for indexing, passages for reading |
| **NeuSymMS** (2605.17596) | `id` (UUID) | subject–relation–value | semantic `category` | — | `user`/`agent`/`flow` scope, timestamps | `confidence`, `access_count`, `memory_type`, `is_active` (soft delete) | graph | Explicit dual neural-extract + CLIPS symbolic lifecycle |
| **CBR case** (Kolodner; Aamodt & Plaza) | case id | **Solution** | **Problem** (+ indexing vocabulary) | *justification* (interpretive CBR) | — | **Outcome** (success/failure) | similarity net | 30 yrs on exactly this question — see §1.1 |
| **Production rule** (OPS5) | rule name | **action** (RHS) | **condition** (LHS) — formal predicate | — | — | `salience`, refraction, recency | — | The formal-trigger extreme |
| **ADR / MADR** | title + number | **Decision** | **Context and Problem Statement** | **Decision Drivers**, pros/cons | deciders, date | `status` (incl. *superseded by ADR-NNNN*) | links to ADRs | Supersession is a first-class field |
| **Y-statement** | — | "we decided for `<option>`" | "In the context of `<use case>`, facing `<concern>`" | "to achieve `<quality>`, accepting `<downside>`" | — | — | — | One sentence carrying all five slots |

### 1.1 What the classics already settled

**Case-based reasoning** is the most directly relevant prior literature, and it
converged on a four-part case decades ago: Kolodner's **Problem / Solution /
Outcome**, with *justification* added in interpretive CBR. Aamodt & Plaza's
framing names the hard part explicitly — "the representation problem in CBR is
primarily the problem of deciding what to store in a case and finding an
appropriate structure for describing case contents." The recent *Review of
Case-Based Reasoning for LLM Agents* (2504.06943) restates it as a 4-tuple
`c_i = (P_i, S_i, O_i, M_i)` — problem, solution, outcome, metadata — with
separate semantic embedding and feature indices computed per case.

The mapping to a learning entry is direct and worth stating plainly:

- CBR **Problem** = the applicability / trigger field
- CBR **Solution** = the claim (what to do)
- CBR **Outcome** = the evidence that it worked (the reader's "Surprise" and the
  ACE helpful/harmful counters are both degenerate Outcome fields)
- CBR **Justification** = the reader's existing Rationale line

The reader's current shape is already a CBR case with the Problem field
demoted to a clause inside a prose line. That is the main structural finding.

**Production rules** (OPS5) sit at the formal extreme: condition (LHS) → action
(RHS), plus `salience` for conflict resolution and *refraction* so the same
instantiation never fires twice. Refraction is the interesting import — it is a
"don't re-surface an entry already applied in this episode" mechanism, and no
LLM memory system in the table implements it.

**Design rationale** (IBIS/QOC → ADR/MADR) contributes the supersession
discipline. MADR's optional frontmatter carries `status`
(`proposed | rejected | accepted | deprecated | superseded by ADR-0123`), `date`,
`decision-makers`, `consulted`, `informed`, plus body sections *Context and
Problem Statement*, *Decision Drivers*, *Considered Options*, *Decision Outcome*,
*Consequences*, *Confirmation*. The Y-statement compresses the whole thing into
one sentence that names context, concern, choice, quality, and downside — a
useful upper bound on how terse a complete decision entry can be.

### 1.2 Convergence verdict

Counting across the table, the fields that appear in **more than half** the
systems:

1. **Identity** (stable id) — universal, and load-bearing for supersession.
2. **Claim/content** — universal.
3. **Applicability** — present in A-MEM (keywords/tags/context), Anthropic
   Skills (description), Voyager (description), AWM (description), CBR
   (Problem), production rules (LHS), ADR (Context). **Absent** in Mem0, Letta
   blocks, HippoRAG, Zep facts.
4. **Provenance** — Zep (episode), Mem0 (source ids), ACE, A-MEM, NeuSymMS, ADR.
5. **Lifecycle/scoring** — Zep (bi-temporal), ACE (counters), NeuSymMS
   (confidence, access_count, is_active), ADR (status/superseded-by), Letta
   (limit), production rules (salience).

**Justification is the notable minority field** — carried by ADR/MADR, CBR
(interpretive), and the Y-statement, but by almost none of the LLM memory
systems. The reader already has it. That is a genuine differentiator and should
be kept, not dropped for conformity with the LLM-memory mainstream.

---

## 2. The trigger-condition question (Q2)

This was the deepest dig. Answer: **trigger-explicit entries are better, the
evidence is convergent but mostly indirect, and the expression form should be
natural-language condition text — not keywords, not a formal predicate.**

### 2.1 Who has an explicit "when"

| System | Form of trigger | Formality |
|---|---|---|
| Anthropic Agent Skills | `description` frontmatter, must state what + *when* | NL sentence |
| Voyager | skill description, embedded as retrieval key | NL, embedding-anchored |
| A-MEM | `keywords` + `tags` + `context` | keyword + NL |
| AWM | workflow description | NL |
| Analytic Concept-Centric Memory (2606.29774) | explicit `applicability conditions`, object–part–action tuples | semi-formal, hard-filterable |
| Skill Retrieval Augmentation (2604.24594) | "revise invocation conditions" as an optimization target | NL |
| CBR | Problem description + indexing vocabulary | feature-indexed |
| OPS5 | LHS condition elements | formal predicate |
| Mem0 / Letta / HippoRAG / Zep | none | — |

### 2.2 The evidence that it helps

**Direct, strongest: Field-Aware Agent Skill Retrieval (arXiv 2608.02880,
Nokia/UC Riverside).** This is the cleanest experiment on the question. Skills
are split into three fields (name, description, body), encoded per-field with
TF-IDF + Qwen3-Embedding-0.6B, and scored per-field rather than concatenated.
Two benchmarks: SkillRet (6,660 skills / 4,997 queries), SRA-Bench (26,262
skills / 5,400 queries).

Results:

- Training-free hybrid, fields kept separate vs concatenated:
  SkillRet Recall@10 **74.03 vs 72.82**, nDCG@10 66.72 vs 66.34.
  SRA-Bench Recall@10 **70.56 → 74.49**, nDCG@10 60.41 → 60.86.
- With a small MLP learning per-field weights:
  SkillRet Hit@1 **69.66**, Recall@10 **77.95**, nDCG@10 **70.23**, MRR 0.77.
  SRA-Bench Recall@10 **76.52 → 83.78**, nDCG@10 **64.42 → 68.80**.
- Critical control: *learning over concatenated scores does not help.* The gain
  comes specifically from the fields being separable, not from having a learned
  ranker.

Authors' conclusion: "keeping fields separate improves hybrid retrieval… The
gains are small, but become much larger once we learn how to properly weight the
different fields of a skill."

This is the load-bearing citation for the recommendation. It says: **a
separately-indexable applicability field is worth real retrieval points, and the
value compounds once you can weight it.** In a Datalog store, per-field
weighting is trivially available — the field is a distinct predicate.

**Architectural: Anthropic Agent Skills.** Progressive disclosure loads *only*
`name` + `description` at startup (a few dozen tokens per skill); the body stays
on disk until triggered. The description is what Claude matches against to
decide whether to fire the skill. This is a production system in which the
trigger field is *literally the entire retrieval index* — the strongest possible
statement that "when to use" belongs in its own field, and the authoring
best-practices doc explicitly instructs that the description state both what the
skill does and when to use it.

**Supporting: precondition-aware retrieval.** The agent-skills literature
(2602.20867, 2604.24594, 2606.29774) converges on the observation that "a skill
may be relevant to the task description but still be unusable under the current
observation, environment state, or prerequisite constraints" — topic similarity
is not applicability. Applicability conditions inspired by STRIPS/PDDL make
preconditions explicit and support *hard filters* (category/part/affordance
consistency) before ranking. Offline skill optimization treats "missing
preconditions" and "ambiguous descriptions" as defects to repair.

### 2.3 How the trigger should be expressed

Ranked by the evidence:

1. **Natural-language condition sentence** — best. It is what Anthropic Skills,
   Voyager, AWM, and SRA all use; it embeds well, it is what an 8B writer can
   produce reliably, and it is human-auditable. Should be phrased as a
   *situation*, not a topic: "when adding a native Node module to the Theia
   workspace" beats "node-gyp".
2. **Plus a small controlled-vocabulary scope tag** — for hard pre-filtering in
   the Datalog store (which subsystem/layer). See §6.2 on why this must be
   *controlled*, not free-text.
3. **Not a formal predicate.** OPS5-style LHS conditions are the ideal for a
   rule engine but an 8B writer cannot author them reliably, and the world state
   a learning applies to is not fully reified in the store. Formal triggers are
   the thing to *derive later* if ever, not to demand at write time.
4. **Embedding anchor comes for free** from (1) — no separate field needed.

**Honest caveat:** no study in this survey directly A/B-tests "same entries, with
and without a when-field, measured on downstream task success." Field-Aware
Skill Retrieval measures *retrieval* quality, not application quality. That gap
is listed in §9 as an experiment-only question.

---

## 3. Format effects on the CONSUMING model (Q3)

### 3.1 Structured vs prose in context

The literature moved in three stages and the 2026 position is materially
different from the 2024 headline.

**Stage 1 — Tam et al. 2024, "Let Me Speak Freely?" (arXiv 2408.02442).** Format
restrictions (JSON/XML/YAML) caused significant reasoning degradation; stricter
constraints, larger declines. Widely cited as "JSON hurts reasoning," commonly
quoted as 10–30%.

**Stage 2 — replication and mechanism.** Long et al. 2025 found substantial
output-format *bias* (performance varies by format). Ray 2026 quantified the
validity–correctness tradeoff: hard schema enforcement gets 100% format validity
but costs up to **8.7pp** answer accuracy. Zhou 2026 named "structure
snowballing" — models prioritizing format compliance over reasoning. CRANE
(Banerjee et al. 2025) showed augmenting restrictive grammars with
reasoning-permitting rules preserves reasoning.

**Stage 3 — "Capacity, Not Format" (arXiv 2606.09410), the current best answer.**
Using information-matched prose controls and a four-level schema-complexity
gradient across 4 models and 5 benchmarks, with 0% parse failures:

- **Sonnet: 88.7 ± 4.0% JSON vs 89.3 ± 1.7% CoT on MATH-Hard — no degradation.**
- Haiku drops **36.2pp** (p<0.0001), largely truncation.
- GPT-4o-mini drops **28.0pp** (p<0.001) *even with extended budgets eliminating
  truncation* — pure capacity competition.
- Frontier models are not fully immune: Opus 4.7 on AIME drops 96.2% → 91.0%
  under JSON (−5.3pp).
- The penalty **scales with schema complexity** (McNemar p<0.0001) and is not
  explained by prompt length.

Concurrent work (Lee, D'Antoni & Berg-Kirkpatrick 2026) benchmarks the "format
tax" and finds it hits open-weight models hardest, that decoupling reasoning from
formatting recovers most of the loss, and that most closed-weight models show
little to no format tax.

**Prompt-format sensitivity generally** — "Does Prompt Formatting Have Any Impact
on LLM Performance?" (arXiv 2411.10541) measures robustness to template
variation via coefficient of mean deviation: GPT-4-1106-preview stays below
0.036 across all benchmarks; GPT-3.5 series ranges 0.035–0.176. Format
sensitivity is a *weak-model* property that largely disappears at the frontier.

**Implication for the reader's design.** The consumer is a frontier model reading
retrieved entries — this is the *input* side, not constrained *generation*, and
the reader has capacity headroom. **Format cost on the read side is
approximately zero.** Typed sections are safe. This removes what would otherwise
be the main argument against structure.

One practical note against JSON specifically for the read path: markdown is the
most token-efficient of the common formats (34–38% fewer tokens than JSON for
the same content), and format *preference* is model-specific (GPT-3.5 prefers
JSON, GPT-4 prefers markdown). Markdown-with-headings is the safer default for
injected context.

### 3.2 Typed sections vs flowing prose

No study isolates "`Rationale:` label vs unlabeled paragraph" for a reader model.
The nearest evidence is indirect but consistent and points the same way:

- Field-Aware retrieval (§2.2) shows separable fields help *retrieval*.
- Progressive disclosure (Anthropic Skills) depends on typed frontmatter.
- "Capacity, Not Format" shows a frontier reader pays no format penalty.

So typed sections are **low-risk, positive-expected-value** — but the size of the
comprehension benefit is unmeasured. Keep the number of types small; the format
penalty *scales with schema complexity*, so a 5-field entry is safe territory and
a 15-field entry is not.

### 3.3 Optimal entry length

There is no published "ideal token size for an injected memory item." What exists
constrains the answer from both sides:

- **Upper bound — context dilution / lost-in-the-middle.** Models attend well to
  start and end, poorly to the middle; reported accuracy drops of 30%+ for
  mid-context placement, and degradation begins well before the window limit. A
  larger window delays dilution, it does not prevent it. More retrieved entries
  ⇒ each entry's effective attention share falls. This argues for *few, dense
  entries* over *many, thin ones*.
- **Lower bound — the over-extraction result (§6.3).** Cutting entries to
  artifact scale (≤160 chars) destroyed accuracy even when the text was kept
  fully verbatim: 42.8% (coarse ~512-char verbatim windows) → 39.1%
  (sentence-verbatim, budget-matched) → 32.2% (sentence-verbatim, k=15).
  Small units lose.
- **Shipped conventions as a sanity check.** Letta caps memory blocks at **2,000
  characters** by default. ACE bullets are "typically a sentence or two" — but
  ACE bullets are *not standalone*; they live in a sectioned playbook that
  supplies the context, so the effective unit is larger than the bullet.

**Synthesis:** the evidence points to roughly **150–400 tokens per entry**
(≈600–1,600 characters), i.e. Letta's 2,000-char cap as a hard ceiling and
"substantially more than one sentence" as the floor. This is a reasoned
interpolation between two measured bounds, not a measured optimum. Flagged in §9.

### 3.4 Negative / prohibition entries

This is the sharpest result in the report and it directly contradicts the natural
way to write a "Lesson."

**Syntactic Framing Fragility (arXiv 2601.09724, Elkins & Chun)** — 16 models, 14
ethical scenarios. Open-source models **endorse specifically banned instructions
77% of the time under simple negation** ("Don't do this") and **100% under
complex negation** ("Don't do this if it leads to that"). Frame-level analysis
finds negation-bearing syntax is a *dominant* contributor to instability:
endorsement 0.80 for "should NOT X", 0.97 for "NOT goal if X". Their example is
blunt — asked "They should NOT rob the store," an OSS model effectively endorses
robbery.

**"Don't Think of the White Bear" (arXiv 2511.12381)** — ironic negation in
transformers under cognitive load: naming a prohibited act activates the concept,
and the negation fails to suppress it. Failure worsens under load — exactly the
regime of a long agent context full of retrieved entries.

**Corroborating**: MIT (2025) on vision-language models failing negation queries;
negation-blindness in universal text embeddings (arXiv 2504.00584), where negated
text pairs are interpreted as semantically *similar* — which means a "never do X"
entry and a "do X" entry may be near-identical in embedding space, so the
prohibition entry can be retrieved *for* the very query it should block.

**Consequences for the schema:**

1. **Prohibition entries are the least reliable entry class.** Two independent
   failure modes stack: they are retrieved badly (embedding negation blindness)
   and followed badly (negation endorsement).
2. **Rewrite prohibitions in guard-rail / positive form.** Not "never fork Theia
   core" but "extend Theia only through `@sourcerer/*` extensions composed into
   the sidecar app; adopt upstream by re-pinning." The constraint is preserved,
   the negation is gone, and the entry now states a *positive action* the reader
   can execute.
3. Where a prohibition is genuinely irreducible, pair it with the positive
   alternative in the same entry so the retrievable, followable content is the
   affirmative half. Complex negation ("don't X if Y") is the worst form
   measured — 97–100% failure — and must always be restructured.

This is a schema-level requirement, not a style preference: the writer prompt
should forbid bare negative claims.

---

## 4. Format effects on the WRITING model (Q4)

The writer is small (8B). Per "Capacity, Not Format," this is precisely the
regime where format cost is *not* absorbed.

**Schema complexity is the variable that matters.** VAREX (2603.15118) reports
that for models below 4B, extraction accuracy is dominated by structured-output
compliance failures rather than content errors, and non-compliance rises from
**2–3% on flat schemas to 68–69% when JSON Schema `$defs` (reusable type
definitions) are present**. Nesting and reference indirection are what break
small models — flat schemas are largely fine.

**Constrained decoding is not a free fix.** Reported inference-latency increase
of **3.6×–8.2×** versus unconstrained, and even then accuracy stays below
prompt-level optimization approaches. JSONSchemaBench (2501.10868) documents
grammar engines that are *over-constrained* (reject valid instances) or
*under-constrained*. Hard enforcement buys validity, not correctness — Ray 2026's
up-to-8.7pp accuracy cost.

**8B specifically is a workable but not carefree regime.** Llama-3-8B-instruct is
competitive with much larger models on structured output; schema-RL fine-tuning
brings LLaMA-3.1-8B near GPT-4o on schema adherence. Without runtime constraints,
small models often fail to emit valid selections despite being prompted to.

**Markdown vs JSON for the writer.** Markdown is the most token-efficient format
(34–38% fewer tokens than JSON). Format preference is model-specific. Crucially,
markdown headings have **no nesting requirement, no quoting/escaping rules, no
bracket balance** — the three things that break small-model JSON. A missing
markdown section is a *local* defect; a malformed JSON brace is a *total* parse
failure.

**Recommendation for the writer path: markdown template with fixed `## ` section
headings, not schema-constrained JSON.** Rationale:

- Flat structure (no nesting) — stays in the 2–3% compliance-failure regime, not
  the 68–69% one.
- Degrades gracefully — a missing section is detectable and repairable; malformed
  JSON is not.
- No constrained-decoding latency multiplier, no over/under-constraint risk.
- Token-efficient, which matters when the writer is small and budget-bound.
- Separates reasoning from formatting for free — the recurring recommendation
  across the format literature (Lee et al. 2026: decoupling recovers most of the
  loss).

### 4.1 Can a checker validate markdown as cheaply as JSON?

**Yes — for this schema.** With a flat, fixed set of `## ` headings, validation is
a regex/line-scan:

| Check | Markdown (flat headings) | JSON Schema |
|---|---|---|
| All required fields present | scan for required `## ` set — trivial | `required` keyword |
| No unknown fields | heading set difference — trivial | `additionalProperties: false` |
| Field non-empty | non-whitespace between headings — trivial | `minLength` |
| Field length bound | char count per section — trivial | `maxLength` |
| Type/enum on scope tag | regex against controlled vocab — trivial | `enum` |
| Well-formedness | *cannot fail catastrophically* | brace/quote balance can fail wholesale |
| Deep nesting / refs | N/A — not modelled | where small models actually break |

The reason markdown validates as cheaply here is *specifically* that the
recommended schema is flat. JSON's validation advantage appears with nested and
referential structures — which is exactly the structure this schema should not
have, for writer-reliability reasons. The two arguments align.

A useful extra: the checker can enforce the §3.4 rule mechanically — flag any
Claim/Guidance section whose text matches bare-negation patterns (`never `,
`don't `, `do not `, `avoid `) without an accompanying positive clause.

---

## 5. Structure for a logic store (Q5)

### 5.1 The shipped proposals

**NeuSymMS (arXiv 2605.17596)** is the closest published analog to the reader's
architecture and the most useful single reference here. Neural fact extraction
from unstructured dialogue feeds a **CLIPS-based expert system** that classifies,
deduplicates and reconciles facts under **explicit lifecycle rules**. Knowledge
is subject–relation–value triples in a relational DB. The reference schema
carries: `id` (UUID), `user` FK, `scope` (`user` | `agent` | `flow`), semantic
`category`, `memory_type` (short/long term), `confidence`, `access_count`,
timestamps for provenance and analytics, and `is_active` for **soft deletion**
(reversible deactivation preserving history).

Its stated design rationale is the argument for the reader's whole approach:
"neural models excel at interpreting language, while symbolic systems offer
deterministic reasoning, explicit policies, and auditability over structured
facts."

**AtomMem (2606.19847)** builds memory from atomic facts. **HippoRAG** extracts
triples for the index but keeps *passages* as the read unit — an early and
influential instance of the dual-representation split: symbolic structure for
retrieval, prose for consumption.

**Provenance representation.** The mature options from the RDF world, all
applicable to a Datalog store: **RDF reification** (verbose), **named
graphs/quads** (a fourth element carrying provenance — the standard answer),
**singleton property** (a unique property instance per contextualized
relationship), and **RDF-star**. A 2020 survey of provenance-aware knowledge
representation and a benchmark of reification vs singleton property vs RDF-star
cover the tradeoffs. For Datalog the practical translation is: **carry
provenance as an extra argument or a separate `derived_from/2` predicate keyed
on entry id**, not by reifying every fact.

### 5.2 Versioning / supersession — who actually carries it

| Field | Carried by | Actually used? |
|---|---|---|
| `valid_at` / `invalid_at` (bi-temporal) | Zep/Graphiti | **Yes** — the survey of consolidation calls Zep "the strongest decay system"; temporal validity intervals are its core mechanism |
| `superseded_by` | ADR/MADR (`status: superseded by ADR-0123`) | **Yes** — standard practice, links are navigable |
| `is_active` soft delete | NeuSymMS | Yes, by design (reversible + historical analysis) |
| `confidence` | NeuSymMS, many proposals | **Weakly** — no shipped system demonstrates confidence driving retrieval well; it is the most commonly declared, least evidenced field |
| `access_count` / helpful-harmful counters | NeuSymMS, ACE | Yes in ACE — counters drive curation |
| `scope` | NeuSymMS (user/agent/flow) | Yes |
| Explicit decay | almost nobody | **No** — cross-system survey shows "None native" for Mem0, Letta, LangChain |

The comparative consolidation survey (Hindsight/Vectorize) maps four levers —
importance, merge, decay, eviction — and finds **no system covers all four
well**. Zep is strongest on decay, Letta cleanest on tiers, Mem0 most polished on
write-time ops. Supersession being genuinely hard is consistent with spike-002's
finding that deterministic supersession is an unclaimed gap.

**Recommendation:** carry `superseded_by` (ADR-proven, cheap, deterministic) and
`created_at`. **Do not** carry a numeric `confidence` at v1 — it is the canonical
over-structured field: universally proposed, rarely used, and an 8B writer's
confidence estimates are not calibrated. Prefer ACE-style *observed* counters
(incremented by the system when an entry is surfaced and the episode succeeds or
fails) over *asserted* confidence (guessed by the writer). This is the
"fields nobody fills or reads" anti-pattern in §6.1, avoided.

---

## 6. Anti-patterns with evidence (Q6)

### 6.1 Over-structuring

Evidence is indirect but converges:

- Format penalty **scales with schema complexity** (McNemar p<0.0001) — every
  added field costs the small writer.
- VAREX: **2–3% → 68–69%** non-compliance when schema gains reference
  indirection. Complexity is not linear in cost.
- MADR ships most of its frontmatter *commented out* with "These are optional
  elements. Feel free to remove any of them." The most mature decision-record
  template in the field defaults to minimal and treats fields as opt-in — that
  is the accumulated field experience of the ADR community.
- `confidence` is the archetype: declared by many systems, load-bearing in none.

**Rule:** a field earns its place by being *read by the consumer* or *queried by
the engine*. Fields that are only written are pure cost.

### 6.2 Free-text tag drift

The folksonomy literature settled this before LLMs existed: free tagging suffers
**terminological drift** (searchers using modern terms fail to find older items),
tags are subjective, hyponym relations are unindicated, and inter-tag relations
are unknown — "the unorganized status of tags affects retrieval of objects
negatively." Controlled vocabularies are rigid and slow to absorb new terms but
systematically organized; the standing recommendation is **co-existence** —
controlled vocabulary for the formal axis, free tags for the informal one.

An 8B writer generating free tags is a folksonomy with a *worse* consistency
guarantee than human taggers. A-MEM's keyword/tag generation is exactly this
design and inherits exactly this risk.

**Rule:** scope/type tags come from a **closed, controlled enum** validated by
the checker. Free-text nuance goes in the NL applicability sentence, where
embedding similarity handles vocabulary variation gracefully and drift does not
fragment an index.

### 6.3 Summary-only entries — the strongest anti-pattern result

**"Fidelity Before Structure: Verbatim Chunks Beat Lossy Artifact Extraction"
(arXiv 2601.00821).** Controlled ablation of memory representations for long LLM
conversations — LoCoMo Cat 1–3, 699 questions, gpt-4o-mini answerer, identical
retrieval backbone across arms. Appendix G separates fidelity from granularity
with a sentence-verbatim control:

| Store (same backbone) | Tok/q | Accuracy |
|---|---|---|
| Verbatim chunks (coarse, ~512 char) | 2,127 | **42.8** |
| Sentence-verbatim, budget-matched | 4,674 | 39.1 |
| Sentence-verbatim, k=15 | 1,010 | 32.2 |
| **Typed artifacts (lossy, fine)** | 1,159 | **26.5** |

Typed lossy artifacts lose **16.3pp to verbatim chunks**. And the control shows
this is *not merely* a granularity effect — sentence-verbatim at artifact scale
still beats typed artifacts by 5.7pp at matched granularity, so **fidelity is the
dominant axis and granularity is secondary**. The paper's own framing: aggressive
extraction is not inherently bad; "what fails is discarding the answer-critical
details that specific questions require."

**This is brevity bias at the schema level and it is the single most important
design constraint in the report.** A schema that encourages a small writer to
compress a learning into a tidy one-line claim will systematically destroy the
detail that made the learning worth storing. The schema must have a field whose
explicit job is to *carry the specifics verbatim* — exact error text, exact flag,
exact path, exact version. This is why the reader's existing "Source pointers"
field matters and should be strengthened rather than trimmed.

### 6.4 Atomicity — what granularity does the evidence favor

Evidence pulls in **both** directions, and the resolution is the useful finding.

*For atomicity:* proposition-level chunking improves retrieval precision;
breaking content into atomic claims allows evidence retrieval focused on one part
and enables error localization; ACE's itemization prevents context collapse and
supports delta merges without whole-context rewrites; one-claim-per-entry makes
supersession decidable (you can retire *this* claim without disturbing others) —
which matters directly for a Datalog store.

*Against atomicity:* the verbatim-chunks result above; and atomic facts vs
narrative traces serve different question types — atomic facts are compact local
propositions, narrative traces organize events and causality and are better for
temporal/causal/trajectory questions.

**The resolution is "Molecular Facts" (arXiv 2406.20079).** Decontextualization
has two competing desiderata: **atomicity** (one claim) and **unambiguity** (the
claim must be interpretable standalone). Fully-atomic claims become *ambiguous*
when stripped of context; fully-decontextualized claims lose *minimality*. Their
information-overlap analysis shows the two baselines add different information —
`SAFE-DECONTEXT` modifies least but suffers ambiguity; `SIMPLE-DECONTEXT`
modifies most at the cost of minimality. A **molecular fact** carries the minimal
additional context needed to stay unambiguous.

**Verdict: one *claim* per entry, but the entry carries enough context to be
self-interpreting — a molecular fact, not an atomic one.** Concretely: a single
Claim field (atomicity, supersession-friendly) plus mandatory Context/Evidence
fields (unambiguity, anti-brevity-bias). Narrative bundles mixing several
learnings should be split; a claim stripped of its specifics should not.

---

## 7. Recommended entry anatomy

Markdown, flat `## ` headings, fixed field set. Seven fields, four required.

```markdown
---
id: L-0042                          # REQUIRED
type: decision|lesson|pattern|surprise   # REQUIRED (closed enum)
scope: build|theia|firefox|nix|process   # REQUIRED (closed, controlled enum)
created: 2026-08-21                 # REQUIRED
superseded_by: L-0117               # OPTIONAL
---

# Short imperative title                                    # REQUIRED

## When
<Natural-language condition. A situation, not a topic.>     # REQUIRED

## Claim
<One claim. Positive/guard-rail form — never a bare negation.>  # REQUIRED

## Why
<Rationale: the mechanism or the tradeoff accepted.>        # REQUIRED

## Evidence
<Verbatim specifics: exact error text, flag, path, version.># REQUIRED

## Source
<Commit / file / URL / phase artifact.>                     # OPTIONAL
```

### Field-by-field rationale

| Field | Req? | Rationale | Key evidence |
|---|---|---|---|
| `id` | **REQUIRED** | Stable identity; the referent for supersession, provenance, and counters. Every system in the inventory has one. | ACE bullet ids; ADR numbering; NeuSymMS UUID |
| `type` | **REQUIRED** | Reader already has four types; closed enum is checker-validatable and gives the engine a cheap hard filter. Keep at four — do not grow. | Controlled-vocabulary literature (§6.2) |
| `scope` | **REQUIRED** | The hard pre-filter before ranking. **Must be a closed enum** — this is the field that would otherwise become a drifting folksonomy. | Folksonomy drift (§6.2); precondition hard-filters in concept-centric memory |
| `created` | **REQUIRED** | Minimum viable temporality; enables recency and audit without the cost of full bi-temporal modelling. | Zep bi-temporal; NeuSymMS timestamps |
| `superseded_by` | OPTIONAL | The one lifecycle field with a proven track record. Deterministic, cheap, navigable. Absent = live. | MADR `status: superseded by ADR-0123` |
| **Title** | **REQUIRED** | Human scan-key and secondary retrieval field. Imperative form keeps it actionable. | Field-aware retrieval treats `name` as its own field |
| **`## When`** | **REQUIRED** | **The highest-leverage field and the main change from the reader's current shape.** Separately indexable ⇒ measurable retrieval gain; it is the retrieval key in Anthropic Skills, the CBR *Problem*, the OPS5 LHS. NL sentence, not keywords. | Field-Aware Skill Retrieval (Recall@10 70.56→74.49; with per-field MLP →83.78); Anthropic Skills progressive disclosure |
| **`## Claim`** | **REQUIRED** | The CBR *Solution*. One claim per entry — atomicity for supersession. **Positive/guard-rail phrasing enforced by the checker.** | Molecular Facts atomicity; negation failure 77%/100% (§3.4) |
| **`## Why`** | **REQUIRED** | The reader's existing Rationale — and a genuine differentiator: justification is carried by ADR/CBR but by almost no LLM memory system. Lets the consumer judge whether the claim still applies when the world has moved. | ADR *Decision Drivers*; Y-statement "to achieve… accepting…"; interpretive CBR justification |
| **`## Evidence`** | **REQUIRED** | **The anti-brevity-bias field.** Its explicit job is to carry answer-critical specifics verbatim. Without a field whose contract is "do not summarize here," the 16.3pp lossy-artifact penalty is what you get. | Verbatim chunks 42.8 vs typed artifacts 26.5 (§6.3); Molecular Facts unambiguity |
| **`## Source`** | OPTIONAL | Provenance pointer. Optional because a genuine learning sometimes has no single commit — mandatory-but-unfillable fields become noise. | Zep episodes; Mem0 source ids; §6.1 |

### Deliberately excluded, with reasons

- **`confidence` (numeric)** — universally proposed, evidenced nowhere; an 8B
  writer's self-assessed confidence is uncalibrated. Prefer *observed*
  helpful/harmful counters maintained by the system (ACE) if scoring is ever
  needed.
- **Free-text `tags`/`keywords`** — A-MEM has them; folksonomy drift makes them a
  fragmenting index under a small writer. The NL `When` sentence covers
  vocabulary variation better via embeddings.
- **`links` between entries** — A-MEM's Zettelkasten linking is appealing but
  writer-expensive and unvalidatable at write time. In a Datalog store, links are
  *derivable* from shared scope and entity mentions. Do not ask the writer for
  them.
- **Full bi-temporal `valid_at`/`invalid_at`** — Zep-grade, but heavy;
  `created` + `superseded_by` gets most of the value.
- **Formal predicate triggers** — the right long-term target, unreachable by an
  8B writer today.
- **Considered-options / pros-cons (MADR)** — belongs in a decision record, not a
  retrieved learning; would blow the length budget and duplicate `Why`.

Seven fields keeps the entry inside the low-schema-complexity regime where small
writers stay at 2–3% non-compliance, and inside the ~150–400 token band that
avoids both dilution and detail-loss.

---

## 8. The dual-representation verdict

**YES — prose is the source of truth, the structured projection is derived.**

**Why yes:**

1. It is what the successful systems do. HippoRAG indexes triples but reads
   passages. NeuSymMS extracts neurally and reasons symbolically, explicitly
   because "neural models excel at interpreting language, while symbolic systems
   offer deterministic reasoning, explicit policies, and auditability."
   Anthropic's Skills load structured frontmatter for routing and a markdown body
   for consumption.
2. The two consumers want different things. The Datalog engine needs facts with
   stable ids for supersession, scope filtering, and provenance joins. The
   frontier reader needs prose with specifics — and pays ~zero format penalty
   either way, so there is no reason to degrade the prose for the engine's
   benefit.
3. It resolves the atomicity conflict cleanly: the projection can be atomic
   (facts) while the entry stays molecular (self-interpreting prose). Both
   §6.4 desiderata are satisfied at their own layer.

**Does dual representation drift? Yes — and that is exactly what the constraint
prevents.** Drift is a *co-authoring* failure: it happens when a writer produces
prose and structure as two independent artifacts that can disagree. The fix is
architectural, not disciplinary:

- The markdown entry is **the only thing the 8B writer produces**, and the only
  thing stored as canonical.
- The Datalog facts are **mechanically projected** from the frontmatter and
  headings — `entry/1`, `entry_type/2`, `entry_scope/2`, `entry_when/2`,
  `entry_claim/2`, `superseded_by/2`, `entry_source/2`. This projection is a
  parser, not a model call, so it cannot hallucinate and cannot disagree.
- Re-projection is idempotent and cheap: on any edit, drop and rebuild that
  entry's facts. There is no independent state to fall out of sync.

The rule: **never let a model write both representations.** One authored
artifact, one derived view. That makes drift structurally impossible rather than
merely discouraged.

The corollary is a schema constraint worth naming: every field that the engine
needs as a fact must be **mechanically extractable** — closed enums in
frontmatter, fixed headings in the body. Any field requiring semantic
interpretation to project (e.g. inferring a formal precondition from the `When`
prose) is a drift vector and must stay prose-only until a deterministic parser
exists for it.

---

## 9. Open questions only experiment can settle

1. **Does the `When` field improve *application*, or only *retrieval*?**
   Field-Aware Skill Retrieval measures Recall/nDCG, not downstream task success.
   No study A/B-tests identical entries with and without a trigger field on
   end-task outcomes. **Test:** hold entries fixed, ablate the `When` section at
   inject time, measure task success — not retrieval rank.

2. **What is the actual optimal entry length for this corpus?** §3.3's 150–400
   tokens is interpolated between the dilution bound and the over-extraction
   bound, not measured. Letta's 2,000 chars is a shipped convention with no
   published justification. **Test:** sweep entry length at fixed retrieval
   budget; look for the interaction with *number* of entries injected.

3. **Do typed section headings help the frontier reader, or only the parser?**
   The comprehension benefit of `## Why` versus the same content in flowing prose
   is unmeasured for a reader model. It might be zero — in which case headings
   are justified by projection alone, which is still sufficient.

4. **Guard-rail vs prohibition phrasing — magnitude for a frontier reader.** The
   77%/100% negation-endorsement figures are for open-source models on ethical
   scenarios. The direction almost certainly holds for a frontier reader on
   technical constraints; the magnitude is unknown and could be small enough that
   the rewriting discipline is not worth its authoring cost. **Test:** matched
   pairs of prohibition-form and guard-rail-form entries, measure compliance
   under a long, loaded context (the White Bear result predicts the gap widens
   with context load — worth measuring at realistic context sizes).

5. **Can an 8B writer reliably produce a *good* `When`?** Schema compliance
   (can it emit the section) is well-understood and fine. Whether a small model
   writes a *situation* rather than restating the topic is a content-quality
   question the format literature does not answer. This is the most likely
   practical failure mode of the recommended anatomy. **Test:** frontier-model
   judging of small-model `When` fields; if quality is poor, the fallback is
   writer-side few-shot with negative examples ("topic, not situation") before
   reaching for a larger writer.

6. **Observed counters vs nothing.** ACE's helpful/harmful counters drive
   curation, but ACE's setting is high-volume. At project scale (spike-001 put
   the retrieval-subagent threshold around ~150 learnings) counters may never
   accumulate enough signal to matter. **Test:** instrument but do not act on
   them; revisit once entry count and surface count are known.

7. **Supersession detection.** The schema makes `superseded_by` *expressible*;
   nothing here makes it *detectable*. Spike-002 already flagged deterministic
   supersession as an unclaimed gap and this survey confirms it — no shipped
   system does it well (Zep's temporal invalidation is the closest, and it is
   extraction-driven). Open.

---

## 10. Sources

**Agent memory systems**
- A-MEM: Agentic Memory for LLM Agents (NeurIPS 2025) — https://arxiv.org/abs/2502.12110 · https://github.com/agiresearch/A-mem
- Agentic Context Engineering (ACE) — https://arxiv.org/abs/2510.04618
- Mem0: Production-Ready AI Agents with Scalable Long-Term Memory — https://arxiv.org/abs/2504.19413 · https://docs.mem0.ai/core-concepts/memory-types
- Zep: A Temporal Knowledge Graph Architecture for Agent Memory — https://arxiv.org/abs/2501.13956 · https://help.getzep.com/graphiti/graphiti/overview
- Letta memory blocks — https://docs.letta.com/guides/core-concepts/memory/memory-blocks · https://www.letta.com/blog/memory-blocks/
- Agent Workflow Memory — https://arxiv.org/abs/2409.07429
- Voyager: An Open-Ended Embodied Agent with LLMs — https://arxiv.org/abs/2305.16291
- HippoRAG — https://arxiv.org/abs/2405.14831
- NeuSymMS: Hybrid Neuro-Symbolic Memory System — https://arxiv.org/html/2605.17596v2
- AtomMem: Memory via Atomic Facts — https://arxiv.org/pdf/2606.19847
- The Consolidation Problem in Agent Memory (four-lever comparison) — https://hindsight.vectorize.io/blog/2026/05/21/agent-memory-consolidation

**Skills, retrieval, applicability conditions**
- Field Aware Agent Skill Retrieval — https://arxiv.org/html/2608.02880
- Skill Retrieval Augmentation for Agentic AI — https://arxiv.org/html/2604.24594v1
- Agent Skills for LLMs: Architecture, Acquisition, Security — https://arxiv.org/html/2602.12430v3
- SoK: Agentic Skills — Beyond Tool Use in LLM Agents — https://arxiv.org/html/2602.20867v1
- Analytic Concept-Centric Memory for Agentic Embodied Manipulation — https://arxiv.org/pdf/2606.29774
- Dynamic Agent Skills: A Lifecycle Survey — https://arxiv.org/html/2607.10113v1
- Anthropic Agent Skills overview — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Anthropic Skill authoring best practices — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Anthropic memory tool — https://docs.claude.com/en/docs/agents-and-tools/tool-use/memory-tool

**Format effects — consuming and writing**
- Let Me Speak Freely? Impact of Format Restrictions (Tam et al. 2024) — https://arxiv.org/abs/2408.02442
- Capacity, Not Format: Rethinking Structured Reasoning Failures — https://arxiv.org/html/2606.09410
- Does Prompt Formatting Have Any Impact on LLM Performance? — https://arxiv.org/html/2411.10541v1
- JSONSchemaBench — https://arxiv.org/pdf/2501.10868
- When Correct Isn't Usable: Structured Output Reliability in Small LMs — https://arxiv.org/pdf/2605.02363
- VAREX: Multi-Modal Structured Extraction benchmark — https://arxiv.org/pdf/2603.15118
- Learning to Generate Structured Output with Schema RL — https://arxiv.org/html/2502.18878v1
- How Constrained Decoding Affects Language Models — https://aclanthology.org/2025.ranlp-1.124.pdf

**Negation**
- Syntactic Framing Fragility: Audit of Robustness in LLM Ethical Decisions — https://arxiv.org/pdf/2601.09724
- Don't Think of the White Bear: Ironic Negation Under Cognitive Load — https://arxiv.org/pdf/2511.12381
- Semantic Adapter: Diagnosing Negation Blindness in Text Embeddings — https://arxiv.org/abs/2504.00584
- MIT News: Vision-language models can't handle negation — https://news.mit.edu/2025/study-shows-vision-language-models-cant-handle-negation-words-queries-0514

**Granularity, atomicity, fidelity**
- Fidelity Before Structure: Verbatim Chunks Beat Lossy Artifact Extraction — https://arxiv.org/html/2601.00821
- Molecular Facts: Desiderata for Decontextualization — https://arxiv.org/html/2406.20079
- Fact in Fragments: Atomic Fact Extraction and Verification — https://arxiv.org/html/2506.07446v1
- Chunking Methods on RAG: Effectiveness vs Cost — https://arxiv.org/html/2606.00881v1

**Classics — CBR, production rules, design rationale**
- Aamodt & Plaza, CBR: Foundational Issues, Methodological Variations — https://www.iiia.csic.es/~enric/papers/AICom.pdf
- Kolodner, A Tutorial Introduction to CBR (1996) — http://www.jimdavies.org/summaries/kolodner1996-2.html
- Review of Case-Based Reasoning for LLM Agents — https://arxiv.org/html/2504.06943v1
- OPS5 / Rete (salience, refraction, conflict resolution) — https://handwiki.org/wiki/Rete_algorithm · https://grokipedia.com/page/ops5
- MADR — https://adr.github.io/madr/ · ADR templates — https://adr.github.io/adr-templates/
- Microsoft Well-Architected: Maintain an ADR — https://learn.microsoft.com/en-us/azure/well-architected/architect-role/architecture-decision-record

**Provenance representation**
- Provenance-Aware Knowledge Representation: A Survey — https://link.springer.com/article/10.1007/s41019-020-00118-0
- Don't Like RDF Reification? Singleton Property — https://dl.acm.org/doi/10.1145/2566486.2567973
- New perspectives for metadata modeling: RDF-star and Named Graphs — https://arxiv.org/pdf/2211.16195

**Tag drift**
- Folksonomies: Why do we need controlled vocabulary? (Webology 2007) — https://www.webology.org/2007/v4n2/editorial12.html
- Tagging, Folksonomy & Co — Renaissance of Manual Indexing? — https://arxiv.org/pdf/cs/0701072

**Context dilution**
- Rethinking Memory in LLM-based Agents — https://arxiv.org/pdf/2505.00675
- Context Rot: Why LLMs Degrade as Context Grows — https://www.morphllm.com/context-rot
