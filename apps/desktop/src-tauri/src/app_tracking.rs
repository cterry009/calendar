//! Windows per-application foreground time tracking -- "how long did I actually use each app
//! today". The generic counterpart of `game_tracking.rs` and the desktop counterpart of Android's
//! screen-time module (`apps/mobile/modules/screen-time`), following the same shape the rest of
//! this crate uses: a background poller reading OS state, pure logic split out from I/O so it's
//! unit-testable, and state handed to the frontend through a `#[tauri::command]` instead of Rust
//! pushing to the server itself -- the same "JS syncs, Rust just observes" split `blocking.rs`
//! uses for policy.
//!
//! **Foreground window, not running processes.** This is the one design difference from
//! `game_tracking.rs`. A game's process existing means you are playing it, so that module counts
//! running processes. The reasoning does not carry over to ordinary apps: Chrome sitting open
//! behind everything else for eight hours is not eight hours of Chrome. So each tick attributes
//! its elapsed time to exactly one app -- whichever owns the foreground window
//! (`GetForegroundWindow` -> `GetWindowThreadProcessId` -> process name via the same `sysinfo`
//! enumeration `blocking.rs` already depends on).
//!
//! **Idle time is not counted.** `GetLastInputInfo` gives the age of the last keyboard/mouse
//! input; past `IDLE_THRESHOLD` the tick is dropped entirely, so walking away from the desk with a
//! window focused doesn't bill hours to whatever happened to be on screen.
//!
//! **Overlapping with `game_tracking.rs` is intentional.** A Steam game in the foreground is
//! counted both here and there. The two rollups answer different questions (active foreground use
//! vs. game running at all) and live in different tables, so they must never be summed into a
//! single "total time" -- see the `DailyDesktopAppTime` doc comment in schema.prisma.
//!
//! Only the process name is ever read -- never the window title, which would leak document names
//! and browser tab contents into the sync pipeline. Display names come from a curated exe -> label
//! table with a prettified-exe fallback, the same "curated list, not perfect" tradeoff already
//! accepted for `KNOWN_GAME_PROCESSES` and Android's `distractingApps.ts`.
//!
//! State accumulates in memory (seconds per app today) and is persisted to a small JSON file in
//! the app's data dir every tick, so a restart mid-day resumes instead of losing progress.

use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
use tauri::{AppHandle, Manager, State};
use windows_sys::Win32::System::SystemInformation::GetTickCount;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
use windows_sys::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

const POLL_INTERVAL: Duration = Duration::from_secs(5);
/// Caps how much elapsed time a single tick can attribute -- guards against a sleep/resume or a
/// debugger-paused gap between ticks being miscounted as active use.
const MAX_TICK_GAP: Duration = Duration::from_secs(30);
/// No keyboard/mouse input for this long means the user walked away; ticks stop counting until
/// input resumes. Deliberately longer than a typical reading pause but shorter than a coffee break.
const IDLE_THRESHOLD: Duration = Duration::from_secs(90);
const STATE_FILE_NAME: &str = "app_time_state.json";

/// Curated exe -> display name. Anything not listed falls back to `prettify_exe_name`, so this
/// table only needs to cover the cases where that fallback reads badly ("Msedge", "Powerpnt").
const KNOWN_APP_LABELS: &[(&str, &str)] = &[
    ("chrome.exe", "Google Chrome"),
    ("msedge.exe", "Microsoft Edge"),
    ("firefox.exe", "Firefox"),
    ("brave.exe", "Brave"),
    ("opera.exe", "Opera"),
    ("code.exe", "Visual Studio Code"),
    ("devenv.exe", "Visual Studio"),
    ("idea64.exe", "IntelliJ IDEA"),
    ("pycharm64.exe", "PyCharm"),
    ("webstorm64.exe", "WebStorm"),
    ("rider64.exe", "Rider"),
    ("windowsterminal.exe", "Windows Terminal"),
    ("powershell.exe", "PowerShell"),
    ("cmd.exe", "Símbolo del sistema"),
    ("explorer.exe", "Explorador de archivos"),
    ("discord.exe", "Discord"),
    ("slack.exe", "Slack"),
    ("ms-teams.exe", "Microsoft Teams"),
    ("teams.exe", "Microsoft Teams"),
    ("zoom.exe", "Zoom"),
    ("whatsapp.exe", "WhatsApp"),
    ("telegram.exe", "Telegram"),
    ("unigram.exe", "Telegram"),
    ("spotify.exe", "Spotify"),
    ("vlc.exe", "VLC"),
    ("notion.exe", "Notion"),
    ("obsidian.exe", "Obsidian"),
    ("figma.exe", "Figma"),
    ("photoshop.exe", "Photoshop"),
    ("illustrator.exe", "Illustrator"),
    ("acrobat.exe", "Adobe Acrobat"),
    ("outlook.exe", "Outlook"),
    ("winword.exe", "Word"),
    ("excel.exe", "Excel"),
    ("powerpnt.exe", "PowerPoint"),
    ("onenote.exe", "OneNote"),
    ("steam.exe", "Steam"),
    ("epicgameslauncher.exe", "Epic Games Launcher"),
    ("battle.net.exe", "Battle.net"),
    ("riotclientservices.exe", "Riot Client"),
    ("calendar-desktop.exe", "Calendar Productivity"),
    ("calendar productivity.exe", "Calendar Productivity"),
];

#[derive(Default, Serialize, Deserialize, Clone)]
pub struct AppTimeEntry {
    pub label: String,
    pub seconds: u64,
}

#[derive(Default, Serialize, Deserialize)]
pub struct AppTrackingState {
    /// Local YYYY-MM-DD this accumulator belongs to -- a fresh day resets `entries`.
    pub date: String,
    /// Keyed by lowercased exe name, the same identifier shape `blocking.rs` matches block-list
    /// `DESKTOP_APP` entries against, so a "block this app" suggestion can be built from a row here.
    pub entries: HashMap<String, AppTimeEntry>,
}

#[derive(Serialize)]
pub struct AppTimeEntryDto {
    key: String,
    label: String,
    minutes: u64,
}

#[tauri::command]
pub fn get_app_time_today(state: State<'_, Mutex<AppTrackingState>>) -> Vec<AppTimeEntryDto> {
    let guard = state.lock().unwrap();
    guard
        .entries
        .iter()
        .map(|(key, entry)| AppTimeEntryDto {
            key: key.clone(),
            label: entry.label.clone(),
            minutes: entry.seconds / 60,
        })
        .collect()
}

fn local_date_key() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

/// `chrome.exe` -> `Google Chrome`, `some-tool.exe` -> `Some Tool`. Pure so the fallback's
/// edge cases are testable without a running desktop.
fn friendly_label(exe_lower: &str) -> String {
    if let Some((_, label)) = KNOWN_APP_LABELS.iter().find(|(exe, _)| *exe == exe_lower) {
        return (*label).to_string();
    }
    prettify_exe_name(exe_lower)
}

fn prettify_exe_name(exe_lower: &str) -> String {
    let stem = exe_lower.strip_suffix(".exe").unwrap_or(exe_lower);
    let words: Vec<String> = stem
        .split(['-', '_', ' '])
        .filter(|part| !part.is_empty())
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect();

    if words.is_empty() {
        stem.to_string()
    } else {
        words.join(" ")
    }
}

/// Milliseconds since the last keyboard/mouse input, system-wide. `GetTickCount` wraps every ~49
/// days of uptime, and `wrapping_sub` is what makes the difference still come out right across
/// that wrap.
fn idle_duration() -> Duration {
    let mut info = LASTINPUTINFO {
        cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
        dwTime: 0,
    };

    // SAFETY: `info` is a correctly sized, fully initialized LASTINPUTINFO, which is the only
    // precondition GetLastInputInfo has.
    let ok = unsafe { GetLastInputInfo(&mut info) };
    if ok == 0 {
        return Duration::ZERO;
    }

    // SAFETY: GetTickCount takes no arguments and cannot fail.
    let now = unsafe { GetTickCount() };
    Duration::from_millis(now.wrapping_sub(info.dwTime) as u64)
}

/// PID owning the foreground window, or `None` when nothing is focused -- which is what the lock
/// screen and secure-desktop (UAC) prompts look like from a normal user process.
fn foreground_pid() -> Option<u32> {
    // SAFETY: GetForegroundWindow takes no arguments and returns null rather than failing.
    let hwnd = unsafe { GetForegroundWindow() };
    if hwnd.is_null() {
        return None;
    }

    let mut pid: u32 = 0;
    // SAFETY: `hwnd` is non-null and `pid` is a valid out-pointer for the duration of the call.
    let thread_id = unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };
    if thread_id == 0 || pid == 0 {
        None
    } else {
        Some(pid)
    }
}

fn process_name_for_pid(sys: &mut System, pid: u32) -> Option<String> {
    let pid = Pid::from_u32(pid);
    sys.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[pid]),
        true,
        ProcessRefreshKind::nothing(),
    );
    let name = sys.process(pid)?.name().to_string_lossy().to_lowercase();
    if name.is_empty() {
        None
    } else {
        Some(name)
    }
}

fn state_file_path(app: &AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_data_dir().ok()?;
    Some(dir.join(STATE_FILE_NAME))
}

fn load_persisted_state(app: &AppHandle) -> Option<AppTrackingState> {
    let path = state_file_path(app)?;
    let contents = fs::read_to_string(path).ok()?;
    serde_json::from_str(&contents).ok()
}

fn persist_state(app: &AppHandle, state: &AppTrackingState) {
    let Some(path) = state_file_path(app) else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string(state) {
        let _ = fs::write(path, json);
    }
}

pub fn start_monitor(app: &AppHandle) {
    let app = app.clone();
    thread::Builder::new()
        .name("app-tracker".into())
        .spawn(move || {
            if let Some(loaded) = load_persisted_state(&app) {
                let state = app.state::<Mutex<AppTrackingState>>();
                *state.lock().unwrap() = loaded;
            }

            let mut sys = System::new();
            let mut last_tick = Instant::now();

            loop {
                thread::sleep(POLL_INTERVAL);

                let now = Instant::now();
                let elapsed = now.duration_since(last_tick).min(MAX_TICK_GAP);
                last_tick = now;

                // Attribute nothing while the user is away -- but the day-rollover check below
                // still has to run, otherwise a machine left idle overnight would wake up
                // accumulating into yesterday's bucket.
                let away = idle_duration() >= IDLE_THRESHOLD;
                let active = if away {
                    None
                } else {
                    foreground_pid().and_then(|pid| process_name_for_pid(&mut sys, pid))
                };

                let today = local_date_key();
                let state_mtx = app.state::<Mutex<AppTrackingState>>();
                let mut state = state_mtx.lock().unwrap();

                if state.date != today {
                    state.date = today;
                    state.entries.clear();
                }

                if let Some(exe_lower) = active {
                    let label = friendly_label(&exe_lower);
                    let entry = state
                        .entries
                        .entry(exe_lower)
                        .or_insert_with(|| AppTimeEntry {
                            label: label.clone(),
                            seconds: 0,
                        });
                    entry.label = label;
                    entry.seconds += elapsed.as_secs();
                }

                persist_state(&app, &state);
            }
        })
        .expect("spawn app-tracker thread");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_apps_get_their_curated_label() {
        assert_eq!(friendly_label("chrome.exe"), "Google Chrome");
        assert_eq!(friendly_label("powerpnt.exe"), "PowerPoint");
    }

    #[test]
    fn unknown_apps_fall_back_to_a_prettified_exe_name() {
        assert_eq!(friendly_label("some-tool.exe"), "Some Tool");
        assert_eq!(friendly_label("my_editor.exe"), "My Editor");
        assert_eq!(friendly_label("thing.exe"), "Thing");
    }

    #[test]
    fn prettify_handles_names_without_an_exe_suffix_or_with_stray_separators() {
        assert_eq!(prettify_exe_name("bare"), "Bare");
        assert_eq!(prettify_exe_name("double--dash.exe"), "Double Dash");
        assert_eq!(prettify_exe_name(".exe"), "");
    }

    #[test]
    fn labels_are_keyed_by_the_lowercased_exe_blocking_matches_on() {
        // blocking.rs lowercases process names before matching block-list entries; a key here has
        // to be usable as one of those entries directly.
        assert!(KNOWN_APP_LABELS
            .iter()
            .all(|(exe, _)| *exe == exe.to_lowercase()));
    }
}
