import { shellStore, useShellStore } from "../store/shellStore";
import styles from "./RailToggleButtons.module.css";

/**
 * RailToggleButtons — two 16x12 SVG buttons in the title bar, both using the
 * reference's single fill-bar language (outline rect + one growing fill rect,
 * both driven by currentColor — never the accent green). The LEFT button
 * cycles the left rail's mode (expanded -> compact -> hidden -> expanded) via
 * cycleRailMode (RAIL-01), unchanged; its fill bar grows via leftColW (6 for
 * expanded, 3 for compact, 0 for hidden). The RIGHT button drives the
 * Dashboard Assistant (GAP-1 fix, 06-HUMAN-UAT.md): it calls cycleAssistant
 * (closed -> open -> full -> open -> closed, mirroring the prototype's
 * toggleRight/cycleRight), and its fill mirrors the prototype's
 * rightFillX/rightFillW (a partial-width bar while open, full-width while
 * full, none while closed). Both buttons' color (fg vs faint) is driven by
 * state per the reference's leftToggleFg/rightToggleFg rules. Store calls
 * don't need the try/catch withWindow guard WindowControls uses for Tauri IPC.
 */
export function RailToggleButtons() {
  const railMode = useShellStore((s) => s.railMode);
  const assistantOpen = useShellStore((s) => s.assistantOpen);
  const assistantFull = useShellStore((s) => s.assistantFull);

  const leftColW = railMode === "expanded" ? 6 : railMode === "compact" ? 3 : 0;
  const leftClassName = `${styles.toggle} ${railMode === "hidden" ? styles.toggleDim : styles.toggleLit}`;
  const rightClassName = `${styles.toggle} ${assistantOpen || assistantFull ? styles.toggleLit : styles.toggleDim}`;

  return (
    <div className={styles.toggles}>
      <button
        type="button"
        className={leftClassName}
        aria-label="Cycle rail mode (left)"
        onClick={() => shellStore.getState().cycleRailMode()}
      >
        <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
          <rect x="0.5" y="0.5" width="15" height="11" fill="none" stroke="currentColor" />
          <rect x="0.5" y="0.5" width={leftColW} height="11" fill="currentColor" />
        </svg>
      </button>
      <button
        type="button"
        className={rightClassName}
        aria-label="Cycle assistant panel (right)"
        onClick={() => shellStore.getState().cycleAssistant()}
      >
        <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
          <rect x="0.5" y="0.5" width="15" height="11" fill="none" stroke="currentColor" />
          <rect
            x={assistantFull ? 0.5 : 11.5}
            y="0.5"
            width={assistantFull ? 15 : assistantOpen ? 4 : 0}
            height="11"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
  );
}
