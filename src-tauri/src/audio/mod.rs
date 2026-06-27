pub mod ring_buffer;
pub mod capture;
pub mod vad;

use ring_buffer::RingBuffer;
use std::sync::mpsc;
use capture::start_capture;
use vad::SileroVad;
use rubato::{Resampler, FftFixedIn};

#[derive(Debug, Clone)]
pub struct SpeechChunk {
    pub samples: Vec<f32>,
    pub speech_prob: f32,
}

pub struct AudioPipeline {
    pub speech_rx: tokio::sync::mpsc::Receiver<SpeechChunk>,
}

pub fn spawn_audio_pipeline(config: &crate::config::settings::AudioConfig) -> anyhow::Result<(tokio::sync::mpsc::Receiver<SpeechChunk>, cpal::Stream)> {
    let (raw_tx, raw_rx) = mpsc::sync_channel::<Vec<f32>>(100);
    
    let stream = start_capture(&config.input_device, raw_tx)?;
    
    let (speech_tx, speech_rx) = tokio::sync::mpsc::channel(100);
    
    let _threshold = config.vad_threshold;
    
    std::thread::spawn(move || {
        println!("[VAD] Worker thread starting...");
        let mut rb = RingBuffer::new(ring_buffer::CHUNK_SAMPLES * 10);
        let model_path = if std::path::Path::new("models/silero-vad.onnx").exists() {
            "models/silero-vad.onnx"
        } else {
            "../models/silero-vad.onnx"
        };
        println!("[VAD] Loading model from: {}", model_path);
        
        let mut vad = match SileroVad::new(model_path) {
            Ok(v) => {
                println!("[VAD] Model loaded successfully.");
                v
            }
            Err(e) => {
                eprintln!("[VAD] Failed to load model: {}", e);
                return;
            }
        };

        let mut resampler = match FftFixedIn::<f32>::new(48000, 16000, 1536, 1, 1) {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[AUDIO] Failed to initialize resampler: {:?}", e);
                return;
            }
        };

        println!("[VAD] Entering processing loop. Waiting for audio...");

        let mut chunk_count = 0;
        let mut dc_last_x = 0.0f32;
        let mut dc_last_y = 0.0f32;
        // The ONNX model outputs very conservative probabilities (max ~0.05).
        // 0.01 cleanly separates the 0.0004 noise floor from speech.
        let threshold = 0.01;

        while let Ok(raw_samples) = raw_rx.recv() {
            // Apply continuous stateful DC Blocker (High-pass filter) to remove rumble and offset
            let mut centered_samples = raw_samples.clone();
            for i in 0..centered_samples.len() {
                let x = centered_samples[i];
                centered_samples[i] = x - dc_last_x + 0.995 * dc_last_y;
                dc_last_x = x;
                dc_last_y = centered_samples[i];
            }

            rb.push_slice(&centered_samples);
            
            while let Some(chunk) = rb.drain_chunk() {
                let waves_in = vec![chunk];
                let waves_out = match resampler.process(&waves_in, None) {
                    Ok(out) => out,
                    Err(e) => {
                        eprintln!("[AUDIO] Resampling error: {:?}", e);
                        continue;
                    }
                };
                let filtered_chunk = waves_out[0].clone();

                chunk_count += 1;
                let max_vol = filtered_chunk.iter().map(|v| v.abs()).fold(0.0f32, |a, b| a.max(b));
                
                match vad.predict(&filtered_chunk) {
                    Ok(speech_prob) => {
                        if chunk_count % 50 == 0 {
                            println!("[DEBUG] Audio running... len: {}, prob: {:.6}, max_vol: {:.4}", filtered_chunk.len(), speech_prob, max_vol);
                        } else if max_vol > 0.03 {
                            println!("[DEBUG] SPEAKING: len: {}, max_vol: {:.4}, prob: {:.6}, samples: [{:.4}, {:.4}, {:.4}, {:.4}, {:.4}]", 
                                filtered_chunk.len(), max_vol, speech_prob,
                                filtered_chunk[0], filtered_chunk[1], filtered_chunk[2], filtered_chunk[3], filtered_chunk[4]);
                        }

                        let is_speech = speech_prob >= threshold || max_vol > 0.015;
                        if is_speech {
                            let _ = speech_tx.blocking_send(SpeechChunk {
                                samples: filtered_chunk,
                                speech_prob,
                            });
                        }
                    }
                    Err(e) => {
                        eprintln!("[VAD] Predict error: {}", e);
                    }
                }
            }
        }
    });

    Ok((speech_rx, stream))
}
