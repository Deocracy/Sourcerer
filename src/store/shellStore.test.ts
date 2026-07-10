import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the persistence seam so this test never touches @tauri-apps/plugin-store
// IPC — shellStore only needs DEFAULT_WORKSPACE (sync seed), loadWorkspaceRecord
// (hydrateFromDisk), and scheduleWorkspaceSave (the debounced writer spy).
const { loadWorkspaceRecordMock, scheduleWorkspaceSaveMock } = vi.hoisted(() => {
  return {
    loadWorkspaceRecordMock: vi.fn(),
    scheduleWorkspaceSaveMock: vi.fn(),
  };
});

vi.mock("../persistence/workspaceStore", () => ({
  DEFAULT_WORKSPACE: {
    schemaVersion: 1,
    dockTree: null,
    rail: {
      railMode: "expanded",
      railWidth: 220,
      railOrder: ["Sources", "Library", "Wiki", "Graph"],
      leftRailPinned: [],
    },
    savedLayouts: {},
    instanceState: {},
  },
  loadWorkspaceRecord: loadWorkspaceRecordMock,
  scheduleWorkspaceSave: scheduleWorkspaceSaveMock,
}));

import { shellStore, hydrateFromDisk } from "./shellStore";
import { appletDefs } from "../shell/appletDefs";

// Deterministic starting state before each behavior assertion. The store is a
// singleton created once at import; reset the mutable slices between tests.
beforeEach(() => {
  loadWorkspaceRecordMock.mockReset();
  scheduleWorkspaceSaveMock.mockClear();
  shellStore.setState({
    railMode: "expanded",
    railOpen: true,
    railWidth: 220,
    railOrder: ["Sources", "Library", "Wiki", "Graph"],
    leftRailPinned: [],
    badges: {},
  });
});

describe("shellStore.cycleRailMode()", () => {
  it("cycles expanded -> compact -> hidden -> expanded and tracks railOpen", () => {
    const { cycleRailMode } = shellStore.getState();

    cycleRailMode();
    expect(shellStore.getState().railMode).toBe("compact");
    expect(shellStore.getState().railOpen).toBe(true);

    cycleRailMode();
    expect(shellStore.getState().railMode).toBe("hidden");
    expect(shellStore.getState().railOpen).toBe(false);

    cycleRailMode();
    expect(shellStore.getState().railMode).toBe("expanded");
    expect(shellStore.getState().railOpen).toBe(true);
  });
});

describe("shellStore.reorderRail(from, to)", () => {
  it("moves the element at `from` to index `to`, preserving length (arrayMove)", () => {
    shellStore.getState().reorderRail(0, 2);
    const order = shellStore.getState().railOrder;
    expect(order).toEqual(["Library", "Wiki", "Sources", "Graph"]);
    expect(order.length).toBe(4);
  });
});

describe("shellStore.togglePin(key)", () => {
  it("adds a key if absent and removes it if present", () => {
    shellStore.getState().togglePin("Notes");
    expect(shellStore.getState().leftRailPinned).toContain("Notes");

    shellStore.getState().togglePin("Notes");
    expect(shellStore.getState().leftRailPinned).not.toContain("Notes");
  });
});

describe("shellStore.setBadge(key, n)", () => {
  it("sets badges[key] to n", () => {
    shellStore.getState().setBadge("Wiki", 7);
    expect(shellStore.getState().badges.Wiki).toBe(7);
  });
});

describe("shellStore hydrateFromDisk (PERS-01)", () => {
  it("restores railMode/railWidth/leftRailPinned from the record Dock already loaded (WR-01: no second disk read); D-19 appends every other registered key after the saved order", () => {
    hydrateFromDisk({
      schemaVersion: 1,
      dockTree: null,
      rail: {
        railMode: "compact",
        railWidth: 180,
        railOrder: ["Sources"],
        leftRailPinned: ["Sources"],
      },
      savedLayouts: {},
      instanceState: {},
    });

    // WR-01: hydrateFromDisk must not trigger its own loadWorkspaceRecord.
    expect(loadWorkspaceRecordMock).not.toHaveBeenCalled();

    const state = shellStore.getState();
    expect(state.railMode).toBe("compact");
    expect(state.railWidth).toBe(180);
    // D-19: the saved order's single entry stays first, every other
    // appletDefs key gets appended after it (bottom of the main group).
    expect(state.railOrder[0]).toBe("Sources");
    expect(state.railOrder).toEqual(expect.arrayContaining(Object.keys(appletDefs)));
    expect(state.railOrder.length).toBe(Object.keys(appletDefs).length);
    expect(state.leftRailPinned).toEqual(["Sources"]);
    expect(state.railOpen).toBe(true);
  });

  it("sets railOpen false when the restored railMode is hidden", () => {
    hydrateFromDisk({
      schemaVersion: 1,
      dockTree: null,
      rail: {
        railMode: "hidden",
        railWidth: 220,
        railOrder: ["Sources"],
        leftRailPinned: [],
      },
      savedLayouts: {},
      instanceState: {},
    });

    expect(shellStore.getState().railOpen).toBe(false);
  });

  it("D-19: a restored railOrder already containing every key is left untouched (no duplicates, existing order preserved)", () => {
    const railOrder = ["Sources", "Library", "Wiki", "Graph"];
    hydrateFromDisk({
      schemaVersion: 1,
      dockTree: null,
      rail: {
        railMode: "expanded",
        railWidth: 220,
        railOrder,
        leftRailPinned: [],
      },
      savedLayouts: {},
      instanceState: {},
    });

    // Only the 4 legacy keys are pre-seeded here; the remaining appletDefs
    // keys (Chat, Writing, ...) are missing and get appended at the end,
    // preserving the existing 4-key order exactly.
    const state = shellStore.getState();
    expect(state.railOrder.slice(0, 4)).toEqual(railOrder);
    expect(new Set(state.railOrder).size).toBe(state.railOrder.length);
  });
});

describe("shellStore rail actions call scheduleWorkspaceSave (PERS-04 wiring)", () => {
  it("setRailMode triggers scheduleWorkspaceSave exactly once", () => {
    shellStore.getState().setRailMode("hidden");
    expect(scheduleWorkspaceSaveMock).toHaveBeenCalledTimes(1);
  });
});
