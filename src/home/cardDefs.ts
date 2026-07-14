/*
 * cardDefs.ts — ported near-verbatim from the design handoff's
 * `home-cards.js` `cardDefs` registry (33 entries) + `DEFAULT_SECTIONS` /
 * `SECTION_ORDER` / `SECTION_LABELS`.
 *
 * Static, curated demo data (D-05/D-06 per 06-CONTEXT.md: card *content*
 * stays this curated registry this phase — only section membership/order
 * are real state, wired in Plan 06-06). No field dropped or simplified from
 * the reference; only the JS object literal became a typed TS const.
 *
 * Source: `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/home-cards.js`
 * lines 22-65.
 */

export type CardVariant =
  | "metric"
  | "spark"
  | "progress"
  | "excerpt"
  | "timeline"
  | "skeleton"
  | "compare"
  | "graph"
  | "chain"
  | "feed"
  | "annotation"
  | "cluster"
  | "stack"
  | "action"
  | "entitywiki"
  | "entitylive"
  | "audit";

export type CardMark = "curated" | "doc" | "live" | "inferred";

/** Union of every field used across the ~18 CardBody variant branches
 * (default branch included). See home-cards.js CardBody() for the
 * per-variant field usage this type covers. */
export interface CardDef {
  span?: 1 | 2;
  kind: string;
  mark?: CardMark;
  title: string;
  foot?: string;
  bg?: string;
  to?: string;
  variant?: CardVariant;
  bar?: boolean;
  dashed?: boolean;
  dim?: boolean;
  italic?: boolean;

  // metric
  big?: string;
  footColor?: string;

  // timeline
  events?: Array<[string, string, string?]>;

  // progress
  pct?: number;

  // cluster
  tiles?: string[];

  // compare
  left?: [string, string, string];
  right?: [string, string, string];

  // chain
  steps?: Array<[string, string]>;

  // annotation
  note?: string;

  // feed
  items?: Array<[string, string, string]>;

  // stack
  claims?: string[];

  // entitywiki
  desc?: string;
  bullets?: string[];
  quote?: string;

  // entitylive
  claimsN?: number;
  openN?: number;

  // audit
  rows?: Array<[string, string, string, string]>;
  tasks?: Array<{ id: string; label: string }>;
}

export const cardDefs: Record<string, CardDef> = {
  corpus: { span: 2, kind: "CORPUS · PRIMARY", mark: "live", title: "Renaissance Papers", foot: "342 docs · 5 conflicts", bg: "#1E1F22", to: "Library" },
  dissertation: { span: 2, kind: "DISSERTATION · CH.3", title: "Neoplatonism in Ficino's circle", foot: "8,412 words", to: "Writing" },
  ficino: { span: 1, kind: "ENTITY", mark: "curated", title: "Marsilio Ficino", foot: "34 claims", to: "Wiki" },
  thread: { span: 1, kind: "THREAD · SAVED", title: "Neoplatonism antecedents", foot: "6 sources", to: "Chat" },
  graphview: { span: 2, kind: "GRAPH · VIEW", title: "Careggi network", foot: "43 nodes · 71 edges", to: "Graph" },
  contradiction: { span: 2, kind: "NEW CONTRADICTION", bar: true, bg: "#1E1C17", title: "Alberti — Genoa vs Venice", foot: "2 sources · resolve →", to: "Wiki" },
  prato: { span: 2, kind: "DEEP RESEARCH FINDING", dashed: true, title: "Medici account book · Prato Archive digitized", foot: "1462 folios · scan →", to: "Library" },
  claimsnow: { span: 1, kind: "CLAIMS · LIVE", mark: "live", variant: "metric", big: "342", foot: "▲ 18 today", footColor: "#86A38C", title: "Claims", to: "Wiki" },
  activity: { span: 2, kind: "CLAIM ACTIVITY · 30D", mark: "live", variant: "spark", title: "Ficino corpus", foot: "Jun 6 → today · ▲ 42%", to: "Graph" },
  fichrono: {
    span: 2,
    kind: "TIMELINE · FICINO",
    variant: "timeline",
    title: "Ficino timeline",
    events: [
      ["1433", "Born in Figline", "#C9C6BE"],
      ["1462", "Receives Careggi villa", "#86A38C"],
      ["1484", "Plato translation printed", "#B8A06E"],
    ],
    foot: "3 of 11 events",
    to: "Wiki",
  },
  excerpt47: { span: 2, kind: "EXCERPT · LETTER 47", mark: "doc", variant: "excerpt", title: '"Between the soul and the body there is a spirit, most subtle…"', foot: "Ficino → Cavalcanti · p. 112", to: "Library" },
  ingest: { span: 2, kind: "INGESTION · MEDICI LETTERS", variant: "progress", pct: 68, title: "217 / 319 docs", foot: "~11 min remaining", to: "Library" },
  indexing: { span: 1, kind: "INDEXING…", variant: "skeleton", title: "Indexing", foot: "", to: "Library" },
  ficnet: { span: 2, kind: "CONNECTIONS · FICINO", variant: "graph", title: "Ficino network", foot: "4 direct · 19 second-degree", to: "Graph" },
  circle: { span: 2, kind: "CLUSTER · CAREGGI CIRCLE", variant: "cluster", bg: "#131417", title: "Careggi circle", tiles: ["Ficino", "Pico", "Poliziano"], foot: "view all 9 →", to: "Wiki" },
  vasmanetti: { span: 2, kind: "COMPARE · SOURCES", variant: "compare", title: "Vasari vs Manetti", left: ["Vasari", "61", "4 flagged"], right: ["Manetti", "38", "1 flagged"], foot: "7 overlap · 2 disagree", footColor: "#D8C69C", to: "Library" },
  patrchain: {
    span: 2,
    kind: "THREAD · CLAIM CHAIN",
    variant: "chain",
    title: "Patronage chain",
    steps: [
      ["Cosimo funds the academy", "done"],
      ["Ficino appointed head, 1462", "done"],
      ["Patronage precedes doctrine", "inferred"],
    ],
    foot: "inferred · conf 0.72",
    to: "Chat",
  },
  platonote: { span: 2, kind: "CLAIM", variant: "annotation", mark: "curated", title: "Plato translation began 1463", note: "Hankins dates the commission earlier — check the 1462 deed.", foot: "", to: "Wiki" },
  pulse: {
    span: 2,
    kind: "ACTIVITY",
    variant: "feed",
    mark: "live",
    title: "Activity",
    items: [
      ["curated", "+3 claims · Prato ledger", "2m"],
      ["inferred", "Contradiction · Alberti", "18m"],
      ["doc", "Corpus H re-indexed", "1h"],
    ],
    foot: "",
    to: "Library",
  },
  claimstack: {
    span: 1,
    kind: "CLAIMS · STACK",
    variant: "stack",
    title: "Careggi claims",
    claims: [
      "Ficino completed the Plato corpus by 1469",
      "Cosimo gifted the Careggi villa in 1462",
      "The academy met on Plato’s birthday, Nov 7",
    ],
  },
  actioncard: { span: 1, kind: "CONTRADICTION · ACTION", variant: "action", title: "Alberti birthplace: Genoa vs Venice" },
  entwiki: {
    span: 2,
    kind: "ENTITY · WIKI",
    mark: "curated",
    variant: "entitywiki",
    title: "Marsilio Ficino",
    desc: "Italian Neoplatonist, priest and translator (1433–1499).",
    bullets: ["Translated Plato in full", "Led the Careggi circle"],
    quote: "The soul is the mirror of the world.",
    to: "Wiki",
  },
  entlive: { span: 1, kind: "ENTITY · LIVE", mark: "live", variant: "entitylive", title: "Marsilio Ficino", claimsN: 34, openN: 2, to: "Wiki" },
  audit: {
    span: 2,
    kind: "CORPUS · AUDIT",
    variant: "audit",
    title: "Audit",
    rows: [
      ["Careggi salon", "3", "✓", "#86A38C"],
      ["Plato dates", "2", "?", "#D8C69C"],
    ],
    tasks: [
      { id: "villa", label: "Verify villa deed" },
      { id: "vasari", label: "Cross-check Vasari" },
    ],
  },
  livingq: { span: 2, kind: "LIVING QUESTION · WEEK 2", title: '"Was Ficino’s Careggi a formal institution or an informal salon?"', foot: "14 findings · lean: informal salon (0.68) · OPEN THREAD →", italic: true, to: "Wiki" },
  "a-mach": { span: 1, kind: "CTR", title: "Machiavelli birthplace", foot: "Jun 24", to: "Wiki" },
  "a-ch2": { span: 1, kind: "PAPER", title: "Ch. 2 draft complete", foot: "Jun 22", to: "Writing" },
  "a-pdfs": { span: 1, kind: "ING", title: "12 PDFs from Prato", foot: "Jun 20", to: "Library" },
  "a-bruni": { span: 1, kind: "RES", title: "Bruni translations survey", foot: "Jun 18", to: "Library" },
  "a-petrarch": { span: 1, kind: "CTR", title: "Petrarch death year", foot: "Jun 16", to: "Wiki" },
  "a-stoic": { span: 1, kind: "CHAT", title: "Q: Stoic revival threads", foot: "Jun 14", to: "Chat" },
  "a-bocc": { span: 1, kind: "MRG", title: "Boccaccio aliases", foot: "Jun 12", to: "Wiki" },
  "a-bodleian": { span: 1, kind: "NEWS", title: "Bodleian catalog update", foot: "Jun 10", to: "Library" },
};

export type SectionKey = "pins" | "fresh" | "living" | "archive";

export const DEFAULT_SECTIONS: Record<SectionKey, string[]> = {
  pins: ["corpus", "dissertation", "ficino", "thread", "graphview", "claimsnow", "activity", "fichrono", "ficnet", "circle", "entwiki", "entlive"],
  fresh: ["contradiction", "prato", "excerpt47", "ingest", "vasmanetti", "patrchain", "platonote", "pulse", "claimstack", "actioncard", "audit", "indexing"],
  living: ["livingq"],
  archive: ["a-mach", "a-ch2", "a-pdfs", "a-bruni", "a-petrarch", "a-stoic", "a-bocc", "a-bodleian"],
};

export const SECTION_ORDER: SectionKey[] = ["pins", "fresh", "living", "archive"];

export const SECTION_LABELS: Record<"pins" | "fresh" | "living", string> = {
  pins: "◆ PINNED",
  fresh: "FRESH",
  living: "LIVING",
};
