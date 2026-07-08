import { TitleBar } from "../shell/TitleBar";
import { Rail } from "../shell/Rail";
import { Dock } from "../shell/Dock";
import { AssistantPanel } from "../assistant/AssistantPanel";
import styles from "./AppShell.module.css";

/**
 * AppShell — the card interior grid (40px title-row / 1fr body), per the
 * bespoke_rails_shell handoff.
 * Row 1: the full-width TitleBar — window controls sit at the card's top-right corner.
 * Row 2: the body — a flex row of [left rail | main workspace column | right-rail
 * AssistantPanel]. Rail (plan 02-04) sizes itself from the shell store; the
 * dock (plan 02-05) mounts into `.main`.
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
        <Rail />
        <div className={styles.main}>
          <Dock />
        </div>
        <AssistantPanel />
      </div>
    </div>
  );
}
