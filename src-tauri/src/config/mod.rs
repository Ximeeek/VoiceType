pub mod settings;

pub use settings::Config;
use std::path::PathBuf;
use std::fs;

fn get_config_dir() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    #[cfg(debug_assertions)]
    path.push("voicetype-dev");
    #[cfg(not(debug_assertions))]
    path.push("voicetype");
    path
}

pub fn default_config() -> Config {
    Config::default()
}

pub fn load_config() -> Config {
    let mut config_path = get_config_dir();
    if !config_path.exists() {
        let _ = fs::create_dir_all(&config_path);
    }
    config_path.push("config.toml");

    if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(config) = toml::from_str(&content) {
                return config;
            }
        }
    }

    let default_cfg = default_config();
    let _ = save_config(&default_cfg);
    default_cfg
}

pub fn save_config(config: &Config) -> anyhow::Result<()> {
    let mut config_path = get_config_dir();
    if !config_path.exists() {
        fs::create_dir_all(&config_path)?;
    }
    config_path.push("config.toml");
    
    let toml_string = toml::to_string_pretty(config)?;
    fs::write(config_path, toml_string)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_dir_profile_separation() {
        let dir = get_config_dir();
        let dir_str = dir.to_string_lossy();
        #[cfg(debug_assertions)]
        assert!(dir_str.contains("voicetype-dev"), "Expected 'voicetype-dev' in debug path, got: {}", dir_str);
        #[cfg(not(debug_assertions))]
        assert!(dir_str.contains("voicetype"), "Expected 'voicetype' in release path, got: {}", dir_str);
        #[cfg(not(debug_assertions))]
        assert!(!dir_str.contains("voicetype-dev"), "Expected no 'voicetype-dev' in release path, got: {}", dir_str);
    }

    #[test]
    fn test_default_language_detection() {
        let config = default_config();
        let lang = &config.general.language;
        assert!(lang == "en" || lang == "pl", "Default language should be 'en' or 'pl', got: {}", lang);
        println!("Detected system default language: {}", lang);
    }
}
