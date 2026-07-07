// Spike 004: omp-component-harvest
// Proves an OMP component (mnemopi, the SQLite memory engine) runs behind plain Pi:
// mnemopi lives in a tiny Bun sidecar (memory-service.ts in the oh-my-pi clone),
// and Pi sees it as remember/recall tools — same projection pattern as Databasise.
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
const PORT = 4804;
const MEM = "http://localhost:4899";

const EVENTS = [];
const log = (cat, data) => EVENTS.push({ ts: new Date().toISOString(), cat, data });

const envText = fs.readFileSync("D:/Vibe Coding/Databasise/runtime/.env", "utf8");
process.env.CEREBRAS_API_KEY = envText.match(/^LLM_BINDING_API_KEY=(.+)$/m)[1].trim();

const memCall = async (p, body) => {
  const res = await fetch(MEM + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  return { status: res.status, json: await res.json() };
};

const remember = defineTool({
  name: "remember", label: "Remember",
  description: "Store a fact in the user's long-term memory (persists across sessions).",
  parameters: Type.Object({ content: Type.String({ description: "The fact to remember" }) }),
  async execute(_id, p) {
    const r = await memCall("/remember", { content: p.content });
    log("tool", { tool: "remember", content: p.content, status: r.status });
    return { content: [{ type: "text", text: JSON.stringify(r.json) }], details: {} };
  },
});
const recall = defineTool({
  name: "recall", label: "Recall",
  description: "Search the user's long-term memory for relevant facts.",
  parameters: Type.Object({ query: Type.String({ description: "What to look for" }) }),
  async execute(_id, p) {
    const r = await memCall("/recall", { query: p.query, limit: 5 });
    log("tool", { tool: "recall", query: p.query, hits: r.json.results?.length });
    return { content: [{ type: "text", text: JSON.stringify(r.json, null, 1).slice(0, 3000) }], details: {} };
  },
});

const agentDir = path.join(__dirname, ".pi-agent");
fs.mkdirSync(agentDir, { recursive: true });
const resourceLoader = new DefaultResourceLoader({
  cwd: __dirname, agentDir,
  systemPrompt: "You are the Sourcerer assistant with long-term memory (MEMORY MODE). Use remember to store durable facts the user tells you; use recall before answering questions about the user's life, projects, or preferences. Be concise.",
  noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
});
const model = getModel("cerebras", "gpt-oss-120b");
const { session } = await createAgentSession({
  cwd: __dirname, agentDir, model,
  noTools: "builtin",
  customTools: [remember, recall],
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
});
session.setActiveToolsByName(["remember", "recall"]);
console.log(`[spike] system prompt: ~${Math.round(session.systemPrompt.length / 4)} tokens`);

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
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(fs.readFileSync(path.join(__dirname, "index.html")));
  } else if (req.method === "GET" && req.url === "/events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    res.write("\n");
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
  } else if (req.method === "GET" && req.url === "/state") {
    const chars = session.systemPrompt.length;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ model: "cerebras/gpt-oss-120b", systemPromptChars: chars, systemPromptTokensApprox: Math.round(chars / 4) }));
  } else if (req.method === "GET" && req.url === "/log") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ events: EVENTS }, null, 2));
  } else if (req.method === "POST" && req.url === "/chat") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      const { message } = JSON.parse(body);
      if (busy) { res.writeHead(409); return res.end("{}"); }
      busy = true;
      log("user", { message });
      res.writeHead(202); res.end("{}");
      try { await session.prompt(message); }
      catch (err) { broadcast({ type: "error", message: String(err) }); }
      finally { busy = false; broadcast({ type: "done" }); }
    });
  } else { res.writeHead(404); res.end(); }
}).listen(PORT, () => console.log(`[spike] http://localhost:${PORT}`));
