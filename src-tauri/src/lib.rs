mod commands;
mod sidecar;

use sidecar::SidecarProcess;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;

/// Guard against re-entrant Resized events while we kick a maximized window
/// (set_resizable → unmaximize → maximize dispatches WM_SIZE synchronously).
static ADJUSTING_MAXIMIZE: AtomicBool = AtomicBool::new(false);

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
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::ai::host_ai,
            commands::ai::set_modes,
            commands::ai::load_session
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
