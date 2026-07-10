import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useShellStore, shellStore } from "../store/shellStore";
import { registry } from "./registry";
import { appletDefs } from "./appletDefs";
import { hostOpen } from "../host/open";
import styles from "./AppletCatalog.module.css";

/**
 * AppletCatalog — the registry-fed Applet Catalog picker (D-18, FWK-02).
 * Replaces the Dock tab-bar '+' cycling hack and the Rail footer's no-op
 * stub with one shared component, mirroring LayoutsMenu.tsx's dropdown
 * pattern (open/close state, WR-06 focus-into-panel, document mousedown
 * click-outside + Escape, ArrowUp/ArrowDown + Enter keyboard nav).
 *
 * Mounted exactly once in AppShell.tsx; both triggers (Dock '+' and Rail
 * footer row/icon) call shellStore's openAppletCatalog() rather than each
 * owning a separate picker instance (04-RESEARCH.md Pitfall 5).
 */
export function AppletCatalog() {
  const open = useShellStore((s) => s.catalogOpen);
  const anchor = useShellStore((s) => s.catalogAnchor);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Rows sourced from `registry` manifests, ordered by appletDefs' stable
  // key order (single source of truth — never re-derive glyph/title/desc).
  const keys = Object.keys(appletDefs).filter((key) => registry[key]);
  const rows = keys.map((key) => registry[key].manifest);

  useEffect(() => {
    if (!open) return;
    setFocusedIndex(-1);
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        shellStore.getState().closeAppletCatalog();
      }
    }
    function onDocKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") shellStore.getState().closeAppletCatalog();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, [open]);

  // WR-06: move focus INTO the panel when it opens so onKeyDown fires.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  function handleOpen(key: string) {
    hostOpen(key);
    shellStore.getState().closeAppletCatalog();
  }

  function handlePanelKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      shellStore.getState().closeAppletCatalog();
      return;
    }
    if (rows.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((idx) => Math.min(idx + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((idx) => Math.max(idx - 1, 0));
    } else if (e.key === "Enter") {
      if (focusedIndex >= 0 && focusedIndex < rows.length) {
        handleOpen(rows[focusedIndex].key);
      }
    }
  }

  // WR-06: clamp the anchored panel into the viewport. The Dock '+' trigger
  // sits at the RIGHT end of every tab bar, so a raw {top,left} pushes most
  // of the 220-320px panel past the window's right edge for right-half
  // groups (and below the bottom edge for bottom groups), leaving rows
  // unreachable. 328 = max panel width / max list height (320) + breathing
  // room for the 1px borders; 8px minimum keeps it off the window edge.
  const CLAMP_EXTENT = 328;
  const panelStyle = anchor
    ? {
        position: "fixed" as const,
        top: Math.max(8, Math.min(anchor.y, window.innerHeight - CLAMP_EXTENT)),
        left: Math.max(8, Math.min(anchor.x, window.innerWidth - CLAMP_EXTENT)),
      }
    : undefined;

  return (
    <div className={styles.root} ref={rootRef}>
      <div
        className={styles.panel}
        style={panelStyle}
        role="menu"
        tabIndex={-1}
        aria-label="Applet Catalog"
        ref={panelRef}
        onKeyDown={handlePanelKeyDown}
      >
        <div className={styles.list}>
          {rows.map((manifest, i) => (
            <div
              key={manifest.key}
              role="menuitem"
              tabIndex={-1}
              className={i === focusedIndex ? `${styles.row} ${styles.focused}` : styles.row}
              onClick={() => handleOpen(manifest.key)}
            >
              <span className={styles.glyph}>{manifest.glyph}</span>
              <span className={styles.text}>
                <span className={styles.title}>{manifest.title}</span>
                <span className={styles.desc}>{manifest.desc}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
