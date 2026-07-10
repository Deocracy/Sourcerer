import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { Host } from "../../host/types";
import { App } from "./index";

/**
 * Wiki.test.tsx — 04-03-PLAN.md Task 2: component coverage for the ported
 * rich Wiki demo. Mirrors src/shell/PanelBody.test.tsx's mocked-host idiom
 * (a plain object shaped like Host, no live Tauri IPC) and
 * src/shell/LayoutsMenu.test.tsx's render/query/fireEvent idiom. Assertions
 * query by visible text/role rather than CSS class names so they stay
 * resilient to the ported inline-style markup (04-03-PLAN.md Task 2 note).
 */

const stubHost: Host = {
  storage: {
    get: async (_key, fallback) => fallback,
    set: async () => {},
    remove: async () => {},
  },
  ai: async () => "",
  open: () => {},
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

afterEach(cleanup);

describe("Wiki applet", () => {
  it("renders the Ficino article title, a claim attribute, and the DEMO marker", () => {
    render(<App host={stubHost} />);
    expect(screen.getByRole("heading", { name: "Marsilio Ficino" })).toBeTruthy();
    expect(screen.getByText("Born")).toBeTruthy();
    expect(screen.getByText("DEMO")).toBeTruthy();
  });

  it("advances a claim's EDIT control to the PREVIEW CHANGES dry-run stage with an APPLY affordance", () => {
    render(<App host={stubHost} />);
    fireEvent.click(screen.getAllByText("EDIT")[0]);

    // Preview is gated on an actual edit (button disabled until val changes).
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "19 October 1433, Figline Valdarno (revised)" } });
    fireEvent.click(screen.getByText("PREVIEW CHANGES →"));

    expect(screen.getByText("DRY-RUN PREVIEW")).toBeTruthy();
    expect(screen.getByText("APPLY")).toBeTruthy();
  });

  it("renders review queue rows on the REVIEW QUEUE tab", () => {
    render(<App host={stubHost} />);
    fireEvent.click(screen.getByText("REVIEW QUEUE"));
    expect(screen.getByText(/BIRTHPLACE/)).toBeTruthy();
    expect(screen.getByText("CHOOSE GENOA")).toBeTruthy();
  });

  it("shows the first-class Unresolved block when switching to the Alberti entity", () => {
    render(<App host={stubHost} />);
    // Only the entity picker's chip matches before the article body switches.
    fireEvent.click(screen.getByText("Leon Battista Alberti"));

    expect(screen.getByText(/UNRESOLVED · BIRTHPLACE/)).toBeTruthy();
    expect(screen.getByText("Genoa")).toBeTruthy();
    expect(screen.getByText("Venice")).toBeTruthy();
  });
});
