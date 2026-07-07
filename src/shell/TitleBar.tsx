import { LogoCluster } from "./LogoCluster";
import { WindowControls } from "./WindowControls";
import styles from "./TitleBar.module.css";

/**
 * TitleBar — the 34px custom title bar (SHELL-01).
 * Layout: LogoCluster (left) → flex spacer (the ONLY drag region) → WindowControls (right).
 *
 * Only the spacer carries data-tauri-drag-region — the attribute does NOT cascade
 * (Pitfall 3 / T-01-03), so putting it on the bar would make the buttons and logo
 * drag-only. The LAYOUTS / rail-cycle / assistant-toggle buttons are intentionally
 * NOT rendered in Phase 1 (UI-SPEC Phase Boundary Note); the spacer absorbs their
 * future space.
 */
export function TitleBar() {
  return (
    <div className={styles.bar}>
      <LogoCluster />
      <div className={styles.spacer} data-tauri-drag-region />
      <WindowControls />
    </div>
  );
}
