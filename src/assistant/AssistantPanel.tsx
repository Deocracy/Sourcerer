import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { host, type AssistantEvent } from "../host/ai";
import { sessionSeeds, newRealSession, type SessionEntry } from "./sessionSeeds";
import { loadSessionIds, saveSessionIds } from "./sessionIdsStorage";
import { parseProposal, type Proposal } from "./proposalParse";
import { shellStore, useShellStore } from "../store/shellStore";
import { useAssistantResize } from "./useAssistantResize";
import styles from "./AssistantPanel.module.css";

type MessageRole = "user" | "assistant";
type MessageStatus = "streaming" | "done" | "error";

interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  status: MessageStatus;
  toolNotice?: string;
  // ASST-02 (D-02): attached to the final assistant message of a turn (or a
  // seed transcript's last assistant turn) when its text carries a proposal
  // marker. proposalResolved tracks the approve/reject state; diffOpen shows
  // the raw marker+blockquote text.
  proposal?: Proposal | null;
  proposalResolved?: "approved" | "rejected" | null;
  diffOpen?: boolean;
}

const RESEARCH_MODE = "research";

/**
 * WR-04: shared last-assistant-turn proposal attachment — used by BOTH the
 * seeded-transcript path and the `history` replay path so a real session
 * whose last assistant turn carries a proposal keeps its y/d/n block after
 * an app restart (previously only seeds got parsed). Returns the (possibly
 * new) message array and the id to focus, or null when no proposal parses.
 */
function attachProposalToLastAssistantTurn(msgs: ChatMessage[]): {
  messages: ChatMessage[];
  proposalId: string | null;
} {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "assistant") {
      const proposal = parseProposal(msgs[i].text);
      if (proposal) {
        const next = [...msgs];
        next[i] = { ...next[i], proposal, proposalResolved: null };
        return { messages: next, proposalId: next[i].id };
      }
      break;
    }
  }
  return { messages: msgs, proposalId: null };
}

function toRoman(n: number): string {
  const map: [number, string][] = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  let rem = n;
  for (const [v, s] of map) {
    while (rem >= v) {
      out += s;
      rem -= v;
    }
  }
  return out || "I";
}

/**
 * AssistantPanel — multi-session Dashboard Assistant panel (ASST-01). Grown
 * from the Phase 7 minimal single-session panel: a session list (real + the
 * read-only demo seeds from `sessionSeeds.ts`), an active-session selector,
 * and the handoff's header chrome (history/new-session icons, a demo model
 * picker). Reaches AI ONLY through `host.ai()` / `host.loadSession()` /
 * `host.setModes()` — never `invoke` directly. `thinking_delta` events stay
 * suppressed (Phase 7 discretion default, unchanged this phase).
 */
export function AssistantPanel() {
  const asstWidth = useShellStore((s) => s.asstWidth);
  const assistantOpen = useShellStore((s) => s.assistantOpen);
  const { hostRef, onResizePointerDown, liveSnap, liveWidth, reopen } = useAssistantResize();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composerText, setComposerText] = useState("");
  const [sending, setSending] = useState(false);
  const [researchMode, setResearchMode] = useState(false);
  // WR-09: the persisted real-session id list lives on the plugin store
  // (async read) — start with one freshly-minted real session so first paint
  // is never blank, then the hydration effect below swaps in the restored
  // list once the disk read resolves.
  const [realSessions, setRealSessions] = useState<SessionEntry[]>(() => [newRealSession()]);
  const [closedIds, setClosedIds] = useState<Set<string>>(() => new Set());
  const [activeSessionId, setActiveSessionId] = useState<string>(() => realSessions[0].id);
  // Gates the persist effect until the disk read settles (a mount-time write
  // of the placeholder fresh id must never clobber the stored list), and
  // guards the restore against a user mutation that landed first (mirrors
  // Home.tsx's dirtyRef, Rule 1).
  const [sessionsHydrated, setSessionsHydrated] = useState(false);
  const sessionsDirtyRef = useRef(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // ASST-02: id of the message whose proposal currently responds to y/d/n.
  // Auto-focused whenever a new proposal is attached (session load or a
  // just-completed turn); a click on a proposal block re-focuses it.
  const [focusedProposalId, setFocusedProposalId] = useState<string | null>(null);

  const allSessions = [...realSessions, ...sessionSeeds];
  const visibleSessions = allSessions.filter((s) => !closedIds.has(s.id));
  const activeSession = allSessions.find((s) => s.id === activeSessionId) ?? allSessions[0];
  const activeKind = activeSession.kind;

  // WR-09 hydration: restore the persisted real-session id list (plugin
  // store, applets.json) as locally-empty SessionEntry shells — history is
  // reloaded per-session via `host.loadSession`. T-06-02-02: loadSessionIds
  // never throws; a corrupt/absent value resolves null and the mount-time
  // fresh session stands.
  useEffect(() => {
    let stale = false;
    void loadSessionIds().then((ids) => {
      if (!stale && !sessionsDirtyRef.current && ids && ids.length > 0) {
        const restored: SessionEntry[] = ids.map((id) => ({
          id,
          label: "Session",
          kind: "real",
          turns: [],
        }));
        setRealSessions(restored);
        setActiveSessionId(restored[0].id);
      }
      if (!stale) setSessionsHydrated(true);
    });
    return () => {
      stale = true;
    };
  }, []);

  // Persist the real-session id list whenever it grows (new session minted)
  // or shrinks (real session closed, WR-03) — but only after hydration, so
  // the placeholder fresh session can never overwrite the stored list before
  // the disk read resolves.
  useEffect(() => {
    if (!sessionsHydrated) return;
    void saveSessionIds(realSessions.map((s) => s.id));
  }, [sessionsHydrated, realSessions]);

  function updateMessage(id: string, patch: Partial<ChatMessage>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  // Runs on mount AND whenever the active session changes. Seeds the visible
  // thread from the entry's locally-known `turns` first (this is what shows
  // a freshly-minted real session's "New assistant ready…" greeting, and
  // renders a seed's canned transcript directly). For REAL sessions only, a
  // `host.loadSession` call follows and — if it returns non-empty history —
  // overwrites the seeded thread with the reloaded transcript (D-09 restart
  // survival for sessions that existed before this mount). Seed sessions
  // never call `host.loadSession` (D-01: read-only, no live seam contact).
  useEffect(() => {
    const active = allSessions.find((s) => s.id === activeSessionId);
    if (!active) return;

    const seeded: ChatMessage[] = active.turns.map((turn) => ({
      id: nanoid(),
      role: turn.role,
      text: turn.text,
      status: "done",
    }));

    // ASST-02: attach a parsed proposal to the transcript's final assistant
    // turn if it carries one (this is what surfaces the seed-careggi demo's
    // guaranteed-parseable proposal) and auto-focus it.
    const seededResult = attachProposalToLastAssistantTurn(seeded);
    setMessages(seededResult.messages);
    setFocusedProposalId(seededResult.proposalId);

    if (active.kind !== "real") return;

    // CR-03: staleness guard — the sidecar history round-trip is async and
    // unbounded, so switching from session A to session B before A's
    // `history` event lands must NOT let A's late event overwrite B's
    // visible thread. The effect cleanup flips `stale` when activeSessionId
    // changes (or the panel unmounts); a stale stream's events are dropped.
    let stale = false;

    const onEvent = (event: AssistantEvent) => {
      if (stale) return;
      if (event.type === "history" && event.turns.length > 0) {
        const replayed: ChatMessage[] = event.turns.map((turn) => ({
          id: nanoid(),
          role: turn.role,
          text: turn.text,
          status: "done",
        }));
        // WR-04: run the SAME last-assistant-turn proposal attachment the
        // seeded path uses, and re-point focusedProposalId at the replayed
        // result (or clear it — the seeded ids no longer exist once the
        // replay replaces them, and a dangling focus id swallows bare
        // y/d/n keypresses shell-wide while doing nothing visible).
        const replayedResult = attachProposalToLastAssistantTurn(replayed);
        setMessages(replayedResult.messages);
        setFocusedProposalId(replayedResult.proposalId);
      }
    };

    void host.loadSession(activeSessionId, onEvent);
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  function startNewSession() {
    sessionsDirtyRef.current = true;
    const created = newRealSession();
    setRealSessions((prev) => [...prev, created]);
    setActiveSessionId(created.id);
    setHistoryOpen(false);
  }

  function closeSession(id: string) {
    sessionsDirtyRef.current = true;
    // WR-03: real sessions are REMOVED from realSessions (letting the
    // persistence effect shrink the stored id list) — otherwise every closed
    // real session resurrects on the next launch and the persisted array
    // grows monotonically. closedIds is kept only for seeds, which cannot be
    // removed from the static sessionSeeds array.
    if (realSessions.some((s) => s.id === id)) {
      setRealSessions((prev) => prev.filter((s) => s.id !== id));
    } else {
      setClosedIds((prev) => new Set(prev).add(id));
    }
    if (id !== activeSessionId) return;
    const remaining = allSessions.filter((s) => s.id !== id && !closedIds.has(s.id));
    if (remaining.length > 0) {
      setActiveSessionId(remaining[0].id);
    } else {
      const fresh = newRealSession();
      setRealSessions((prev) => [...prev, fresh]);
      setActiveSessionId(fresh.id);
    }
  }

  // ASST-02 proposal actions — approve publishes lastResolvedProposal to
  // shellStore and reveals ＋MAKE CARD; reject is reversible (toggles, no
  // confirm, T-06-03 non-destructive); diff toggles the raw marker text.
  function approveProposal(id: string) {
    const msg = messages.find((m) => m.id === id);
    if (!msg?.proposal) return;
    shellStore.getState().setLastResolvedProposal(msg.proposal.body);
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, proposalResolved: "approved" } : m)),
    );
  }

  function rejectProposal(id: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, proposalResolved: m.proposalResolved === "rejected" ? null : "rejected" }
          : m,
      ),
    );
  }

  function toggleProposalDiff(id: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, diffOpen: !m.diffOpen } : m)));
  }

  // D-06 producer half: writes pendingCardMint, which Home (Plan 06-06)
  // consumes to mint a card from the approved proposal.
  function makeCardFromProposal(id: string) {
    const msg = messages.find((m) => m.id === id);
    if (!msg?.proposal) return;
    const title = msg.proposal.target ?? msg.proposal.body.split("\n")[0]!.slice(0, 60);
    shellStore.getState().requestCardMint({ title, foot: "from assistant" });
  }

  // Keyboard y/d/n act ONLY on the currently-focused proposal. Ignored while
  // typing in an input/textarea (composer) so the shortcuts never hijack
  // normal text entry.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!focusedProposalId) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.key === "y") {
        e.preventDefault();
        approveProposal(focusedProposalId);
      } else if (e.key === "n") {
        e.preventDefault();
        rejectProposal(focusedProposalId);
      } else if (e.key === "d") {
        e.preventDefault();
        toggleProposalDiff(focusedProposalId);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedProposalId, messages]);

  async function handleSend() {
    const text = composerText.trim();
    if (!text || sending || activeKind !== "real") return;

    const userMessage: ChatMessage = { id: nanoid(), role: "user", text, status: "done" };
    const assistantId = nanoid();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      text: "",
      status: "streaming",
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setComposerText("");
    setSending(true);

    const onEvent = (event: AssistantEvent) => {
      switch (event.type) {
        case "text_delta":
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, text: m.text + event.text } : m,
            ),
          );
          break;
        case "tool_start":
          updateMessage(assistantId, { toolNotice: `searching ${event.name}…` });
          break;
        case "tool_end":
          updateMessage(assistantId, { toolNotice: undefined });
          break;
        case "error":
          updateMessage(assistantId, {
            status: "error",
            text: `assistant unavailable: ${event.message}`,
            toolNotice: undefined,
          });
          break;
        case "done": {
          // ASST-02: parse the FINAL accumulated text once (not per delta —
          // T-06-03-02) and attach the result only to the just-completed
          // assistant message, guarded against the error status.
          let sawProposalId: string | null = null;
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantId || m.status === "error") return m;
              const proposal = parseProposal(m.text);
              if (proposal) sawProposalId = m.id;
              return { ...m, status: "done", proposal, proposalResolved: proposal ? null : m.proposalResolved };
            }),
          );
          if (sawProposalId) setFocusedProposalId(sawProposalId);
          setSending(false);
          break;
        }
        case "ready":
        case "thinking_delta":
          // Suppressed in the panel (Phase 7 discretion default, unchanged).
          break;
      }
    };

    await host.ai(
      { message: text, sessionId: activeSessionId, modes: researchMode ? [RESEARCH_MODE] : [] },
      onEvent,
    );
    setSending(false);
  }

  async function toggleResearch() {
    const next = !researchMode;
    setResearchMode(next);
    await host.setModes(next ? [RESEARCH_MODE] : []);
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSend();
    }
  }

  const composerDisabled = activeKind !== "real";

  // ASST-03 (D-03): the panel self-sizes from shellStore's asstWidth/
  // assistantOpen (persisted, Plan 06-01) rather than the shell layout
  // computing/passing a width — no shell-layout-component edit needed.
  // Closed renders only a thin --asst-closed-w strip with a reopen click
  // affordance.
  if (!assistantOpen) {
    return (
      <div
        ref={hostRef}
        className={styles.closedStrip}
        role="button"
        tabIndex={0}
        aria-label="Reopen Dashboard Assistant"
        onClick={reopen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            reopen();
          }
        }}
      >
        <div className={styles.grip} onPointerDown={onResizePointerDown} />
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className={styles.panel}
      // GAP-1: render the live drag width while a resize is in flight (every
      // pointermove frame) so the panel follows the pointer fluidly; falls
      // back to the persisted asstWidth once the drag ends (liveWidth is
      // cleared to null in useAssistantResize's teardown).
      style={{ width: liveWidth ?? asstWidth }}
    >
      <div className={styles.grip} onPointerDown={onResizePointerDown} />
      {liveSnap?.mode === "full" && (
        <div className={styles.snapCue} aria-hidden="true">
          LET GO TO SNAP
        </div>
      )}
      <div className={styles.header}>
        <div className={styles.sessionRow}>
          {visibleSessions.map((s, i) => (
            <div
              key={s.id}
              className={s.id === activeSessionId ? `${styles.chip} ${styles.chipActive}` : styles.chip}
            >
              <button
                type="button"
                className={styles.chipButton}
                title={s.label}
                onClick={() => setActiveSessionId(s.id)}
              >
                {toRoman(i + 1)}
              </button>
              <button
                type="button"
                className={styles.chipClose}
                aria-label={`Close session ${s.label}`}
                onClick={() => closeSession(s.id)}
              >
                ×
              </button>
            </div>
          ))}
          <div className={styles.headerIcons}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="View session history"
              onClick={() => setHistoryOpen((v) => !v)}
            >
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.3" />
                <path
                  d="M8 4.6 L8 8 L10.4 9.4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Start new session"
              onClick={startNewSession}
            >
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                <path
                  d="M8 3 L8 13 M3 8 L13 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {historyOpen && (
          <div className={styles.historyList}>
            {visibleSessions.map((s) => (
              <div
                key={s.id}
                className={styles.historyItem}
                onClick={() => {
                  setActiveSessionId(s.id);
                  setHistoryOpen(false);
                }}
              >
                {s.label}
              </div>
            ))}
          </div>
        )}

        <div className={styles.controlsRow}>
          <span className={styles.modelPicker}>◈ model</span>
          <button
            type="button"
            className={researchMode ? styles.modeActive : styles.mode}
            aria-pressed={researchMode}
            onClick={() => void toggleResearch()}
          >
            Research
          </button>
        </div>
      </div>

      <div className={styles.thread}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={m.role === "user" ? styles.userMessage : styles.assistantMessage}
            data-status={m.status}
          >
            <div className={m.status === "error" ? styles.errorText : styles.messageText}>
              {m.text}
            </div>
            {m.toolNotice && <div className={styles.toolNotice}>{m.toolNotice}</div>}
            {m.proposal && (
              <div
                className={styles.proposalBlock}
                tabIndex={0}
                onFocus={() => setFocusedProposalId(m.id)}
                onClick={() => setFocusedProposalId(m.id)}
                data-focused={focusedProposalId === m.id}
              >
                <blockquote className={styles.proposalQuote}>{m.proposal.body}</blockquote>
                {m.diffOpen && <pre className={styles.proposalRaw}>{m.proposal.raw}</pre>}
                <div className={styles.proposalActions}>
                  <button
                    type="button"
                    className={styles.actionApprove}
                    onClick={() => approveProposal(m.id)}
                  >
                    [y] approve
                  </button>
                  <button
                    type="button"
                    className={styles.actionDiff}
                    onClick={() => toggleProposalDiff(m.id)}
                  >
                    [d] diff
                  </button>
                  <button
                    type="button"
                    className={
                      m.proposalResolved === "rejected" ? styles.actionRejectActive : styles.actionReject
                    }
                    onClick={() => rejectProposal(m.id)}
                  >
                    [n] reject
                  </button>
                </div>
                {m.proposalResolved === "approved" && (
                  <button
                    type="button"
                    className={styles.makeCard}
                    aria-label="Make card from this response"
                    onClick={() => makeCardFromProposal(m.id)}
                  >
                    ＋ MAKE CARD
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.composer}>
        <textarea
          className={styles.textarea}
          value={composerText}
          onChange={(e) => setComposerText(e.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder="Reply to Dashboard…"
          aria-label="Message"
          disabled={composerDisabled}
        />
        <button
          type="button"
          className={styles.send}
          aria-label="Send message"
          onClick={() => void handleSend()}
          disabled={sending || composerDisabled || composerText.trim().length === 0}
        >
          Send
        </button>
      </div>
    </div>
  );
}
