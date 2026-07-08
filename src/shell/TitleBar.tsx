import { LogoCluster } from "./LogoCluster";
import { DiviChip } from "./DiviChip";
import { RailToggleButtons } from "./RailToggleButtons";
import { WindowControls } from "./WindowControls";
import { useShellStore } from "../store/shellStore";
import styles from "./TitleBar.module.css";

/**
 * TitleBar — the 40px custom title bar (SHELL-01/02, Chrome Rework D-03):
 * LogoCluster -> DiviChip -> corpus label -> flex drag-spacer (the ONLY
 * data-tauri-drag-region element, T-02-02) -> RailToggleButtons ->
 * WindowControls. The spacer shrinks as chrome fills in but must remain the
 * sole drag region — no chip or button carries it.
 */
export function TitleBar() {
  const activeCorpus = useShellStore((s) => s.activeCorpus);

  return (
    <div className={styles.titleBar}>
      <LogoCluster />
      <DiviChip />
      <span className={styles.corpus}>— {activeCorpus}</span>
      <div className={styles.spacer} data-tauri-drag-region />
      <RailToggleButtons />
      <WindowControls />
    </div>
  );
}
