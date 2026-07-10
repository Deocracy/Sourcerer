import { nanoid } from "nanoid";
import { ai as lowLevelAi, type AssistantEvent } from "./ai";

/**
 * host/aiComplete.ts — the promise+onDelta wrapper over src/host/ai.ts's
 * Channel/event `ai()` client (D-03/D-04/D-05/D-06). This module NEVER calls
 * invoke("host_ai") directly (RESEARCH.md anti-pattern) — it composes over
 * `ai()`, which is the sole place that surface is invoked.
 *
 * MVP scope boundaries recorded here (04-RESEARCH.md Pitfalls 1-3), accepted
 * for this plan:
 *  - Pitfall 1: one-shot session files accumulate on disk (a new
 *    oneshot-<nanoid> sessionId every call, never reused/cleaned up here).
 *  - Pitfall 2: the sidecar executes calls sequentially, not truly in
 *    parallel — concurrent aiComplete() calls queue on the sidecar side.
 *  - Pitfall 3: cancellation is frontend-abandonment only (the caller simply
 *    stops awaiting/using the result) — the sidecar is not aborted mid-turn.
 */

/** Ensures the sessionId's first AND last characters are alphanumeric, per
 *  the sidecar's SESSION_ID_PATTERN (04-RESEARCH.md Assumption A2). nanoid's
 *  default alphabet can end in `_`/`-`, which would fail that pattern — strip
 *  a trailing non-alphanumeric run and pad with a fixed alnum suffix so
 *  validity is guaranteed regardless of what nanoid() produced. */
function makeOneshotSessionId(): string {
  const id = nanoid();
  const stripped = id.replace(/[^A-Za-z0-9]+$/, "");
  const safe = stripped.length > 0 ? stripped : "x";
  return `oneshot-${safe}0`;
}

/**
 * aiComplete(prompt, opts) — resolves with the final accumulated text once a
 * `done` event arrives, rejects with a typed Error on an `error` event
 * (never resolves empty, never hangs — D-06 honest-degrade inverted back
 * into a rejecting Promise), and forwards the cumulative text to
 * `opts.onDelta` on every `text_delta`.
 */
export function aiComplete(
  prompt: string,
  opts?: { onDelta?: (text: string) => void },
): Promise<string> {
  return new Promise((resolve, reject) => {
    let text = "";
    let settled = false;
    const sessionId = makeOneshotSessionId();

    void lowLevelAi({ message: prompt, sessionId, modes: [] }, (event: AssistantEvent) => {
      if (settled) return;
      if (event.type === "text_delta") {
        text += event.text;
        opts?.onDelta?.(text);
      } else if (event.type === "error") {
        settled = true;
        reject(new Error(event.message));
      } else if (event.type === "done") {
        settled = true;
        resolve(text);
      }
    });
  });
}
