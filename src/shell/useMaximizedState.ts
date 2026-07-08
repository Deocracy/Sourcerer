import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * useMaximizedState — tracks the real maximized state of the window (D-02, no store).
 *
 * Maximize can be triggered by means other than our custom button (title-bar
 * double-click, OS shortcuts, Aero Snap), and the dedicated maximize/unmaximize
 * events are not reliably reported standalone (Pitfall 4 / RESEARCH Pattern 2).
 * So instead of trusting a click toggle or a single event, we re-query
 * isMaximized() on every onResized event. No Zustand, no global store.
 *
 * Responses are sequenced: the Rust maximize-kick (lib.rs) emits a rapid burst
 * of Resized events (maximize → unmaximize → maximize), and the async
 * isMaximized() answers can resolve out of order — a stale transient `false`
 * landing after the final `true` would leave the CSS in windowed mode on a
 * maximized window. Only the newest query's answer is allowed to win.
 */
export function useMaximizedState(): boolean {
  const [isMax, setIsMax] = useState(false);

  useEffect(() => {
    let active = true;
    let seq = 0;

    // Guard the whole subscription: outside a live/mocked Tauri IPC context
    // getCurrentWindow()/isMaximized() throw — degrade silently rather than
    // surface an error for native chrome (UI-SPEC Error state).
    try {
      const appWindow = getCurrentWindow();

      const refresh = () => {
        const mySeq = ++seq;
        appWindow
          .isMaximized()
          .then((v) => {
            // Drop stale answers: only the latest issued query may set state.
            if (active && mySeq === seq) setIsMax(v);
          })
          .catch(console.error);
      };

      refresh();
      const unlisten = appWindow.onResized(refresh);

      return () => {
        active = false;
        unlisten.then((f) => f()).catch(console.error);
      };
    } catch (err) {
      console.error(err);
      return () => {
        active = false;
      };
    }
  }, []);

  return isMax;
}
