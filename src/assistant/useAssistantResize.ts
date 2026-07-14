import { useCallback, useRef, useState } from "react";
import { shellStore } from "../store/shellStore";
import { snapWidthToAsstMode, type AsstSnap } from "./assistantSnap";

const REOPEN_DEFAULT_WIDTH = 280; // matches --asst-width-default

/**
 * useAssistantResize — bespoke pointer-capture resize for the Dashboard
 * Assistant's left-edge grip (ASST-03, D-03). Mirrors useRailDrag's
 * onResizePointerDown flow (setPointerCapture on the grip, never window-level
 * listeners), but INVERTS the drag formula: the assistant is the RIGHT-hand
 * panel, so the raw drag distance is measured from the panel host's own
 * right edge (`hostRect.right - ev.clientX`), not `ev.clientX - navLeft`.
 *
 * The final snap is recomputed fresh on pointerup (not read from the last
 * live value) — protects a fast flick from under-sampling the move handler,
 * same rationale as useRailDrag.
 */
export function useAssistantResize() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [liveSnap, setLiveSnap] = useState<AsstSnap | null>(null);

  const applySnapToShellStore = useCallback((snap: AsstSnap, hostWidth: number) => {
    if (snap.mode === "closed") {
      shellStore.getState().setAssistantOpen(false);
      return;
    }
    if (snap.mode === "open") {
      shellStore.getState().setAssistantOpen(true);
      shellStore.getState().setAsstWidth(snap.width);
      return;
    }
    // full
    shellStore.getState().setAssistantOpen(true);
    shellStore.getState().setAsstWidth(Math.max(0, hostWidth - 160));
  }, []);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const target = e.currentTarget;
      const pointerId = e.pointerId;
      target.setPointerCapture(pointerId);
      const hostRect = hostRef.current?.getBoundingClientRect();
      const hostRight = hostRect ? hostRect.right : window.innerWidth;
      // CR-01: the snap math (assistantSnap.ts) expects the WORKSPACE-scale
      // drag-context width — its open clamp is `hostWidth - 160` and FULL_AT
      // is 620px. Measuring the panel's OWN width here (the old
      // `hostRect.width`) made the "open" bucket unreachable at the default
      // 280px width (clamp upper bound 120 < CLOSE_AT 180) and snapped
      // "full" to 120px (or 0px from the 6px closed strip). The window width
      // is the correct drag-context reference: the grip drags against the
      // whole window, mirroring useRailDrag's viewport-scale nav reference.
      const hostWidth = window.innerWidth;

      const handleMove = (ev: PointerEvent) => {
        const raw = hostRight - ev.clientX;
        setLiveSnap(snapWidthToAsstMode(raw, hostWidth));
      };

      const handleUp = (ev: PointerEvent) => {
        target.releasePointerCapture(pointerId);
        target.removeEventListener("pointermove", handleMove);
        target.removeEventListener("pointerup", handleUp);
        setLiveSnap(null);
        const raw = hostRight - ev.clientX;
        const snap = snapWidthToAsstMode(raw, hostWidth);
        applySnapToShellStore(snap, hostWidth);
      };

      target.addEventListener("pointermove", handleMove);
      target.addEventListener("pointerup", handleUp);
    },
    [applySnapToShellStore],
  );

  const reopen = useCallback(() => {
    shellStore.getState().setAssistantOpen(true);
    if (shellStore.getState().asstWidth < 44) {
      shellStore.getState().setAsstWidth(REOPEN_DEFAULT_WIDTH);
    }
  }, []);

  return { hostRef, onResizePointerDown, liveSnap, reopen };
}
