// src-tauri/src/commands/window.rs
//
// Single Responsibility: Tauri command handlers for app window management (minimize/hide),
// version checks, system disk space querying, and spawning default web browsers for URLs.

use tauri::{AppHandle, Manager};

#[derive(serde::Serialize)]
pub struct AppVersionInfo {
    pub version: String,
    pub is_dev: bool,
    pub is_prerelease: bool,
    pub channel: String,
    pub display_tag: String,
}

#[tauri::command]
pub async fn minimize_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.minimize().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn hide_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
        crate::notification::show_custom_notification(&app, "tray");
    }
    Ok(())
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/C", "start", "", &url]);
        crate::platform::suppress_console_in_release(&mut cmd);
        cmd.spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = url;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_app_version_info(app: AppHandle) -> Result<AppVersionInfo, String> {
    let version = app.package_info().version.to_string();
    let is_dev = cfg!(debug_assertions);
    let is_prerelease = !app.package_info().version.pre.is_empty() || version.contains('-') || version.contains("beta") || version.contains("alpha") || version.contains("rc") || version.contains("nightly");

    let channel = if is_dev {
        "dev".to_string()
    } else if is_prerelease {
        "nightly".to_string()
    } else {
        "stable".to_string()
    };

    let display_tag = if is_dev {
        "DEV".to_string()
    } else if is_prerelease {
        format!("v{} (Nightly)", version)
    } else {
        format!("v{} (Stable)", version)
    };

    Ok(AppVersionInfo {
        version,
        is_dev,
        is_prerelease,
        channel,
        display_tag,
    })
}

#[tauri::command]
pub fn get_free_disk_space() -> u64 {
    #[cfg(windows)]
    {
        let models_dir = crate::downloader::model_registry::get_models_dir();
        let path_str = models_dir.to_string_lossy().to_string();
        let mut cmd = std::process::Command::new("powershell");
        let script = format!(
            "$root = [System.IO.Path]::GetPathRoot('{}'); [System.IO.DriveInfo]::new($root).AvailableFreeSpace",
            path_str.replace("'", "''")
        );
        cmd.args(["-NoProfile", "-Command", &script]);
        crate::platform::suppress_console_in_release(&mut cmd);
        if let Ok(out) = cmd.output() {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if let Ok(val) = stdout.parse::<u64>() {
                return val;
            }
        }
        50 * 1024 * 1024 * 1024 // Fallback to 50 GB
    }
    #[cfg(not(windows))]
    {
        50 * 1024 * 1024 * 1024 // Fallback to 50 GB
    }
}
