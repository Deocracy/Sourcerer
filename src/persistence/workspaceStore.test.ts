import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// In-memory Map-backed fake for @tauri-apps/plugin-store's LazyStore so these
// tests run in jsdom without a real Tauri IPC context (03-PATTERNS.md §Tauri
// IPC guarded-at-click-time — defer IPC, never touch it at module time).
// Two separate backing maps + save spies, keyed by the LazyStore path, since
// workspaceStore.ts now opens a SECOND LazyStore("workspace.json.bak") for
// the rolling corrupt-fallback backup (D-08).
const { backing, saveSpy, backupBacking, backupSaveSpy } = vi.hoisted(() => {
  const backing = new Map<string, unknown>();
  const saveSpy = vi.fn(async () => {});
  const backupBacking = new Map<string, unknown>();
  const backupSaveSpy = vi.fn(async () => {});
  return { backing, saveSpy, backupBacking, backupSaveSpy };
});

vi.mock("@tauri-apps/plugin-store", () => {
  class LazyStore {
    private map: Map<string, unknown>;
    save: () => Promise<void>;
    constructor(path: string) {
      if (path === "workspace.json.bak") {
        this.map = backupBacking;
        this.save = backupSaveSpy;
      } else {
        this.map = backing;
        this.save = saveSpy;
      }
    }
    async get<T>(key: string): Promise<T | undefined> {
      return this.map.get(key) as T | undefined;
    }
    async set(key: string, value: unknown): Promise<void> {
      this.map.set(key, value);
    }
    async delete(key: string): Promise<boolean> {
      return this.map.delete(key);
    }
  }
  return { LazyStore };
});

import {
  loadWorkspaceRecord,
  saveWorkspaceRecord,
  scheduleWorkspaceSave,
  registerStateSources,
  resetOccurred,
  acknowledgeReset,
  DEFAULT_WORKSPACE,
  LATEST_SCHEMA_VERSION,
  type WorkspaceRecordV1,
} from "./workspaceStore";
import { makeRenderer } from "../shell/PanelBody";

beforeEach(() => {
  backing.clear();
  saveSpy.mockClear();
  backupBacking.clear();
  backupSaveSpy.mockClear();
  acknowledgeReset();
});

afterEach(() => {
  vi.useRealTimers();
});

function makeRecord(): WorkspaceRecordV1 {
  return {
    schemaVersion: 1,
    dockTree: { grid: { root: { type: "branch", data: [] } }, panels: {} },
    rail: {
      railMode: "expanded",
      railWidth: 220,
      railOrder: ["home", "wiki", "library"],
      leftRailPinned: [],
    },
    savedLayouts: {},
    instanceState: {},
  };
}

describe("workspaceStore (PERS-01 round-trip)", () => {
  it("saveWorkspaceRecord then loadWorkspaceRecord returns the same record", async () => {
    const rec = makeRecord();
    await saveWorkspaceRecord(rec);
    const loaded = await loadWorkspaceRecord();
    expect(loaded).toEqual(rec);
    expect(loaded.schemaVersion).toBe(1);
    expect(loaded.savedLayouts).toEqual({});
    expect(loaded.instanceState).toEqual({});
  });

  it("an empty/absent store resolves to DEFAULT_WORKSPACE", async () => {
    const loaded = await loadWorkspaceRecord();
    expect(loaded).toEqual(DEFAULT_WORKSPACE);
    expect(loaded.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
  });
});

describe("workspaceStore (PERS-03 migration fallback)", () => {
  it("a schemaVersion with no migrator path resolves to DEFAULT_WORKSPACE, not a throw", async () => {
    backing.set("workspace", {
      schemaVersion: 0,
      dockTree: { poisoned: true },
      rail: { railMode: "hidden" },
      savedLayouts: {},
      instanceState: {},
    });
    const loaded = await loadWorkspaceRecord();
    expect(loaded).toEqual(DEFAULT_WORKSPACE);
  });

  it("a corrupt/shape-invalid persisted value resolves to DEFAULT_WORKSPACE", async () => {
    backing.set("workspace", { schemaVersion: "not-a-number", junk: true });
    const loaded = await loadWorkspaceRecord();
    expect(loaded).toEqual(DEFAULT_WORKSPACE);
  });

  it("(e) corrupt input writes the raw value to workspace.json.bak exactly once and flips resetOccurred() true", async () => {
    const corrupt = { schemaVersion: 0, dockTree: { poisoned: true }, rail: {}, savedLayouts: {}, instanceState: {} };
    backing.set("workspace", corrupt);
    expect(resetOccurred()).toBe(false);

    const loaded = await loadWorkspaceRecord();

    expect(loaded).toEqual(DEFAULT_WORKSPACE);
    expect(resetOccurred()).toBe(true);
    expect(backupSaveSpy).toHaveBeenCalledTimes(1);
    expect(backupBacking.get("workspace")).toEqual(corrupt);
  });

  it("(f) a valid record leaves resetOccurred() false and writes no .bak", async () => {
    const rec = makeRecord();
    backing.set("workspace", rec);

    const loaded = await loadWorkspaceRecord();

    expect(loaded).toEqual(rec);
    expect(resetOccurred()).toBe(false);
    expect(backupSaveSpy).not.toHaveBeenCalled();
    expect(backupBacking.size).toBe(0);
  });

  it("(g) a restored layout referencing a missing applet key loads without throwing and renders the PanelBody fallback", async () => {
    const rec = makeRecord(); // dockTree here is opaque to workspaceStore — any shape is valid
    backing.set("workspace", rec);

    await expect(loadWorkspaceRecord()).resolves.toEqual(rec);

    // makeRenderer/PanelBody dispatch must never throw on an unrecognized
    // applet key (D-06) — it falls back to the generic placeholder.
    const renderer = makeRenderer("NotARealApplet");
    document.body.appendChild(renderer.element);
    renderer.init();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(renderer.element.textContent).toContain("NotARealApplet");

    renderer.dispose();
    renderer.element.remove();
  });
});

describe("workspaceStore (PERS-04 debounced writer)", () => {
  it("coalesces three scheduleWorkspaceSave calls into one save reading getters at flush time", async () => {
    vi.useFakeTimers();

    // Mutable sources the getters close over — the flushed record must
    // reflect the value at FLUSH time, not schedule time (RESEARCH Pitfall 3).
    let dockTree: unknown = { version: "initial" };
    let rail: WorkspaceRecordV1["rail"] = {
      railMode: "expanded",
      railWidth: 220,
      railOrder: ["home"],
      leftRailPinned: [],
    };
    registerStateSources({
      getDockTree: () => dockTree,
      getRail: () => rail,
    });

    scheduleWorkspaceSave();
    scheduleWorkspaceSave();
    scheduleWorkspaceSave();

    // Mutate AFTER scheduling, BEFORE the 300ms flush.
    dockTree = { version: "mutated" };
    rail = { ...rail, railWidth: 333 };

    await vi.advanceTimersByTimeAsync(300);

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const flushed = backing.get("workspace") as WorkspaceRecordV1;
    expect(flushed.dockTree).toEqual({ version: "mutated" });
    expect(flushed.rail.railWidth).toBe(333);
    expect(flushed.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
  });
});
