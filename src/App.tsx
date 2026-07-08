import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
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

  // Windows keeps an invisible WS_THICKFRAME resize edge on undecorated
  // resizable windows — visible as a thin border line and grabbable for
  // resize even while maximized. Drop resizability while maximized (restore
  // when windowed) so maximize is truly edge-to-edge with no grab zone.
  // try/catch: outside a live Tauri context (vitest) this degrades silently.
  useEffect(() => {
    try {
      getCurrentWindow().setResizable(!isMaximized).catch(console.error);
    } catch (err) {
      console.error(err);
    }
  }, [isMaximized]);

  return (
    <div className={isMaximized ? styles.backdropMax : styles.backdrop}>
      <div className={isMaximized ? styles.cardMax : styles.card}>
        <AppShell />
      </div>
    </div>
  );
}

export default App;
