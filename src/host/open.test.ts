import { describe, it, expect, vi, beforeEach } from "vitest";

const { getDockApiMock, addAppletToDockMock } = vi.hoisted(() => {
  return { getDockApiMock: vi.fn(), addAppletToDockMock: vi.fn() };
});

vi.mock("../shell/dockApi", () => ({
  getDockApi: getDockApiMock,
  addAppletToDock: addAppletToDockMock,
}));

import { hostOpen } from "./open";

beforeEach(() => {
  getDockApiMock.mockReset();
  addAppletToDockMock.mockReset();
});

describe("host/open hostOpen", () => {
  it("focuses an existing panel whose id splits to appletKey via panel.api.setActive()", () => {
    const setActive = vi.fn();
    const existingPanel = { id: "Wiki:abc123", api: { setActive } };
    getDockApiMock.mockReturnValue({
      panels: [existingPanel, { id: "Library:def456", api: { setActive: vi.fn() } }],
    });

    hostOpen("Wiki");

    expect(setActive).toHaveBeenCalled();
    expect(addAppletToDockMock).not.toHaveBeenCalled();
  });

  it("opens a new instance via addAppletToDock when no matching panel exists", () => {
    getDockApiMock.mockReturnValue({
      panels: [{ id: "Library:def456", api: { setActive: vi.fn() } }],
    });

    hostOpen("Wiki");

    expect(addAppletToDockMock).toHaveBeenCalledWith("Wiki");
  });

  it("no-ops when the dock api is not yet available", () => {
    getDockApiMock.mockReturnValue(null);
    expect(() => hostOpen("Wiki")).not.toThrow();
    expect(addAppletToDockMock).not.toHaveBeenCalled();
  });
});
