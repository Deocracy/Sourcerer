import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Chrome Rework spec (Phase 2 D-03) for the reworked 40px title bar:
// wordmark + DIVI chip + corpus label + rail-toggle buttons + window controls,
// with exactly one data-tauri-drag-region surviving on the spacer.
import { TitleBar } from "./TitleBar";

afterEach(cleanup);

describe("TitleBar (SHELL-01, Chrome Rework D-03)", () => {
  it("renders the wordmark, DIVI chip, and corpus label", () => {
    render(<TitleBar />);
    expect(screen.getByText("Sourcerer")).toBeTruthy();
    expect(screen.getByText("DIVI")).toBeTruthy();
    expect(screen.getByText("— Default")).toBeTruthy();
  });

  it("renders both rail-toggle buttons with their aria-labels", () => {
    render(<TitleBar />);
    expect(screen.getByLabelText("Cycle rail mode (left)")).toBeTruthy();
    expect(screen.getByLabelText("Cycle rail mode (right)")).toBeTruthy();
  });

  it("renders the three window controls with correct aria-labels", () => {
    render(<TitleBar />);
    expect(screen.getByLabelText("Minimize window")).toBeTruthy();
    expect(screen.getByLabelText("Maximize window")).toBeTruthy();
    expect(screen.getByLabelText("Close window")).toBeTruthy();
  });

  it("puts data-tauri-drag-region on exactly one element — the spacer", () => {
    const { container } = render(<TitleBar />);
    const dragRegions = container.querySelectorAll("[data-tauri-drag-region]");
    expect(dragRegions.length).toBe(1);

    // The drag region must NOT be a window-control button, the DIVI chip, a
    // rail-toggle button, or the logo/wordmark cluster — clicking any of them
    // must fire its handler, not drag (T-02-02).
    const spacer = dragRegions[0] as HTMLElement;
    expect(spacer.tagName).not.toBe("BUTTON");
    expect(spacer.textContent).not.toContain("Sourcerer");
    expect(spacer.textContent).not.toContain("DIVI");

    for (const label of [
      "Minimize window",
      "Maximize window",
      "Close window",
      "Cycle rail mode (left)",
      "Cycle rail mode (right)",
    ]) {
      const btn = screen.getByLabelText(label);
      expect(btn.hasAttribute("data-tauri-drag-region")).toBe(false);
    }
  });
});
