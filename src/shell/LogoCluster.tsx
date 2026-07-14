import { shellStore } from "../store/shellStore";
import styles from "./LogoCluster.module.css";

/**
 * LogoCluster — logo mark (ring + dot) + "Sourcerer" wordmark + "·" + "Home" crumb.
 * The primary focal point of the title bar (UI-SPEC Color section). Clicking the
 * cluster opens the Home overlay (Phase 6, HOME-01/D-04) — replaces the Phase 1
 * console-stub with the same `shellStore` action `DiviChip`'s toggle uses, so both
 * entry points drive the one `homeOpen` boolean (RESEARCH.md Pitfall 4).
 * Does NOT carry data-tauri-drag-region — TitleBar puts that on the spacer only (T-01-03).
 */
function openHome() {
  shellStore.getState().setHomeOpen(true);
}

export function LogoCluster() {
  return (
    <div className={styles.cluster} onClick={openHome}>
      <svg
        className={styles.logo}
        width="15"
        height="15"
        viewBox="0 0 15 15"
        aria-hidden="true"
      >
        <circle
          cx="7.5"
          cy="7.5"
          r="6.75"
          fill="none"
          stroke="var(--color-fg)"
          strokeWidth="1.5"
        />
        <circle cx="7.5" cy="7.5" r="2.5" fill="var(--color-fg)" />
      </svg>
      <span className={styles.wordmark}>Sourcerer</span>
      <span className={styles.separator}>·</span>
      <span className={styles.crumb}>Home</span>
    </div>
  );
}
