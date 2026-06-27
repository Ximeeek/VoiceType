pub mod deepgram;
pub mod assemblyai;
pub mod openai_whisper;
pub mod google_stt;
pub mod azure_speech;

pub use deepgram::DeepgramEngine;
pub use assemblyai::AssemblyAiEngine;
pub use openai_whisper::OpenAiWhisperEngine;
pub use google_stt::GoogleSpeechEngine;
pub use azure_speech::AzureSpeechEngine;

pub fn check_api_key(key: &str, engine: &str) -> anyhow::Result<()> {
    if key.trim().is_empty() {
        Err(anyhow::anyhow!("Brak klucza API dla {}", engine))
    } else {
        Ok(())
    }
}

pub async fn with_retry<F, Fut, T>(f: F, max_retries: u32) -> anyhow::Result<T>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = anyhow::Result<T>>,
{
    let delays = [1000u64, 2000, 4000];
    for attempt in 0..=max_retries {
        match f().await {
            Ok(v) => return Ok(v),
            Err(_e) if attempt < max_retries => {
                let delay = delays.get(attempt as usize).copied().unwrap_or(4000);
                tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
            }
            Err(e) => return Err(e),
        }
    }
    unreachable!()
}

pub fn samples_f32_to_i16_pcm(samples: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(samples.len() * 2);
    for &sample in samples {
        let clamped = sample.clamp(-1.0, 1.0);
        let s = (clamped * 32767.0) as i16;
        bytes.extend_from_slice(&s.to_le_bytes());
    }
    bytes
}

pub fn pcm_i16_to_wav(pcm_bytes: &[u8], sample_rate: u32, channels: u16) -> Vec<u8> {
    let mut wav = Vec::with_capacity(44 + pcm_bytes.len());
    let data_len = pcm_bytes.len() as u32;
    let file_len = 36 + data_len;
    let byte_rate = sample_rate * channels as u32 * 2;
    let block_align = channels * 2;

    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&file_len.to_le_bytes());
    wav.extend_from_slice(b"WAVE");
    wav.extend_from_slice(b"fmt ");
    wav.extend_from_slice(&16u32.to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes());
    wav.extend_from_slice(&channels.to_le_bytes());
    wav.extend_from_slice(&sample_rate.to_le_bytes());
    wav.extend_from_slice(&byte_rate.to_le_bytes());
    wav.extend_from_slice(&block_align.to_le_bytes());
    wav.extend_from_slice(&16u16.to_le_bytes());
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_len.to_le_bytes());
    wav.extend_from_slice(pcm_bytes);
    wav
}
