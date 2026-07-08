import { AppShell } from "./app/AppShell";
import styles from "./App.module.css";

/**
 * App — the floating rounded window wrapper (Chrome Rework D-03): a transparent
 * 20px backdrop margin (the desktop shows through the Tauri transparent window)
 * around a 10px-radius card. AppShell owns the card interior grid — including
 * the full-width title bar and the right-rail AssistantPanel.
 */
function App() {
  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <AppShell />
      </div>
    </div>
  );
}

export default App;
