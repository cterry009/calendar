//! Task 9.1 scaffold + 9.2 tray. This crate is a thin Tauri 2 shell around the shared
//! `@calendar/web` React UI (Vite): `tauri.conf.json` points `devUrl` at web's dev server and
//! `frontendDist` at its production build, so the desktop app renders the exact same screens as
//! the browser. Desktop-only capabilities (system tray, process/website blocking sidecar, boot
//! autostart) are added as Tauri commands / plugins in tasks 9.2-9.8.

mod blocking;
mod hosts;
mod tray;

use std::sync::Mutex;

/// Minimal command so the frontend <-> Rust bridge is wired and testable from day one
/// (`invoke('app_version')`).
#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(blocking::ProcessBlockingState::default()))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            tray::create(app)?;
            blocking::start_monitor(app.handle());
            hosts::clear_on_startup();
            Ok(())
        })
        // Tray app: closing the window hides it instead of quitting, so the tray (and the
        // pomodoro timer running in the webview) stay alive. "Salir" in the tray menu is the
        // real quit.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            app_version,
            tray::set_tray_state,
            blocking::set_process_blocking,
            hosts::set_website_blocking,
            hosts::request_hosts_access
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
