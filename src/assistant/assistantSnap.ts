/**
 * assistantSnap — pure drag-resize snap thresholds for the Dashboard
 * Assistant's left-edge resize grip (ASST-03, D-03). Mirrors railSnap.ts's
 * pure-fn idiom exactly, but for the RIGHT-hand panel: the raw drag distance
 * is measured from the panel host's own right edge (`hostRect.right -
 * ev.clientX`, computed by the caller in useAssistantResize.ts), not the
 * left-edge formula the rail uses.
 *
 * HIDDEN_W mirrors --asst-closed-w (06-UI-SPEC.md); CLOSE_AT/FULL_AT are the
 * thresholds recovered from the handoff's `startRightResize` (06-RESEARCH.md
 * Pattern 2). These constants are the only source of truth for the
 * thresholds — do not invent or re-derive values elsewhere.
 */

export type AsstSnap = { mode: "closed" } | { mode: "open"; width: number } | { mode: "full" };

export const HIDDEN_W = 6; // matches --asst-closed-w
export const CLOSE_AT = 180; // drag narrower than this -> closed
export const FULL_AT = 620; // raw drag distance from the host's right edge -> full

/**
 * Buckets a raw live drag width (distance from the panel host's right edge)
 * into an assistant snap mode.
 *
 * - raw > FULL_AT (620)                -> full
 * - clamp(raw, HIDDEN_W, hostWidth-160) < CLOSE_AT (180) -> closed
 * - otherwise                          -> open, width = the clamped value
 */
export function snapWidthToAsstMode(raw: number, hostWidth: number): AsstSnap {
  if (raw > FULL_AT) return { mode: "full" };
  const clamped = Math.max(HIDDEN_W, Math.min(hostWidth - 160, raw));
  if (clamped < CLOSE_AT) return { mode: "closed" };
  return { mode: "open", width: clamped };
}
