mod commands;
mod sidecar;

use sidecar::SidecarProcess;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager};

/// Guard against re-entrant Resized events while we kick a maximized window
/// (set_resizable → unmaximize → maximize dispatches WM_SIZE synchronously).
static ADJUSTING_MAXIMIZE: AtomicBool = AtomicBool::new(false);

/// PERS-04 close-flush guard: the CloseRequested arm below intercepts the
/// FIRST close attempt (prevent_close + ask the frontend to flush). Once the
/// frontend has flushed and called `confirm_close`, this flips true and the
/// window's own `.close()` re-fires CloseRequested a second time — this guard
/// lets that second, already-confirmed attempt through instead of looping
/// forever (RESEARCH.md Pattern 3 / Open Question 2).
static CLOSE_CONFIRMED: AtomicBool = AtomicBool::new(false);

/// Frontend calls this (via `workspace:flush-before-close` → flushPendingSave
/// → invoke("confirm_close")) once the pending debounced write has been
/// force-flushed to disk. Flips the guard then actually closes the window —
/// this second `.close()` re-enters `on_window_event`'s CloseRequested arm,
/// which now sees `CLOSE_CONFIRMED == true` and lets it proceed instead of
/// preventing it again.
#[tauri::command]
fn confirm_close(window: tauri::Window) {
    CLOSE_CONFIRMED.store(true, Ordering::SeqCst);
    let _ = window.close();
}

fn log_window_rect(window: &tauri::Window, tag: &str) {
    if let (Ok(pos), Ok(size)) = (window.outer_position(), window.outer_size()) {
        let mon = window
            .current_monitor()
            .ok()
            .flatten()
            .map(|m| format!("{}x{}", m.size().width, m.size().height))
            .unwrap_or_else(|| "?".into());
        println!(
            "[win] {tag}: pos=({}, {}) size={}x{} monitor={mon}",
            pos.x, pos.y, size.width, size.height
        );
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Resized(_) = event {
                if ADJUSTING_MAXIMIZE.load(Ordering::SeqCst) {
                    return;
                }
                let maximized = window.is_maximized().unwrap_or(false);
                let resizable = window.is_resizable().unwrap_or(true);
                if maximized && resizable {
                    // Undecorated+transparent windows keep an invisible
                    // WS_THICKFRAME band at the window edge even when
                    // maximized: an ~8px strip the webview does not paint
                    // (transparent -> desktop shows through) that hit-tests
                    // as a resize handle. Dropping the frame IN PLACE expands
                    // the client area over the strip and kills the grip.
                    // Do NOT unmaximize/re-maximize here: tao's maximize()
                    // no-ops on non-resizable windows, which breaks the
                    // native maximized state entirely.
                    ADJUSTING_MAXIMIZE.store(true, Ordering::SeqCst);
                    let _ = window.set_resizable(false);
                    ADJUSTING_MAXIMIZE.store(false, Ordering::SeqCst);
                    log_window_rect(window, "maximized: frame dropped");
                } else if !maximized && !resizable {
                    let _ = window.set_resizable(true);
                    log_window_rect(window, "restored: frame back");
                }
            } else if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // PERS-04: flush the pending debounced workspace write before
                // the window actually closes (no unsaved-window race on a
                // graceful close). The frontend owns the actual save (it is
                // the sole flush authority — RESEARCH.md Pitfall 1); this arm
                // only blocks the close and asks it to run.
                if CLOSE_CONFIRMED.load(Ordering::SeqCst) {
                    // Frontend already flushed and asked us to close for
                    // real via confirm_close — let this second, re-entrant
                    // CloseRequested proceed instead of blocking again.
                    return;
                }
                api.prevent_close();
                let _ = window.emit("workspace:flush-before-close", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::ai::host_ai,
            commands::ai::set_modes,
            commands::ai::load_session,
            confirm_close
        ])
        .setup(|app| {
            // Spawn + own the Node Pi sidecar for the app lifetime. A spawn failure is
            // logged inside `SidecarProcess::spawn` and does NOT abort launch — the shell
            // still runs and `host_ai` degrades honestly (D-06) when the backend is absent.
            app.manage(SidecarProcess::spawn());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
