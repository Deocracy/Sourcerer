import { shellStore, useShellStore } from "../store/shellStore";
import styles from "./DiviChip.module.css";

/**
 * DiviChip — the title-bar DIVI toggle chip (Chrome Rework). Phase 6
 * (HOME-01/D-04): active/inactive styling and the click handler both drive
 * the single `homeOpen` boolean in `shellStore` — replacing Phase 2's stale
 * rail-applet-name comparison chrome-only placeholder (RESEARCH.md Pitfall
 * 4: never keep a second parallel "is Home showing" signal). Mirrors
 * LogoCluster's `setHomeOpen(true)` wiring.
 */
export function DiviChip() {
  const active = useShellStore((s) => s.homeOpen);

  return (
    <button
      type="button"
      className={active ? `${styles.chip} ${styles.active}` : styles.chip}
      onClick={() => shellStore.getState().toggleHomeOpen()}
    >
      DIVI
    </button>
  );
}
