// Databasise Research tools (D-03), auto-generated from the live /openapi.json.
// See .claude/skills/spike-findings-sourcerer/references/databasise-tools.md
// (spike 002) for the proven toolFromOp pattern this mirrors.
//
// D-06 (honest-degrade, non-negotiable): Databasise is assume-running, not
// managed by this harness. Every failure mode below — spec unreachable at
// generation time, or a per-call fetch failing at execute() time — resolves
// to a plain "wiki unavailable" text result. Nothing in this module ever
// throws past its own boundary; a down wiki degrades a chat turn, it never
// crashes or hangs one (T-07-07).
//
// D-07 (guest-mode): no Authorization header is ever set. Databasise's local
// combined_auth passes unauthenticated for the loopback sidecar wiring.
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type, type TSchema } from "typebox";

export const DATABASISE_BASE_URL = process.env.DATABASISE_BASE_URL || "http://127.0.0.1:9621";

export const WIKI_UNAVAILABLE_MESSAGE =
  "wiki unavailable — Databasise not reachable at 127.0.0.1:9621; answering from general knowledge";

const RESULT_TRUNCATE_CHARS = 4000;
const FETCH_TIMEOUT_MS = 240_000;

/**
 * D-03 whitelist: exactly these four read endpoints are surfaced as tools.
 * `/wiki/preview` is deliberately excluded — it is an edit preview (needs
 * `attribute`+`new_value`), not a page renderer (databasise-tools.md).
 */
interface OpSpec {
  name: string;
  method: "get" | "post";
  apiPath: string;
  /**
   * ONLY these JSON-body properties are ever surfaced to the model — never
   * the whole request body schema (tool schemas are the token cost center).
   * Empty for wiki_resolve/unresolved/unplaced: query params only, no body.
   */
  bodyPropWhitelist: string[];
}

const OP_SPECS: OpSpec[] = [
  { name: "wiki_resolve", method: "post", apiPath: "/wiki/resolve", bodyPropWhitelist: [] },
  { name: "wiki_unresolved", method: "get", apiPath: "/wiki/unresolved", bodyPropWhitelist: [] },
  { name: "wiki_unplaced", method: "get", apiPath: "/wiki/unplaced", bodyPropWhitelist: [] },
  { name: "kb_query", method: "post", apiPath: "/query", bodyPropWhitelist: ["query", "mode"] },
];

function describedString(description: unknown, required: boolean): TSchema {
  const opts = typeof description === "string" ? { description: description.slice(0, 200) } : {};
  const base = Type.String(opts);
  return required ? base : Type.Optional(base);
}

/** D-06 fallback tool: used when the spec itself couldn't be fetched at generation time. */
function unavailableTool(spec: OpSpec) {
  return defineTool({
    name: spec.name,
    label: spec.name,
    description: `${spec.name} (Databasise ${spec.method.toUpperCase()} ${spec.apiPath}) — spec unavailable, wiki unreachable`,
    parameters: Type.Object({}),
    async execute() {
      return { content: [{ type: "text" as const, text: WIKI_UNAVAILABLE_MESSAGE }], details: undefined };
    },
  });
}

/**
 * Generate one Pi tool from a live OpenAPI spec: query params -> query
 * string, ONLY whitelisted body props -> JSON body (query-vs-body split,
 * databasise-tools.md). `execute()` never throws (D-06) and never sets an
 * auth header (D-07).
 */
function toolFromSpec(spec: OpSpec, openapiSpec: Record<string, unknown>) {
  const paths = (openapiSpec?.paths ?? {}) as Record<string, Record<string, unknown>>;
  const op = (paths[spec.apiPath]?.[spec.method] ?? {}) as Record<string, unknown>;
  const props: Record<string, TSchema> = {};
  const bodyProps = new Set<string>(spec.bodyPropWhitelist);

  const parameters = (op.parameters ?? []) as Array<Record<string, unknown>>;
  for (const p of parameters) {
    if (p.in === "query" && typeof p.name === "string") {
      props[p.name] = describedString(p.description, Boolean(p.required));
    }
  }

  if (bodyProps.size > 0) {
    const requestBody = (op.requestBody ?? {}) as Record<string, unknown>;
    const content = (requestBody.content ?? {}) as Record<string, unknown>;
    const jsonContent = (content["application/json"] ?? {}) as Record<string, unknown>;
    const ref = jsonContent.schema as { $ref?: string } | undefined;
    const components = (openapiSpec?.components ?? {}) as Record<string, unknown>;
    const schemas = (components.schemas ?? {}) as Record<string, unknown>;
    const bodySchema = (ref?.$ref
      ? schemas[ref.$ref.split("/").pop() as string]
      : (jsonContent.schema as Record<string, unknown> | undefined)) as
      | { properties?: Record<string, { description?: unknown }>; required?: string[] }
      | undefined;

    for (const key of bodyProps) {
      const propSchema = bodySchema?.properties?.[key];
      const required = Boolean(bodySchema?.required?.includes(key));
      props[key] = describedString(propSchema?.description, required);
    }
  }

  const summary = typeof op.summary === "string" ? op.summary : spec.apiPath;
  const description = `${summary} (Databasise ${spec.method.toUpperCase()} ${spec.apiPath})`.slice(0, 300);

  return defineTool({
    name: spec.name,
    label: spec.name,
    description,
    parameters: Type.Object(props),
    async execute(_id, params) {
      try {
        const qp = new URLSearchParams();
        const body: Record<string, unknown> = {};
        for (const [k, v] of Object.entries((params ?? {}) as Record<string, unknown>)) {
          if (v === undefined) continue;
          if (bodyProps.has(k)) body[k] = v;
          else qp.set(k, String(v));
        }
        const url = `${DATABASISE_BASE_URL}${spec.apiPath}${qp.size ? `?${qp}` : ""}`;
        const hasBody = bodyProps.size > 0 && Object.keys(body).length > 0;
        const res = await fetch(url, {
          method: spec.method.toUpperCase(),
          // D-07: no Authorization header — guest-mode combined_auth passes
          // unauthenticated for this loopback-only local call.
          headers: { "content-type": "application/json" },
          body: hasBody ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        const text = await res.text();
        // Empty results (e.g. resolver with no facts yet) are not errors —
        // pass the body through as-is (databasise-tools.md).
        return {
          content: [{ type: "text" as const, text: `HTTP ${res.status}\n${text.slice(0, RESULT_TRUNCATE_CHARS)}` }],
          details: undefined,
        };
      } catch {
        // D-06: connection refused / timeout / any network failure -> honest
        // degrade, never throw past this boundary (T-07-07).
        return { content: [{ type: "text" as const, text: WIKI_UNAVAILABLE_MESSAGE }], details: undefined };
      }
    },
  });
}

/**
 * Generate the four whitelisted Databasise tools (D-03) from the live
 * /openapi.json. D-06: if the spec itself can't be fetched (Databasise down),
 * still return four tools whose execute() honestly degrades — the harness
 * must boot and chat plainly even with Databasise fully down (assume-running,
 * not managed, per D-06).
 */
export async function allDatabasiseTools(): Promise<unknown[]> {
  let spec: Record<string, unknown> | null = null;
  try {
    const res = await fetch(`${DATABASISE_BASE_URL}/openapi.json`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.ok) spec = (await res.json()) as Record<string, unknown>;
  } catch {
    spec = null;
  }

  if (!spec) {
    return OP_SPECS.map((s) => unavailableTool(s));
  }
  return OP_SPECS.map((s) => toolFromSpec(s, spec as Record<string, unknown>));
}

/** Exported for tests: the exact whitelist, so a test can assert /wiki/preview is absent. */
export const DATABASISE_TOOL_NAMES = OP_SPECS.map((s) => s.name);
