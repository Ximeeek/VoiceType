use tauri::{Manager, State, Emitter};
use std::sync::Arc;
use crate::AppState;
use crate::config::Config;
use crate::ControlCommand;
use crate::recognition::engine_manager::EngineInfo;
use crate::recognition::SpeechEngine;
use crate::audio::capture::AudioDevice;

#[tauri::command]
pub async fn get_config(state: State<'_, Arc<AppState>>) -> Result<Config, String> {
    Ok(state.config.lock().await.clone())
}

#[tauri::command]
pub async fn save_config(state: State<'_, Arc<AppState>>, app: tauri::AppHandle, config: Config) -> Result<(), String> {
    let mut config_lock = state.config.lock().await;

    let trigger_changed = config.trigger.words != config_lock.trigger.words;
    let stop_words_changed = config.dictation.stop_words != config_lock.dictation.stop_words;
    let silence_changed = config.dictation.silence_timeout_ms != config_lock.dictation.silence_timeout_ms;
    let translate_changed = config.trigger.translate != config_lock.trigger.translate;
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
pub async fn reset_config(state: State<'_, Arc<AppState>>, app: tauri::AppHandle) -> Result<Config, String> {
    let default = crate::config::default_config();
    crate::config::save_config(&default).map_err(|e| e.to_string())?;
    *state.config.lock().await = default.clone();
    
    state.control_tx.send(ControlCommand::SetTriggerWords(default.trigger.words.clone())).await.ok();
    state.control_tx.send(ControlCommand::SetStopWords(default.dictation.stop_words.clone())).await.ok();
    state.control_tx.send(ControlCommand::SetSilenceTimeout(default.dictation.silence_timeout_ms)).await.ok();
    state.control_tx.send(ControlCommand::SetLanguage(default.general.language.clone())).await.ok();
    state.control_tx.send(ControlCommand::SetEngine(default.engine.engine_type.clone())).await.ok();
    
    let _ = crate::tray::rebuild_tray_menu(&app);

    Ok(default)
}

#[tauri::command]
pub async fn list_engines(state: State<'_, Arc<AppState>>) -> Result<Vec<EngineInfo>, String> {
    let config = state.config.lock().await;
    Ok(crate::recognition::engine_manager::EngineManager::list_engines(&config.engine))
}

#[tauri::command]
pub async fn set_engine(state: State<'_, Arc<AppState>>, engine_type: String) -> Result<(), String> {
    {
        let mut config = state.config.lock().await;
        config.engine.engine_type = engine_type.clone();
        crate::config::save_config(&config).map_err(|e| e.to_string())?;
    }
    state.control_tx.send(ControlCommand::SetEngine(engine_type)).await.map_err(|e| e.to_string())?;
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

#[derive(serde::Serialize)]
pub struct TestEngineResult {
    pub key: String,
    pub engine: String,
    pub error_detail: Option<String>,
}

#[tauri::command]
pub async fn test_engine(state: State<'_, Arc<AppState>>, engine_type: Option<String>) -> Result<TestEngineResult, TestEngineResult> {
    let config = state.config.lock().await;
    let target_id = engine_type.unwrap_or_else(|| config.engine.engine_type.clone());
    let engines = crate::recognition::engine_manager::EngineManager::list_engines(&config.engine);
    let target_engine = engines.iter().find(|e| e.id == target_id);
    match target_engine {
        Some(e) if e.is_available => {
            match e.id.as_str() {
                "deepgram" => {
                    let mut engine = crate::recognition::online::DeepgramEngine::new(&config.engine.deepgram, &config.general.language)
                        .map_err(|err| TestEngineResult {
                            key: "toast.engine.connection_failed".to_string(),
                            engine: e.name.clone(),
                            error_detail: Some(err.to_string()),
                        })?;
                    engine.start_stream().await.map_err(|err| TestEngineResult {
                        key: "toast.engine.connection_failed".to_string(),
                        engine: e.name.clone(),
                        error_detail: Some(err.to_string()),
                    })?;
                    Ok(TestEngineResult {
                        key: "toast.engine.connected".to_string(),
                        engine: e.name.clone(),
                        error_detail: None,
                    })
                }
                "assemblyai" => {
                    let client = reqwest::Client::new();
                    let res = client.get("https://api.assemblyai.com/v2/transcript?limit=1")
                        .header("Authorization", &config.engine.assemblyai.api_key)
                        .send().await
                        .map_err(|err| TestEngineResult {
                            key: "toast.engine.connection_failed".to_string(),
                            engine: e.name.clone(),
                            error_detail: Some(err.to_string()),
                        })?;
                    if !res.status().is_success() {
                        return Err(TestEngineResult {
                            key: "toast.engine.api_key_invalid".to_string(),
                            engine: e.name.clone(),
                            error_detail: None,
                        });
                    }
                    Ok(TestEngineResult {
                        key: "toast.engine.api_key_valid".to_string(),
                        engine: e.name.clone(),
                        error_detail: None,
                    })
                }
                "openai" => {
                    let client = reqwest::Client::new();
                    let res = client.get("https://api.openai.com/v1/models")
                        .header("Authorization", format!("Bearer {}", config.engine.openai.api_key))
                        .send().await
                        .map_err(|err| TestEngineResult {
                            key: "toast.engine.connection_failed".to_string(),
                            engine: e.name.clone(),
                            error_detail: Some(err.to_string()),
                        })?;
                    if !res.status().is_success() {
                        return Err(TestEngineResult {
                            key: "toast.engine.api_key_invalid".to_string(),
                            engine: e.name.clone(),
                            error_detail: None,
                        });
                    }
                    Ok(TestEngineResult {
                        key: "toast.engine.api_key_valid".to_string(),
                        engine: e.name.clone(),
                        error_detail: None,
                    })
                }
                "google" => {
                    let key = if std::path::Path::new(&config.engine.google.credentials_path).exists() {
                        std::fs::read_to_string(&config.engine.google.credentials_path).unwrap_or_default().trim().to_string()
                    } else {
                        config.engine.google.credentials_path.trim().to_string()
                    };
                    let client = reqwest::Client::new();
                    let url = format!("https://speech.googleapis.com/v1/speech:recognize?key={}", key);
                    let res = client.post(&url).json(&serde_json::json!({})).send().await
                        .map_err(|err| TestEngineResult {
                            key: "toast.engine.connection_failed".to_string(),
                            engine: e.name.clone(),
                            error_detail: Some(err.to_string()),
                        })?;
                    let status = res.status().as_u16();
                    if status == 403 || status == 401 {
                        Err(TestEngineResult {
                            key: "toast.engine.google_key_unauthorized".to_string(),
                            engine: e.name.clone(),
                            error_detail: None,
                        })
                    } else {
                        let text = res.text().await.unwrap_or_default();
                        if text.contains("API key not valid") || text.contains("API_KEY_INVALID") {
                            Err(TestEngineResult {
                                key: "toast.engine.google_key_invalid".to_string(),
                                engine: e.name.clone(),
                                error_detail: None,
                            })
                        } else {
                            Ok(TestEngineResult {
                                key: "toast.engine.api_key_valid".to_string(),
                                engine: e.name.clone(),
                                error_detail: None,
                            })
                        }
                    }
                }
                "azure" => {
                    let mut engine = crate::recognition::online::AzureSpeechEngine::new(&config.engine.azure, &config.general.language)
                        .map_err(|err| TestEngineResult {
                            key: "toast.engine.connection_failed".to_string(),
                            engine: e.name.clone(),
                            error_detail: Some(err.to_string()),
                        })?;
                    engine.start_stream().await.map_err(|err| TestEngineResult {
                        key: "toast.engine.connection_failed".to_string(),
                        engine: e.name.clone(),
                        error_detail: Some(err.to_string()),
                    })?;
                    Ok(TestEngineResult {
                        key: "toast.engine.connected".to_string(),
                        engine: e.name.clone(),
                        error_detail: None,
                    })
                }
                _ => Ok(TestEngineResult {
                    key: "toast.engine.available".to_string(),
                    engine: e.name.clone(),
                    error_detail: None,
                }),
            }
        }
        Some(e) => Err(TestEngineResult {
            key: "toast.engine.unavailable".to_string(),
            engine: e.name.clone(),
            error_detail: None,
        }),
        None => Err(TestEngineResult {
            key: "toast.engine.no_active".to_string(),
            engine: "".to_string(),
            error_detail: None,
        }),
    }
}

#[tauri::command]
pub async fn download_model(app: tauri::AppHandle, state: State<'_, Arc<AppState>>, engine: String, model: String) -> Result<(), String> {
    let models_dir = crate::downloader::model_registry::get_models_dir();
    
    // Pobierz informacje o modelu, zeby wiedziec jaki bedzie folder docelowy
    let info = crate::downloader::model_registry::get_model_info(&engine, &model).await
        .map_err(|e| format!("Nieznany model: {} {} ({})", engine, model, e))?;
        
    crate::downloader::download_model(app, &engine, &model, &models_dir).await.map_err(|e| e.to_string())?;
    
    // Zaktualizuj ścieżkę do modelu w konfiguracji
    let mut config = state.config.lock().await;
    if engine == "vosk" {
        let new_path = format!("models/{}", info.dest_filename);
        config.engine.vosk.model_path = new_path;
    } else if engine == "sherpa_onnx" {
        let new_path = format!("models/{}", info.dest_filename);
        config.engine.sherpa_onnx.model_path = new_path;
    } else if engine == "whisper" || engine == "faster_whisper" {
        config.engine.whisper.model = model.clone();
    }
    crate::config::save_config(&config).ok();
    
    Ok(())
}

#[tauri::command]
pub fn check_model_downloaded(engine: String, model: String) -> bool {
    let models_dir = crate::downloader::model_registry::get_models_dir();
    let clean_model = model.split('/').next_back().unwrap_or(&model).split('\\').next_back().unwrap_or(&model);
    if engine == "vosk" {
        models_dir.join("vosk").join(clean_model).is_dir()
    } else if engine == "sherpa_onnx" {
        models_dir.join("sherpa").join(clean_model).is_dir()
    } else {
        models_dir.join("whisper").join(format!("ggml-{}.bin", clean_model)).is_file()
    }
}

#[tauri::command]
pub async fn get_model_info_cmd(engine: String, model: String) -> Result<crate::downloader::model_registry::ModelInfo, String> {
    crate::downloader::model_registry::get_model_info(&engine, &model).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_available_models(state: State<'_, Arc<AppState>>, engine: String, language: Option<String>) -> Result<Vec<crate::downloader::model_registry::AvailableModel>, String> {
    if engine == "vosk" {
        let config = state.config.lock().await;
        let lang = language.unwrap_or_else(|| config.general.language.clone());
        Ok(crate::downloader::model_registry::fetch_available_vosk_models(&config.engine.vosk.model_path, &lang).await)
    } else if engine == "sherpa_onnx" {
        let config = state.config.lock().await;
        let lang = language.unwrap_or_else(|| config.general.language.clone());
        Ok(crate::downloader::model_registry::fetch_available_sherpa_models(&config.engine.sherpa_onnx.model_path, &lang).await)
    } else {
        // Whisper fallback list
        let models_dir = crate::downloader::model_registry::get_models_dir().join("whisper");
        let active_model = {
            let config = state.config.lock().await;
            config.engine.whisper.model.clone()
        };
        
        let mut list = Vec::new();
        for name in &["tiny", "base", "small", "medium", "large-v3"] {
            let filename = format!("ggml-{}.bin", name);
            let path = models_dir.join(&filename);
            let size_bytes = match *name {
                "tiny" => 77_691_713,
                "base" => 147_951_465,
                "small" => 487_000_000,
                "medium" => 1_500_000_000,
                "large-v3" => 3_000_000_000,
                _ => 0
            };
            list.push(crate::downloader::model_registry::AvailableModel {
                id: name.to_string(),
                name: format!("Whisper {}", name),
                size_text: match *name {
                    "tiny" => "77 MB",
                    "base" => "147 MB",
                    "small" => "487 MB",
                    "medium" => "1.5 GB",
                    "large-v3" => "3.0 GB",
                    _ => "N/A"
                }.to_string(),
                is_downloaded: path.is_file(),
                is_active: *name == active_model,
                size_bytes,
            });
        }
        Ok(list)
    }
}

#[tauri::command]
pub fn check_python_installed() -> bool {
    crate::downloader::python_installer::is_python_available()
}

#[tauri::command]
pub async fn install_python_env(app: tauri::AppHandle) -> Result<(), String> {
    crate::downloader::python_installer::install_portable_python(app).await
}

#[tauri::command]
pub async fn install_cuda_libs(app: tauri::AppHandle) -> Result<(), String> {
    let python_exe = std::path::Path::new("..").join("python_embed").join("python.exe");
    if !python_exe.exists() {
        return Err("Python environment not installed. Install Whisper first.".into());
    }
    
    app.emit("python_install_progress", crate::downloader::python_installer::InstallProgress {
        step: "Instalowanie bibliotek CUDA w środowisku Python (nvidia-cublas-cu12, nvidia-cudnn-cu12)... To potrwa kilka minut.".to_string(),
        step_key: Some("addons.cuda.step.installing".to_string()),
        percent: 50.0,
        done: false,
        error: None,
    }).ok();

    let mut cmd = std::process::Command::new(&python_exe);
    cmd.args(["-m", "pip", "install", "nvidia-cublas-cu12", "nvidia-cudnn-cu12"]);
    crate::platform::suppress_console_in_release(&mut cmd);
    let output = cmd.output();

    match output {
        Ok(out) => {
            if out.status.success() {
                app.emit("python_install_progress", crate::downloader::python_installer::InstallProgress {
                    step: "Biblioteki CUDA zainstalowane pomyślnie!".to_string(),
                    step_key: Some("addons.cuda.step.installed".to_string()),
                    percent: 100.0,
                    done: true,
                    error: None,
                }).ok();
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                let err = format!("Błąd pip: {}", stderr);
                app.emit("python_install_progress", crate::downloader::python_installer::InstallProgress {
                    step: "Instalacja bibliotek CUDA nie powiodła się".to_string(),
                    step_key: Some("addons.cuda.step.install_failed".to_string()),
                    percent: 0.0,
                    done: false,
                    error: Some(err.clone()),
                }).ok();
                Err(err)
            }
        }
        Err(e) => {
            let err = format!("Failed to run pip: {}", e);
            app.emit("python_install_progress", crate::downloader::python_installer::InstallProgress {
                step: "Błąd uruchomienia instalacji".to_string(),
                step_key: Some("addons.cuda.step.run_failed".to_string()),
                percent: 0.0,
                done: false,
                error: Some(err.clone()),
            }).ok();
            Err(err)
        }
    }
}

#[tauri::command]
pub fn check_cuda_installed() -> bool {
    let dev_site_packages = std::path::Path::new("..")
        .join("python_embed")
        .join("Lib")
        .join("site-packages");
    
    let rel_site_packages = std::path::Path::new("python_embed")
        .join("Lib")
        .join("site-packages");

    let site_packages = if dev_site_packages.exists() {
        dev_site_packages
    } else {
        rel_site_packages
    };

    if !site_packages.exists() {
        return false;
    }

    let mut has_cublas = false;
    let mut has_cudnn = false;

    if let Ok(entries) = std::fs::read_dir(site_packages) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() {
                    let name = entry.file_name().to_string_lossy().to_lowercase();
                    if name.starts_with("nvidia_cublas_cu12-") {
                        has_cublas = true;
                    }
                    if name.starts_with("nvidia_cudnn_cu12-") {
                        has_cudnn = true;
                    }
                }
            }
        }
    }

    has_cublas && has_cudnn
}

#[tauri::command]
pub async fn uninstall_cuda_libs(app: tauri::AppHandle) -> Result<(), String> {
    let dev_python = std::path::Path::new("..").join("python_embed").join("python.exe");
    let rel_python = std::path::Path::new("python_embed").join("python.exe");
    let python_exe = if dev_python.exists() {
        dev_python
    } else {
        rel_python
    };

    if !python_exe.exists() {
        return Err("Python environment not installed.".into());
    }
    
    app.emit("python_install_progress", crate::downloader::python_installer::InstallProgress {
        step: "Odinstalowywanie bibliotek CUDA ze środowiska Python...".to_string(),
        step_key: Some("addons.cuda.step.uninstalling".to_string()),
        percent: 50.0,
        done: false,
        error: None,
    }).ok();

    #[cfg(windows)]
    let mut cmd = std::process::Command::new(&python_exe);
    #[cfg(not(windows))]
    let mut cmd = std::process::Command::new("python3");

    crate::platform::suppress_console_in_release(&mut cmd);

    let output = cmd
        .args(["-m", "pip", "uninstall", "-y", "nvidia-cublas-cu12", "nvidia-cudnn-cu12"])
        .output();

    match output {
        Ok(out) => {
            if out.status.success() {
                app.emit("python_install_progress", crate::downloader::python_installer::InstallProgress {
                    step: "Biblioteki CUDA zostały pomyślnie usunięte!".to_string(),
                    step_key: Some("addons.cuda.step.uninstalled".to_string()),
                    percent: 100.0,
                    done: true,
                    error: None,
                }).ok();
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                let err = format!("Błąd pip: {}", stderr);
                app.emit("python_install_progress", crate::downloader::python_installer::InstallProgress {
                    step: "Usuwanie bibliotek CUDA nie powiodło się".to_string(),
                    step_key: Some("addons.cuda.step.uninstall_failed".to_string()),
                    percent: 0.0,
                    done: false,
                    error: Some(err.clone()),
                }).ok();
                Err(err)
            }
        }
        Err(e) => {
            let err = format!("Failed to run pip: {}", e);
            app.emit("python_install_progress", crate::downloader::python_installer::InstallProgress {
                step: "Błąd uruchomienia deinstalacji".to_string(),
                step_key: Some("addons.cuda.step.uninstall_run_failed".to_string()),
                percent: 0.0,
                done: false,
                error: Some(err.clone()),
            }).ok();
            Err(err)
        }
    }
}

#[tauri::command]
pub fn check_gpu_support() -> bool {
    #[cfg(windows)]
    {
        let mut cmd = std::process::Command::new("powershell");
        cmd.args([
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"
        ]);
        crate::platform::suppress_console_in_release(&mut cmd);
        let output = cmd.output();

        if let Ok(out) = output {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            stdout.to_lowercase().contains("nvidia")
        } else {
            false
        }
    }
    #[cfg(not(windows))]
    {
        false
    }
}

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
pub async fn quit(app: tauri::AppHandle) -> Result<(), String> { 
    app.exit(0); 
    Ok(()) 
}

#[tauri::command]
pub async fn minimize_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.minimize().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn hide_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
        crate::show_custom_notification(&app, "tray");
    }
    Ok(())
}

#[tauri::command]
pub fn get_installed_models_summary() -> Vec<crate::downloader::model_registry::InstalledEngineGroup> {
    crate::downloader::model_registry::get_installed_models_summary()
}

#[tauri::command]
pub fn delete_installed_model(engine: String, model: Option<String>) -> Result<(), String> {
    crate::downloader::model_registry::delete_installed_model(&engine, model.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cleanup_model_tmp_files(engine: String, model: String) -> Result<(), String> {
    crate::downloader::model_registry::cleanup_model_tmp_files(&engine, &model).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_session_stats(state: State<'_, Arc<AppState>>) -> Result<crate::SessionStats, String> {
    Ok(state.session_stats.lock().await.clone())
}

