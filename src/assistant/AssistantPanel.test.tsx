import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";

// WR-09: the real-session id list persists on the plugin store (applets.json)
// instead of raw localStorage — mock the store with an in-memory Map the
// tests can seed/inspect directly (mirrors homeCards.storage.test.ts).
const fakeStore = new Map<string, unknown>();
vi.mock("@tauri-apps/plugin-store", () => ({
  LazyStore: class {
    async get<T>(key: string): Promise<T | undefined> {
      return fakeStore.get(key) as T | undefined;
    }

    async set(key: string, value: unknown): Promise<void> {
      fakeStore.set(key, value);
    }

    async save(): Promise<void> {}
  },
}));

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

// D-01 growth: the panel now persists a LIST of real-session ids under a
// generalized key, replacing Phase 7's single-sessionId key. WR-09: the sink
// is the plugin store (applets.json), no longer raw localStorage.
const SESSION_IDS_KEY = "sourcerer:assistant:sessionIds";
const SESSION_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;

interface LoadSessionArgs {
  sessionId: string;
  onEvent: { onmessage: (event: QueuedEvent) => void };
}

beforeEach(() => {
  clearMocks();
  localStorage.clear();
  fakeStore.clear();
});

afterEach(() => {
  cleanup();
  clearMocks();
  localStorage.clear();
  fakeStore.clear();
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
    fireEvent.click(screen.getByLabelText("Send message"));

    await waitFor(() => {
      expect(screen.getByText("Hello world")).toBeTruthy();
    });

    expect(capturedSetModes).toBeUndefined();
  });

  it("generates a sessionId that satisfies the sidecar SESSION_ID_PATTERN (CR-01)", async () => {
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
    fireEvent.click(screen.getByLabelText("Send message"));

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
    fireEvent.click(screen.getByLabelText("Send message"));

    await waitFor(() => {
      expect(screen.getByText(/assistant unavailable: wiki unavailable/)).toBeTruthy();
    });

    // Composer stays usable — not permanently disabled by the failed turn.
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "trying again" },
    });
    expect((screen.getByLabelText("Send message") as HTMLButtonElement).disabled).toBe(false);
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

describe("AssistantPanel (D-09 restart-reload)", () => {
  it("renders prior turns delivered via a mount-time load_session history event", async () => {
    fakeStore.set(SESSION_IDS_KEY, ["prior-session-1"]);

    mockIPC((cmd, args) => {
      if (cmd === "load_session") {
        const { onEvent } = args as unknown as LoadSessionArgs;
        deliver(onEvent, [
          {
            type: "history",
            id: "load-1",
            turns: [
              { role: "user", text: "prior q" },
              { role: "assistant", text: "prior a" },
            ],
          },
          { type: "done", id: "load-1" },
        ]);
        return undefined;
      }
      return undefined;
    });

    render(<AssistantPanel />);

    await waitFor(() => {
      expect(screen.getByText("prior q")).toBeTruthy();
      expect(screen.getByText("prior a")).toBeTruthy();
    });
  });

  it("reuses the persisted sessionId across mounts (restart survival)", async () => {
    fakeStore.set(SESSION_IDS_KEY, ["existing-session-42"]);
    let capturedSessionId: string | undefined;

    mockIPC((cmd, args) => {
      if (cmd === "load_session") {
        const a = args as unknown as LoadSessionArgs;
        capturedSessionId = a.sessionId;
        deliver(a.onEvent, [{ type: "done", id: "load-2" }]);
      }
      return undefined;
    });

    render(<AssistantPanel />);

    await waitFor(() => {
      expect(capturedSessionId).toBe("existing-session-42");
    });
  });

  it("mints and persists a fresh sessionId when none is stored yet", async () => {
    let capturedSessionId: string | undefined;

    mockIPC((cmd, args) => {
      if (cmd === "load_session") {
        const a = args as unknown as LoadSessionArgs;
        capturedSessionId = a.sessionId;
        deliver(a.onEvent, [{ type: "done", id: "load-3" }]);
      }
      return undefined;
    });

    render(<AssistantPanel />);

    await waitFor(() => {
      expect(capturedSessionId).toBeDefined();
    });
    expect(capturedSessionId).toMatch(SESSION_ID_PATTERN);
    // WR-09: persisted to the plugin store once hydration settles.
    await waitFor(() => {
      const stored = (fakeStore.get(SESSION_IDS_KEY) ?? []) as string[];
      expect(stored[0]).toBe(capturedSessionId);
    });
  });

  it("migrates a legacy localStorage id list onto the plugin store (WR-09)", async () => {
    localStorage.setItem(SESSION_IDS_KEY, JSON.stringify(["legacy-session-7"]));
    let capturedSessionId: string | undefined;

    mockIPC((cmd, args) => {
      if (cmd === "load_session") {
        const a = args as unknown as LoadSessionArgs;
        capturedSessionId = a.sessionId;
        deliver(a.onEvent, [{ type: "done", id: "load-legacy" }]);
      }
      return undefined;
    });

    render(<AssistantPanel />);

    // The legacy session is restored (not orphaned)…
    await waitFor(() => {
      expect(capturedSessionId).toBe("legacy-session-7");
    });
    // …and its list now lives on the plugin store, legacy copy removed.
    await waitFor(() => {
      expect(fakeStore.get(SESSION_IDS_KEY)).toEqual(["legacy-session-7"]);
    });
    expect(localStorage.getItem(SESSION_IDS_KEY)).toBeNull();
  });

  it("a replayed history transcript's final proposal keeps its y/d/n block (WR-04)", async () => {
    fakeStore.set(SESSION_IDS_KEY, ["proposal-session-1"]);

    mockIPC((cmd, args) => {
      if (cmd === "load_session") {
        const { onEvent } = args as unknown as LoadSessionArgs;
        deliver(onEvent, [
          {
            type: "history",
            id: "load-p",
            turns: [
              { role: "user", text: "propose the edit" },
              {
                role: "assistant",
                text: 'Proposal — updates § Test target:\n\n> "Replayed proposal body."',
              },
            ],
          },
          { type: "done", id: "load-p" },
        ]);
        return undefined;
      }
      return undefined;
    });

    render(<AssistantPanel />);

    await waitFor(() => {
      expect(screen.getByText('"Replayed proposal body."')).toBeTruthy();
    });
    expect(screen.getByText("[y] approve")).toBeTruthy();
    expect(screen.getByText("[n] reject")).toBeTruthy();
  });

  it("a stale load_session history stream never overwrites the newly selected session (CR-03)", async () => {
    const captured: LoadSessionArgs[] = [];
    mockIPC((cmd, args) => {
      if (cmd === "load_session") {
        captured.push(args as unknown as LoadSessionArgs);
      }
      return undefined;
    });

    render(<AssistantPanel />);
    // Session A: the freshly-minted real session's mount-time load.
    await waitFor(() => {
      expect(captured.length).toBe(1);
    });

    // Switch to session B BEFORE A's history event arrives.
    fireEvent.click(screen.getByLabelText("Start new session"));
    await waitFor(() => {
      expect(captured.length).toBe(2);
    });

    // A's slow history stream lands late — it must be dropped, not rendered
    // under B's chip.
    act(() => {
      captured[0]!.onEvent.onmessage({
        type: "history",
        id: "late-a",
        turns: [{ role: "assistant", text: "STALE SESSION A TRANSCRIPT" }],
      });
    });

    expect(screen.queryByText("STALE SESSION A TRANSCRIPT")).toBeNull();
    expect(screen.getByText("New assistant ready. What should I look into?")).toBeTruthy();
  });

  it("an empty-turns history event leaves the panel empty and usable, no crash", async () => {
    fakeStore.set(SESSION_IDS_KEY, ["empty-session-1"]);

    mockIPC((cmd, args) => {
      if (cmd === "load_session") {
        const { onEvent } = args as unknown as LoadSessionArgs;
        deliver(onEvent, [{ type: "history", id: "load-4", turns: [] }, { type: "done", id: "load-4" }]);
        return undefined;
      }
      return undefined;
    });

    render(<AssistantPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText("Message")).toBeTruthy();
    });
    expect((screen.getByLabelText("Send message") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("AssistantPanel (D-01 multi-session list + header chrome — 06-02)", () => {
  it("renders a session list containing both seeds and the initial real session", async () => {
    render(<AssistantPanel />);

    await waitFor(() => {
      expect(screen.getByTitle("Poliziano · Careggi")).toBeTruthy();
      expect(screen.getByTitle("Medici patronage")).toBeTruthy();
      expect(screen.getByTitle("New assistant")).toBeTruthy();
    });
  });

  it("selecting a seed chip shows its canned transcript and disables the composer", async () => {
    render(<AssistantPanel />);

    fireEvent.click(screen.getByTitle("Poliziano · Careggi"));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Find every mention of Poliziano in the Careggi context and propose Wiki edits.",
        ),
      ).toBeTruthy();
    });
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).disabled).toBe(true);
  });

  it("selecting the real session chip keeps the composer enabled", async () => {
    render(<AssistantPanel />);

    fireEvent.click(screen.getByTitle("Poliziano · Careggi"));
    await waitFor(() => {
      expect((screen.getByLabelText("Message") as HTMLTextAreaElement).disabled).toBe(true);
    });

    fireEvent.click(screen.getByTitle("New assistant"));
    await waitFor(() => {
      expect((screen.getByLabelText("Message") as HTMLTextAreaElement).disabled).toBe(false);
    });
  });

  it("Start new session mints a new real session and shows the new-session greeting", async () => {
    render(<AssistantPanel />);

    fireEvent.click(screen.getByLabelText("Start new session"));

    await waitFor(() => {
      expect(screen.getByText("New assistant ready. What should I look into?")).toBeTruthy();
    });
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).disabled).toBe(false);
  });

  it("Cmd+Enter in the composer of a real session triggers host.ai() send", async () => {
    let capturedMessage: string | undefined;
    mockIPC((cmd, args) => {
      if (cmd === "host_ai") {
        const a = args as unknown as HostAiArgs;
        capturedMessage = a.message;
        deliver(a.onEvent, [{ type: "done", id: "turn-cmd-enter" }]);
      }
      return undefined;
    });

    render(<AssistantPanel />);

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "cmd-enter send" } });
    fireEvent.keyDown(screen.getByLabelText("Message"), { key: "Enter", metaKey: true });

    await waitFor(() => {
      expect(capturedMessage).toBe("cmd-enter send");
    });
  });

  it("every icon-only header control carries its exact aria-label", async () => {
    render(<AssistantPanel />);

    expect(screen.getByLabelText("View session history")).toBeTruthy();
    expect(screen.getByLabelText("Start new session")).toBeTruthy();
  });

  it("closing a real session removes it from the persisted id list (WR-03: no resurrection)", async () => {
    render(<AssistantPanel />);

    // Mint a second real session so closing one leaves another to fall to.
    fireEvent.click(screen.getByLabelText("Start new session"));
    await waitFor(() => {
      const stored = (fakeStore.get(SESSION_IDS_KEY) ?? []) as string[];
      expect(stored.length).toBe(2);
    });
    const before = fakeStore.get(SESSION_IDS_KEY) as string[];

    // Close the second (active) real session — its chip title is the real
    // "New assistant" label; both real chips share it, so close via the
    // last close button's aria-label pairing.
    const closeButtons = screen.getAllByLabelText("Close session New assistant");
    fireEvent.click(closeButtons[closeButtons.length - 1]!);

    await waitFor(() => {
      expect(fakeStore.get(SESSION_IDS_KEY)).toEqual([before[0]]);
    });
  });

  it("closing a session chip removes it from the list (non-destructive)", async () => {
    render(<AssistantPanel />);

    await waitFor(() => {
      expect(screen.getByTitle("Medici patronage")).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText("Close session Medici patronage"));

    await waitFor(() => {
      expect(screen.queryByTitle("Medici patronage")).toBeNull();
    });
  });
});

describe("AssistantPanel (ASST-02 proposals + D-06 mint producer — 06-03)", () => {
  it("renders the seed-careggi transcript's proposal as a serif-italic quote block", async () => {
    render(<AssistantPanel />);

    fireEvent.click(screen.getByTitle("Poliziano · Careggi"));

    await waitFor(() => {
      expect(
        screen.getByText('"Attended irregularly 1477–1494 — free from teaching."'),
      ).toBeTruthy();
    });
    expect(screen.getByText("[y] approve")).toBeTruthy();
    expect(screen.getByText("[d] diff")).toBeTruthy();
    expect(screen.getByText("[n] reject")).toBeTruthy();
  });

  it("pressing y on the focused proposal approves it, publishes lastResolvedProposal, and reveals ＋MAKE CARD which sets pendingCardMint", async () => {
    const { shellStore } = await import("../store/shellStore");

    render(<AssistantPanel />);

    fireEvent.click(screen.getByTitle("Poliziano · Careggi"));
    await waitFor(() => {
      expect(screen.getByText("[y] approve")).toBeTruthy();
    });

    fireEvent.keyDown(document, { key: "y" });

    await waitFor(() => {
      expect(screen.getByLabelText("Make card from this response")).toBeTruthy();
    });
    expect(shellStore.getState().lastResolvedProposal).toBe(
      '"Attended irregularly 1477–1494 — free from teaching."',
    );

    fireEvent.click(screen.getByLabelText("Make card from this response"));
    expect(shellStore.getState().pendingCardMint).toEqual({
      title: "§ Poliziano · role at Careggi",
      foot: "from assistant",
    });
  });

  it("pressing n on the focused proposal marks it rejected without a confirm dialog, and is reversible", async () => {
    render(<AssistantPanel />);

    fireEvent.click(screen.getByTitle("Poliziano · Careggi"));
    await waitFor(() => {
      expect(screen.getByText("[n] reject")).toBeTruthy();
    });

    fireEvent.keyDown(document, { key: "n" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByLabelText("Make card from this response")).toBeNull();

    // Reversible: pressing n again reopens (un-rejects).
    fireEvent.keyDown(document, { key: "n" });
    fireEvent.keyDown(document, { key: "y" });
    await waitFor(() => {
      expect(screen.getByLabelText("Make card from this response")).toBeTruthy();
    });
  });

  it("pressing d toggles the inline diff/raw view of the proposal", async () => {
    const { container } = render(<AssistantPanel />);

    fireEvent.click(screen.getByTitle("Poliziano · Careggi"));
    await waitFor(() => {
      expect(screen.getByText("[d] diff")).toBeTruthy();
    });

    expect(container.querySelector("pre")).toBeNull();
    fireEvent.keyDown(document, { key: "d" });
    await waitFor(() => {
      expect(container.querySelector("pre")?.textContent).toMatch(/Proposal —/);
    });
  });
});
