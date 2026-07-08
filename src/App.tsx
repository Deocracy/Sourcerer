import { AppShell } from "./app/AppShell";
import styles from "./App.module.css";

/**
 * App — the floating rounded window wrapper (Chrome Rework D-03): an outer
 * full-viewport backdrop (radial gradient + 20px inset, painted against the
 * transparent OS window) around an inner 10px-radius card that holds the
 * actual app chrome. AppShell's internal grid is untouched here — rail/dock
 * plans own that.
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
