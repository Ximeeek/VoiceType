use crate::recognition::{SpeechEngine, Transcript};
use whisper_rs::{WhisperContext, WhisperContextParameters, FullParams, SamplingStrategy};

pub struct WhisperEngine {
    ctx: WhisperContext,
    buffer: Vec<f32>,
    language: String,
}

impl WhisperEngine {
    pub fn new(model_path: &str, use_gpu: bool, language: &str) -> anyhow::Result<Self> {
        let mut params = WhisperContextParameters::default();
        params.use_gpu(use_gpu);
        let ctx = WhisperContext::new_with_params(model_path, params)?;
        Ok(Self { 
            ctx, 
            buffer: Vec::new(), 
            language: language.into(), 
        })
    }
}

#[async_trait::async_trait]
impl SpeechEngine for WhisperEngine {
    async fn feed_audio(&mut self, samples: &[f32]) -> anyhow::Result<Option<Transcript>> {
        self.buffer.extend_from_slice(samples);
        Ok(None)
    }
    
    async fn finalize(&mut self) -> anyhow::Result<String> {
        if self.buffer.is_empty() {
            return Ok(String::new());
        }
        
        let chunk: Vec<f32> = self.buffer.drain(..).collect();
        
        let mut state = self.ctx.create_state()?;
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(Some(&self.language));
        params.set_print_progress(false);
        params.set_print_realtime(false);
        
        // Ogranicz do max 6 wątków CPU dla optymalnej wydajności (zmniejszenie narzutu synchronizacji i cache contention)
        let avail = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4);
        let num_threads = std::cmp::min(6, avail) as i32;
        params.set_n_threads(num_threads);
        
        println!("[Whisper.cpp] Running inference on {} samples using {} threads...", chunk.len(), num_threads);
        state.full(params, &chunk)?;
        
        let mut text = String::new();
        for segment in state.as_iter() {
            text.push_str(segment.to_string().trim());
            text.push(' ');
        }
        let result = text.trim().to_string();
        println!("[Whisper.cpp] Inference done. Result: '{}'", result);
        Ok(result)
    }
    
    fn supports_streaming(&self) -> bool { false }
    fn engine_name(&self) -> &str { "whisper" }
    async fn start_stream(&mut self) -> anyhow::Result<()> { Ok(()) }
}
