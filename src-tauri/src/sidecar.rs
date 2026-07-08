//! Node Pi sidecar process manager (plan 07-03, Task 1).
//!
//! Spawns and owns the Node sidecar (`sidecar/src/index.ts`) for the app lifetime, pumps
//! its NDJSON stdout by line, and dispatches parsed events to per-request-id listeners
//! registered by Tauri commands (see `commands/ai.rs`). Honest-degrade (D-06) lives one
//! layer up in `commands/ai.rs`; this module only reports write failures as `Err`, it
//! never panics or blocks the caller.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};

use serde_json::Value;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};

/// id -> event sender for whichever `host_ai` invocation is awaiting that request's events.
type ListenerMap = Arc<Mutex<HashMap<String, UnboundedSender<Value>>>>;

/// Managed Tauri state: owns the sidecar child process handle, its stdin writer, and the
/// id-keyed listener registry the stdout pump thread dispatches into.
pub struct SidecarProcess {
    // Held for the app lifetime purely so the child is not dropped (and killed) when
    // `SidecarProcess::spawn` returns; never read directly, but load-bearing via `Drop`.
    #[allow(dead_code)]
    child: Mutex<Option<Child>>,
    stdin: Mutex<Option<ChildStdin>>,
    listeners: ListenerMap,
}

impl SidecarProcess {
    /// Spawn the Node sidecar (dev-spawn per 07-CONTEXT.md discretion; production bundling
    /// is deferred). A spawn failure is logged and yields a `SidecarProcess` with no child —
    /// callers degrade honestly (D-06) rather than the app failing to launch.
    pub fn spawn() -> Self {
        let sidecar_dir = sidecar_dir_path();

        match Command::new("node")
            .arg("--experimental-strip-types")
            .arg("src/index.ts")
            .current_dir(&sidecar_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(mut child) => {
                let stdin = child.stdin.take();
                let stdout = child.stdout.take();
                let stderr = child.stderr.take();
                let listeners: ListenerMap = Arc::new(Mutex::new(HashMap::new()));

                if let Some(stdout) = stdout {
                    let listeners_clone = listeners.clone();
                    std::thread::spawn(move || pump_stdout(stdout, listeners_clone));
                }

                if let Some(stderr) = stderr {
                    std::thread::spawn(move || pump_stderr(stderr));
                }

                Self {
                    child: Mutex::new(Some(child)),
                    stdin: Mutex::new(stdin),
                    listeners,
                }
            }
            Err(err) => {
                // T-07-12 / D-06: never abort app launch on a missing/failed sidecar.
                eprintln!("[sidecar] failed to spawn node process at {sidecar_dir:?}: {err}");
                Self {
                    child: Mutex::new(None),
                    stdin: Mutex::new(None),
                    listeners: Arc::new(Mutex::new(HashMap::new())),
                }
            }
        }
    }

    /// Write one line (a JSON request, without trailing newline) to the sidecar's stdin.
    /// Returns `Err` (never panics) if the child was never spawned, has exited, or the pipe
    /// write fails.
    pub fn write_line(&self, json: &str) -> Result<(), String> {
        let mut guard = self
            .stdin
            .lock()
            .map_err(|_| "sidecar stdin lock poisoned".to_string())?;
        match guard.as_mut() {
            Some(stdin) => {
                writeln!(stdin, "{json}").map_err(|e| format!("sidecar write failed: {e}"))?;
                stdin
                    .flush()
                    .map_err(|e| format!("sidecar flush failed: {e}"))
            }
            None => Err("sidecar process is not running".to_string()),
        }
    }

    /// Write a `{"type":"setModes","modes":[...]}` request line.
    pub fn set_modes_line(&self, modes: &[String]) -> Result<(), String> {
        let payload = serde_json::json!({ "type": "setModes", "modes": modes });
        self.write_line(&payload.to_string())
    }

    /// Register a fresh listener for `id`, returning the receiver a command awaits events on.
    pub fn register(&self, id: &str) -> UnboundedReceiver<Value> {
        let (tx, rx) = tokio::sync::mpsc::unbounded_channel();
        if let Ok(mut map) = self.listeners.lock() {
            map.insert(id.to_string(), tx);
        }
        rx
    }

    /// Remove the listener for `id` once a turn is complete (or degraded).
    pub fn unregister(&self, id: &str) {
        if let Ok(mut map) = self.listeners.lock() {
            map.remove(id);
        }
    }
}

/// Read the sidecar's stdout line by line, parse each as JSON, and dispatch by request id.
/// Malformed lines are skipped defensively (T-07-13); the `ready` boot event has no id and
/// is only logged. Never logs env or key material — only the parsed protocol event shape.
fn pump_stdout(stdout: impl std::io::Read, listeners: ListenerMap) {
    let reader = BufReader::new(stdout);
    for line in reader.lines() {
        let Ok(line) = line else { break };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let parsed: Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(_) => continue, // T-07-13: skip unparseable lines, never crash the pump
        };
        if parsed.get("type").and_then(|t| t.as_str()) == Some("ready") {
            eprintln!("[sidecar] ready");
            continue;
        }
        let Some(id) = parsed.get("id").and_then(|v| v.as_str()) else {
            continue; // T-07-13: ignore events with no/unknown id
        };
        if let Ok(map) = listeners.lock() {
            if let Some(sender) = map.get(id) {
                let _ = sender.send(parsed);
            }
        }
    }
}

/// Diagnostics-only stderr pump. Deliberately never echoes the sidecar's env or arguments —
/// only forwards whatever text the sidecar itself writes to stderr (T-07-11).
fn pump_stderr(stderr: impl std::io::Read) {
    let reader = BufReader::new(stderr);
    for line in reader.lines() {
        let Ok(line) = line else { break };
        eprintln!("[sidecar stderr] {line}");
    }
}

/// Resolve `<repo-root>/sidecar` from the compile-time crate manifest dir, independent of
/// the process's runtime cwd (`cargo run` vs a packaged binary may differ).
fn sidecar_dir_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri has a parent directory (repo root)")
        .join("sidecar")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn absent_sidecar() -> SidecarProcess {
        SidecarProcess {
            child: Mutex::new(None),
            stdin: Mutex::new(None),
            listeners: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    #[test]
    fn write_line_on_absent_child_returns_err_not_panic() {
        let sidecar = absent_sidecar();
        let result = sidecar.write_line(r#"{"type":"prompt"}"#);
        assert!(result.is_err());
    }

    #[test]
    fn set_modes_line_on_absent_child_returns_err() {
        let sidecar = absent_sidecar();
        let result = sidecar.set_modes_line(&["research".to_string()]);
        assert!(result.is_err());
    }

    #[test]
    fn register_then_unregister_removes_listener() {
        let sidecar = absent_sidecar();
        let _rx = sidecar.register("turn-1");
        assert!(sidecar.listeners.lock().unwrap().contains_key("turn-1"));
        sidecar.unregister("turn-1");
        assert!(!sidecar.listeners.lock().unwrap().contains_key("turn-1"));
    }
}
