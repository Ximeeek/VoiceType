use async_trait::async_trait;
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tungstenite::client::IntoClientRequest;

use super::{check_api_key, samples_f32_to_i16_pcm};
use crate::config::settings::DeepgramEngineConfig;
use crate::recognition::{SpeechEngine, Transcript};

pub struct DeepgramEngine {
    config: DeepgramEngineConfig,
    language: String,
    tx_audio: Option<mpsc::Sender<Option<Vec<u8>>>>,
    transcript_rx: Option<mpsc::Receiver<Transcript>>,
    accumulated_transcript: String,
}

impl DeepgramEngine {
    pub fn new(config: &DeepgramEngineConfig, language: &str) -> anyhow::Result<Self> {
        check_api_key(&config.api_key, "Deepgram")?;
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
impl SpeechEngine for DeepgramEngine {
    async fn start_stream(&mut self) -> anyhow::Result<()> {
        check_api_key(&self.config.api_key, "Deepgram")?;
        self.accumulated_transcript.clear();

        let mut url_str = format!(
            "wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&model={}&punctuate={}&interim_results=true&smart_format={}",
            self.config.model, self.config.punctuate, self.config.smart_format
        );
        if !self.language.is_empty() {
            url_str.push_str(&format!("&language={}", self.language));
        }

        let mut request = url_str.into_client_request()?;
        request.headers_mut().insert(
            "Authorization",
            format!("Token {}", self.config.api_key).parse()?,
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
                        if ws_sink.send(Message::Binary(bytes)).await.is_err() {
                            break;
                        }
                    }
                    None => {
                        let close_msg = r#"{"type":"CloseStream"}"#;
                        let _ = ws_sink.send(Message::Text(close_msg.into())).await;
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
                        if let Some(alt) = json.pointer("/channel/alternatives/0") {
                            let transcript_text = alt["transcript"].as_str().unwrap_or("");
                            let confidence = alt["confidence"].as_f64().unwrap_or(1.0) as f32;
                            let is_final = json["is_final"].as_bool().unwrap_or(false);

                            if !transcript_text.is_empty() {
                                let t = Transcript {
                                    text: transcript_text.to_string(),
                                    is_partial: !is_final,
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
        "deepgram"
    }
}
