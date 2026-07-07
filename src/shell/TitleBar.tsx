import { LogoCluster } from "./LogoCluster";
import { WindowControls } from "./WindowControls";
import styles from "./TitleBar.module.css";

/**
 * TitleBar — the 34px custom title bar (SHELL-01/02): LogoCluster (left) ->
 * flex drag-spacer (the ONLY data-tauri-drag-region element, T-01-03) -> WindowControls
 * (right). Per UI-SPEC Phase Boundary Note, the LAYOUTS menu / rail-cycle / assistant-
 * toggle buttons are NOT rendered here — the spacer's flex-basis absorbs their future
 * space until Phases 2/3/6 add them.
 */
export function TitleBar() {
  return (
    <div className={styles.titleBar}>
      <LogoCluster />
      <div className={styles.spacer} data-tauri-drag-region />
      <WindowControls />
    </div>
  );
}
