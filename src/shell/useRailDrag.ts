import { useCallback, useEffect, useRef, useState } from "react";
import { shellStore } from "../store/shellStore";
import { snapWidthToMode, type RailSnap } from "./railSnap";

const REORDER_THRESHOLD = 5;

export interface RowDragState {
  key: string;
  targetIndex: number;
}

/**
 * getVisualRailOrder — the render order for rail rows: unpinned keys (in
 * railOrder's relative order) followed by pinned keys (RAIL-02's "pinned
 * items render in the always-last bottom group"). Shared between Rail.tsx's
 * render and this hook's reorder math so both agree on what "row index N"
 * means when translating a drop position back into a railOrder index.
 */
export function getVisualRailOrder(railOrder: string[], pinned: string[]): string[] {
  const main = railOrder.filter((k) => !pinned.includes(k));
  const tail = railOrder.filter((k) => pinned.includes(k));
  return [...main, ...tail];
}

/**
 * useRailDrag — bespoke pointer-capture resize + keyboard/double-click mode
 * cycling, plus within-rail row reorder, for the left rail (RAIL-01, RAIL-02).
 * Uses `setPointerCapture` on the captured element rather than window mouse
 * listeners (CLAUDE.md's locked bespoke-pointer-events pattern for the
 * rail/assistant), mirroring the native-event->React state bridging idiom in
 * useMaximizedState.ts.
 */
export function useRailDrag() {
  const navElRef = useRef<HTMLElement | null>(null);
  const [liveSnap, setLiveSnap] = useState<RailSnap | null>(null);
  const [rowDrag, setRowDrag] = useState<RowDragState | null>(null);

  const navRef = useCallback((el: HTMLElement | null) => {
    navElRef.current = el;
  }, []);

  const onResizePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const target = e.currentTarget;
    const pointerId = e.pointerId;
    target.setPointerCapture(pointerId);
    const navRect = navElRef.current?.getBoundingClientRect();
    const navLeft = navRect ? navRect.left : 0;

    const handleMove = (ev: PointerEvent) => {
      const raw = Math.max(0, Math.min(520, ev.clientX - navLeft));
      setLiveSnap(snapWidthToMode(raw));
      // GAP-2 (06-HUMAN-UAT.md): the prototype's startRailResize calls
      // relayout() on EVERY pointermove so the center dock reflows in step
      // with the rail width; without it the dock visibly lags the rail
      // during the drag (the reported jank/tearing). There's no direct
      // relayout() handle here — dispatching a window resize event is
      // dockview-core's own documented resize hook (mirrors useAssistantResize's
      // identical fix for GAP-1/T-06g1-02). Bounded to the drag lifetime by
      // teardown() below, so no runaway resize storm after the drag ends
      // (T-06g2-01).
      window.dispatchEvent(new Event("resize"));
    };

    // WR-06 parity: shared teardown for BOTH the normal release and a
    // cancelled drag (window blur, OS gesture, touch cancel, element
    // removal). Previously an interrupted drag left the move/up listeners
    // attached (stacking a second set on the next pointerdown) and pinned
    // the live snap cue via a never-cleared liveSnap (T-06g2-02).
    const teardown = () => {
      try {
        target.releasePointerCapture(pointerId);
      } catch {
        // Capture already lost (that's often WHY the drag cancelled).
      }
      target.removeEventListener("pointermove", handleMove);
      target.removeEventListener("pointerup", handleUp);
      target.removeEventListener("pointercancel", handleCancel);
      setLiveSnap(null);
    };

    const handleUp = (ev: PointerEvent) => {
      teardown();
      const raw = Math.max(0, Math.min(520, ev.clientX - navLeft));
      const snap = snapWidthToMode(raw);
      shellStore.getState().setRailMode(snap.mode);
      if (snap.mode === "expanded") shellStore.getState().setRailWidth(snap.width);
    };

    // A cancelled drag tears down WITHOUT applying a snap — the rail stays
    // at its pre-drag mode/width.
    const handleCancel = () => teardown();

    target.addEventListener("pointermove", handleMove);
    target.addEventListener("pointerup", handleUp);
    target.addEventListener("pointercancel", handleCancel);
  }, []);

  const onResizeDoubleClick = useCallback(() => {
    shellStore.getState().cycleRailMode();
  }, []);

  // Cmd-backslash / Ctrl-backslash cycles the rail mode from anywhere in the
  // document, matching the .dc.html prototype's global keydown listener.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "\\" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        shellStore.getState().cycleRailMode();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ---- within-rail row reorder (RAIL-02) ----
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

  const onRowPointerDown = useCallback(
    (key: string, e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const target = e.currentTarget;
      const startX = e.clientX;
      const startY = e.clientY;
      let moved = false;
      let capturedId: number | null = null;
      let targetIndex: number | null = null;

      const handleMove = (ev: PointerEvent) => {
        if (!moved) {
          if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < REORDER_THRESHOLD) return;
          moved = true;
          capturedId = ev.pointerId;
          target.setPointerCapture(capturedId);
        }
        targetIndex = dropIndexFromY(ev.clientY);
        setRowDrag({ key, targetIndex });
      };

      const handleUp = () => {
        target.removeEventListener("pointermove", handleMove);
        target.removeEventListener("pointerup", handleUp);
        if (capturedId != null) target.releasePointerCapture(capturedId);
        setRowDrag(null);

        if (!moved) {
          // Below the 5px threshold — treat as a click that opens/focuses the applet.
          shellStore.getState().setRailApplet(key);
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
    [dropIndexFromY],
  );

  // ---- pin affordance (RAIL-02) ----
  const togglePin = useCallback((key: string) => {
    shellStore.getState().togglePin(key);
  }, []);

  return {
    navRef,
    liveSnap,
    onResizePointerDown,
    onResizeDoubleClick,
    rowDrag,
    onRowPointerDown,
    togglePin,
  };
}
