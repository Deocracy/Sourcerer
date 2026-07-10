import { useEffect, useRef } from "react";
import { createDockview, type DockviewApi, type SerializedDockview } from "dockview-core";
import "dockview-core/dist/styles/dockview.css";
import { shellStore, getRailSubset, hydrateFromDisk } from "../store/shellStore";
import {
  flushPendingSave,
  loadWorkspaceRecord,
  registerStateSources,
  scheduleWorkspaceSave,
  setRestoreCanary,
} from "../persistence/workspaceStore";
import { appletDefs } from "./appletDefs";
import { dockApiRef, addAppletToDock } from "./dockApi";
import { makeRenderer } from "./PanelBody";
import styles from "./Dock.module.css";

export interface DockGroupRect {
  groupId: string;
  rect: { left: number; top: number; width: number; height: number };
}

/** getDockGroupRects — live dockview group bounding rects for zone math
 * (resolveDropZone consumes these). Returns [] before the dock has mounted. */
export function getDockGroupRects(): DockGroupRect[] {
  const api = dockApiRef.current;
  if (!api) return [];
  return api.groups.map((group) => {
    const r = group.element.getBoundingClientRect();
    return {
      groupId: group.id,
      rect: { left: r.left, top: r.top, width: r.width, height: r.height },
    };
  });
}

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

    dockApiRef.current = api;

    // Single seam call site merging dock-tree + rail getters (03-PATTERNS.md:
    // neither getter must clobber the other). restoreDockTree (03-04) applies
    // a saved-layout/default snapshot to the live dockview instance, reusing
    // this same try/catch-guarded fromJSON + Wiki/Library-default fallback
    // shape as the mount-effect restore below (T-03-01).
    registerStateSources({
      getDockTree: () => (dockApiRef.current ? dockApiRef.current.toJSON() : null),
      getRail: getRailSubset,
      restoreDockTree: (json) => {
        const liveApi = dockApiRef.current;
        if (!liveApi) return false;
        let restored = false;
        if (json != null) {
          try {
            liveApi.fromJSON(json as SerializedDockview);
            restored = liveApi.panels.length > 0;
          } catch {
            restored = false;
          }
        }
        if (!restored) {
          try {
            liveApi.clear();
          } catch {
            /* best-effort reset only */
          }
          addApplet("Wiki");
          addApplet("Library");
        }
        return restored;
      },
    });

    // Fresh-instance-per-click helper (DOCK-01/DOCK-04): always a new panel
    // id, never an existing-panel activate, so repeated opens of the same
    // key demonstrably coexist as separate instances. Delegates to the
    // shared module-scope helper so the rail drag-out hook (D-01) reuses the
    // exact same panel-creation path, just with a `position` argument.
    function addApplet(key: string) {
      addAppletToDock(key);
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

    // --- Canary-guarded restore + Wiki/Library default (DOCK-03, re-homed
    // onto the workspace.json record's restoreCanary field, T-03-01) ---
    let cancelled = false;
    let canaryTimer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      const record = await loadWorkspaceRecord();
      if (cancelled || dockApiRef.current !== api) return; // effect cleanup raced the async load

      let restored = false;
      if (record.restoreCanary) {
        // Previous restore crashed before clearing its own canary — the
        // persisted dockTree is presumed poisoned, drop it (never re-applied).
        // The canary has now served its purpose: clear it in memory (CR-01)
        // so the reset flush below persists restoreCanary:false instead of
        // perpetuating the trip into every subsequent launch.
        restored = false;
        setRestoreCanary(false);
      } else if (record.dockTree != null) {
        try {
          api.fromJSON(record.dockTree as SerializedDockview);
          restored = api.panels.length > 0;
        } catch {
          restored = false;
          try {
            api.clear();
          } catch {
            /* best-effort recovery only */
          }
        }
      }

      if (restored) {
        // Arm the canary before the crash window, clear it ~4s later — both
        // writes routed through the single flush authority (CR-03): set the
        // canary in memory, then let scheduleWorkspaceSave/flushPendingSave
        // assemble the record from the LIVE getters + CURRENT inMemory
        // slices. Never a hand-built record here — a boot-time snapshot
        // would clobber savedLayouts/instanceState mutated inside the
        // window (e.g. a layout saved in the first 4 seconds).
        setRestoreCanary(true);
        scheduleWorkspaceSave();
        canaryTimer = setTimeout(() => {
          if (dockApiRef.current !== api) return; // cleanup raced the timer
          setRestoreCanary(false);
          void flushPendingSave(); // reads live getters + current slices
        }, 4000);
      } else {
        try {
          api.clear();
        } catch {
          /* best-effort reset only */
        }
        addApplet("Wiki");
        addApplet("Library");
        scheduleWorkspaceSave();
      }

      // Rail hydrates from the same load — the record fetched above is
      // passed through directly (WR-01: no second disk read).
      hydrateFromDisk(record);
    })();

    const layoutDisposable = api.onDidLayoutChange(() => {
      scheduleWorkspaceSave();
    });

    // Focus (DOCK-05): dockview's own event is the sole source of truth —
    // no bespoke focus tracking.
    const focusDisposable = api.onDidActivePanelChange((panel) => {
      const activeKey = panel ? String(panel.id).split(":")[0] : null;
      shellStore.getState().setRailApplet(activeKey);
      shellStore.getState().setActivePaneId(panel ? panel.id : null);
    });

    return () => {
      cancelled = true;
      clearTimeout(canaryTimer);
      layoutDisposable.dispose();
      focusDisposable.dispose();
      if (dockApiRef.current === api) dockApiRef.current = null;
      api.dispose();
    };
  }, []);

  return (
    <div className={styles.host}>
      <div ref={hostRef} className={styles.mount} />
    </div>
  );
}
