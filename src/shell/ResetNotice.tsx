import { useState } from "react";
import { resetOccurred, acknowledgeReset } from "../persistence/workspaceStore";
import styles from "./ResetNotice.module.css";

/**
 * ResetNotice — the one-time dismissible corrupt-reset banner (D-04).
 *
 * A minimal, self-contained element (local `useState` for dismiss) — not
 * shared toast infrastructure; the shell has no toast system and D-04
 * deliberately scopes this to one element. Reads `resetOccurred()` from
 * workspaceStore at render time: if the load path fell back to
 * DEFAULT_WORKSPACE because the persisted state was corrupt/unmigratable,
 * this renders a single-line inline banner until dismissed, then calls
 * `acknowledgeReset()` so it never reappears for this session.
 */
export function ResetNotice() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !resetOccurred()) {
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
