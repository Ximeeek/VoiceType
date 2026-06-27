use crate::config::Config;
use crate::recognition::offline::faster_whisper::FasterWhisperEngine;
use crate::recognition::offline::sherpa_onnx::SherpaOnnxEngine;
use crate::recognition::offline::vosk_engine::VoskEngine;
use crate::recognition::offline::whisper_engine::WhisperEngine;
use crate::recognition::online::{
    AssemblyAiEngine, AzureSpeechEngine, DeepgramEngine, GoogleSpeechEngine, OpenAiWhisperEngine,
};
use super::{SpeechEngine, Transcript};
use std::path::Path;

#[derive(Debug, Clone, serde::Serialize)]
pub struct EngineInfo {
    pub id: String,
    pub name: String,
    pub supports_streaming: bool,
    pub is_available: bool,
    pub is_active: bool,
}

pub struct EngineManager {
    active: Option<Box<dyn SpeechEngine>>,
    pub active_type: String,
}

impl EngineManager {
    pub async fn new(config: &Config) -> anyhow::Result<Self> {
        println!(
            "[ENGINE_MANAGER] Starting up. Active Engine: {}, Language: {}, Vosk model path: {}, Whisper model: {}, use_gpu: {}",
            config.engine.engine_type, config.general.language, config.engine.vosk.model_path, config.engine.whisper.model, config.engine.whisper.use_gpu
        );

        let mut model_path = Path::new(&config.engine.vosk.model_path).to_path_buf();
        if !model_path.exists() {
            let alt_path = Path::new("..").join(&config.engine.vosk.model_path);
            if alt_path.exists() {
                model_path = alt_path;
            }
        }

        let engine_opt = match config.engine.engine_type.as_str() {
            "vosk" => match VoskEngine::new(&model_path.to_string_lossy()) {
                Ok(e) => Some(Box::new(e) as Box<dyn SpeechEngine>),
                Err(err) => {
                    eprintln!("[ENGINE] Could not load Vosk engine on startup: {}", err);
                    None
                }
            },
            "whisper" => {
                let model_name = format!("ggml-{}.bin", config.engine.whisper.model);
                let mut path = Path::new("models").join("whisper").join(&model_name);
                if !path.exists() {
                    path = Path::new("..").join("models").join("whisper").join(&model_name);
                }
                match WhisperEngine::new(&path.to_string_lossy(), config.engine.whisper.use_gpu, &config.general.language) {
                    Ok(e) => Some(Box::new(e) as Box<dyn SpeechEngine>),
                    Err(err) => {
                        eprintln!("[ENGINE] Could not load Whisper.cpp: {}", err);
                        None
                    }
                }
            }
            "faster_whisper" => {
                let whisper_model = config.engine.whisper.model.clone();
                let device = if config.engine.whisper.use_gpu { "cuda" } else { "cpu" };
                match FasterWhisperEngine::new(&whisper_model, device, &config.general.language) {
                    Ok(e) => Some(Box::new(e) as Box<dyn SpeechEngine>),
                    Err(err) => {
                        eprintln!("[ENGINE] Could not load Faster-Whisper: {}", err);
                        None
                    }
                }
            }
            "sherpa_onnx" => {
                let mut path = Path::new(&config.engine.sherpa_onnx.model_path).to_path_buf();
                if !path.exists() {
                    let alt_path = Path::new("..").join(&config.engine.sherpa_onnx.model_path);
                    if alt_path.exists() {
                        path = alt_path;
                    }
                }
                match SherpaOnnxEngine::new(&path.to_string_lossy(), &config.general.language) {
                    Ok(e) => Some(Box::new(e) as Box<dyn SpeechEngine>),
                    Err(err) => {
                        eprintln!("[ENGINE] Could not load Sherpa-ONNX: {}", err);
                        None
                    }
                }
            }
            "deepgram" => match DeepgramEngine::new(&config.engine.deepgram, &config.general.language) {
                Ok(e) => Some(Box::new(e) as Box<dyn SpeechEngine>),
                Err(err) => {
                    eprintln!("[ENGINE] Could not load Deepgram engine on startup: {}", err);
                    None
                }
            },
            "assemblyai" => match AssemblyAiEngine::new(&config.engine.assemblyai, &config.general.language) {
                Ok(e) => Some(Box::new(e) as Box<dyn SpeechEngine>),
                Err(err) => {
                    eprintln!("[ENGINE] Could not load AssemblyAI engine on startup: {}", err);
                    None
                }
            },
            "openai" => match OpenAiWhisperEngine::new(&config.engine.openai, &config.general.language) {
                Ok(e) => Some(Box::new(e) as Box<dyn SpeechEngine>),
                Err(err) => {
                    eprintln!("[ENGINE] Could not load OpenAI Whisper engine on startup: {}", err);
                    None
                }
            },
            "google" => match GoogleSpeechEngine::new(&config.engine.google, &config.general.language) {
                Ok(e) => Some(Box::new(e) as Box<dyn SpeechEngine>),
                Err(err) => {
                    eprintln!("[ENGINE] Could not load Google STT engine on startup: {}", err);
                    None
                }
            },
            "azure" => match AzureSpeechEngine::new(&config.engine.azure, &config.general.language) {
                Ok(e) => Some(Box::new(e) as Box<dyn SpeechEngine>),
                Err(err) => {
                    eprintln!("[ENGINE] Could not load Azure Speech engine on startup: {}", err);
                    None
                }
            },
            _ => None,
        };
        Ok(Self {
            active: engine_opt,
            active_type: config.engine.engine_type.clone(),
        })
    }

    pub async fn start_stream(&mut self) -> anyhow::Result<()> {
        if let Some(engine) = &mut self.active {
            engine.start_stream().await
        } else {
            Ok(())
        }
    }

    pub async fn feed_audio(&mut self, samples: &[f32]) -> anyhow::Result<Option<Transcript>> {
        if let Some(engine) = &mut self.active {
            engine.feed_audio(samples).await
        } else {
            Ok(None)
        }
    }

    pub async fn finalize(&mut self) -> anyhow::Result<String> {
        if let Some(engine) = &mut self.active {
            engine.finalize().await
        } else {
            Ok(String::new())
        }
    }

    pub fn list_engines(config: &crate::config::settings::EngineConfig) -> Vec<EngineInfo> {
        let small_path = Path::new("..").join("models").join("vosk").join("vosk-model-small-pl-0.22");
        let std_path = Path::new("..").join("models").join("vosk").join("vosk-model-pl-0.22");
        let config_path = Path::new(&config.vosk.model_path).to_path_buf();

        let vosk_available = small_path.is_dir() || std_path.is_dir() || config_path.is_dir();

        vec![
            EngineInfo {
                id: "vosk".to_string(),
                name: "Vosk Offline".to_string(),
                supports_streaming: true,
                is_available: vosk_available,
                is_active: config.engine_type == "vosk",
            },
            EngineInfo {
                id: "sherpa_onnx".to_string(),
                name: "Sherpa-ONNX".to_string(),
                supports_streaming: true,
                is_available: true,
                is_active: config.engine_type == "sherpa_onnx",
            },
            EngineInfo {
                id: "whisper".to_string(),
                name: "Whisper.cpp".to_string(),
                supports_streaming: false,
                is_available: true,
                is_active: config.engine_type == "whisper",
            },
            EngineInfo {
                id: "faster_whisper".to_string(),
                name: "Faster-Whisper".to_string(),
                supports_streaming: false,
                is_available: true,
                is_active: config.engine_type == "faster_whisper",
            },
            EngineInfo {
                id: "deepgram".to_string(),
                name: "Deepgram".to_string(),
                supports_streaming: true,
                is_available: !config.deepgram.api_key.trim().is_empty(),
                is_active: config.engine_type == "deepgram",
            },
            EngineInfo {
                id: "assemblyai".to_string(),
                name: "AssemblyAI".to_string(),
                supports_streaming: true,
                is_available: !config.assemblyai.api_key.trim().is_empty(),
                is_active: config.engine_type == "assemblyai",
            },
            EngineInfo {
                id: "openai".to_string(),
                name: "OpenAI Whisper".to_string(),
                supports_streaming: false,
                is_available: !config.openai.api_key.trim().is_empty(),
                is_active: config.engine_type == "openai",
            },
            EngineInfo {
                id: "google".to_string(),
                name: "Google Cloud STT".to_string(),
                supports_streaming: false,
                is_available: !config.google.credentials_path.trim().is_empty(),
                is_active: config.engine_type == "google",
            },
            EngineInfo {
                id: "azure".to_string(),
                name: "Azure Speech".to_string(),
                supports_streaming: true,
                is_available: !config.azure.subscription_key.trim().is_empty(),
                is_active: config.engine_type == "azure",
            },
        ]
    }

    pub async fn switch_engine(&mut self, engine_type: &str, config: &Config) -> anyhow::Result<()> {
        let mut model_path = Path::new(&config.engine.vosk.model_path).to_path_buf();
        if !model_path.exists() {
            let alt_path = Path::new("..").join(&config.engine.vosk.model_path);
            if alt_path.exists() {
                model_path = alt_path;
            }
        }

        println!(
            "[ENGINE_MANAGER] Switching engine to: {}, Language: {}, Vosk model path: {}, Whisper model: {}, use_gpu: {}",
            engine_type, config.general.language, config.engine.vosk.model_path, config.engine.whisper.model, config.engine.whisper.use_gpu
        );

        let new_engine: Box<dyn SpeechEngine> = match engine_type {
            "vosk" => Box::new(VoskEngine::new(&model_path.to_string_lossy())?),
            "whisper" => {
                let model_name = format!("ggml-{}.bin", config.engine.whisper.model);
                let mut path = Path::new("models").join("whisper").join(&model_name);
                if !path.exists() {
                    path = Path::new("..").join("models").join("whisper").join(&model_name);
                }
                Box::new(WhisperEngine::new(&path.to_string_lossy(), config.engine.whisper.use_gpu, &config.general.language)?)
            }
            "faster_whisper" => {
                let whisper_model = config.engine.whisper.model.clone();
                let device = if config.engine.whisper.use_gpu { "cuda" } else { "cpu" };
                Box::new(FasterWhisperEngine::new(&whisper_model, device, &config.general.language)?)
            }
            "sherpa_onnx" => {
                let mut path = Path::new(&config.engine.sherpa_onnx.model_path).to_path_buf();
                if !path.exists() {
                    let alt_path = Path::new("..").join(&config.engine.sherpa_onnx.model_path);
                    if alt_path.exists() {
                        path = alt_path;
                    }
                }
                Box::new(SherpaOnnxEngine::new(&path.to_string_lossy(), &config.general.language)?)
            }
            "deepgram" => Box::new(DeepgramEngine::new(&config.engine.deepgram, &config.general.language)?),
            "assemblyai" => Box::new(AssemblyAiEngine::new(&config.engine.assemblyai, &config.general.language)?),
            "openai" => Box::new(OpenAiWhisperEngine::new(&config.engine.openai, &config.general.language)?),
            "google" => Box::new(GoogleSpeechEngine::new(&config.engine.google, &config.general.language)?),
            "azure" => Box::new(AzureSpeechEngine::new(&config.engine.azure, &config.general.language)?),
            _ => return Err(anyhow::anyhow!("Engine {} not yet implemented", engine_type)),
        };
        self.active = Some(new_engine);
        self.active_type = engine_type.to_string();
        Ok(())
    }
}
