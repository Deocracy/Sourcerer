import { useState } from "react";
import { HomeCard } from "../home/HomeCard";
import { DEFAULT_SECTIONS, SECTION_LABELS, SECTION_ORDER, cardDefs } from "../home/cardDefs";
import type { SectionKey } from "../home/cardDefs";
import { shellStore } from "../store/shellStore";
import { addAppletToDock } from "./dockApi";
import { appletDefs } from "./appletDefs";
import styles from "./Home.module.css";

/*
 * Home.tsx — the metro card dashboard overlay (HOME-01). Renders the four
 * sections PINNED / FRESH / LIVING / ARCHIVE. Ported from the design
 * handoff's `Home` component (home-cards.js): the four-section render loop,
 * `grid(sec)`, `SectionHeader`, and the ARCHIVE cards/list toggle.
 *
 * This plan renders STATICALLY: section membership/order seed from
 * DEFAULT_SECTIONS into local component state (no persistence, no drag) —
 * Plan 06-06 installs the drag-and-drop library and wraps these same cards
 * in a drag context, replacing this local useState with the persisted
 * host.storage-backed slice (D-05).
 */

function SectionHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div className={styles.sectionHeader}>
      <span className={styles.sectionLabel}>{label}</span>
      <div className={styles.sectionRule} />
      {right ?? null}
    </div>
  );
}

function EmptySection() {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyHeading}>No cards yet</div>
      <div className={styles.emptyBody}>
        Cards appear here as you pin items or the assistant mints one via ＋ MAKE CARD.
      </div>
    </div>
  );
}

export function Home() {
  // Section membership/order seeded from DEFAULT_SECTIONS into local state
  // (no setter used this plan — static render only). Plan 06-06 replaces
  // this with the persisted, drag-mutable host.storage-backed slice (D-05).
  const [cards] = useState<Record<SectionKey, string[]>>(DEFAULT_SECTIONS);
  const [archiveView, setArchiveView] = useState<"cards" | "list">("cards");

  const onOpen = (to: string) => {
    shellStore.getState().setHomeOpen(false);
    // Best-effort dock open: only known applet keys map to a real panel —
    // real cross-surface navigation is out of scope this plan.
    if (appletDefs[to]) addAppletToDock(to);
  };

  const grid = (sec: SectionKey) => {
    const ids = cards[sec] || [];
    const listMode = sec === "living" || (sec === "archive" && archiveView !== "cards");
    if (ids.length === 0) return <EmptySection />;
    return (
      <div className={listMode ? styles.listGrid : styles.cardGrid}>
        {ids.map((id) =>
          cardDefs[id] ? (
            <HomeCard key={id} id={id} sec={sec} listView={archiveView !== "cards"} onOpen={onOpen} />
          ) : null,
        )}
      </div>
    );
  };

  const archToggle = (
    <div className={styles.archiveToggle}>
      <button
        type="button"
        className={archiveView === "cards" ? styles.archiveToggleActive : styles.archiveToggleBtn}
        onClick={() => setArchiveView("cards")}
      >
        ◧ CARDS
      </button>
      <button
        type="button"
        className={archiveView !== "cards" ? styles.archiveToggleActive : styles.archiveToggleBtn}
        onClick={() => setArchiveView("list")}
      >
        ≡ LIST
      </button>
    </div>
  );

  return (
    <div className={styles.overlay}>
      {SECTION_ORDER.map((sec) => (
        <div key={sec} className={styles.section}>
          <SectionHeader
            label={
              sec === "archive"
                ? `ARCHIVE · ${(cards.archive || []).length}`
                : SECTION_LABELS[sec]
            }
            right={sec === "archive" ? archToggle : undefined}
          />
          {grid(sec)}
        </div>
      ))}
    </div>
  );
}
