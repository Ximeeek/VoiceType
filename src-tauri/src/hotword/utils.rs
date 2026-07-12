// src-tauri/src/hotword/utils.rs
//
// Single Responsibility: Provides text analysis and processing utility functions for trigger word
// detection (such as hallucination filtering, trigger/stop word translation and expansion).

use super::detector::VoiceDetector;

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

pub fn expand_trigger_words(words: &[String], target_lang: &str, translate: bool) -> Vec<String> {
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

pub fn should_trigger_without_wake_word(text: &str) -> bool {
    let clean_text = text.trim();
    if clean_text.is_empty() {
        return false;
    }
    
    // Split into alphanumeric words, ignoring punctuation
    let words: Vec<&str> = clean_text
        .split(|c: char| !c.is_alphanumeric() && c != '\'')
        .filter(|s| !s.is_empty())
        .collect();
        
    if words.is_empty() {
        return false;
    }
    
    // Check if there is at least one non-filler, meaningful word
    let mut has_meaningful_word = false;
    for &word in &words {
        let normalized = word.to_lowercase();
        // A word is meaningful if it is not in the filler list and has length >= 2
        let is_filler = matches!(
            normalized.as_str(),
            // English fillers/particles
            "uh" | "um" | "ah" | "er" | "oh" | "ok" | "okay" | "hm" | "hmm" | "eh" | "hey" | "hi" | "ups" | "oops" | 
            "so" | "the" | "a" | "an" | "of" | "in" | "on" | "at" | "by" | "for" | "with" | "to" | "and" | "or" | "but" |
            // Polish fillers/particles (with "a" and "to" removed here since they are in the line above)
            "yhm" | "yhy" | "uhm" | "aaa" | "eee" | "ym" | "hym" | "okej" | "ej" | "halo" | "no" | "co" | "ta" | 
            "te" | "po" | "za" | "do" | "na" | "we" | "ze" | "od" | "w" | "z" | "o" | "i" | "u"
        );
        
        if !is_filler && normalized.chars().count() >= 2 {
            has_meaningful_word = true;
            break;
        }
    }
    
    has_meaningful_word
}
