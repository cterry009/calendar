//! Windows game-time tracking -- Steam (per-game), Riot Client, and Battle.net. The Windows
//! counterpart of Android's screen-time module (`apps/mobile/modules/screen-time`), following the
//! same shape as this crate's own `blocking.rs`/`hosts.rs`: a background poller reading OS state,
//! pure logic separated from I/O so it's unit-testable, state exposed to the frontend via a
//! `#[tauri::command]` instead of Rust pushing to the server directly (the frontend owns the sync
//! pipeline, same "JS syncs, Rust just observes" split blocking.rs uses for policy).
//!
//! **Steam**: replicates the exact signal Steam's own client uses to know a game is running --
//! `HKEY_CURRENT_USER\Software\Valve\Steam\Apps\<appid>\Running` flips to `1` while that appid is
//! being played. The appid is resolved to a display name by reading the local game library's
//! `appmanifest_<appid>.acf` files (a small hand-rolled VDF-keyvalue line scanner below, not a
//! generic parser -- Valve's format is simple enough that a full parser would be overkill, same
//! reasoning `hosts.rs` gives for its own pure line-based hosts-file transform).
//!
//! **Riot Client / Battle.net**: neither exposes a registry "now playing" flag the way Steam does,
//! so these are attributed via a curated table of known game process names (`KNOWN_GAME_PROCESSES`
//! below), reusing the same `sysinfo` process enumeration `blocking.rs` already depends on. The
//! launcher processes themselves (`RiotClientServices.exe`, `Battle.net.exe`) are deliberately not
//! counted -- only an actual game process counts as "playing". **Known limitation, not hidden**:
//! this table can't be exhaustive across every Riot/Battle.net title and needs new entries as new
//! games come up, the same "curated list, not perfect" tradeoff already accepted for Android's
//! `distractingApps.ts` social-app list.
//!
//! State accumulates in memory (seconds per game today) and is persisted to a small JSON file in
//! the app's data dir on every tick, so a restart mid-day resumes instead of losing progress --
//! the desktop counterpart of mobile's session-fold-into-daily-baseline pattern for step counts.

use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System};
use tauri::{AppHandle, Manager, State};
use winreg::enums::HKEY_CURRENT_USER;
use winreg::RegKey;

const POLL_INTERVAL: Duration = Duration::from_secs(5);
/// Caps how much elapsed time a single tick can attribute -- guards against a sleep/resume or a
/// debugger-paused gap between ticks being miscounted as active play.
const MAX_TICK_GAP: Duration = Duration::from_secs(30);
const STATE_FILE_NAME: &str = "game_time_state.json";

/// (process name lowercased incl. .exe, display label, source). Only real game processes --
/// never the launcher chrome itself, since the launcher alone isn't "playing".
const KNOWN_GAME_PROCESSES: &[(&str, &str, &str)] = &[
    ("leagueclientux.exe", "League of Legends", "RIOT"),
    ("league of legends.exe", "League of Legends", "RIOT"),
    ("valorant-win64-shipping.exe", "Valorant", "RIOT"),
    ("legendsofruneterra.exe", "Legends of Runeterra", "RIOT"),
    ("overwatch.exe", "Overwatch 2", "BATTLENET"),
    ("wow.exe", "World of Warcraft", "BATTLENET"),
    ("wowclassic.exe", "World of Warcraft Classic", "BATTLENET"),
    ("diablo iv.exe", "Diablo IV", "BATTLENET"),
    ("diablo iii.exe", "Diablo III", "BATTLENET"),
    ("hearthstone.exe", "Hearthstone", "BATTLENET"),
    ("heroes of the storm.exe", "Heroes of the Storm", "BATTLENET"),
    ("starcraft ii.exe", "StarCraft II", "BATTLENET"),
];

#[derive(Default, Serialize, Deserialize, Clone)]
pub struct GameTimeEntry {
    pub label: String,
    pub source: String,
    pub seconds: u64,
}

#[derive(Default, Serialize, Deserialize)]
pub struct GameTrackingState {
    /// Local YYYY-MM-DD this accumulator belongs to -- a fresh day resets `entries`.
    pub date: String,
    pub entries: HashMap<String, GameTimeEntry>,
}

#[derive(Serialize)]
pub struct GameTimeEntryDto {
    key: String,
    label: String,
    source: String,
    minutes: u64,
}

#[tauri::command]
pub fn get_game_time_today(state: State<'_, Mutex<GameTrackingState>>) -> Vec<GameTimeEntryDto> {
    let guard = state.lock().unwrap();
    guard
        .entries
        .iter()
        .map(|(key, entry)| GameTimeEntryDto {
            key: key.clone(),
            label: entry.label.clone(),
            source: entry.source.clone(),
            minutes: entry.seconds / 60,
        })
        .collect()
}

fn local_date_key() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

pub(crate) fn steam_install_path() -> Option<PathBuf> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let steam_key = hkcu.open_subkey("Software\\Valve\\Steam").ok()?;
    let path: String = steam_key.get_value("SteamPath").ok()?;
    Some(PathBuf::from(path.replace('/', "\\")))
}

/// Appids with `Running == 1` right now -- the same flag Steam's own client/overlay reads.
fn running_steam_appids() -> Vec<String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let Ok(apps_key) = hkcu.open_subkey("Software\\Valve\\Steam\\Apps") else {
        return Vec::new();
    };

    let mut running = Vec::new();
    for appid in apps_key.enum_keys().flatten() {
        if let Ok(sub) = apps_key.open_subkey(&appid) {
            let is_running: u32 = sub.get_value("Running").unwrap_or(0);
            if is_running == 1 {
                running.push(appid);
            }
        }
    }
    running
}

/// Extracts every `"<key>"   "<value>"`-style line's value (Valve's VDF keyvalue format is one
/// pair per line), unescaping doubled backslashes (`C:\\Program Files` -> `C:\Program Files`).
/// Not a general VDF parser -- deliberately simple, matching hosts.rs's own pure-line-scan style.
fn extract_all_values(text: &str, key: &str) -> Vec<String> {
    let needle = format!("\"{key}\"");
    let mut out = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix(&needle) {
            if let Some(raw) = extract_quoted(rest) {
                out.push(raw.replace("\\\\", "\\"));
            }
        }
    }
    out
}

pub(crate) fn extract_first_value(text: &str, key: &str) -> Option<String> {
    extract_all_values(text, key).into_iter().next()
}

fn extract_quoted(s: &str) -> Option<String> {
    let start = s.find('"')?;
    let rest = &s[start + 1..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

/// Every Steam library folder on this machine: the main install dir plus every additional drive
/// registered in `libraryfolders.vdf` (Steam has moved this file's location across versions, so
/// both known locations are tried).
pub(crate) fn steam_library_paths(steam_path: &Path) -> Vec<PathBuf> {
    let mut paths = vec![steam_path.to_path_buf()];

    for candidate in [
        steam_path.join("steamapps").join("libraryfolders.vdf"),
        steam_path.join("config").join("libraryfolders.vdf"),
    ] {
        if let Ok(contents) = fs::read_to_string(&candidate) {
            for value in extract_all_values(&contents, "path") {
                let normalized = PathBuf::from(value);
                if !paths.contains(&normalized) {
                    paths.push(normalized);
                }
            }
            break;
        }
    }

    paths
}

/// Resolves an appid to its game name by reading `appmanifest_<appid>.acf` from whichever
/// library actually has it installed. Cached in memory since a running game's library doesn't
/// change for the lifetime of this process.
fn resolve_steam_app_name(
    steam_path: &Path,
    appid: &str,
    cache: &mut HashMap<String, String>,
) -> Option<String> {
    if let Some(cached) = cache.get(appid) {
        return Some(cached.clone());
    }

    for library in steam_library_paths(steam_path) {
        let manifest = library
            .join("steamapps")
            .join(format!("appmanifest_{appid}.acf"));
        if let Ok(contents) = fs::read_to_string(&manifest) {
            if let Some(name) = extract_first_value(&contents, "name") {
                cache.insert(appid.to_string(), name.clone());
                return Some(name);
            }
        }
    }

    None
}

/// Resolves an appid to the real folder Steam installed it into (`<library>/steamapps/common/
/// <installdir>`), by reading the same `appmanifest_<appid>.acf`'s `installdir` field
/// `resolve_steam_app_name` reads `name` from. Used by `blocking.rs` to enforce a `steam:<appid>`
/// block-list entry: any running process whose executable lives under this folder gets killed --
/// the only reliable way to "block a Steam game," since the appid itself never appears in a
/// process name or path.
pub(crate) fn resolve_steam_install_dir(steam_path: &Path, appid: &str) -> Option<PathBuf> {
    for library in steam_library_paths(steam_path) {
        let manifest = library
            .join("steamapps")
            .join(format!("appmanifest_{appid}.acf"));
        if let Ok(contents) = fs::read_to_string(&manifest) {
            if let Some(installdir) = extract_first_value(&contents, "installdir") {
                return Some(library.join("steamapps").join("common").join(installdir));
            }
        }
    }
    None
}

fn state_file_path(app: &AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_data_dir().ok()?;
    Some(dir.join(STATE_FILE_NAME))
}

fn load_persisted_state(app: &AppHandle) -> Option<GameTrackingState> {
    let path = state_file_path(app)?;
    let contents = fs::read_to_string(path).ok()?;
    serde_json::from_str(&contents).ok()
}

fn persist_state(app: &AppHandle, state: &GameTrackingState) {
    let Some(path) = state_file_path(app) else { return };
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
        .name("game-tracker".into())
        .spawn(move || {
            if let Some(loaded) = load_persisted_state(&app) {
                let state = app.state::<Mutex<GameTrackingState>>();
                *state.lock().unwrap() = loaded;
            }

            let mut sys = System::new();
            let mut steam_name_cache: HashMap<String, String> = HashMap::new();
            let mut last_tick = Instant::now();

            loop {
                thread::sleep(POLL_INTERVAL);

                let now = Instant::now();
                let elapsed = now.duration_since(last_tick).min(MAX_TICK_GAP);
                last_tick = now;

                let mut active: Vec<(String, String, &'static str)> = Vec::new();

                if let Some(steam_path) = steam_install_path() {
                    for appid in running_steam_appids() {
                        let label = resolve_steam_app_name(&steam_path, &appid, &mut steam_name_cache)
                            .unwrap_or_else(|| format!("Steam (App {appid})"));
                        active.push((appid, label, "STEAM"));
                    }
                }

                sys.refresh_processes_specifics(
                    ProcessesToUpdate::All,
                    true,
                    ProcessRefreshKind::nothing(),
                );
                for (_, process) in sys.processes() {
                    let name_lower = process.name().to_string_lossy().to_lowercase();
                    if let Some((_, label, source)) = KNOWN_GAME_PROCESSES
                        .iter()
                        .find(|(exe, _, _)| *exe == name_lower)
                    {
                        active.push((name_lower, (*label).to_string(), source));
                    }
                }

                let today = local_date_key();
                let state_mtx = app.state::<Mutex<GameTrackingState>>();
                let mut state = state_mtx.lock().unwrap();

                if state.date != today {
                    state.date = today;
                    state.entries.clear();
                }

                for (key, label, source) in &active {
                    let entry = state.entries.entry(key.clone()).or_insert_with(|| GameTimeEntry {
                        label: label.clone(),
                        source: (*source).to_string(),
                        seconds: 0,
                    });
                    entry.label = label.clone();
                    entry.seconds += elapsed.as_secs();
                }

                if !active.is_empty() {
                    log::info!(
                        "game_tracking: active={:?}",
                        active.iter().map(|(k, l, _)| format!("{l} ({k})")).collect::<Vec<_>>()
                    );
                }

                persist_state(&app, &state);
            }
        })
        .expect("spawn game-tracker thread");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_library_paths_from_libraryfolders_vdf() {
        let vdf = "\"libraryfolders\"\r\n{\r\n\t\"0\"\r\n\t{\r\n\t\t\"path\"\t\t\"C:\\\\Program Files (x86)\\\\Steam\"\r\n\t\t\"apps\"\r\n\t\t{\r\n\t\t\t\"730\"\t\t\"12345\"\r\n\t\t}\r\n\t}\r\n\t\"1\"\r\n\t{\r\n\t\t\"path\"\t\t\"D:\\\\SteamLibrary\"\r\n\t}\r\n}\r\n";
        let paths = extract_all_values(vdf, "path");
        assert_eq!(paths, vec!["C:\\Program Files (x86)\\Steam", "D:\\SteamLibrary"]);
    }

    #[test]
    fn extracts_game_name_from_appmanifest() {
        let acf = "\"AppState\"\r\n{\r\n\t\"appid\"\t\t\"730\"\r\n\t\"name\"\t\t\"Counter-Strike 2\"\r\n\t\"StateFlags\"\t\t\"4\"\r\n}\r\n";
        assert_eq!(extract_first_value(acf, "name"), Some("Counter-Strike 2".to_string()));
        assert_eq!(extract_first_value(acf, "appid"), Some("730".to_string()));
    }

    #[test]
    fn extracts_installdir_from_appmanifest() {
        let acf = "\"AppState\"\r\n{\r\n\t\"appid\"\t\t\"1142710\"\r\n\t\"name\"\t\t\"Total War: WARHAMMER III\"\r\n\t\"installdir\"\t\t\"Total War WARHAMMER III\"\r\n}\r\n";
        assert_eq!(extract_first_value(acf, "installdir"), Some("Total War WARHAMMER III".to_string()));
    }

    #[test]
    fn missing_key_returns_none() {
        let acf = "\"AppState\"\r\n{\r\n\t\"appid\"\t\t\"730\"\r\n}\r\n";
        assert_eq!(extract_first_value(acf, "name"), None);
    }

    #[test]
    fn known_game_processes_never_include_the_bare_launcher() {
        let exes: Vec<&str> = KNOWN_GAME_PROCESSES.iter().map(|(exe, _, _)| *exe).collect();
        assert!(!exes.contains(&"riotclientservices.exe"));
        assert!(!exes.contains(&"battle.net.exe"));
    }
}
