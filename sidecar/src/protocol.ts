// Canonical stdio protocol contract shared with 07-03 (Rust relay) and 07-04 (frontend
// Channel types). Do not drift these shapes — they are the interface boundary for the
// whole assistant harness spine (host.ai() -> Rust -> sidecar -> Rust -> webview).
import * as readline from "node:readline";

// ---- Requests (sidecar STDIN, one JSON object per line) -------------------------------

export interface PromptRequest {
  type: "prompt";
  id: string;
  sessionId: string;
  message: string;
  modes: string[];
}

export interface SetModesRequest {
  type: "setModes";
  modes: string[];
}

export interface LoadSessionRequest {
  type: "loadSession";
  id: string;
  sessionId: string;
}

export type SidecarRequest = PromptRequest | SetModesRequest | LoadSessionRequest;

// ---- Events (sidecar STDOUT, one JSON object per line) ---------------------------------

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

export type SidecarEvent =
  | ReadyEvent
  | ThinkingDeltaEvent
  | TextDeltaEvent
  | ToolStartEvent
  | ToolEndEvent
  | ErrorEvent
  | DoneEvent
  | HistoryEvent;

/**
 * Serialize one event as a single newline-delimited JSON line and write it to the
 * given writable stream (defaults to process.stdout).
 */
export function writeEvent(
  evt: SidecarEvent,
  out: NodeJS.WritableStream = process.stdout,
): void {
  out.write(JSON.stringify(evt) + "\n");
}

/**
 * Type guard: is this parsed JSON value a well-formed SidecarRequest?
 */
function isSidecarRequest(value: unknown): value is SidecarRequest {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.type === "prompt") {
    return (
      typeof v.id === "string" &&
      typeof v.sessionId === "string" &&
      typeof v.message === "string" &&
      Array.isArray(v.modes)
    );
  }
  if (v.type === "setModes") {
    return Array.isArray(v.modes);
  }
  if (v.type === "loadSession") {
    return typeof v.id === "string" && typeof v.sessionId === "string";
  }
  return false;
}

/**
 * Async iterator reading newline-delimited JSON requests from the given readable
 * stream (defaults to process.stdin). Malformed lines are skipped defensively
 * (never crash the sidecar on a bad line from the Rust host) rather than thrown.
 */
export async function* readRequests(
  input: NodeJS.ReadableStream = process.stdin,
): AsyncGenerator<SidecarRequest> {
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue; // defensive parse per stdio trust boundary — never crash on bad input
    }
    if (isSidecarRequest(parsed)) {
      yield parsed;
    }
  }
}
