import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// Mock the layouts.ts service so the component's click handlers can be
// asserted in isolation, and mock workspaceStore's reactive savedLayouts
// seam (subscribeSavedLayouts/getSavedLayouts) so the row list is fully
// controlled by the test (03-PATTERNS.md component test idiom, TitleBar.test.tsx).
const { saveLayoutMock, applyLayoutMock, deleteLayoutMock, resetToDefaultMock } = vi.hoisted(() => ({
  saveLayoutMock: vi.fn(),
  applyLayoutMock: vi.fn(),
  deleteLayoutMock: vi.fn(),
  resetToDefaultMock: vi.fn(),
}));

vi.mock("../persistence/layouts", () => ({
  saveLayout: saveLayoutMock,
  applyLayout: applyLayoutMock,
  deleteLayout: deleteLayoutMock,
  resetToDefault: resetToDefaultMock,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let savedLayouts: Record<string, any> = {};
const listeners = new Set<(next: typeof savedLayouts) => void>();

vi.mock("../persistence/workspaceStore", () => ({
  getSavedLayouts: () => savedLayouts,
  subscribeSavedLayouts: (listener: (next: typeof savedLayouts) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
}));

import { LayoutsMenu } from "./LayoutsMenu";

afterEach(cleanup);

beforeEach(() => {
  savedLayouts = {};
  listeners.clear();
  saveLayoutMock.mockClear();
  applyLayoutMock.mockClear();
  deleteLayoutMock.mockClear();
  resetToDefaultMock.mockClear();
});

describe("LayoutsMenu trigger", () => {
  it("renders the LAYOUTS trigger with its aria-label", () => {
    render(<LayoutsMenu />);
    expect(screen.getByLabelText("Layouts menu")).toBeTruthy();
    expect(screen.getByText("LAYOUTS ▾")).toBeTruthy();
  });

  it("opens the panel on click and shows the empty state when no layouts are saved", () => {
    render(<LayoutsMenu />);
    fireEvent.click(screen.getByLabelText("Layouts menu"));
    expect(screen.getByText("No saved layouts yet")).toBeTruthy();
  });

  it("closes the panel on a second trigger click", () => {
    render(<LayoutsMenu />);
    const trigger = screen.getByLabelText("Layouts menu");
    fireEvent.click(trigger);
    expect(screen.getByText("No saved layouts yet")).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.queryByText("No saved layouts yet")).toBeNull();
  });
});

describe("LayoutsMenu save-current flow", () => {
  it("opens a name input and calls saveLayout(name) on Enter", () => {
    render(<LayoutsMenu />);
    fireEvent.click(screen.getByLabelText("Layouts menu"));
    fireEvent.click(screen.getByText("Save current…"));

    const input = screen.getByPlaceholderText("Layout name…");
    fireEvent.change(input, { target: { value: "Research" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(saveLayoutMock).toHaveBeenCalledWith("Research");
  });
});

describe("LayoutsMenu saved rows", () => {
  beforeEach(() => {
    savedLayouts = {
      abc: { id: "abc", name: "Research", record: {} },
    };
  });

  it("clicking a row calls applyLayout(id)", () => {
    render(<LayoutsMenu />);
    fireEvent.click(screen.getByLabelText("Layouts menu"));
    fireEvent.click(screen.getByText("Research"));
    expect(applyLayoutMock).toHaveBeenCalledWith("abc");
  });

  it("clicking the row's × calls deleteLayout(id) without applying it", () => {
    render(<LayoutsMenu />);
    fireEvent.click(screen.getByLabelText("Layouts menu"));
    fireEvent.click(screen.getByLabelText("Delete layout Research"));
    expect(deleteLayoutMock).toHaveBeenCalledWith("abc");
    expect(applyLayoutMock).not.toHaveBeenCalled();
  });
});

describe("LayoutsMenu keyboard navigation (WR-06)", () => {
  beforeEach(() => {
    savedLayouts = {
      abc: { id: "abc", name: "Research", record: {} },
      def: { id: "def", name: "Writing", record: {} },
    };
  });

  it("focuses the panel on open so key events actually reach the menu", () => {
    render(<LayoutsMenu />);
    fireEvent.click(screen.getByLabelText("Layouts menu"));
    const panel = screen.getByRole("menu");
    expect(document.activeElement).toBe(panel);
  });

  it("ArrowDown + Enter applies the focused row (rows are recent-first)", () => {
    render(<LayoutsMenu />);
    fireEvent.click(screen.getByLabelText("Layouts menu"));
    const panel = screen.getByRole("menu");

    fireEvent.keyDown(panel, { key: "ArrowDown" }); // -> "Writing" (recent-first row 0)
    fireEvent.keyDown(panel, { key: "Enter" });

    expect(applyLayoutMock).toHaveBeenCalledWith("def");
  });

  it("Delete removes the focused row without applying it", () => {
    render(<LayoutsMenu />);
    fireEvent.click(screen.getByLabelText("Layouts menu"));
    const panel = screen.getByRole("menu");

    fireEvent.keyDown(panel, { key: "ArrowDown" });
    fireEvent.keyDown(panel, { key: "ArrowDown" }); // -> "Research" (row 1)
    fireEvent.keyDown(panel, { key: "Delete" });

    expect(deleteLayoutMock).toHaveBeenCalledWith("abc");
    expect(applyLayoutMock).not.toHaveBeenCalled();
  });
});

describe("LayoutsMenu Reset", () => {
  it("calls resetToDefault()", () => {
    render(<LayoutsMenu />);
    fireEvent.click(screen.getByLabelText("Layouts menu"));
    fireEvent.click(screen.getByText("Reset"));
    expect(resetToDefaultMock).toHaveBeenCalled();
  });
});
