// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod config;
mod tray;
mod audio;
mod recognition;
mod hotword;
mod input;
mod downloader;

use config::load_config;
use recognition::engine_manager::EngineManager;
use hotword::run_control_loop;

use tokio::sync::mpsc;
use tokio::sync::Mutex;
use std::sync::Arc;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AppStatus {
    Idle,
    Listening,
    Dictating,
    Paused,
    Processing,
    Error(String),
}

impl std::fmt::Display for AppStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            AppStatus::Idle => "idle",
            AppStatus::Listening => "listening",
            AppStatus::Dictating => "dictating",
            AppStatus::Paused => "paused",
            AppStatus::Processing => "processing",
            AppStatus::Error(e) => return write!(f, "error: {}", e),
        };
        write!(f, "{}", s)
    }
}

pub enum ControlCommand {
    Pause,
    Resume,
    SetTriggerWords(Vec<String>),
    SetStopWords(Vec<String>),
    SetSilenceTimeout(u64),
    SetEngine(String),
    SetTriggerTranslate(bool),
    SetLanguage(String),
    ForceDictate,
    Quit,
}

pub struct AppState {
    pub status: Mutex<AppStatus>,
    pub config: Mutex<config::Config>,
    pub control_tx: tokio::sync::mpsc::Sender<ControlCommand>,
}

fn main() {
    let (control_tx, control_rx) = mpsc::channel(32);
    let initial_config = load_config();
    let audio_config_clone = initial_config.audio.clone();
    let engine_config_clone = initial_config.engine.clone();
    let app_config_clone = initial_config.clone();

    let app_state = Arc::new(AppState {
        status: Mutex::new(AppStatus::Idle),
        config: Mutex::new(initial_config),
        control_tx,
    });

    let app_state_for_task = Arc::clone(&app_state);

    tauri::Builder::default()
        .manage(app_state)
        .setup(move |app| {
            let handle = app.handle().clone();
            tray::setup_tray(&handle)?;

            let (rx, stream) = audio::spawn_audio_pipeline(&audio_config_clone)
                .expect("Failed to start audio pipeline");

            // Zapobiega usunięciu Stream z pamięci (leak na stertę)
            Box::leak(Box::new(stream));

            let pipeline = audio::AudioPipeline {
                speech_rx: rx,
            };

            tauri::async_runtime::spawn(async move {
                let engine = match EngineManager::new(&app_config_clone).await {
                    Ok(e) => e,
                    Err(err) => {
                        eprintln!("[ENGINE] Failed to initialize engine: {}", err);
                        return;
                    }
                };

                println!("[ENGINE] Ready and waiting for speech chunks...");
                
                run_control_loop(pipeline, engine, app_state_for_task, app_config_clone, control_rx, handle).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::save_config,
            commands::reset_config,
            commands::list_engines,
            commands::set_engine,
            commands::test_engine,
            commands::download_model,
            commands::check_model_downloaded,
            commands::get_model_info_cmd,
            commands::get_available_models,
            commands::check_python_installed,
            commands::install_python_env,
            commands::install_cuda_libs,
            commands::list_audio_devices,
            commands::set_audio_device,
            commands::test_microphone,
            commands::set_trigger_words,
            commands::set_stop_words,
            commands::pause_listening,
            commands::resume_listening,
            commands::force_dictate,
            commands::quit,
            commands::minimize_window,
            commands::hide_window,
            commands::get_installed_models_summary,
            commands::delete_installed_model,
            commands::cleanup_model_tmp_files,
            commands::open_url
        ])
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                window.hide().unwrap();
                api.prevent_close();
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
