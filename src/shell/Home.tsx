import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { SortableCard, OverlayCard } from "../home/SortableCard";
import { DEFAULT_SECTIONS, SECTION_LABELS, SECTION_ORDER, cardDefs } from "../home/cardDefs";
import type { SectionKey } from "../home/cardDefs";
import { findSection, moveBetweenSections, reorderWithinSection } from "../home/homeCardsReducer";
import type { SectionMap } from "../home/homeCardsReducer";
import { loadSections, scheduleSaveSections } from "../home/homeCards.storage";
import { shellStore, useShellStore } from "../store/shellStore";
import { addAppletToDock } from "./dockApi";
import { appletDefs } from "./appletDefs";
import styles from "./Home.module.css";

/*
 * Home.tsx — the metro card dashboard overlay (HOME-01/HOME-02). Renders the
 * four sections PINNED / FRESH / LIVING / ARCHIVE, now wrapped in a real
 * dnd-kit `DndContext` (drag between/within sections, FLIP transform) with
 * section membership/order persisted via `homeCards.storage.ts` (D-05), and
 * consuming `shellStore.pendingCardMint` to mint a new card into FRESH
 * (D-06 — the assistant's ＋MAKE CARD closing the loop).
 *
 * Plan 06-05 seeded this component's section state from DEFAULT_SECTIONS
 * into local useState with no persistence/drag. Plan 06-06 replaces that
 * with: an async `loadSections()` resolve-on-mount (starting from
 * DEFAULT_SECTIONS so first paint is never blank), the pure
 * moveBetweenSections/reorderWithinSection reducer driving onDragOver/
 * onDragEnd, and a debounced `scheduleSaveSections` write after every
 * onDragEnd (never on intermediate onDragOver hover frames — RESEARCH.md
 * Pitfall 3).
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

/** WR-02: registers the section body as a dnd-kit droppable under its own
 *  section key — rendered even when the section is EMPTY, so `over.id` can
 *  resolve to a section id and `moveBetweenSections`' section-id branch is
 *  reachable. Without this, dragging the only card out of a section left it
 *  permanently unreachable as a drop target (no droppable node at all). */
function SectionDroppable({ sec, children }: { sec: SectionKey; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: sec });
  return <div ref={setNodeRef}>{children}</div>;
}

export function Home() {
  // Section membership/order — optimistically seeded from DEFAULT_SECTIONS
  // so first paint is never blank, replaced once the async host.storage-
  // equivalent load resolves (T-06-06-01: a corrupt/missing persisted value
  // falls back to DEFAULT_SECTIONS inside loadSections itself).
  const [sections, setSections] = useState<SectionMap>(DEFAULT_SECTIONS);
  const [archiveView, setArchiveView] = useState<"cards" | "list">("cards");
  const [activeId, setActiveId] = useState<string | null>(null);
  // Guards against the async loadSections() resolution clobbering a drag or
  // ＋MAKE CARD mint that lands before the disk read settles (Rule 1 fix):
  // once the user has mutated sections locally, the late-arriving initial
  // load is stale and must not overwrite it with an absolute setSections().
  const dirtyRef = useRef(false);

  useEffect(() => {
    void loadSections().then((loaded) => {
      if (dirtyRef.current) return;
      setSections(loaded);
    });
  }, []);

  // D-06 consumer: approving a proposal + ＋MAKE CARD writes pendingCardMint
  // to shellStore; Home mints a new card into FRESH and clears it.
  const pendingCardMint = useShellStore((s) => s.pendingCardMint);
  useEffect(() => {
    if (!pendingCardMint) return;
    const id = `minted-${nanoid()}`;
    // Register the minted card's def directly in the shared cardDefs
    // registry (a mutable Record, not a readonly const) so every existing
    // lookup site (SortableCard, OverlayCard, HomeCard) resolves it with no
    // extra prop-threading — mirrors the app-lifetime module-singleton
    // pattern already established for Notes' shared store (05-01).
    cardDefs[id] = { kind: "FROM ASSISTANT", mark: "curated", title: pendingCardMint.title, foot: pendingCardMint.foot };
    dirtyRef.current = true;
    setSections((prev) => {
      const next = { ...prev, fresh: [id, ...prev.fresh] };
      scheduleSaveSections(next);
      return next;
    });
    shellStore.getState().clearPendingCardMint();
  }, [pendingCardMint]);

  const onOpen = (to: string) => {
    shellStore.getState().setHomeOpen(false);
    // Best-effort dock open: only known applet keys map to a real panel —
    // real cross-surface navigation is out of scope this plan.
    if (appletDefs[to]) addAppletToDock(to);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    dirtyRef.current = true;
    setSections((prev) => moveBetweenSections(prev, String(active.id), String(over.id)));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) {
      // WR-08: a release outside any droppable still ENDS a drag whose
      // onDragOver hover frames already applied cross-section moves to
      // state (deliberately unsaved per RESEARCH.md Pitfall 3). Persist the
      // settled state so screen and disk agree — otherwise the moved layout
      // survives on screen (dirtyRef blocks the mount load) but silently
      // reverts on restart.
      setSections((prev) => {
        scheduleSaveSections(prev);
        return prev;
      });
      return;
    }
    dirtyRef.current = true;
    setSections((prev) => {
      const next = reorderWithinSection(prev, String(active.id), String(over.id));
      scheduleSaveSections(next);
      return next;
    });
  };

  const onDragCancel = () => setActiveId(null);

  const grid = (sec: SectionKey) => {
    const ids = sections[sec] || [];
    const listMode = sec === "living" || (sec === "archive" && archiveView !== "cards");
    return (
      <SectionDroppable sec={sec}>
        {ids.length === 0 ? (
          <EmptySection />
        ) : (
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <div className={listMode ? styles.listGrid : styles.cardGrid}>
              {ids.map((id) =>
                cardDefs[id] ? (
                  <SortableCard key={id} id={id} sec={sec} listView={archiveView !== "cards"} onOpen={onOpen} />
                ) : null,
              )}
            </div>
          </SortableContext>
        )}
      </SectionDroppable>
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

  const activeSec = activeId ? findSection(sections, activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className={styles.overlay}>
        {SECTION_ORDER.map((sec) => (
          <div key={sec} className={styles.section}>
            <SectionHeader
              label={
                sec === "archive"
                  ? `ARCHIVE · ${(sections.archive || []).length}`
                  : SECTION_LABELS[sec]
              }
              right={sec === "archive" ? archToggle : undefined}
            />
            {grid(sec)}
          </div>
        ))}
      </div>
      <DragOverlay>
        {activeId && activeSec ? (
          <OverlayCard id={activeId} sec={activeSec} listView={archiveView !== "cards"} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
