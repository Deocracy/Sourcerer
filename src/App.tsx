import { AppShell } from "./app/AppShell";
import { AssistantPanel } from "./assistant/AssistantPanel";
import styles from "./App.module.css";

/**
 * App — the floating rounded window wrapper (Chrome Rework D-03): an outer
 * full-viewport backdrop (radial gradient + 20px inset, painted against the
 * transparent OS window) around an inner 10px-radius card that holds the
 * actual app chrome. AppShell's internal grid is untouched here — rail/dock
 * plans own that. AssistantPanel mounts alongside AppShell as a minimal
 * right-rail placement (D-01, plan 07-04); full rail/dock integration is
 * Phase 2/6 — here it only needs to render and stream.
 */
function App() {
  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <div className={styles.shellRow}>
          <div className={styles.shellMain}>
            <AppShell />
          </div>
          <AssistantPanel />
        </div>
      </div>
    </div>
  );
}

export default App;
