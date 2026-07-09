import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";

// Same in-memory LazyStore fake as workspaceStore.test.ts — this test uses
// the REAL workspaceStore module so it exercises the actual boot ordering
// that CR-04 fixed: ResetNotice mounts BEFORE the async load flips the
// reset signal, and must re-render when it does.
const { backing, backupBacking } = vi.hoisted(() => ({
  backing: new Map<string, unknown>(),
  backupBacking: new Map<string, unknown>(),
}));

vi.mock("@tauri-apps/plugin-store", () => {
  class LazyStore {
    private map: Map<string, unknown>;
    constructor(path: string) {
      this.map = path === "workspace.json.bak" ? backupBacking : backing;
    }
    async get<T>(key: string): Promise<T | undefined> {
      return this.map.get(key) as T | undefined;
    }
    async set(key: string, value: unknown): Promise<void> {
      this.map.set(key, value);
    }
    async save(): Promise<void> {}
  }
  return { LazyStore };
});

import { loadWorkspaceRecord, acknowledgeReset, resetOccurred } from "../persistence/workspaceStore";
import { ResetNotice } from "./ResetNotice";

beforeEach(() => {
  backing.clear();
  backupBacking.clear();
  acknowledgeReset();
});

afterEach(cleanup);

describe("ResetNotice (D-04 corrupt-reset banner, CR-04)", () => {
  it("appears when the corrupt fallback resolves AFTER the initial render (the real boot ordering)", async () => {
    // AppShell mounts ResetNotice synchronously — no reset yet, renders null.
    render(<ResetNotice />);
    expect(screen.queryByRole("status")).toBeNull();

    // Dock's async boot load then hits a corrupt persisted value and falls
    // back to DEFAULT_WORKSPACE, flipping the reset signal.
    backing.set("workspace", { junk: "not-a-workspace-record" });
    await act(async () => {
      await loadWorkspaceRecord();
    });

    // The banner must now be visible — pre-CR-04 nothing re-rendered it.
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText(/Workspace was reset/)).toBeTruthy();
  });

  it("dismiss hides the banner and acknowledges the reset for the session", async () => {
    render(<ResetNotice />);
    backing.set("workspace", { junk: true });
    await act(async () => {
      await loadWorkspaceRecord();
    });
    expect(screen.getByRole("status")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Dismiss notice"));

    expect(screen.queryByRole("status")).toBeNull();
    expect(resetOccurred()).toBe(false);
  });
});
