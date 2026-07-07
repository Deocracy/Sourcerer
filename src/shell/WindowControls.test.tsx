import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { mockIPC, mockWindows, clearMocks } from "@tauri-apps/api/mocks";

// RED spec for SHELL-02 (click-wiring half). Imports WindowControls, which does
// NOT exist yet — this suite MUST fail (module-not-found) until plan 01-02 builds
// the component and wires the buttons to the Tauri window API.
import { WindowControls } from "./WindowControls";

// Capture every IPC command the window API issues so we can assert the right
// native window operation fires per button click.
function captureIpc(): string[] {
  const commands: string[] = [];
  mockWindows("main");
  mockIPC((cmd) => {
    commands.push(cmd);
    return undefined;
  });
  return commands;
}

beforeEach(() => {
  clearMocks();
});

afterEach(() => {
  cleanup();
  clearMocks();
});

describe("WindowControls (SHELL-02 click wiring)", () => {
  it("minimize button invokes the Tauri minimize command", async () => {
    const commands = captureIpc();
    render(<WindowControls />);
    fireEvent.click(screen.getByLabelText("Minimize window"));
    await waitFor(() => {
      expect(commands.some((c) => c.includes("minimize"))).toBe(true);
    });
  });

  it("maximize button invokes the Tauri toggle_maximize command", async () => {
    const commands = captureIpc();
    render(<WindowControls />);
    fireEvent.click(screen.getByLabelText("Maximize window"));
    await waitFor(() => {
      expect(commands.some((c) => c.includes("toggle_maximize"))).toBe(true);
    });
  });

  it("close button invokes the Tauri close command", async () => {
    const commands = captureIpc();
    render(<WindowControls />);
    fireEvent.click(screen.getByLabelText("Close window"));
    await waitFor(() => {
      expect(commands.some((c) => c.includes("close"))).toBe(true);
    });
  });
});
