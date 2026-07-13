import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { Host } from "../../host/types";

/**
 * Notes.test.tsx — 05-01-PLAN.md Task 1: NOTE-01 coverage (create/edit/
 * delete). Mirrors src/applets/Library/Library.test.tsx's makeStubHost()
 * idiom (a plain object shaped like Host, no live Tauri IPC) and
 * render/screen/fireEvent/afterEach(cleanup). Assertions query by visible
 * text/role, never CSS class names.
 *
 * Notes' store (src/applets/Notes/store.ts) is a module-level singleton by
 * design (D-04 — shared across every open Notes tab in the same process).
 * That means the *first* test to import "./index" hydrates it from that
 * test's seed and every later import in the same process would otherwise
 * see already-hydrated state. `vi.resetModules()` + a dynamic `import("./
 * index")` per test gives each test a fresh module graph (fresh store,
 * fresh hydrate-guard) so tests stay independent whether run individually
 * (`-t "create"`) or together as a full file.
 */

interface SeedNote {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

function makeStubHost(seed: SeedNote[]) {
  const setMock = vi.fn(async () => {});
  const host: Host = {
    storage: {
      get: (async (_key: string, fallback: unknown) => seed ?? fallback) as Host["storage"]["get"],
      set: setMock as Host["storage"]["set"],
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
  return { host, setMock };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(cleanup);

describe("Notes applet", () => {
  it("create: clicking + New Note adds a row and focuses the title input", async () => {
    const { host } = makeStubHost([]);
    const { App } = await import("./index");
    render(<App host={host} />);

    await screen.findByText("No notes yet");
    const addButtons = screen.getAllByText("+ New Note");
    fireEvent.click(addButtons[0]);

    expect(await screen.findByText("Untitled")).toBeTruthy();
    const titleInput = screen.getByRole("textbox", { name: "Note title" });
    expect(document.activeElement).toBe(titleInput);
  });

  it("edit: typing in the title input updates the row label and calls host.storage.set with key notes", async () => {
    const now = Date.now();
    const seed: SeedNote[] = [
      { id: "n1", title: "Alpha", body: "Alpha body", createdAt: now - 1000, updatedAt: now - 1000 },
    ];
    const { host, setMock } = makeStubHost(seed);
    const { App } = await import("./index");
    render(<App host={host} />);

    await screen.findByText("Alpha");
    const titleInput = screen.getByRole("textbox", { name: "Note title" }) as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Alpha Renamed" } });
    fireEvent.blur(titleInput);

    expect(screen.getByText("Alpha Renamed")).toBeTruthy();
    expect(setMock).toHaveBeenCalledWith("notes", expect.any(Array));
  });

  it("delete: deleting the selected note selects the next note down, or shows the empty state when none remain", async () => {
    const now = Date.now();
    const seed: SeedNote[] = [
      { id: "n1", title: "Alpha", body: "Alpha body", createdAt: now - 2000, updatedAt: now - 2000 },
      { id: "n2", title: "Beta", body: "Beta body", createdAt: now - 1000, updatedAt: now - 1000 },
    ];
    const { host } = makeStubHost(seed);
    const { App } = await import("./index");
    render(<App host={host} />);

    // Beta is most-recently-updated, so it sorts to the top and is the
    // silent-fallback default selection (D-07, no saved instanceState yet).
    await screen.findByText("Beta");
    const deleteBtn = screen.getByLabelText("Delete note");
    fireEvent.click(deleteBtn);
    expect(screen.getByText("Delete for real?")).toBeTruthy();
    fireEvent.click(deleteBtn);

    expect(screen.queryByText("Beta")).toBeNull();
    expect(screen.getByDisplayValue("Alpha")).toBeTruthy();

    // Delete the last remaining note -> empty state.
    fireEvent.click(deleteBtn);
    fireEvent.click(deleteBtn);
    expect(await screen.findByText("No notes yet")).toBeTruthy();
  });
});
