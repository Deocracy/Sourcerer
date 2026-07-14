import { shellStore, useShellStore } from "../store/shellStore";
import styles from "./RailToggleButtons.module.css";

/**
 * RailToggleButtons — two 16x12 SVG buttons in the title bar. The LEFT
 * button cycles the left rail's mode (expanded -> compact -> hidden ->
 * expanded) via cycleRailMode (RAIL-01), unchanged. The RIGHT button drives
 * the Dashboard Assistant (GAP-1 fix, 06-HUMAN-UAT.md): it was previously
 * also wired to cycleRailMode, so it never touched the assistant. It now
 * calls cycleAssistant (closed -> open -> full -> open -> closed, mirroring
 * the prototype's toggleRight/cycleRight), and its fill mirrors the
 * prototype's rightFillX/rightFillW (a partial-width accent bar while open,
 * full-width while full, none while closed). Store calls don't need the
 * try/catch withWindow guard WindowControls uses for Tauri IPC.
 */
export function RailToggleButtons() {
  const railMode = useShellStore((s) => s.railMode);
  const assistantOpen = useShellStore((s) => s.assistantOpen);
  const assistantFull = useShellStore((s) => s.assistantFull);

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
        aria-label="Cycle assistant panel (right)"
        onClick={() => shellStore.getState().cycleAssistant()}
      >
        <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
          <rect x="0.5" y="0.5" width="15" height="11" fill="none" stroke="var(--color-line-2)" />
          <rect
            x={assistantFull ? 0.5 : 11.5}
            y="0.5"
            width={assistantFull ? 15 : assistantOpen ? 4 : 0}
            height="11"
            fill="var(--color-accent)"
          />
        </svg>
      </button>
    </div>
  );
}
