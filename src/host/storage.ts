import { LazyStore } from "@tauri-apps/plugin-store";
import type { AppletStorage } from "./types";

/**
 * host/storage.ts — host.storage, backed by a single applets.json LazyStore
 * (D-15), namespaced `sourcerer:<appletKey>:<key>` so different applets can
 * never collide on the same underlying file. Mirrors
 * src/persistence/workspaceStore.ts's LazyStore construction + best-effort
 * try/catch load pattern (never throw on a corrupt read — return the
 * caller-supplied fallback instead).
 */
const store = new LazyStore("applets.json");

function namespacedKey(appletKey: string, key: string): string {
  return `sourcerer:${appletKey}:${key}`;
}

/** makeAppletStorage — factory returning a per-appletKey AppletStorage view
 *  over the shared applets.json store. */
export function makeAppletStorage(appletKey: string): AppletStorage {
  return {
    async get<T>(key: string, fallback: T): Promise<T> {
      let raw: unknown;
      try {
        raw = await store.get<unknown>(namespacedKey(appletKey, key));
      } catch {
        // Read itself failed (corrupt/IPC error) — best-effort, never throw.
        return fallback;
      }
      if (raw === null || raw === undefined) {
        return fallback;
      }
      return raw as T;
    },
    async set(key: string, value: unknown): Promise<void> {
      try {
        await store.set(namespacedKey(appletKey, key), value);
        await store.save();
      } catch {
        // WR-01: best-effort, never-throws contract (types.ts D-15/D-16) —
        // a failed IPC/disk write is dropped silently rather than surfacing
        // as an unhandled rejection in applet code that takes the contract
        // at its word (`void host.storage.set(...)` without a catch).
      }
    },
    async remove(key: string): Promise<void> {
      try {
        await store.delete(namespacedKey(appletKey, key));
        await store.save();
      } catch {
        // WR-01: best-effort, never-throws — see set() above.
      }
    },
  };
}
