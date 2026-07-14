import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { RailToggleButtons } from "./RailToggleButtons";
import { shellStore } from "../store/shellStore";

/*
 * RailToggleButtons.test.tsx — GAP-1 (06-HUMAN-UAT.md): the title-bar right
 * toggle button was wired to cycleRailMode (the LEFT rail action) so clicking
 * it never touched the assistant. These tests encode the CORRECT post-fix
 * wiring: the right button drives the assistant (cycleAssistant), the left
 * button keeps driving railMode, and neither crosses into the other's state.
 */

afterEach(cleanup);

beforeEach(() => {
  shellStore.setState({
    railMode: "expanded",
    assistantOpen: true,
    // assistantFull does not exist on ShellState pre-fix (Task 2 adds it);
    // omitted here so this file type-checks identically before and after.
  });
});

describe("RailToggleButtons (GAP-1: right toggle must control the assistant, not the left rail)", () => {
  it("clicking the right toggle does not change railMode", () => {
    // Fails pre-fix: right button currently calls cycleRailMode(), so
    // railMode advances from expanded -> compact.
    const { getByLabelText } = render(<RailToggleButtons />);
    fireEvent.click(getByLabelText(/right/i));
    expect(shellStore.getState().railMode).toBe("expanded");
  });

  it("clicking the right toggle changes the assistant's open/full state (not a no-op)", () => {
    // Fails pre-fix: right button touches only railMode, so assistantOpen
    // (and the future assistantFull flag) never change.
    const { getByLabelText } = render(<RailToggleButtons />);
    const before = {
      open: shellStore.getState().assistantOpen,
      full: (shellStore.getState() as unknown as { assistantFull?: boolean }).assistantFull,
    };
    fireEvent.click(getByLabelText(/right/i));
    const after = {
      open: shellStore.getState().assistantOpen,
      full: (shellStore.getState() as unknown as { assistantFull?: boolean }).assistantFull,
    };
    expect(after).not.toEqual(before);
  });

  it("left toggle still cycles railMode (unchanged behavior)", () => {
    const { getByLabelText } = render(<RailToggleButtons />);
    fireEvent.click(getByLabelText(/left/i));
    expect(shellStore.getState().railMode).toBe("compact");
  });
});
