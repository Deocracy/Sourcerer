import { Channel, invoke } from "@tauri-apps/api/core";

/**
 * host.ai() — the ONLY surface through which the webview reaches AI (CLAUDE.md:
 * "host.ai() is the only AI seam"). This module is the sole place that calls
 * `invoke()` for anything AI-related; the assistant panel imports from here and
 * never touches `@tauri-apps/api/core` directly (grep gate: `invoke` for AI
 * appears only under `src/host/`).
 *
 * Mirrors the sidecar's canonical event shapes verbatim (sidecar/src/protocol.ts,
 * shared with the Rust relay in plan 07-03's `src-tauri/src/commands/ai.rs`).
 */

export interface ReadyEvent {
  type: "ready";
}

export interface ThinkingDeltaEvent {
  type: "thinking_delta";
  id: string;
  text: string;
}

export interface TextDeltaEvent {
  type: "text_delta";
  id: string;
  text: string;
}

export interface ToolStartEvent {
  type: "tool_start";
  id: string;
  name: string;
}

export interface ToolEndEvent {
  type: "tool_end";
  id: string;
  name: string;
  ok: boolean;
}

export interface ErrorEvent {
  type: "error";
  id: string;
  message: string;
}

export interface DoneEvent {
  type: "done";
  id: string;
}

export interface HistoryEvent {
  type: "history";
  id: string;
  turns: { role: "user" | "assistant"; text: string }[];
}

/** Discriminated union on `type`, covering all eight sidecar event shapes. */
export type AssistantEvent =
  | ReadyEvent
  | ThinkingDeltaEvent
  | TextDeltaEvent
  | ToolStartEvent
  | ToolEndEvent
  | ErrorEvent
  | DoneEvent
  | HistoryEvent;

export interface HostAiRequest {
  message: string;
  sessionId: string;
  modes: string[];
}

export type AssistantEventListener = (event: AssistantEvent) => void;

/**
 * Invokes the `host_ai` Tauri command with a fresh Channel, forwarding every
 * event the Rust side relays (including `error` — D-06 honest-degrade delivers
 * errors to the caller rather than throwing, so the panel can render them
 * inline instead of crashing). Resolves once a `done` event has been observed.
 *
 * If `invoke()` itself rejects (e.g. the command couldn't be dispatched at
 * all), that is treated the same way as an in-band error: delivered to
 * `onEvent` as an `error` + `done` pair rather than thrown, so callers never
 * need a try/catch around `host.ai()` to stay crash-safe.
 */
export function ai(request: HostAiRequest, onEvent: AssistantEventListener): Promise<void> {
  return new Promise((resolve) => {
    const channel = new Channel<AssistantEvent>();
    channel.onmessage = (event) => {
      onEvent(event);
      if (event.type === "done") {
        resolve();
      }
    };

    invoke("host_ai", {
      message: request.message,
      sessionId: request.sessionId,
      modes: request.modes,
      onEvent: channel,
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      onEvent({ type: "error", id: "invoke", message });
      onEvent({ type: "done", id: "invoke" });
      resolve();
    });
  });
}

/** Invokes the `set_modes` Tauri command — the mode-toggle seam (D-02). */
export function setModes(modes: string[]): Promise<void> {
  return invoke("set_modes", { modes });
}

/**
 * Invokes the `load_session` Tauri command with a fresh Channel — the D-09
 * restart-reload seam. Mirrors `ai()`'s Channel/degrade pattern exactly:
 * forwards every relayed event (a single `history` event, then `done`) to
 * `onEvent`, resolves on `done`, and on invoke-reject delivers an error+done
 * pair rather than throwing, so callers never need a try/catch.
 */
export function loadSession(sessionId: string, onEvent: AssistantEventListener): Promise<void> {
  return new Promise((resolve) => {
    const channel = new Channel<AssistantEvent>();
    channel.onmessage = (event) => {
      onEvent(event);
      if (event.type === "done") {
        resolve();
      }
    };

    invoke("load_session", { sessionId, onEvent: channel }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      onEvent({ type: "error", id: "invoke", message });
      onEvent({ type: "done", id: "invoke" });
      resolve();
    });
  });
}

export const host = { ai, setModes, loadSession };
