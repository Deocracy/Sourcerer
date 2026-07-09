import { useState, useSyncExternalStore } from "react";
import { resetOccurred, acknowledgeReset, subscribeReset } from "../persistence/workspaceStore";
import styles from "./ResetNotice.module.css";

/**
 * ResetNotice — the one-time dismissible corrupt-reset banner (D-04).
 *
 * A minimal, self-contained element (local `useState` for dismiss) — not
 * shared toast infrastructure; the shell has no toast system and D-04
 * deliberately scopes this to one element. Binds `resetOccurred()` via
 * `useSyncExternalStore(subscribeReset, …)` (CR-04): the corrupt fallback
 * happens inside Dock's ASYNC boot load, after this component's initial
 * render, so a plain render-time read would never see the flip. When the
 * load path falls back to DEFAULT_WORKSPACE because the persisted state was
 * corrupt/unmigratable, this renders a single-line inline banner until
 * dismissed, then calls `acknowledgeReset()` so it never reappears for this
 * session.
 */
export function ResetNotice() {
  const [dismissed, setDismissed] = useState(false);
  const reset = useSyncExternalStore(subscribeReset, resetOccurred);

  if (dismissed || !reset) {
    return null;
  }

  function handleDismiss() {
    acknowledgeReset();
    setDismissed(true);
  }

  return (
    <div className={styles.notice} role="status">
      <span className={styles.text}>
        Workspace was reset after a problem loading your layout.
      </span>
      <button
        type="button"
        className={styles.dismiss}
        aria-label="Dismiss notice"
        onClick={handleDismiss}
      >
        ×
      </button>
    </div>
  );
}
