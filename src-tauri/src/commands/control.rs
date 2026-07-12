// src-tauri/src/commands/control.rs
//
// Single Responsibility: Tauri command handlers for active dictation stream control,
// updating trigger/stop words lists, toggling pause status, forcing speech flushes, and querying session stats.

use tauri::{State, AppHandle};
use std::sync::Arc;
use crate::{AppState, ControlCommand, SessionStats};

#[tauri::command]
pub async fn set_trigger_words(state: State<'_, Arc<AppState>>, words: Vec<String>) -> Result<(), String> {
    state.control_tx.send(ControlCommand::SetTriggerWords(words.clone())).await.ok();
    let mut config = state.config.lock().await;
    config.trigger.words = words;
    crate::config::save_config(&config).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_stop_words(state: State<'_, Arc<AppState>>, words: Vec<String>) -> Result<(), String> {
    state.control_tx.send(ControlCommand::SetStopWords(words.clone())).await.ok();
    let mut config = state.config.lock().await;
    config.dictation.stop_words = words;
    crate::config::save_config(&config).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pause_listening(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    state.control_tx.send(ControlCommand::Pause).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn resume_listening(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    state.control_tx.send(ControlCommand::Resume).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn force_dictate(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    state.control_tx.send(ControlCommand::ForceDictate).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn quit(app: AppHandle) -> Result<(), String> { 
    app.exit(0); 
    Ok(()) 
}

#[tauri::command]
pub async fn get_session_stats(state: State<'_, Arc<AppState>>) -> Result<SessionStats, String> {
    Ok(state.session_stats.lock().await.clone())
}
