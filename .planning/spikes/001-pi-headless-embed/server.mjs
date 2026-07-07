// Spike 001: pi-headless-embed
// Embeds pi's AgentSession headless in a Node sidecar (the shape a Tauri host.ai() proxy takes),
// streams events to a browser chat page over SSE, with a forensic event log at /log.
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
const PORT = 4801;

// ---- forensic log -----------------------------------------------------------
const EVENTS = [];
function log(cat, data) {
  EVENTS.push({ ts: new Date().toISOString(), cat, data });
}

// ---- runtime config: borrow the Databasise Cerebras key (never printed) ------
const envText = fs.readFileSync("D:/Vibe Coding/Databasise/runtime/.env", "utf8");
const apiKey = envText.match(/^LLM_BINDING_API_KEY=(.+)$/m)?.[1]?.trim();
if (!apiKey) throw new Error("No LLM_BINDING_API_KEY found in Databasise runtime .env");
process.env.CEREBRAS_API_KEY = apiKey;
log("boot", { keySource: "Databasise runtime .env", provider: "cerebras" });

// ---- lean system prompt (the whole point: no 22k coding prompt) --------------
const LEAN_PROMPT = `You are the Sourcerer Dashboard Assistant — a research and life-information hub, not a coding agent.
Be concise. When the user asks you to remember something, use the save_note tool.
Today's date: ${new Date().toISOString().slice(0, 10)}.`;

// ---- one custom tool, life-hub flavored --------------------------------------
const notebook = [];
const saveNote = defineTool({
  name: "save_note",
  label: "Save Note",
  description: "Save a short note to the user's Sourcerer notebook.",
  parameters: Type.Object({ text: Type.String({ description: "The note text to save" }) }),
  async execute(_id, params) {
    notebook.push(params.text);
    log("tool", { tool: "save_note", text: params.text, notebookSize: notebook.length });
    return {
      content: [{ type: "text", text: `Saved. Notebook now has ${notebook.length} note(s).` }],
      details: { count: notebook.length },
    };
  },
});

// ---- headless session ---------------------------------------------------------
const cwd = __dirname;
const agentDir = path.join(__dirname, ".pi-agent"); // spike-local, don't touch ~/.pi
fs.mkdirSync(agentDir, { recursive: true });

const resourceLoader = new DefaultResourceLoader({
  cwd,
  agentDir,
  systemPrompt: LEAN_PROMPT,
  noExtensions: true,
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
  noContextFiles: true,
});

const model = getModel("cerebras", "gpt-oss-120b");
const { session } = await createAgentSession({
  cwd,
  agentDir,
  model,
  tools: ["save_note"],
  customTools: [saveNote],
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
});
log("boot", {
  model: `${model.provider}/${model.id}`,
  systemPromptChars: session.systemPrompt.length,
  systemPromptTokensApprox: Math.round(session.systemPrompt.length / 4),
});
console.log(`[spike] system prompt: ${session.systemPrompt.length} chars (~${Math.round(session.systemPrompt.length / 4)} tokens)`);

// ---- SSE fan-out ----------------------------------------------------------------
const sseClients = new Set();
function broadcast(obj) {
  const line = `data: ${JSON.stringify(obj)}\n\n`;
  for (const res of sseClients) res.write(line);
}

session.subscribe((event) => {
  switch (event.type) {
    case "message_update": {
      const e = event.assistantMessageEvent;
      if (e.type === "text_delta") broadcast({ type: "text_delta", delta: e.delta });
      if (e.type === "thinking_delta") broadcast({ type: "thinking_delta", delta: e.delta });
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
    case "agent_start":
    case "agent_end":
    case "turn_start":
    case "turn_end":
      log("agent", { event: event.type });
      broadcast({ type: event.type });
      break;
    default:
      log("agent-other", { event: event.type });
  }
});

// ---- HTTP server ------------------------------------------------------------------
let busy = false;
const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(fs.readFileSync(path.join(__dirname, "index.html")));
  } else if (req.method === "GET" && req.url === "/events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    res.write("\n");
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
  } else if (req.method === "GET" && req.url === "/state") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      model: `${model.provider}/${model.id}`,
      systemPromptChars: session.systemPrompt.length,
      systemPromptTokensApprox: Math.round(session.systemPrompt.length / 4),
      notebook,
      busy,
    }));
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
      if (busy) {
        res.writeHead(409, { "content-type": "application/json" });
        return res.end(JSON.stringify({ error: "busy" }));
      }
      busy = true;
      log("user", { message });
      res.writeHead(202, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      try {
        await session.prompt(message);
      } catch (err) {
        log("error", { message: String(err) });
        broadcast({ type: "error", message: String(err) });
      } finally {
        busy = false;
        broadcast({ type: "done" });
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => console.log(`[spike] http://localhost:${PORT} — chat UI, /state, /log`));
