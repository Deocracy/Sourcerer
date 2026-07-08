/**
 * railSnap — pure drag-resize snap thresholds for the left rail (RAIL-01,
 * DOCK-06 clamp bounds). Mirrors the CSS token values in tokens.css 1:1:
 * --rail-hidden-w, --rail-compact-w, --rail-close-at, --rail-compact-at,
 * --rail-expanded-max. These constants and tokens.css are the only sources
 * of truth for the thresholds — do not invent or re-derive values elsewhere.
 */

export const HIDDEN_W = 6;
export const COMPACT_W = 56;
export const CLOSE_AT = 44;
export const COMPACT_AT = 132;
export const EXPANDED_MAX = 520;

export type RailSnap =
  | { mode: "hidden" }
  | { mode: "compact" }
  | { mode: "expanded"; width: number };

/**
 * Buckets a raw live drag width into a rail mode. Negative input clamps to 0
 * first (a drag can report clientX left of the rail's own edge).
 *
 * - raw < CLOSE_AT (44)          -> hidden
 * - CLOSE_AT <= raw < COMPACT_AT (132) -> compact
 * - raw >= COMPACT_AT            -> expanded, width clamped to EXPANDED_MAX (520)
 */
export function snapWidthToMode(raw: number): RailSnap {
  const clamped = Math.max(0, raw);
  if (clamped < CLOSE_AT) return { mode: "hidden" };
  if (clamped < COMPACT_AT) return { mode: "compact" };
  return { mode: "expanded", width: Math.min(clamped, EXPANDED_MAX) };
}
