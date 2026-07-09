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
  it("restores railMode/railWidth/railOrder/leftRailPinned from the record Dock already loaded (WR-01: no second disk read)", () => {
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
    expect(state.railOrder).toEqual(["Sources"]);
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
});

describe("shellStore rail actions call scheduleWorkspaceSave (PERS-04 wiring)", () => {
  it("setRailMode triggers scheduleWorkspaceSave exactly once", () => {
    shellStore.getState().setRailMode("hidden");
    expect(scheduleWorkspaceSaveMock).toHaveBeenCalledTimes(1);
  });
});
