/**
 * dockZones — pure drop-zone math for rail drag-out-to-dock (D-01). Given a
 * pointer point and a set of live dockview group bounding rects, resolves
 * which group is hovered and whether the point falls in an outer 28% edge
 * band (-> split direction) or the center 44% region (-> tab-join).
 *
 * No DOM access here — the caller (useRailDragOut.ts) is responsible for
 * reading `getBoundingClientRect()` off live dockview groups and passing
 * plain rects in. This keeps the zone math itself deterministic and
 * unit-testable without mocking pointer/DOM APIs (UI-SPEC: outer 28% edges
 * map to left/right/top/bottom, center 44% = tab-join).
 */

export type DockDirection = "left" | "right" | "above" | "below";

export interface DropZoneRect {
  groupId: string;
  rect: { left: number; top: number; width: number; height: number };
}

export interface DropZoneResult {
  referenceGroup: string;
  /** undefined = tab-join (center 44% region) */
  direction: DockDirection | undefined;
}

const EDGE_BAND = 0.28;
// Center region is the remaining 1 - 2*EDGE_BAND = 44% of each axis.

/**
 * resolveDropZone — find the group whose rect contains `point`, then
 * classify the point within that rect's 28%-edge / 44%-center bands.
 * Returns null when no group's rect contains the point (caller falls back
 * to a plain new-tab `addPanel`, per D-01's fallback path).
 */
export function resolveDropZone(
  point: { x: number; y: number },
  groupRects: DropZoneRect[],
): DropZoneResult | null {
  const hit = groupRects.find(({ rect }) => {
    return (
      point.x >= rect.left &&
      point.x <= rect.left + rect.width &&
      point.y >= rect.top &&
      point.y <= rect.top + rect.height
    );
  });
  if (!hit) return null;

  const { groupId, rect } = hit;
  const relX = (point.x - rect.left) / rect.width;
  const relY = (point.y - rect.top) / rect.height;

  // Distance (in normalized 0..1 units) from the point to each edge —
  // whichever edge band the point is deepest into wins on corner overlap,
  // giving deterministic precedence (closest edge takes priority; ties
  // resolve left/right before top/bottom, matching read/scan order).
  const distances: Array<{ direction: DockDirection; distance: number; inBand: boolean }> = [
    { direction: "left", distance: relX, inBand: relX < EDGE_BAND },
    { direction: "right", distance: 1 - relX, inBand: relX > 1 - EDGE_BAND },
    { direction: "above", distance: relY, inBand: relY < EDGE_BAND },
    { direction: "below", distance: 1 - relY, inBand: relY > 1 - EDGE_BAND },
  ];

  const inBand = distances.filter((d) => d.inBand);
  if (inBand.length === 0) {
    // Center 44% x 44% region -> tab-join.
    return { referenceGroup: groupId, direction: undefined };
  }

  // Deterministic corner precedence: smallest distance-to-edge wins; a tie
  // (true corner) breaks left/right before above/below (stable array order).
  inBand.sort((a, b) => a.distance - b.distance);
  return { referenceGroup: groupId, direction: inBand[0].direction };
}
