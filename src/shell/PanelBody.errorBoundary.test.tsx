import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "react-dom/test-utils";
import type { GroupPanelPartInitParameters } from "dockview-core";

/**
 * PanelBody.errorBoundary.test.tsx — WR-04 containment: a registered applet
 * whose App throws during render must render the generic PanelBody fallback,
 * never escape as an uncaught error that blanks the panel. Registry is mocked
 * (in its own file so PanelBody.test.tsx keeps the real registry).
 */
vi.mock("./registry", () => ({
  registry: {
    Boom: {
      manifest: { key: "Boom", glyph: "!", code: "BM", title: "Boom", desc: "throws on render" },
      App: () => {
        throw new Error("render exploded");
      },
    },
  },
}));

vi.mock("../host/index", () => ({
  makeHost: vi.fn((instanceId: string) => ({ instanceId })),
}));

import { makeRenderer } from "./PanelBody";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function initParams(id: string): GroupPanelPartInitParameters {
  return { api: { id } } as unknown as GroupPanelPartInitParameters;
}

describe("PanelBody AppletErrorBoundary (WR-04)", () => {
  it("a registered applet that throws during render is contained — the generic PanelBody fallback renders instead of a blank panel", () => {
    // React logs caught boundary errors to console.error — silence for a
    // clean test run; the assertion below is the containment proof.
    vi.spyOn(console, "error").mockImplementation(() => {});

    const renderer = makeRenderer("Boom:crash1", "Boom");
    document.body.appendChild(renderer.element);

    expect(() => {
      act(() => {
        renderer.init(initParams("Boom:crash1"));
      });
    }).not.toThrow();

    // Generic fallback's fixed copy (PanelBody noteBox) proves the boundary
    // swapped in the placeholder rather than leaving an empty root.
    expect(renderer.element.textContent).toContain("Boom");
    expect(renderer.element.textContent).toContain("BESPOKE RAILS");

    act(() => {
      renderer.dispose();
    });
  });
});
