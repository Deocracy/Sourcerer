import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { useRailDrag } from "./useRailDrag";
import { shellStore } from "../store/shellStore";

/*
 * useRailDrag.test.tsx — GAP-2 (06-HUMAN-UAT.md) coverage for the left rail's
 * bespoke pointer-capture resize drag. Mirrors useAssistantResize.test.tsx's
 * harness shape (same jsdom PointerEvent capture stub, same fireEvent-driven
 * drag simulation) since useRailDrag is the WR-06 sibling this plan brings to
 * parity: useAssistantResize already tears down cleanly on pointercancel;
 * useRailDrag does not yet.
 */

// jsdom has no Pointer Events capture implementation — stub the capture pair
// so the hook's setPointerCapture/releasePointerCapture calls don't throw.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    value: () => undefined,
    configurable: true,
  });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    value: () => undefined,
    configurable: true,
  });
});

afterAll(() => {
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).setPointerCapture;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).releasePointerCapture;
});

function Harness() {
  const { navRef, liveSnap, onResizePointerDown, onResizeDoubleClick } = useRailDrag();
  return (
    <nav
      ref={(el) => {
        if (el) {
          // Left edge pinned at 0 so raw drag distance === clientX, matching
          // the hook's `ev.clientX - navLeft` formula 1:1 in assertions below.
          el.getBoundingClientRect = () =>
            ({
              x: 0,
              y: 0,
              left: 0,
              top: 0,
              right: 800,
              bottom: 600,
              width: 800,
              height: 600,
              toJSON: () => ({}),
            }) as DOMRect;
        }
        navRef(el);
      }}
    >
      <div
        data-testid="grip"
        onPointerDown={onResizePointerDown}
        onDoubleClick={onResizeDoubleClick}
      />
      <div data-testid="live-mode">{liveSnap ? liveSnap.mode : "null"}</div>
    </nav>
  );
}

beforeEach(() => {
  shellStore.getState().setRailMode("expanded");
  shellStore.getState().setRailWidth(240);
});

afterEach(cleanup);

describe("useRailDrag pointercancel teardown (GAP-2, WR-06 parity)", () => {
  it("a cancelled drag clears liveSnap, removes listeners, and applies no snap", () => {
    const { getByTestId } = render(<Harness />);
    const grip = getByTestId("grip");

    fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientX: 240 });
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 30 }); // raw=30 -> hidden
    expect(getByTestId("live-mode").textContent).toBe("hidden");

    fireEvent.pointerCancel(grip, { pointerId: 1 });
    // The post-cancel pointerup must be inert — listeners were torn down by
    // the cancel handler, so this must NOT commit a snap.
    fireEvent.pointerUp(grip, { pointerId: 1, clientX: 30 });

    expect(getByTestId("live-mode").textContent).toBe("null");
    expect(shellStore.getState().railMode).toBe("expanded");
    expect(shellStore.getState().railWidth).toBe(240);
  });
});

describe("useRailDrag toggle cycling (GAP-2 Task 3: double-click + Cmd/Ctrl-\\)", () => {
  it("double-click on the grip advances railMode one cycle step (expanded -> compact)", () => {
    const { getByTestId } = render(<Harness />);
    fireEvent.doubleClick(getByTestId("grip"));
    expect(shellStore.getState().railMode).toBe("compact");
  });

  it("Cmd/Ctrl-backslash advances railMode one cycle step from anywhere in the document", () => {
    render(<Harness />);
    fireEvent.keyDown(document, { key: "\\", ctrlKey: true });
    expect(shellStore.getState().railMode).toBe("compact");
  });

  it("chains double-click cycling through the full bounce (expanded -> compact -> hidden -> expanded)", () => {
    const { getByTestId } = render(<Harness />);
    const grip = getByTestId("grip");
    fireEvent.doubleClick(grip);
    expect(shellStore.getState().railMode).toBe("compact");
    fireEvent.doubleClick(grip);
    expect(shellStore.getState().railMode).toBe("hidden");
    fireEvent.doubleClick(grip);
    expect(shellStore.getState().railMode).toBe("expanded");
  });
});
