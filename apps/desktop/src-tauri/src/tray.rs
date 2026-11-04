//! Task 9.2 -- system tray with pomodoro quick controls.
//!
//! The pomodoro state machine lives in the shared web frontend (`apps/web`'s
//! `PomodoroContext`), not here, so this is a thin bridge:
//!   - tray menu click  -> `app.emit("tray://pomodoro", "<action>")` -> the frontend's
//!     `DesktopTrayBridge` calls `usePomodoro().start()` / `.cancel()` / `.reset()`.
//!   - frontend state change -> `invoke("set_tray_state", { statusLabel, tooltip })` -> this
//!     updates the greyed status line in the menu and the tray tooltip.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Emitter, Manager, Wry,
};

use crate::commitment::CommitmentState;

/// Kept in managed state so `set_tray_state` can update the status line without rebuilding the
/// whole menu every second while a pomodoro runs.
pub struct TrayHandles {
    status: MenuItem<Wry>,
    quit: MenuItem<Wry>,
}

pub fn create(app: &App) -> tauri::Result<()> {
    let status = MenuItem::with_id(app, "pomo_status", "Pomodoro inactivo", false, None::<&str>)?;
    let start = MenuItem::with_id(app, "pomo_start", "Iniciar enfoque", true, None::<&str>)?;
    let cancel = MenuItem::with_id(app, "pomo_cancel", "Cancelar", true, None::<&str>)?;
    let reset = MenuItem::with_id(app, "pomo_reset", "Reiniciar", true, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "Abrir ventana", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &status,
            &PredefinedMenuItem::separator(app)?,
            &start,
            &cancel,
            &reset,
            &PredefinedMenuItem::separator(app)?,
            &show,
            &quit,
        ],
    )?;

    app.manage(TrayHandles {
        status: status.clone(),
        quit: quit.clone(),
    });

    let icon = app
        .default_window_icon()
        .cloned()
        .expect("bundled default window icon");

    TrayIconBuilder::with_id("main")
        .icon(icon)
        .tooltip("Calendar Productivity")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            log::info!("tray menu event: {}", event.id.as_ref());
            match event.id.as_ref() {
                "pomo_start" => {
                    let _ = app.emit("tray://pomodoro", "start");
                }
                "pomo_cancel" => {
                    let _ = app.emit("tray://pomodoro", "cancel");
                }
                "pomo_reset" => {
                    let _ = app.emit("tray://pomodoro", "reset");
                }
                "show" => show_main(app),
                // The item is greyed out during a block commitment; this is the backstop.
                "quit" if !app.state::<CommitmentState>().is_active() => app.exit(0),
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

/// Off while a block commitment lasts (commitment.rs).
pub fn set_quit_allowed(app: &AppHandle, allowed: bool) {
    if let Some(handles) = app.try_state::<TrayHandles>() {
        let _ = handles.quit.set_enabled(allowed);
        let _ = handles.quit.set_text(if allowed { "Salir" } else { "Salir (compromiso activo)" });
    }
}

/// Show + focus the main window (from a tray click or the "Abrir ventana" item). The window is
/// only hidden, never destroyed, on close (see `lib.rs`'s window-event handler), so it's always
/// there to re-show.
pub fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[tauri::command]
pub fn set_tray_state(app: AppHandle, status_label: String, tooltip: String) {
    log::info!("set_tray_state: {status_label}");
    if let Some(handles) = app.try_state::<TrayHandles>() {
        let _ = handles.status.set_text(&status_label);
    }
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(&tooltip));
    }
}
