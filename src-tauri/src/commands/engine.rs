// src-tauri/src/commands/engine.rs
//
// Single Responsibility: Tauri command handlers for listing, selecting, and verifying
// connectivity of speech recognition engines (Vosk, Whisper, Deepgram, AssemblyAI, etc.).

use tauri::State;
use std::sync::Arc;
use crate::AppState;
use crate::ControlCommand;
use crate::recognition::SpeechEngine;
use crate::recognition::engine_manager::EngineInfo;

#[derive(serde::Serialize)]
pub struct TestEngineResult {
    pub key: String,
    pub engine: String,
    pub error_detail: Option<String>,
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
