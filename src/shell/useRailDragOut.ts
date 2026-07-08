import { useCallback, useRef, useState } from "react";
import { shellStore } from "../store/shellStore";
import { getVisualRailOrder } from "./useRailDrag";
import { resolveDropZone, type DockDirection } from "./dockZones";
import { getDockGroupRects, addAppletToDock } from "./Dock";

const REORDER_THRESHOLD = 5;

export interface RowDragState {
  key: string;
  targetIndex: number;
}

export interface GhostState {
  key: string;
  x: number;
  y: number;
}

export interface OverlayState {
  rect: { left: number; top: number; width: number; height: number };
  direction: DockDirection | undefined;
}

/**
 * useRailDragOut — extends the rail's row pointer drag (5px-threshold,
 * setPointerCapture) with a drag-OUT branch (D-01): once the pointer crosses
 * past the rail's right edge into the workspace, the gesture switches from
 * within-rail reorder into docking mode — a floating ghost follows the
 * cursor and a green 28%-zone overlay previews the drop target, resolved via
 * the pure `resolveDropZone` against live dockview group rects
 * (`Dock.tsx`'s `getDockGroupRects`). On release, a resolved zone docks via
 * `addAppletToDock` — a thin wrapper over dockview's own
 * `api.addPanel({ position: { referenceGroup, direction } })` — with
 * `{referenceGroup, direction}`; an unresolved zone
 * OR any thrown error during zone computation falls back to a plain new-tab
 * `addAppletToDock(key)` (T-02-10 — a fragile preview never blocks docking).
 *
 * Supersedes `useRailDrag.ts`'s own `onRowPointerDown`/`rowDrag` for rows
 * that opt into drag-out — within-rail reorder (still below the rail's
 * right edge) is reimplemented here via the same shared `getVisualRailOrder`
 * helper so both hooks agree on drop-index semantics; `useRailDrag.ts` is
 * left untouched and still owns resize/keyboard-cycling/pin.
 */
export function useRailDragOut() {
  const navElRef = useRef<HTMLElement | null>(null);
  const [rowDrag, setRowDrag] = useState<RowDragState | null>(null);
  const [ghost, setGhost] = useState<GhostState | null>(null);
  const [overlay, setOverlay] = useState<OverlayState | null>(null);

  const navRef = useCallback((el: HTMLElement | null) => {
    navElRef.current = el;
  }, []);

  const dropIndexFromY = useCallback((y: number): number => {
    const nav = navElRef.current;
    if (!nav) return 0;
    const rows = Array.from(nav.querySelectorAll<HTMLElement>("[data-rail-row]"));
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return rows.length;
  }, []);

  /** resolveLiveZone — reads current dockview group rects and resolves the
   * drop zone for `point`; any thrown error resolves to null (T-02-10). */
  const resolveLiveZone = useCallback((point: { x: number; y: number }) => {
    try {
      return resolveDropZone(point, getDockGroupRects());
    } catch {
      return null;
    }
  }, []);

  const onRowPointerDown = useCallback(
    (key: string, e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const target = e.currentTarget;
      const startX = e.clientX;
      const startY = e.clientY;
      let moved = false;
      let capturedId: number | null = null;
      let targetIndex: number | null = null;
      let draggingOut = false;

      const handleMove = (ev: PointerEvent) => {
        if (!moved) {
          if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < REORDER_THRESHOLD) return;
          moved = true;
          capturedId = ev.pointerId;
          target.setPointerCapture(capturedId);
        }

        const navRect = navElRef.current?.getBoundingClientRect();
        const pastRailEdge = navRect ? ev.clientX > navRect.right : false;

        if (pastRailEdge) {
          draggingOut = true;
          setRowDrag(null);
          setGhost({ key, x: ev.clientX, y: ev.clientY });
          const zone = resolveLiveZone({ x: ev.clientX, y: ev.clientY });
          if (zone) {
            const groupRect = getDockGroupRects().find((g) => g.groupId === zone.referenceGroup);
            setOverlay(groupRect ? { rect: groupRect.rect, direction: zone.direction } : null);
          } else {
            setOverlay(null);
          }
          return;
        }

        draggingOut = false;
        setGhost(null);
        setOverlay(null);
        targetIndex = dropIndexFromY(ev.clientY);
        setRowDrag({ key, targetIndex });
      };

      const handleUp = (ev: PointerEvent) => {
        target.removeEventListener("pointermove", handleMove);
        target.removeEventListener("pointerup", handleUp);
        if (capturedId != null) target.releasePointerCapture(capturedId);
        setRowDrag(null);
        setGhost(null);
        setOverlay(null);

        if (!moved) {
          // Below the 5px threshold — treat as a click that opens/focuses the applet.
          shellStore.getState().setRailApplet(key);
          return;
        }

        if (draggingOut) {
          const zone = resolveLiveZone({ x: ev.clientX, y: ev.clientY });
          if (zone) {
            addAppletToDock(key, { referenceGroup: zone.referenceGroup, direction: zone.direction });
          } else {
            // D-01 fallback: no group under the pointer (or zone resolution
            // threw) — dock as a plain new tab rather than blocking the drop.
            addAppletToDock(key);
          }
          return;
        }

        if (targetIndex == null) return;

        const { railOrder, leftRailPinned } = shellStore.getState();
        const visual = getVisualRailOrder(railOrder, leftRailPinned);
        const from = railOrder.indexOf(key);
        if (from === -1) return;

        let to: number;
        if (targetIndex >= visual.length) {
          to = railOrder.length; // dropped past the end -> append
        } else {
          const targetKey = visual[targetIndex];
          to = targetKey === key ? from : railOrder.indexOf(targetKey);
        }
        if (to > from) to -= 1; // arrayMove semantics: removing `from` shifts later indices down
        to = Math.max(0, Math.min(railOrder.length - 1, to));

        shellStore.getState().reorderRail(from, to);
      };

      target.addEventListener("pointermove", handleMove);
      target.addEventListener("pointerup", handleUp);
    },
    [dropIndexFromY, resolveLiveZone],
  );

  return { navRef, rowDrag, onRowPointerDown, ghost, overlay };
}
