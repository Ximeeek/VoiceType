use crate::recognition::{SpeechEngine, Transcript};
use async_trait::async_trait;
use vosk::{Model, Recognizer};

pub struct VoskEngine {
    recognizer: Recognizer,
    prev_partial: String,
}

impl VoskEngine {
    pub fn new(model_path: &str) -> anyhow::Result<Self> {
        println!("[VOSK] Loading model from path: {}", model_path);
        let model = Model::new(model_path)
            .ok_or_else(|| anyhow::anyhow!("Failed to load Vosk model from {}", model_path))?;
        let mut recognizer = Recognizer::new(&model, 16000.0)
            .ok_or_else(|| anyhow::anyhow!("Failed to create Vosk recognizer"))?;
        
        recognizer.set_max_alternatives(0);
        recognizer.set_words(false);

        Ok(Self {
            recognizer,
            prev_partial: String::new(),
        })
    }
}

#[async_trait]
impl SpeechEngine for VoskEngine {
    async fn start_stream(&mut self) -> anyhow::Result<()> {
        Ok(())
    }

    async fn feed_audio(&mut self, samples: &[f32]) -> anyhow::Result<Option<Transcript>> {
        // Convert f32 samples [-1.0, 1.0] to i16
        let samples_i16: Vec<i16> = samples
            .iter()
            .map(|&s| (s * 32767.0).clamp(-32768.0, 32767.0) as i16)
            .collect();

        let state = self.recognizer.accept_waveform(&samples_i16);

        if let Ok(vosk::DecodingState::Running) = &state {
            let partial = self.recognizer.partial_result().partial;
            if !partial.is_empty() && partial != self.prev_partial {
                println!("[VOSK] Partial result: '{}'", partial);
            }
        }

        match state {
            Ok(vosk::DecodingState::Running) => {
                let partial = self.recognizer.partial_result().partial.to_string();
                if partial == self.prev_partial || partial.is_empty() {
                    Ok(None)
                } else {
                    self.prev_partial = partial.clone();
                    Ok(Some(Transcript {
                        text: partial,
                        is_partial: true,
                        confidence: 0.0,
                    }))
                }
            }
            Ok(vosk::DecodingState::Finalized) | Ok(vosk::DecodingState::Failed) => {
                let result = self.recognizer.result().single().map(|r| r.text.to_string()).unwrap_or_default();
                self.prev_partial = String::new();
                if result.is_empty() {
                    Ok(None)
                } else {
                    Ok(Some(Transcript {
                        text: result,
                        is_partial: false,
                        confidence: 1.0,
                    }))
                }
            }
            Err(e) => {
                eprintln!("[VOSK] Failed to accept waveform: {}", e);
                Ok(None)
            }
        }
    }

    async fn finalize(&mut self) -> anyhow::Result<String> {
        let result = self.recognizer.final_result().single().map(|r| r.text.to_string()).unwrap_or_default();
        self.prev_partial = String::new();
        Ok(result)
    }

    fn supports_streaming(&self) -> bool {
        true
    }

    fn engine_name(&self) -> &str {
        "vosk"
    }
}
