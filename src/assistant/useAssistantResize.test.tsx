import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { useAssistantResize } from "./useAssistantResize";
import { shellStore } from "../store/shellStore";

/*
 * useAssistantResize.test.tsx — integration-shaped coverage for the resize
 * hook's ACTUAL inputs (CR-01 fail-pre-fix). assistantSnap.test.ts covers the
 * pure snap function under viewport-scale hostWidth values; this file proves
 * the HOOK feeds it viewport-scale values too. The original bug: the hook
 * passed the panel's OWN width (280px default) as hostWidth, making the
 * "open" snap bucket mathematically unreachable (clamp upper bound
 * 280-160=120 < CLOSE_AT 180) and snapping "full" to a 120px panel.
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

const WINDOW_W = 1200;
const PANEL_W = 280; // --asst-width-default
const PANEL_RIGHT = WINDOW_W; // panel is flush against the window's right edge

function Harness() {
  const { hostRef, onResizePointerDown, liveWidth } = useAssistantResize();
  return (
    <div
      ref={(el) => {
        if (el) {
          // The panel div at its DEFAULT width — the exact geometry under
          // which the pre-fix hook made "open" unreachable.
          el.getBoundingClientRect = () =>
            ({
              x: PANEL_RIGHT - PANEL_W,
              y: 0,
              left: PANEL_RIGHT - PANEL_W,
              top: 0,
              right: PANEL_RIGHT,
              bottom: 600,
              width: PANEL_W,
              height: 600,
              toJSON: () => ({}),
            }) as DOMRect;
        }
        hostRef.current = el;
      }}
    >
      <div data-testid="grip" onPointerDown={onResizePointerDown} />
      {/* GAP-1: liveWidth does not exist on the pre-fix hook's return shape
          (undefined), so this always renders "null" pre-fix regardless of
          pointermove — proving the panel never followed the pointer live. */}
      <div data-testid="live-width">{liveWidth ?? "null"}</div>
    </div>
  );
}

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", {
    value: WINDOW_W,
    configurable: true,
    writable: true,
  });
  shellStore.getState().setAssistantOpen(true);
  shellStore.getState().setAsstWidth(PANEL_W);
});

afterEach(cleanup);

function dragTo(grip: HTMLElement, clientX: number) {
  fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientX: PANEL_RIGHT - PANEL_W });
  fireEvent.pointerMove(grip, { pointerId: 1, clientX });
  fireEvent.pointerUp(grip, { pointerId: 1, clientX });
}

describe("useAssistantResize (CR-01: hostWidth must be workspace-scale, not the panel's own width)", () => {
  it("releasing at raw=300 from the default 280px panel yields open at width 300", () => {
    const { getByTestId } = render(<Harness />);
    dragTo(getByTestId("grip"), PANEL_RIGHT - 300); // raw = hostRight - clientX = 300

    expect(shellStore.getState().assistantOpen).toBe(true);
    expect(shellStore.getState().asstWidth).toBe(300);
  });

  it("releasing past FULL_AT snaps to a viewport-scale full width, not panelWidth-160", () => {
    const { getByTestId } = render(<Harness />);
    dragTo(getByTestId("grip"), PANEL_RIGHT - 700); // raw = 700 > FULL_AT (620)

    expect(shellStore.getState().assistantOpen).toBe(true);
    // full mode = hostWidth - 160 with hostWidth = window width (1200), NOT
    // the pre-fix panel width (280 - 160 = 120).
    expect(shellStore.getState().asstWidth).toBe(WINDOW_W - 160);
  });

  it("a cancelled drag tears down without applying a snap (WR-06)", () => {
    const { getByTestId } = render(<Harness />);
    const grip = getByTestId("grip");

    fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientX: PANEL_RIGHT - PANEL_W });
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: PANEL_RIGHT - 100 }); // would close
    fireEvent.pointerCancel(grip, { pointerId: 1 });
    // The post-cancel pointerup must be inert — listeners were removed.
    fireEvent.pointerUp(grip, { pointerId: 1, clientX: PANEL_RIGHT - 100 });

    expect(shellStore.getState().assistantOpen).toBe(true);
    expect(shellStore.getState().asstWidth).toBe(PANEL_W);
  });

  it("releasing under CLOSE_AT still closes the panel", () => {
    const { getByTestId } = render(<Harness />);
    dragTo(getByTestId("grip"), PANEL_RIGHT - 100); // raw = 100 < CLOSE_AT (180)

    expect(shellStore.getState().assistantOpen).toBe(false);
  });
});

describe("useAssistantResize live drag width (GAP-1: panel must follow the pointer every frame, not only on release)", () => {
  it("exposes a live width during pointermove equal to the clamped raw pointer distance", () => {
    // Fails pre-fix: the hook has no liveWidth return value, so the harness
    // renders "null" here regardless of the pointermove below.
    const { getByTestId } = render(<Harness />);
    const grip = getByTestId("grip");

    fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientX: PANEL_RIGHT - PANEL_W });
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: PANEL_RIGHT - 350 }); // raw = 350

    expect(getByTestId("live-width").textContent).toBe("350");

    fireEvent.pointerUp(grip, { pointerId: 1, clientX: PANEL_RIGHT - 350 });
  });

  it("clears the live width back to null on pointerup", () => {
    const { getByTestId } = render(<Harness />);
    const grip = getByTestId("grip");

    fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientX: PANEL_RIGHT - PANEL_W });
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: PANEL_RIGHT - 350 });
    fireEvent.pointerUp(grip, { pointerId: 1, clientX: PANEL_RIGHT - 350 });

    expect(getByTestId("live-width").textContent).toBe("null");
  });
});
