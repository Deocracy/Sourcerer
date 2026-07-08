import { appletDefs } from "./appletDefs";
import type { DockDirection } from "./dockZones";
import styles from "./RailDragGhost.module.css";

export interface OverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const EDGE_BAND = 0.28;
const CENTER_BAND = 0.44;

/**
 * overlayGeometry — maps a resolved drop zone (edge direction or tab-join)
 * back to a screen-space rect for the green preview, mirroring the same
 * 28%-edge / 44%-center bands `dockZones.resolveDropZone` used to classify
 * the pointer in the first place.
 */
function overlayGeometry(rect: OverlayRect, direction: DockDirection | undefined): OverlayRect {
  const { left, top, width, height } = rect;
  switch (direction) {
    case "left":
      return { left, top, width: width * EDGE_BAND, height };
    case "right":
      return { left: left + width * (1 - EDGE_BAND), top, width: width * EDGE_BAND, height };
    case "above":
      return { left, top, width, height: height * EDGE_BAND };
    case "below":
      return { left, top: top + height * (1 - EDGE_BAND), width, height: height * EDGE_BAND };
    default: {
      // Tab-join (center 44% x 44%) — highlight the center region itself.
      const cw = width * CENTER_BAND;
      const ch = height * CENTER_BAND;
      return { left: left + (width - cw) / 2, top: top + (height - ch) / 2, width: cw, height: ch };
    }
  }
}

/**
 * RailDragGhost — floating cursor ghost (glyph + title, `#131418` bg /
 * `#26272B` border) shown while a rail item is being dragged out past the
 * rail's right edge (D-01).
 */
export function RailDragGhost({
  appletKey,
  x,
  y,
}: {
  appletKey: string;
  x: number;
  y: number;
}) {
  const def = appletDefs[appletKey];
  return (
    <div className={styles.ghost} style={{ left: x + 14, top: y + 14 }}>
      <span className={styles.glyph}>{def?.glyph ?? "•"}</span>
      <span className={styles.title}>{def?.title ?? appletKey}</span>
    </div>
  );
}

/**
 * DropZoneOverlay — the green 28%-edge / 44%-center drop preview drawn over
 * the hovered dockview group during a rail drag-out (D-01). `direction`
 * undefined means the pointer is in the center tab-join region.
 */
export function DropZoneOverlay({
  rect,
  direction,
}: {
  rect: OverlayRect;
  direction: DockDirection | undefined;
}) {
  const geom = overlayGeometry(rect, direction);
  return (
    <div
      className={styles.overlay}
      style={{ left: geom.left, top: geom.top, width: geom.width, height: geom.height }}
    />
  );
}
