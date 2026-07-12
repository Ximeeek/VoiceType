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
mod platform;
mod notification;

use config::load_config;
use recognition::engine_manager::EngineManager;
use hotword::run_control_loop;
use tauri::Manager;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

use tokio::sync::mpsc;
use tokio::sync::Mutex;
use std::sync::Arc;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
pub struct SessionStats {
    pub dictations_count: u32,
    pub words_total: u32,
}

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
    SetNoWakeWord(bool),
    UpdateConfig(config::Config),
    ForceDictate,
    Quit,
}

pub struct AppState {
    pub status: Mutex<AppStatus>,
    pub config: Mutex<config::Config>,
    pub control_tx: tokio::sync::mpsc::Sender<ControlCommand>,
    pub session_stats: Mutex<SessionStats>,
}

fn main() {
    #[cfg(windows)]
    {
        std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--auto-accept-camera-and-microphone-capture");
        crate::platform::windows::optimize_process_priority();
    }

    let (control_tx, control_rx) = mpsc::channel(32);
    let initial_config = load_config();
    let audio_config_clone = initial_config.audio.clone();
    let app_config_clone = initial_config.clone();

    let app_state = Arc::new(AppState {
        status: Mutex::new(AppStatus::Idle),
        config: Mutex::new(initial_config),
        control_tx,
        session_stats: Mutex::new(SessionStats::default()),
    });

    let app_state_for_task = Arc::clone(&app_state);
    let app_state_for_shortcut = Arc::clone(&app_state);

    let mut builder = tauri::Builder::default();
    #[cfg(feature = "updater")]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .setup(move |app| {
            let handle_ctrlc = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(()) = tokio::signal::ctrl_c().await {
                    println!("[MAIN] Ctrl+C signal received. Shutting down application...");
                    handle_ctrlc.exit(0);
                }
            });

            let handle = app.handle().clone();
            tray::setup_tray(&handle)?;

            app.handle().plugin(tauri_plugin_notification::init())?;
            
            let state_shortcut = app_state_for_shortcut.clone();
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |_app, shortcut, _event| {
                        if shortcut.to_string().to_lowercase().contains("v") {
                            let state = state_shortcut.clone();
                            tauri::async_runtime::spawn(async move {
                                let current_status = state.status.lock().await.clone();
                                match current_status {
                                    AppStatus::Paused => {
                                        let _ = state.control_tx.send(ControlCommand::Resume).await;
                                    }
                                    _ => {
                                        let _ = state.control_tx.send(ControlCommand::Pause).await;
                                    }
                                }
                            });
                        }
                    })
                    .build()
            )?;

            if let Err(e) = app.global_shortcut().register("Ctrl+Shift+V") {
                eprintln!("[MAIN ERROR] Failed to register global shortcut Ctrl+Shift+V: {}. It may be already in use by another instance of VoiceType or another application.", e);
            }

            let args: Vec<String> = std::env::args().collect();
            if args.iter().any(|arg| arg == "--minimized") {
                if let Some(window) = app.get_webview_window("main") {
                    window.hide().ok();
                }
            }

            let (rx, stream) = audio::spawn_audio_pipeline(&audio_config_clone)
                .expect("Failed to start audio pipeline");

            // Prevents Stream from being dropped from memory (leaked to the heap)
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
            commands::check_cuda_installed,
            commands::uninstall_cuda_libs,
            commands::check_gpu_support,
            commands::get_free_disk_space,
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
            commands::open_url,
            commands::get_session_stats,
            commands::get_app_version_info,
            commands::open_config_directory,
            commands::hard_reset_config,
            commands::check_show_first_start,
            commands::check_show_changelog
        ])
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "main" {
                    window.hide().unwrap();
                    api.prevent_close();
                    crate::notification::show_custom_notification(window.app_handle(), "tray");
                }
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


