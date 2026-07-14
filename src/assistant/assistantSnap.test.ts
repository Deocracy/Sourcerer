import { describe, it, expect } from "vitest";
import { snapWidthToAsstMode, HIDDEN_W, CLOSE_AT, FULL_AT } from "./assistantSnap";

// Boundary coverage for the assistant resize-drag snap thresholds (ASST-03, D-03).
describe("snapWidthToAsstMode(raw, hostWidth)", () => {
  it("buckets 50 (below CLOSE_AT) -> closed", () => {
    expect(snapWidthToAsstMode(50, 1200)).toEqual({ mode: "closed" });
  });

  it("buckets 300 (open range) -> open at width 300", () => {
    expect(snapWidthToAsstMode(300, 1200)).toEqual({ mode: "open", width: 300 });
  });

  it("buckets 700 (above FULL_AT) -> full", () => {
    expect(snapWidthToAsstMode(700, 1200)).toEqual({ mode: "full" });
  });

  it("buckets CLOSE_AT - 1 (just under the close boundary) -> closed", () => {
    expect(snapWidthToAsstMode(CLOSE_AT - 1, 1200)).toEqual({ mode: "closed" });
  });

  it("buckets CLOSE_AT (boundary) -> open at width CLOSE_AT", () => {
    expect(snapWidthToAsstMode(CLOSE_AT, 1200)).toEqual({ mode: "open", width: CLOSE_AT });
  });

  it("buckets FULL_AT (boundary, not yet past it) -> open at width FULL_AT", () => {
    expect(snapWidthToAsstMode(FULL_AT, 1200)).toEqual({ mode: "open", width: FULL_AT });
  });

  it("buckets FULL_AT + 1 (just past the full boundary) -> full", () => {
    expect(snapWidthToAsstMode(FULL_AT + 1, 1200)).toEqual({ mode: "full" });
  });

  it("clamps the open width to hostWidth - 160 (raw 600, hostWidth 500 -> width 340, raw stays <= FULL_AT so mode is open not full)", () => {
    expect(snapWidthToAsstMode(600, 500)).toEqual({ mode: "open", width: 340 });
  });

  it("clamps raw below HIDDEN_W up to HIDDEN_W before bucketing -> closed (still under CLOSE_AT)", () => {
    expect(snapWidthToAsstMode(0, 1200)).toEqual({ mode: "closed" });
    expect(HIDDEN_W).toBeLessThan(CLOSE_AT);
  });
});
