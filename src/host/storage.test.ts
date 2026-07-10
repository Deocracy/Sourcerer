import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory Map-backed fake for @tauri-apps/plugin-store's LazyStore, mirroring
// src/persistence/workspaceStore.test.ts's mocking pattern — one shared
// backing map for the module-level applets.json LazyStore host/storage.ts
// constructs at import time.
const { backing, saveSpy } = vi.hoisted(() => {
  const backing = new Map<string, unknown>();
  const saveSpy = vi.fn(async () => {});
  return { backing, saveSpy };
});

vi.mock("@tauri-apps/plugin-store", () => {
  class LazyStore {
    async get<T>(key: string): Promise<T | undefined> {
      return backing.get(key) as T | undefined;
    }
    async set(key: string, value: unknown): Promise<void> {
      backing.set(key, value);
    }
    async delete(key: string): Promise<boolean> {
      return backing.delete(key);
    }
    save = saveSpy;
  }
  return { LazyStore };
});

import { makeAppletStorage } from "./storage";

beforeEach(() => {
  backing.clear();
  saveSpy.mockClear();
});

describe("host/storage makeAppletStorage", () => {
  it("set then get returns the stored value under the namespaced key", async () => {
    const storage = makeAppletStorage("Notes");
    await storage.set("draft", { text: "hello" });
    expect(backing.has("sourcerer:Notes:draft")).toBe(true);
    const value = await storage.get("draft", null);
    expect(value).toEqual({ text: "hello" });
  });

  it("get returns the fallback when the underlying get throws (corrupt read)", async () => {
    const storage = makeAppletStorage("Notes");
    const original = backing.get.bind(backing);
    vi.spyOn(backing, "get").mockImplementationOnce(() => {
      throw new Error("corrupt read");
    });
    const value = await storage.get("draft", "fallback-value");
    expect(value).toBe("fallback-value");
    backing.get = original;
  });

  it("get returns the fallback when the stored value is null/undefined", async () => {
    const storage = makeAppletStorage("Notes");
    const value = await storage.get("missing-key", "fallback-value");
    expect(value).toBe("fallback-value");
  });

  it("remove deletes the namespaced key and saves", async () => {
    const storage = makeAppletStorage("Notes");
    await storage.set("draft", "x");
    saveSpy.mockClear();
    await storage.remove("draft");
    expect(backing.has("sourcerer:Notes:draft")).toBe(false);
    expect(saveSpy).toHaveBeenCalled();
  });

  it("(WR-01) set never rejects when the underlying save fails (best-effort, never-throws contract)", async () => {
    const storage = makeAppletStorage("Notes");
    saveSpy.mockRejectedValueOnce(new Error("disk full"));
    await expect(storage.set("draft", "x")).resolves.toBeUndefined();
  });

  it("(WR-01) remove never rejects when the underlying save fails", async () => {
    const storage = makeAppletStorage("Notes");
    await storage.set("draft", "x");
    saveSpy.mockRejectedValueOnce(new Error("ipc down"));
    await expect(storage.remove("draft")).resolves.toBeUndefined();
  });

  it("two different appletKeys never collide (namespace isolation)", async () => {
    const notesStorage = makeAppletStorage("Notes");
    const wikiStorage = makeAppletStorage("Wiki");
    await notesStorage.set("draft", "notes-value");
    await wikiStorage.set("draft", "wiki-value");
    expect(await notesStorage.get("draft", null)).toBe("notes-value");
    expect(await wikiStorage.get("draft", null)).toBe("wiki-value");
  });
});
