// src-tauri/src/commands/config.rs
//
// Single Responsibility: Tauri command handlers for application configuration settings,
// including loading, saving, resetting configurations, autostart management, and startup flags.

use tauri::{State, AppHandle};
use std::sync::Arc;
use crate::AppState;
use crate::config::Config;
use crate::ControlCommand;

#[tauri::command]
pub async fn get_config(state: State<'_, Arc<AppState>>) -> Result<Config, String> {
    Ok(state.config.lock().await.clone())
}

#[tauri::command]
pub async fn save_config(state: State<'_, Arc<AppState>>, app: AppHandle, config: Config) -> Result<(), String> {
    let mut config_lock = state.config.lock().await;

    let trigger_changed = config.trigger.words != config_lock.trigger.words;
    let stop_words_changed = config.dictation.stop_words != config_lock.dictation.stop_words;
    let silence_changed = config.dictation.silence_timeout_ms != config_lock.dictation.silence_timeout_ms;
    let translate_changed = config.trigger.translate != config_lock.trigger.translate;
    let no_wake_word_changed = config.trigger.no_wake_word != config_lock.trigger.no_wake_word;
    let lang_changed = config.general.language != config_lock.general.language;
    let engine_changed = config.engine.engine_type != config_lock.engine.engine_type;
    let active_engine_config_changed = match config.engine.engine_type.as_str() {
        "vosk" => config.engine.vosk != config_lock.engine.vosk,
        "whisper" => config.engine.whisper != config_lock.engine.whisper,
        "faster_whisper" => config.engine.whisper != config_lock.engine.whisper || config.engine.faster_whisper != config_lock.engine.faster_whisper,
        "sherpa_onnx" => config.engine.sherpa_onnx != config_lock.engine.sherpa_onnx,
        "deepgram" => config.engine.deepgram != config_lock.engine.deepgram,
        "assemblyai" => config.engine.assemblyai != config_lock.engine.assemblyai,
        "openai" => config.engine.openai != config_lock.engine.openai,
        "google" => config.engine.google != config_lock.engine.google,
        "azure" => config.engine.azure != config_lock.engine.azure,
        _ => false,
    };

    crate::config::save_config(&config).map_err(|e| e.to_string())?;
    *config_lock = config.clone();
    drop(config_lock);
    
    if let Ok(exe_path) = std::env::current_exe() {
        let _ = crate::platform::windows::set_autostart(config.general.autostart, &exe_path.to_string_lossy());
    }

    state.control_tx.send(ControlCommand::UpdateConfig(config.clone())).await.ok();

    if trigger_changed {
        state.control_tx.send(ControlCommand::SetTriggerWords(config.trigger.words)).await.ok();
    }
    if stop_words_changed {
        state.control_tx.send(ControlCommand::SetStopWords(config.dictation.stop_words)).await.ok();
    }
    if silence_changed {
        state.control_tx.send(ControlCommand::SetSilenceTimeout(config.dictation.silence_timeout_ms)).await.ok();
    }
    if translate_changed {
        state.control_tx.send(ControlCommand::SetTriggerTranslate(config.trigger.translate)).await.ok();
    }
    if no_wake_word_changed {
        state.control_tx.send(ControlCommand::SetNoWakeWord(config.trigger.no_wake_word)).await.ok();
    }
    if lang_changed {
        state.control_tx.send(ControlCommand::SetLanguage(config.general.language.clone())).await.ok();
    }
    if active_engine_config_changed || (lang_changed && !engine_changed) {
        state.control_tx.send(ControlCommand::SetEngine(config.engine.engine_type.clone())).await.ok();
    }

    let _ = crate::tray::rebuild_tray_menu(&app);
    
    Ok(())
}

#[tauri::command]
pub async fn reset_config(state: State<'_, Arc<AppState>>, app: AppHandle) -> Result<Config, String> {
    let default = crate::config::default_config();
    crate::config::save_config(&default).map_err(|e| e.to_string())?;
    *state.config.lock().await = default.clone();
    
    state.control_tx.send(ControlCommand::UpdateConfig(default.clone())).await.ok();
    
    state.control_tx.send(ControlCommand::SetTriggerWords(default.trigger.words.clone())).await.ok();
    state.control_tx.send(ControlCommand::SetStopWords(default.dictation.stop_words.clone())).await.ok();
    state.control_tx.send(ControlCommand::SetSilenceTimeout(default.dictation.silence_timeout_ms)).await.ok();
    state.control_tx.send(ControlCommand::SetNoWakeWord(default.trigger.no_wake_word)).await.ok();
    state.control_tx.send(ControlCommand::SetLanguage(default.general.language.clone())).await.ok();
    state.control_tx.send(ControlCommand::SetEngine(default.engine.engine_type.clone())).await.ok();
    
    let _ = crate::tray::rebuild_tray_menu(&app);

    Ok(default)
}

#[tauri::command]
pub async fn hard_reset_config(_state: State<'_, Arc<AppState>>, _app: AppHandle) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", "Remove-Item -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VoiceType' -Recurse -Force -ErrorAction SilentlyContinue"])
            .creation_flags(0x08000000)
            .status();

        let _ = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", "Remove-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'VoiceType' -ErrorAction SilentlyContinue"])
            .creation_flags(0x08000000)
            .status();
    }

    let config_dir = crate::config::get_config_dir();
    if config_dir.exists() {
        let _ = std::fs::remove_dir_all(&config_dir);
    }

    std::process::exit(0);
}

#[cfg(debug_assertions)]
fn get_dev_override(key: &str) -> Option<String> {
    let paths = vec![
        std::path::PathBuf::from("dev_force.txt"),
        std::path::PathBuf::from("../dev_force.txt"),
        std::env::current_exe()
            .map(|p| p.parent().map(|parent| parent.join("dev_force.txt")).unwrap_or_default())
            .unwrap_or_default(),
    ];
    for force_file in paths {
        if force_file.exists() && force_file.is_file() {
            if let Ok(content) = std::fs::read_to_string(&force_file) {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with('#') || trimmed.is_empty() {
                        continue;
                    }
                    if let Some((k, v)) = trimmed.split_once('=') {
                        if k.trim() == key {
                            return Some(v.trim().to_string());
                        }
                    }
                }
            }
        }
    }
    None
}

#[tauri::command]
pub async fn check_show_first_start(state: State<'_, Arc<AppState>>) -> Result<bool, String> {
    #[cfg(debug_assertions)]
    {
        if let Some(val) = get_dev_override("first_start") {
            if val == "1" {
                println!("[DEBUG] dev_force.txt: first_start forced (1)");
                return Ok(true);
            } else if val == "0" {
                println!("[DEBUG] dev_force.txt: first_start suppressed (0)");
                return Ok(false);
            }
        }
    }

    let config = state.config.lock().await;
    Ok(!config.general.first_start_completed)
}

#[tauri::command]
pub async fn check_show_changelog(app: AppHandle, state: State<'_, Arc<AppState>>) -> Result<bool, String> {
    #[cfg(debug_assertions)]
    {
        if let Some(val) = get_dev_override("changelog") {
            if val == "1" {
                println!("[DEBUG] dev_force.txt: changelog forced (1)");
                return Ok(true);
            } else if val == "0" {
                println!("[DEBUG] dev_force.txt: changelog suppressed (0)");
                return Ok(false);
            }
        }
    }

    let config = state.config.lock().await;
    
    // If onboarding is not completed, don't show the changelog yet
    if !config.general.first_start_completed {
        return Ok(false);
    }

    let current_version = app.package_info().version.to_string();
    Ok(config.general.last_seen_version != current_version)
}

#[tauri::command]
pub fn open_config_directory() -> Result<(), String> {
    let path = crate::config::get_config_dir();
    if path.exists() {
        #[cfg(target_os = "windows")]
        {
            let mut cmd = std::process::Command::new("explorer");
            cmd.arg(&path);
            crate::platform::suppress_console_in_release(&mut cmd);
            cmd.spawn().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
