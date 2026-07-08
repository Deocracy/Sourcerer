import { shellStore, useShellStore } from "../store/shellStore";
import styles from "./Rail.module.css";

export interface AppletDef {
  glyph: string;
  title: string;
  line: string;
}

/**
 * Rail applet defs — ported verbatim from the design handoff's `defs` map
 * (Sourcerer Bespoke Rails.dc.html lines 347-364), restricted to the rail's
 * own fixed applet order (Catalog/Settings/Home are footer/title-bar
 * concerns rendered separately below, not rail rows). Plan 02-05 extracts a
 * shared `appletDefs.ts` for the dock's PanelBody dispatcher to import from
 * the same source of truth.
 */
export const railDefs: Record<string, AppletDef> = {
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

function openCatalog() {
  // eslint-disable-next-line no-console
  console.log("openCatalog: no-op stub in Phase 2 (Applet Catalog is Phase 4 scope)");
}

function openSettings() {
  // eslint-disable-next-line no-console
  console.log("openSettings: no-op stub in Phase 2 (Settings applet not built yet)");
}

/**
 * Rail — the bespoke three-mode left rail (RAIL-01/02/03). Renders from the
 * shell store's railMode/railWidth/railOrder/leftRailPinned/railApplet/badges
 * slices. Drag-resize, keyboard/double-click cycling, within-rail reorder,
 * and the pin affordance are wired in via useRailDrag (plan 02-04 Task 2/3).
 */
export function Rail() {
  const railMode = useShellStore((s) => s.railMode);
  const railWidth = useShellStore((s) => s.railWidth);
  const railOrder = useShellStore((s) => s.railOrder);
  const leftRailPinned = useShellStore((s) => s.leftRailPinned);
  const railApplet = useShellStore((s) => s.railApplet);
  const badges = useShellStore((s) => s.badges);

  const width =
    railMode === "hidden"
      ? 6
      : railMode === "compact"
        ? 56
        : Math.max(132, Math.min(520, railWidth));

  if (railMode === "hidden") {
    return (
      <nav className={styles.rail} style={{ width }}>
        <div
          className={styles.hiddenStrip}
          title="Reopen rail (Cmd/Ctrl-\\)"
          onClick={() => shellStore.getState().cycleRailMode()}
        />
        <div className={styles.handle} title="Drag to resize · double-click to cycle" />
      </nav>
    );
  }

  const mainKeys = railOrder.filter((k) => !leftRailPinned.includes(k));
  const pinnedKeys = railOrder.filter((k) => leftRailPinned.includes(k));
  const orderedKeys = [...mainKeys, ...pinnedKeys];
  const compact = railMode === "compact";

  return (
    <nav className={styles.rail} style={{ width }}>
      <div className={compact ? styles.listCompact : styles.listExpanded}>
        {orderedKeys.map((key, idx) => {
          const def = railDefs[key];
          if (!def) return null;
          const isActive = key === railApplet;
          const badgeCount = badges[key];
          const showBadge = Boolean(badgeCount);

          if (compact) {
            const rowClass = isActive
              ? `${styles.rowCompact} ${styles.rowActive}`
              : styles.rowCompact;
            return (
              <div
                key={key}
                data-rail-row={idx}
                className={rowClass}
                title={`${def.title} — drag to reorder, or out to dock`}
                onClick={() => shellStore.getState().setRailApplet(key)}
              >
                <span className={styles.glyphCompact}>{def.glyph}</span>
                {showBadge && <div className={styles.badgeOverlay}>{badgeCount}</div>}
              </div>
            );
          }

          const rowClass = isActive ? `${styles.row} ${styles.rowActive}` : styles.row;
          return (
            <div
              key={key}
              data-rail-row={idx}
              className={rowClass}
              title="Drag to reorder, or out to dock"
              onClick={() => shellStore.getState().setRailApplet(key)}
            >
              <div className={styles.glyph}>{def.glyph}</div>
              <div className={styles.label}>{def.title}</div>
              {showBadge && <div className={styles.badgeInline}>{badgeCount}</div>}
            </div>
          );
        })}
        <div className={styles.spacer} />
        {compact ? (
          <div className={styles.footerCompact}>
            <div className={styles.catalogIcon} title="Applet Catalog" onClick={openCatalog}>
              ◍
            </div>
            <div className={styles.settingsIcon} title="Settings" onClick={openSettings}>
              ⚙
            </div>
            <div className={styles.avatarCompact} title="Casey · HUMAN">
              C
            </div>
          </div>
        ) : (
          <div className={styles.footer}>
            <div className={styles.catalogRow} onClick={openCatalog}>
              <div className={styles.glyph}>◍</div>
              <div className={styles.label}>Applet Catalog</div>
            </div>
            <div className={styles.userBlock}>
              <div className={styles.avatar}>C</div>
              <div className={styles.userInfo}>
                <div className={styles.userName}>Casey</div>
                <div className={styles.userRole}>HUMAN</div>
              </div>
              <button
                type="button"
                className={styles.settingsBtn}
                title="Settings"
                onClick={openSettings}
              >
                ⚙
              </button>
            </div>
          </div>
        )}
      </div>
      <div className={styles.handle} title="Drag to resize · double-click to cycle" />
    </nav>
  );
}
