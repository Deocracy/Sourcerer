/*
 * Sourcerer shell store — the single Zustand store the shell chrome reads.
 *
 * Ported from the design handoff's `store.js` (zustand 4.5.5 vanilla), swapped
 * to the locked `zustand/vanilla` package import and typed with `ShellState`.
 *
 * Scope (Phase 3 / PERS-01): rail mode/order/pins/width persist through the
 * unified `workspace.json` record (src/persistence/workspaceStore.ts) — the
 * single debounced writer (`scheduleWorkspaceSave`) owns disk I/O. This module
 * only seeds its initial state from DEFAULT_WORKSPACE.rail (synchronous,
 * valid before disk hydration) and later overwrites it via `hydrateFromDisk()`,
 * called once at app boot (Dock.tsx's mount effect).
 */
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { DEFAULT_WORKSPACE, scheduleWorkspaceSave } from "../persistence/workspaceStore";
import type { WorkspaceRecordV1 } from "../persistence/workspaceStore";
// appletDefs is a leaf module (no registry import) — safe to import here
// without creating an import cycle (shellStore -> registry -> applets ->
// shellStore would be the forbidden path; appletDefs has no such edge).
import { appletDefs } from "../shell/appletDefs";

export type RailMode = "expanded" | "compact" | "hidden";

export interface ShellState {
  // --- persisted (rail subset of the unified workspace.json record) ---
  railMode: RailMode;
  railWidth: number;
  railOrder: string[];
  leftRailPinned: string[];

  // --- persisted (Phase 6, ASST-03): Dashboard Assistant panel, mirrors the
  // railWidth/railMode persisted-field template exactly. ---
  asstWidth: number;
  assistantOpen: boolean;

  // --- session-only (never persisted, GAP-1 gap closure): true while the
  // assistant is in the prototype's "full" bounce state (cycleRight's third
  // stop). Modeled as a transient flag rather than a persisted schema field
  // (06-07-PLAN.md) — asstWidth still carries the actual pixel width. ---
  assistantFull: boolean;

  // --- session-only (never persisted) ---
  railOpen: boolean;
  activeCorpus: string;
  activePaneId: string | null;
  railApplet: string | null;
  badges: Record<string, number>;

  // --- session-only: Applet Catalog picker open-state (D-18) ---
  // NOT persisted — kept out of getRailSubset exactly like railApplet/badges.
  catalogOpen: boolean;
  catalogAnchor: { x: number; y: number } | null;

  // --- session-only (Phase 6, HOME-01/D-06): Home overlay visibility + the
  // assistant -> Home card-mint hand-off seam. NOT persisted — kept out of
  // getRailSubset exactly like railApplet/badges. ---
  homeOpen: boolean;
  lastResolvedProposal: string | null;
  pendingCardMint: { title: string; foot: string } | null;

  // --- actions ---
  setRailMode(m: RailMode): void;
  cycleRailMode(): void; // expanded -> compact -> hidden -> expanded
  setRailWidth(w: number): void;
  reorderRail(from: number, to: number): void; // arrayMove semantics
  togglePin(key: string): void;
  setActivePaneId(id: string | null): void;
  setRailApplet(key: string | null): void;
  setBadge(key: string, n: number): void;
  openAppletCatalog(anchor?: { x: number; y: number }): void;
  closeAppletCatalog(): void;

  // --- Phase 6 actions ---
  setAsstWidth(w: number): void;
  setAssistantOpen(open: boolean): void;
  // GAP-1: three-state bounce (closed -> open -> full -> open -> closed,
  // never wraps) mirroring the prototype's cycleRight/applyRightState.
  cycleAssistant(): void;
  setHomeOpen(open: boolean): void;
  toggleHomeOpen(): void;
  setLastResolvedProposal(text: string | null): void;
  requestCardMint(card: { title: string; foot: string }): void;
  clearPendingCardMint(): void;
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const CYCLE: Record<RailMode, RailMode> = {
  expanded: "compact",
  compact: "hidden",
  hidden: "expanded",
};

// Synchronous seed from the shared DEFAULT_WORKSPACE.rail so first render is
// valid before disk hydration (hydrateFromDisk overwrites it once the async
// workspace.json load resolves).
const seedRail = DEFAULT_WORKSPACE.rail;

export const shellStore = createStore<ShellState>()((set, get) => {
  // GAP-1 closure-local (non-reactive) state for the assistant bounce cycle —
  // mirrors the prototype's rightPrev (width to restore on exitRightFull) and
  // rightDir (which way the next cycleRight bounce goes). Neither needs to
  // trigger a re-render, so they stay outside the zustand state shape rather
  // than widening ShellState/getRailSubset with fields nothing else reads.
  let assistantPrevWidth: number | null = null;
  let assistantDir: 1 | -1 = 1;

  const enterAssistantFull = () => {
    assistantPrevWidth = get().asstWidth;
    set({ assistantFull: true });
    get().setAsstWidth(Math.max(0, window.innerWidth - 160));
  };

  const exitAssistantFull = () => {
    const prev = assistantPrevWidth;
    assistantPrevWidth = null;
    set({ assistantFull: false });
    if (prev != null) get().setAsstWidth(prev);
  };

  // Mirrors the prototype's applyRightState exactly (closed/open/full).
  const applyAssistantState = (next: "closed" | "open" | "full") => {
    if (next === "closed") {
      if (get().assistantFull) exitAssistantFull();
      if (get().assistantOpen) get().setAssistantOpen(false);
    } else if (next === "open") {
      if (get().assistantFull) exitAssistantFull();
      if (!get().assistantOpen) get().setAssistantOpen(true);
    } else {
      if (!get().assistantOpen) get().setAssistantOpen(true);
      if (!get().assistantFull) enterAssistantFull();
    }
  };

  return {
  railMode: seedRail.railMode,
  railWidth: seedRail.railWidth,
  railOrder: [...seedRail.railOrder],
  leftRailPinned: [...seedRail.leftRailPinned],
  asstWidth: seedRail.asstWidth ?? 280,
  assistantOpen: seedRail.assistantOpen ?? true,
  assistantFull: false,

  railOpen: seedRail.railMode !== "hidden",
  activeCorpus: "Default",
  activePaneId: null,
  railApplet: null,
  badges: {},
  catalogOpen: false,
  catalogAnchor: null,

  homeOpen: false,
  lastResolvedProposal: null,
  pendingCardMint: null,

  setRailMode: (m) => {
    set({ railMode: m, railOpen: m !== "hidden" });
    scheduleWorkspaceSave();
  },

  cycleRailMode: () => {
    const next = CYCLE[get().railMode] ?? "expanded";
    set({ railMode: next, railOpen: next !== "hidden" });
    scheduleWorkspaceSave();
  },

  setRailWidth: (w) => {
    set({ railWidth: w });
    scheduleWorkspaceSave();
  },

  reorderRail: (from, to) => {
    set({ railOrder: arrayMove(get().railOrder, from, to) });
    scheduleWorkspaceSave();
  },

  togglePin: (key) => {
    const pinned = get().leftRailPinned;
    const next = pinned.includes(key)
      ? pinned.filter((k) => k !== key)
      : [...pinned, key];
    set({ leftRailPinned: next });
    scheduleWorkspaceSave();
  },

  // session-only actions — do NOT persist (kept out of the rail subset).
  setActivePaneId: (id) => set({ activePaneId: id }),
  setRailApplet: (key) => set({ railApplet: key }),
  setBadge: (key, n) => set({ badges: { ...get().badges, [key]: n } }),

  openAppletCatalog: (anchor) => set({ catalogOpen: true, catalogAnchor: anchor ?? null }),
  closeAppletCatalog: () => set({ catalogOpen: false, catalogAnchor: null }),

  // Phase 6 persisted actions — mutate + persist together (setRailWidth template).
  setAsstWidth: (w) => {
    set({ asstWidth: w });
    scheduleWorkspaceSave();
  },
  setAssistantOpen: (open) => {
    set({ assistantOpen: open });
    scheduleWorkspaceSave();
  },

  // GAP-1: bounces closed -> open -> full, never wrapping. dir resets to
  // opening at 'closed' and to closing at 'full' (bounce-off-the-ends), and
  // otherwise keeps the previous direction — exactly the prototype's
  // cycleRight dir logic.
  cycleAssistant: () => {
    const order: Array<"closed" | "open" | "full"> = ["closed", "open", "full"];
    const cur: "closed" | "open" | "full" = get().assistantFull
      ? "full"
      : get().assistantOpen
        ? "open"
        : "closed";
    if (cur === "closed") assistantDir = 1;
    else if (cur === "full") assistantDir = -1;
    const next = order[order.indexOf(cur) + assistantDir];
    applyAssistantState(next);
  },

  // Phase 6 session-only actions — never call scheduleWorkspaceSave (mirrors
  // setActivePaneId/setRailApplet/setBadge above).
  setHomeOpen: (open) => set({ homeOpen: open }),
  toggleHomeOpen: () => set({ homeOpen: !get().homeOpen }),
  setLastResolvedProposal: (text) => set({ lastResolvedProposal: text }),
  requestCardMint: (card) => set({ pendingCardMint: card }),
  clearPendingCardMint: () => set({ pendingCardMint: null }),
  };
});

/** Live getter for the rail subset of the unified workspace record — consumed
 *  by Dock.tsx's single `registerStateSources` call site (03-02) so the rail
 *  and dock-tree getters merge into one registration, never clobbering each
 *  other. */
export function getRailSubset(): {
  railMode: RailMode;
  railWidth: number;
  railOrder: string[];
  leftRailPinned: string[];
  asstWidth: number;
  assistantOpen: boolean;
} {
  const s = shellStore.getState();
  return {
    railMode: s.railMode,
    railWidth: s.railWidth,
    railOrder: s.railOrder,
    leftRailPinned: s.leftRailPinned,
    asstWidth: s.asstWidth,
    assistantOpen: s.assistantOpen,
  };
}

/** Hydrates the persisted rail subset from the record Dock's mount effect
 *  ALREADY loaded (WR-01): rail + dock genuinely hydrate from the same load —
 *  no second disk read that races the concurrent canary write, double-runs
 *  backupAndFallback on a corrupt store, or re-fires savedLayoutsListeners. */
export function hydrateFromDisk(record: WorkspaceRecordV1): void {
  const rail = record.rail;
  // D-19: a registered appletDefs key absent from the restored railOrder
  // (e.g. a newly-added applet in this build) appends at the bottom of the
  // main group — never reordering or dropping any existing saved entry.
  const missing = Object.keys(appletDefs).filter((key) => !rail.railOrder.includes(key));
  const railOrder = missing.length > 0 ? [...rail.railOrder, ...missing] : rail.railOrder;
  shellStore.setState({
    railMode: rail.railMode,
    railWidth: rail.railWidth,
    railOrder,
    leftRailPinned: rail.leftRailPinned,
    railOpen: rail.railMode !== "hidden",
    asstWidth: rail.asstWidth ?? 280,
    assistantOpen: rail.assistantOpen ?? true,
    // assistantFull is never persisted (GAP-1) — hydration always starts
    // out of the full-screen bounce state, matching a fresh app boot.
    assistantFull: false,
  });
}

// React binding: components subscribe with a selector so they only re-render on
// the slice they read (zustand 5's useStore over a vanilla store).
export function useShellStore<T>(selector: (state: ShellState) => T): T {
  return useStore(shellStore, selector);
}
