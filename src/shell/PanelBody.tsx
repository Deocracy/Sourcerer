import { Component, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { GroupPanelPartInitParameters } from "dockview-core";
import { appletDefs } from "./appletDefs";
import { registry } from "./registry";
import { makeHost } from "../host/index";
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

/**
 * AppletErrorBoundary (WR-04) — per-panel containment. The framework hosts
 * per-applet code of varying maturity (generated stubs, future Phase 5+
 * applets); a registered applet whose App throws during render must not
 * escape as an uncaught error that blanks the panel with no affordance.
 * Extends the "dispatch never crashes" guarantee from unknown keys to
 * throwing bodies: the fallback is the same generic PanelBody placeholder.
 */
class AppletErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("AppletErrorBoundary: applet render threw", error);
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export interface DockContentRenderer {
  element: HTMLElement;
  init: (parameters: GroupPanelPartInitParameters) => void;
  dispose: () => void;
}

/**
 * makeRenderer — the dockview `createComponent` dispatcher's content-renderer
 * factory (FWK-02). Dispatches through `registry[appletKey]`: a registered
 * key renders that module's `App({host})` with a live per-instance host; an
 * unregistered key still falls back to the generic `<PanelBody />` placeholder
 * (D-11, Phase 3 D-06 — dispatch never crashes on an unexpected key).
 *
 * Per 04-RESEARCH.md Pattern 2: the panel's real, full instance id
 * (`"Key:nanoid"`) is only reliably available at dockview's `init(parameters)`
 * call — `parameters.api.id` — not at `createComponent()` time (which
 * historically only carried the split `appletKey`). The render is therefore
 * done lazily inside `init`, not eagerly at factory-construction time.
 */
export function makeRenderer(fullPanelId: string, appletKey: string): DockContentRenderer {
  const element = document.createElement("div");
  element.style.height = "100%";

  let root: Root | null = null;
  let instanceId = fullPanelId;

  return {
    element,
    init: (parameters) => {
      instanceId = parameters.api.id;
      if (instanceId !== fullPanelId && import.meta.env.DEV) {
        // A1 (04-RESEARCH.md Assumptions Log): these should never diverge —
        // dev-time canary only, never thrown/blocking in production.
        // eslint-disable-next-line no-console
        console.warn(
          `PanelBody: dockview panel id mismatch — createComponent id "${fullPanelId}" vs init parameters.api.id "${instanceId}"`,
        );
      }

      root = createRoot(element);
      const mod = registry[appletKey];
      if (mod) {
        const host = makeHost(instanceId, appletKey);
        root.render(
          <AppletErrorBoundary fallback={<PanelBody appletKey={appletKey} />}>
            <mod.App host={host} />
          </AppletErrorBoundary>,
        );
      } else {
        root.render(<PanelBody appletKey={appletKey} />);
      }
    },
    dispose: () => {
      // D-07 (frontend-side abandonment only, RESEARCH.md Pitfall 3): the
      // sidecar cannot be aborted mid-turn, but unmounting the React root
      // BEFORE any pending host.ai() promise settles means no further
      // onDelta/resolve callback can reach a live component — abandonment is
      // a natural consequence of the unmount below, not a separate call.
      // CR-02: NO instanceState GC here. dockview disposes content renderers
      // on layout restore (fromJSON tears down every live panel before
      // recreating them with the SAME serialized ids) and on dock teardown
      // (api.dispose() / HMR / StrictMode remount) — not just tab close.
      // GC-on-dispose silently wiped per-tab state for panels that still
      // exist. GC now lives on the Dock's onDidRemovePanel (a genuine
      // panel-removal event) plus a post-restore reconciliation sweep
      // (Dock.tsx reconcileInstanceState).
      root?.unmount();
      root = null;
    },
  };
}
