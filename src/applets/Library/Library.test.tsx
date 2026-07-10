import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { Host } from "../../host/types";
import { App } from "./index";

/**
 * Library.test.tsx — 04-04-PLAN.md Task 2: component coverage for the ported
 * rich Library demo. Mirrors src/applets/Wiki/Wiki.test.tsx's mocked-host
 * idiom (a plain object shaped like Host, no live Tauri IPC) and
 * src/shell/PanelBody.test.tsx's stub-host shape. Assertions query by
 * visible text/role rather than CSS class names so they stay resilient to
 * the ported inline-style markup.
 */

function makeStubHost(): Host {
  return {
    storage: {
      get: async (_key, fallback) => fallback,
      set: async () => {},
      remove: async () => {},
    },
    ai: async () => "",
    open: vi.fn(),
    instanceId: "test-instance",
    theme: {
      bg: "#0a0a0b",
      panel: "#131418",
      panel2: "#0F1013",
      line: "#1e1f22",
      line2: "#26272B",
      text: "#e6e4de",
      muted: "#A5A29A",
      faint: "#6E6C66",
      accent: "#86A38C",
      accentHover: "#A3BCA8",
      fontMono: "mono",
      fontSerif: "serif",
      fontSans: "sans",
    },
  };
}

afterEach(cleanup);

describe("Library applet", () => {
  it("renders the corpus dashboard (corpus name, a Stat tile) and the DEMO marker", () => {
    const host = makeStubHost();
    render(<App host={host} />);
    expect(screen.getByRole("heading", { name: /corpus/i })).toBeTruthy();
    expect(screen.getByText("DOCUMENTS")).toBeTruthy();
    expect(screen.getByText("DEMO")).toBeTruthy();
  });

  it("calls host.open('Wiki') when the review CTA is clicked", () => {
    const host = makeStubHost();
    render(<App host={host} />);
    fireEvent.click(screen.getByText(/need review/));
    expect(host.open).toHaveBeenCalledWith("Wiki");
  });

  it("renders the Ingest view with status chips when the INGEST tab is selected", () => {
    const host = makeStubHost();
    render(<App host={host} />);
    fireEvent.click(screen.getByText("INGEST"));
    expect(screen.getByText("Add documents")).toBeTruthy();
    expect(screen.getAllByText("PROCESSING").length).toBeGreaterThan(0);
    expect(screen.getByText("FAILED")).toBeTruthy();
  });

  it("renders the Document view with trust/status chips for the default selection", () => {
    const host = makeStubHost();
    render(<App host={host} />);
    fireEvent.click(screen.getByText("DOCUMENT"));
    expect(screen.getByRole("heading", { name: "Vita Ficini" })).toBeTruthy();
    expect(screen.getAllByText("CURATED").length).toBeGreaterThan(0);
    expect(screen.getByText("PROCESSED")).toBeTruthy();
  });

  it("opens the delete ConfirmFlow modal and reaches the DELETED confirmation, non-destructively", () => {
    const host = makeStubHost();
    render(<App host={host} />);
    fireEvent.click(screen.getByText("DOCUMENT"));
    fireEvent.click(screen.getByText("DELETE DOCUMENT", { selector: "button" }));

    expect(screen.getAllByText("DELETE DOCUMENT").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("DELETE", { selector: "button" }));

    expect(screen.getByText("DELETED ✓")).toBeTruthy();
    expect(screen.getByText("↩ UNDO / REVERT")).toBeTruthy();
  });
});
