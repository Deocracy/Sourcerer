// Nyquist gate: the automated verification the plan was missing before this task.
// Run: node --experimental-strip-types --test test/harness.test.mjs
// (the --experimental-strip-types flag is required because src/*.ts is executed
// directly via Node's type-stripping — no separate build step. See 07-01-SUMMARY.md
// "Deviations" for why the plan's literal `node --test ...` command needed this flag.)
//
// No live model call is made anywhere in this file (CEREBRAS_API_KEY=dummy is enough
// to construct a session and read its composed system prompt / active tool names).

import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

process.env.CEREBRAS_API_KEY ||= "dummy";
// D-09: buildSession() now opens a file-backed session (sessions.ts); point it at a
// throwaway temp dir instead of the real per-OS app-data directory so running this
// test suite never writes into the actual user's Sourcerer profile.
process.env.SOURCERER_SESSION_DIR ||= path.join(os.tmpdir(), "sourcerer-sidecar-harness-test-sessions");

const { buildSession } = await import("../src/index.ts");
const modes = await import("../src/modes.ts");
const protocol = await import("../src/protocol.ts");

test("composed baseline prompt is lean and CLAUDE.md-free (D-10)", async () => {
  const { session } = await buildSession();
  assert.ok(
    session.systemPrompt.length < 8000,
    `expected composed prompt under 8000 chars (proxy for <5k tokens), got ${session.systemPrompt.length}`,
  );
  assert.ok(
    !session.systemPrompt.includes("Sourcerer (Desktop Shell)"),
    "composed prompt must not contain the repo root CLAUDE.md sentinel text",
  );
});

test("mode registry has all four modes with correct tool lists (D-02/D-04)", () => {
  const keys = Object.keys(modes.MODES).sort();
  assert.deepEqual(keys, ["coding", "memory", "notes", "research"]);
  assert.deepEqual(modes.MODES.notes.tools, []);
  assert.deepEqual(modes.MODES.coding.tools, []);
  assert.deepEqual(modes.MODES.memory.tools, []);
  assert.deepEqual(modes.MODES.research.tools, ["wiki_resolve", "wiki_unresolved", "wiki_unplaced", "kb_query"]);
});

test("active mode set is seeded empty (research OFF, matching the panel default) — WR-02", () => {
  // The panel initializes researchMode=false and does not setModes on mount, so the
  // sidecar must NOT boot with research active or the first turn silently runs
  // research tools the UI claims are disabled.
  assert.deepEqual(modes.activeModeKeys(), []);
});

test("setModes toggles activeToolNames deterministically (D-02 runtime toggle)", async () => {
  await buildSession(); // binds a real session so setModes() has something to drive
  await modes.setModes(["notes"]);
  assert.deepEqual(modes.activeToolNames(), []);
  await modes.setModes(["research"]);
  assert.deepEqual(modes.activeToolNames(), ["wiki_resolve", "wiki_unresolved", "wiki_unplaced", "kb_query"]);
});

test("stdio writeEvent/readRequests round-trips one protocol event without corrupting embedded newlines", async () => {
  const { Writable, Readable } = await import("node:stream");

  // writeEvent -> a single NDJSON line, embedded newline in the text survives JSON escaping.
  const chunks = [];
  const out = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  protocol.writeEvent({ type: "text_delta", id: "abc", text: "line one\nline two" }, out);
  const written = chunks.join("");
  assert.equal((written.match(/\n/g) ?? []).length, 1, "exactly one physical newline (the NDJSON terminator)");
  const parsedBack = JSON.parse(written.trim());
  assert.equal(parsedBack.text, "line one\nline two", "embedded newline survives JSON round-trip");

  // readRequests -> feed the same shape back in as a request-like line and confirm it parses.
  const input = Readable.from([
    '{"type":"prompt","id":"1","sessionId":"s1","message":"hello\\nworld","modes":["research"]}\n',
  ]);
  const received = [];
  for await (const req of protocol.readRequests(input)) {
    received.push(req);
  }
  assert.equal(received.length, 1);
  assert.equal(received[0].type, "prompt");
  assert.equal(received[0].message, "hello\nworld");
});

test("readRequests skips malformed lines defensively instead of throwing", async () => {
  const { Readable } = await import("node:stream");
  const input = Readable.from(["not json\n", '{"type":"setModes","modes":["notes"]}\n', "\n"]);
  const received = [];
  for await (const req of protocol.readRequests(input)) {
    received.push(req);
  }
  assert.equal(received.length, 1);
  assert.equal(received[0].type, "setModes");
});
