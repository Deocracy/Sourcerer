// Spike 003: lean-prompt-modes
// A mode registry: each mode = prompt fragment + tool pack. Toggling a mode at runtime
// swaps active tools (setActiveToolsByName) and recomposes the system prompt (reload()).
// Validates: baseline stays lean; capability is opt-in, not an always-on mega-prompt.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "typebox";
import {
  createAgentSession,
  defineTool,
  SessionManager,
  DefaultResourceLoader,
  createReadTool,
  createGrepTool,
} from "@earendil-works/pi-coding-agent";
import { getModel } from "@earendil-works/pi-ai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4803;
const DB_BASE = "http://localhost:9621";

const EVENTS = [];
const log = (cat, data) => EVENTS.push({ ts: new Date().toISOString(), cat, data });

const envText = fs.readFileSync("D:/Vibe Coding/Databasise/runtime/.env", "utf8");
process.env.CEREBRAS_API_KEY = envText.match(/^LLM_BINDING_API_KEY=(.+)$/m)[1].trim();

// ---- custom tools -------------------------------------------------------------
const notebook = [];
const saveNote = defineTool({
  name: "save_note", label: "Save Note", description: "Save a short note to the notebook.",
  parameters: Type.Object({ text: Type.String() }),
  async execute(_id, p) {
    notebook.push(p.text);
    log("tool", { tool: "save_note", text: p.text });
    return { content: [{ type: "text", text: `Saved note #${notebook.length}` }], details: {} };
  },
});
const listNotes = defineTool({
  name: "list_notes", label: "List Notes", description: "List all saved notes.",
  parameters: Type.Object({}),
  async execute() {
    log("tool", { tool: "list_notes" });
    return { content: [{ type: "text", text: notebook.length ? notebook.map((n, i) => `${i + 1}. ${n}`).join("\n") : "(no notes)" }], details: {} };
  },
});
const restTool = (name, method, apiPath, params, desc) => defineTool({
  name, label: name, description: desc,
  parameters: Type.Object(params),
  async execute(_id, p) {
    const qp = new URLSearchParams(Object.entries(p || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
    log("tool", { tool: name, params: p });
    const res = await fetch(`${DB_BASE}${apiPath}${qp.size ? "?" + qp : ""}`, { method, signal: AbortSignal.timeout(240000) });
    const text = await res.text();
    return { content: [{ type: "text", text: `HTTP ${res.status}\n${text.slice(0, 4000)}` }], details: {} };
  },
});
const wikiResolve = restTool("wiki_resolve", "POST", "/wiki/resolve",
  { canonical_id: Type.String({ description: "Entity name, e.g. 'Deocracy'" }) },
  "Compose the canonical wiki view of one entity from Databasise.");
const wikiUnresolved = restTool("wiki_unresolved", "GET", "/wiki/unresolved", {}, "List open contradictions in the wiki.");

// ---- the mode registry ----------------------------------------------------------
// ponytail: a plain object + a Set of active keys. No plugin framework.
const BASE_PROMPT = "You are the Sourcerer Dashboard Assistant — a life-information control hub. Be concise. Only capabilities from currently-enabled modes are available.";
const MODES = {
  research: {
    label: "Research (Databasise wiki)",
    prompt: "RESEARCH MODE: You can consult the user's Databasise wiki. wiki_resolve(canonical_id) for one entity's canonical view; wiki_unresolved for open contradictions.",
    tools: ["wiki_resolve", "wiki_unresolved"],
  },
  notes: {
    label: "Notes",
    prompt: "NOTES MODE: Capture and recall the user's notes with save_note / list_notes.",
    tools: ["save_note", "list_notes"],
  },
  coding: {
    label: "Coding (pi built-ins)",
    prompt: "CODING MODE: You may read files (read) and search code (grep) under the current project when asked.",
    tools: ["read", "grep"],
  },
};
const active = new Set(["notes"]); // start minimal

const composePrompt = () =>
  [BASE_PROMPT, ...[...active].map((k) => MODES[k].prompt), `Today: ${new Date().toISOString().slice(0, 10)}.`].join("\n\n");
const activeToolNames = () => [...active].flatMap((k) => MODES[k].tools);

// ---- session ----------------------------------------------------------------------
const agentDir = path.join(__dirname, ".pi-agent");
fs.mkdirSync(agentDir, { recursive: true });
const resourceLoader = new DefaultResourceLoader({
  cwd: __dirname, agentDir,
  systemPromptOverride: () => composePrompt(), // re-read on session.reload()
  noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
});
const model = getModel("cerebras", "gpt-oss-120b");
const cwd = __dirname;
const { session } = await createAgentSession({
  cwd, agentDir, model,
  // LANDMINE (found live): a `tools:` allowlist at creation permanently filters the
  // registry — setActiveToolsByName can never re-enable tools outside it. Register
  // everything (noTools:"builtin" keeps custom tools, drops built-in read/bash/edit/write)
  // and control the ACTIVE set below instead.
  noTools: "builtin",
  customTools: [saveNote, listNotes, wikiResolve, wikiUnresolved, createReadTool(cwd), createGrepTool(cwd)],
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
});
session.setActiveToolsByName(activeToolNames());
const promptStats = () => ({ chars: session.systemPrompt.length, tokensApprox: Math.round(session.systemPrompt.length / 4) });
log("boot", { model: `${model.provider}/${model.id}`, active: [...active], ...promptStats() });
console.log(`[spike] boot modes=${[...active]} prompt=${JSON.stringify(promptStats())}`);

async function setModes(keys) {
  active.clear();
  for (const k of keys) if (MODES[k]) active.add(k);
  await session.reload(); // re-reads systemPromptOverride (mode fragments)
  session.setActiveToolsByName(activeToolNames()); // then narrow active tools + rebuild prompt
  log("mode", { active: [...active], tools: activeToolNames(), ...promptStats() });
  return { active: [...active], tools: activeToolNames(), ...promptStats() };
}

// ---- SSE + HTTP ---------------------------------------------------------------------
const sseClients = new Set();
const broadcast = (obj) => { const l = `data: ${JSON.stringify(obj)}\n\n`; for (const r of sseClients) r.write(l); };
session.subscribe((event) => {
  if (event.type === "message_update") {
    const e = event.assistantMessageEvent;
    if (e.type === "text_delta") broadcast({ type: "text_delta", delta: e.delta });
  } else if (event.type === "tool_execution_start") broadcast({ type: "tool_start", tool: event.toolName });
  else if (event.type === "tool_execution_end") broadcast({ type: "tool_end", tool: event.toolName, isError: !!event.isError });
});

let busy = false;
http.createServer((req, res) => {
  const json = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj, null, 2)); };
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(fs.readFileSync(path.join(__dirname, "index.html")));
  } else if (req.method === "GET" && req.url === "/events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    res.write("\n");
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
  } else if (req.method === "GET" && req.url === "/state") {
    json(200, { model: `${model.provider}/${model.id}`, modes: Object.fromEntries(Object.entries(MODES).map(([k, m]) => [k, { label: m.label, on: active.has(k), tools: m.tools }])), activeTools: activeToolNames(), prompt: promptStats(), notebook, busy });
  } else if (req.method === "GET" && req.url === "/log") {
    const counts = {};
    for (const e of EVENTS) counts[e.cat] = (counts[e.cat] || 0) + 1;
    json(200, { summary: { total: EVENTS.length, counts }, events: EVENTS });
  } else if (req.method === "POST" && req.url === "/modes") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => json(200, await setModes(JSON.parse(body).active)));
  } else if (req.method === "POST" && req.url === "/chat") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      const { message } = JSON.parse(body);
      if (busy) return json(409, { error: "busy" });
      busy = true;
      log("user", { message });
      json(202, { ok: true });
      try { await session.prompt(message); }
      catch (err) { log("error", { message: String(err) }); broadcast({ type: "error", message: String(err) }); }
      finally { busy = false; broadcast({ type: "done" }); }
    });
  } else { res.writeHead(404); res.end(); }
}).listen(PORT, () => console.log(`[spike] http://localhost:${PORT}`));
