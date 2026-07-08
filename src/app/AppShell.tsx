import { TitleBar } from "../shell/TitleBar";
import { AssistantPanel } from "../assistant/AssistantPanel";
import styles from "./AppShell.module.css";

/**
 * AppShell — the card interior grid (40px title-row / 1fr body), per the
 * bespoke_rails_shell handoff.
 * Row 1: the full-width TitleBar — window controls sit at the card's top-right corner.
 * Row 2: the body — a flex row of the main workspace column (rail mounts in plan
 * 02-04, dockview in 02-05) and the right-rail AssistantPanel.
 *
 * Layout ownership: this file (Phase 02) owns WHERE things go inside the card.
 * AssistantPanel's internals are Phase 07's; it is mounted here into the
 * right-rail slot so the title bar can span the full card width above it.
 */
export function AppShell() {
  return (
    <div className={styles.shell}>
      <TitleBar />
      <div className={styles.body}>
        <div className={styles.main} />
        <AssistantPanel />
      </div>
    </div>
  );
}
