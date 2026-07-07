// Isolate: what events fire, what does the model actually say, does the tool run?
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "typebox";
import { createAgentSession, defineTool, SessionManager, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";
import { getModel } from "@earendil-works/pi-ai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envText = fs.readFileSync("D:/Vibe Coding/Databasise/runtime/.env", "utf8");
process.env.CEREBRAS_API_KEY = envText.match(/^LLM_BINDING_API_KEY=(.+)$/m)[1].trim();

const notebook = [];
const saveNote = defineTool({
  name: "save_note", label: "Save Note",
  description: "Save a short note to the user's Sourcerer notebook.",
  parameters: Type.Object({ text: Type.String() }),
  async execute(_id, params) {
    notebook.push(params.text);
    console.log(">>> TOOL EXECUTED:", params.text);
    return { content: [{ type: "text", text: `Saved note #${notebook.length}` }], details: {} };
  },
});

const agentDir = path.join(__dirname, ".pi-agent");
const resourceLoader = new DefaultResourceLoader({
  cwd: __dirname, agentDir,
  systemPrompt: "You are the Sourcerer assistant. When asked to remember something, call the save_note tool.",
  noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
});
const { session } = await createAgentSession({
  cwd: __dirname, agentDir,
  model: getModel("cerebras", "gpt-oss-120b"),
  tools: ["save_note"], customTools: [saveNote],
  sessionManager: SessionManager.inMemory(), resourceLoader,
});

session.subscribe((e) => {
  if (e.type === "message_update") {
    const me = e.assistantMessageEvent;
    if (me.type === "text_delta") process.stdout.write(me.delta);
    else if (!/delta/.test(me.type)) console.log(`\n[msg-ev] ${me.type}`);
  } else console.log(`\n[ev] ${e.type}${e.toolName ? " tool=" + e.toolName : ""}`);
});

await session.prompt("Remember that my IRB deadline is Friday.");
console.log("\n--- final messages ---");
for (const m of session.messages) {
  const parts = (Array.isArray(m.content) ? m.content : [m.content]).map(c =>
    typeof c === "string" ? c : c.type === "text" ? c.text : `[${c.type}${c.name ? ":" + c.name : ""}]`).join(" | ");
  console.log(`${m.role}: ${String(parts).slice(0, 200)}`);
}
console.log("notebook:", JSON.stringify(notebook));
process.exit(0);
