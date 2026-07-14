import { LazyStore } from "@tauri-apps/plugin-store";

/*
 * sessionIdsStorage.ts — durable persistence for the assistant's real-session
 * id list (WR-09). D-01 generalized Phase 7's single sessionId key into a
 * JSON-array list; this module moves that list off raw webview localStorage
 * (lost on webview data resets, against the project's persistence standard —
 * see CLAUDE.md and the Phase 3 localStorage migration) onto the SAME
 * tauri-plugin-store file Home's section persistence uses (applets.json),
 * namespaced per the `sourcerer:<key>:<k>` convention.
 *
 * Both halves are best-effort/never-throw, mirroring homeCards.storage.ts:
 * a corrupt or unreadable value loads as null (caller mints a fresh session,
 * T-06-02-02) and a failed write is dropped silently.
 */

const store = new LazyStore("applets.json");
const SESSION_IDS_KEY = "sourcerer:assistant:sessionIds";

function isValidIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((id) => typeof id === "string");
}

/**
 * Loads the persisted real-session id list, or null when absent/corrupt/
 * unreadable (T-06-02-02: never throws at mount). Falls back once to the
 * legacy localStorage value (the pre-WR-09 sink) and migrates it forward so
 * sessions persisted by earlier builds are not orphaned.
 */
export async function loadSessionIds(): Promise<string[] | null> {
  try {
    const raw = await store.get<unknown>(SESSION_IDS_KEY);
    if (isValidIdList(raw)) return raw;
  } catch {
    // fall through — try the legacy sink below.
  }
  // One-time legacy migration: earlier builds kept the list (same key) in
  // raw localStorage. Read it once, persist it to the plugin store, and
  // remove the legacy copy.
  try {
    const legacy = localStorage.getItem(SESSION_IDS_KEY);
    if (legacy) {
      const parsed: unknown = JSON.parse(legacy);
      if (isValidIdList(parsed)) {
        await saveSessionIds(parsed);
        localStorage.removeItem(SESSION_IDS_KEY);
        return parsed;
      }
    }
  } catch {
    // Corrupt/unreadable legacy value — treat as absent.
  }
  return null;
}

/** Best-effort write of the id list — a failed IPC/disk write is dropped
 *  silently (mirrors homeCards.storage.ts / src/host/storage.ts set()). */
export async function saveSessionIds(ids: string[]): Promise<void> {
  try {
    await store.set(SESSION_IDS_KEY, ids);
    await store.save();
  } catch {
    // best-effort, never-throws
  }
}
