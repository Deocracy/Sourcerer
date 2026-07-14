import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { host, type AssistantEvent } from "../host/ai";
import { sessionSeeds, newRealSession, type SessionEntry } from "./sessionSeeds";
import { parseProposal, type Proposal } from "./proposalParse";
import { shellStore } from "../store/shellStore";
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

// D-01 growth: generalizes Phase 7's single `sourcerer:assistant:sessionId`
// key into a persisted LIST of real-session ids (JSON array), so the panel
// can hold several real sessions alongside the read-only seeds. Namespaced
// per the applet `sourcerer:<key>:<k>` storage convention.
const SESSION_IDS_KEY = "sourcerer:assistant:sessionIds";

/**
 * Loads the persisted list of real-session ids and reconstructs their
 * (locally empty — history is reloaded per-session via `host.loadSession`)
 * SessionEntry shells. T-06-02-02: a corrupt/malformed persisted value never
 * throws at mount — it falls back to minting one fresh real session.
 */
function loadRealSessions(): SessionEntry[] {
  try {
    const raw = localStorage.getItem(SESSION_IDS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((id) => typeof id === "string")) {
        return (parsed as string[]).map((id) => ({
          id,
          label: "Session",
          kind: "real",
          turns: [],
        }));
      }
    }
  } catch {
    // T-06-02-02: fall through to minting a fresh real session below.
  }
  return [newRealSession()];
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composerText, setComposerText] = useState("");
  const [sending, setSending] = useState(false);
  const [researchMode, setResearchMode] = useState(false);
  const [realSessions, setRealSessions] = useState<SessionEntry[]>(() => loadRealSessions());
  const [closedIds, setClosedIds] = useState<Set<string>>(() => new Set());
  const [activeSessionId, setActiveSessionId] = useState<string>(() => realSessions[0].id);
  const [historyOpen, setHistoryOpen] = useState(false);
  // ASST-02: id of the message whose proposal currently responds to y/d/n.
  // Auto-focused whenever a new proposal is attached (session load or a
  // just-completed turn); a click on a proposal block re-focuses it.
  const [focusedProposalId, setFocusedProposalId] = useState<string | null>(null);

  const allSessions = [...realSessions, ...sessionSeeds];
  const visibleSessions = allSessions.filter((s) => !closedIds.has(s.id));
  const activeSession = allSessions.find((s) => s.id === activeSessionId) ?? allSessions[0];
  const activeKind = activeSession.kind;

  // Persist the real-session id list whenever it grows/shrinks (T-06-02-02:
  // reading this back at mount is wrapped in try/catch above).
  useEffect(() => {
    localStorage.setItem(SESSION_IDS_KEY, JSON.stringify(realSessions.map((s) => s.id)));
  }, [realSessions]);

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
    let seededProposalId: string | null = null;
    for (let i = seeded.length - 1; i >= 0; i--) {
      if (seeded[i].role === "assistant") {
        const proposal = parseProposal(seeded[i].text);
        if (proposal) {
          seeded[i] = { ...seeded[i], proposal, proposalResolved: null };
          seededProposalId = seeded[i].id;
        }
        break;
      }
    }
    setMessages(seeded);
    setFocusedProposalId(seededProposalId);

    if (active.kind !== "real") return;

    const onEvent = (event: AssistantEvent) => {
      if (event.type === "history" && event.turns.length > 0) {
        const replayed: ChatMessage[] = event.turns.map((turn) => ({
          id: nanoid(),
          role: turn.role,
          text: turn.text,
          status: "done",
        }));
        setMessages(replayed);
      }
    };

    void host.loadSession(activeSessionId, onEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  function startNewSession() {
    const created = newRealSession();
    setRealSessions((prev) => [...prev, created]);
    setActiveSessionId(created.id);
    setHistoryOpen(false);
  }

  function closeSession(id: string) {
    setClosedIds((prev) => new Set(prev).add(id));
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

  return (
    <div className={styles.panel}>
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
