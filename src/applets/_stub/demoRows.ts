/**
 * demoRows.ts — believable per-applet demo row content (D-13, 04-02-PLAN.md
 * Task 2) rendered inside TemplatedStub's DEMO body. Every row is obviously
 * demo data — no live corpus/network calls, no real user data. KeyPass rows
 * are labels only (vault entry names), never secret/password values.
 */
export interface DemoRow {
  primary: string;
  secondary?: string;
}

export const demoRows: Record<string, DemoRow[]> = {
  Sources: [
    { primary: "arXiv — cs.CL corpus", secondary: "1,204 docs · last sync 2h ago" },
    { primary: "Internal PDFs — grant reports", secondary: "312 docs · trusted" },
    { primary: "Web clippings — Power Browser", secondary: "88 docs · unreviewed" },
  ],
  Library: [
    { primary: "Democratizing Knowledge Graphs.pdf", secondary: "trusted · OKF exported" },
    { primary: "Corpus: Nonprofit Grants 2026", secondary: "412 documents" },
    { primary: "Fact-layer contradiction review", secondary: "3 flagged" },
  ],
  Wiki: [
    { primary: "Article: Cozo Query Language", secondary: "provenance: 4 sources" },
    { primary: "Unresolved: \"OKF adoption rate\"", secondary: "awaiting review" },
    { primary: "Review queue", secondary: "6 pending edits" },
  ],
  Graph: [
    { primary: "Entity: Databasise Engine", secondary: "12 relations" },
    { primary: "Relation: powers → Wiki applet", secondary: "confidence 0.94" },
    { primary: "Entity: LightRAG pipeline", secondary: "7 relations" },
  ],
  Chat: [
    { primary: "\"Summarize the fact-layer contradiction gate\"", secondary: "3 citations" },
    { primary: "\"What changed in Phase 10?\"", secondary: "1 citation" },
  ],
  Writing: [
    { primary: "Draft: Grant Narrative — Section 2", secondary: "1,204 words" },
    { primary: "Draft: Wiki Source-of-Truth whitepaper", secondary: "3 live citations" },
  ],
  Browser: [
    { primary: "Clipped: \"OKF v0.1 spec\"", secondary: "archived 2026-07-08" },
    { primary: "Clipped: \"Cozo storage engine docs\"", secondary: "archived 2026-07-06" },
  ],
  Kanban: [
    { primary: "To Do · Port Wiki rich demo" },
    { primary: "In Progress · Applet registry" },
    { primary: "Done · Host API seam" },
  ],
  News: [
    { primary: "New: \"Grants.gov API changes\"", secondary: "Granted feed · 1h ago" },
    { primary: "New: \"Nonprofit tech funding roundup\"", secondary: "3h ago" },
  ],
  KeyPass: [
    { primary: "arXiv API key", secondary: "added 2026-06-02" },
    { primary: "Grants.gov login", secondary: "added 2026-05-14" },
    { primary: "Internal archive FTP", secondary: "added 2026-04-30" },
  ],
  Builder: [
    { primary: "Component: Corpus Picker", secondary: "used in 3 applets" },
    { primary: "Component: Trust Chip", secondary: "used in 2 applets" },
  ],
  Dadabase: [
    { primary: "Table: grants (412 rows)" },
    { primary: "Saved query: \"open opportunities > $50k\"" },
  ],
  Notes: [
    { primary: "Quick note: follow up with funder" },
    { primary: "Quick note: check contradiction on entity X" },
  ],
};

/** Generic fallback for a key with no authored rows above. */
export const genericDemoRow: DemoRow[] = [{ primary: "Demo content coming with this applet's real build." }];
