pub mod detector;
pub mod utils;

use crate::{AppState, AppStatus, ControlCommand};
use crate::audio::AudioPipeline;
use crate::config::Config;
use crate::recognition::engine_manager::EngineManager;
use crate::input::{detect_focused_text_field, LiveTypingState, copy_to_clipboard, FocusResult, send_enter};
use detector::VoiceDetector;
use utils::{is_hallucination, expand_trigger_words, should_trigger_without_wake_word};
use std::sync::Arc;
use tokio::time::{sleep, timeout, Duration, Instant};
use tokio::sync::mpsc::Receiver;
use tauri::{AppHandle, Emitter};

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
    let mut focus = FocusResult::NoTextField;

    let mut idle_speech_detected = false;
    let mut idle_speech_start_time: Option<Instant> = None;
    let mut idle_last_speech_time = Instant::now();
    let mut batch_remaining_text: Option<String> = None;
    let mut dictating_last_interim_time = Instant::now();

    loop {
        while let Ok(cmd) = control_rx.try_recv() {
            match cmd {
                ControlCommand::Pause => {
                    println!("[CONTROL_COMMAND] Pause");
                    *state.status.lock().await = AppStatus::Paused;
                    app_handle.emit("status_changed", "paused").ok();
                    idle_speech_detected = false;
                    idle_speech_start_time = None;
                }
                ControlCommand::Resume => {
                    println!("[CONTROL_COMMAND] Resume");
                    if engine.has_active_engine() {
                        *state.status.lock().await = AppStatus::Idle;
                        app_handle.emit("status_changed", "idle").ok();
                        idle_speech_detected = false;
                        idle_speech_start_time = None;
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
                            idle_speech_detected = false;
                            idle_speech_start_time = None;
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
                ControlCommand::SetNoWakeWord(val) => {
                    println!("[CONTROL_COMMAND] SetNoWakeWord: {}", val);
                    config.trigger.no_wake_word = val;
                }
                ControlCommand::UpdateConfig(new_config) => {
                    println!("[CONTROL_COMMAND] UpdateConfig");
                    config = new_config;
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
                            idle_speech_detected = false;
                            idle_speech_start_time = None;
                            
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
                        if !idle_speech_detected {
                            idle_speech_detected = true;
                            idle_speech_start_time = Some(Instant::now());
                        }
                        idle_last_speech_time = Instant::now();
                    }

                    // Feed audio chunk to engine
                    if let Ok(opt_transcript) = engine.feed_audio(&chunk.samples).await {
                        if let Some(transcript) = opt_transcript {
                            println!("[IDLE_STREAMING] [Engine: {}, Lang: {}] Transcript: '{}' (partial: {})", 
                                engine.active_type, config.general.language, transcript.text, transcript.is_partial);
                            
                            let trigger_matched = if config.trigger.no_wake_word {
                                if should_trigger_without_wake_word(&transcript.text) {
                                    Some(transcript.text.clone())
                                } else {
                                    None
                                }
                            } else {
                                detector.check_trigger(&transcript.text)
                            };

                            if let Some(remaining) = trigger_matched {
                                println!("[STATE] Idle → Dictating (trigger matched, remaining: '{}')", remaining);
                                let _ = engine.finalize().await;
                                let _ = engine.start_stream().await;
                                
                                *state.status.lock().await = AppStatus::Dictating;
                                app_handle.emit("status_changed", "dictating").ok();
                                
                                detector.mark_speech();
                                _current_partial = String::new();
                                idle_speech_detected = false;
                                idle_speech_start_time = None;
                                
                                focus = detect_focused_text_field();
                                app_handle.emit("focus_detected", !matches!(focus, FocusResult::NoTextField)).ok();
                                live_typing = LiveTypingState::new();

                                if !remaining.is_empty() && config.is_live_typing_enabled() {
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
                // 1. When speech was detected and silence follows (400ms), finalize idle buffer to check for trigger words
                if idle_speech_detected && idle_last_speech_time.elapsed() >= Duration::from_millis(400) {
                    idle_speech_detected = false;
                    idle_speech_start_time = None;
                    if let Ok(final_idle_text) = engine.finalize().await {
                        if is_hallucination(&final_idle_text) {
                            println!("[IDLE_BATCH_FINALIZE] Ignored Whisper hallucination in idle state: '{}'", final_idle_text);
                            let _ = engine.start_stream().await;
                        } else if !final_idle_text.trim().is_empty() {
                            println!("[IDLE_BATCH_FINALIZE] Engine: {} | Finalized text: '{}'", engine.active_type, final_idle_text);
                            let trigger_matched = if config.trigger.no_wake_word {
                                if should_trigger_without_wake_word(&final_idle_text) {
                                    Some(final_idle_text.clone())
                                } else {
                                    None
                                }
                            } else {
                                detector.check_trigger(&final_idle_text)
                            };

                            if let Some(remaining) = trigger_matched {
                                println!("[STATE] Idle → Dictating (batch trigger matched, remaining: '{}')", remaining);
                                let _ = engine.start_stream().await;
                                
                                *state.status.lock().await = AppStatus::Dictating;
                                app_handle.emit("status_changed", "dictating").ok();
                                
                                detector.mark_speech();
                                _current_partial = String::new();
                                idle_speech_detected = false;
                                idle_speech_start_time = None;
                                
                                focus = detect_focused_text_field();
                                app_handle.emit("focus_detected", !matches!(focus, FocusResult::NoTextField)).ok();
                                live_typing = LiveTypingState::new();

                                if !remaining.is_empty() {
                                    batch_remaining_text = Some(remaining.clone());
                                    if config.is_live_typing_enabled() {
                                        _current_partial = remaining.clone();
                                        if config.input.prefer_uia || !matches!(focus, FocusResult::NoTextField) {
                                            let _ = live_typing.update_partial(&remaining, &focus, config.input.key_delay_ms).await;
                                        }
                                    }
                                } else {
                                    batch_remaining_text = None;
                                }
                            }
                        }
                    }
                }

                // 2. When speech is active and has been continuous for a while (1.5s), finalize idle buffer to check for trigger words
                if !engine.supports_streaming() && idle_speech_detected {
                    if let Some(start_time) = idle_speech_start_time {
                        if start_time.elapsed() >= Duration::from_millis(1500) {
                            println!("[IDLE_BATCH_PERIODIC] Continuous speech for 1.5s, finalizing buffer to check trigger");
                            idle_speech_start_time = Some(Instant::now());
                            if let Ok(final_idle_text) = engine.finalize().await {
                                if is_hallucination(&final_idle_text) {
                                    println!("[IDLE_BATCH_PERIODIC] Ignored Whisper hallucination in idle state: '{}'", final_idle_text);
                                    let _ = engine.start_stream().await;
                                } else if !final_idle_text.trim().is_empty() {
                                    println!("[IDLE_BATCH_PERIODIC] Engine: {} | Finalized text: '{}'", engine.active_type, final_idle_text);
                                    let trigger_matched = if config.trigger.no_wake_word {
                                        if should_trigger_without_wake_word(&final_idle_text) {
                                            Some(final_idle_text.clone())
                                        } else {
                                            None
                                        }
                                    } else {
                                        detector.check_trigger(&final_idle_text)
                                    };

                                    if let Some(remaining) = trigger_matched {
                                        println!("[STATE] Idle → Dictating (periodic batch trigger matched, remaining: '{}')", remaining);
                                        let _ = engine.start_stream().await;
                                        
                                        *state.status.lock().await = AppStatus::Dictating;
                                        app_handle.emit("status_changed", "dictating").ok();
                                        
                                        detector.mark_speech();
                                        _current_partial = String::new();
                                        idle_speech_detected = false;
                                        idle_speech_start_time = None;
                                        
                                        focus = detect_focused_text_field();
                                        app_handle.emit("focus_detected", !matches!(focus, FocusResult::NoTextField)).ok();
                                        live_typing = LiveTypingState::new();

                                        if !remaining.is_empty() {
                                            batch_remaining_text = Some(remaining.clone());
                                            if config.is_live_typing_enabled() {
                                                _current_partial = remaining.clone();
                                                if config.input.prefer_uia || !matches!(focus, FocusResult::NoTextField) {
                                                    let _ = live_typing.update_partial(&remaining, &focus, config.input.key_delay_ms).await;
                                                }
                                            }
                                        } else {
                                            batch_remaining_text = None;
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
                }
            }

            AppStatus::Dictating => {
                // Drain any queued audio chunks to update VAD and engine buffer without delay
                while let Ok(chunk) = pipeline.speech_rx.try_recv() {
                    let max_vol = chunk.samples.iter().map(|v| v.abs()).fold(0.0f32, |a, b| a.max(b));
                    if chunk.speech_prob >= 0.01 || max_vol > 0.015 {
                        detector.mark_speech();
                    }
                    let _ = engine.feed_audio(&chunk.samples).await;
                }

                if detector.is_silence_timeout() {
                    println!("[FLUSH] Silence timeout - flushing text");
                    *state.status.lock().await = AppStatus::Processing;
                    app_handle.emit("status_changed", "processing").ok();

                    let mut final_text = engine.finalize().await.unwrap_or_default();
                    if let Some(ref remaining) = batch_remaining_text {
                        if final_text.trim().is_empty() || is_hallucination(&final_text) {
                            final_text = remaining.clone();
                        } else {
                            final_text = format!("{} {}", remaining, final_text);
                        }
                    }
                    batch_remaining_text = None;

                    if !final_text.is_empty() && !is_hallucination(&final_text) {
                        {
                            let mut stats = state.session_stats.lock().await;
                            stats.dictations_count += 1;
                            stats.words_total += final_text.split_whitespace().count() as u32;
                        }
                        focus = detect_focused_text_field();
                        if !matches!(focus, FocusResult::NoTextField) {
                            let _ = live_typing.finalize(&final_text, &focus, config.input.key_delay_ms, config.input.instant_paste).await;
                            let latest_cfg = state.config.lock().await;
                            if latest_cfg.input.auto_enter {
                                println!("[AUTO_ENTER] Sending Enter key after silence timeout flush.");
                                let _ = send_enter(&focus).await;
                            }
                        } else {
                            println!("[CLIPBOARD] No text field focused - Copied text to clipboard: {}", final_text);
                            let _ = copy_to_clipboard(&final_text);
                            crate::notification::handle_no_input_notification(&app_handle);
                        }
                        app_handle.emit("transcript_final", final_text.clone()).ok();
                    } else if is_hallucination(&final_text) {
                        println!("[FLUSH] Ignored Whisper hallucination on flush: '{}'", final_text);
                    }
                    *state.status.lock().await = AppStatus::Idle;
                    app_handle.emit("status_changed", "idle").ok();
                    _current_partial = String::new();
                    idle_speech_detected = false;
                    idle_speech_start_time = None;
                }

                if let Ok(Some(chunk)) = chunk_opt {
                    let max_vol = chunk.samples.iter().map(|v| v.abs()).fold(0.0f32, |a, b| a.max(b));
                    if chunk.speech_prob >= 0.01 || max_vol > 0.015 {
                        detector.mark_speech();
                    }
                    if let Ok(Some(transcript)) = engine.feed_audio(&chunk.samples).await {
                        if transcript.is_partial {
                            if !is_hallucination(&transcript.text) {
                                println!("[PARTIAL] [Engine: {}, Lang: {}] Transcript: '{}'", engine.active_type, config.general.language, transcript.text);
                                _current_partial = transcript.text.clone();
                                app_handle.emit("transcript_partial", transcript.text.clone()).ok();
                                
                                if config.is_live_typing_enabled() {
                                    focus = detect_focused_text_field();
                                    if config.input.prefer_uia || !matches!(focus, FocusResult::NoTextField) {
                                        let _ = live_typing.update_partial(&transcript.text, &focus, config.input.key_delay_ms).await;
                                    }
                                }
                            }
                        } else {
                            let mut final_text = transcript.text.clone();
                            if let Some(ref remaining) = batch_remaining_text {
                                if final_text.trim().is_empty() || is_hallucination(&final_text) {
                                    final_text = remaining.clone();
                                } else {
                                    final_text = format!("{} {}", remaining, final_text);
                                }
                            }
                            batch_remaining_text = None;

                            if !is_hallucination(&final_text) {
                                println!("[FINAL] [Engine: {}, Lang: {}] Transcript: '{}'", engine.active_type, config.general.language, final_text);
                                if !final_text.is_empty() {
                                    let mut stats = state.session_stats.lock().await;
                                    stats.dictations_count += 1;
                                    stats.words_total += final_text.split_whitespace().count() as u32;
                                }
                                _current_partial = String::new();
                                app_handle.emit("transcript_final", final_text.clone()).ok();
                                
                                focus = detect_focused_text_field();
                                if !matches!(focus, FocusResult::NoTextField) {
                                    let _ = live_typing.finalize(&final_text, &focus, config.input.key_delay_ms, config.input.instant_paste).await;
                                } else if !final_text.trim().is_empty() {
                                    println!("[CLIPBOARD] No text field focused - Copied text to clipboard: {}", final_text);
                                    let _ = copy_to_clipboard(&final_text);
                                    crate::notification::handle_no_input_notification(&app_handle);
                                }
                            } else {
                                println!("[FINAL] Ignored Whisper hallucination on final: '{}'", final_text);
                            }
                            
                            if detector.check_stop(&transcript.text) {
                                println!("[STATE] Dictating → Idle (stop word)");
                                *state.status.lock().await = AppStatus::Idle;
                                app_handle.emit("status_changed", "idle").ok();
                                idle_speech_detected = false;
                                idle_speech_start_time = None;
                                let latest_cfg = state.config.lock().await;
                                if latest_cfg.input.auto_enter && !matches!(focus, FocusResult::NoTextField) {
                                    println!("[AUTO_ENTER] Sending Enter key after stop word.");
                                    let _ = send_enter(&focus).await;
                                }
                            }
                        }
                    }

                    // Simulated streaming for non-native streaming engines (periodic interim transcription pass)
                    if !engine.supports_streaming() && config.is_live_typing_enabled() && dictating_last_interim_time.elapsed() >= Duration::from_millis(config.dictation.live_typing_interval_ms) {
                        dictating_last_interim_time = Instant::now();
                        if let Ok(Some(interim_text)) = engine.get_interim_transcript().await {
                            // Immediately drain queued chunks after inference to refresh VAD timestamp!
                            while let Ok(chunk) = pipeline.speech_rx.try_recv() {
                                let max_vol = chunk.samples.iter().map(|v| v.abs()).fold(0.0f32, |a, b| a.max(b));
                                if chunk.speech_prob >= 0.01 || max_vol > 0.015 {
                                    detector.mark_speech();
                                }
                                let _ = engine.feed_audio(&chunk.samples).await;
                            }

                            if !interim_text.trim().is_empty() && !is_hallucination(&interim_text) {
                                let display_text = if let Some(ref remaining) = batch_remaining_text {
                                    format!("{} {}", remaining, interim_text)
                                } else {
                                    interim_text
                                };
                                println!("[SIMULATED_STREAMING] [Engine: {}] Interim text: '{}'", engine.active_type, display_text);
                                _current_partial = display_text.clone();
                                app_handle.emit("transcript_partial", display_text.clone()).ok();

                                if config.is_live_typing_enabled() {
                                    focus = detect_focused_text_field();
                                    if config.input.prefer_uia || !matches!(focus, FocusResult::NoTextField) {
                                        let _ = live_typing.update_partial(&display_text, &focus, config.input.key_delay_ms).await;
                                    }
                                }
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


