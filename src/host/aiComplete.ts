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

/** WR-02: inactivity watchdog — the "never hangs" guarantee must not rest
 *  solely on the Rust relay's terminal-event discipline. If the channel goes
 *  silent for this long (sidecar killed mid-turn, relay dropped without a
 *  synthetic error+done pair), the promise rejects instead of pending
 *  forever. Reset on every delta, so slow-but-alive streams are unaffected;
 *  generous enough to cover a slow time-to-first-token. */
export const AI_INACTIVITY_TIMEOUT_MS = 120_000;

/**
 * aiComplete(prompt, opts) — resolves with the final accumulated text once a
 * `done` event arrives, rejects with a typed Error on an `error` event
 * (D-06 honest-degrade inverted back into a rejecting Promise), and forwards
 * the cumulative text to `opts.onDelta` on every `text_delta`. "Never hangs"
 * is enforced locally (WR-02): an inactivity watchdog rejects after
 * AI_INACTIVITY_TIMEOUT_MS without any event, so a dead channel cannot leave
 * the applet's `await host.ai(...)` pending forever.
 */
export function aiComplete(
  prompt: string,
  opts?: { onDelta?: (text: string) => void },
): Promise<string> {
  return new Promise((resolve, reject) => {
    let text = "";
    let settled = false;
    const sessionId = makeOneshotSessionId();

    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const disarm = () => clearTimeout(watchdog);
    const arm = () => {
      disarm();
      watchdog = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(
          new Error(
            `aiComplete: no assistant events for ${AI_INACTIVITY_TIMEOUT_MS / 1000}s — stream presumed dead (WR-02 watchdog)`,
          ),
        );
      }, AI_INACTIVITY_TIMEOUT_MS);
    };
    arm();

    void lowLevelAi({ message: prompt, sessionId, modes: [] }, (event: AssistantEvent) => {
      if (settled) return;
      if (event.type === "text_delta") {
        arm(); // activity — push the watchdog deadline out
        text += event.text;
        opts?.onDelta?.(text);
      } else if (event.type === "error") {
        settled = true;
        disarm();
        reject(new Error(event.message));
      } else if (event.type === "done") {
        settled = true;
        disarm();
        resolve(text);
      }
    });
  });
}
