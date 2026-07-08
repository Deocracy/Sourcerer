/*
 * Sourcerer shell store — the single Zustand store the shell chrome reads.
 *
 * Ported from the design handoff's `store.js` (zustand 4.5.5 vanilla), swapped
 * to the locked `zustand/vanilla` package import and typed with `ShellState`.
 *
 * Scope (Phase 2 / D-02): rail mode/order/pins/width + a badge slice, persisting
 * only the near-free D-02 subset to localStorage. This is NOT the Phase-3
 * persistence contract (PERS-01..04): no schemaVersion, no migrations, no named
 * layouts, no tauri-plugin-store — those land in Phase 3.
 */
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

export type RailMode = "expanded" | "compact" | "hidden";

export interface ShellState {
  // --- persisted (D-02 subset) ---
  railMode: RailMode;
  railWidth: number;
  railOrder: string[];
  leftRailPinned: string[];

  // --- session-only (never persisted) ---
  railOpen: boolean;
  activeCorpus: string;
  activePaneId: string | null;
  railApplet: string | null;
  badges: Record<string, number>;

  // --- actions ---
  setRailMode(m: RailMode): void;
  cycleRailMode(): void; // expanded -> compact -> hidden -> expanded
  setRailWidth(w: number): void;
  reorderRail(from: number, to: number): void; // arrayMove semantics
  togglePin(key: string): void;
  setActivePaneId(id: string | null): void;
  setRailApplet(key: string | null): void;
  setBadge(key: string, n: number): void;
}

// Fixed applet order (UI-SPEC §Component/Interaction Inventory). Reorderable
// within the array, but the array membership itself is not user-configurable.
const DEFAULT_RAIL_ORDER = [
  "Sources",
  "Library",
  "Wiki",
  "Graph",
  "Chat",
  "Writing",
  "Browser",
  "Kanban",
  "News",
  "KeyPass",
  "Builder",
  "Dadabase",
  "Notes",
];

const LS_KEY = "sourcerer-shell-store-v1";

// T-02-01 mitigation: parsing untrusted persisted state must never crash the
// shell — wrap in try/catch and fall back to an empty (default) object.
type PersistedSlice = Partial<
  Pick<ShellState, "railMode" | "railWidth" | "railOrder" | "leftRailPinned">
>;

function load(): PersistedSlice {
  try {
    return (JSON.parse(localStorage.getItem(LS_KEY) || "{}") as PersistedSlice) || {};
  } catch {
    return {};
  }
}

function persist(get: () => ShellState): void {
  const s = get();
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        railMode: s.railMode,
        railWidth: s.railWidth,
        railOrder: s.railOrder,
        leftRailPinned: s.leftRailPinned,
      }),
    );
  } catch {
    // persistence is best-effort in Phase 2; ignore quota/serialization errors.
  }
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

const saved = load();

export const shellStore = createStore<ShellState>()((set, get) => ({
  railMode: saved.railMode ?? "expanded",
  railWidth: saved.railWidth ?? 220,
  railOrder: saved.railOrder ?? [...DEFAULT_RAIL_ORDER],
  leftRailPinned: saved.leftRailPinned ?? [],

  railOpen: (saved.railMode ?? "expanded") !== "hidden",
  activeCorpus: "Default",
  activePaneId: null,
  railApplet: null,
  badges: {},

  setRailMode: (m) => {
    set({ railMode: m, railOpen: m !== "hidden" });
    persist(get);
  },

  cycleRailMode: () => {
    const next = CYCLE[get().railMode] ?? "expanded";
    set({ railMode: next, railOpen: next !== "hidden" });
    persist(get);
  },

  setRailWidth: (w) => {
    set({ railWidth: w });
    persist(get);
  },

  reorderRail: (from, to) => {
    set({ railOrder: arrayMove(get().railOrder, from, to) });
    persist(get);
  },

  togglePin: (key) => {
    const pinned = get().leftRailPinned;
    const next = pinned.includes(key)
      ? pinned.filter((k) => k !== key)
      : [...pinned, key];
    set({ leftRailPinned: next });
    persist(get);
  },

  // session-only actions — do NOT persist (kept out of the D-02 subset).
  setActivePaneId: (id) => set({ activePaneId: id }),
  setRailApplet: (key) => set({ railApplet: key }),
  setBadge: (key, n) => set({ badges: { ...get().badges, [key]: n } }),
}));

// React binding: components subscribe with a selector so they only re-render on
// the slice they read (zustand 5's useStore over a vanilla store).
export function useShellStore<T>(selector: (state: ShellState) => T): T {
  return useStore(shellStore, selector);
}
