// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Path, PathBuf};
use tauri::{Emitter, Manager};
use std::io::Write;

// We will embed the payload.zip during compilation. 
// If it doesn't exist during dev, we provide an empty dummy array.
#[cfg(not(feature = "dev_dummy"))]
const PAYLOAD: &[u8] = include_bytes!("../../payload.zip");

#[cfg(feature = "dev_dummy")]
const PAYLOAD: &[u8] = &[];

#[derive(Clone, serde::Serialize)]
struct ProgressPayload {
    progress: f64,
    status: String,
}

#[tauri::command]
fn get_default_install_path() -> Result<String, String> {
    let app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| "C:\\".to_string());
    Ok(format!("{}\\VoiceType", app_data))
}

#[tauri::command]
async fn select_directory() -> Result<Option<String>, String> {
    // We would use tauri-plugin-dialog, but for simplicity, returning None handled by JS
    // In a full implementation, we'd open a dialog here.
    Ok(None)
}

#[tauri::command]
async fn install_app(app: tauri::AppHandle, path: String, create_desktop_shortcut: bool) -> Result<(), String> {
    let target_dir = PathBuf::from(&path);

    app.emit("install-progress", ProgressPayload {
        progress: 10.0,
        status: "Preparing directory...".to_string()
    }).unwrap();

    if !target_dir.exists() {
        fs::create_dir_all(&target_dir).map_err(|e| format!("Failed to create dir: {}", e))?;
    }

    app.emit("install-progress", ProgressPayload {
        progress: 30.0,
        status: "Extracting files...".to_string()
    }).unwrap();

    // Extract ZIP
    let reader = std::io::Cursor::new(PAYLOAD);
    let mut zip = zip::ZipArchive::new(reader).map_err(|e| format!("Zip error: {}", e))?;

    let total_files = zip.len();
    for i in 0..total_files {
        let mut file = zip.by_index(i).unwrap();
        let outpath = match file.enclosed_name() {
            Some(path) => target_dir.join(path),
            None => continue,
        };

        if file.is_dir() {
            fs::create_dir_all(&outpath).unwrap();
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p).unwrap();
                }
            }
            let mut outfile = fs::File::create(&outpath).unwrap();
            std::io::copy(&mut file, &mut outfile).unwrap();
        }

        let progress = 30.0 + ((i as f64 / total_files as f64) * 50.0);
        app.emit("install-progress", ProgressPayload {
            progress,
            status: format!("Extracting: {}", file.name())
        }).unwrap();
    }

    app.emit("install-progress", ProgressPayload {
        progress: 85.0,
        status: "Creating shortcuts...".to_string()
    }).unwrap();

    let exe_path = target_dir.join("voicetype.exe");

    if create_desktop_shortcut {
        let desktop = std::env::var("USERPROFILE").unwrap_or_default() + "\\Desktop";
        let lnk = PathBuf::from(desktop).join("VoiceType.lnk");
        let sl = mslinks::ShellLink::new(&exe_path.to_string_lossy()).unwrap();
        sl.create_lnk(&lnk).unwrap();
    }

    // Start Menu shortcut
    let start_menu = std::env::var("APPDATA").unwrap_or_default() + "\\Microsoft\\Windows\\Start Menu\\Programs";
    let start_lnk = PathBuf::from(start_menu).join("VoiceType.lnk");
    let sl = mslinks::ShellLink::new(&exe_path.to_string_lossy()).unwrap();
    sl.create_lnk(&start_lnk).unwrap();

    app.emit("install-progress", ProgressPayload {
        progress: 95.0,
        status: "Registering app...".to_string()
    }).unwrap();

    // Write Registry Keys for Uninstall
    use winreg::enums::*;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok((key, _)) = hkcu.create_subkey(r#"Software\Microsoft\Windows\CurrentVersion\Uninstall\VoiceType"#) {
        key.set_value("DisplayName", &"VoiceType").unwrap_or_default();
        key.set_value("DisplayIcon", &exe_path.to_string_lossy().to_string()).unwrap_or_default();
        key.set_value("InstallLocation", &path).unwrap_or_default();
        key.set_value("UninstallString", &format!("powershell.exe -ExecutionPolicy Bypass -Command \"Remove-Item -Recurse -Force '{}'\"", path)).unwrap_or_default();
        key.set_value("Publisher", &"VoiceType").unwrap_or_default();
    }

    app.emit("install-progress", ProgressPayload {
        progress: 100.0,
        status: "Done!".to_string()
    }).unwrap();

    Ok(())
}

#[tauri::command]
fn launch_app(path: String) -> Result<(), String> {
    let exe = PathBuf::from(path).join("voicetype.exe");
    std::process::Command::new(exe).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_default_install_path,
            select_directory,
            install_app,
            launch_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
