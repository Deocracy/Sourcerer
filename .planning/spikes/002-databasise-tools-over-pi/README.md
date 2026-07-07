---
spike: 002
name: databasise-tools-over-pi
type: standard
validates: "Given Databasise's MCP/REST surface, when its tools are registered in the Pi harness, then a chat turn resolves a real wiki/search query end-to-end"
verdict: VALIDATED
related: [001]
tags: [pi, databasise, openapi, tools, rest]
---

# Spike 002: Databasise Tools over Pi

## What This Validates

Given Databasise's REST surface, when its endpoints are registered as Pi tools, then a chat turn resolves real wiki/search queries end-to-end — including honest reporting of empty results.

## Research

- Databasise's wiki REST lives in the fork's `version_routes.py`: `POST /wiki/resolve` (query params `canonical_id`, `as_of`), `GET /wiki/unresolved`, `GET /wiki/unplaced`, vocab routes, plus the RAG surface `POST /query`.
- Pi has **no built-in MCP support** (deliberate anti-framework philosophy) — so the bridge is either REST adapters or an MCP-client extension. Chosen: **auto-generate Pi tools from the live `/openapi.json`** (Phase-3 precedent: "regen client from /openapi.json"). Scales to the 40-tool surface by widening a whitelist.
- MCP-bridge variant (via `@modelcontextprotocol/sdk` client → `defineTool` adapters) remains viable for agent-facing parity but was not needed to answer this spike's question.

| Approach | Pros | Cons | Status |
|----------|------|------|--------|
| OpenAPI → defineTool generator | Zero hand-written adapters; always in sync with server | Needs param-mapping logic (query vs body) | **Chosen** |
| Hand-written REST adapters | Simple | 40 tools = 40 maintenance points | Rejected |
| MCP client bridge | Reuses sourcerer_mcp surface | Extra process + protocol layer Pi doesn't natively speak | Deferred (viable) |

## How to Run

```bash
# 1. Start Databasise against the populated store (from D:\Vibe Coding\Databasise\runtime):
#    WORKING_DIR=./rag_storage ../sourcerer-venv/Scripts/python.exe ../sourcerer-lightrag/sourcerer.py
# 2. Then:
cd .planning/spikes/002-databasise-tools-over-pi
node server.mjs
# open http://localhost:4802 — ask: "Resolve the entity Deocracy and check for contradictions"
```

## What to Expect

- Boot prints `generated 4 Pi tools from openapi.json: wiki_resolve, wiki_unresolved, wiki_unplaced, kb_query` and a ~417-token system prompt.
- Asking about an entity fires up to 3 wiki tools in one turn (visible as chips) and reports exactly what came back.
- `kb_query` returns a full cited RAG answer (references include `Deocracy Wiki Define 104.pdf`).

## Observability

Forensic log at `/log` records every generated-tool HTTP call (URL, body, status, response bytes) plus agent events. `sse-check.mjs` prints one turn's event histogram.

## Investigation Trail

1. Databasise server was down; the old `Start-Sourcerer.ps1` targets the Phase-1 upstream venv. Launched the real entrypoint instead: `sourcerer-lightrag/sourcerer.py` under `sourcerer-venv` from the `runtime/` cwd.
2. **Empty graph surprise:** `sourcerer.py` defaults its store to `./sourcerer_data/` — the populated store (1.9 MB Cozo + Faiss, 112 entities) is `./rag_storage/`. Fixed with `WORKING_DIR=./rag_storage` env override.
3. Auth: `combined_auth` passes unauthenticated in this config (guest mode) — no key plumbing needed for the spike; the real build must revisit.
4. `/wiki/resolve` uses **query params**, not a JSON body (OpenAPI shows no requestBody) — the generator maps `parameters[in=query]` → query string and body-schema properties → JSON body, which handled all four endpoints.
5. `/wiki/preview` is an **edit preview** (requires `attribute` + `new_value`), not a page renderer — excluded from the read whitelist.
6. First `/query` attempts returned `no_results` / `[no-context]` (off-corpus phrasing + cold start; Voyage key verified alive by direct API call). A corpus-relevant question through the Pi tool later returned a full cited answer — the connection path was never the problem.
7. E2E turn 1: model called `wiki_resolve` + `wiki_unresolved` + `wiki_unplaced` in one turn, reported empty attributes/lists **honestly** (no hallucinated wiki content).
8. E2E turn 2: `kb_query` (POST body path) → full RAG answer with references, streamed to the chat page.

## Results

**VALIDATED.** The whole Databasise read surface can be projected into Pi as auto-generated tools:

- OpenAPI-driven generation worked for both param styles (query-string and JSON body) with a ~60-line generator.
- Live chat turn → Pi tool → Databasise REST → cited answer, streamed over SSE to a page the user can drive.
- Lean prompt held at ~417 tokens with 4 tools registered.
- gpt-oss-120b used the tools appropriately (parallel wiki reads; honest empty-result reporting).

**Landmines for the build:**
- `sourcerer.py` defaults to `./sourcerer_data`; point `WORKING_DIR` at the real store or applets will see an empty wiki.
- Guest-mode auth is wide open locally — the Tauri sidecar wiring must decide auth deliberately.
- The resolver's `attributes` come from the fact layer; this corpus has none, so `/wiki/resolve` returns `{}` — applets should render that state gracefully (it is not an error).
- Tool results are truncated at 4,000 chars in the adapter — tune per-tool for the real build (resolve payloads can be large).
