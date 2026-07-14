import { describe, it, expect } from "vitest";
import { findSection, moveBetweenSections, reorderWithinSection } from "./homeCardsReducer";
import type { SectionMap } from "./homeCardsReducer";

// Boundary coverage for the Home card drag/drop reducer (HOME-02). Mirrors
// railSnap.test.ts's structure: plain object fixtures, no dnd-kit DOM,
// one expect per case, explicit immutability assertions.

function fixture(): SectionMap {
  return {
    pins: ["a", "b"],
    fresh: ["c", "d"],
    living: ["e"],
    archive: ["f", "g"],
  };
}

describe("findSection(map, id)", () => {
  it("returns the section key containing the id", () => {
    expect(findSection(fixture(), "c")).toBe("fresh");
  });

  it("returns null when the id is in no section", () => {
    expect(findSection(fixture(), "nope")).toBeNull();
  });
});

describe("moveBetweenSections(map, activeId, overId)", () => {
  it("removes activeId from its section and inserts at the over-target index in the destination section", () => {
    const map = fixture();
    const next = moveBetweenSections(map, "a", "d");
    expect(next.pins).toEqual(["b"]);
    expect(next.fresh).toEqual(["c", "a", "d"]);
  });

  it("inserting over a section id (not a card id) appends to that section's end", () => {
    const map = fixture();
    const next = moveBetweenSections(map, "a", "fresh");
    expect(next.pins).toEqual(["b"]);
    expect(next.fresh).toEqual(["c", "d", "a"]);
  });

  it("is a no-op when from and to sections are the same", () => {
    const map = fixture();
    const next = moveBetweenSections(map, "a", "b");
    expect(next).toEqual(fixture());
  });

  it("is a no-op when activeId is not found in any section", () => {
    const map = fixture();
    const next = moveBetweenSections(map, "nope", "d");
    expect(next).toEqual(fixture());
  });

  it("does not mutate the input SectionMap", () => {
    const map = fixture();
    const snapshot = JSON.parse(JSON.stringify(map));
    moveBetweenSections(map, "a", "d");
    expect(map).toEqual(snapshot);
  });
});

describe("reorderWithinSection(map, activeId, overId)", () => {
  it("arrayMoves activeId to overId's index within one section", () => {
    const map: SectionMap = { pins: ["a", "b", "c"], fresh: [], living: [], archive: [] };
    const next = reorderWithinSection(map, "a", "c");
    expect(next.pins).toEqual(["b", "c", "a"]);
  });

  it("is a no-op when the computed indices are equal", () => {
    const map = fixture();
    const next = reorderWithinSection(map, "a", "a");
    expect(next).toEqual(fixture());
  });

  it("is a no-op when activeId is missing", () => {
    const map = fixture();
    const next = reorderWithinSection(map, "nope", "b");
    expect(next).toEqual(fixture());
  });

  it("is a no-op when overId is not found in activeId's section", () => {
    const map = fixture();
    const next = reorderWithinSection(map, "a", "c");
    expect(next).toEqual(fixture());
  });

  it("does not mutate the input SectionMap", () => {
    const map: SectionMap = { pins: ["a", "b", "c"], fresh: [], living: [], archive: [] };
    const snapshot = JSON.parse(JSON.stringify(map));
    reorderWithinSection(map, "a", "c");
    expect(map).toEqual(snapshot);
  });
});
