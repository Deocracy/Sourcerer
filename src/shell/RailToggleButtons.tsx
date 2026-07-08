import { shellStore, useShellStore } from "../store/shellStore";
import styles from "./RailToggleButtons.module.css";

/**
 * RailToggleButtons — two 16x12 SVG buttons in the title bar that cycle the
 * left rail's mode (expanded -> compact -> hidden -> expanded) via the shell
 * store's cycleRailMode action (RAIL-01). Store calls don't need the
 * try/catch withWindow guard WindowControls uses for Tauri IPC.
 */
export function RailToggleButtons() {
  const railMode = useShellStore((s) => s.railMode);

  return (
    <div className={styles.toggles}>
      <button
        type="button"
        className={styles.toggle}
        aria-label="Cycle rail mode (left)"
        onClick={() => shellStore.getState().cycleRailMode()}
      >
        <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
          <rect
            x="0.5"
            y="0.5"
            width="6"
            height="11"
            fill={railMode !== "hidden" ? "var(--color-accent)" : "none"}
            stroke="var(--color-line-2)"
          />
          <rect
            x="8.5"
            y="0.5"
            width="7"
            height="11"
            fill={railMode === "expanded" ? "var(--color-accent)" : "none"}
            stroke="var(--color-line-2)"
          />
        </svg>
      </button>
      <button
        type="button"
        className={styles.toggle}
        aria-label="Cycle rail mode (right)"
        onClick={() => shellStore.getState().cycleRailMode()}
      >
        <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
          <rect
            x="0.5"
            y="0.5"
            width="15"
            height="11"
            fill={railMode === "compact" ? "var(--color-accent)" : "none"}
            stroke="var(--color-line-2)"
          />
        </svg>
      </button>
    </div>
  );
}
