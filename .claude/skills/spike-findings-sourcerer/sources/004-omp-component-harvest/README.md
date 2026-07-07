---
spike: 004
name: omp-component-harvest
type: standard
validates: "Given OMP's codebase, when one useful component is extracted and run under plain Pi, then it works standalone — plus a liftable-components list with license/coupling notes"
verdict: VALIDATED
related: [001, 002, 003]
tags: [omp, extensions, harvest, mnemopi, memory]
---

# Spike 004: OMP Component Harvest

## What This Validates

OMP (Oh-My-Pi) ships useful components beyond its coding-agent prompt. Can we **lift one out** and run it under plain Pi without adopting the whole OMP harness? If yes, the "lean Pi core + cherry-pick OMP parts" hypothesis (see MANIFEST) holds.

Component harvested: **`@oh-my-pi/pi-mnemopi`** — OMP's SQLite-backed long-term memory engine (`remember` / `recall` / `getStats`). This is exactly the kind of capability Sourcerer's Dashboard Assistant wants (durable cross-session memory of the user's life/projects) and it is NOT coding-specific.

## Result — VALIDATED

The component runs standalone behind plain Pi using the **same sidecar-projection pattern as spike 002** (external service → Pi custom tools → chat turn):

- `memory-service.ts` — a ~30-line **Bun** HTTP sidecar wrapping `new Mnemopi({ dbPath, bank })` on `:4899` (`/remember`, `/recall`, `/stats`).
- `server.mjs` — plain Pi (`@earendil-works/pi-coding-agent`, `noExtensions/noSkills`, builtin tools off) exposing `remember`/`recall` custom tools that proxy the sidecar, on `:4804`.

**End-to-end evidence** (forensic `/log`):
```
user: "How do I take my coffee? Check your memory."
tool: recall  query="coffee"  hits=1
answer: "Based on what's stored in your memory, you take your coffee black."
```
- Standalone service: `remember` returns ids, `recall` returns ranked hits, `getStats` reports `mode:"beam"`, `total_memories:2`.
- Pi system prompt with memory mode on: **~414 tokens** — reinforces the lean-baseline thesis (003).

## Liftable OMP Components (license / coupling notes)

`pi-mnemopi` is **MIT** licensed. Coupling assessment for lifting it into Sourcerer:

| Aspect | Finding |
|--------|---------|
| **License** | MIT — clean to vendor or depend on directly. |
| **Runtime** | Ships `.ts` source as its entry (`"import": "./src/index.ts"`) — **requires Bun** (or a TS loader). Node `require`/`import` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`. This is why the memory sidecar is Bun and the Pi harness is Node — they talk over HTTP, so the Bun requirement stays isolated to the sidecar. |
| **Deps it drags in** | Only OMP siblings `pi-ai`, `pi-catalog`, `pi-utils` + `lru-cache`. Total footprint ~1.1 MB. No coding-agent, no TUI, no OMP prompt. |
| **Native deps** | `fastembed` + `onnxruntime-node` are **optional peer deps** (local vector embeddings). We ran WITHOUT them: recall worked in `beam` mode via lexical/FTS ranking, zero native compilation. Semantic recall would need onnxruntime; lexical recall is native-dep-free. |
| **API** | `Mnemopi.remember(str, {source, importance}) → id` (sync); `.recall(query, topK=5) → Promise<RecallResult[]>` (async); `.getStats() → stats`. Module also exports functional `remember`/`recall`/`getStats` facades. |

**Other OMP components worth harvesting later** (not extracted here — YAGNI until needed): `pi-mnemopi/mcp` exports mnemopi as MCP tools directly (could skip the sidecar entirely if Sourcerer speaks MCP to it); `@oh-my-pi/pi-catalog` (model catalog) is already an implicit dep.

## How to Reproduce

```
# 1. install the harvested component (no oh-my-pi clone needed — it's on npm)
npm install @oh-my-pi/pi-mnemopi

# 2. memory sidecar (Bun)
bun memory-service.ts            # :4899

# 3. Pi harness (Node) — reads Cerebras key from Databasise runtime/.env
node server.mjs                  # :4804  → open in browser, chat
```

## Landmines

- **mnemopi is Bun-only at the source-entry level.** Don't try to `import` it from the Node Pi process; keep it behind an HTTP (or MCP) boundary.
- `recall()` is **async** — must be awaited (initial crash-draft of `memory-service.ts` returned the un-awaited promise as `{}`). Stats method is `getStats()`, not `stats()`.
- Semantic (vector) recall silently degrades to lexical if `onnxruntime-node`/`fastembed` aren't installed — fine for a spike, but budget the native dep if Sourcerer wants embedding-quality recall.

## Bearing on the Decision

Confirms the MANIFEST hypothesis: **Pi stays the lean core; OMP is a parts bin.** A high-value OMP capability (persistent memory) lifts cleanly under MIT with minimal coupling and projects through the exact tool pattern already proven for Databasise (002). Sourcerer can adopt OMP memory without adopting OMP's harness or its 22k-token coding prompt.
