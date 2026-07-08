import { AppShell } from "./app/AppShell";
import { useMaximizedState } from "./shell/useMaximizedState";
import styles from "./App.module.css";

/**
 * App — the rounded window card (Chrome Rework D-03, revised 2026-07-07):
 * the app card IS the window. Windowed: 10px rounded corners + 1px border at
 * the true window edge (Tauri transparent:true lets the corner notches show
 * the desktop). Maximized: square edge-to-edge (radius/border collapse; the
 * native WS_THICKFRAME band is dropped in Rust — lib.rs on_window_event).
 *
 * The handoff's original 20px floating-stage inset was cut by user decision
 * (see 02-06-BUG-maximize-halo.md): a transparent margin band around the card
 * read as a dark halo, put resize grips 20px outside the visible edge, and
 * swallowed clicks meant for windows behind.
 */
function App() {
  const isMaximized = useMaximizedState();

  return (
    <div className={isMaximized ? styles.cardMax : styles.card}>
      <AppShell />
    </div>
  );
}

export default App;
