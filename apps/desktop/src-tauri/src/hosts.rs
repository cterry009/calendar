//! Task 9.4 -- website blocking during focus via the system hosts file.
//!
//! While a focus/work session is active, blocked domains are pointed at `0.0.0.0` in
//! `C:\Windows\System32\drivers\etc\hosts` (a "no route" that fails fast). The managed lines live
//! between two markers so the rest of the file is never touched:
//!
//! ```text
//! # >>> calendar-productivity focus block >>> (auto-generated; edited by the app)
//! 0.0.0.0 instagram.com
//! 0.0.0.0 www.instagram.com
//! # <<< calendar-productivity focus block <<<
//! ```
//!
//! Real limitations, stated plainly (same "ship the OS-level slice, name what it can't do"
//! pattern as the Android WIFI trigger):
//!   - The hosts file is writable only by Administrators. The app tries a direct write; on
//!     permission-denied it reports back, and `request_hosts_access` does a *one-time* elevated
//!     `icacls` grant of Modify to the current user (one UAC prompt, permanent). That loosens the
//!     hosts-file ACL -- a deliberate, disclosed trade-off, the same one every user-space
//!     hosts-editing focus app makes.
//!   - Browsers with "Secure DNS"/DoH enabled resolve over HTTPS and bypass the hosts file
//!     entirely. hosts blocking still covers the OS resolver, other apps, and browsers without
//!     DoH; DoH-enabled browsers need WFP/a proxy, out of scope here.

use std::{
    fs,
    io::ErrorKind,
    path::PathBuf,
    process::Command,
};

const BEGIN_MARKER: &str = "# >>> calendar-productivity focus block >>> (auto-generated; edited by the app)";
const END_MARKER: &str = "# <<< calendar-productivity focus block <<<";

fn hosts_path() -> PathBuf {
    let root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into());
    PathBuf::from(root).join("System32\\drivers\\etc\\hosts")
}

/// Normalize user input ("https://www.YouTube.com/feed", "youtube.com") to a bare host, and
/// return both it and its `www.` counterpart so a block covers the common apex/www split.
fn expand_domain(raw: &str) -> Vec<String> {
    let host = raw
        .trim()
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .split('/')
        .next()
        .unwrap_or("")
        .split('@')
        .last()
        .unwrap_or("")
        .split(':')
        .next()
        .unwrap_or("")
        .trim()
        .trim_end_matches('.')
        .to_lowercase();
    if host.is_empty() || !host.contains('.') {
        return Vec::new();
    }
    let bare = host.trim_start_matches("www.").to_string();
    if bare.is_empty() || !bare.contains('.') {
        return Vec::new();
    }
    vec![bare.clone(), format!("www.{bare}")]
}

/// Pure transformation: strip any existing managed block from `existing`, then (when `active` and
/// there are domains) append a fresh one. Everything outside the markers is preserved verbatim.
pub fn apply_block(existing: &str, domains: &[String], active: bool) -> String {
    // Drop the old managed block (inclusive of both marker lines).
    let mut kept: Vec<&str> = Vec::new();
    let mut inside = false;
    for line in existing.lines() {
        let trimmed = line.trim();
        if trimmed == BEGIN_MARKER {
            inside = true;
            continue;
        }
        if inside {
            if trimmed == END_MARKER {
                inside = false;
            }
            continue;
        }
        kept.push(line);
    }
    // Trim trailing blank lines we may have left behind.
    while kept.last().is_some_and(|l| l.trim().is_empty()) {
        kept.pop();
    }

    let mut out = kept.join("\r\n");

    let mut hosts: Vec<String> = Vec::new();
    if active {
        for d in domains {
            for h in expand_domain(d) {
                if !hosts.contains(&h) {
                    hosts.push(h);
                }
            }
        }
    }

    if !hosts.is_empty() {
        if !out.is_empty() {
            out.push_str("\r\n\r\n");
        }
        out.push_str(BEGIN_MARKER);
        for h in &hosts {
            out.push_str(&format!("\r\n0.0.0.0 {h}"));
        }
        out.push_str("\r\n");
        out.push_str(END_MARKER);
    }
    out.push_str("\r\n");
    out
}

fn flush_dns() {
    // No elevation needed for a flush; ignore the outcome.
    let _ = Command::new("ipconfig").arg("/flushdns").output();
}

#[derive(serde::Serialize)]
pub struct WebsiteBlockingResult {
    changed: bool,
    /// True when the desired change couldn't be written for lack of permission -- the frontend
    /// shows the "grant access" prompt in that case.
    needs_permission: bool,
}

#[tauri::command]
pub fn set_website_blocking(active: bool, domains: Vec<String>) -> Result<WebsiteBlockingResult, String> {
    let path = hosts_path();
    let existing = match fs::read_to_string(&path) {
        Ok(s) => s,
        Err(e) if e.kind() == ErrorKind::NotFound => String::new(),
        Err(e) => return Err(format!("could not read hosts file: {e}")),
    };

    let updated = apply_block(&existing, &domains, active);
    if updated == existing {
        return Ok(WebsiteBlockingResult { changed: false, needs_permission: false });
    }

    match fs::write(&path, &updated) {
        Ok(()) => {
            flush_dns();
            log::info!(
                "hosts website block updated: active={active} domains={} bytes={}",
                domains.len(),
                updated.len()
            );
            Ok(WebsiteBlockingResult { changed: true, needs_permission: false })
        }
        Err(e) if e.kind() == ErrorKind::PermissionDenied => {
            log::warn!("hosts file not writable -- website blocking needs the one-time permission grant");
            Ok(WebsiteBlockingResult { changed: false, needs_permission: true })
        }
        Err(e) => Err(format!("could not write hosts file: {e}")),
    }
}

/// One-time elevated `icacls` grant of Modify on the hosts file to the current user, so every
/// later `set_website_blocking` can write it with no further UAC prompt. Returns Ok only if the
/// elevated process ran and reported success.
#[tauri::command]
pub fn request_hosts_access() -> Result<(), String> {
    let user = std::env::var("USERNAME").map_err(|_| "USERNAME not set".to_string())?;
    let path = hosts_path();
    let inner = format!(
        "icacls \"{}\" /grant \"{}\":(M)",
        path.display(),
        user
    );
    let status = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!("$p = Start-Process cmd -Verb RunAs -Wait -PassThru -ArgumentList '/c {inner}'; exit $p.ExitCode"),
        ])
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err("permission grant was cancelled or failed".into())
    }
}

/// Best-effort removal of the managed block, called on startup so a stale block from a crash /
/// hard kill while a session was active doesn't outlive the app. Silent on any failure.
pub fn clear_on_startup() {
    let path = hosts_path();
    let Ok(existing) = fs::read_to_string(&path) else {
        return;
    };
    if !existing.contains(BEGIN_MARKER) {
        return;
    }
    let cleared = apply_block(&existing, &[], false);
    if cleared != existing && fs::write(&path, &cleared).is_ok() {
        flush_dns();
        log::info!("cleared a stale hosts website block on startup");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adds_and_removes_managed_block() {
        let base = "127.0.0.1 localhost\r\n::1 localhost\r\n";
        let blocked = apply_block(base, &["youtube.com".into(), "https://www.instagram.com/x".into()], true);
        assert!(blocked.contains("0.0.0.0 youtube.com"));
        assert!(blocked.contains("0.0.0.0 www.youtube.com"));
        assert!(blocked.contains("0.0.0.0 instagram.com"));
        assert!(blocked.contains("127.0.0.1 localhost"));
        assert!(blocked.contains(BEGIN_MARKER) && blocked.contains(END_MARKER));

        // Re-applying with active=false must restore the original (modulo line-ending normalization).
        let restored = apply_block(&blocked, &[], false);
        assert!(!restored.contains(BEGIN_MARKER));
        assert!(!restored.contains("0.0.0.0 youtube.com"));
        assert!(restored.contains("127.0.0.1 localhost"));
        assert!(restored.contains("::1 localhost"));
    }

    #[test]
    fn replacing_an_existing_block_does_not_stack() {
        let base = "127.0.0.1 localhost\r\n";
        let once = apply_block(base, &["a.com".into()], true);
        let twice = apply_block(&once, &["b.com".into()], true);
        assert_eq!(twice.matches(BEGIN_MARKER).count(), 1);
        assert!(twice.contains("0.0.0.0 b.com"));
        assert!(!twice.contains("0.0.0.0 a.com"));
    }

    #[test]
    fn junk_domains_are_dropped() {
        let out = apply_block("x\r\n", &["not a domain".into(), "".into(), "localhost".into()], true);
        assert!(!out.contains(BEGIN_MARKER)); // nothing valid -> no block
    }
}
