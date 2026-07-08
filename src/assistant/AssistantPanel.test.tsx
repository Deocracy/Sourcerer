import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";

import { AssistantPanel } from "./AssistantPanel";

// Every event we want streamed back for a given host_ai turn (RED spec until
// AssistantPanel + host/ai.ts existed — now GREEN against the real seam).
type QueuedEvent = { type: string; id: string; [k: string]: unknown };

interface HostAiArgs {
  message: string;
  sessionId: string;
  modes: string[];
  onEvent: { onmessage: (event: QueuedEvent) => void };
}

interface SetModesArgs {
  modes: string[];
}

/**
 * Drives a `host_ai` turn: delivers `events` (in order) to the Channel the
 * seam passed as `onEvent`, on a microtask so React state updates from each
 * event settle before the next is delivered. mockIPC hands the mock callback
 * the SAME object reference `ai.ts` passed to `invoke()` (no serialization
 * boundary in tests), so `args.onEvent` is the real Channel instance and
 * `args.onEvent.onmessage` is the handler `ai.ts` assigned — calling it
 * directly exercises the real production code path.
 */
function deliver(onEvent: HostAiArgs["onEvent"], events: QueuedEvent[]) {
  (async () => {
    for (const event of events) {
      await Promise.resolve();
      onEvent.onmessage(event);
    }
  })();
}

beforeEach(() => {
  clearMocks();
});

afterEach(() => {
  cleanup();
  clearMocks();
});

describe("AssistantPanel (D-01 streamed chat + D-06 honest-degrade)", () => {
  it("streams text_delta events into one assistant message", async () => {
    let capturedSetModes: SetModesArgs | undefined;
    mockIPC((cmd, args) => {
      if (cmd === "host_ai") {
        const { onEvent } = args as unknown as HostAiArgs;
        deliver(onEvent, [
          { type: "text_delta", id: "turn-1", text: "Hello" },
          { type: "text_delta", id: "turn-1", text: " world" },
          { type: "done", id: "turn-1" },
        ]);
        return undefined;
      }
      if (cmd === "set_modes") {
        capturedSetModes = args as SetModesArgs;
        return undefined;
      }
      return undefined;
    });

    render(<AssistantPanel />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "hi there" },
    });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(screen.getByText("Hello world")).toBeTruthy();
    });

    expect(capturedSetModes).toBeUndefined();
  });

  it("generates a sessionId that satisfies the sidecar SESSION_ID_PATTERN (CR-01)", async () => {
    // Mirror of sidecar SESSION_ID_PATTERN (sessions.ts): first AND last char must be
    // alphanumeric. Default nanoid() would fail this ~6% of the time; the panel now
    // draws IDs from an alphanumeric-only alphabet so every launch is valid.
    const SESSION_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;
    let capturedSessionId: string | undefined;
    mockIPC((cmd, args) => {
      if (cmd === "host_ai") {
        const a = args as unknown as HostAiArgs;
        capturedSessionId = a.sessionId;
        deliver(a.onEvent, [{ type: "done", id: "turn-1" }]);
      }
      return undefined;
    });

    render(<AssistantPanel />);
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "hi" } });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(capturedSessionId).toBeDefined();
    });
    expect(capturedSessionId).toMatch(SESSION_ID_PATTERN);
    expect(capturedSessionId!.includes("..")).toBe(false);
  });

  it("renders an inline unavailable notice on an error event and keeps the composer usable", async () => {
    mockIPC((cmd, args) => {
      if (cmd === "host_ai") {
        const { onEvent } = args as unknown as HostAiArgs;
        deliver(onEvent, [
          { type: "error", id: "turn-2", message: "wiki unavailable" },
          { type: "done", id: "turn-2" },
        ]);
        return undefined;
      }
      return undefined;
    });

    render(<AssistantPanel />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "will this fail" },
    });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(screen.getByText(/assistant unavailable: wiki unavailable/)).toBeTruthy();
    });

    // Composer stays usable — not permanently disabled by the failed turn.
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "trying again" },
    });
    expect((screen.getByText("Send") as HTMLButtonElement).disabled).toBe(false);
  });

  it("toggling Research invokes set_modes with [\"research\"]", async () => {
    let capturedSetModes: SetModesArgs | undefined;
    mockIPC((cmd, args) => {
      if (cmd === "set_modes") {
        capturedSetModes = args as SetModesArgs;
      }
      return undefined;
    });

    render(<AssistantPanel />);

    fireEvent.click(screen.getByText("Research"));

    await waitFor(() => {
      expect(capturedSetModes).toEqual({ modes: ["research"] });
    });
  });
});
