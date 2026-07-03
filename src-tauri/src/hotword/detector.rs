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
        let normalized_triggers = trigger_words
            .into_iter()
            .map(|w| Self::normalize(&w))
            .filter(|w| !w.is_empty())
            .collect();

        let normalized_stops = stop_words
            .into_iter()
            .map(|w| Self::normalize(&w))
            .filter(|w| !w.is_empty())
            .collect();

        println!("[TRIGGER_DETECTOR_INIT] Triggers: {:?}, Stops: {:?}, Fuzzy: {} (thresh={})",
            normalized_triggers, normalized_stops, fuzzy_match, fuzzy_threshold);

        Self {
            trigger_words: normalized_triggers,
            stop_words: normalized_stops,
            silence_timeout_ms,
            last_speech_at: Instant::now(),
            fuzzy_match,
            fuzzy_threshold,
        }
    }

    pub fn remove_diacritics(s: &str) -> String {
        s.chars()
            .map(|c| match c {
                'ą' | 'Ą' => 'a',
                'ć' | 'Ć' => 'c',
                'ę' | 'Ę' => 'e',
                'ł' | 'Ł' => 'l',
                'ń' | 'Ń' => 'n',
                'ó' | 'Ó' => 'o',
                'ś' | 'Ś' => 's',
                'ź' | 'Ź' | 'ż' | 'Ż' => 'z',
                _ => c,
            })
            .collect()
    }

    pub fn normalize(text: &str) -> String {
        let mut normalized = String::new();
        for c in text.chars() {
            if !['.', ',', '!', '?', ';', ':', '\'', '"', '-', '_', '(', ')', '[', ']', '{', '}', '„', '”', '«', '»'].contains(&c) {
                normalized.push(c);
            }
        }
        normalized.trim().to_lowercase()
    }

    pub fn check_trigger(&mut self, text: &str) -> Option<String> {
        if text.trim().is_empty() {
            return None;
        }

        let raw_norm = Self::normalize(text);
        let raw_norm_no_diacritics = Self::remove_diacritics(&raw_norm);

        println!("[TRIGGER_CHECK] Received text: '{}' | Normalized: '{}' | No-Diacritics: '{}'", text, raw_norm, raw_norm_no_diacritics);
        println!("[TRIGGER_CHECK] Active trigger words: {:?}", self.trigger_words);

        // 1. Direct normalized match with word boundary checking
        for trigger in &self.trigger_words {
            let trig_norm = Self::normalize(trigger);
            let trig_no_dia = Self::remove_diacritics(&trig_norm);

            if trig_norm.is_empty() {
                continue;
            }

            // Check if normalized text contains trigger
            let match_found = Self::contains_as_word(&raw_norm, &trig_norm) 
                || Self::contains_as_word(&raw_norm_no_diacritics, &trig_no_dia);

            if match_found {
                println!("[TRIGGER_MATCHED] Direct match found for trigger: '{}' in text: '{}'", trigger, text);
                
                // Find position in raw text to compute remaining text
                let remaining = Self::extract_remaining_text(text, trigger, &trig_norm);
                println!("[TRIGGER_MATCHED] Extracted remaining text: '{}'", remaining);
                return Some(remaining);
            }
        }

        // 2. Fuzzy match mode if enabled
        if self.fuzzy_match {
            let spoken_words: Vec<&str> = text.split_whitespace().collect();
            for word in &self.trigger_words {
                let trig_norm = Self::normalize(word);
                let trig_no_dia = Self::remove_diacritics(&trig_norm);

                let trig_len = trig_norm.chars().count();
                let max_allowed_dist = if trig_len <= 5 {
                    1
                } else {
                    self.fuzzy_threshold as usize
                };

                for (idx, spoken_word) in spoken_words.iter().enumerate() {
                    let norm_spoken = Self::normalize(spoken_word);
                    let norm_spoken_no_dia = Self::remove_diacritics(&norm_spoken);

                    let dist1 = strsim::levenshtein(&norm_spoken, &trig_norm);
                    let dist2 = strsim::levenshtein(&norm_spoken_no_dia, &trig_no_dia);

                    if (!norm_spoken.is_empty() && dist1 <= max_allowed_dist) 
                        || (!norm_spoken_no_dia.is_empty() && dist2 <= max_allowed_dist) 
                    {
                        println!("[TRIGGER_MATCHED] Fuzzy match for trigger '{}' on spoken word '{}' (dist: min({}, {}))", 
                            word, spoken_word, dist1, dist2);

                        // Extract remaining text after this spoken word index
                        let remaining_words = spoken_words[idx + 1..].join(" ");
                        let remaining = Self::clean_leading_punct(&remaining_words);
                        println!("[TRIGGER_MATCHED] Extracted remaining text after fuzzy match: '{}'", remaining);
                        return Some(remaining);
                    }
                }
            }
        }

        println!("[TRIGGER_NO_MATCH] No trigger matched in '{}'", text);
        None
    }

    fn contains_as_word(text: &str, target: &str) -> bool {
        if text == target {
            return true;
        }
        if let Some(pos) = text.find(target) {
            let before_ok = pos == 0 || text[..pos].ends_with(' ');
            let after_pos = pos + target.len();
            let after_ok = after_pos == text.len() || text[after_pos..].starts_with(' ');
            return before_ok && after_ok;
        }
        false
    }

    fn extract_remaining_text(original_text: &str, trigger_raw: &str, trigger_norm: &str) -> String {
        let lower_orig = original_text.to_lowercase();
        
        // Try finding raw trigger first
        if let Some(idx) = lower_orig.find(&trigger_raw.to_lowercase()) {
            let after = &original_text[idx + trigger_raw.len()..];
            return Self::clean_leading_punct(after);
        }

        // Try finding normalized trigger
        let trigger_words: Vec<&str> = trigger_norm.split_whitespace().collect();
        if let Some(&last_word) = trigger_words.last() {
            let lower_last = last_word.to_lowercase();
            if let Some(idx) = lower_orig.find(&lower_last) {
                let after = &original_text[idx + lower_last.len()..];
                return Self::clean_leading_punct(after);
            }
        }

        // Fallback: return original text without leading punctuation
        Self::clean_leading_punct(original_text)
    }

    fn clean_leading_punct(s: &str) -> String {
        let trimmed = s.trim();
        let stripped = trimmed.trim_start_matches(|c: char| {
            c.is_ascii_punctuation() || [',', '.', '!', '?', ';', ':', '-', ' ', '„', '”'].contains(&c)
        });
        stripped.trim().to_string()
    }

    pub fn check_stop(&self, text: &str) -> bool {
        let normalized = Self::normalize(text);
        let no_diacritics = Self::remove_diacritics(&normalized);
        
        for stop in &self.stop_words {
            let stop_norm = Self::normalize(stop);
            let stop_no_dia = Self::remove_diacritics(&stop_norm);
            if normalized.contains(&stop_norm) || no_diacritics.contains(&stop_no_dia) {
                println!("[STOP_WORD_MATCHED] Stop word '{}' matched in text: '{}'", stop, text);
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
        self.trigger_words = trigger_words
            .into_iter()
            .map(|w| Self::normalize(&w))
            .filter(|w| !w.is_empty())
            .collect();

        self.stop_words = stop_words
            .into_iter()
            .map(|w| Self::normalize(&w))
            .filter(|w| !w.is_empty())
            .collect();

        self.silence_timeout_ms = silence_timeout_ms;
        self.fuzzy_match = fuzzy_match;
        self.fuzzy_threshold = fuzzy_threshold;

        println!("[TRIGGER_DETECTOR_UPDATE] Updated detector triggers: {:?}, Stops: {:?}, Fuzzy: {}",
            self.trigger_words, self.stop_words, self.fuzzy_match);
    }
}

