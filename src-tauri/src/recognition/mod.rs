pub mod engine_manager;
pub mod offline;
pub mod online;

use async_trait::async_trait;

#[derive(Debug, Clone)]
pub struct Transcript {
    pub text: String,
    pub is_partial: bool,
    pub confidence: f32,
}

#[async_trait]
pub trait SpeechEngine: Send + Sync {
    async fn start_stream(&mut self) -> anyhow::Result<()>;
    async fn feed_audio(&mut self, samples: &[f32]) -> anyhow::Result<Option<Transcript>>;
    async fn finalize(&mut self) -> anyhow::Result<String>;
    fn supports_streaming(&self) -> bool;
    fn engine_name(&self) -> &str;
}
