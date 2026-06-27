use async_trait::async_trait;
use base64::Engine as _;

use super::{check_api_key, samples_f32_to_i16_pcm};
use crate::config::settings::GoogleEngineConfig;
use crate::recognition::{SpeechEngine, Transcript};

pub struct GoogleSpeechEngine {
    config: GoogleEngineConfig,
    language: String,
    buffer: Vec<f32>,
    client: reqwest::Client,
    accumulated_text: String,
}

impl GoogleSpeechEngine {
    pub fn new(config: &GoogleEngineConfig, language: &str) -> anyhow::Result<Self> {
        let key = Self::get_api_key(&config.credentials_path);
        check_api_key(&key, "Google Cloud STT")?;
        Ok(Self {
            config: config.clone(),
            language: language.to_string(),
            buffer: Vec::new(),
            client: reqwest::Client::new(),
            accumulated_text: String::new(),
        })
    }

    fn get_api_key(credentials_path: &str) -> String {
        let path = std::path::Path::new(credentials_path);
        if path.exists() && path.is_file() {
            std::fs::read_to_string(path).unwrap_or_default().trim().to_string()
        } else {
            credentials_path.trim().to_string()
        }
    }

    async fn process_chunk(&mut self, samples: &[f32]) -> anyhow::Result<Option<Transcript>> {
        if samples.is_empty() {
            return Ok(None);
        }

        let key = Self::get_api_key(&self.config.credentials_path);
        check_api_key(&key, "Google Cloud STT")?;

        let pcm_bytes = samples_f32_to_i16_pcm(samples);
        let b64_audio = base64::engine::general_purpose::STANDARD.encode(&pcm_bytes);

        let lang_code = if self.language.is_empty() {
            "en-US".to_string()
        } else if self.language.contains('-') {
            self.language.clone()
        } else {
            format!("{}-US", self.language)
        };

        let body = serde_json::json!({
            "config": {
                "encoding": "LINEAR16",
                "sampleRateHertz": 16000,
                "languageCode": lang_code,
                "model": if self.config.model.is_empty() { "latest_long" } else { &self.config.model },
                "useEnhanced": self.config.use_enhanced
            },
            "audio": {
                "content": b64_audio
            }
        });

        let url = format!("https://speech.googleapis.com/v1/speech:recognize?key={}", key);
        let res = self.client.post(&url).json(&body).send().await?;

        if !res.status().is_success() {
            let err_text = res.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("Google STT API error: {}", err_text));
        }

        let json: serde_json::Value = res.json().await?;
        if let Some(results) = json["results"].as_array() {
            if let Some(first_res) = results.first() {
                if let Some(alt) = first_res.pointer("/alternatives/0") {
                    let text = alt["transcript"].as_str().unwrap_or("").trim().to_string();
                    let confidence = alt["confidence"].as_f64().unwrap_or(1.0) as f32;

                    if !text.is_empty() {
                        if !self.accumulated_text.is_empty() {
                            self.accumulated_text.push(' ');
                        }
                        self.accumulated_text.push_str(&text);

                        return Ok(Some(Transcript {
                            text,
                            is_partial: false,
                            confidence,
                        }));
                    }
                }
            }
        }

        Ok(None)
    }
}

#[async_trait]
impl SpeechEngine for GoogleSpeechEngine {
    async fn start_stream(&mut self) -> anyhow::Result<()> {
        let key = Self::get_api_key(&self.config.credentials_path);
        check_api_key(&key, "Google Cloud STT")?;
        self.buffer.clear();
        self.accumulated_text.clear();
        Ok(())
    }

    async fn feed_audio(&mut self, samples: &[f32]) -> anyhow::Result<Option<Transcript>> {
        self.buffer.extend_from_slice(samples);

        // Process in ~4 second chunks (64,000 samples at 16kHz)
        let target_samples = 64_000;
        if self.buffer.len() >= target_samples {
            let chunk: Vec<f32> = self.buffer.drain(..target_samples).collect();
            return self.process_chunk(&chunk).await;
        }

        Ok(None)
    }

    async fn finalize(&mut self) -> anyhow::Result<String> {
        if !self.buffer.is_empty() {
            let remaining: Vec<f32> = self.buffer.drain(..).collect();
            let _ = self.process_chunk(&remaining).await;
        }

        Ok(self.accumulated_text.trim().to_string())
    }

    fn supports_streaming(&self) -> bool {
        false
    }

    fn engine_name(&self) -> &str {
        "google"
    }
}
