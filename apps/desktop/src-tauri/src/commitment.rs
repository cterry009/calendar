//! The block commitment on the PC (weekend-mode, user 2026-11-04: "que no se pueda cerrar la
//! aplicación"). The server owns it; `DesktopCommitmentBridge` tells this side when it starts and
//! ends. While it lasts: the tray's "Salir" is off, and a scheduled task relaunches the app within a
//! minute if it's killed from the Task Manager. Start with Windows is forced from the frontend (the
//! autostart plugin). An administrator can still get around it; it's for self-control.
//!
//! Only in release builds: a debug exe needs Vite running, relaunching it would show a blank window.

use std::path::Path;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Manager, State};

use crate::tray;

const TASK_NAME: &str = "CalendarProductivityWatchdog";
/// No console flashing up for schtasks.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Default)]
pub struct CommitmentState {
    active: AtomicBool,
}

impl CommitmentState {
    pub fn is_active(&self) -> bool {
        self.active.load(Ordering::SeqCst)
    }
}

/// Starts the app only when it isn't running: there's no single-instance plugin, and the task fires
/// every minute. A .vbs through wscript because it shows no window at all.
fn watchdog_script(exe: &Path) -> String {
    let path = exe.to_string_lossy();
    let name = exe.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    format!(
        "Set wmi = GetObject(\"winmgmts:\\\\.\\root\\cimv2\")\r\n\
         Set found = wmi.ExecQuery(\"SELECT ProcessId FROM Win32_Process WHERE Name = '{name}'\")\r\n\
         If found.Count = 0 Then CreateObject(\"WScript.Shell\").Run \"\"\"{path}\"\" --minimized\", 1, False\r\n"
    )
}

fn schtasks(args: &[&str]) -> bool {
    let mut command = Command::new("schtasks");
    command.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command.status().map(|status| status.success()).unwrap_or(false)
}

fn install_watchdog(app: &AppHandle) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let script = dir.join("watchdog.vbs");
    std::fs::write(&script, watchdog_script(&exe)).map_err(|e| e.to_string())?;
    let run = format!("wscript.exe \"{}\"", script.to_string_lossy());
    if schtasks(&["/Create", "/F", "/SC", "MINUTE", "/MO", "1", "/TN", TASK_NAME, "/TR", &run]) {
        Ok(())
    } else {
        Err("schtasks /Create failed".into())
    }
}

fn remove_watchdog() {
    // Fails harmlessly when there's no such task.
    schtasks(&["/Delete", "/F", "/TN", TASK_NAME]);
}

#[tauri::command]
pub fn set_commitment(app: AppHandle, state: State<'_, CommitmentState>, active: bool) {
    state.active.store(active, Ordering::SeqCst);
    tray::set_quit_allowed(&app, !active);
    if cfg!(debug_assertions) {
        return;
    }
    if active {
        // Every start, not only on change: the task may have been deleted by hand.
        if let Err(error) = install_watchdog(&app) {
            log::warn!("commitment watchdog: {error}");
        }
    } else {
        // Also on a start after it ended, so the task never outlives the commitment.
        remove_watchdog();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn script_looks_for_the_exe_and_relaunches_it_minimized() {
        let script = watchdog_script(Path::new("C:\\Apps\\Calendar Productivity\\calendar-desktop.exe"));
        assert!(script.contains("Name = 'calendar-desktop.exe'"));
        assert!(script.contains("\"\"C:\\Apps\\Calendar Productivity\\calendar-desktop.exe\"\" --minimized"));
    }
}
