// src-tauri/src/commands/model.rs
//
// Single Responsibility: Tauri command handlers for downloading and checking models,
// managing python environments, CUDA library integration, GPU status checks, and model cleanups.

use tauri::{State, AppHandle, Emitter};
use std::sync::Arc;
use crate::AppState;
use crate::downloader::model_registry::{ModelInfo, AvailableModel, InstalledEngineGroup};

#[tauri::command]
pub async fn download_model(app: AppHandle, state: State<'_, Arc<AppState>>, engine: String, model: String) -> Result<(), String> {
    let models_dir = crate::downloader::model_registry::get_models_dir();
    
    // Get model info to know what the target folder will be
    let info = crate::downloader::model_registry::get_model_info(&engine, &model).await
        .map_err(|e| format!("Unknown model: {} {} ({})", engine, model, e))?;
        
    crate::downloader::download_model(app, &engine, &model, &models_dir).await.map_err(|e| e.to_string())?;
    
    // Update the model path in the configuration
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
        let dir = models_dir.join("vosk").join(clean_model);
        if !dir.is_dir() {
            return false;
        }
        fn has_model_file(d: &std::path::Path) -> bool {
            if let Ok(entries) = std::fs::read_dir(d) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        let name = path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
                        if name == "final.mdl" || name.ends_with(".mdl") || name.ends_with(".fst") || name == "final.ie" {
                            return true;
                        }
                    } else if path.is_dir() {
                        if has_model_file(&path) {
                            return true;
                        }
                    }
                }
            }
            false
        }
        has_model_file(&dir)
    } else if engine == "sherpa_onnx" {
        let dir = models_dir.join("sherpa").join(clean_model);
        if !dir.is_dir() {
            return false;
        }
        fn has_onnx_file(d: &std::path::Path) -> bool {
            if let Ok(entries) = std::fs::read_dir(d) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        if path.extension().map_or(false, |ext| ext == "onnx") {
                            return true;
                        }
                    } else if path.is_dir() {
                        if has_onnx_file(&path) {
                            return true;
                        }
                    }
                }
            }
            false
        }
        has_onnx_file(&dir)
    } else {
        models_dir.join("whisper").join(format!("ggml-{}.bin", clean_model)).is_file()
    }
}

#[tauri::command]
pub async fn get_model_info_cmd(engine: String, model: String) -> Result<ModelInfo, String> {
    crate::downloader::model_registry::get_model_info(&engine, &model).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_available_models(state: State<'_, Arc<AppState>>, engine: String, language: Option<String>) -> Result<Vec<AvailableModel>, String> {
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
            list.push(AvailableModel {
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
pub async fn install_python_env(app: AppHandle) -> Result<(), String> {
    crate::downloader::python_installer::install_portable_python(app).await
}

#[tauri::command]
pub async fn install_cuda_libs(app: AppHandle) -> Result<(), String> {
    let python_exe = crate::downloader::python_installer::get_python_embed_dir().join("python.exe");
    if !python_exe.exists() {
        return Err("Python environment not installed. Install Whisper first.".into());
    }
    
    app.emit("python_install_progress", crate::downloader::python_installer::InstallProgress {
        step: "Installing CUDA libraries in Python environment (nvidia-cublas-cu12, nvidia-cudnn-cu12)... This will take a few minutes.".to_string(),
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
                    step: "CUDA libraries installed successfully!".to_string(),
                    step_key: Some("addons.cuda.step.installed".to_string()),
                    percent: 100.0,
                    done: true,
                    error: None,
                }).ok();
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                let err = format!("Pip error: {}", stderr);
                app.emit("python_install_progress", crate::downloader::python_installer::InstallProgress {
                    step: "CUDA libraries installation failed".to_string(),
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
                step: "Installation execution error".to_string(),
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
    let site_packages = crate::downloader::python_installer::get_python_embed_dir()
        .join("Lib")
        .join("site-packages");

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
pub async fn uninstall_cuda_libs(app: AppHandle) -> Result<(), String> {
    let python_exe = crate::downloader::python_installer::get_python_embed_dir().join("python.exe");

    if !python_exe.exists() {
        return Err("Python environment not installed.".into());
    }
    
    app.emit("python_install_progress", crate::downloader::python_installer::InstallProgress {
        step: "Uninstalling CUDA libraries from Python environment...".to_string(),
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
                    step: "CUDA libraries uninstalled successfully!".to_string(),
                    step_key: Some("addons.cuda.step.uninstalled".to_string()),
                    percent: 100.0,
                    done: true,
                    error: None,
                }).ok();
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                let err = format!("Pip error: {}", stderr);
                app.emit("python_install_progress", crate::downloader::python_installer::InstallProgress {
                    step: "CUDA libraries uninstallation failed".to_string(),
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
                step: "Uninstallation execution error".to_string(),
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
pub fn get_installed_models_summary() -> Vec<InstalledEngineGroup> {
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
