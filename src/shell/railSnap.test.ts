import { describe, it, expect } from "vitest";
import { snapWidthToMode, CLOSE_AT, COMPACT_AT, EXPANDED_MAX } from "./railSnap";

// Boundary coverage for the rail resize-drag snap thresholds (RAIL-01, DOCK-06).
describe("snapWidthToMode(raw)", () => {
  it("clamps negative input to 0 before bucketing -> hidden", () => {
    expect(snapWidthToMode(-50)).toEqual({ mode: "hidden" });
  });

  it("buckets 0 -> hidden", () => {
    expect(snapWidthToMode(0)).toEqual({ mode: "hidden" });
  });

  it("buckets 43 (just under CLOSE_AT) -> hidden", () => {
    expect(snapWidthToMode(CLOSE_AT - 1)).toEqual({ mode: "hidden" });
  });

  it("buckets 44 (CLOSE_AT boundary) -> compact", () => {
    expect(snapWidthToMode(CLOSE_AT)).toEqual({ mode: "compact" });
  });

  it("buckets 131 (just under COMPACT_AT) -> compact", () => {
    expect(snapWidthToMode(COMPACT_AT - 1)).toEqual({ mode: "compact" });
  });

  it("buckets 132 (COMPACT_AT boundary) -> expanded at width 132", () => {
    expect(snapWidthToMode(COMPACT_AT)).toEqual({ mode: "expanded", width: 132 });
  });

  it("buckets 300 -> expanded at width 300 (unclamped, within range)", () => {
    expect(snapWidthToMode(300)).toEqual({ mode: "expanded", width: 300 });
  });

  it("buckets 600 -> expanded, clamped to EXPANDED_MAX", () => {
    expect(snapWidthToMode(600)).toEqual({ mode: "expanded", width: EXPANDED_MAX });
  });
});
