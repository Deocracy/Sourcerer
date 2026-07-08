mod commands;
mod sidecar;

use sidecar::SidecarProcess;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::ai::host_ai,
            commands::ai::set_modes
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
