import { useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CardBody, CardFrame } from "./HomeCard";
import { cardDefs } from "./cardDefs";
import type { SectionKey } from "./cardDefs";

/*
 * SortableCard.tsx — ported from the design handoff's `home-cards.js`
 * `SortableCard`/`OverlayCard` (lines 234-261), wrapping `CardFrame`/`CardBody`
 * (Plan 06-05) in dnd-kit's `useSortable` hook (HOME-02). Click-to-open is
 * guarded against a click firing immediately after a drag release (the
 * reference's 250ms `lastDrag` guard), so releasing a drag over the same
 * card doesn't also trigger its open action.
 */

export interface SortableCardProps {
  id: string;
  sec: SectionKey;
  listView?: boolean;
  onOpen: (to: string) => void;
}

export function SortableCard({ id, sec, listView, onOpen }: SortableCardProps) {
  const t = cardDefs[id];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const body = CardBody({ t });
  const lastDrag = useRef(0);
  if (isDragging) lastDrag.current = Date.now();

  if (!t) return null;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.25 : 1,
  };
  const extra = {
    ...attributes,
    ...listeners,
    title: "Drag to move · click to open",
    onClick: () => {
      if (Date.now() - lastDrag.current < 250) return;
      if (body.onClickExtra) {
        body.onClickExtra();
        return;
      }
      if (t.to) onOpen(t.to);
    },
  };

  return <CardFrame t={t} sec={sec} listView={listView} body={body} style={style} innerRef={setNodeRef} extra={extra} />;
}

export interface OverlayCardProps {
  id: string;
  sec: SectionKey;
  listView?: boolean;
}

/** OverlayCard — the drag-ghost rendered inside dnd-kit's `<DragOverlay>`,
 *  ported verbatim (home-cards.js lines 256-261): a slightly scaled, shadowed
 *  copy of the card, no drag/click wiring of its own. */
export function OverlayCard({ id, sec, listView }: OverlayCardProps) {
  const t = cardDefs[id];
  const body = CardBody({ t });
  if (!t) return null;
  return (
    <div
      style={{
        width: t.span === 2 ? 356 : 176,
        transform: "scale(1.05)",
        boxShadow: "0 18px 44px rgba(0,0,0,0.65)",
        opacity: 0.95,
      }}
    >
      <CardFrame t={t} sec={sec} listView={listView} body={body} style={{ gridColumn: "auto" }} extra={{}} />
    </div>
  );
}
