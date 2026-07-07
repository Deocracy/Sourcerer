import { getCurrentWindow } from "@tauri-apps/api/window";
import { useMaximizedState } from "./useMaximizedState";
import styles from "./WindowControls.module.css";

/**
 * WindowControls — the right cluster of the title bar (SHELL-02).
 * Three 46×34 buttons wired directly to the Tauri window API. Commands
 * fail silently to console (no user-facing error UI for native chrome).
 * The maximize/restore glyph + aria-label are driven by the real
 * isMaximized() state via useMaximizedState (D-02, no store).
 */
export function WindowControls() {
  const isMaximized = useMaximizedState();

  const minimize = () => getCurrentWindow().minimize().catch(console.error);
  const toggleMaximize = () => getCurrentWindow().toggleMaximize().catch(console.error);
  const close = () => getCurrentWindow().close().catch(console.error);

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.button}
        aria-label="Minimize window"
        onClick={minimize}
      >
        <span className={styles.minGlyph} aria-hidden="true">
          —
        </span>
      </button>

      <button
        type="button"
        className={styles.button}
        aria-label={isMaximized ? "Restore window" : "Maximize window"}
        onClick={toggleMaximize}
      >
        <span className={styles.maxGlyph} aria-hidden="true" />
      </button>

      <button
        type="button"
        className={`${styles.button} ${styles.close}`}
        aria-label="Close window"
        onClick={close}
      >
        <span className={styles.closeGlyph} aria-hidden="true">
          ✕
        </span>
      </button>
    </div>
  );
}
