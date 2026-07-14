import { describe, it, expect, beforeEach, vi } from "vitest";

/*
 * homeCards.storage.test.ts — CR-02 fail-pre-fix coverage: loadSections()
 * must structurally validate untrusted persisted JSON before returning it as
 * a SectionMap. Before the fix, any truthy non-null value was blind-cast
 * (`return raw as SectionMap`) and a corrupt applets.json value (e.g.
 * `{"pins":"corrupt"}`) crashed Home's `ids.map(...)` render — violating the
 * T-06-06-01 truth the module's own comment claims.
 */

// Injected per-test: what the mocked LazyStore.get resolves (or throws).
let storedValue: unknown;
let getThrows = false;

vi.mock("@tauri-apps/plugin-store", () => ({
  LazyStore: class {
    async get<T>(): Promise<T | undefined> {
      if (getThrows) throw new Error("IPC unavailable");
      return storedValue as T | undefined;
    }

    async set(): Promise<void> {}

    async save(): Promise<void> {}
  },
}));

const { loadSections } = await import("./homeCards.storage");
const { DEFAULT_SECTIONS } = await import("./cardDefs");

beforeEach(() => {
  storedValue = undefined;
  getThrows = false;
});

describe("loadSections (CR-02: corrupt persisted values fall back to DEFAULT_SECTIONS)", () => {
  it("returns DEFAULT_SECTIONS when the read throws", async () => {
    getThrows = true;
    expect(await loadSections()).toEqual(DEFAULT_SECTIONS);
  });

  it("returns DEFAULT_SECTIONS for null/undefined", async () => {
    storedValue = null;
    expect(await loadSections()).toEqual(DEFAULT_SECTIONS);
    storedValue = undefined;
    expect(await loadSections()).toEqual(DEFAULT_SECTIONS);
  });

  it("returns DEFAULT_SECTIONS for a section value that is not an array", async () => {
    storedValue = { pins: "corrupt", fresh: [], living: [], archive: [] };
    expect(await loadSections()).toEqual(DEFAULT_SECTIONS);
  });

  it("returns DEFAULT_SECTIONS for non-object garbage (array, number, string)", async () => {
    for (const garbage of [[], 42, "sections"]) {
      storedValue = garbage;
      expect(await loadSections()).toEqual(DEFAULT_SECTIONS);
    }
  });

  it("returns DEFAULT_SECTIONS when a section array holds non-string ids", async () => {
    storedValue = { pins: [1, 2], fresh: [], living: [], archive: [] };
    expect(await loadSections()).toEqual(DEFAULT_SECTIONS);
  });

  it("returns DEFAULT_SECTIONS when a section key is missing entirely", async () => {
    storedValue = { pins: [], fresh: [], living: [] }; // no archive
    expect(await loadSections()).toEqual(DEFAULT_SECTIONS);
  });

  it("prunes ids with no cardDefs entry (WR-01: dead minted ids never accumulate)", async () => {
    storedValue = {
      pins: ["corpus", "minted-ghost-from-last-session"],
      fresh: ["minted-another-ghost", "contradiction"],
      living: [],
      archive: ["a-mach"],
    };
    expect(await loadSections()).toEqual({
      pins: ["corpus"],
      fresh: ["contradiction"],
      living: [],
      archive: ["a-mach"],
    });
  });

  it("returns a structurally valid persisted map as-is", async () => {
    const valid = {
      pins: ["corpus"],
      fresh: ["contradiction"],
      living: [],
      archive: ["a-mach"],
    };
    storedValue = valid;
    expect(await loadSections()).toEqual(valid);
  });
});
