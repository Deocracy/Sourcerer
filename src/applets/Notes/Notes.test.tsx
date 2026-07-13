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

/** A promise whose resolution the test controls — lets us hold host.ai() /
 *  host.storage.get() in flight and interleave UI actions against them
 *  (the exact seam timing the CR-01/CR-02 races hide behind). */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeStubHost(seed: SeedNote[], ai?: Host["ai"], getOverride?: Host["storage"]["get"]) {
  const setMock = vi.fn(async () => {});
  const aiMock = vi.fn(ai ?? (async () => ""));
  const host: Host = {
    storage: {
      get: (getOverride ??
        (async (_key: string, fallback: unknown) => seed ?? fallback)) as Host["storage"]["get"],
      set: setMock as Host["storage"]["set"],
      remove: async () => {},
    },
    ai: aiMock as Host["ai"],
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
  return { host, setMock, aiMock };
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

  it("summarize: clicking Summarize calls host.ai with a prompt containing the note and renders the result inline", async () => {
    const now = Date.now();
    const seed: SeedNote[] = [
      { id: "n1", title: "Alpha", body: "Alpha body", createdAt: now - 1000, updatedAt: now - 1000 },
    ];
    const { host, aiMock } = makeStubHost(seed, async () => "A concise summary.");
    const { App } = await import("./index");
    render(<App host={host} />);

    await screen.findByText("Alpha");
    fireEvent.click(screen.getByRole("button", { name: "Summarize" }));

    expect(await screen.findByText("A concise summary.")).toBeTruthy();
    expect(aiMock).toHaveBeenCalledTimes(1);
    const promptArg = aiMock.mock.calls[0][0] as string;
    expect(promptArg).toContain("Alpha");
    expect(promptArg).toContain("Alpha body");
  });

  it("summarize error: a rejected host.ai renders the honest-degrade copy without hanging", async () => {
    const now = Date.now();
    const seed: SeedNote[] = [
      { id: "n1", title: "Alpha", body: "Alpha body", createdAt: now - 1000, updatedAt: now - 1000 },
    ];
    const { host } = makeStubHost(seed, async () => {
      throw new Error("boom");
    });
    const { App } = await import("./index");
    render(<App host={host} />);

    await screen.findByText("Alpha");
    fireEvent.click(screen.getByRole("button", { name: "Summarize" }));

    expect(await screen.findByText("Couldn't summarize this note.")).toBeTruthy();
    expect(screen.getByText("Check your connection and try again.")).toBeTruthy();
  });

  // WR-05 / CR-02: D-03 — a summarize that resolves after the user has switched
  // notes must NOT render its result under the new note.
  it("D-03: an in-flight summary that resolves after a note switch does not leak across notes", async () => {
    const now = Date.now();
    const seed: SeedNote[] = [
      { id: "n1", title: "Alpha", body: "Alpha body", createdAt: now, updatedAt: now },
      { id: "n2", title: "Beta", body: "Beta body", createdAt: now - 1000, updatedAt: now - 1000 },
    ];
    const gate = deferred<string>();
    const { host } = makeStubHost(seed, () => gate.promise);
    const { App } = await import("./index");
    render(<App host={host} />);

    // Alpha is most-recent → selected by default.
    await screen.findByText("Alpha");
    fireEvent.click(screen.getByRole("button", { name: "Summarize" }));
    // While the request is in flight, switch to Beta.
    fireEvent.click(screen.getByText("Beta"));
    // Now resolve the stale Alpha request.
    gate.resolve("ALPHA-ONLY SUMMARY");
    await gate.promise;

    // The result belonged to Alpha; it must not appear under Beta.
    expect(screen.queryByText("ALPHA-ONLY SUMMARY")).toBeNull();
    expect(screen.getByDisplayValue("Beta")).toBeTruthy();
  });

  // WR-05: D-06/D-07 — the per-tab remembered selection is restored on hydrate,
  // winning over the most-recently-updated default when the note still exists.
  it("D-06: restores the saved selectedNoteId over the most-recent default", async () => {
    const now = Date.now();
    const seed: SeedNote[] = [
      { id: "n1", title: "Alpha", body: "Alpha body", createdAt: now - 2000, updatedAt: now - 2000 },
      { id: "n2", title: "Beta", body: "Beta body", createdAt: now, updatedAt: now },
    ];
    const { host } = makeStubHost(seed);
    const { App } = await import("./index");
    // Same module epoch as ./index (post-resetModules) — shares the instanceState store.
    const { setInstanceState } = await import("../../host/instanceState");
    setInstanceState("test-instance", { selectedNoteId: "n1" });
    render(<App host={host} />);

    // Without the saved selection, Beta (most recent) would be selected.
    // D-06 restore must pick Alpha instead.
    expect(await screen.findByDisplayValue("Alpha")).toBeTruthy();
    expect(screen.queryByDisplayValue("Beta")).toBeNull();
  });

  // WR-05 / CR-01: the mutation UI must be gated until hydration resolves, so a
  // note created in the race window can't be wiped when disk state loads.
  it("CR-01: the New Note button is disabled until hydration completes", async () => {
    const now = Date.now();
    const seed: SeedNote[] = [
      { id: "n1", title: "Alpha", body: "Alpha body", createdAt: now, updatedAt: now },
    ];
    const gate = deferred<SeedNote[]>();
    const { host } = makeStubHost(seed, undefined, (async () => gate.promise) as Host["storage"]["get"]);
    const { App } = await import("./index");
    render(<App host={host} />);

    // Pre-hydration: the only + New Note button (list header) is disabled and
    // the editor pane renders nothing (no misleading empty state).
    const addBtn = screen.getByRole("button", { name: "+ New Note" }) as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
    expect(screen.queryByText("No notes yet")).toBeNull();

    // Resolve hydration → button enables and the persisted note appears.
    gate.resolve(seed);
    expect(await screen.findByText("Alpha")).toBeTruthy();
    expect((screen.getByRole("button", { name: "+ New Note" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});
