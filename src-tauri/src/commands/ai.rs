//! `host_ai` + `set_modes` Tauri commands (plan 07-03, Task 2).
//!
//! `host_ai` is the real backend behind the webview's `host.ai()` seam (D-01): it writes a
//! `prompt` request to the sidecar's stdin, then relays every sidecar event carrying that
//! request's id to the Tauri Channel verbatim, until `done`. If the sidecar is unavailable
//! or a turn gets stuck, it degrades honestly (D-06): exactly one `error` event followed by
//! one `done` event over the Channel, and `Ok(())` — never an `Err` the webview would throw
//! on, never a hang.

use std::time::Duration;

use serde_json::{json, Value};
use tauri::ipc::Channel;
use tauri::State;

use crate::sidecar::SidecarProcess;

/// Bounded per-turn wait so a stuck sidecar can never hang a turn forever (D-06 / T-07-12).
const TURN_TIMEOUT: Duration = Duration::from_secs(120);

#[tauri::command]
pub async fn host_ai(
    message: String,
    session_id: String,
    modes: Vec<String>,
    on_event: Channel<Value>,
    sidecar: State<'_, SidecarProcess>,
) -> Result<(), String> {
    let id = fresh_request_id();

    let prompt = json!({
        "type": "prompt",
        "id": id,
        "sessionId": session_id,
        "message": message,
        "modes": modes,
    });

    let mut rx = sidecar.register(&id);

    if let Err(err) = sidecar.write_line(&prompt.to_string()) {
        sidecar.unregister(&id);
        return send_degrade(&on_event, &id, &format!("assistant backend unavailable: {err}"));
    }

    loop {
        match tokio::time::timeout(TURN_TIMEOUT, rx.recv()).await {
            Ok(Some(event)) => {
                let is_done = event.get("type").and_then(|t| t.as_str()) == Some("done");
                let _ = on_event.send(event);
                if is_done {
                    break;
                }
            }
            Ok(None) => {
                // Listener channel closed before a `done` arrived (e.g. sidecar died mid-turn).
                sidecar.unregister(&id);
                return send_degrade(&on_event, &id, "assistant backend unavailable");
            }
            Err(_) => {
                // Timed out waiting on this turn — bounded-DoS guard (T-07-12).
                sidecar.unregister(&id);
                return send_degrade(&on_event, &id, "assistant backend timed out");
            }
        }
    }

    sidecar.unregister(&id);
    Ok(())
}

#[tauri::command]
pub fn set_modes(modes: Vec<String>, sidecar: State<'_, SidecarProcess>) -> Result<(), String> {
    sidecar.set_modes_line(&modes)
}

/// Pure event-construction helper for D-06 honest-degrade: always exactly one `error` event
/// followed by one `done` event, both carrying the turn's request id. Split out from
/// `send_degrade` so the shape is unit-testable without a live Tauri `Channel`.
fn degrade_events(id: &str, message: &str) -> [Value; 2] {
    [
        json!({ "type": "error", "id": id, "message": message }),
        json!({ "type": "done", "id": id }),
    ]
}

fn send_degrade(on_event: &Channel<Value>, id: &str, message: &str) -> Result<(), String> {
    for event in degrade_events(id, message) {
        let _ = on_event.send(event);
    }
    Ok(())
}

fn fresh_request_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("turn-{nanos}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn degrade_events_yields_exactly_one_error_then_one_done() {
        let events = degrade_events("turn-test", "assistant backend unavailable");

        assert_eq!(events.len(), 2);

        assert_eq!(events[0]["type"], "error");
        assert_eq!(events[0]["id"], "turn-test");
        assert_eq!(events[0]["message"], "assistant backend unavailable");

        assert_eq!(events[1]["type"], "done");
        assert_eq!(events[1]["id"], "turn-test");
    }
}
