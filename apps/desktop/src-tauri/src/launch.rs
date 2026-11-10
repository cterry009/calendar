//! 2026-11-10: open a project's folder in VS Code, or one of its files with its default program, from
//! the project page. Paths come from the user's own project data; they must exist and be absolute,
//! and nothing runs through a shell string (each path is a single argument).

use std::path::Path;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn checked(path: &str) -> Result<&Path, String> {
    let p = Path::new(path);
    if !p.is_absolute() {
        return Err(format!("La ruta debe ser absoluta: {path}"));
    }
    if !p.exists() {
        return Err(format!("No existe: {path}"));
    }
    Ok(p)
}

/// `code <folder>`; on Windows `code` is a .cmd, so it goes through cmd /C with the path as its own argument.
#[tauri::command]
pub fn open_in_vscode(path: String) -> Result<(), String> {
    let p = checked(&path)?;
    #[cfg(windows)]
    let result = Command::new("cmd")
        .args(["/C", "code"])
        .arg(p)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();
    #[cfg(not(windows))]
    let result = Command::new("code").arg(p).spawn();
    result
        .map(|_| ())
        .map_err(|e| format!("No se pudo abrir VS Code: {e}. ¿Está instalado con el comando `code` en el PATH?"))
}

/// A file or folder with its default program (Explorer for a folder).
#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    let p = checked(&path)?;
    #[cfg(windows)]
    let result = Command::new("explorer").arg(p).spawn();
    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg(p).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let result = Command::new("xdg-open").arg(p).spawn();
    result.map(|_| ()).map_err(|e| format!("No se pudo abrir: {e}"))
}
