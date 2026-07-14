import { useCallback, useRef, useState } from "react";
import { shellStore } from "../store/shellStore";
import { HIDDEN_W, snapWidthToAsstMode, type AsstSnap } from "./assistantSnap";

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
  // GAP-1 (06-HUMAN-UAT.md): the panel previously only re-rendered its width
  // on pointerup, so the grip drag felt janky (the panel snapped to its
  // final width on release instead of following the pointer). liveWidth is
  // the clamped raw drag distance recomputed on every pointermove — mirrors
  // the prototype's startRightResize move() setting rightLiveW every frame.
  const [liveWidth, setLiveWidth] = useState<number | null>(null);

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
        const clamped = Math.max(HIDDEN_W, Math.min(hostWidth - 160, raw));
        setLiveWidth(clamped);
        setLiveSnap(snapWidthToAsstMode(raw, hostWidth));
        // Prototype's move() calls this.relayout() every frame so the
        // dockview workspace reflows in step with the drag. There's no
        // direct relayout() handle here — dispatching a window resize event
        // is dockview-core's own documented resize hook, and this listener
        // is torn down with everything else in teardown() below (T-06g1-02:
        // bounded to the drag lifetime, no runaway listener).
        window.dispatchEvent(new Event("resize"));
      };

      // WR-06: shared teardown for BOTH the normal release and a cancelled
      // drag (window blur, OS gesture, touch cancel, element removal). An
      // interrupted drag previously left the move/up listeners attached
      // (stacking a second set on the next pointerdown) and pinned the
      // "LET GO TO SNAP" cue via a never-cleared liveSnap.
      const teardown = () => {
        try {
          target.releasePointerCapture(pointerId);
        } catch {
          // Capture already lost (that's often WHY the drag cancelled).
        }
        target.removeEventListener("pointermove", handleMove);
        target.removeEventListener("pointerup", handleUp);
        target.removeEventListener("pointercancel", handleCancel);
        setLiveWidth(null);
        setLiveSnap(null);
      };

      const handleUp = (ev: PointerEvent) => {
        teardown();
        const raw = hostRight - ev.clientX;
        const snap = snapWidthToAsstMode(raw, hostWidth);
        applySnapToShellStore(snap, hostWidth);
      };

      // A cancelled drag tears down WITHOUT applying a snap — the panel
      // stays at its pre-drag width.
      const handleCancel = () => teardown();

      target.addEventListener("pointermove", handleMove);
      target.addEventListener("pointerup", handleUp);
      target.addEventListener("pointercancel", handleCancel);
    },
    [applySnapToShellStore],
  );

  const reopen = useCallback(() => {
    shellStore.getState().setAssistantOpen(true);
    if (shellStore.getState().asstWidth < 44) {
      shellStore.getState().setAsstWidth(REOPEN_DEFAULT_WIDTH);
    }
  }, []);

  return { hostRef, onResizePointerDown, liveSnap, liveWidth, reopen };
}
