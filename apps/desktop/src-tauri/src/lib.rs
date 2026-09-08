//! Task 9.1 scaffold. This crate is a thin Tauri 2 shell around the shared `@calendar/web`
//! React UI (Vite): `tauri.conf.json` points `devUrl` at web's dev server and `frontendDist`
//! at its production build, so the desktop app renders the exact same screens as the browser.
//! Desktop-only capabilities (system tray, process/website blocking sidecar, boot autostart)
//! are added as Tauri commands / plugins in tasks 9.2-9.8.

/// Minimal command so the frontend <-> Rust bridge is wired and testable from day one
/// (`invoke('app_version')`). Real desktop commands land in 9.2+.
#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![app_version])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
