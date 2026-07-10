import { addAppletToDock, getDockApi } from "../shell/dockApi";

/**
 * host/open.ts — host.open(appletKey), implementing D-17 focus-or-open:
 * reuses the existing panel for that key if one is open, else opens a fresh
 * instance via addAppletToDock. Reaches the live dockview instance ONLY
 * through src/shell/dockApi.ts's getDockApi() — never creates a second
 * dockview instance.
 *
 * DEVIATION (Rule 1 - API correction): 04-RESEARCH.md/04-PATTERNS.md assumed
 * `DockviewApi.setActivePanel(panel)` exists (verified against a .d.ts that
 * turned out to be the internal DockviewComponent implementation class, not
 * the public DockviewApi surface). The actual dockview-core 2.0.0 public API
 * (component.api.d.ts's exported `DockviewApi` class) has no such method —
 * per-panel focus is `panel.api.setActive()` instead. Used here.
 *
 * The rail's "always open a new instance" behavior (DOCK-04) is unchanged —
 * addAppletToDock() is still the direct call other call sites use for that.
 */
export function hostOpen(appletKey: string): void {
  const api = getDockApi();
  if (!api) return;
  const existing = api.panels.find((panel) => panel.id.split(":")[0] === appletKey);
  if (existing) {
    existing.api.setActive();
  } else {
    addAppletToDock(appletKey);
  }
}
