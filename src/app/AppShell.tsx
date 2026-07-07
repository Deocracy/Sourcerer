import { TitleBar } from "../shell/TitleBar";
import styles from "./AppShell.module.css";

/**
 * AppShell — the root layout grid (34px title-row / 1fr body).
 * Row 1 mounts the real TitleBar (plan 01-02); the applet body (Phases 2/6)
 * mounts into row 2 later. No logic, no state (D-02).
 */
export function AppShell() {
  return (
    <div className={styles.shell}>
      <TitleBar />
      <div className={styles.body} />
    </div>
  );
}
