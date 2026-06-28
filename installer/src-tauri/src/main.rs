// Always hide console window on Windows
#![windows_subsystem = "windows"]

use std::fs;
use std::path::PathBuf;
use tauri::Emitter;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const PAYLOAD: &[u8] = include_bytes!("../../payload.zip");

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
    let handle = std::thread::spawn(|| -> Result<Option<String>, String> {
        let mut cmd = std::process::Command::new("powershell");
        cmd.args([
            "-NoProfile",
            "-Command",
            "[System.Reflection.Assembly]::LoadWithPartialName('System.windows.forms') | Out-Null; $f = New-Object System.Windows.Forms.FolderBrowserDialog; if ($f.ShowDialog() -eq 'OK') { Write-Host $f.SelectedPath }"
        ]);
        #[cfg(windows)]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let output = cmd.output().map_err(|e| e.to_string())?;
        
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() {
            Ok(None)
        } else {
            Ok(Some(path))
        }
    });
    
    handle.join().map_err(|_| "Thread panicked".to_string())?
}

#[tauri::command]
async fn install_app(app: tauri::AppHandle, path: String, create_desktop_shortcut: bool) -> Result<(), String> {
    let mut target_dir = PathBuf::from(&path);
    if let Some(file_name) = target_dir.file_name() {
        if file_name.to_string_lossy().to_lowercase() != "voicetype" {
            target_dir = target_dir.join("VoiceType");
        }
    } else {
        target_dir = target_dir.join("VoiceType");
    }

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
        let desktop = std::env::var("USERPROFILE").unwrap_or_default() + "\\Desktop\\VoiceType.lnk";
        let ps_script = format!(
            "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('{}'); $Shortcut.TargetPath = '{}'; $Shortcut.Save()",
            desktop.replace("'", "''"),
            exe_path.to_string_lossy().replace("'", "''")
        );
        let mut cmd = std::process::Command::new("powershell");
        cmd.args(["-NoProfile", "-Command", &ps_script]);
        #[cfg(windows)]
        cmd.creation_flags(0x08000000);
        let _ = cmd.output();
    }

    app.emit("install-progress", ProgressPayload {
        progress: 95.0,
        status: "Registering app...".to_string()
    }).unwrap();

    // Write Registry Keys for Uninstall via PowerShell
    let reg_script = format!(
        "$path = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VoiceType'; if (-not (Test-Path $path)) {{ New-Item -Path $path -Force | Out-Null }}; Set-ItemProperty -Path $path -Name 'DisplayName' -Value 'VoiceType'; Set-ItemProperty -Path $path -Name 'DisplayIcon' -Value '{}'; Set-ItemProperty -Path $path -Name 'InstallLocation' -Value '{}'; Set-ItemProperty -Path $path -Name 'UninstallString' -Value 'powershell.exe -ExecutionPolicy Bypass -Command \"Remove-Item -Recurse -Force ''{}''\"'; Set-ItemProperty -Path $path -Name 'Publisher' -Value 'VoiceType'",
        exe_path.to_string_lossy().replace("'", "''"),
        path.replace("'", "''"),
        path.replace("'", "''")
    );
    let mut cmd_reg = std::process::Command::new("powershell");
    cmd_reg.args(["-NoProfile", "-Command", &reg_script]);
    #[cfg(windows)]
    cmd_reg.creation_flags(0x08000000);
    let _ = cmd_reg.output();

    app.emit("install-progress", ProgressPayload {
        progress: 100.0,
        status: "Done!".to_string()
    }).unwrap();

    Ok(())
}

#[tauri::command]
async fn finalize_installation(
    path: String,
    create_autostart: bool,
    create_start_menu: bool,
    launch: bool,
) -> Result<(), String> {
    let mut target_dir = PathBuf::from(&path);
    if let Some(file_name) = target_dir.file_name() {
        if file_name.to_string_lossy().to_lowercase() != "voicetype" {
            target_dir = target_dir.join("VoiceType");
        }
    } else {
        target_dir = target_dir.join("VoiceType");
    }

    let exe_path = target_dir.join("voicetype.exe");

    if create_start_menu {
        let start_menu = std::env::var("APPDATA").unwrap_or_default() + "\\Microsoft\\Windows\\Start Menu\\Programs\\VoiceType.lnk";
        let ps_script_start = format!(
            "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('{}'); $Shortcut.TargetPath = '{}'; $Shortcut.Save()",
            start_menu.replace("'", "''"),
            exe_path.to_string_lossy().replace("'", "''")
        );
        let mut cmd_start = std::process::Command::new("powershell");
        cmd_start.args(["-NoProfile", "-Command", &ps_script_start]);
        #[cfg(windows)]
        cmd_start.creation_flags(0x08000000);
        let _ = cmd_start.output();
    }

    if create_autostart {
        let ps_script_autostart = format!(
            "$path = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'; Set-ItemProperty -Path $path -Name 'VoiceType' -Value '\"{}\"'",
            exe_path.to_string_lossy().replace("'", "''")
        );
        let mut cmd_auto = std::process::Command::new("powershell");
        cmd_auto.args(["-NoProfile", "-Command", &ps_script_autostart]);
        #[cfg(windows)]
        cmd_auto.creation_flags(0x08000000);
        let _ = cmd_auto.output();
    }

    if launch {
        let mut cmd_launch = std::process::Command::new(&exe_path);
        cmd_launch.current_dir(&target_dir);
        #[cfg(windows)]
        cmd_launch.creation_flags(0x08000000);
        let _ = cmd_launch.spawn();
    }

    Ok(())
}

#[tauri::command]
fn launch_app(path: String) -> Result<(), String> {
    let mut target_dir = PathBuf::from(&path);
    if let Some(file_name) = target_dir.file_name() {
        if file_name.to_string_lossy().to_lowercase() != "voicetype" {
            target_dir = target_dir.join("VoiceType");
        }
    } else {
        target_dir = target_dir.join("VoiceType");
    }
    let exe = target_dir.join("voicetype.exe");
    let mut cmd = std::process::Command::new(&exe);
    cmd.current_dir(&target_dir);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    cmd.spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn close_installer(app: tauri::AppHandle) {
    app.exit(0);
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_default_install_path,
            select_directory,
            install_app,
            finalize_installation,
            launch_app,
            close_installer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
