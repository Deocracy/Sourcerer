import { LazyStore } from "@tauri-apps/plugin-store";
import { DEFAULT_SECTIONS, SECTION_ORDER, cardDefs } from "./cardDefs";
import type { SectionMap } from "./homeCardsReducer";

/*
 * homeCards.storage.ts — dedicated shell-scoped storage helper for Home's
 * section membership/order (HOME-02, D-05). Home is a shell surface, not an
 * applet (06-PATTERNS.md "host naming disambiguation" / RESEARCH.md Pitfall
 * 1) — this deliberately does NOT go through the applet-facing host factory
 * (src/host/index.ts) or its `Host` seam. It composes the same two patterns
 * `src/host/storage.ts` and
 * `src/persistence/workspaceStore.ts` already establish:
 *   1. A best-effort, never-throws LazyStore read/write (WR-01) — mirrors
 *      makeAppletStorage's get/set try/catch shape, on the SAME
 *      applets.json file, namespaced "sourcerer:home:<key>" so Home never
 *      collides with a real applet's own storage keys.
 *   2. A single debounced (300ms) write authority — mirrors
 *      scheduleWorkspaceSave — so a rapid drag firing onDragOver on every
 *      hover frame does NOT fire a disk write per frame (RESEARCH.md
 *      Pitfall 3); only the settled onDragEnd state is persisted.
 */

const store = new LazyStore("applets.json");
const HOME_KEY = "sourcerer:home:home-cards-v1";
const SAVE_DEBOUNCE_MS = 300;

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pending: SectionMap | undefined;

/** CR-02: structural guard for untrusted persisted JSON — the same standard
 *  src/persistence/validate.ts applies to workspace.json (its CR-05: a
 *  key-presence/blind-cast check passes garbage through, then a `.map` on a
 *  non-array crashes the consumer's render). Every section key must be
 *  present as an array of strings before the value is trusted as a
 *  SectionMap. */
function isValidSectionMap(value: unknown): value is SectionMap {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return SECTION_ORDER.every(
    (key) => Array.isArray(v[key]) && (v[key] as unknown[]).every((id) => typeof id === "string"),
  );
}

/** loadSections — returns the persisted SectionMap, or DEFAULT_SECTIONS on
 *  any read error / absent value / structurally invalid value (T-06-06-01:
 *  corrupt/missing storage never crashes Home). */
export async function loadSections(): Promise<SectionMap> {
  let raw: unknown;
  try {
    raw = await store.get<unknown>(HOME_KEY);
  } catch {
    return DEFAULT_SECTIONS;
  }
  if (!isValidSectionMap(raw)) return DEFAULT_SECTIONS;
  // WR-01: minted-card defs live only in the in-memory cardDefs registry
  // (card CONTENT is demo-scoped this phase, D-05), so persisted minted ids
  // outlive their defs across a restart. Filter unknown ids at load time —
  // otherwise ghost `minted-…` ids accumulate unboundedly in the persisted
  // map and in every findSection/drag iteration, while rendering nothing.
  const pruned = {} as SectionMap;
  for (const key of SECTION_ORDER) {
    pruned[key] = raw[key].filter((id) => cardDefs[id] !== undefined);
  }
  return pruned;
}

async function flush(): Promise<void> {
  saveTimer = undefined;
  const map = pending;
  pending = undefined;
  if (!map) return;
  try {
    await store.set(HOME_KEY, map);
    await store.save();
  } catch {
    // WR-01: best-effort, never-throws — a failed IPC/disk write is dropped
    // silently, mirroring src/host/storage.ts's set() contract.
  }
}

/** scheduleSaveSections — debounces a single `host.storage`-equivalent write
 *  of the SectionMap. Call after every onDragEnd; do NOT call on
 *  intermediate onDragOver frames (RESEARCH.md Pitfall 3). Only the latest
 *  map passed before the timer fires is written (latest-wins). */
export function scheduleSaveSections(map: SectionMap): void {
  pending = map;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void flush();
  }, SAVE_DEBOUNCE_MS);
}
