import styles from "./AppShell.module.css";

/**
 * AppShell — the root layout grid (34px title-row / 1fr body).
 * Phase 1 renders empty rows: the title bar (plan 01-02) and the applet body
 * (Phases 2/6) mount into these rows later. No logic, no state (D-02).
 */
export function AppShell() {
  return (
    <div className={styles.shell}>
      <div className={styles.titleRow} />
      <div className={styles.body} />
    </div>
  );
}
