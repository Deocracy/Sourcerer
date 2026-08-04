// D-10 gate: fail when the toolchain resolved in the *current environment*
// diverges from the repo's pin files (rust-toolchain.toml, .nvmrc). Runs
// identically on windows-latest and inside `nix develop` on Linux — that is
// why this is a Node script and not inline shell (Pattern 4 / Pitfall 4).
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url)) + "/..";
const RUST_TOOLCHAIN_PATH = join(ROOT, "rust-toolchain.toml");
const NVMRC_PATH = join(ROOT, ".nvmrc");

function fail(msg) {
  console.error(`drift-gate — ${msg}`);
  process.exit(1);
}

if (!existsSync(RUST_TOOLCHAIN_PATH)) fail(`missing ${RUST_TOOLCHAIN_PATH}`);
if (!existsSync(NVMRC_PATH)) fail(`missing ${NVMRC_PATH}`);

const rustToolchainText = readFileSync(RUST_TOOLCHAIN_PATH, "utf8");
const channelMatch = rustToolchainText.match(/channel\s*=\s*"([^"]+)"/);
if (!channelMatch) fail(`could not find a channel = "..." line in rust-toolchain.toml`);
const expectedRust = channelMatch[1];

if (["stable", "beta", "nightly"].includes(expectedRust)) {
  fail(
    `rust-toolchain.toml channel is a floating name ("${expectedRust}"), not an exact version — the drift gate is unfalsifiable against a floating channel. Pin an exact rustc version.`
  );
}

const expectedNode = readFileSync(NVMRC_PATH, "utf8").trim();

let actualRust;
try {
  const out = execFileSync("rustc", ["--version"], { encoding: "utf8" });
  // "rustc 1.97.1 (abcdef123 2026-08-01)" -> "1.97.1"
  const m = out.match(/^rustc (\S+)/);
  if (!m) fail(`could not parse rustc --version output: ${out.trim()}`);
  actualRust = m[1];
} catch (err) {
  fail(
    `rustc not found or failed to run (${err.message}) — this means the job's rustup never resolved rust-toolchain.toml`
  );
}

const actualNode = process.version.replace(/^v/, "");

const mismatches = [];
if (actualRust !== expectedRust) {
  mismatches.push(`rustc: expected ${expectedRust}, got ${actualRust}`);
}
if (actualNode !== expectedNode) {
  mismatches.push(`node: expected ${expectedNode}, got ${actualNode}`);
}

if (mismatches.length > 0) {
  for (const m of mismatches) console.error(`drift-gate — ${m}`);
  process.exit(1);
}

console.log(`drift-gate — PASS: rustc ${actualRust} matches, node ${actualNode} matches.`);
