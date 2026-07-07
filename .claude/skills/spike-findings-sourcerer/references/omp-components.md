# Harvesting OMP Components (Memory)

How to lift a useful OMP (Oh-My-Pi) component under plain Pi without adopting OMP's
harness or its 16k–35k-token orchestration prompt. Proven in spike 004 (mnemopi memory).

## Requirements (non-negotiable — from MANIFEST)

- **Pi stays the lean core; OMP is a parts bin.** Adopt components, never the harness (confirmed by spike 005: OMP's weight is 17 always-on tool schemas + notices).
- Durable cross-session memory of the user's life/projects is a wanted Dashboard Assistant capability.

## How to Build It

The harvested component runs standalone behind plain Pi using the **same sidecar-projection
pattern as Databasise** (external service → Pi custom tools → chat turn).

**1. Run the OMP component as a small sidecar.** `@oh-my-pi/pi-mnemopi` (MIT) ships `.ts`
source as its entry (`"import": "./src/index.ts"`) → **Bun-only**; Node `import` fails with
`ERR_PACKAGE_PATH_NOT_EXPORTED`. Keep it behind an HTTP (or MCP) boundary so the Bun
requirement stays isolated to the sidecar while the Pi harness stays Node.

```ts
// memory-service.ts  — run with:  bun memory-service.ts   (:4899)
import { Mnemopi } from "@oh-my-pi/pi-mnemopi";
const mem = new Mnemopi({ dbPath: "./mnemopi.db", bank: "default" });
// POST /remember {text, source, importance} -> mem.remember(text, {source, importance})  (sync, returns id)
// POST /recall   {query, topK}              -> await mem.recall(query, topK)              (ASYNC, returns ranked hits)
// GET  /stats                               -> mem.getStats()                             (NOT stats())
```

**2. Project it into Pi as custom tools** (`remember`/`recall`) that proxy the sidecar —
exactly the `defineTool` + `fetch` shape from databasise-tools.md. Register them in a
memory mode (see harness-embedding.md mode registry).

**3. Or skip the sidecar entirely if Sourcerer speaks MCP** — `pi-mnemopi/mcp` exports
mnemopi as MCP tools directly.

## What to Avoid

- **Don't `import` mnemopi from the Node Pi process** — it's Bun-only at the source entry. HTTP/MCP boundary only.
- **`recall()` is async** — must be awaited (an un-awaited promise returns `{}`). Stats is `getStats()`, not `stats()`.
- **Semantic recall silently degrades to lexical** if `onnxruntime-node`/`fastembed` (optional peer deps) aren't installed. Lexical/FTS `beam` mode is native-dep-free and worked fine; budget the native dep only if you want embedding-quality recall.
- Don't adopt OMP's harness to get its parts — you'd inherit the 16k–35k-token baseline (spike 005).

## Constraints

- `@oh-my-pi/pi-mnemopi@^16` is **MIT** — clean to vendor or depend on.
- Drags only OMP siblings `pi-ai`, `pi-catalog`, `pi-utils` + `lru-cache` (~1.1 MB). No coding-agent, no TUI, no OMP prompt.
- API: `remember(str, {source, importance}) → id` (sync); `recall(query, topK=5) → Promise<RecallResult[]>` (async); `getStats() → stats`. Functional facades also exported.
- Other liftable OMP parts (YAGNI until needed): `pi-catalog` (model catalog, already an implicit dep).

## Origin

Synthesized from spikes: 004
Source files: sources/004-omp-component-harvest/
