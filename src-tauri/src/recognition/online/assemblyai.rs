use async_trait::async_trait;
use base64::Engine as _;
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tungstenite::client::IntoClientRequest;

use super::{check_api_key, samples_f32_to_i16_pcm};
use crate::config::settings::AssemblyAiEngineConfig;
use crate::recognition::{SpeechEngine, Transcript};

pub struct AssemblyAiEngine {
    config: AssemblyAiEngineConfig,
    language: String,
    tx_audio: Option<mpsc::Sender<Option<Vec<u8>>>>,
    transcript_rx: Option<mpsc::Receiver<Transcript>>,
    accumulated_transcript: String,
}

impl AssemblyAiEngine {
    pub fn new(config: &AssemblyAiEngineConfig, language: &str) -> anyhow::Result<Self> {
        check_api_key(&config.api_key, "AssemblyAI")?;
        Ok(Self {
            config: config.clone(),
            language: language.to_string(),
            tx_audio: None,
            transcript_rx: None,
            accumulated_transcript: String::new(),
        })
    }
}

#[async_trait]
impl SpeechEngine for AssemblyAiEngine {
    async fn start_stream(&mut self) -> anyhow::Result<()> {
        check_api_key(&self.config.api_key, "AssemblyAI")?;
        self.accumulated_transcript.clear();

        let url_str = "wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000";
        let mut request = url_str.into_client_request()?;
        request.headers_mut().insert(
            "Authorization",
            self.config.api_key.parse()?,
        );

        let (ws_stream, _) = connect_async(request).await?;
        let (mut ws_sink, mut ws_stream_reader) = ws_stream.split();

        let (tx_audio, mut rx_audio) = mpsc::channel::<Option<Vec<u8>>>(100);
        let (tx_transcript, rx_transcript) = mpsc::channel::<Transcript>(100);

        self.tx_audio = Some(tx_audio);
        self.transcript_rx = Some(rx_transcript);

        // Task for writing audio frames to WebSocket
        tokio::spawn(async move {
            while let Some(msg) = rx_audio.recv().await {
                match msg {
                    Some(bytes) => {
                        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                        let payload = serde_json::json!({ "audio_data": b64 });
                        if ws_sink.send(Message::Text(payload.to_string().into())).await.is_err() {
                            break;
                        }
                    }
                    None => {
                        let term_msg = serde_json::json!({ "terminate_session": true });
                        let _ = ws_sink.send(Message::Text(term_msg.to_string().into())).await;
                        let _ = ws_sink.close().await;
                        break;
                    }
                }
            }
        });

        // Task for reading responses from WebSocket
        tokio::spawn(async move {
            while let Some(Ok(msg)) = ws_stream_reader.next().await {
                if let Message::Text(text) = msg {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                        let message_type = json["message_type"].as_str().unwrap_or("");
                        let transcript_text = json["text"].as_str().unwrap_or("");
                        let confidence = json["confidence"].as_f64().unwrap_or(1.0) as f32;

                        if message_type == "PartialTranscript" || message_type == "FinalTranscript" {
                            if !transcript_text.is_empty() {
                                let t = Transcript {
                                    text: transcript_text.to_string(),
                                    is_partial: message_type == "PartialTranscript",
                                    confidence,
                                };
                                let _ = tx_transcript.send(t).await;
                            }
                        }
                    }
                }
            }
        });

        Ok(())
    }

    async fn feed_audio(&mut self, samples: &[f32]) -> anyhow::Result<Option<Transcript>> {
        if self.tx_audio.is_none() {
            self.start_stream().await?;
        }

        if let Some(tx) = &self.tx_audio {
            let pcm_bytes = samples_f32_to_i16_pcm(samples);
            let _ = tx.send(Some(pcm_bytes)).await;
        }

        let mut latest = None;
        if let Some(rx) = &mut self.transcript_rx {
            while let Ok(t) = rx.try_recv() {
                if !t.is_partial {
                    if !self.accumulated_transcript.is_empty() {
                        self.accumulated_transcript.push(' ');
                    }
                    self.accumulated_transcript.push_str(&t.text);
                }
                latest = Some(t);
            }
        }
        Ok(latest)
    }

    async fn finalize(&mut self) -> anyhow::Result<String> {
        if let Some(tx) = self.tx_audio.take() {
            let _ = tx.send(None).await;
        }

        if let Some(mut rx) = self.transcript_rx.take() {
            let timeout = tokio::time::sleep(std::time::Duration::from_millis(500));
            tokio::pin!(timeout);

            loop {
                tokio::select! {
                    Some(t) = rx.recv() => {
                        if !t.is_partial {
                            if !self.accumulated_transcript.is_empty() {
                                self.accumulated_transcript.push(' ');
                            }
                            self.accumulated_transcript.push_str(&t.text);
                        }
                    }
                    _ = &mut timeout => break,
                }
            }
        }

        Ok(self.accumulated_transcript.trim().to_string())
    }

    fn supports_streaming(&self) -> bool {
        true
    }

    fn engine_name(&self) -> &str {
        "assemblyai"
    }
}
