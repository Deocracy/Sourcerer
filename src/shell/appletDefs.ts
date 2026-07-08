/**
 * appletDefs — the single shared applet metadata map ({glyph, title, line} per
 * applet key), ported verbatim from the design handoff's `defs` map (Sourcerer
 * Bespoke Rails.dc.html lines 347-364), restricted to the rail's fixed applet
 * order (Catalog/Settings/Home are footer/title-bar concerns, not rail rows or
 * dockable applets in this phase's scope).
 *
 * Both `Rail.tsx` (left rail rows) and `Dock.tsx`/`PanelBody.tsx` (dockview
 * panel dispatch + generic placeholder body) import from this one source of
 * truth so glyph/title/description never drift between the two surfaces.
 */
export interface AppletDef {
  glyph: string;
  title: string;
  line: string;
}

export const appletDefs: Record<string, AppletDef> = {
  Sources: {
    glyph: "◆",
    title: "Sources",
    line: "LightRAG ingestion — corpora, pipelines, and source-level trust.",
  },
  Library: {
    glyph: "▥",
    title: "Library",
    line: "Corpus & document tree, ingest, document detail, trust flags, OKF export.",
  },
  Wiki: {
    glyph: "¶",
    title: "Wiki",
    line: "Canonical articles with provenance, Unresolved blocks, and the review queue.",
  },
  Graph: {
    glyph: "⊹",
    title: "Graph",
    line: "Interactive knowledge graph — entities and relations, node inspector.",
  },
  Chat: {
    glyph: "≋",
    title: "Chat",
    line: "Corpus-grounded chat with citations and a model settings drawer.",
  },
  Writing: {
    glyph: "✎",
    title: "Writing",
    line: "Compose long-form work with live citations from Wiki and Library.",
  },
  Browser: {
    glyph: "◎",
    title: "Power Browser",
    line: "Research browser — clip pages and archives straight into the corpus.",
  },
  Kanban: {
    glyph: "▥",
    title: "Kanban",
    line: "Project board — cards pull status from Wiki, Writing, and Library.",
  },
  News: {
    glyph: "◈",
    title: "News Buddy",
    line: "Watched feeds — archives, catalogs, and journals touching your entities.",
  },
  KeyPass: {
    glyph: "⚷",
    title: "KeyPass DB",
    line: "Local encrypted vault for archive logins and API keys.",
  },
  Builder: {
    glyph: "⊞",
    title: "Applet Builder",
    line: "Assemble new applets from corpus-aware components.",
  },
  Dadabase: {
    glyph: "▦",
    title: "Databasise",
    line: "Typed tables, saved queries, and relations synced with the corpus.",
  },
  Notes: {
    glyph: "✳",
    title: "Notes",
    line: "Quick capture — scratch notes that can graduate into the corpus.",
  },
};
