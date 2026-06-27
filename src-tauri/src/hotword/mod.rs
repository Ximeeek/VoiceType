pub mod detector;

use crate::{AppState, AppStatus, ControlCommand};
use crate::audio::AudioPipeline;
use crate::config::Config;
use crate::recognition::engine_manager::EngineManager;
use crate::input::{detect_focused_text_field, LiveTypingState, copy_to_clipboard, FocusResult};
use detector::VoiceDetector;
use std::sync::Arc;
use tokio::time::{sleep, timeout, Duration};
use tokio::sync::mpsc::Receiver;
use tauri::{AppHandle, Emitter};

fn get_translated_words(words: &[String], target_lang: &str) -> Vec<String> {
    let mut result = words.to_vec();
    for word in words {
        let translations = match word.to_lowercase().as_str() {
            "zaczynamy" | "start" | "starten" | "commencer" | "empezar" | "iniziare" | "начать" => {
                match target_lang {
                    "pl" => vec!["zaczynamy", "start"],
                    "en" => vec!["start", "begin"],
                    "de" => vec!["starten", "los"],
                    "fr" => vec!["commencer", "go"],
                    "es" => vec!["empezar", "vamos"],
                    "it" => vec!["iniziare", "via"],
                    "ru" => vec!["начать", "старт"],
                    _ => vec!["start"]
                }
            }
            "komputer" | "computer" | "ordinateur" | "computadora" | "компьютер" => {
                match target_lang {
                    "pl" => vec!["komputer"],
                    "en" => vec!["computer"],
                    "de" => vec!["computer"],
                    "fr" => vec!["ordinateur"],
                    "es" => vec!["computadora"],
                    "it" => vec!["computer"],
                    "ru" => vec!["компьютер"],
                    _ => vec!["computer"]
                }
            }
            _ => vec![]
        };
        for t in translations {
            let ts = t.to_string();
            if !result.contains(&ts) {
                result.push(ts);
            }
        }
    }
    result
}

pub async fn run_control_loop(
    mut pipeline: AudioPipeline,
    mut engine: EngineManager,
    state: Arc<AppState>,
    mut config: Config,
    mut control_rx: Receiver<ControlCommand>,
    app_handle: AppHandle,
) {
    let initial_words = if config.trigger.translate {
        get_translated_words(&config.trigger.words, &config.general.language)
    } else {
        config.trigger.words.clone()
    };
    println!("[HOTWORD] Initialized. Status: {:?}, Lang: {}, Engine: {}, Trigger words: {:?}", 
        state.status.lock().await.clone(), config.general.language, config.engine.engine_type, initial_words);

    let mut detector = VoiceDetector::new(
        initial_words,
        config.dictation.stop_words.clone(),
        config.dictation.silence_timeout_ms,
    );

    let mut _current_partial = String::new();
    let mut live_typing = LiveTypingState::new();
    let mut focus;

    loop {
        while let Ok(cmd) = control_rx.try_recv() {
            match cmd {
                ControlCommand::Pause => {
                    *state.status.lock().await = AppStatus::Paused;
                    app_handle.emit("status_changed", "paused").ok();
                }
                ControlCommand::Resume => {
                    *state.status.lock().await = AppStatus::Idle;
                    app_handle.emit("status_changed", "idle").ok();
                }
                ControlCommand::SetTriggerWords(words) => {
                    config.trigger.words = words.clone();
                    let detector_words = if config.trigger.translate {
                        get_translated_words(&words, &config.general.language)
                    } else {
                        words
                    };
                    detector.update_config(detector_words, config.dictation.stop_words.clone(), config.dictation.silence_timeout_ms);
                }
                ControlCommand::SetStopWords(words) => {
                    config.dictation.stop_words = words.clone();
                    detector.update_config(config.trigger.words.clone(), words, config.dictation.silence_timeout_ms);
                }
                ControlCommand::SetSilenceTimeout(timeout_ms) => {
                    config.dictation.silence_timeout_ms = timeout_ms;
                    detector.update_config(config.trigger.words.clone(), config.dictation.stop_words.clone(), timeout_ms);
                }
                ControlCommand::SetEngine(engine_type) => {
                    let app_config = state.config.lock().await.clone();
                    if let Err(e) = engine.switch_engine(&engine_type, &app_config).await {
                        app_handle.emit("engine_error", e.to_string()).ok();
                    } else {
                        let _ = engine.start_stream().await;
                    }
                }
                ControlCommand::SetTriggerTranslate(val) => {
                    config.trigger.translate = val;
                    let detector_words = if val {
                        get_translated_words(&config.trigger.words, &config.general.language)
                    } else {
                        config.trigger.words.clone()
                    };
                    detector.update_config(detector_words, config.dictation.stop_words.clone(), config.dictation.silence_timeout_ms);
                }
                ControlCommand::SetLanguage(lang) => {
                    config.general.language = lang.clone();
                    let detector_words = if config.trigger.translate {
                        get_translated_words(&config.trigger.words, &lang)
                    } else {
                        config.trigger.words.clone()
                    };
                    detector.update_config(detector_words, config.dictation.stop_words.clone(), config.dictation.silence_timeout_ms);
                }
                ControlCommand::ForceDictate => {
                    let status = state.status.lock().await.clone();
                    if matches!(status, AppStatus::Idle | AppStatus::Listening) {
                        println!("[STATE] Idle → Dictating (forced by user)");
                        let _ = engine.finalize().await;
                        let _ = engine.start_stream().await;
                        
                        *state.status.lock().await = AppStatus::Dictating;
                        app_handle.emit("status_changed", "dictating").ok();
                        
                        detector.mark_speech();
                        _current_partial = String::new();
                        
                        focus = detect_focused_text_field();
                        app_handle.emit("focus_detected", !matches!(focus, FocusResult::NoTextField)).ok();
                        live_typing = LiveTypingState::new();
                    }
                }
                ControlCommand::Quit => return,
            }
        }

        let chunk_opt = timeout(Duration::from_millis(100), pipeline.speech_rx.recv()).await;
        let status = state.status.lock().await.clone();

        match status {
            AppStatus::Idle | AppStatus::Listening => {
                if let Ok(Some(chunk)) = chunk_opt {
                    let max_vol = chunk.samples.iter().map(|v| v.abs()).fold(0.0f32, |a, b| a.max(b));
                    println!("[HOTWORD] Chunk received. len={}, max_vol={:.4}, prob={:.6}", chunk.samples.len(), max_vol, chunk.speech_prob);
                    if let Ok(Some(transcript)) = engine.feed_audio(&chunk.samples).await {
                        println!("[IDLE] [Engine: {}, Lang: {}] Transcript: '{}' (partial: {})", engine.active_type, config.general.language, transcript.text, transcript.is_partial);
                        if let Some(remaining) = detector.check_trigger(&transcript.text) {
                            println!("[STATE] Idle → Dictating (trigger matched, remaining: '{}')", remaining);
                            let _ = engine.finalize().await;
                            let _ = engine.start_stream().await;
                            
                            *state.status.lock().await = AppStatus::Dictating;
                            app_handle.emit("status_changed", "dictating").ok();
                            
                            detector.mark_speech();
                            _current_partial = String::new();
                            
                            focus = detect_focused_text_field();
                            app_handle.emit("focus_detected", !matches!(focus, FocusResult::NoTextField)).ok();
                            live_typing = LiveTypingState::new();

                            if !remaining.is_empty() && config.dictation.live_typing {
                                _current_partial = remaining.clone();
                                if config.input.prefer_uia || !matches!(focus, FocusResult::NoTextField) {
                                    let _ = live_typing.update_partial(&remaining, &focus, config.input.key_delay_ms).await;
                                }
                            }
                        }
                    }
                }
            }

            AppStatus::Dictating => {
                if detector.is_silence_timeout() {
                    println!("[FLUSH] Silence timeout - flushing text");
                    *state.status.lock().await = AppStatus::Processing;
                    app_handle.emit("status_changed", "processing").ok();

                    let final_text = engine.finalize().await.unwrap_or_default();
                    if !final_text.is_empty() {
                        focus = detect_focused_text_field();
                        if !matches!(focus, FocusResult::NoTextField) {
                            let _ = live_typing.finalize(&final_text, &focus, config.input.key_delay_ms).await;
                        } else if config.input.clipboard_fallback {
                            println!("[CLIPBOARD] Copied: {}", final_text);
                            let _ = copy_to_clipboard(&final_text);
                        }
                        app_handle.emit("transcript_final", final_text.clone()).ok();
                    }
                    *state.status.lock().await = AppStatus::Idle;
                    app_handle.emit("status_changed", "idle").ok();
                    _current_partial = String::new();
                }

                if let Ok(Some(chunk)) = chunk_opt {
                    detector.mark_speech();
                    if let Ok(Some(transcript)) = engine.feed_audio(&chunk.samples).await {
                        if transcript.is_partial {
                            println!("[PARTIAL] [Engine: {}, Lang: {}] Transcript: '{}'", engine.active_type, config.general.language, transcript.text);
                            _current_partial = transcript.text.clone();
                            app_handle.emit("transcript_partial", transcript.text.clone()).ok();
                            
                            if config.dictation.live_typing {
                                focus = detect_focused_text_field();
                                if config.input.prefer_uia || !matches!(focus, FocusResult::NoTextField) {
                                    let _ = live_typing.update_partial(&transcript.text, &focus, config.input.key_delay_ms).await;
                                }
                            }
                        } else {
                            println!("[FINAL] [Engine: {}, Lang: {}] Transcript: '{}'", engine.active_type, config.general.language, transcript.text);
                            _current_partial = String::new();
                            app_handle.emit("transcript_final", transcript.text.clone()).ok();
                            
                            focus = detect_focused_text_field();
                            if !matches!(focus, FocusResult::NoTextField) {
                                let _ = live_typing.finalize(&transcript.text, &focus, config.input.key_delay_ms).await;
                            } else if config.input.clipboard_fallback {
                                println!("[CLIPBOARD] Copied: {}", transcript.text);
                                let _ = copy_to_clipboard(&transcript.text);
                            }
                            
                            if detector.check_stop(&transcript.text) {
                                println!("[STATE] Dictating → Idle (stop word)");
                                *state.status.lock().await = AppStatus::Idle;
                                app_handle.emit("status_changed", "idle").ok();
                            }
                        }
                    }
                }
            }

            AppStatus::Paused => {
                sleep(Duration::from_millis(100)).await;
            }

            _ => {}
        }
    }
}
