pub mod detector;

use crate::{AppState, AppStatus, ControlCommand};
use crate::audio::AudioPipeline;
use crate::config::Config;
use crate::recognition::engine_manager::EngineManager;
use crate::input::{detect_focused_text_field, LiveTypingState, copy_to_clipboard, FocusResult};
use detector::VoiceDetector;
use std::sync::Arc;
use tokio::time::{sleep, timeout, Duration, Instant};
use tokio::sync::mpsc::Receiver;
use tauri::{AppHandle, Emitter};

pub fn is_hallucination(text: &str) -> bool {
    let lower = text.to_lowercase();
    let trimmed = lower.trim();
    if trimmed.is_empty() {
        return true;
    }
    
    trimmed.contains("amara.org")
        || trimmed.contains("subtitles by")
        || trimmed.contains("napisy stworzone przez")
        || trimmed.contains("napisy pl")
        || trimmed == "dziękuję za uwagę."
        || trimmed == "dziękuję za uwagę"
        || trimmed == "dziękuję."
        || trimmed == "dziękuję"
        || trimmed == "thank you."
        || trimmed == "thanks for watching."
}

fn expand_trigger_words(words: &[String], target_lang: &str, translate: bool) -> Vec<String> {
    let mut result = Vec::new();

    for word in words {
        let norm = VoiceDetector::normalize(word);
        if !norm.is_empty() && !result.contains(&norm) {
            result.push(norm.clone());
        }
        let no_dia = VoiceDetector::remove_diacritics(&norm);
        if !no_dia.is_empty() && !result.contains(&no_dia) {
            result.push(no_dia);
        }
    }

    if translate || target_lang == "pl" {
        for word in words {
            let norm = VoiceDetector::normalize(word);
            let translations = match norm.as_str() {
                "zaczynamy" | "start" | "starten" | "commencer" | "empezar" | "iniziare" | "начать" | "zacznij" => {
                    match target_lang {
                        "pl" => vec!["zaczynamy", "zacznij", "start"],
                        "en" => vec!["start", "begin"],
                        "de" => vec!["starten", "los"],
                        "fr" => vec!["commencer", "go"],
                        "es" => vec!["empezar", "vamos"],
                        "it" => vec!["iniziare", "via"],
                        "ru" => vec!["начать", "старт"],
                        _ => vec!["start", "begin"]
                    }
                }
                "komputer" | "computer" | "ordinateur" | "computadora" | "компьютер" => {
                    match target_lang {
                        "pl" => vec!["komputer", "computer"],
                        "en" => vec!["computer"],
                        "de" => vec!["computer"],
                        "fr" => vec!["ordinateur"],
                        "es" => vec!["computadora"],
                        "it" => vec!["instruction", "computer"],
                        "ru" => vec!["компьютер"],
                        _ => vec!["computer"]
                    }
                }
                "dyktuj" | "pisz" | "dictate" => {
                    match target_lang {
                        "pl" => vec!["dyktuj", "pisz", "dyktowanie"],
                        "en" => vec!["dictate", "write"],
                        _ => vec!["dictate"]
                    }
                }
                "hej" | "cześć" | "czesc" | "hello" | "hi" => {
                    match target_lang {
                        "pl" => vec!["hej", "cześć", "czesc", "siema"],
                        "en" => vec!["hello", "hi", "hey"],
                        _ => vec!["hello", "hey"]
                    }
                }
                _ => vec![]
            };

            for t in translations {
                let t_norm = VoiceDetector::normalize(t);
                if !t_norm.is_empty() && !result.contains(&t_norm) {
                    result.push(t_norm.clone());
                }
                let t_no_dia = VoiceDetector::remove_diacritics(&t_norm);
                if !t_no_dia.is_empty() && !result.contains(&t_no_dia) {
                    result.push(t_no_dia);
                }
            }
        }
    }

    result
}

fn apply_detector_config(detector: &mut VoiceDetector, cfg: &Config) {
    let detector_words = expand_trigger_words(&cfg.trigger.words, &cfg.general.language, cfg.trigger.translate);
    detector.update_config(
        detector_words.clone(),
        cfg.dictation.stop_words.clone(),
        cfg.dictation.silence_timeout_ms,
        cfg.trigger.fuzzy_match,
        cfg.trigger.fuzzy_threshold,
    );
    println!("[HOTWORD_CONFIG_SYNC] Active trigger words set to: {:?}", detector_words);
}

pub async fn run_control_loop(
    mut pipeline: AudioPipeline,
    mut engine: EngineManager,
    state: Arc<AppState>,
    mut config: Config,
    mut control_rx: Receiver<ControlCommand>,
    app_handle: AppHandle,
) {
    let initial_words = expand_trigger_words(&config.trigger.words, &config.general.language, config.trigger.translate);
    println!("[HOTWORD_INIT] Active Engine: {}, Lang: {}, Trigger config words: {:?}, Expanded triggers: {:?}", 
        config.engine.engine_type, config.general.language, config.trigger.words, initial_words);

    let mut detector = VoiceDetector::new(
        initial_words,
        config.dictation.stop_words.clone(),
        config.dictation.silence_timeout_ms,
        config.trigger.fuzzy_match,
        config.trigger.fuzzy_threshold,
    );

    if !engine.has_active_engine() {
        println!("[ENGINE] Speech engine unavailable on startup. Pausing listening.");
        *state.status.lock().await = AppStatus::Paused;
        app_handle.emit("status_changed", "paused").ok();
    }

    let mut _current_partial = String::new();
    let mut live_typing = LiveTypingState::new();
    let mut focus;

    let mut idle_speech_detected = false;
    let mut idle_last_speech_time = Instant::now();

    loop {
        while let Ok(cmd) = control_rx.try_recv() {
            match cmd {
                ControlCommand::Pause => {
                    println!("[CONTROL_COMMAND] Pause");
                    *state.status.lock().await = AppStatus::Paused;
                    app_handle.emit("status_changed", "paused").ok();
                }
                ControlCommand::Resume => {
                    println!("[CONTROL_COMMAND] Resume");
                    if engine.has_active_engine() {
                        *state.status.lock().await = AppStatus::Idle;
                        app_handle.emit("status_changed", "idle").ok();
                    } else {
                        *state.status.lock().await = AppStatus::Paused;
                        app_handle.emit("status_changed", "paused").ok();
                        app_handle.emit("engine_error", "Speech engine unavailable. Please download the engine model file first.").ok();
                    }
                }
                ControlCommand::SetTriggerWords(words) => {
                    println!("[CONTROL_COMMAND] SetTriggerWords: {:?}", words);
                    config.trigger.words = words;
                    let latest_cfg = state.config.lock().await.clone();
                    config.trigger.fuzzy_match = latest_cfg.trigger.fuzzy_match;
                    config.trigger.fuzzy_threshold = latest_cfg.trigger.fuzzy_threshold;
                    apply_detector_config(&mut detector, &config);
                }
                ControlCommand::SetStopWords(words) => {
                    println!("[CONTROL_COMMAND] SetStopWords: {:?}", words);
                    config.dictation.stop_words = words;
                    let latest_cfg = state.config.lock().await.clone();
                    config.trigger.fuzzy_match = latest_cfg.trigger.fuzzy_match;
                    config.trigger.fuzzy_threshold = latest_cfg.trigger.fuzzy_threshold;
                    apply_detector_config(&mut detector, &config);
                }
                ControlCommand::SetSilenceTimeout(timeout_ms) => {
                    println!("[CONTROL_COMMAND] SetSilenceTimeout: {}ms", timeout_ms);
                    config.dictation.silence_timeout_ms = timeout_ms;
                    let latest_cfg = state.config.lock().await.clone();
                    config.trigger.fuzzy_match = latest_cfg.trigger.fuzzy_match;
                    config.trigger.fuzzy_threshold = latest_cfg.trigger.fuzzy_threshold;
                    apply_detector_config(&mut detector, &config);
                }
                ControlCommand::SetEngine(engine_type) => {
                    println!("[CONTROL_COMMAND] SetEngine: {}", engine_type);
                    let app_config = state.config.lock().await.clone();
                    if let Err(e) = engine.switch_engine(&engine_type, &app_config).await {
                        eprintln!("[ENGINE_SWITCH_ERROR] Failed to switch to {}: {}", engine_type, e);
                        app_handle.emit("engine_error", e.to_string()).ok();
                        *state.status.lock().await = AppStatus::Paused;
                        app_handle.emit("status_changed", "paused").ok();
                    } else {
                        let _ = engine.start_stream().await;
                        if engine.has_active_engine() {
                            *state.status.lock().await = AppStatus::Idle;
                            app_handle.emit("status_changed", "idle").ok();
                        }
                    }
                }
                ControlCommand::SetTriggerTranslate(val) => {
                    println!("[CONTROL_COMMAND] SetTriggerTranslate: {}", val);
                    config.trigger.translate = val;
                    let latest_cfg = state.config.lock().await.clone();
                    config.trigger.fuzzy_match = latest_cfg.trigger.fuzzy_match;
                    config.trigger.fuzzy_threshold = latest_cfg.trigger.fuzzy_threshold;
                    apply_detector_config(&mut detector, &config);
                }
                ControlCommand::SetLanguage(lang) => {
                    println!("[CONTROL_COMMAND] SetLanguage: {}", lang);
                    config.general.language = lang;
                    let latest_cfg = state.config.lock().await.clone();
                    config.trigger.fuzzy_match = latest_cfg.trigger.fuzzy_match;
                    config.trigger.fuzzy_threshold = latest_cfg.trigger.fuzzy_threshold;
                    apply_detector_config(&mut detector, &config);
                }
                ControlCommand::ForceDictate => {
                    if !engine.has_active_engine() {
                        app_handle.emit("engine_error", "Speech engine unavailable. Please download the engine model file first.").ok();
                    } else {
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
                    let is_speech = chunk.speech_prob >= 0.01 || max_vol > 0.015;
                    
                    if is_speech {
                        idle_speech_detected = true;
                        idle_last_speech_time = Instant::now();
                    }

                    // Feed audio chunk to engine
                    if let Ok(opt_transcript) = engine.feed_audio(&chunk.samples).await {
                        if let Some(transcript) = opt_transcript {
                            println!("[IDLE_STREAMING] [Engine: {}, Lang: {}] Transcript: '{}' (partial: {})", 
                                engine.active_type, config.general.language, transcript.text, transcript.is_partial);
                            
                            if let Some(remaining) = detector.check_trigger(&transcript.text) {
                                println!("[STATE] Idle → Dictating (trigger matched, remaining: '{}')", remaining);
                                let _ = engine.finalize().await;
                                let _ = engine.start_stream().await;
                                
                                *state.status.lock().await = AppStatus::Dictating;
                                app_handle.emit("status_changed", "dictating").ok();
                                
                                detector.mark_speech();
                                _current_partial = String::new();
                                idle_speech_detected = false;
                                
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

                // Handling non-streaming / batch engines in Idle state:
                // When speech was detected and silence follows (400ms), finalize idle buffer to check for trigger words
                if idle_speech_detected && idle_last_speech_time.elapsed() >= Duration::from_millis(400) {
                    idle_speech_detected = false;
                    if let Ok(final_idle_text) = engine.finalize().await {
                        if is_hallucination(&final_idle_text) {
                            println!("[IDLE_BATCH_FINALIZE] Ignored Whisper hallucination in idle state: '{}'", final_idle_text);
                            let _ = engine.start_stream().await;
                        } else if !final_idle_text.trim().is_empty() {
                            println!("[IDLE_BATCH_FINALIZE] Engine: {} | Finalized text: '{}'", engine.active_type, final_idle_text);
                            if let Some(remaining) = detector.check_trigger(&final_idle_text) {
                                println!("[STATE] Idle → Dictating (batch trigger matched, remaining: '{}')", remaining);
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
                            } else {
                                let _ = engine.start_stream().await;
                            }
                        } else {
                            let _ = engine.start_stream().await;
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
                    if !final_text.is_empty() && !is_hallucination(&final_text) {
                        {
                            let mut stats = state.session_stats.lock().await;
                            stats.dictations_count += 1;
                            stats.words_total += final_text.split_whitespace().count() as u32;
                        }
                        focus = detect_focused_text_field();
                        if !matches!(focus, FocusResult::NoTextField) {
                            let _ = live_typing.finalize(&final_text, &focus, config.input.key_delay_ms).await;
                        } else {
                            println!("[CLIPBOARD] No text field focused - Copied text to clipboard: {}", final_text);
                            let _ = copy_to_clipboard(&final_text);
                            crate::handle_no_input_notification(&app_handle);
                        }
                        app_handle.emit("transcript_final", final_text.clone()).ok();
                    } else if is_hallucination(&final_text) {
                        println!("[FLUSH] Ignored Whisper hallucination on flush: '{}'", final_text);
                    }
                    *state.status.lock().await = AppStatus::Idle;
                    app_handle.emit("status_changed", "idle").ok();
                    _current_partial = String::new();
                }

                if let Ok(Some(chunk)) = chunk_opt {
                    detector.mark_speech();
                    if let Ok(Some(transcript)) = engine.feed_audio(&chunk.samples).await {
                        if transcript.is_partial {
                            if !is_hallucination(&transcript.text) {
                                println!("[PARTIAL] [Engine: {}, Lang: {}] Transcript: '{}'", engine.active_type, config.general.language, transcript.text);
                                _current_partial = transcript.text.clone();
                                app_handle.emit("transcript_partial", transcript.text.clone()).ok();
                                
                                if config.dictation.live_typing {
                                    focus = detect_focused_text_field();
                                    if config.input.prefer_uia || !matches!(focus, FocusResult::NoTextField) {
                                        let _ = live_typing.update_partial(&transcript.text, &focus, config.input.key_delay_ms).await;
                                    }
                                }
                            }
                        } else {
                            if !is_hallucination(&transcript.text) {
                                println!("[FINAL] [Engine: {}, Lang: {}] Transcript: '{}'", engine.active_type, config.general.language, transcript.text);
                                if !transcript.text.is_empty() {
                                    let mut stats = state.session_stats.lock().await;
                                    stats.dictations_count += 1;
                                    stats.words_total += transcript.text.split_whitespace().count() as u32;
                                }
                                _current_partial = String::new();
                                app_handle.emit("transcript_final", transcript.text.clone()).ok();
                                
                                focus = detect_focused_text_field();
                                if !matches!(focus, FocusResult::NoTextField) {
                                    let _ = live_typing.finalize(&transcript.text, &focus, config.input.key_delay_ms).await;
                                } else if !transcript.text.trim().is_empty() {
                                    println!("[CLIPBOARD] No text field focused - Copied text to clipboard: {}", transcript.text);
                                    let _ = copy_to_clipboard(&transcript.text);
                                    crate::handle_no_input_notification(&app_handle);
                                }
                            } else {
                                println!("[FINAL] Ignored Whisper hallucination on final: '{}'", transcript.text);
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

