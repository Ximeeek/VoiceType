use std::time::Instant;

pub struct VoiceDetector {
    trigger_words: Vec<String>,
    stop_words: Vec<String>,
    silence_timeout_ms: u64,
    last_speech_at: Instant,
    fuzzy_match: bool,
    fuzzy_threshold: u32,
}

impl VoiceDetector {
    pub fn new(
        trigger_words: Vec<String>, 
        stop_words: Vec<String>, 
        silence_timeout_ms: u64,
        fuzzy_match: bool,
        fuzzy_threshold: u32,
    ) -> Self {
        Self {
            trigger_words: trigger_words.into_iter().map(|w| Self::normalize(&w)).collect(),
            stop_words: stop_words.into_iter().map(|w| Self::normalize(&w)).collect(),
            silence_timeout_ms,
            last_speech_at: Instant::now(),
            fuzzy_match,
            fuzzy_threshold,
        }
    }

    pub fn normalize(text: &str) -> String {
        let mut normalized = String::new();
        for c in text.chars() {
            if !['.', ',', '!', '?', ';', ':', '\'', '"', '-', '_', '(', ')', '[', ']', '{', '}'].contains(&c) {
                normalized.push(c);
            }
        }
        normalized.trim().to_lowercase()
    }

    pub fn check_trigger(&mut self, text: &str) -> Option<String> {
        let text_lower = text.to_lowercase();
        for trigger in &self.trigger_words {
            let t_lower = trigger.to_lowercase();
            if let Some(idx) = text_lower.find(&t_lower) {
                let remaining = text[idx + t_lower.len()..].trim().to_string();
                return Some(remaining);
            }
        }

        if self.fuzzy_match {
            for word in &self.trigger_words {
                let mut char_offset = 0;
                for spoken_word in text.split_whitespace() {
                    let norm_spoken = Self::normalize(spoken_word);
                    if !norm_spoken.is_empty() && strsim::levenshtein(&norm_spoken, word) <= self.fuzzy_threshold as usize {
                        if let Some(pos) = text[char_offset..].find(spoken_word) {
                            let actual_idx = char_offset + pos + spoken_word.len();
                            let remaining = text[actual_idx..].trim().to_string();
                            return Some(remaining);
                        }
                    }
                    if let Some(pos) = text[char_offset..].find(spoken_word) {
                        char_offset += pos + spoken_word.len();
                    }
                }
            }
        }

        None
    }

    pub fn check_stop(&self, text: &str) -> bool {
        let normalized = Self::normalize(text);
        
        for stop in &self.stop_words {
            if normalized.contains(stop) {
                return true;
            }
        }
        false
    }

    pub fn mark_speech(&mut self) {
        self.last_speech_at = Instant::now();
    }

    pub fn is_silence_timeout(&self) -> bool {
        if self.silence_timeout_ms == 0 {
            return false;
        }
        self.last_speech_at.elapsed().as_millis() as u64 >= self.silence_timeout_ms
    }

    pub fn update_config(
        &mut self, 
        trigger_words: Vec<String>, 
        stop_words: Vec<String>, 
        silence_timeout_ms: u64,
        fuzzy_match: bool,
        fuzzy_threshold: u32,
    ) {
        self.trigger_words = trigger_words.into_iter().map(|w| Self::normalize(&w)).collect();
        self.stop_words = stop_words.into_iter().map(|w| Self::normalize(&w)).collect();
        self.silence_timeout_ms = silence_timeout_ms;
        self.fuzzy_match = fuzzy_match;
        self.fuzzy_threshold = fuzzy_threshold;
    }
}
