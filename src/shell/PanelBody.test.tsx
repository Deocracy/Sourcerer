import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "react-dom/test-utils";
import type { GroupPanelPartInitParameters } from "dockview-core";

/**
 * PanelBody.test.tsx — FWK-02/FWK-03 dispatch assertions (04-02-PLAN.md
 * Task 1/3). makeHost is mocked so this test never touches the real Tauri
 * IPC/sidecar seam (per plan instruction) — a registered applet's App only
 * needs *a* host object shaped correctly, not a live one.
 */
vi.mock("../host/index", () => ({
  makeHost: vi.fn((instanceId: string) => ({
    storage: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
    ai: vi.fn(),
    open: vi.fn(),
    instanceId,
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
  })),
}));

import { makeRenderer } from "./PanelBody";
import {
  setInstanceState,
  getInstanceState,
  deleteInstanceState,
} from "../host/instanceState";

afterEach(() => {
  document.body.innerHTML = "";
});

function initParams(id: string): GroupPanelPartInitParameters {
  return { api: { id } } as unknown as GroupPanelPartInitParameters;
}

describe("PanelBody makeRenderer registry dispatch", () => {
  it("renders a registered templated applet's module (title + DEMO marker), not the generic placeholder", () => {
    const renderer = makeRenderer("Kanban:abc123", "Kanban");
    document.body.appendChild(renderer.element);

    act(() => {
      renderer.init(initParams("Kanban:abc123"));
    });

    expect(renderer.element.textContent).toContain("Kanban");
    expect(renderer.element.textContent).toContain("DEMO");

    act(() => {
      renderer.dispose();
    });
  });

  it("falls back to the generic PanelBody placeholder for an unregistered key without throwing", () => {
    const renderer = makeRenderer("Bogus:xyz987", "Bogus");
    document.body.appendChild(renderer.element);

    expect(() => {
      act(() => {
        renderer.init(initParams("Bogus:xyz987"));
      });
    }).not.toThrow();
    expect(renderer.element.textContent).toContain("Bogus");
    // Generic fallback's fixed copy (PanelBody.module.css/.tsx noteBox), never
    // present on a registered templated stub's DEMO-chip body.
    expect(renderer.element.textContent).toContain("BESPOKE RAILS");

    act(() => {
      renderer.dispose();
    });
  });

  it("(CR-02) dispose does NOT GC the instanceState slot — dockview disposes renderers during fromJSON restore/teardown for panels it immediately recreates with the same ids", () => {
    // Seed a per-tab state slot for a panel id, exactly as a Phase 5 applet
    // would via the reserved instanceState seam.
    setInstanceState("Kanban:restore1", { draft: "survives restore" });

    const renderer = makeRenderer("Kanban:restore1", "Kanban");
    document.body.appendChild(renderer.element);
    act(() => {
      renderer.init(initParams("Kanban:restore1"));
    });

    // fromJSON tears down every live panel's renderer before recreating the
    // layout — this dispose is that exact seam, NOT a user tab close.
    act(() => {
      renderer.dispose();
    });

    // The slot must survive: GC belongs to genuine panel-removal events
    // (Dock.tsx onDidRemovePanel + post-restore reconciliation), never to
    // renderer dispose.
    expect(getInstanceState("Kanban:restore1")).toEqual({ draft: "survives restore" });

    deleteInstanceState("Kanban:restore1"); // test cleanup
  });
});
