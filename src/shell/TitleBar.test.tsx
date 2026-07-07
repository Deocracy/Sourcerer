import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// RED spec for SHELL-01. Imports TitleBar, which does NOT exist yet —
// this suite MUST fail (module-not-found) until plan 01-02 builds the component.
// This is the Nyquist gate for the title-bar UI work in 01-02.
import { TitleBar } from "./TitleBar";

afterEach(cleanup);

describe("TitleBar (SHELL-01)", () => {
  it("renders the left cluster: wordmark, separator, and Home crumb", () => {
    render(<TitleBar />);
    expect(screen.getByText("Sourcerer")).toBeTruthy();
    expect(screen.getByText("·")).toBeTruthy();
    expect(screen.getByText("Home")).toBeTruthy();
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

    // The drag region must NOT be a window-control button or the logo/wordmark
    // cluster — clicking a button or the logo must fire its handler, not drag (T-01-03).
    const spacer = dragRegions[0] as HTMLElement;
    expect(spacer.tagName).not.toBe("BUTTON");
    expect(spacer.textContent).not.toContain("Sourcerer");

    for (const label of ["Minimize window", "Maximize window", "Close window"]) {
      const btn = screen.getByLabelText(label);
      expect(btn.hasAttribute("data-tauri-drag-region")).toBe(false);
    }
  });
});
