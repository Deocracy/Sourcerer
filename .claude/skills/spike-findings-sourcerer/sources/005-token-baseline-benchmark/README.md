---
spike: 005
name: token-baseline-benchmark
type: comparison
validates: "Given the same trivial task, when run under lean-Pi vs OMP vs opencode, then measured prompt-token baselines confirm or refute the '22k is overkill' claim"
verdict: VALIDATED
related: [001, 003, 004]
tags: [benchmark, tokens, comparison, pi, omp, opencode]
---

# Spike 005: Token Baseline Benchmark

## What This Validates

Given the same trivial task, when the system prompt is composed under **lean-Pi**
(`@earendil-works/pi-coding-agent`) vs **OMP** (`@oh-my-pi/pi-coding-agent`, the
multi-agent orchestration fork) vs **opencode** (`opencode-ai`), then the measured
prompt-token baselines confirm or refute the MANIFEST's working hypothesis that a
**~22k-token coding prompt is overkill** for Sourcerer's Dashboard Assistant.

## Research

Where each harness's prompt actually lives:

| Harness | Package | Prompt source | How measured |
|---------|---------|---------------|--------------|
| lean-Pi | `@earendil-works/pi-coding-agent@0.74.2` | composed at runtime by `createAgentSession` | instantiate, read `session.systemPrompt` |
| OMP | `@oh-my-pi/pi-coding-agent@16.3.11` | `src/prompts/system/system-prompt.md` + native tool schemas + conditional notices | read base doc + ran OMP's **own** `scripts/measure-prompt-tokens.ts` (Bun) |
| opencode | `opencode-ai@1.17.14` | ships a compiled `.exe` — prompts baked in; real source in `sst/opencode` `packages/opencode/src/session/prompt/*.txt` | fetched `anthropic/beast/gemini.txt` from source, archived in `opencode-prompts/` |

**Ruler:** one consistent yardstick for cross-harness text — `gpt-tokenizer`
(o200k_base, pure JS, no native deps). The claim is about *relative* magnitude
(tens-of-x), which is robust to exact tokenizer choice. OMP's own figure uses its
internal `countTokens` (a `bytes/4`-class estimator) — reported separately as the
authoritative "with tools" number.

## How to Run

```bash
cd .planning/spikes/005-token-baseline-benchmark
CEREBRAS_API_KEY=dummy node measure.mjs     # dummy key: only reads .systemPrompt, no network
# OMP's own authoritative composed measurement (needs Bun):
bun node_modules/@oh-my-pi/pi-coding-agent/scripts/measure-prompt-tokens.ts
```

## What to Expect

Table of chars + tokens per harness (one ruler), OMP's own wire-baseline figure,
and verdict-ratio math. `results.json` is written as the forensic export.

## Investigation Trail

1. **Mapped the real packages.** The `@oh-my-pi/*` already installed in spike 004
   are libraries; OMP's actual coding harness is `@oh-my-pi/pi-coding-agent@16.x`
   (a heavily-versioned fork, distinct from lean upstream `@earendil-works/…@0.74`).
   opencode publishes only a compiled binary — prompts had to come from its source.
2. **OMP ships its own prompt-token measurer** (`scripts/measure-prompt-tokens.ts`).
   Ran it under Bun → authoritative: **17 default tools = 13,205 tok of schemas**,
   text prompt part0 = **2,802 tok**, context 182 → **16,189 tok** effective wire
   baseline for a trivial task, *before* any conditional notices.
3. **False start #1 — 25k-char "Pi" prompts.** First run reported Pi at ~6,300–6,500
   tokens — implausibly large vs spike 003's ~130. Dumping the prompt revealed the
   bulk was a `# Project Context` block: **Pi auto-injects the repo's CLAUDE.md/
   AGENTS.md** (our CLAUDE.md is ~23k chars) by walking up from `cwd`. That context
   is identical across harnesses (config, not harness weight) and was drowning the
   signal.
4. **False start #2 — `noContextFiles` didn't gate it.** Setting `noContextFiles:
   true` on `createAgentSession` did **not** strip the injection at this call level.
   Fix that actually works: point `cwd` at a fresh temp dir **outside the repo** so
   there's no CLAUDE.md to discover. Pi prompts immediately collapsed to their true
   size (598 / 410 tok).
5. **Also learned: `systemPromptOverride` via `createAgentSession` is ignored** — a
   marker string passed through it never appeared in `.systemPrompt`. So the "tools
   off" row is Pi's *stock* template floor (410 tok), not a custom prompt. Spike 003
   drove Pi below this (~130 tok) by replacing the template + gating tools per mode.
6. Re-ran clean. Numbers stable and reproducible.

## Results — VALIDATED (hypothesis CONFIRMED, with a sharper insight)

Measured baselines (system prompt only, no user content, project-context excluded):

| Harness | tokens | ruler | notes |
|---------|-------:|-------|-------|
| **OMP** (minimal wire baseline) | **16,189** | OMP `countTokens` | text 2,802 + context 182 + **17 tool schemas 13,205** |
| **OMP** + workflow + plan-mode notices | **~35,000** | derived | where "22k+" actually comes from |
| OMP base identity doc only | 3,575 | gpt-tokenizer | `system-prompt.md`, before tools |
| opencode/gemini (text) | 3,265 | gpt-tokenizer | + its ~10 tools (not counted) |
| opencode/beast (text) | 2,304 | gpt-tokenizer | used for gpt-oss/non-Claude models |
| opencode/anthropic (text) | 1,637 | gpt-tokenizer | Claude models |
| **Pi** out-of-box (builtin tools inlined) | **597** | gpt-tokenizer | the stock coding agent |
| **Pi** stock template, tools off | **410** | gpt-tokenizer | harness floor |
| **Sourcerer lean target** (spike 003) | **~130** | chars/4 | template replaced + modes gate tools |

**Ratios:** OMP-minimal is **39×** Pi's floor and **125×** Sourcerer's lean target.

### The sharper insight (this is the real finding)

The "22k" is **real but it's almost entirely TOOL SCHEMAS, not prose.** OMP's text
identity prompt is only 2,802 tokens — reasonable. The weight is **13,205 tokens of
17 always-on coding tools** (`edit` 1,981, `browser` 1,582, `eval` 1,459, `task`
1,133 …), plus conditional orchestration notices (workflow ~9k, plan-mode ~10k) that
push a working session past 22k and toward 35k.

This validates the MANIFEST architecture precisely: Sourcerer's **mode-gated tools**
(spike 003) attack the exact cost center. You don't pay for 17 always-on coding tools
— a mode loads its 2–6 tools on demand. Pi's own default harness is *already* lean
(597 tok); OMP's bulk is opt-in orchestration machinery Sourcerer simply won't mount.

### Verdict per harness

- **lean-Pi — WINNER.** 130–600 tok baseline. Ships lean by default; goes lower via
  spike-003 mode gating. Correct core for a non-coding-first assistant.
- **OMP — overkill as a harness** (16k–35k), but its *parts* are liftable (spike 004).
  Adopt components, not the harness. Confirmed.
- **opencode — middleweight, and not embeddable.** Text prompts 1.6k–3.3k (bigger than
  Pi's) and it ships as a compiled CLI binary, not a headless Node core `host.ai()`
  can proxy. Skip, as hypothesized.

## Landmines for the build

- **Pi auto-injects CLAUDE.md/AGENTS.md as project context** by walking up from `cwd`,
  and `noContextFiles:true` did **not** disable it via `createAgentSession` in 0.74.2.
  For Sourcerer, control the assistant's `cwd` deliberately (or find the real gate) —
  a large repo CLAUDE.md silently becomes a per-turn token tax dwarfing the harness.
- **`systemPromptOverride` passed to `createAgentSession` is ignored** in 0.74.2. Use
  spike 003's proven path: `noTools:"builtin"` + `customTools` + `setActiveToolsByName`,
  and (per spike 003) the override via the resource-loader / `reload()` route.
- **opencode is a binary**, not a library — its prompts live in `sst/opencode` source,
  not the npm package. Don't expect to `import` its harness.
- OMP's `@oh-my-pi/pi-coding-agent` is **Bun-oriented at source entry** (same as
  mnemopi in spike 004) — its own measure script runs under Bun, not Node.
