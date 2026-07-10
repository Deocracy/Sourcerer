/**
 * wikiContent.ts — the hand-authored Ficino/Alberti corpus slice +
 * review-queue data ported from
 * `NEW Design sync setup guide/design_handoff_bespoke_rails_shell/wiki.js`
 * (ARTICLES/FALLBACK/REVIEW, lines 15-54). Data lives here, separated from
 * the component (src/applets/Wiki/index.tsx), per 04-03-PLAN.md Task 1.
 */

/** [title, location/page, year] — a single source-document reference. */
export type WikiDoc = [string, string, string];

export interface WikiProvenance {
  won: string;
  docs: WikiDoc[];
  why: string;
}

export type WikiTrust = "curated" | "library";

export interface WikiClaim {
  id: string;
  attr: string;
  val: string;
  trust: WikiTrust;
  prov: WikiProvenance;
  copies: number;
}

export interface WikiSection {
  g: string;
  claims: WikiClaim[];
}

export interface WikiUnresolvedCandidate {
  val: string;
  trust: WikiTrust;
  docs: WikiDoc[];
  conf: number;
}

export interface WikiUnresolved {
  attr: string;
  note: string;
  candidates: WikiUnresolvedCandidate[];
}

export interface WikiArticle {
  title: string;
  kind: string;
  trust: WikiTrust;
  lede: string;
  sections: WikiSection[];
  unresolved: WikiUnresolved | null;
}

export interface WikiReviewItem {
  id: string;
  entity: string;
  attr: string;
  a: [string, string];
  b: [string, string];
}

export const ARTICLES: Record<string, WikiArticle> = {
  ficino: {
    title: "Marsilio Ficino",
    kind: "PERSON · PHILOSOPHER",
    trust: "curated",
    lede: "Italian scholar, priest and the foremost Platonist of the Florentine Renaissance; first translator of the complete works of Plato into Latin.",
    sections: [
      {
        g: "Identity",
        claims: [
          {
            id: "ficino-born",
            attr: "Born",
            val: "19 October 1433, Figline Valdarno",
            trust: "curated",
            prov: {
              won: "trust",
              docs: [
                ["Corsi · Vita Ficini", "p. 3", "1506"],
                ["Baptismal register, Figline", "fol. 12", "transcr. 1901"],
              ],
              why: "Human-curated over two agreeing sources.",
            },
            copies: 3,
          },
          {
            id: "ficino-died",
            attr: "Died",
            val: "1 October 1499, Careggi",
            trust: "library",
            prov: {
              won: "recency",
              docs: [["Kristeller · Supplementum", "v.1 p.cxx", "1937"]],
              why: "Single authoritative source; no conflict.",
            },
            copies: 2,
          },
        ],
      },
      {
        g: "Work",
        claims: [
          {
            id: "ficino-plato",
            attr: "Completed Plato translation",
            val: "1469 (revised through 1484)",
            trust: "library",
            prov: {
              won: "provenance",
              docs: [
                ["Hankins · Plato in the Ital. Ren.", "p. 300", "1990"],
                ["Ficino · Epistolae I", "letter 47", "1495"],
              ],
              why: "Two sources agree on the 1469 draft; 1484 is the printed edition.",
            },
            copies: 4,
          },
          {
            id: "ficino-academy",
            attr: "Led",
            val: "The Careggi circle (from 1462)",
            trust: "library",
            prov: {
              won: "recency",
              docs: [["Field · Origins of the Platonic Academy", "ch.2", "1988"]],
              why: "Field reframes it as an informal circle, not a chartered academy.",
            },
            copies: 2,
          },
        ],
      },
    ],
    unresolved: null,
  },
  alberti: {
    title: "Leon Battista Alberti",
    kind: "PERSON · POLYMATH",
    trust: "library",
    lede: "Italian humanist, architect and art theorist; author of De pictura and De re aedificatoria.",
    sections: [
      {
        g: "Identity",
        claims: [
          {
            id: "alberti-died",
            attr: "Died",
            val: "25 April 1472, Rome",
            trust: "library",
            prov: {
              won: "recency",
              docs: [["Grafton · Alberti", "p. 4", "2000"]],
              why: "Single source; uncontested.",
            },
            copies: 2,
          },
        ],
      },
    ],
    unresolved: {
      attr: "Birthplace",
      note: "Sources genuinely disagree. Surfaced, never silently resolved.",
      candidates: [
        {
          val: "Genoa",
          trust: "curated",
          docs: [
            ["Grafton · Alberti", "p. 3", "2000"],
            ["Genoese notarial record", "fol. 8", "transcr. 1889"],
          ],
          conf: 0.58,
        },
        {
          val: "Venice",
          trust: "library",
          docs: [["Mancini · Vita di L.B. Alberti", "p. 12", "1882"]],
          conf: 0.42,
        },
      ],
    },
  },
};

export function FALLBACK(id: string): WikiArticle {
  return {
    title: (id || "Entity").replace(/(^|\s)\S/g, (c) => c.toUpperCase()),
    kind: "ENTITY",
    trust: "library",
    lede: "No composed article yet for this entity in the current corpus.",
    sections: [],
    unresolved: null,
  };
}

export const REVIEW: WikiReviewItem[] = [
  {
    id: "rq-alberti",
    entity: "Leon Battista Alberti",
    attr: "Birthplace",
    a: ["Genoa", "Grafton · Alberti (2000)"],
    b: ["Venice", "Mancini · Vita (1882)"],
  },
  {
    id: "rq-plato",
    entity: "Marsilio Ficino",
    attr: "Plato translation begun",
    a: ["1463", "Hankins (1990)"],
    b: ["1462", "Careggi deed"],
  },
  {
    id: "rq-careggi",
    entity: "Villa di Careggi",
    attr: "Type",
    a: ["Formal academy", "Vasari (1550)"],
    b: ["Informal salon", "Field (1988)"],
  },
];
