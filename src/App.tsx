import { AppShell } from "./app/AppShell";
import { useMaximizedState } from "./shell/useMaximizedState";
import styles from "./App.module.css";

/**
 * App — the floating rounded window wrapper (Chrome Rework D-03): a transparent
 * 20px backdrop margin (the desktop shows through the Tauri transparent window)
 * around a 10px-radius card. When the window is maximized the float treatment
 * collapses (no inset, no radius, no border/shadow) so the app is true
 * edge-to-edge — the floating card is a windowed-mode-only affordance.
 * AppShell owns the card interior grid.
 */
function App() {
  const isMaximized = useMaximizedState();

  return (
    <div className={isMaximized ? styles.backdropMax : styles.backdrop}>
      <div className={isMaximized ? styles.cardMax : styles.card}>
        <AppShell />
      </div>
    </div>
  );
}

export default App;
