import styles from "./LogoCluster.module.css";

/**
 * LogoCluster — the left cluster of the title bar (SHELL-01):
 * logo mark (15px ring + 5px dot, accent) + "Sourcerer" wordmark +
 * "·" separator + "Home" crumb. The cluster is clickable (openHome) but
 * carries NO data-tauri-drag-region — clicking the logo must fire its
 * handler, not drag the window (T-01-03 / Pitfall 3).
 *
 * openHome is a Phase 1 console-stub: the Home view / workspace does not
 * exist until Phases 2/6, so this deliberately does not block on them.
 */
function openHome() {
  // Phase 1 stub — toggles Home ⇄ last applet once a workspace exists (Phase 2/6).
  console.debug("[Sourcerer] openHome (Phase 1 stub)");
}

export function LogoCluster() {
  return (
    <button type="button" className={styles.cluster} onClick={openHome}>
      <svg
        className={styles.logo}
        width="15"
        height="15"
        viewBox="0 0 15 15"
        aria-hidden="true"
        focusable="false"
      >
        {/* 15px ring, 1.5px stroke, accent — the one permitted border-radius:50% */}
        <circle cx="7.5" cy="7.5" r="6.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
        {/* 5px filled dot, accent */}
        <circle cx="7.5" cy="7.5" r="2.5" fill="currentColor" />
      </svg>
      <span className={styles.wordmark}>Sourcerer</span>
      <span className={styles.separator}>·</span>
      <span className={styles.crumb}>Home</span>
    </button>
  );
}
