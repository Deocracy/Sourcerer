import { useEffect, useRef, useState } from "react";
import { customAlphabet, nanoid } from "nanoid";
import { host, type AssistantEvent } from "../host/ai";
import styles from "./AssistantPanel.module.css";

type MessageRole = "user" | "assistant";
type MessageStatus = "streaming" | "done" | "error";

interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  status: MessageStatus;
  toolNotice?: string;
}

const RESEARCH_MODE = "research";

// The sidecar validates sessionId against SESSION_ID_PATTERN (sessions.ts), which
// requires the first AND last character to be alphanumeric. Default nanoid() draws
// from the URL-safe alphabet `A-Za-z0-9_-`, so ~6% of IDs start/end with `_`/`-`
// and are rejected — and the rejected build is cached, permanently wedging the
// session (CR-01). Draw session IDs from an alphanumeric-only alphabet so every
// generated ID satisfies the sidecar contract by construction.
const newSessionId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 21);

// D-09 restart survival: persist the sessionId across app restarts so the same
// conversation (and its on-disk JSONL file) is reopened instead of a fresh one
// minted every mount. Namespaced per the applet `sourcerer:<key>:<k>` storage
// convention (CLAUDE.md / reference/applets/README.md). localStorage is the
// minimal store here since no tauri-plugin-store / host.storage seam exists
// in-repo yet (SHELL-04 note: a future migration point, not a re-litigation of
// that decision now).
const SESSION_STORAGE_KEY = "sourcerer:assistant:sessionId";

function loadOrMintSessionId(): string {
  const stored = localStorage.getItem(SESSION_STORAGE_KEY);
  if (stored) return stored;
  const minted = newSessionId();
  localStorage.setItem(SESSION_STORAGE_KEY, minted);
  return minted;
}

/**
 * AssistantPanel — minimal rail chat panel proving D-01 end-to-end: type a
 * message, watch a real streamed reply. Keeps chat state local (no Zustand
 * exists yet, per 07-CONTEXT.md discretion note) and reaches AI ONLY through
 * `host.ai()` / `host.setModes()` — never `invoke` directly. `thinking_delta`
 * events are intentionally suppressed in this minimal panel (discretion
 * default); full ASST-01/02/03 polish stays Phase 6.
 */
export function AssistantPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composerText, setComposerText] = useState("");
  const [sending, setSending] = useState(false);
  const [researchMode, setResearchMode] = useState(false);
  const sessionId = useRef(loadOrMintSessionId());

  function updateMessage(id: string, patch: Partial<ChatMessage>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  // D-09: on mount, reload the persisted session's prior turns (if any) and render
  // them before any new message is sent. An empty `turns` array (fresh session, or
  // the backend degrading honestly per D-06) leaves the panel empty and usable.
  useEffect(() => {
    const onEvent = (event: AssistantEvent) => {
      if (event.type === "history") {
        const replayed: ChatMessage[] = event.turns.map((turn) => ({
          id: nanoid(),
          role: turn.role,
          text: turn.text,
          status: "done",
        }));
        setMessages(replayed);
      }
      // ready/thinking_delta/error/done/etc. carry nothing to render for a
      // load_session turn beyond the history event itself; degrade is honest by
      // construction (empty turns), so no error-branch handling is needed here.
    };

    void host.loadSession(sessionId.current, onEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSend() {
    const text = composerText.trim();
    if (!text || sending) return;

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
        case "done":
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId && m.status !== "error" ? { ...m, status: "done" } : m,
            ),
          );
          setSending(false);
          break;
        case "ready":
        case "thinking_delta":
          // Suppressed in the minimal panel (07-CONTEXT.md discretion default).
          break;
      }
    };

    await host.ai(
      { message: text, sessionId: sessionId.current, modes: researchMode ? [RESEARCH_MODE] : [] },
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

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Assistant</span>
        <button
          type="button"
          className={researchMode ? styles.modeActive : styles.mode}
          aria-pressed={researchMode}
          onClick={() => void toggleResearch()}
        >
          Research
        </button>
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
          </div>
        ))}
      </div>

      <div className={styles.composer}>
        <textarea
          className={styles.textarea}
          value={composerText}
          onChange={(e) => setComposerText(e.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder="Ask the assistant…"
          aria-label="Message"
        />
        <button
          type="button"
          className={styles.send}
          onClick={() => void handleSend()}
          disabled={sending || composerText.trim().length === 0}
        >
          Send
        </button>
      </div>
    </div>
  );
}
