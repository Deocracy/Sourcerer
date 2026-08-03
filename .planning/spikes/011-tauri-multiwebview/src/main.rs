// Spike 011 — Tauri multiwebview (`unstable` feature) as Sourcerer's pane mechanism.
// Kill-questions: (1) do child webviews render ABOVE a full-size shell webview,
// (2) do logical child bounds align with the shell DOM's CSS pixels (DPI),
// (3) does animated set_position/set_size track without jank/artifacts,
// (4) does the shell webview stay healthy (heartbeat) while children animate.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{thread, time::Duration};
use tauri::{LogicalPosition, LogicalSize, WebviewUrl};

const PANE_A: (f64, f64, f64, f64) = (16., 56., 560., 600.);
const PANE_B: (f64, f64, f64, f64) = (608., 56., 560., 600.);

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = tauri::window::WindowBuilder::new(app, "main")
                .title("spike011 — multiwebview panes")
                .inner_size(1200., 800.)
                .build()?;

            // Shell chrome: full-size local-UI webview, added FIRST (expected bottom of z-order).
            let _shell = window.add_child(
                tauri::webview::WebviewBuilder::new("shell", WebviewUrl::App(Default::default()))
                    .auto_resize(),
                LogicalPosition::new(0., 0.),
                LogicalSize::new(1200., 800.),
            )?;

            // Pane A: external origin #1, positioned exactly over the shell's dashed rect A.
            let pane_a = window.add_child(
                tauri::webview::WebviewBuilder::new(
                    "paneA",
                    WebviewUrl::External("https://example.com".parse().unwrap()),
                ),
                LogicalPosition::new(PANE_A.0, PANE_A.1),
                LogicalSize::new(PANE_A.2, PANE_A.3),
            )?;

            // Pane B: external origin #2 (different origin → different WebView2 renderer expected).
            let _pane_b = window.add_child(
                tauri::webview::WebviewBuilder::new(
                    "paneB",
                    WebviewUrl::External("https://en.wikipedia.org".parse().unwrap()),
                ),
                LogicalPosition::new(PANE_B.0, PANE_B.1),
                LogicalSize::new(PANE_B.2, PANE_B.3),
            )?;

            // Bounds-sync stress: after pages load, orbit pane A (~2s), snap back,
            // then pulse its size (~1s), restore. 60fps-paced updates from a plain thread.
            let a = pane_a.clone();
            thread::spawn(move || {
                thread::sleep(Duration::from_secs(6));
                for i in 0..120u32 {
                    let t = i as f64 / 120.0 * std::f64::consts::TAU;
                    let _ = a.set_position(LogicalPosition::new(
                        PANE_A.0 + t.cos() * 40.0,
                        PANE_A.1 + t.sin() * 24.0,
                    ));
                    thread::sleep(Duration::from_millis(16));
                }
                let _ = a.set_position(LogicalPosition::new(PANE_A.0, PANE_A.1));
                for i in 0..60u32 {
                    let s = 1.0 - 0.2 * ((i as f64 / 60.0 * std::f64::consts::TAU).sin()).abs();
                    let _ = a.set_size(LogicalSize::new(PANE_A.2 * s, PANE_A.3 * s));
                    thread::sleep(Duration::from_millis(16));
                }
                let _ = a.set_size(LogicalSize::new(PANE_A.2, PANE_A.3));
                println!("[spike011] animation leg complete");
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running spike011");
}
