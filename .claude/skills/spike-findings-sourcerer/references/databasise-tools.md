# Databasise Tool Projection

How to wire Databasise's REST surface into the Pi harness as auto-generated tools.
Proven end-to-end in spike 002 (live chat turn → Pi tool → Databasise REST → cited answer).

## Requirements (non-negotiable — from MANIFEST)

- Databasise (MCP/REST) is the **first-class tool surface**, not an afterthought.
- Tools resolve real wiki/search queries end-to-end, including honest empty-result reporting.

## How to Build It

**Generate Pi tools from the live `/openapi.json`** — zero hand-written adapters, always in sync, scales to the 40-tool surface by widening a whitelist (~60 lines total, spike 002).

```js
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const DB_BASE = "http://127.0.0.1:9621";              // Databasise server
const spec = await (await fetch(`${DB_BASE}/openapi.json`)).json();

function toolFromOp(name, method, apiPath) {
  const op = spec.paths[apiPath]?.[method];
  const props = {}, bodyProps = new Set();
  // query params → typebox props
  for (const p of op.parameters || []) if (p.in === "query") props[p.name] = paramSchemaToTypebox(p);
  // JSON body → pull ONLY the params the model needs (don't surface the whole schema)
  const ref = op.requestBody?.content?.["application/json"]?.schema;
  const bodySchema = ref?.$ref ? spec.components.schemas[ref.$ref.split("/").pop()] : ref;
  for (const [k, v] of Object.entries(bodySchema?.properties || {})) {
    if (k === "query" || k === "mode") {              // whitelist per endpoint
      bodyProps.add(k);
      const base = Type.String({ description: (v.description||"").slice(0,200) });
      props[k] = bodySchema.required?.includes(k) ? base : Type.Optional(base);
    }
  }
  return defineTool({
    name, label: name,
    description: `${op.summary || apiPath} (Databasise ${method.toUpperCase()} ${apiPath})`.slice(0,300),
    parameters: Type.Object(props),
    async execute(_id, params) {
      const qp = new URLSearchParams(), body = {};
      for (const [k, v] of Object.entries(params||{})) {
        if (v === undefined) continue;
        if (bodyProps.has(k)) body[k] = v; else qp.set(k, String(v));   // <-- query vs body split
      }
      const url = `${DB_BASE}${apiPath}${qp.size ? "?"+qp : ""}`;
      const res = await fetch(url, {
        method: method.toUpperCase(),
        headers: { "content-type": "application/json" },
        body: bodyProps.size && Object.keys(body).length ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(240000),
      });
      const text = await res.text();
      return { content: [{ type: "text", text: `HTTP ${res.status}\n${text.slice(0,4000)}` }] };
    },
  });
}
```

Whitelist the read surface. Proven set (4 tools): `POST /wiki/resolve` (query params `canonical_id`,`as_of`), `GET /wiki/unresolved`, `GET /wiki/unplaced`, `POST /query` (body `query`,`mode`) → generated as `wiki_resolve, wiki_unresolved, wiki_unplaced, kb_query`.

**Start Databasise against the populated store** before the harness:
```
# from D:\Vibe Coding\Databasise\runtime
WORKING_DIR=./rag_storage ../sourcerer-venv/Scripts/python.exe ../sourcerer-lightrag/sourcerer.py
```

## What to Avoid

- **`sourcerer.py` defaults its store to `./sourcerer_data`** (empty). The populated store (Cozo + Faiss, 112 entities) is `./rag_storage/` — set `WORKING_DIR=./rag_storage` or applets see an empty wiki.
- **`/wiki/resolve` takes query params, not a JSON body** (no `requestBody` in its OpenAPI). Map `parameters[in=query]` → query string; only body-schema props → JSON body.
- **`/wiki/preview` is an edit preview** (needs `attribute`+`new_value`), not a page renderer — exclude from the read whitelist.
- **Don't surface whole body schemas** — whitelist the 1–2 params the model actually needs, or tool descriptions bloat (see harness-embedding.md: tools are the cost center).
- **Empty results are not errors.** The resolver's `attributes` come from the fact layer; a corpus with none returns `{}` — render that state gracefully.
- Tool results truncated at 4,000 chars in the adapter — tune per-tool (resolve payloads can be large).

## Constraints

- Pi has **no native MCP**; REST-adapter generation is the bridge. An MCP-client bridge (`@modelcontextprotocol/sdk` → `defineTool`) remains viable for agent-facing parity but wasn't needed.
- Guest-mode auth (`combined_auth`) passes unauthenticated locally — **the Tauri sidecar wiring must decide auth deliberately.**
- Databasise REST lives in the fork's `version_routes.py`.

## Origin

Synthesized from spikes: 002
Source files: sources/002-databasise-tools-over-pi/
