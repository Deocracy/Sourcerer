// Spike 002: databasise-tools-over-pi
// Auto-generates Pi tools from Databasise's live /openapi.json (whitelisted subset),
// registers them in a headless AgentSession, and serves the same chat UI as spike 001.
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
} from "@earendil-works/pi-coding-agent";
import { getModel } from "@earendil-works/pi-ai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4802;
const DB_BASE = "http://localhost:9621";

const EVENTS = [];
const log = (cat, data) => EVENTS.push({ ts: new Date().toISOString(), cat, data });

const envText = fs.readFileSync("D:/Vibe Coding/Databasise/runtime/.env", "utf8");
process.env.CEREBRAS_API_KEY = envText.match(/^LLM_BINDING_API_KEY=(.+)$/m)[1].trim();

// ---- auto-generate Pi tools from Databasise's OpenAPI spec ----------------------
// Whitelist: the read-side wiki/search surface. Scales to the full 40-tool surface
// by widening this list — nothing else changes.
const WHITELIST = [
  { method: "post", path: "/wiki/resolve", name: "wiki_resolve" },
  { method: "get", path: "/wiki/unresolved", name: "wiki_unresolved" },
  { method: "get", path: "/wiki/unplaced", name: "wiki_unplaced" },
  { method: "post", path: "/query", name: "kb_query" },
];

const spec = await (await fetch(`${DB_BASE}/openapi.json`)).json();

function paramSchemaToTypebox(p) {
  const t = p.schema?.type;
  const opts = { description: p.description || p.schema?.description || "" };
  const base = t === "integer" || t === "number" ? Type.Number(opts) : Type.String(opts);
  return p.required ? base : Type.Optional(base);
}

function makeToolFromOpenapi({ method, path: apiPath, name }) {
  const op = spec.paths[apiPath]?.[method];
  if (!op) throw new Error(`No ${method} ${apiPath} in openapi spec`);

  const props = {};
  for (const p of op.parameters || []) {
    if (p.in === "query") props[p.name] = paramSchemaToTypebox(p);
  }
  // JSON request body → pull top-level properties from the referenced schema
  const bodyRef = op.requestBody?.content?.["application/json"]?.schema;
  const bodySchema = bodyRef?.$ref ? spec.components.schemas[bodyRef.$ref.split("/").pop()] : bodyRef;
  const bodyProps = new Set();
  if (bodySchema?.properties) {
    for (const [k, v] of Object.entries(bodySchema.properties)) {
      if (k === "query" || k === "mode") { // ponytail: only surface the two params the model needs
        bodyProps.add(k);
        const req = bodySchema.required?.includes(k);
        const base = Type.String({ description: (v.description || "").slice(0, 200) });
        props[k] = req ? base : Type.Optional(base);
      }
    }
  }

  return defineTool({
    name,
    label: name,
    description: `${op.summary || op.description || apiPath} (Databasise ${method.toUpperCase()} ${apiPath})`.slice(0, 300),
    parameters: Type.Object(props),
    async execute(_id, params) {
      const qp = new URLSearchParams();
      const body = {};
      for (const [k, v] of Object.entries(params || {})) {
        if (v === undefined) continue;
        if (bodyProps.has(k)) body[k] = v;
        else qp.set(k, String(v));
      }
      const url = `${DB_BASE}${apiPath}${qp.size ? "?" + qp : ""}`;
      log("tool", { tool: name, url, body: bodyProps.size ? body : undefined });
      const res = await fetch(url, {
        method: method.toUpperCase(),
        headers: { "content-type": "application/json" },
        body: bodyProps.size && Object.keys(body).length ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(240000),
      });
      const text = await res.text();
      log("tool-result", { tool: name, status: res.status, bytes: text.length });
      return { content: [{ type: "text", text: `HTTP ${res.status}\n${text.slice(0, 4000)}` }], details: { status: res.status } };
    },
  });
}

const dbTools = WHITELIST.map(makeToolFromOpenapi);
console.log(`[spike] generated ${dbTools.length} Pi tools from openapi.json: ${dbTools.map((t) => t.name).join(", ")}`);

// ---- lean session ----------------------------------------------------------------
const LEAN_PROMPT = `You are the Sourcerer Dashboard Assistant, connected to the user's Databasise wiki (source-of-truth knowledge engine).
Tools: wiki_resolve(canonical_id) composes the canonical view of one entity; wiki_unresolved lists open contradictions; wiki_unplaced lists off-vocabulary captures; kb_query(query, mode) asks the RAG engine (mode: hybrid|local|global).
Entity canonical_ids are plain names like "Deocracy". Be concise; report what the tools actually return, including empty results.`;

const agentDir = path.join(__dirname, ".pi-agent");
fs.mkdirSync(agentDir, { recursive: true });
const resourceLoader = new DefaultResourceLoader({
  cwd: __dirname, agentDir,
  systemPrompt: LEAN_PROMPT,
  noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
});
const model = getModel("cerebras", "gpt-oss-120b");
const { session } = await createAgentSession({
  cwd: __dirname, agentDir, model,
  tools: dbTools.map((t) => t.name), // landmine from spike 001: explicit allowlist, never noTools:"all"
  customTools: dbTools,
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
});
log("boot", { model: `${model.provider}/${model.id}`, tools: dbTools.map((t) => t.name), systemPromptChars: session.systemPrompt.length });
console.log(`[spike] system prompt: ${session.systemPrompt.length} chars (~${Math.round(session.systemPrompt.length / 4)} tokens)`);

// ---- SSE + HTTP (same shape as spike 001) ------------------------------------------
const sseClients = new Set();
const broadcast = (obj) => { const l = `data: ${JSON.stringify(obj)}\n\n`; for (const r of sseClients) r.write(l); };

session.subscribe((event) => {
  switch (event.type) {
    case "message_update": {
      const e = event.assistantMessageEvent;
      if (e.type === "text_delta") broadcast({ type: "text_delta", delta: e.delta });
      break;
    }
    case "tool_execution_start":
      log("agent", { event: event.type, tool: event.toolName });
      broadcast({ type: "tool_start", tool: event.toolName });
      break;
    case "tool_execution_end":
      log("agent", { event: event.type, tool: event.toolName, isError: event.isError });
      broadcast({ type: "tool_end", tool: event.toolName, isError: !!event.isError });
      break;
    default:
      log("agent", { event: event.type });
  }
});

let busy = false;
http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(fs.readFileSync(path.join(__dirname, "index.html")));
  } else if (req.method === "GET" && req.url === "/events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    res.write("\n");
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
  } else if (req.method === "GET" && req.url === "/state") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ model: `${model.provider}/${model.id}`, tools: dbTools.map((t) => t.name), systemPromptChars: session.systemPrompt.length, systemPromptTokensApprox: Math.round(session.systemPrompt.length / 4), busy }));
  } else if (req.method === "GET" && req.url === "/log") {
    const counts = {};
    for (const e of EVENTS) counts[e.cat] = (counts[e.cat] || 0) + 1;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ summary: { total: EVENTS.length, counts }, events: EVENTS }, null, 2));
  } else if (req.method === "POST" && req.url === "/chat") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      const { message } = JSON.parse(body);
      if (busy) { res.writeHead(409); return res.end("{\"error\":\"busy\"}"); }
      busy = true;
      log("user", { message });
      res.writeHead(202, { "content-type": "application/json" });
      res.end("{\"ok\":true}");
      try { await session.prompt(message); }
      catch (err) { log("error", { message: String(err) }); broadcast({ type: "error", message: String(err) }); }
      finally { busy = false; broadcast({ type: "done" }); }
    });
  } else { res.writeHead(404); res.end(); }
}).listen(PORT, () => console.log(`[spike] http://localhost:${PORT}`));
