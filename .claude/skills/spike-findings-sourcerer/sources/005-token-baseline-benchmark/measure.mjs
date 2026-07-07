// Spike 005 — token-baseline-benchmark
// Measures the DEFAULT system-prompt token cost of three agent harnesses on a
// trivial task, using ONE consistent ruler (gpt-tokenizer, o200k_base) so the
// numbers are apples-to-apples. Also records each harness's own authoritative
// figure where it ships one (OMP's measure-prompt-tokens.ts).
//
// Run:  CEREBRAS_API_KEY=dummy node measure.mjs
// Output: table to stdout + results.json forensic export.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encode } from "gpt-tokenizer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Pi auto-injects the repo's CLAUDE.md/AGENTS.md as "Project Context" (23k chars
// here) by walking up from cwd — and noContextFiles doesn't gate it at this call
// level. That context is identical across harnesses (config, not harness weight),
// so run Pi from a CLEAN dir OUTSIDE the repo to isolate the harness's own prompt.
const CLEAN_CWD = fs.mkdtempSync(path.join(os.tmpdir(), "spike005-clean-"));
const tok = (s) => encode(s ?? "").length;
const chars = (s) => (s ?? "").length;

const rows = [];
const add = (harness, layer, text, note = "") =>
  rows.push({ harness, layer, chars: chars(text), tokens: tok(text), note });

// ─── lean-Pi: instantiate the real Pi coding agent ────────────────────────────
process.env.CEREBRAS_API_KEY ||= "dummy"; // only reading .systemPrompt; no network
const pi = await import("@earendil-works/pi-coding-agent");
const { getModel } = await import("@earendil-works/pi-ai");
const model = getModel("cerebras", "gpt-oss-120b");

// noContextFiles:true — do NOT auto-inject the repo's CLAUDE.md/AGENTS.md.
// That project-context is identical across harnesses (it's config, not harness
// weight); leaving it in dwarfs everything with our 23k-char CLAUDE.md.

// (a) Pi's DEFAULT coding-agent prompt (builtin tools inlined into the text)
{
  const { session } = await pi.createAgentSession({
    cwd: CLEAN_CWD, model, noContextFiles: true,
  });
  add("pi-default", "harness prompt (builtin tools)", session.systemPrompt,
    "Pi out-of-box coding agent");
}

// (b) Pi with builtin tools OFF and 0 active tools — the stock harness FLOOR.
//     NOTE: systemPromptOverride passed via createAgentSession is IGNORED here
//     (verified: a marker string never appears in .systemPrompt). So this is Pi's
//     own default template with no tools — NOT Sourcerer's custom prompt. Spike
//     003 drove Pi lower still (~130 tok) by replacing the template + toggled
//     modes; this row is the conservative stock floor, and it's already tiny.
{
  const { session } = await pi.createAgentSession({
    cwd: CLEAN_CWD, model, noTools: "builtin", noContextFiles: true,
  });
  session.setActiveToolsByName([]); // 0 active tools — rebuild
  add("pi (stock template, tools off)", "harness prompt floor", session.systemPrompt,
    "Sourcerer's own prompt (spike 003) sits ~130 tok, below this");
}

// ─── OMP: read its shipped identity prompt; tokenize with the SAME ruler ───────
const ompBase = path.join(__dirname,
  "node_modules/@oh-my-pi/pi-coding-agent/src/prompts/system/system-prompt.md");
add("omp", "base identity prompt (system-prompt.md)", fs.readFileSync(ompBase, "utf8"),
  "before tools/notices");
// OMP's own measure-prompt-tokens.ts (countTokens ruler) reported, for a trivial task:
const OMP_SELF = { textPromptTok: 2802, contextTok: 182, toolsTok: 13205, tools: 17 };
OMP_SELF.effectiveBaseline = OMP_SELF.textPromptTok + OMP_SELF.contextTok + OMP_SELF.toolsTok;

// ─── opencode: its real per-model system prompts (fetched from source) ─────────
for (const f of fs.readdirSync(path.join(__dirname, "opencode-prompts"))) {
  if (!f.endsWith(".txt")) continue;
  const text = fs.readFileSync(path.join(__dirname, "opencode-prompts", f), "utf8");
  add(`opencode/${f.replace(".txt", "")}`, "base prompt (text only)", text,
    f === "beast.txt" ? "used for gpt-oss/non-Claude models" : "");
}

// ─── report ───────────────────────────────────────────────────────────────────
rows.sort((a, b) => b.tokens - a.tokens);
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
console.log("\n  ruler: gpt-tokenizer (o200k_base) — one yardstick for all harnesses\n");
console.log(`  ${pad("harness", 30)} ${pad("layer", 34)} ${rpad("chars", 7)} ${rpad("tokens", 7)}`);
console.log("  " + "-".repeat(84));
for (const r of rows)
  console.log(`  ${pad(r.harness, 30)} ${pad(r.layer, 34)} ${rpad(r.chars, 7)} ${rpad(r.tokens, 7)}   ${r.note}`);

console.log("\n  OMP effective wire baseline (OMP's OWN countTokens ruler, trivial task):");
console.log(`    text prompt ${OMP_SELF.textPromptTok} + context ${OMP_SELF.contextTok} + ${OMP_SELF.tools} tool schemas ${OMP_SELF.toolsTok} = ${OMP_SELF.effectiveBaseline} tokens`);
console.log("    (excludes conditional notices: workflow ~9k / plan-mode ~10k / orchestrate ~5.5k)");

// ─── verdict math: is a ~22k coding prompt overkill for Sourcerer? ────────────
const piFloor = rows.find(r => r.harness.startsWith("pi (stock")).tokens;
const ompFull = OMP_SELF.effectiveBaseline + 9000 + 10000; // + workflow + plan-mode notices
console.log("\n  VERDICT MATH (\"is 22k overkill?\"):");
console.log(`    OMP minimal wire baseline ....... ${OMP_SELF.effectiveBaseline} tok`);
console.log(`    OMP w/ workflow+plan-mode notices ~${ompFull} tok  (this is where 22k+ comes from)`);
console.log(`    Pi stock harness floor .......... ${piFloor} tok`);
console.log(`    Sourcerer lean target (spike 003) ~130 tok`);
console.log(`    ratio  OMP-minimal / Pi-floor ... ${(OMP_SELF.effectiveBaseline / piFloor).toFixed(0)}x`);
console.log(`    ratio  OMP-minimal / Sourcerer .. ${(OMP_SELF.effectiveBaseline / 130).toFixed(0)}x\n`);

fs.writeFileSync(path.join(__dirname, "results.json"),
  JSON.stringify({ ruler: "gpt-tokenizer/o200k_base", rows, omp_self_report: OMP_SELF }, null, 2));
console.log("  → results.json written\n");

fs.rmSync(CLEAN_CWD, { recursive: true, force: true }); // ponytail: don't litter temp
