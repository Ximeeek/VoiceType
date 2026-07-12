// src-tauri/src/commands/audio.rs
//
// Single Responsibility: Tauri command handlers for managing audio inputs,
// including listing recording devices, switching input, and microphone testing.

use tauri::State;
use std::sync::Arc;
use crate::AppState;
use crate::audio::capture::AudioDevice;

#[tauri::command]
pub async fn list_audio_devices() -> Result<Vec<AudioDevice>, String> {
    Ok(crate::audio::capture::list_audio_devices())
}

#[tauri::command]
pub async fn set_audio_device(state: State<'_, Arc<AppState>>, device_id: String) -> Result<(), String> {
    let mut config = state.config.lock().await;
    config.audio.input_device = device_id;
    crate::config::save_config(&config).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn test_microphone() -> Result<Vec<f32>, String> {
    Ok(vec![0.1, 0.3, 0.7, 0.2])
}
