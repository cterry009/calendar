//! Per-website foreground time on Windows -- "which sites do I actually spend my time on", so the
//! block list can suggest them (user-requested, 2026-10-06). Rides on `app_tracking.rs`'s poll
//! loop: whenever the foreground app is a Chromium browser and the user isn't idle, that tick's
//! seconds go to the site in the foreground tab.
//!
//! **Which site.** A browser doesn't tell other processes its URL, but its window title is the
//! foreground tab's page title ("Inbox - Gmail - Google Chrome"), and the browser's own history
//! database maps page titles to URLs. So the title is matched against `urls.title` (the longest
//! history title the window title starts with, the browser/profile suffix ignored that way) and
//! only the URL's host is kept. Titles never leave this process and are never written to disk:
//! what's persisted and handed to the frontend is just domain -> seconds per day.
//!
//! Chrome's own `visits.visit_duration` was tried first and rejected: it is how long the tab was
//! *open*, background tabs included (google.com came out at 12k minutes in a week).
//!
//! The history DB is locked while the browser runs, so it's read from a copy (refreshed at most
//! once a minute, and only when a new title needs resolving), falling back to opening the original
//! with `immutable=1`. A page just opened may not be in history yet, so an unknown title is kept
//! pending and retried for a while before being given up on (new tab pages, incognito).
//! Firefox isn't covered: its history is a different schema, and none is installed here.

use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, Instant},
};

use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use windows_sys::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW};

const STATE_FILE_NAME: &str = "website_time_state.json";
/// Days of history kept; suggestions look at the last week.
const KEEP_DAYS: i64 = 8;
const COPY_MAX_AGE: Duration = Duration::from_secs(60);
const RESOLVE_EVERY: Duration = Duration::from_secs(15);
/// ~2 minutes of retries before a title counts as "not a site" (new tab, incognito, a PDF).
const PENDING_MAX_TRIES: u8 = 8;
const TITLE_CACHE_MAX: usize = 5_000;

/// Chromium browsers: exe, base folder env var, user-data dir under it.
const BROWSERS: &[(&str, &str, &str)] = &[
    ("chrome.exe", "LOCALAPPDATA", "Google\\Chrome\\User Data"),
    ("msedge.exe", "LOCALAPPDATA", "Microsoft\\Edge\\User Data"),
    ("brave.exe", "LOCALAPPDATA", "BraveSoftware\\Brave-Browser\\User Data"),
    ("vivaldi.exe", "LOCALAPPDATA", "Vivaldi\\User Data"),
    ("opera.exe", "APPDATA", "Opera Software\\Opera Stable"),
];

#[derive(Default, Serialize, Deserialize)]
pub struct WebsiteTrackingState {
    /// Local YYYY-MM-DD -> domain -> seconds.
    pub days: HashMap<String, HashMap<String, u64>>,
}

#[derive(Serialize)]
pub struct WebsiteTimeDto {
    domain: String,
    minutes: u64,
}

/// Minutes per domain over the last `days` local days (today included), most used first.
#[tauri::command]
pub fn get_website_time(days: u32, state: State<'_, Mutex<WebsiteTrackingState>>) -> Vec<WebsiteTimeDto> {
    let guard = state.lock().unwrap();
    let today = chrono::Local::now().date_naive();
    let mut totals: HashMap<String, u64> = HashMap::new();
    for offset in 0..days.max(1) as i64 {
        let key = (today - chrono::Duration::days(offset)).format("%Y-%m-%d").to_string();
        if let Some(day) = guard.days.get(&key) {
            for (domain, secs) in day {
                *totals.entry(domain.clone()).or_default() += secs;
            }
        }
    }
    let mut out: Vec<WebsiteTimeDto> = totals
        .into_iter()
        .filter(|(_, secs)| *secs >= 60)
        .map(|(domain, secs)| WebsiteTimeDto { domain, minutes: secs / 60 })
        .collect();
    out.sort_by(|a, b| b.minutes.cmp(&a.minutes));
    out
}

pub fn is_browser(exe_lower: &str) -> bool {
    BROWSERS.iter().any(|(exe, _, _)| *exe == exe_lower)
}

/// `https://www.YouTube.com/watch?v=1` -> `youtube.com`; None for anything that isn't a web page.
pub fn domain_of(url: &str) -> Option<String> {
    let rest = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))?;
    let authority = rest.split(['/', '?', '#']).next()?;
    let host = authority.rsplit('@').next()?.split(':').next()?.to_lowercase();
    let host = host.strip_prefix("www.").unwrap_or(&host).to_string();
    if host.is_empty() || !host.contains('.') {
        return None;
    }
    Some(host)
}

/// Whether a history title is how the window title starts: followed by nothing, or by the
/// browser's " - Google Chrome" / Edge's " and 3 more pages" suffix -- not the middle of a word.
fn title_matches(window_title: &str, page_title: &str) -> bool {
    match window_title.strip_prefix(page_title) {
        Some(rest) => rest.is_empty() || rest.starts_with(' '),
        None => false,
    }
}

fn foreground_title() -> Option<String> {
    // SAFETY: GetForegroundWindow takes no arguments and returns null rather than failing.
    let hwnd = unsafe { GetForegroundWindow() };
    if hwnd.is_null() {
        return None;
    }
    let mut buf = [0u16; 512];
    // SAFETY: `buf` is a valid writable buffer of the length passed.
    let len = unsafe { GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32) };
    if len <= 0 {
        return None;
    }
    let title = String::from_utf16_lossy(&buf[..len as usize]).trim().to_string();
    if title.is_empty() {
        None
    } else {
        Some(title)
    }
}

/// Every profile's History file for a browser (Default, Profile N, or the dir itself for Opera).
fn history_files(exe: &str) -> Vec<PathBuf> {
    let Some((_, env, dir)) = BROWSERS.iter().find(|(e, _, _)| *e == exe) else {
        return Vec::new();
    };
    let Ok(base) = std::env::var(env) else {
        return Vec::new();
    };
    let root = Path::new(&base).join(dir);
    let mut out = Vec::new();
    if root.join("History").is_file() {
        out.push(root.join("History"));
    }
    if let Ok(entries) = fs::read_dir(&root) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name == "Default" || name.starts_with("Profile ") {
                let file = entry.path().join("History");
                if file.is_file() {
                    out.push(file);
                }
            }
        }
    }
    out
}

fn open_history(original: &Path, copy: &Path) -> Option<Connection> {
    if fs::copy(original, copy).is_ok() {
        if let Ok(conn) = Connection::open_with_flags(copy, OpenFlags::SQLITE_OPEN_READ_ONLY) {
            return Some(conn);
        }
    }
    // Locked: read the live file without taking any lock.
    let uri = format!("file:{}?immutable=1", original.to_string_lossy().replace('\\', "/"));
    Connection::open_with_flags(uri, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_URI).ok()
}

/// The URL whose page title the window title starts with (longest wins, most recent on a tie).
fn lookup(conn: &Connection, window_title: &str) -> rusqlite::Result<Option<String>> {
    let mut stmt = conn.prepare_cached(
        "SELECT url, title FROM urls
         WHERE length(title) >= 2 AND substr(?1, 1, length(title)) = title
         ORDER BY length(title) DESC, last_visit_time DESC LIMIT 5",
    )?;
    let rows = stmt.query_map([window_title], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?;
    for row in rows.flatten() {
        if title_matches(window_title, &row.1) {
            return Ok(Some(row.0));
        }
    }
    Ok(None)
}

struct Pending {
    exe: String,
    seconds: u64,
    tries: u8,
}

/// Owned by the app-tracker thread; only the per-day totals are shared (and persisted).
pub struct WebsiteTracker {
    /// window title (per browser) -> domain, or None once it's known not to be a site.
    titles: HashMap<String, Option<String>>,
    pending: HashMap<String, Pending>,
    /// Open history copies per browser, and when they were taken.
    histories: HashMap<String, (Instant, Vec<Connection>)>,
    last_resolve: Option<Instant>,
}

impl WebsiteTracker {
    pub fn new() -> Self {
        Self { titles: HashMap::new(), pending: HashMap::new(), histories: HashMap::new(), last_resolve: None }
    }

    /// One poll tick with `exe_lower` in front and the user present.
    pub fn tick(&mut self, app: &AppHandle, exe_lower: &str, elapsed: Duration) {
        if is_browser(exe_lower) {
            if let Some(title) = foreground_title() {
                let key = format!("{exe_lower}\u{1f}{title}");
                match self.titles.get(&key) {
                    Some(Some(domain)) => {
                        let domain = domain.clone();
                        credit(app, &domain, elapsed.as_secs());
                    }
                    Some(None) => {}
                    None => {
                        let pending = self.pending.entry(key).or_insert_with(|| Pending {
                            exe: exe_lower.to_string(),
                            seconds: 0,
                            tries: 0,
                        });
                        pending.seconds += elapsed.as_secs();
                    }
                }
            }
        }
        if !self.pending.is_empty() && self.last_resolve.map_or(true, |at| at.elapsed() >= RESOLVE_EVERY) {
            self.last_resolve = Some(Instant::now());
            self.resolve_pending(app);
        }
    }

    fn resolve_pending(&mut self, app: &AppHandle) {
        if self.titles.len() > TITLE_CACHE_MAX {
            self.titles.clear();
        }
        let keys: Vec<String> = self.pending.keys().cloned().collect();
        for key in keys {
            let Some(pending) = self.pending.get(&key) else { continue };
            let exe = pending.exe.clone();
            let title = key.split_once('\u{1f}').map(|(_, t)| t.to_string()).unwrap_or_default();
            let found = self.connections(&exe).iter().find_map(|conn| lookup(conn, &title).ok().flatten());
            match found {
                Some(url) => {
                    let pending = self.pending.remove(&key).unwrap();
                    let domain = domain_of(&url);
                    if let Some(domain) = &domain {
                        credit(app, domain, pending.seconds);
                    }
                    self.titles.insert(key, domain);
                }
                None => {
                    let pending = self.pending.get_mut(&key).unwrap();
                    pending.tries += 1;
                    if pending.tries >= PENDING_MAX_TRIES {
                        self.pending.remove(&key);
                        self.titles.insert(key, None);
                    }
                }
            }
        }
    }

    fn connections(&mut self, exe: &str) -> &Vec<Connection> {
        let stale = self.histories.get(exe).map_or(true, |(at, _)| at.elapsed() >= COPY_MAX_AGE);
        if stale {
            let dir = std::env::temp_dir().join("calendar-productivity-history");
            let _ = fs::create_dir_all(&dir);
            // Drop the old connections first so their copies can be overwritten.
            self.histories.remove(exe);
            let conns = history_files(exe)
                .iter()
                .enumerate()
                .filter_map(|(i, file)| open_history(file, &dir.join(format!("{exe}-{i}.sqlite"))))
                .collect();
            self.histories.insert(exe.to_string(), (Instant::now(), conns));
        }
        &self.histories[exe].1
    }
}

fn credit(app: &AppHandle, domain: &str, seconds: u64) {
    if seconds == 0 {
        return;
    }
    let today = chrono::Local::now().date_naive();
    let state_mtx = app.state::<Mutex<WebsiteTrackingState>>();
    let mut state = state_mtx.lock().unwrap();
    *state
        .days
        .entry(today.format("%Y-%m-%d").to_string())
        .or_default()
        .entry(domain.to_string())
        .or_default() += seconds;
    let oldest = (today - chrono::Duration::days(KEEP_DAYS)).format("%Y-%m-%d").to_string();
    state.days.retain(|day, _| *day > oldest);
    persist_state(app, &state);
}

fn state_file_path(app: &AppHandle) -> Option<PathBuf> {
    Some(app.path().app_data_dir().ok()?.join(STATE_FILE_NAME))
}

pub fn load_persisted_state(app: &AppHandle) {
    let Some(path) = state_file_path(app) else { return };
    let Ok(contents) = fs::read_to_string(path) else { return };
    if let Ok(loaded) = serde_json::from_str::<WebsiteTrackingState>(&contents) {
        *app.state::<Mutex<WebsiteTrackingState>>().lock().unwrap() = loaded;
    }
}

fn persist_state(app: &AppHandle, state: &WebsiteTrackingState) {
    let Some(path) = state_file_path(app) else { return };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string(state) {
        let _ = fs::write(path, json);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn domains_are_bare_lowercase_hosts() {
        assert_eq!(domain_of("https://www.YouTube.com/watch?v=1").as_deref(), Some("youtube.com"));
        assert_eq!(domain_of("http://mail.google.com:443/x").as_deref(), Some("mail.google.com"));
        assert_eq!(domain_of("https://user@reddit.com/r/x#y").as_deref(), Some("reddit.com"));
    }

    #[test]
    fn non_web_urls_are_not_sites() {
        assert_eq!(domain_of("chrome://newtab/"), None);
        assert_eq!(domain_of("chrome-extension://abc/page.html"), None);
        assert_eq!(domain_of("file:///C:/notes.pdf"), None);
        assert_eq!(domain_of("http://localhost:5173/"), None);
    }

    #[test]
    fn titles_match_only_at_a_word_boundary() {
        assert!(title_matches("Inbox - Gmail - Google Chrome", "Inbox - Gmail"));
        assert!(title_matches("YouTube and 3 more pages - Personal - Microsoft Edge", "YouTube"));
        assert!(title_matches("YouTube", "YouTube"));
        assert!(!title_matches("YouTuber news - Google Chrome", "YouTube"));
        assert!(!title_matches("Gmail", "Inbox - Gmail"));
    }
}
