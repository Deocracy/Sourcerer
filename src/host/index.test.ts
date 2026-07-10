import { describe, it, expect, vi } from "vitest";

vi.mock("@tauri-apps/plugin-store", () => {
  class LazyStore {
    async get(): Promise<undefined> {
      return undefined;
    }
    async set(): Promise<void> {}
    async delete(): Promise<boolean> {
      return true;
    }
    async save(): Promise<void> {}
  }
  return { LazyStore };
});

vi.mock("../shell/dockApi", () => ({
  getDockApi: vi.fn(() => null),
  addAppletToDock: vi.fn(),
}));

import { makeHost } from "./index";

describe("host/index makeHost", () => {
  it("returns exactly the five keys: storage, ai, open, instanceId, theme", () => {
    const host = makeHost("instance-1", "Notes");
    expect(Object.keys(host).sort()).toEqual(
      ["ai", "instanceId", "open", "storage", "theme"].sort(),
    );
  });

  it("instanceId passes through as the value given", () => {
    const host = makeHost("instance-42", "Notes");
    expect(host.instanceId).toBe("instance-42");
  });
});
