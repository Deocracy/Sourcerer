import { createRoot, type Root } from "react-dom/client";
import { appletDefs } from "./appletDefs";
import styles from "./PanelBody.module.css";

export interface PanelBodyProps {
  appletKey: string;
}

/**
 * PanelBody — the generic placeholder panel body (UI-SPEC "Panel body
 * dispatch"): an "APPLET · {TITLE}" mono eyebrow, glyph tile + serif title,
 * a description line, and a dashed note box. Looks up `appletDefs[appletKey]`,
 * falling back to a generic def for unrecognized keys (T-02-09 — dispatch
 * never crashes on an unexpected id). Phase 2 only builds this branch; real
 * applet bodies (Wiki/Library/Notes/etc.) replace it per-key in Phase 4/5.
 */
export function PanelBody({ appletKey }: PanelBodyProps) {
  const def = appletDefs[appletKey] ?? { glyph: "◌", title: appletKey, line: "" };

  return (
    <div className={styles.host}>
      <div className={styles.wrap}>
        <div className={styles.eyebrow}>APPLET · {def.title.toUpperCase()}</div>
        <div className={styles.header}>
          <div className={styles.glyphTile}>{def.glyph}</div>
          <div className={styles.title}>{def.title}</div>
        </div>
        <div className={styles.desc}>{def.line}</div>
        <div className={styles.noteBox}>
          BESPOKE RAILS · CENTER DOCK
          <br />
          · dockview owns tabs, splits, docking, and resizers natively (D-04)
          <br />
          · real applet bodies replace this placeholder per key (Phase 4/5)
          <br />· drag a tab to reorder, or between bars/zones to dock
        </div>
      </div>
    </div>
  );
}

export interface DockContentRenderer {
  element: HTMLElement;
  init: () => void;
  dispose: () => void;
}

/**
 * makeRenderer — the dockview `createComponent` dispatcher's content-renderer
 * factory. Phase 2 only implements the generic-placeholder branch: mounts a
 * React root over `<PanelBody />` into a fresh container element that
 * dockview owns and disposes. Real per-applet dispatch (Wiki -> mountWiki,
 * etc.) is a Phase 4/5 seam to add alongside this fallback, not replace it.
 */
export function makeRenderer(appletKey: string): DockContentRenderer {
  const element = document.createElement("div");
  element.style.height = "100%";

  let root: Root | null = createRoot(element);
  root.render(<PanelBody appletKey={appletKey} />);

  return {
    element,
    init: () => {
      /* no per-panel init needed for the generic placeholder body */
    },
    dispose: () => {
      root?.unmount();
      root = null;
    },
  };
}
