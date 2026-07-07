// Spike 004 harness: expose OMP's mnemopi memory engine as a tiny HTTP service (Bun).
// Run: bun memory-service.ts  (pi-mnemopi installed as a normal dep — no oh-my-pi clone needed)
import { Mnemopi } from "@oh-my-pi/pi-mnemopi";

const DB = "D:/Vibe Coding/Sourcerer/.planning/spikes/004-omp-component-harvest/mnemopi.db";
const memory = new Mnemopi({ dbPath: DB, bank: "sourcerer" });

Bun.serve({
  port: 4899,
  async fetch(req) {
    const url = new URL(req.url);
    const json = (o: unknown, code = 200) => new Response(JSON.stringify(o), { status: code, headers: { "content-type": "application/json" } });
    try {
      if (req.method === "POST" && url.pathname === "/remember") {
        const { content, importance } = await req.json();
        const id = memory.remember(content, { source: "sourcerer-chat", importance: importance ?? 0.6 });
        return json({ id });
      }
      if (req.method === "POST" && url.pathname === "/recall") {
        const { query, limit } = await req.json();
        const results = await memory.recall(query, limit ?? 5); // recall() is async
        return json({ results });
      }
      if (url.pathname === "/stats") return json(await memory.getStats());
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  },
});
console.log("[mnemopi-service] http://localhost:4899  db=" + DB);
