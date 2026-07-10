import { nanoid } from "nanoid";
import { appletDefs } from "./appletDefs";
import type { DockDirection } from "./dockZones";
import type { DockviewApi } from "dockview-core";

/**
 * dockApi.ts — the module-scope live-dockview handle + panel-open helper,
 * extracted from Dock.tsx (Phase 4 Task 1) so src/host/open.ts can reach the
 * one live dockview instance (D-17 focus-or-open) without importing the
 * Dock.tsx React component (which would pull React/JSX into the host seam
 * and risk a second dockview instance being spun up).
 *
 * --- D-01 seam: single live dockview instance exposed to useRailDragOut ---
 * Dock.tsx owns the one dockview-core instance; the rail drag-out hook and
 * (as of Phase 4) host/open.ts both bridge into it via this module-scope
 * handle rather than spinning up a second dockview or threading the api
 * through React props/context for a single-instance-per-app shell.
 */
export const dockApiRef: { current: DockviewApi | null } = { current: null };

/** getDockApi — read-only accessor to the live dockview api, or null before
 *  Dock.tsx has mounted / after it has unmounted. The one seam host/open.ts
 *  is permitted to reach into the dock through. */
export function getDockApi(): DockviewApi | null {
  return dockApiRef.current;
}

/** addAppletToDock — opens a fresh `${key}:${nanoid()}` panel instance,
 * optionally positioned via `{referenceGroup, direction}` (D-01 drag-out
 * split/tab-join). Omitting `position` keeps dockview's own default (active
 * group, new tab) used by the "+" button, restore-default, and D-17
 * focus-or-open (absent branch) paths. */
export function addAppletToDock(
  key: string,
  position?: { referenceGroup: string; direction?: DockDirection },
): void {
  const api = dockApiRef.current;
  if (!api) return;
  const def = appletDefs[key];
  api.addPanel({
    id: `${key}:${nanoid()}`,
    component: key,
    title: def?.title ?? key,
    ...(position ? { position } : {}),
  });
}
