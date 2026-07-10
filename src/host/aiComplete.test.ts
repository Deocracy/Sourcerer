import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the low-level ./ai seam — aiComplete composes over it and must never
// call invoke("host_ai") directly.
const { aiMock } = vi.hoisted(() => {
  return { aiMock: vi.fn() };
});

vi.mock("./ai", () => ({
  ai: aiMock,
}));

import { aiComplete, AI_INACTIVITY_TIMEOUT_MS } from "./aiComplete";

type Listener = (event: {
  type: string;
  id?: string;
  text?: string;
  message?: string;
}) => void;

beforeEach(() => {
  aiMock.mockReset();
});

describe("host/aiComplete", () => {
  it("resolves with the accumulated text once a done event arrives", async () => {
    aiMock.mockImplementation(async (_req: unknown, onEvent: Listener) => {
      onEvent({ type: "text_delta", id: "1", text: "Hello" });
      onEvent({ type: "text_delta", id: "1", text: " world" });
      onEvent({ type: "done", id: "1" });
    });

    const result = await aiComplete("prompt");
    expect(result).toBe("Hello world");
  });

  it("rejects with an Error carrying the message when an error event arrives", async () => {
    aiMock.mockImplementation(async (_req: unknown, onEvent: Listener) => {
      onEvent({ type: "error", id: "1", message: "sidecar exploded" });
      onEvent({ type: "done", id: "1" });
    });

    await expect(aiComplete("prompt")).rejects.toThrow("sidecar exploded");
  });

  it("forwards each cumulative text to onDelta on every text_delta", async () => {
    aiMock.mockImplementation(async (_req: unknown, onEvent: Listener) => {
      onEvent({ type: "text_delta", id: "1", text: "A" });
      onEvent({ type: "text_delta", id: "1", text: "B" });
      onEvent({ type: "done", id: "1" });
    });

    const onDelta = vi.fn();
    await aiComplete("prompt", { onDelta });
    expect(onDelta).toHaveBeenNthCalledWith(1, "A");
    expect(onDelta).toHaveBeenNthCalledWith(2, "AB");
  });

  it("(WR-02) rejects via the inactivity watchdog when the stream goes silent without a terminal event", async () => {
    vi.useFakeTimers();
    try {
      // Channel dispatched fine but never delivers another event — the exact
      // sidecar-killed-mid-turn / relay-dropped scenario the docblock's
      // "never hangs" claim must survive.
      aiMock.mockImplementation(async () => {});

      const pending = aiComplete("prompt");
      const assertion = expect(pending).rejects.toThrow(/no assistant events/);
      await vi.advanceTimersByTimeAsync(AI_INACTIVITY_TIMEOUT_MS);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("(WR-02) a text_delta resets the watchdog — slow-but-alive streams are not killed", async () => {
    vi.useFakeTimers();
    try {
      let listener: Listener = () => {};
      aiMock.mockImplementation(async (_req: unknown, onEvent: Listener) => {
        listener = onEvent;
      });

      const pending = aiComplete("prompt");
      // Just before the deadline, a delta arrives — watchdog re-arms…
      await vi.advanceTimersByTimeAsync(AI_INACTIVITY_TIMEOUT_MS - 1000);
      listener({ type: "text_delta", id: "1", text: "still alive" });
      // …so crossing the ORIGINAL deadline must not reject…
      await vi.advanceTimersByTimeAsync(2000);
      // …and a done event still resolves normally.
      listener({ type: "done", id: "1" });
      await expect(pending).resolves.toBe("still alive");
    } finally {
      vi.useRealTimers();
    }
  });

  it("generates a sessionId of form oneshot-<id> whose first and last char are alphanumeric", async () => {
    let capturedSessionId = "";
    aiMock.mockImplementation(
      async (req: { sessionId: string }, onEvent: Listener) => {
        capturedSessionId = req.sessionId;
        onEvent({ type: "done", id: "1" });
      },
    );

    await aiComplete("prompt");
    expect(capturedSessionId.startsWith("oneshot-")).toBe(true);
    const first = capturedSessionId[0];
    const last = capturedSessionId[capturedSessionId.length - 1];
    expect(/[A-Za-z0-9]/.test(first)).toBe(true);
    expect(/[A-Za-z0-9]/.test(last)).toBe(true);
  });
});
