/*
 * layouts — named-layout operations over the workspace.json record's
 * savedLayouts slice (PERS-02). Consumed by src/shell/LayoutsMenu.tsx.
 *
 * Mutate-then-persist idiom (03-PATTERNS.md §layouts.ts): every op mutates
 * the in-memory record (or triggers a live restore) then calls the single
 * scheduleWorkspaceSave() writer — never an inline disk write per action.
 */
import { nanoid } from "nanoid";
import {
  DEFAULT_WORKSPACE,
  getCurrentRecord,
  restoreDockTree,
  scheduleWorkspaceSave,
  setSavedLayouts,
} from "./workspaceStore";
import { shellStore } from "../store/shellStore";

/** saveLayout(name) — snapshots the CURRENT workspace (dockTree + rail +
 *  instanceState, minus savedLayouts to avoid nesting) into savedLayouts
 *  under a fresh nanoid id, then persists. */
export function saveLayout(name: string): void {
  const current = getCurrentRecord();
  const id = nanoid();
  const nextSavedLayouts = {
    ...current.savedLayouts,
    [id]: {
      id,
      name,
      record: {
        schemaVersion: current.schemaVersion,
        dockTree: current.dockTree,
        rail: current.rail,
        instanceState: current.instanceState,
        ...(current.restoreCanary !== undefined ? { restoreCanary: current.restoreCanary } : {}),
      },
    },
  };
  setSavedLayouts(nextSavedLayouts);
  scheduleWorkspaceSave();
}

/** applyLayout(id) — restores a saved snapshot: dock tree via the
 *  restoreDockTree seam (Dock.tsx's try/catch-guarded api.fromJSON path,
 *  T-03-01) and rail via shellStore.setState, then persists as current.
 *  No-ops if the id is unknown. */
export function applyLayout(id: string): void {
  const current = getCurrentRecord();
  const layout = current.savedLayouts[id];
  if (!layout) return;

  restoreDockTree(layout.record.dockTree);
  shellStore.setState({
    railMode: layout.record.rail.railMode,
    railWidth: layout.record.rail.railWidth,
    railOrder: layout.record.rail.railOrder,
    leftRailPinned: layout.record.rail.leftRailPinned,
    railOpen: layout.record.rail.railMode !== "hidden",
  });
  scheduleWorkspaceSave();
}

/** deleteLayout(id) — removes the entry from savedLayouts and persists;
 *  other saved layouts are untouched. */
export function deleteLayout(id: string): void {
  const current = getCurrentRecord();
  const next = { ...current.savedLayouts };
  delete next[id];
  setSavedLayouts(next);
  scheduleWorkspaceSave();
}

/** resetToDefault() — restores DEFAULT_WORKSPACE (Wiki+Library, D-05) as the
 *  current workspace WITHOUT clearing savedLayouts (D-03), then persists. */
export function resetToDefault(): void {
  restoreDockTree(DEFAULT_WORKSPACE.dockTree);
  shellStore.setState({
    railMode: DEFAULT_WORKSPACE.rail.railMode,
    railWidth: DEFAULT_WORKSPACE.rail.railWidth,
    railOrder: [...DEFAULT_WORKSPACE.rail.railOrder],
    leftRailPinned: [...DEFAULT_WORKSPACE.rail.leftRailPinned],
    railOpen: DEFAULT_WORKSPACE.rail.railMode !== "hidden",
  });
  scheduleWorkspaceSave();
}
