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
                    // Undecorated+transparent windows on Windows compute their
                    // maximize rect WITH the invisible WS_THICKFRAME resize
                    // border, leaving a desktop gap on all sides and grabbable
                    // resize edges even when maximized. Drop the frame and
                    // re-maximize so the rect is recomputed without it; the
                    // frame is restored when the window unmaximizes below.
                    ADJUSTING_MAXIMIZE.store(true, Ordering::SeqCst);
                    let _ = window.set_resizable(false);
                    let _ = window.unmaximize();
                    let _ = window.maximize();
                    ADJUSTING_MAXIMIZE.store(false, Ordering::SeqCst);
                    log_window_rect(window, "maximize-kick");
                } else if !maximized && !resizable {
                    let _ = window.set_resizable(true);
                    log_window_rect(window, "restored");
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
