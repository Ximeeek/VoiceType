use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Config {
    pub general: GeneralConfig,
    pub audio: AudioConfig,
    pub trigger: TriggerConfig,
    pub dictation: DictationConfig,
    pub engine: EngineConfig,
    pub input: InputConfig,
    pub ui: UiConfig,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            general: GeneralConfig::default(),
            audio: AudioConfig::default(),
            trigger: TriggerConfig::default(),
            dictation: DictationConfig::default(),
            engine: EngineConfig::default(),
            input: InputConfig::default(),
            ui: UiConfig::default(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GeneralConfig {
    pub autostart: bool,
    pub minimize_to_tray_on_close: bool,
    pub language: String,
    pub show_notifications: bool,
    pub notification_duration_ms: u64,
}

impl Default for GeneralConfig {
    fn default() -> Self {
        Self {
            autostart: false,
            minimize_to_tray_on_close: true,
            language: "en".to_string(),
            show_notifications: true,
            notification_duration_ms: 4000,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AudioConfig {
    pub input_device: String,
    pub sample_rate: u32,
    pub vad_threshold: f32,
    pub vad_min_speech_ms: u64,
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self {
            input_device: "default".to_string(),
            sample_rate: 16000,
            vad_threshold: 0.4,
            vad_min_speech_ms: 200,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TriggerConfig {
    pub words: Vec<String>,
    pub fuzzy_match: bool,
    pub fuzzy_threshold: u32,
    #[serde(default)]
    pub translate: bool,
}

impl Default for TriggerConfig {
    fn default() -> Self {
        Self {
            words: vec!["computer".to_string(), "komputer".to_string(), "zaczynamy".to_string()],
            fuzzy_match: true,
            fuzzy_threshold: 2,
            translate: false,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DictationConfig {
    pub stop_words: Vec<String>,
    pub silence_timeout_ms: u64,
    pub stop_word_remove_from_text: bool,
    pub start_delay_ms: u64,
    pub live_typing: bool,
}

impl Default for DictationConfig {
    fn default() -> Self {
        Self {
            stop_words: vec!["stop".to_string(), "done".to_string()],
            silence_timeout_ms: 2500,
            stop_word_remove_from_text: true,
            start_delay_ms: 0,
            live_typing: false,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EngineConfig {
    #[serde(rename = "type")]
    pub engine_type: String,
    pub vosk: VoskEngineConfig,
    pub whisper: WhisperEngineConfig,
    pub faster_whisper: FasterWhisperEngineConfig,
    pub sherpa_onnx: SherpaOnnxEngineConfig,
    pub deepgram: DeepgramEngineConfig,
    pub assemblyai: AssemblyAiEngineConfig,
    pub openai: OpenAiEngineConfig,
    pub google: GoogleEngineConfig,
    pub azure: AzureEngineConfig,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            engine_type: "vosk".to_string(),
            vosk: VoskEngineConfig::default(),
            whisper: WhisperEngineConfig::default(),
            faster_whisper: FasterWhisperEngineConfig::default(),
            sherpa_onnx: SherpaOnnxEngineConfig::default(),
            deepgram: DeepgramEngineConfig::default(),
            assemblyai: AssemblyAiEngineConfig::default(),
            openai: OpenAiEngineConfig::default(),
            google: GoogleEngineConfig::default(),
            azure: AzureEngineConfig::default(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SherpaOnnxEngineConfig {
    pub model_path: String,
    pub tokens_path: String,
    pub num_threads: usize,
}

impl Default for SherpaOnnxEngineConfig {
    fn default() -> Self {
        Self {
            model_path: "models/sherpa/model.onnx".to_string(),
            tokens_path: "models/sherpa/tokens.txt".to_string(),
            num_threads: 4,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VoskEngineConfig {
    pub model_path: String,
    pub enable_partial_results: bool,
}

impl Default for VoskEngineConfig {
    fn default() -> Self {
        Self {
            model_path: "models/vosk/vosk-model-small-pl-0.22".to_string(),
            enable_partial_results: true,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WhisperEngineConfig {
    pub model: String,
    pub use_gpu: bool,
    pub gpu_device: u32,
    pub language: String,
}

impl Default for WhisperEngineConfig {
    fn default() -> Self {
        Self {
            model: "small.en".to_string(),
            use_gpu: true,
            gpu_device: 0,
            language: "en".to_string(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FasterWhisperEngineConfig {
    pub model: String,
    pub device: String,
    pub compute_type: String,
}

impl Default for FasterWhisperEngineConfig {
    fn default() -> Self {
        Self {
            model: "small.en".to_string(),
            device: "cpu".to_string(),
            compute_type: "int8".to_string(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DeepgramEngineConfig {
    pub api_key: String,
    pub model: String,
    pub smart_format: bool,
    pub punctuate: bool,
}

impl Default for DeepgramEngineConfig {
    fn default() -> Self {
        Self {
            api_key: "".to_string(),
            model: "nova-2".to_string(),
            smart_format: true,
            punctuate: true,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AssemblyAiEngineConfig {
    pub api_key: String,
    pub word_boost: Vec<String>,
}

impl Default for AssemblyAiEngineConfig {
    fn default() -> Self {
        Self {
            api_key: "".to_string(),
            word_boost: vec![],
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OpenAiEngineConfig {
    pub api_key: String,
    pub model: String,
    pub chunk_duration_ms: u64,
}

impl Default for OpenAiEngineConfig {
    fn default() -> Self {
        Self {
            api_key: "".to_string(),
            model: "whisper-1".to_string(),
            chunk_duration_ms: 5000,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GoogleEngineConfig {
    pub credentials_path: String,
    pub model: String,
    pub use_enhanced: bool,
}

impl Default for GoogleEngineConfig {
    fn default() -> Self {
        Self {
            credentials_path: "".to_string(),
            model: "latest_long".to_string(),
            use_enhanced: true,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AzureEngineConfig {
    pub subscription_key: String,
    pub region: String,
}

impl Default for AzureEngineConfig {
    fn default() -> Self {
        Self {
            subscription_key: "".to_string(),
            region: "eastus".to_string(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InputConfig {
    pub prefer_uia: bool,
    pub clipboard_fallback: bool,
    pub clipboard_toast: bool,
    pub key_delay_ms: u64,
}

impl Default for InputConfig {
    fn default() -> Self {
        Self {
            prefer_uia: true,
            clipboard_fallback: true,
            clipboard_toast: true,
            key_delay_ms: 0,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UiConfig {
    pub theme: String,
    pub window_opacity: f32,
    pub always_on_top: bool,
    pub start_minimized: bool,
}

impl Default for UiConfig {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            window_opacity: 1.0,
            always_on_top: false,
            start_minimized: false,
        }
    }
}
