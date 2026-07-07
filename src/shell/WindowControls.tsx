import { getCurrentWindow } from "@tauri-apps/api/window";
import { useMaximizedState } from "./useMaximizedState";
import styles from "./WindowControls.module.css";

// Deferred to click-time (not module/render-time) so rendering WindowControls
// outside a real (or mockIPC'd) Tauri context — e.g. TitleBar.test.tsx, which
// asserts structure/aria-labels without invoking any window mocks — doesn't
// crash the render tree.
function withWindow(fn: (appWindow: ReturnType<typeof getCurrentWindow>) => Promise<void>) {
  try {
    fn(getCurrentWindow()).catch(console.error);
  } catch (err) {
    console.error(err);
  }
}

/**
 * WindowControls — minimize / maximize-restore / close, wired directly to the
 * Tauri window API (SHELL-02). Window-command failures fail silently to console
 * per UI-SPEC Error state — no user-facing error UI for native window chrome.
 * The maximize/restore icon + aria-label are driven by useMaximizedState (D-02:
 * stateless, no store) rather than a click-only toggle (Pitfall 4).
 */
export function WindowControls() {
  const isMaximized = useMaximizedState();

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.minimize}
        aria-label="Minimize window"
        onClick={() => withWindow((w) => w.minimize())}
      >
        —
      </button>
      <button
        type="button"
        className={styles.maximize}
        aria-label={isMaximized ? "Restore window" : "Maximize window"}
        onClick={() => withWindow((w) => w.toggleMaximize())}
      >
        <span className={styles.maximizeGlyph} />
      </button>
      <button
        type="button"
        className={styles.close}
        aria-label="Close window"
        onClick={() => withWindow((w) => w.close())}
      >
        ✕
      </button>
    </div>
  );
}
