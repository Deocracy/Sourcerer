// Sourcerer Pi sidecar entrypoint.
//
// Headless embed of @earendil-works/pi-coding-agent behind Sourcerer's host.ai() seam.
// Reads newline-delimited JSON requests on stdin ({"type":"prompt",...} /
// {"type":"setModes",...}), streams newline-delimited JSON events on stdout
// (ready/thinking_delta/text_delta/tool_start/tool_end/error/done). See the
// <interfaces> block in 07-01-PLAN.md for the canonical protocol contract shared
// with the Rust relay (07-03) and the frontend Channel types (07-04).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAgentSession,
  DefaultResourceLoader,
  type AgentSession,
  type AgentSessionEvent,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { getModel, type KnownProvider } from "@earendil-works/pi-ai/compat";

import { composePrompt, activeToolNames, bindSession, setModes, allModeTools } from "./modes.ts";
import { readRequests, writeEvent, type SidecarRequest } from "./protocol.ts";
import { FileSessionManager } from "./sessions.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- config (D-08: sidecar owns its own .env, decoupled from Databasise install) ------

// Node does not auto-load .env. Load the sidecar's own .env (next to package.json,
// one level up from src/) BEFORE anything reads process.env, so CEREBRAS_API_KEY,
// PI_PROVIDER and PI_MODEL reach getModel(). Guarded by existsSync: a missing .env
// is not fatal — the turn degrades honestly ("no API key found") per D-06.
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const PI_PROVIDER = process.env.PI_PROVIDER || "cerebras";
const PI_MODEL = process.env.PI_MODEL || "zai-glm-4.7";

// D-09: one FileSessionManager for the whole sidecar process, lazily created on
// first use so tests (and the very first buildSession() call) resolve the same
// session dir every time rather than re-deriving it per call.
let fileSessionManager: FileSessionManager | null = null;

/**
 * Build the headless Pi session (D-10: lean baseline routed through
 * DefaultResourceLoader, never bare createAgentSession options).
 *
 * Exported separately from the stdio loop so tests can construct a session
 * without spawning a live turn (no network call, works with a dummy key).
 *
 * `sessionId` (D-09) selects/creates the JSONL-backed conversation this
 * AgentSession is bound to; defaults to "default" so existing callers (and
 * harness.test.mjs, which predates per-session wiring) keep working unchanged.
 */
export async function buildSession(sessionId: string = "default"): Promise<{ session: AgentSession }> {
  // cwd is set to the sidecar dir (NOT the repo root) so noContextFiles has nothing
  // to walk past even as a defense-in-depth measure — the flag already guards this.
  const cwd = __dirname;
  const agentDir = path.join(__dirname, ".pi-agent"); // sidecar-local; never touch ~/.pi
  fs.mkdirSync(agentDir, { recursive: true });

  if (!fileSessionManager) {
    fileSessionManager = new FileSessionManager(cwd);
  }
  const sessionManager = await fileSessionManager.open(sessionId);

  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    systemPromptOverride: () => composePrompt(), // re-read on session.reload() (D-02 toggle)
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true, // <-- kills the CLAUDE.md/AGENTS.md auto-inject tax (D-10)
  });
  // createAgentSession only calls reload() on a resourceLoader it constructs itself
  // (systemPrompt/getSystemPrompt() stay undefined otherwise) — when passing our own
  // instance we must load it first, matching the SDK's own "Full control" example.
  await resourceLoader.reload();

  // PI_PROVIDER/PI_MODEL come from the sidecar's own .env (D-08) as plain strings;
  // getBuiltinModel's generic signature wants literal KnownProvider/model-id keys for
  // compile-time model catalog checking, which doesn't fit a runtime-configurable
  // provider/model pair. Cast at this one boundary; the function still validates and
  // throws at runtime for an unknown provider/model combination.
  const model = getModel(PI_PROVIDER as KnownProvider, PI_MODEL as never);

  const { session } = await createAgentSession({
    cwd,
    agentDir,
    model,
    noTools: "builtin", // NEVER "all" — that silently drops customTools too (spike 001 landmine)
    customTools: (await allModeTools()) as ToolDefinition[], // D-03: research's four Databasise tools + empty seams
    sessionManager, // D-09: file-backed, keyed on sessionId — no more SessionManager.inMemory()
    resourceLoader,
  });

  // Rebuild the prompt/tool set from Pi's boot wrapper to our composed lean prompt.
  // Reading session.systemPrompt before this call reports Pi's default template (~410 tok),
  // not our composed prompt.
  session.setActiveToolsByName(activeToolNames());

  // modes.setModes() needs to drive reload()/setActiveToolsByName() on this session.
  bindSession(session);

  return { session };
}

// ---- event mapping: Pi's AgentSessionEvent -> the sidecar's protocol events -----------

function handleAgentEvent(id: string, event: AgentSessionEvent): void {
  switch (event.type) {
    case "message_update": {
      const e = event.assistantMessageEvent;
      if (e.type === "text_delta") {
        writeEvent({ type: "text_delta", id, text: e.delta });
      } else if (e.type === "thinking_delta") {
        // Claude's-Discretion (07-CONTEXT.md): forward by default, let the panel decide
        // whether to render it.
        writeEvent({ type: "thinking_delta", id, text: e.delta });
      }
      break;
    }
    case "tool_execution_start":
      writeEvent({ type: "tool_start", id, name: event.toolName });
      break;
    case "tool_execution_end":
      writeEvent({ type: "tool_end", id, name: event.toolName, ok: !event.isError });
      break;
    // agent_start/turn_start/turn_end/agent_end intentionally produce no protocol
    // event of their own — "done" (emitted once per prompt after the turn settles)
    // is the single terminal event downstream consumers key off.
    default:
      break;
  }
}

/**
 * Run one prompt request to completion, streaming events tagged with the request id.
 * Never throws past this boundary: any turn error becomes an `error` event followed
 * by `done` so the sidecar process stays alive (D-06 degrade contract, T-07-02).
 */
async function runPrompt(session: AgentSession, req: { id: string; message: string }): Promise<void> {
  const unsubscribe = session.subscribe((event) => handleAgentEvent(req.id, event));
  try {
    await session.prompt(req.message);
  } catch (err) {
    writeEvent({ type: "error", id: req.id, message: err instanceof Error ? err.message : String(err) });
  } finally {
    unsubscribe();
    writeEvent({ type: "done", id: req.id });
  }
}

// D-09: one AgentSession per distinct sessionId, built lazily on first prompt and
// cached for the life of the process so a chatty conversation doesn't reopen its
// JSONL file (or re-fetch the Databasise /openapi.json, memoized separately in
// modes.ts) on every turn. Multiple sessionIds may exist across a process
// lifetime; only one prompt is ever in flight at a time (requests are handled
// sequentially below), so bindSession()'s single module-level slot always
// reflects the session the current/most-recent prompt or setModes() call acted on.
const sessionsById = new Map<string, Promise<AgentSession>>();

async function getOrCreateSession(sessionId: string): Promise<AgentSession> {
  let sessionPromise = sessionsById.get(sessionId);
  if (!sessionPromise) {
    sessionPromise = buildSession(sessionId).then(({ session }) => session);
    // CR-01/WR-08: never cache a rejected build. If buildSession() fails (an invalid
    // sessionId, a transient FS error, a bad PI_PROVIDER/PI_MODEL), drop the cached
    // promise so the next turn rebuilds instead of replaying the same rejection forever.
    sessionPromise.catch(() => sessionsById.delete(sessionId));
    sessionsById.set(sessionId, sessionPromise);
  }
  return sessionPromise;
}

async function handleRequest(req: SidecarRequest): Promise<void> {
  if (req.type === "prompt") {
    const session = await getOrCreateSession(req.sessionId);
    // WR-01: the panel stamps `modes` on every PromptRequest (research on/off).
    // Apply it before the turn so per-prompt mode selection actually drives the
    // tool set + prompt fragment — previously `req.modes` was dead protocol surface
    // and modes only ever changed via the separate setModes path. Applied after the
    // session is built so setModes() has a bound session to reload().
    await setModes(req.modes);
    await runPrompt(session, req);
  } else if (req.type === "setModes") {
    await setModes(req.modes);
  }
}

async function main(): Promise<void> {
  // D-09: no session is built until the first prompt arrives (each prompt carries
  // the sessionId that selects/creates its JSONL file) — the sidecar can announce
  // ready immediately rather than eagerly building a "default" session up front.
  writeEvent({ type: "ready" });

  for await (const req of readRequests()) {
    // Requests are handled sequentially (Pi's AgentSession serializes turns anyway);
    // a bad request never crashes the loop (protocol.ts already parses defensively,
    // and handleRequest's own errors are caught per-turn inside runPrompt).
    try {
      await handleRequest(req);
    } catch (err) {
      const id = req.type === "prompt" ? req.id : "setModes";
      writeEvent({ type: "error", id, message: err instanceof Error ? err.message : String(err) });
    }
  }
}

// Only run the stdio loop when executed directly (not when imported by tests).
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error("[sidecar] fatal:", err);
    process.exit(1);
  });
}
