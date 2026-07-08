// Mode registry + runtime toggle plumbing (D-02/D-04, spike 003 pattern).
// A plain object + an active-key Set. No plugin framework.
//
// research is the one live proof mode this plan (D-03 tool NAMES only — the actual
// defineTool implementations are supplied by plan 07-02's Databasise adapter).
// notes/coding/memory are registered as a REAL seam (D-04): empty tool lists, but
// genuinely toggleable, not omitted keys.
import { allDatabasiseTools } from "./tools/databasise.ts";

export interface ModeDef {
  label: string;
  /** Prompt fragment appended to BASE_PROMPT when this mode is active. */
  prompt: string;
  /** Tool names this mode contributes to activeToolNames(). */
  tools: string[];
}

export const MODES: Record<string, ModeDef> = {
  research: {
    label: "Research (Databasise wiki)",
    prompt:
      "RESEARCH MODE: You can consult the user's Databasise wiki. Use wiki_resolve for a single entity's canonical view, wiki_unresolved / wiki_unplaced to find open contradictions or unplaced entities, and kb_query for a general knowledge-base query.",
    tools: ["wiki_resolve", "wiki_unresolved", "wiki_unplaced", "kb_query"],
  },
  notes: {
    label: "Notes",
    prompt: "NOTES MODE: Capture and recall the user's notes.",
    tools: [],
  },
  coding: {
    label: "Coding",
    prompt: "CODING MODE: You may assist with reading and reasoning about code in the current project.",
    tools: [],
  },
  memory: {
    label: "Memory",
    prompt: "MEMORY MODE: You have access to durable cross-session memory.",
    tools: [],
  },
};

const BASE_PROMPT =
  "You are the Sourcerer Dashboard Assistant — a research and life-information hub, not a coding agent by default. Be concise. Only capabilities from currently-enabled modes are available.";

/**
 * Active mode keys. Seeded EMPTY (research OFF) to match the panel's default UI:
 * AssistantPanel initializes `researchMode = false` and does not call setModes on
 * mount (WR-02). Seeding research here made the sidecar silently run research tools
 * on the first turn while the UI claimed research was off. research is still a
 * genuine D-04 toggle — the panel drives it on via per-prompt modes / setModes.
 */
const active = new Set<string>([]);

export function composePrompt(): string {
  return [
    BASE_PROMPT,
    ...[...active].map((k) => MODES[k]!.prompt),
    `Today: ${new Date().toISOString().slice(0, 10)}.`,
  ].join("\n\n");
}

export function activeToolNames(): string[] {
  return [...active].flatMap((k) => MODES[k]!.tools);
}

export function activeModeKeys(): string[] {
  return [...active];
}

/**
 * Minimal shape of the Pi AgentSession this module needs — kept narrow so modes.ts
 * doesn't need to import pi-coding-agent's full session type.
 */
export interface ModeToggleSession {
  reload: () => Promise<void>;
  setActiveToolsByName: (names: string[]) => void;
}

let boundSession: ModeToggleSession | null = null;

/** index.ts calls this once, right after createAgentSession, so setModes() can drive it. */
export function bindSession(session: ModeToggleSession): void {
  boundSession = session;
}

/**
 * Runtime mode toggle (D-02). Order matters (spike 003 landmine): reload() FIRST
 * (re-reads systemPromptOverride -> new mode fragments), THEN setActiveToolsByName
 * (narrows tools + rebuilds the prompt). Reversing this order clobbers the prompt.
 *
 * D-09 note: index.ts now builds the first AgentSession lazily (on the first
 * `prompt`, keyed by sessionId) rather than eagerly at boot, so a `setModes`
 * request can legitimately arrive before any session exists yet. The `active`
 * Set above is still updated in that case — the next session built reads it via
 * composePrompt()/activeToolNames() — so there's nothing to drive on a session
 * that doesn't exist yet; skip the reload rather than throwing.
 */
export async function setModes(keys: string[]): Promise<void> {
  active.clear();
  for (const k of keys) {
    if (MODES[k]) active.add(k);
  }
  if (!boundSession) return;
  await boundSession.reload();
  boundSession.setActiveToolsByName(activeToolNames());
}

let cachedModeTools: unknown[] | null = null;

/**
 * Tool DEFINITIONS (defineTool instances) for customTools registration at session
 * creation. Research mode's four D-03 tools now come from the live Databasise
 * /openapi.json adapter (07-02, tools/databasise.ts); notes/coding/memory stay a
 * genuine empty seam (D-04) until their tools are added incrementally.
 *
 * Exported as an async function (not a bare array, as 07-01 originally sketched)
 * because tool generation performs a network fetch of /openapi.json (or the D-06
 * offline-boot fallback) — that can't be synchronous. Memoized so repeated session
 * builds (e.g. switching between file-backed sessions, D-09) don't re-fetch the
 * spec or re-hit Databasise on every rebuild.
 */
export async function allModeTools(): Promise<unknown[]> {
  if (!cachedModeTools) {
    cachedModeTools = await allDatabasiseTools();
  }
  return cachedModeTools;
}
