//! Task 9.3 -- desktop process blocking. The Windows counterpart of Android's
//! FocusBlockAccessibilityService (task 6.6): while a focus/work session is active, any running
//! process whose name matches a configured `DESKTOP_APP` block-list entry is terminated.
//!
//! Implemented as an in-process background thread rather than a true Tauri "sidecar" binary: on
//! Windows, `TerminateProcess` on same-user processes needs no elevation, so a separate elevated
//! executable would be extra plumbing for no capability gain. If a future need (a system service,
//! per-machine enforcement) requires it, this module is the seam to split out.
//!
//! The frontend (apps/web's `DesktopBlockingBridge`) pushes the current state via
//! `set_process_blocking(active, blocked)` on every change to the pomodoro/work-hours trigger or
//! the block list -- same "JS owns the policy, Rust enforces" split as the tray (9.2) and all of
//! the Android native modules.

use std::{
    collections::HashMap,
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};

use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System};
use tauri::{AppHandle, Emitter, Manager, State};

const POLL_INTERVAL: Duration = Duration::from_secs(2);
/// Don't re-log / re-emit for the same app more than this often (it's still killed every cycle if
/// it keeps relaunching -- this only throttles the notification noise).
const NOTIFY_COOLDOWN: Duration = Duration::from_secs(6);

/// Never terminated even if the user somehow lists them -- killing these would break the session
/// or the OS. Matched case-insensitively against the process name.
const CRITICAL_DENYLIST: &[&str] = &[
    "system",
    "registry",
    "explorer.exe",
    "winlogon.exe",
    "csrss.exe",
    "wininit.exe",
    "services.exe",
    "lsass.exe",
    "smss.exe",
    "svchost.exe",
    "dwm.exe",
    "calendar-desktop.exe",
    "calendar productivity.exe",
];

#[derive(Default)]
pub struct ProcessBlockingState {
    active: bool,
    /// Lowercased identifiers as entered by the user (e.g. "chrome.exe" or "chrome").
    blocked: Vec<String>,
}

#[tauri::command]
pub fn set_process_blocking(
    state: State<'_, Mutex<ProcessBlockingState>>,
    active: bool,
    blocked: Vec<String>,
) {
    let mut guard = state.lock().unwrap();
    guard.active = active;
    guard.blocked = blocked
        .into_iter()
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect();
    log::info!(
        "set_process_blocking: active={} blocked={:?}",
        guard.active,
        guard.blocked
    );
}

/// True when `proc_name` (a process's file name, e.g. "chrome.exe") should be blocked given a
/// user-entered `ident` ("chrome.exe" or "chrome", already lowercased).
fn name_matches(proc_name_lower: &str, ident: &str) -> bool {
    if proc_name_lower == ident {
        return true;
    }
    let stem = proc_name_lower.strip_suffix(".exe").unwrap_or(proc_name_lower);
    stem == ident || format!("{ident}.exe") == proc_name_lower
}

pub fn start_monitor(app: &AppHandle) {
    let app = app.clone();
    thread::Builder::new()
        .name("process-blocker".into())
        .spawn(move || {
            let self_pid = std::process::id();
            let mut sys = System::new();
            let mut last_notified: HashMap<String, Instant> = HashMap::new();

            loop {
                thread::sleep(POLL_INTERVAL);

                let (active, blocked) = {
                    let state = app.state::<Mutex<ProcessBlockingState>>();
                    let guard = state.lock().unwrap();
                    (guard.active, guard.blocked.clone())
                };
                if !active || blocked.is_empty() {
                    continue;
                }

                sys.refresh_processes_specifics(
                    ProcessesToUpdate::All,
                    true,
                    ProcessRefreshKind::nothing(),
                );

                for (pid, process) in sys.processes() {
                    if pid.as_u32() == self_pid {
                        continue;
                    }
                    let name_lower = process.name().to_string_lossy().to_lowercase();
                    if name_lower.is_empty() || CRITICAL_DENYLIST.contains(&name_lower.as_str()) {
                        continue;
                    }
                    if !blocked.iter().any(|ident| name_matches(&name_lower, ident)) {
                        continue;
                    }

                    let killed = process.kill();
                    let recently = last_notified
                        .get(&name_lower)
                        .is_some_and(|t| t.elapsed() < NOTIFY_COOLDOWN);
                    if !recently {
                        last_notified.insert(name_lower.clone(), Instant::now());
                        log::info!("process blocked: {name_lower} (pid {pid}, killed={killed})");
                        // Consumed by the frontend to show the 9.6 "blocked" overlay.
                        let _ = app.emit("process-blocked", name_lower.clone());
                    }
                }

                // Keep the cooldown map from growing without bound.
                last_notified.retain(|_, t| t.elapsed() < NOTIFY_COOLDOWN * 4);
            }
        })
        .expect("spawn process-blocker thread");
}
