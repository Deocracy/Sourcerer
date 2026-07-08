import { useEffect, useRef } from "react";
import { createDockview, type DockviewApi } from "dockview-core";
import "dockview-core/dist/styles/dockview.css";
import { nanoid } from "nanoid";
import { shellStore } from "../store/shellStore";
import { appletDefs } from "./appletDefs";
import { makeRenderer } from "./PanelBody";
import styles from "./Dock.module.css";

// D-02 minimal persistence placeholder — Phase 3 (PERS-01..04) owns the real
// crash-safe/versioned contract. Canary key detects a crash-on-restore layout
// and discards it before it can re-crash (T-02-01).
const LAYOUT_KEY = "sourcerer-dockview-bespoke-v2";
const CANARY_KEY = `${LAYOUT_KEY}:canary`;

/**
 * Dock — mounts dockview-core as the center workspace (D-04: dockview owns
 * tabs, splits, 5-zone docking, and resizers natively; theme only, never
 * reimplement). Wires:
 *  - the `.sourcerer-dock` `--dv-*` theme map (Dock.module.css)
 *  - a "+" tab-bar action that opens a fresh applet instance in the active
 *    group (DOCK-01), using `${key}:${nanoid()}` ids so instances of the same
 *    applet coexist (DOCK-04)
 *  - canary-guarded restore with a Wiki/Library default + 300ms debounced
 *    persist (DOCK-03)
 *  - `onDidActivePanelChange` as the sole focus source of truth (DOCK-05)
 */
export function Dock() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const api: DockviewApi = createDockview(host, {
      className: `dockview-theme-abyss ${styles["sourcerer-dock"]}`,
      createComponent: (opts) => {
        const key = String(opts.name || opts.id).split(":")[0];
        return makeRenderer(key);
      },
      createRightHeaderActionComponent: () => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = styles.addButton;
        el.title = "Open applet";
        el.textContent = "+";
        el.onclick = () => addApplet(nextKey());
        return {
          element: el,
          init: () => {
            /* no group-scoped state needed for the "+" action */
          },
          dispose: () => {
            el.onclick = null;
          },
        };
      },
    });

    // Fresh-instance-per-click helper (DOCK-01/DOCK-04): always a new panel
    // id, never an existing-panel activate, so repeated opens of the same
    // key demonstrably coexist as separate instances.
    function addApplet(key: string) {
      const def = appletDefs[key];
      api.addPanel({
        id: `${key}:${nanoid()}`,
        component: key,
        title: def?.title ?? key,
      });
    }

    // The tab-bar "+" button has no Applet Catalog picker yet (that UI is
    // Phase 4 scope) — it cycles through the shared appletDefs keys so every
    // click still demonstrably "opens a new applet" (DOCK-01) without
    // inventing a picker this phase doesn't own.
    const orderedKeys = Object.keys(appletDefs);
    let keyCursor = 0;
    function nextKey(): string {
      const key = orderedKeys[keyCursor % orderedKeys.length];
      keyCursor += 1;
      return key;
    }

    // --- Canary-guarded restore + Wiki/Library default (DOCK-03, D-02) ---
    let restored = false;
    try {
      if (localStorage.getItem(CANARY_KEY)) {
        // Previous restore crashed before clearing its own canary — the
        // saved layout is presumed poisoned, drop it.
        localStorage.removeItem(LAYOUT_KEY);
      }
      localStorage.setItem(CANARY_KEY, "1");
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (raw) {
        api.fromJSON(JSON.parse(raw));
        restored = true;
      }
    } catch {
      restored = false;
      try {
        api.clear();
      } catch {
        /* best-effort recovery only */
      }
      try {
        localStorage.removeItem(LAYOUT_KEY);
      } catch {
        /* best-effort recovery only */
      }
    }
    const canaryTimer = setTimeout(() => {
      try {
        localStorage.removeItem(CANARY_KEY);
      } catch {
        /* best-effort cleanup only */
      }
    }, 4000);

    if (!restored || api.panels.length === 0) {
      try {
        api.clear();
      } catch {
        /* best-effort reset only */
      }
      addApplet("Wiki");
      addApplet("Library");
    }

    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    const layoutDisposable = api.onDidLayoutChange(() => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try {
          localStorage.setItem(LAYOUT_KEY, JSON.stringify(api.toJSON()));
        } catch {
          // persistence is best-effort scaffolding in Phase 2 (D-02); ignore
          // quota/serialization errors (T-02-08 debounce already coalesces
          // write frequency).
        }
      }, 300);
    });

    // Focus (DOCK-05): dockview's own event is the sole source of truth —
    // no bespoke focus tracking.
    const focusDisposable = api.onDidActivePanelChange((panel) => {
      const activeKey = panel ? String(panel.id).split(":")[0] : null;
      shellStore.getState().setRailApplet(activeKey);
      shellStore.getState().setActivePaneId(panel ? panel.id : null);
    });

    return () => {
      if (saveTimer) clearTimeout(saveTimer);
      clearTimeout(canaryTimer);
      layoutDisposable.dispose();
      focusDisposable.dispose();
      api.dispose();
    };
  }, []);

  return (
    <div className={styles.host}>
      <div ref={hostRef} className={styles.mount} />
    </div>
  );
}
