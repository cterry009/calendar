//! The block's pomodoro over everything (user-requested, 2026-10-06): at the start of a WORK block
//! and when the user comes back to the PC, the web UI shows its pomodoro card (BlockFocusOverlay)
//! and asks for the window to come to the front, above other apps, until it's answered ("Seguir
//! trabajando" or "Salir"). `idle_seconds` lets the UI notice the user coming back.

use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn focus_overlay(app: AppHandle, show: bool) {
    let Some(window) = app.get_window("main") else {
        return;
    };
    if show {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_always_on_top(true);
        let _ = window.set_focus();
    } else {
        let _ = window.set_always_on_top(false);
    }
}

/// Seconds since the last keyboard/mouse input anywhere on the system.
#[tauri::command]
pub fn idle_seconds() -> u64 {
    crate::app_tracking::idle_duration().as_secs()
}
