import { customAlphabet } from "nanoid";

/**
 * Session model shared by real (live `host.ai()`) and seed (read-only demo
 * transcript) sessions in the multi-session assistant panel (D-01). Seed ids
 * are prefixed (`seed-…`) and human-readable so they can never collide with
 * the alphanumeric-only real-session id space (CR-01) — the panel gates on
 * `kind`, never on id shape, to decide whether a session may call
 * `host.ai()`/`host.loadSession()`.
 */
export interface SessionEntry {
  id: string;
  label: string;
  kind: "real" | "seed";
  turns: { role: "user" | "assistant"; text: string }[];
}

// The sidecar validates sessionId against SESSION_ID_PATTERN (sessions.ts), which
// requires the first AND last character to be alphanumeric. Default nanoid() draws
// from the URL-safe alphabet `A-Za-z0-9_-`, so ~6% of IDs start/end with `_`/`-`
// and are rejected — and the rejection is cached, permanently wedging the session
// (CR-01). Draw real-session IDs from an alphanumeric-only alphabet so every
// generated ID satisfies the sidecar contract by construction. Mirrors
// AssistantPanel.tsx's existing `newSessionId` verbatim (do not reinvent).
const newSessionId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 21);

/**
 * Mints a fresh real SessionEntry: a valid alphanumeric sessionId (CR-01) and
 * the handoff-literal new-session greeting (dc.html `newAssistant`, line 1034)
 * as its first assistant turn.
 */
export function newRealSession(): SessionEntry {
  return {
    id: newSessionId(),
    label: "New assistant",
    kind: "real",
    turns: [{ role: "assistant", text: "New assistant ready. What should I look into?" }],
  };
}

/**
 * Read-only demo transcripts (D-01) authored from the handoff's staged
 * sessions (dc.html `threads[0]`/`threads[1]`, "Casey · human" session list).
 * Seed transcripts are never sent through `host.ai()`/`host.loadSession()` —
 * the panel renders their `turns` directly and disables the composer.
 *
 * The `seed-careggi` transcript's final assistant turn carries the authored
 * proposal in the marker convention Plan 06-03's `proposalParse.ts` will
 * parse: a line starting `Proposal —` immediately followed by a Markdown
 * blockquote (`> …`), so ASST-02 has a guaranteed-parseable demo.
 */
export const sessionSeeds: SessionEntry[] = [
  {
    id: "seed-careggi",
    label: "Poliziano · Careggi",
    kind: "seed",
    turns: [
      {
        role: "user",
        text: "Find every mention of Poliziano in the Careggi context and propose Wiki edits.",
      },
      {
        role: "assistant",
        text:
          "Searching Wiki and the Prato archive — I'll cross-check dates and draft edits for your approval.",
      },
      {
        role: "assistant",
        text:
          'Proposal — updates § Poliziano · role at Careggi:\n\n> "Attended irregularly 1477–1494 — free from teaching."',
      },
    ],
  },
  {
    id: "seed-medici-patronage",
    label: "Medici patronage",
    kind: "seed",
    turns: [
      { role: "user", text: "Run the Medici patronage deep research to completion." },
      {
        role: "assistant",
        text: "Day 3 of 4 — 18 of 29 sources cross-checked. I will surface conflicts as I go.",
      },
    ],
  },
];
