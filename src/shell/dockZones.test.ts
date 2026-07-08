import { describe, expect, it } from "vitest";
import { resolveDropZone, type DropZoneRect } from "./dockZones";

const GROUP_RECT: DropZoneRect = {
  groupId: "g1",
  rect: { left: 0, top: 0, width: 100, height: 100 },
};

describe("resolveDropZone", () => {
  it("resolves the left 28% edge band to direction 'left'", () => {
    const result = resolveDropZone({ x: 10, y: 50 }, [GROUP_RECT]);
    expect(result).toEqual({ referenceGroup: "g1", direction: "left" });
  });

  it("resolves the right 28% edge band to direction 'right'", () => {
    const result = resolveDropZone({ x: 90, y: 50 }, [GROUP_RECT]);
    expect(result).toEqual({ referenceGroup: "g1", direction: "right" });
  });

  it("resolves the top 28% edge band to direction 'above'", () => {
    const result = resolveDropZone({ x: 50, y: 10 }, [GROUP_RECT]);
    expect(result).toEqual({ referenceGroup: "g1", direction: "above" });
  });

  it("resolves the bottom 28% edge band to direction 'below'", () => {
    const result = resolveDropZone({ x: 50, y: 90 }, [GROUP_RECT]);
    expect(result).toEqual({ referenceGroup: "g1", direction: "below" });
  });

  it("resolves the center 44% region to a tab-join (direction undefined)", () => {
    const result = resolveDropZone({ x: 50, y: 50 }, [GROUP_RECT]);
    expect(result).toEqual({ referenceGroup: "g1", direction: undefined });
  });

  it("treats the exact 28%/72% boundary as center (strict-less-than edge band)", () => {
    const result = resolveDropZone({ x: 28, y: 50 }, [GROUP_RECT]);
    expect(result).toEqual({ referenceGroup: "g1", direction: undefined });
  });

  it("resolves a corner deterministically (closest-edge precedence, stable tie-break)", () => {
    // Equidistant from left (5%) and top (5%) edges — left wins on stable
    // array-order tie-break (left/right checked before above/below).
    const result = resolveDropZone({ x: 5, y: 5 }, [GROUP_RECT]);
    expect(result).toEqual({ referenceGroup: "g1", direction: "left" });
  });

  it("returns null when the point falls outside every group's rect", () => {
    const result = resolveDropZone({ x: 150, y: 50 }, [GROUP_RECT]);
    expect(result).toBeNull();
  });

  it("picks the correct group when multiple rects are provided", () => {
    const rects: DropZoneRect[] = [
      GROUP_RECT,
      { groupId: "g2", rect: { left: 200, top: 0, width: 100, height: 100 } },
    ];
    const result = resolveDropZone({ x: 210, y: 50 }, rects);
    expect(result).toEqual({ referenceGroup: "g2", direction: "left" });
  });
});
