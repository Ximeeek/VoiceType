use async_trait::async_trait;
use reqwest::multipart;

use super::{check_api_key, pcm_i16_to_wav, samples_f32_to_i16_pcm};
use crate::config::settings::OpenAiEngineConfig;
use crate::recognition::{SpeechEngine, Transcript};

pub struct OpenAiWhisperEngine {
    config: OpenAiEngineConfig,
    language: String,
    buffer: Vec<f32>,
    client: reqwest::Client,
    accumulated_text: String,
}

impl OpenAiWhisperEngine {
    pub fn new(config: &OpenAiEngineConfig, language: &str) -> anyhow::Result<Self> {
        check_api_key(&config.api_key, "OpenAI")?;
        Ok(Self {
            config: config.clone(),
            language: language.to_string(),
            buffer: Vec::new(),
            client: reqwest::Client::new(),
            accumulated_text: String::new(),
        })
    }

    async fn process_chunk(&mut self, samples: &[f32]) -> anyhow::Result<Option<Transcript>> {
        if samples.is_empty() {
            return Ok(None);
        }

        let pcm_bytes = samples_f32_to_i16_pcm(samples);
        let wav_bytes = pcm_i16_to_wav(&pcm_bytes, 16000, 1);

        let file_part = multipart::Part::bytes(wav_bytes)
            .file_name("audio.wav")
            .mime_str("audio/wav")?;

        let mut form = multipart::Form::new()
            .part("file", file_part)
            .text("model", self.config.model.clone())
            .text("response_format", "json");

        if !self.language.is_empty() {
            form = form.text("language", self.language.clone());
        }

        let res = self
            .client
            .post("https://api.openai.com/v1/audio/transcriptions")
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .multipart(form)
            .send()
            .await?;

        if !res.status().is_success() {
            let err_text = res.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("OpenAI API error: {}", err_text));
        }

        let json: serde_json::Value = res.json().await?;
        let text = json["text"].as_str().unwrap_or("").trim().to_string();

        if !text.is_empty() {
            if !self.accumulated_text.is_empty() {
                self.accumulated_text.push(' ');
            }
            self.accumulated_text.push_str(&text);

            Ok(Some(Transcript {
                text,
                is_partial: false,
                confidence: 1.0,
            }))
        } else {
            Ok(None)
        }
    }
}

#[async_trait]
impl SpeechEngine for OpenAiWhisperEngine {
    async fn start_stream(&mut self) -> anyhow::Result<()> {
        check_api_key(&self.config.api_key, "OpenAI")?;
        self.buffer.clear();
        self.accumulated_text.clear();
        Ok(())
    }

    async fn feed_audio(&mut self, samples: &[f32]) -> anyhow::Result<Option<Transcript>> {
        self.buffer.extend_from_slice(samples);

        let target_samples = ((self.config.chunk_duration_ms * 16000) / 1000) as usize;
        if target_samples > 0 && self.buffer.len() >= target_samples {
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
        "openai"
    }
}
