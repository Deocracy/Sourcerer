import { useShellStore } from "../store/shellStore";
import styles from "./DiviChip.module.css";

/**
 * DiviChip — the title-bar DIVI toggle chip (Chrome Rework). Phase 2 renders
 * this as a chrome-only stub per D-03: active/inactive styling is driven by a
 * store boolean (railApplet === "Home"), but the click handler is a no-op
 * console-stub, NOT wired to any Home overlay — that wiring is Phase 6 scope.
 * Mirrors LogoCluster's openHome stub idiom.
 */
function toggleDivi() {
  // eslint-disable-next-line no-console
  console.log("toggleDivi: no-op stub in Phase 2 (Home overlay not built yet)");
}

export function DiviChip() {
  const active = useShellStore((s) => s.railApplet === "Home");

  return (
    <button
      type="button"
      className={active ? `${styles.chip} ${styles.active}` : styles.chip}
      onClick={toggleDivi}
    >
      DIVI
    </button>
  );
}
