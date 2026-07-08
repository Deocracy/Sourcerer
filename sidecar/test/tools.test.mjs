// Offline unit tests for the Databasise Research tool adapter (D-03/D-06/D-07).
// No live Databasise server is required or contacted: DATABASISE_BASE_URL is
// pointed at a closed loopback port before the module is imported, so every
// fetch (spec generation + per-tool execute) fails fast with ECONNREFUSED and
// exercises the honest-degrade path (D-06).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Port 1 is a well-known unassigned/closed port on loopback on every platform
// this sidecar targets — connecting to it fails immediately (no listener),
// unlike an unroutable IP which can hang until a TCP timeout.
process.env.DATABASISE_BASE_URL = "http://127.0.0.1:1";

const { allDatabasiseTools, DATABASISE_TOOL_NAMES, WIKI_UNAVAILABLE_MESSAGE } = await import(
  "../src/tools/databasise.ts"
);

test("whitelist is exactly the four D-03 tools; /wiki/preview is absent", () => {
  assert.deepEqual(
    [...DATABASISE_TOOL_NAMES].sort(),
    ["kb_query", "wiki_resolve", "wiki_unplaced", "wiki_unresolved"],
  );
  assert.ok(!DATABASISE_TOOL_NAMES.some((n) => n.includes("preview")), "/wiki/preview must never be a tool");
});

test("spec-fetch failure still yields four tools (D-06 offline boot)", async () => {
  const tools = await allDatabasiseTools();
  assert.equal(tools.length, 4);
  assert.deepEqual(
    tools.map((t) => t.name).sort(),
    ["kb_query", "wiki_resolve", "wiki_unplaced", "wiki_unresolved"],
  );
});

test("every tool execute() degrades honestly when Databasise is unreachable and never throws (D-06)", async () => {
  const tools = await allDatabasiseTools();
  for (const tool of tools) {
    const result = await tool.execute("test-call-id", {});
    assert.ok(Array.isArray(result.content) && result.content.length > 0, `${tool.name} must return content`);
    const text = result.content[0].text;
    assert.equal(text, WIKI_UNAVAILABLE_MESSAGE, `${tool.name} must degrade to the honest-unavailable message`);
  }
});

test("no Authorization header is ever set on tool requests (D-07 guest-mode)", () => {
  // Static/source assertion: the `headers:` object literal(s) passed to fetch()
  // never include an Authorization key anywhere in the module. Matching only the
  // header-literal shape (rather than the bare word "authorization") keeps this
  // from tripping on the D-07 doc comments that legitimately discuss the guest-mode
  // contract, while still failing loudly if an auth header is ever wired in.
  const src = fs.readFileSync(new URL("../src/tools/databasise.ts", import.meta.url), "utf8");
  assert.ok(
    !/headers:\s*\{[^}]*authorization/i.test(src),
    "databasise.ts must never set an Authorization header in a fetch() call (D-07)",
  );
});
