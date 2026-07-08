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

use config::load_config;
use recognition::engine_manager::EngineManager;
use hotword::run_control_loop;
use tauri::{Manager, Emitter};
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
    let engine_config_clone = initial_config.engine.clone();
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
                    show_custom_notification(window.app_handle(), "tray");
                }
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use std::sync::atomic::{AtomicU64, Ordering};
static LAST_NO_INPUT_NOTIF_TIME: AtomicU64 = AtomicU64::new(0);

fn get_now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub fn handle_no_input_notification(app: &tauri::AppHandle) {
    let main_window = app.get_webview_window("main");
    let is_minimized_or_hidden = match main_window {
        Some(ref window) => {
            let is_min = window.is_minimized().unwrap_or(false);
            let is_vis = window.is_visible().unwrap_or(true);
            let is_foc = window.is_focused().unwrap_or(true);
            println!("[NO_INPUT_NOTIF] main_window: is_min={}, is_vis={}, is_foc={}", is_min, is_vis, is_foc);
            is_min || !is_vis || !is_foc
        }
        None => true,
    };

    println!("[NO_INPUT_NOTIF] Final decision: is_minimized_or_hidden={}", is_minimized_or_hidden);

    if is_minimized_or_hidden {
        show_custom_notification(app, "no_input");
    } else {
        let _ = app.emit("no_input_copied", ());
    }
}

pub fn show_custom_notification(app: &tauri::AppHandle, notif_type: &str) {
    let now = get_now_ms();

    if notif_type == "no_input" {
        LAST_NO_INPUT_NOTIF_TIME.store(now, Ordering::Relaxed);
    } else if notif_type == "tray" {
        let last_no_input = LAST_NO_INPUT_NOTIF_TIME.load(Ordering::Relaxed);
        if now.saturating_sub(last_no_input) < 3500 {
            println!("[NOTIFICATION] Suppressing 'tray' notification because 'no_input' was recently shown.");
            return;
        }
    }

    println!("[NOTIFICATION] Triggering custom system notification: type='{}'", notif_type);
    let notif_type_string = notif_type.to_string();

    if let Some(existing) = app.get_webview_window("notification") {
        println!("[NOTIFICATION] Reusing existing notification window with type: '{}'", notif_type);
        let _ = existing.emit("show_notification", notif_type_string);
        if let Ok(Some(monitor)) = existing.primary_monitor() {
            let size = monitor.size();
            let scale_factor = monitor.scale_factor();
            let width = 360.0;
            let height = 96.0;
            let x = (size.width as f64 / scale_factor) - width - 20.0;
            let y = (size.height as f64 / scale_factor) - height - 60.0;
            let _ = existing.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(x, y)));
        }
        let _ = existing.show();
        return;
    }

    let app_clone = app.clone();
    let mut url_str = format!("notification.html?type={}", notif_type);

    if let Some(state) = app.try_state::<std::sync::Arc<crate::AppState>>() {
        if let Ok(config) = state.config.try_lock() {
            let ui = &config.ui;
            let main_color = ui.accent_custom_main.replace('#', "%23");
            let sec_color = ui.accent_custom_sec.replace('#', "%23");
            url_str = format!(
                "notification.html?type={}&theme={}&accent_preset={}&dual_accent={}&accent_custom_main={}&accent_custom_sec={}",
                notif_type,
                ui.theme,
                ui.accent_preset,
                ui.dual_accent,
                main_color,
                sec_color
            );
        }
    }

    match tauri::WebviewWindowBuilder::new(
        app,
        "notification",
        tauri::WebviewUrl::App(url_str.into())
    )
    .title("VoiceType Notification")
    .decorations(false)
    .transparent(true)
    .shadow(false)
    .skip_taskbar(true)
    .always_on_top(true)
    .resizable(false)
    .inner_size(360.0, 96.0)
    .visible(false)
    .focused(false)
    .build() {
        Ok(window) => {
            #[cfg(windows)]
            {
                use windows::Win32::UI::WindowsAndMessaging::{
                    GetWindowLongW, SetWindowLongW, GWL_EXSTYLE, WS_EX_NOACTIVATE
                };
                if let Ok(hwnd) = window.hwnd() {
                    unsafe {
                        let our_hwnd = windows::Win32::Foundation::HWND(hwnd.0 as *mut _);
                        let ex_style = GetWindowLongW(our_hwnd, GWL_EXSTYLE);
                        let _ = SetWindowLongW(our_hwnd, GWL_EXSTYLE, ex_style | WS_EX_NOACTIVATE.0 as i32);
                    }
                }
            }

            if let Ok(Some(monitor)) = window.primary_monitor() {
                let size = monitor.size();
                let scale_factor = monitor.scale_factor();
                let width = 360.0;
                let height = 96.0;
                let x = (size.width as f64 / scale_factor) - width - 20.0;
                let y = (size.height as f64 / scale_factor) - height - 60.0;
                let _ = window.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(x, y)));
                let _ = window.show();
            } else {
                let _ = window.show();
            }

            // Auto-close after 4 seconds
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(4000)).await;
                if let Some(w) = app_clone.get_webview_window("notification") {
                    let _ = w.close();
                }
            });
        }
        Err(err) => {
            eprintln!("[NOTIFICATION_ERROR] Failed to build notification window: {}", err);
        }
    }
}
