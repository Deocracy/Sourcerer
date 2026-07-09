/*
 * workspaceStore — the unified crash-safe persistence backend (Phase 3).
 *
 * One versioned WorkspaceRecordV1 on ONE sink (workspace.json via
 * @tauri-apps/plugin-store's LazyStore), replacing the two Phase-2
 * localStorage scaffolds (Dock.tsx LAYOUT_KEY + shellStore.ts LS_KEY).
 *
 * Design decisions honored here (03-CONTEXT.md / 03-RESEARCH.md):
 * - D-02/D-09/D-10: single unified record, single file, instanceState slot
 *   kept empty until Phase 5.
 * - PERS-03: schemaVersion + migrator runner; any gap in the migration path
 *   discards to DEFAULT_WORKSPACE — never a half-migrated tree, never a throw.
 * - PERS-04: exactly ONE debounced (300ms) flush authority,
 *   scheduleWorkspaceSave(), which reads the registered live getters at
 *   FLUSH time (latest value wins), re-homing Dock.tsx's debounce shape.
 * - No static imports of Dock.tsx / shellStore.ts (circular) — consumers
 *   register live getters via registerStateSources().
 * - T-03-01 (ASVS V5): the entire parse+validate+migrate path is wrapped in
 *   try/catch; untrusted persisted JSON can never crash the shell.
 */
import { LazyStore } from "@tauri-apps/plugin-store";

export interface WorkspaceRecordV1 {
  schemaVersion: number;
  /** dockview api.toJSON() output — opaque to this module. Null = no layout
   *  saved yet; the Dock consumer opens Wiki+Library when null (D-05). */
  dockTree: unknown;
  rail: {
    railMode: "expanded" | "compact" | "hidden";
    railWidth: number;
    railOrder: string[];
    leftRailPinned: string[];
  };
  savedLayouts: Record<
    string,
    { id: string; name: string; record: Omit<WorkspaceRecordV1, "savedLayouts"> }
  >;
  /** instanceId-keyed slot — EMPTY until Phase 5 (D-10). */
  instanceState: Record<string, unknown>;
  /** Crash-on-restore guard, re-homed from Dock.tsx's CANARY_KEY (D-02). */
  restoreCanary?: boolean;
}

export const LATEST_SCHEMA_VERSION = 1;

// Mirrors shellStore's DEFAULT_RAIL_ORDER (UI-SPEC §Component/Interaction
// Inventory). Duplicated by design: this module must NOT static-import
// shellStore.ts (circular — shellStore consumes this module in 03-02).
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

/** Wiki+Library default workspace (D-05): dockTree null means "no saved
 *  layout" — the Dock consumer opens the Wiki+Library panels itself, so the
 *  default record does not encode dockview panels. Reused by reset (D-03)
 *  and every corrupt/unmigratable fallback path. */
export const DEFAULT_WORKSPACE: WorkspaceRecordV1 = {
  schemaVersion: LATEST_SCHEMA_VERSION,
  dockTree: null,
  rail: {
    railMode: "expanded",
    railWidth: 220,
    railOrder: [...DEFAULT_RAIL_ORDER],
    leftRailPinned: [],
  },
  savedLayouts: {},
  instanceState: {},
};

// The ONE sink (D-09): one file, one store.
const store = new LazyStore("workspace.json");
const WORKSPACE_KEY = "workspace";

// ---------------------------------------------------------------------------
// Migration runner (PERS-03) — RESEARCH.md Pattern 1, used as-is.
// ---------------------------------------------------------------------------
type Migrator = (old: unknown) => unknown;
const migrators: Record<number, Migrator> = {
  // 1: (old) => { /* transform v1 -> v2 when that day comes */ },
};

function migrate(raw: { schemaVersion: number; [k: string]: unknown }): WorkspaceRecordV1 | null {
  let version = raw.schemaVersion;
  let data: unknown = raw;
  while (version < LATEST_SCHEMA_VERSION) {
    const step = migrators[version];
    if (!step) return null; // no path forward -> caller discards to default
    try {
      data = step(data);
    } catch {
      return null; // a throwing migrator is a gap, not a crash
    }
    version += 1;
  }
  return data as WorkspaceRecordV1;
}

// T-03-01: validate untrusted persisted JSON before trusting its shape.
function isCandidateRecord(value: unknown): value is { schemaVersion: number; [k: string]: unknown } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.schemaVersion !== "number") return false;
  for (const key of ["dockTree", "rail", "savedLayouts", "instanceState"]) {
    if (!(key in v)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Load / save (PERS-01)
// ---------------------------------------------------------------------------

// In-memory mirror of the non-live slices (savedLayouts / instanceState /
// canary) so the debounced flush can rebuild a full record without consulting
// disk. Kept in sync by loadWorkspaceRecord/saveWorkspaceRecord.
let inMemory: WorkspaceRecordV1 = DEFAULT_WORKSPACE;

/** Always resolves to a VALID record — migrated, or DEFAULT_WORKSPACE on any
 *  fault (absent, corrupt, unmigratable). Never throws on untrusted input. */
export async function loadWorkspaceRecord(): Promise<WorkspaceRecordV1> {
  try {
    const raw = await store.get<unknown>(WORKSPACE_KEY);
    if (raw == null) {
      inMemory = DEFAULT_WORKSPACE;
      return DEFAULT_WORKSPACE;
    }
    if (!isCandidateRecord(raw)) {
      inMemory = DEFAULT_WORKSPACE;
      return DEFAULT_WORKSPACE;
    }
    const migrated = migrate(raw);
    if (migrated === null) {
      inMemory = DEFAULT_WORKSPACE;
      return DEFAULT_WORKSPACE;
    }
    inMemory = migrated;
    return migrated;
  } catch {
    inMemory = DEFAULT_WORKSPACE;
    return DEFAULT_WORKSPACE;
  }
}

export async function saveWorkspaceRecord(record: WorkspaceRecordV1): Promise<void> {
  inMemory = record;
  await store.set(WORKSPACE_KEY, record);
  await store.save();
}

// ---------------------------------------------------------------------------
// Registration seam — breaks the workspaceStore <-> Dock/shellStore cycle.
// Consumers (Dock.tsx, shellStore.ts in 03-02) register live getters here.
// ---------------------------------------------------------------------------
interface StateSources {
  getDockTree: () => unknown | null;
  getRail: () => WorkspaceRecordV1["rail"];
}

let sources: StateSources | null = null;

export function registerStateSources(next: StateSources): void {
  sources = next;
}

// ---------------------------------------------------------------------------
// The single debounced flush authority (PERS-04) — re-homes Dock.tsx's exact
// clear-then-reset 300ms shape. Reads the registered getters at FLUSH time,
// not schedule time (RESEARCH Pitfall 3: latest value wins).
// ---------------------------------------------------------------------------
const SAVE_DEBOUNCE_MS = 300;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

export function scheduleWorkspaceSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    if (!sources) return; // nothing registered yet — nothing coherent to flush
    try {
      const record: WorkspaceRecordV1 = {
        schemaVersion: LATEST_SCHEMA_VERSION,
        dockTree: sources.getDockTree(),
        rail: sources.getRail(),
        savedLayouts: inMemory.savedLayouts,
        instanceState: inMemory.instanceState,
        ...(inMemory.restoreCanary !== undefined
          ? { restoreCanary: inMemory.restoreCanary }
          : {}),
      };
      void saveWorkspaceRecord(record).catch((err) => {
        console.warn("workspaceStore: debounced save failed", err);
      });
    } catch (err) {
      // Persistence must never crash the shell — getters are consumer code.
      console.warn("workspaceStore: debounced save failed", err);
    }
  }, SAVE_DEBOUNCE_MS);
}
