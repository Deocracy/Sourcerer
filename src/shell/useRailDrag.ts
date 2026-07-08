import { useCallback, useEffect, useRef, useState } from "react";
import { shellStore } from "../store/shellStore";
import { snapWidthToMode, type RailSnap } from "./railSnap";

/**
 * useRailDrag — bespoke pointer-capture resize + keyboard/double-click mode
 * cycling for the left rail (RAIL-01). Uses `setPointerCapture` on the
 * captured element rather than window mouse listeners (CLAUDE.md's locked
 * bespoke-pointer-events pattern for the rail/assistant), mirroring the
 * native-event->React state bridging idiom in useMaximizedState.ts.
 *
 * Row reorder + pin wiring (RAIL-02) is added in plan 02-04 Task 3.
 */
export function useRailDrag() {
  const navElRef = useRef<HTMLElement | null>(null);
  const [liveSnap, setLiveSnap] = useState<RailSnap | null>(null);

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
    };

    const handleUp = (ev: PointerEvent) => {
      target.releasePointerCapture(pointerId);
      target.removeEventListener("pointermove", handleMove);
      target.removeEventListener("pointerup", handleUp);
      setLiveSnap(null);
      const raw = Math.max(0, Math.min(520, ev.clientX - navLeft));
      const snap = snapWidthToMode(raw);
      shellStore.getState().setRailMode(snap.mode);
      if (snap.mode === "expanded") shellStore.getState().setRailWidth(snap.width);
    };

    target.addEventListener("pointermove", handleMove);
    target.addEventListener("pointerup", handleUp);
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

  return { navRef, liveSnap, onResizePointerDown, onResizeDoubleClick };
}
