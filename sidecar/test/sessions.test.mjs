// Offline unit tests for FileSessionManager (D-09) and the T-07-08 path-traversal
// guard. Every test uses a throwaway temp directory (fs.mkdtempSync) passed
// explicitly as the sessionDir constructor arg — never the real OS app-data
// directory a live sidecar would use.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { FileSessionManager, isValidSessionId } = await import("../src/sessions.ts");

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sourcerer-sessions-test-"));
}

// Pi's own SessionManager (sessions.ts wraps it, see D-09 comment there) only
// flushes a session to disk once a real assistant-role message entry exists
// (its `_persist()` lazily withholds the file write for user-only/custom-only
// conversations — see @earendil-works/pi-coding-agent's session-manager.js).
// A minimal-but-valid AssistantMessage is required to exercise the on-disk
// round-trip; a user turn is appended alongside it to mirror a real turn shape.
function appendTurn(sm, text) {
  sm.appendMessage({ role: "user", content: text, timestamp: Date.now() });
  sm.appendMessage({
    role: "assistant",
    content: [{ type: "text", text: `ack: ${text}` }],
    api: "test-api",
    provider: "test-provider",
    model: "test-model",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    stopReason: "stop",
    timestamp: Date.now(),
  });
}

test("appended turns round-trip across a fresh FileSessionManager instance (D-09 restart survival)", async () => {
  const dir = tmpDir();
  const cwd = process.cwd();

  const mgr1 = new FileSessionManager(cwd, dir);
  const sm1 = await mgr1.open("session-a");
  appendTurn(sm1, "turn one");
  appendTurn(sm1, "turn two");

  // Simulate a sidecar restart: brand new manager instance over the same directory.
  const mgr2 = new FileSessionManager(cwd, dir);
  const ids = await mgr2.listSessionIds();
  assert.ok(ids.includes("session-a"), "session-a must be listed on boot after restart");

  const sm2 = await mgr2.open("session-a");
  const userTurns = sm2.getEntries().filter((e) => e.type === "message" && e.message.role === "user");
  assert.equal(userTurns.length, 2, "both turns must survive manager reconstruction");
  assert.equal(userTurns[0].message.content, "turn one");
  assert.equal(userTurns[1].message.content, "turn two");
});

test("a malformed JSONL line is skipped, not fatal", async () => {
  const dir = tmpDir();
  const cwd = process.cwd();

  const mgr1 = new FileSessionManager(cwd, dir);
  const sm1 = await mgr1.open("session-b");
  appendTurn(sm1, "a valid turn");
  const file = sm1.getSessionFile();
  assert.ok(file, "session must be persisted to a file");

  // Corrupt the JSONL file by appending a line that isn't valid JSON.
  fs.appendFileSync(file, "not json at all\n");

  const mgr2 = new FileSessionManager(cwd, dir);
  const sm2 = await mgr2.open("session-b");
  assert.doesNotThrow(() => sm2.getEntries());
  const userTurns = sm2.getEntries().filter((e) => e.type === "message" && e.message.role === "user");
  assert.equal(userTurns.length, 1, "the corrupt line must be skipped while the valid entry survives");
});

test("turns are appended, not full-file rewrites", async () => {
  const dir = tmpDir();
  const cwd = process.cwd();

  const mgr = new FileSessionManager(cwd, dir);
  const sm = await mgr.open("session-c");
  appendTurn(sm, "first");
  const file = sm.getSessionFile();
  const afterFirst = fs.readFileSync(file, "utf8");

  appendTurn(sm, "second");
  const afterSecond = fs.readFileSync(file, "utf8");

  assert.ok(
    afterSecond.startsWith(afterFirst),
    "appending a second turn must extend the file, never rewrite prior bytes",
  );
});

test("path-traversal sessionIds are rejected (T-07-08)", async () => {
  assert.equal(isValidSessionId("../../etc/passwd"), false);
  assert.equal(isValidSessionId("a/../../b"), false);
  assert.equal(isValidSessionId("..\\windows"), false);
  assert.equal(isValidSessionId("normal-session_123"), true);

  const dir = tmpDir();
  const mgr = new FileSessionManager(process.cwd(), dir);
  await assert.rejects(() => mgr.open("../evil"), /Invalid sessionId/);
});

test("listSessions/listSessionIds return an empty list for a fresh directory", async () => {
  const dir = tmpDir();
  const mgr = new FileSessionManager(process.cwd(), dir);
  assert.deepEqual(await mgr.listSessionIds(), []);
});
