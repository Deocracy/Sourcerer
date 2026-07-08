// Mode registry + runtime toggle plumbing (D-02/D-04, spike 003 pattern).
// A plain object + an active-key Set. No plugin framework.
//
// research is the one live proof mode this plan (D-03 tool NAMES only — the actual
// defineTool implementations are supplied by plan 07-02's Databasise adapter).
// notes/coding/memory are registered as a REAL seam (D-04): empty tool lists, but
// genuinely toggleable, not omitted keys.

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

/** Active mode keys. Seeded to research (the one live proof mode this plan). */
const active = new Set<string>(["research"]);

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
 */
export async function setModes(keys: string[]): Promise<void> {
  active.clear();
  for (const k of keys) {
    if (MODES[k]) active.add(k);
  }
  if (!boundSession) {
    throw new Error("modes.setModes() called before bindSession() — index.ts must bindSession after createAgentSession");
  }
  await boundSession.reload();
  boundSession.setActiveToolsByName(activeToolNames());
}

/**
 * Tool DEFINITIONS (defineTool instances) for customTools registration at session
 * creation. Plan 07-02 supplies the real Databasise adapter implementations for the
 * research mode's tool names above and populates this array; it is intentionally
 * empty this plan (interface-first sequencing within the phase, not a scope cut —
 * D-03 ships in full via 07-02). Kept as `unknown[]` so index.ts compiles without
 * a hard dependency on the eventual tool-definition module.
 */
export const allModeTools: unknown[] = [];
