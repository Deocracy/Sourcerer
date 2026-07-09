import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the persistence seam so this test never touches @tauri-apps/plugin-store
// IPC — layouts.ts only needs DEFAULT_WORKSPACE, the debounced writer spy, and
// the three small accessors this plan adds to workspaceStore.ts
// (getCurrentRecord/setSavedLayouts/restoreDockTree). shellStore.ts imports the
// SAME "../persistence/workspaceStore" module path, so this one vi.mock also
// backs shellStore's own DEFAULT_WORKSPACE/scheduleWorkspaceSave/loadWorkspaceRecord
// usage (03-02's shellStore.test.ts precedent).
const { scheduleWorkspaceSaveMock, restoreDockTreeMock, loadWorkspaceRecordMock, DEFAULT_WORKSPACE } = vi.hoisted(
  () => ({
    scheduleWorkspaceSaveMock: vi.fn(),
    restoreDockTreeMock: vi.fn(() => true),
    loadWorkspaceRecordMock: vi.fn(),
    DEFAULT_WORKSPACE: {
      schemaVersion: 1,
      dockTree: null,
      rail: {
        railMode: "expanded" as const,
        railWidth: 220,
        railOrder: ["Sources", "Library", "Wiki", "Graph"],
        leftRailPinned: [] as string[],
      },
      savedLayouts: {},
      instanceState: {},
    },
  }),
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let record: any;

function resetRecord() {
  record = {
    schemaVersion: 1,
    dockTree: { panels: ["Wiki"] },
    rail: {
      railMode: "expanded",
      railWidth: 220,
      railOrder: ["Sources", "Library", "Wiki", "Graph"],
      leftRailPinned: [],
    },
    savedLayouts: {},
    instanceState: {},
  };
}

vi.mock("../persistence/workspaceStore", () => ({
  DEFAULT_WORKSPACE,
  loadWorkspaceRecord: loadWorkspaceRecordMock,
  scheduleWorkspaceSave: scheduleWorkspaceSaveMock,
  restoreDockTree: restoreDockTreeMock,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getCurrentRecord: () => record,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setSavedLayouts: (next: any) => {
    record = { ...record, savedLayouts: next };
  },
}));

import { saveLayout, applyLayout, deleteLayout, resetToDefault } from "./layouts";
import { shellStore } from "../store/shellStore";

beforeEach(() => {
  resetRecord();
  scheduleWorkspaceSaveMock.mockClear();
  restoreDockTreeMock.mockClear();
  restoreDockTreeMock.mockReturnValue(true);
  shellStore.setState({
    railMode: "expanded",
    railOpen: true,
    railWidth: 220,
    railOrder: ["Sources", "Library", "Wiki", "Graph"],
    leftRailPinned: [],
  });
});

describe("saveLayout(name)", () => {
  it("snapshots the current record (minus savedLayouts) under a fresh id and persists", () => {
    saveLayout("Research");

    const ids = Object.keys(record.savedLayouts);
    expect(ids.length).toBe(1);
    const saved = record.savedLayouts[ids[0]];
    expect(saved.name).toBe("Research");
    expect(saved.record.dockTree).toEqual({ panels: ["Wiki"] });
    expect(saved.record.rail).toEqual(record.rail);
    expect("savedLayouts" in saved.record).toBe(false);
    expect(scheduleWorkspaceSaveMock).toHaveBeenCalled();
  });

  it("gives each saved layout a distinct id across multiple saves", () => {
    saveLayout("First");
    saveLayout("Second");
    const ids = Object.keys(record.savedLayouts);
    expect(ids.length).toBe(2);
    expect(new Set(ids).size).toBe(2);
  });
});

describe("applyLayout(id)", () => {
  it("restores dock tree via the restore seam AND rail state via shellStore, then persists", () => {
    record.savedLayouts = {
      abc: {
        id: "abc",
        name: "Research",
        record: {
          schemaVersion: 1,
          dockTree: { panels: ["Notes"] },
          rail: {
            railMode: "compact",
            railWidth: 180,
            railOrder: ["Notes"],
            leftRailPinned: ["Notes"],
          },
          instanceState: {},
        },
      },
    };

    applyLayout("abc");

    expect(restoreDockTreeMock).toHaveBeenCalledWith({ panels: ["Notes"] });
    const state = shellStore.getState();
    expect(state.railMode).toBe("compact");
    expect(state.railWidth).toBe(180);
    expect(state.railOrder).toEqual(["Notes"]);
    expect(state.leftRailPinned).toEqual(["Notes"]);
    expect(state.railOpen).toBe(true);
    expect(scheduleWorkspaceSaveMock).toHaveBeenCalled();
  });

  it("no-ops when the layout id does not exist", () => {
    applyLayout("does-not-exist");
    expect(restoreDockTreeMock).not.toHaveBeenCalled();
    expect(scheduleWorkspaceSaveMock).not.toHaveBeenCalled();
  });
});

describe("deleteLayout(id)", () => {
  it("removes only the targeted entry, leaving other layouts untouched, and persists", () => {
    record.savedLayouts = {
      a: { id: "a", name: "A", record: {} },
      b: { id: "b", name: "B", record: {} },
    };

    deleteLayout("a");

    expect(Object.keys(record.savedLayouts)).toEqual(["b"]);
    expect(scheduleWorkspaceSaveMock).toHaveBeenCalled();
  });
});

describe("resetToDefault()", () => {
  it("restores DEFAULT_WORKSPACE dock/rail WITHOUT clearing savedLayouts (D-03), then persists", () => {
    record.savedLayouts = { a: { id: "a", name: "A", record: {} } };

    resetToDefault();

    expect(restoreDockTreeMock).toHaveBeenCalledWith(null);
    const state = shellStore.getState();
    expect(state.railMode).toBe(DEFAULT_WORKSPACE.rail.railMode);
    expect(state.railWidth).toBe(DEFAULT_WORKSPACE.rail.railWidth);
    expect(state.railOrder).toEqual(DEFAULT_WORKSPACE.rail.railOrder);
    expect(state.leftRailPinned).toEqual(DEFAULT_WORKSPACE.rail.leftRailPinned);
    // D-03: savedLayouts must NOT be emptied by reset.
    expect(record.savedLayouts).toEqual({ a: { id: "a", name: "A", record: {} } });
    expect(scheduleWorkspaceSaveMock).toHaveBeenCalled();
  });
});
