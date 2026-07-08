import { describe, it, expect, beforeEach } from "vitest";

// RED spec for the Phase 2 shell store (RAIL-01..03, D-02).
// Imports shellStore, which does NOT exist yet — this suite MUST fail
// (module-not-found) until Task 3 builds src/store/shellStore.ts.
import { shellStore } from "./shellStore";

const LS_KEY = "sourcerer-shell-store-v1";

// Deterministic starting state before each behavior assertion. The store is a
// singleton created once at import; reset the mutable slices + persisted key so
// tests don't leak into one another.
beforeEach(() => {
  localStorage.clear();
  shellStore.setState({
    railMode: "expanded",
    railOpen: true,
    railWidth: 220,
    railOrder: ["Sources", "Library", "Wiki", "Graph"],
    leftRailPinned: [],
    badges: {},
  });
});

describe("shellStore.cycleRailMode()", () => {
  it("cycles expanded -> compact -> hidden -> expanded and tracks railOpen", () => {
    const { cycleRailMode } = shellStore.getState();

    cycleRailMode();
    expect(shellStore.getState().railMode).toBe("compact");
    expect(shellStore.getState().railOpen).toBe(true);

    cycleRailMode();
    expect(shellStore.getState().railMode).toBe("hidden");
    expect(shellStore.getState().railOpen).toBe(false);

    cycleRailMode();
    expect(shellStore.getState().railMode).toBe("expanded");
    expect(shellStore.getState().railOpen).toBe(true);
  });
});

describe("shellStore.reorderRail(from, to)", () => {
  it("moves the element at `from` to index `to`, preserving length (arrayMove)", () => {
    shellStore.getState().reorderRail(0, 2);
    const order = shellStore.getState().railOrder;
    expect(order).toEqual(["Library", "Wiki", "Sources", "Graph"]);
    expect(order.length).toBe(4);
  });
});

describe("shellStore.togglePin(key)", () => {
  it("adds a key if absent and removes it if present", () => {
    shellStore.getState().togglePin("Notes");
    expect(shellStore.getState().leftRailPinned).toContain("Notes");

    shellStore.getState().togglePin("Notes");
    expect(shellStore.getState().leftRailPinned).not.toContain("Notes");
  });
});

describe("shellStore.setBadge(key, n)", () => {
  it("sets badges[key] to n", () => {
    shellStore.getState().setBadge("Wiki", 7);
    expect(shellStore.getState().badges.Wiki).toBe(7);
  });
});

describe("persistence (D-02 subset only)", () => {
  it("persists railMode/railWidth/railOrder/leftRailPinned but NOT activePaneId/railApplet", () => {
    shellStore.getState().setRailWidth(300);
    shellStore.getState().togglePin("Notes");
    shellStore.getState().setActivePaneId("pane-xyz");
    shellStore.getState().setRailApplet("Wiki");

    const raw = localStorage.getItem(LS_KEY);
    expect(raw).toBeTruthy();
    const persisted = JSON.parse(raw as string);

    expect(persisted).toHaveProperty("railMode");
    expect(persisted).toHaveProperty("railWidth", 300);
    expect(persisted).toHaveProperty("railOrder");
    expect(persisted.leftRailPinned).toContain("Notes");

    expect(persisted).not.toHaveProperty("activePaneId");
    expect(persisted).not.toHaveProperty("railApplet");
  });
});
