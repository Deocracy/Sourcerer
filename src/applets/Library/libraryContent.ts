/**
 * libraryContent.ts — the demo corpora / documents / stats data ported from
 * `design-sync-setup-guide/design_handoff_bespoke_rails_shell/library.js`
 * (CORPUS_STATS/DOCS/RECENT, lines 17-37) plus the `store.js` `corpora` list
 * (lines 15-19). Data lives here, separated from the component
 * (src/applets/Library/index.tsx), per 04-04-PLAN.md Task 1.
 */

export interface LibraryCorpus {
  id: string;
  name: string;
  tier: string;
  docs: number;
  conflicts: number;
}

export const CORPORA: LibraryCorpus[] = [
  { id: "ficino", name: "Ficino corpus", tier: "Full", docs: 342, conflicts: 5 },
  { id: "medici", name: "Medici letters", tier: "Standard", docs: 319, conflicts: 2 },
  { id: "sandbox", name: "Scratch corpus", tier: "Simple", docs: 12, conflicts: 0 },
];

export interface LibraryCorpusStats {
  docs: number;
  entities: number;
  claims: number;
  contradictions: number;
  curated: number;
}

export const CORPUS_STATS: Record<string, LibraryCorpusStats> = {
  ficino: { docs: 342, entities: 1284, claims: 5107, contradictions: 5, curated: 41 },
  medici: { docs: 319, entities: 980, claims: 3990, contradictions: 2, curated: 18 },
  sandbox: { docs: 12, entities: 28, claims: 94, contradictions: 0, curated: 0 },
};

export type LibraryTrust = "curated" | "library";
export type LibraryStatus = "ok" | "proc" | "fail";

export interface LibraryDoc {
  title: string;
  author: string;
  kind: string;
  trust: LibraryTrust;
  status: LibraryStatus;
  added: string;
  size: string;
  pages: number;
  chunks: number;
  entities: number;
  claims: number;
  note: string;
}

export const DOCS: Record<string, LibraryDoc> = {
  "doc-ficino-vita": {
    title: "Vita Ficini",
    author: "Giovanni Corsi",
    kind: "PDF · biography",
    trust: "curated",
    status: "ok",
    added: "2026-06-14",
    size: "2.1 MB",
    pages: 88,
    chunks: 214,
    entities: 63,
    claims: 190,
    note: "Human-verified. Primary biographical source for the Ficino article.",
  },
  "doc-letters": {
    title: "Epistolae · Book I",
    author: "Marsilio Ficino",
    kind: "PDF · letters",
    trust: "library",
    status: "ok",
    added: "2026-06-14",
    size: "4.8 MB",
    pages: 240,
    chunks: 612,
    entities: 129,
    claims: 401,
    note: "Machine-ingested. 401 claims extracted; 3 flagged for review.",
  },
  "doc-prato-ledger": {
    title: "Prato account book 1462",
    author: "Datini archive",
    kind: "scan · ledger",
    trust: "library",
    status: "proc",
    added: "2026-07-07",
    size: "18.3 MB",
    pages: 512,
    chunks: 0,
    entities: 0,
    claims: 0,
    note: "Ingestion in progress — OCR + chunking + extraction running.",
  },
  "doc-vasari": {
    title: "Lives of the Artists",
    author: "Giorgio Vasari",
    kind: "PDF · secondary",
    trust: "library",
    status: "ok",
    added: "2026-06-15",
    size: "9.2 MB",
    pages: 604,
    chunks: 1508,
    entities: 402,
    claims: 1120,
    note: "Machine-ingested secondary source. Contributes to several contested claims.",
  },
  "doc-manetti": {
    title: "Vita di Ficino",
    author: "Giannozzo Manetti",
    kind: "PDF · biography",
    trust: "library",
    status: "fail",
    added: "2026-07-06",
    size: "3.4 MB",
    pages: 0,
    chunks: 0,
    entities: 0,
    claims: 0,
    note: "Ingestion failed — encrypted PDF could not be parsed. Retry after removing protection.",
  },
};

/** [timeAgo, actor, message, status] */
export type LibraryActivity = [string, string, string, string];

export const RECENT: LibraryActivity[] = [
  ["just now", "Ingest", "Prato account book 1462 — OCR 41%", "proc"],
  ["2h ago", "You", 'Promoted "Vita Ficini · Corsi" to curated', "ok"],
  ["5h ago", "Ingest", "+401 claims from Epistolae · Book I", "ok"],
  ["yesterday", "Ingest", "Manetti · Vita failed — encrypted PDF", "fail"],
];

export interface LibraryIngestQueueItem {
  id: string;
  label: string;
  st: "proc" | "fail" | "queue";
  pct: number;
  note: string;
}

export const INGEST_QUEUE: LibraryIngestQueueItem[] = [
  { id: "doc-prato-ledger", label: "Prato account book 1462", st: "proc", pct: 41, note: "OCR + chunking" },
  { id: "doc-manetti", label: "Manetti · Vita", st: "fail", pct: 0, note: "encrypted PDF — parse failed" },
  { id: "q1", label: "Bruni · Historiae (queued)", st: "queue", pct: 0, note: "waiting for pipeline" },
];

/** Chunk preview excerpts shown for the Vita Ficini-style first-3-chunks list. */
export const CHUNK_PREVIEW: string[] = [
  "…nato in Figline Valdarno il xix d’ottobre 1433, figliuolo di Diotifeci…",
  "…tradusse tutte l’opere di Platone in lingua latina, compiute intorno al…",
  "…nel giardino di Careggi convennero gli uomini dotti che egli chiamava…",
];
