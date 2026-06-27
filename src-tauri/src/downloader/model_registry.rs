use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
pub struct ModelInfo {
    pub engine: String,
    pub model_id: String, // Używamy oryginalnej nazwy jako ID, np. "vosk-model-small-pl-0.22"
    pub url: String,
    pub sha256: Option<String>,
    pub size_bytes: u64,
    pub dest_filename: String,
}

#[derive(Deserialize, Debug, Clone)]
struct VoskModelJson {
    lang: String,
    name: String,
    size: u64,
    size_text: Option<String>,
    #[serde(default)]
    #[serde(rename = "type")]
    model_type: String,
    url: String,
    #[serde(default)]
    obsolete: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AvailableModel {
    pub id: String,         // np. "vosk-model-small-pl-0.22"
    pub name: String,       // Przyjazna nazwa
    pub size_text: String,  // np. "50.5 MiB"
    pub is_downloaded: bool,
    pub is_active: bool,
    pub size_bytes: u64,
}

pub fn get_models_dir() -> PathBuf {
    let mut p = PathBuf::from("models");
    if !p.exists() {
        p = Path::new("..").join("models");
    }
    p
}

// Pobiera listę modeli Vosk dla wybranego języka z internetu, albo zwraca fallback jeśli brak sieci
pub async fn fetch_available_vosk_models(current_model_path: &str, lang: &str) -> Vec<AvailableModel> {
    let models_dir = get_models_dir().join("vosk");
    
    let mut fetched_models = Vec::new();
    
    // Budujemy klienta z nagłówkiem User-Agent, aby serwer go nie odrzucił
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .unwrap_or_default();

    if let Ok(res) = client.get("https://alphacephei.com/vosk/models/model-list.json").send().await {
        if res.status().is_success() {
            if let Ok(models) = res.json::<Vec<serde_json::Value>>().await {
                // Filtrujemy modele dla wybranego języka (np. "pl" lub "en" pasujący też do "en-us", "en-in") i te, które nie są obsolete
                for m in models {
                    let lang_val = m.get("lang").and_then(|v| v.as_str()).unwrap_or("");
                    if lang_val != lang && !lang_val.starts_with(&format!("{}-", lang)) {
                        continue;
                    }
                    let obsolete_val = m.get("obsolete").and_then(|v| v.as_str()).unwrap_or("false");
                    if obsolete_val == "true" {
                        continue;
                    }
                    
                    let name = m.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let size = m.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
                    let size_text_val = m.get("size_text").and_then(|v| v.as_str()).unwrap_or("");
                    let model_type = m.get("type").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    
                    let path = models_dir.join(&name);
                    let is_downloaded = path.is_dir();
                    let is_active = current_model_path.contains(&name);
                    
                    let size_str = if size_text_val.is_empty() {
                        format!("{:.1} MB", size as f64 / 1_048_576.0)
                    } else {
                        size_text_val.to_string()
                    };
                    
                    let name_prefix = if model_type == "small" {
                        "Mikro (small)"
                    } else if model_type == "big" {
                        "Duży (big)"
                    } else if model_type == "big-lgraph" {
                        "Duży z grafem (big-lgraph)"
                    } else {
                        "Standardowy"
                    };
                    
                    fetched_models.push(AvailableModel {
                        id: name.clone(),
                        name: format!("{} - {}", name_prefix, name),
                        size_text: size_str,
                        is_downloaded,
                        is_active,
                        size_bytes: size,
                    });
                }
            }
        }
    }
    
    // Jeśli lista jest pusta (np. brak internetu), zwracamy nasz bezpieczny fallback dla wybranego języka
    if fetched_models.is_empty() {
        let fallback_name = match lang {
            "pl" => "vosk-model-small-pl-0.22",
            "de" => "vosk-model-small-de-0.15",
            "fr" => "vosk-model-small-fr-0.22",
            "es" => "vosk-model-small-es-0.42",
            "it" => "vosk-model-small-it-0.22",
            "ru" => "vosk-model-small-ru-0.22",
            _ => "vosk-model-small-en-us-0.15",
        };
        let path = models_dir.join(fallback_name);
        fetched_models.push(AvailableModel {
            id: fallback_name.into(),
            name: format!("Mikro (small) [offline fallback] - {}", fallback_name),
            size_text: "50 MiB".into(),
            is_downloaded: path.is_dir(),
            is_active: current_model_path.contains(fallback_name),
            size_bytes: 50_000_000,
        });
    }
    
    // Sortuj rosnąco według rozmiaru modelu w bajtach
    fetched_models.sort_by_key(|m| m.size_bytes);
    
    fetched_models
}

pub async fn fetch_available_sherpa_models(current_model_path: &str, lang: &str) -> Vec<AvailableModel> {
    let models_dir = get_models_dir().join("sherpa");
    let mut fetched_models = Vec::new();
    
    // Oficjalnie dostępne i zweryfikowane modele Sherpa-ONNX z repozytorium k2-fsa/sherpa-onnx
    let model_candidates = if lang == "en" {
        vec![
            ("sherpa-onnx-streaming-zipformer-en-2023-06-26", "Zipformer EN (Streaming)", "78 MB", 81_788_928),
            ("sherpa-onnx-whisper-tiny.en", "Whisper ONNX Tiny (EN)", "75 MB", 78_643_200),
            ("sherpa-onnx-whisper-base.en", "Whisper ONNX Base (EN)", "145 MB", 152_043_520),
            ("sherpa-onnx-whisper-small.en", "Whisper ONNX Small (EN)", "480 MB", 503_316_480),
        ]
    } else {
        // Wszystkie wersje wielojęzyczne (obsługujące m.in. PL, DE, FR, ES)
        vec![
            ("sherpa-onnx-whisper-tiny", "Whisper ONNX Tiny (Multilingual)", "75 MB", 78_643_200),
            ("sherpa-onnx-whisper-base", "Whisper ONNX Base (Multilingual)", "145 MB", 152_043_520),
            ("sherpa-onnx-whisper-small", "Whisper ONNX Small (Multilingual)", "480 MB", 503_316_480),
            ("sherpa-onnx-whisper-medium", "Whisper ONNX Medium (Multilingual)", "1.5 GB", 1_610_612_736),
        ]
    };

    for (id, name, size_text, size_bytes) in model_candidates {
        let path = models_dir.join(id);
        let is_downloaded = path.is_dir();
        let is_active = current_model_path.contains(id);
        
        fetched_models.push(AvailableModel {
            id: id.to_string(),
            name: format!("{} - {}", name, id),
            size_text: size_text.to_string(),
            is_downloaded,
            is_active,
            size_bytes,
        });
    }
    
    fetched_models.sort_by_key(|m| m.size_bytes);
    fetched_models
}

pub async fn get_model_info(engine: &str, model_id: &str) -> anyhow::Result<ModelInfo> {
    match engine {
        "vosk" => {
            // Pobieramy listę, żeby wyciągnąć URL i rozmiar dla modelu o id (czyli nazwie np. "vosk-model-small-pl-0.22")
            let client = reqwest::Client::builder()
                .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .build()
                .unwrap_or_default();
            
            let mut matched_model = None;
            if let Ok(res) = client.get("https://alphacephei.com/vosk/models/model-list.json").send().await {
                if res.status().is_success() {
                    if let Ok(models) = res.json::<Vec<serde_json::Value>>().await {
                        matched_model = models.into_iter().find(|m| m.get("name").and_then(|v| v.as_str()) == Some(model_id));
                    }
                }
            }
            
            if let Some(m) = matched_model {
                let url = m.get("url").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let size = m.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
                Ok(ModelInfo {
                    engine: "vosk".into(),
                    model_id: model_id.into(),
                    url,
                    sha256: None,
                    size_bytes: size,
                    dest_filename: format!("vosk/{}", model_id),
                })
            } else {
                // Jeśli brak sieci/modelu w jsonie (np. offline fallback), generujemy URL domyślnie na podstawie nazwy modelu!
                Ok(ModelInfo {
                    engine: "vosk".into(),
                    model_id: model_id.into(),
                    url: format!("https://alphacephei.com/vosk/models/{}.zip", model_id),
                    sha256: None,
                    size_bytes: 52_979_372, // Domyślny rozmiar (np. małego modelu)
                    dest_filename: format!("vosk/{}", model_id),
                })
            }
        }
        "sherpa_onnx" => {
            let size_bytes = match model_id {
                "sherpa-onnx-streaming-zipformer-en-2023-06-26" => 81_788_928,
                "sherpa-onnx-whisper-tiny" | "sherpa-onnx-whisper-tiny.en" => 78_643_200,
                "sherpa-onnx-whisper-base" | "sherpa-onnx-whisper-base.en" => 152_043_520,
                "sherpa-onnx-whisper-small" | "sherpa-onnx-whisper-small.en" => 503_316_480,
                "sherpa-onnx-whisper-medium" => 1_610_612_736,
                _ => 100_000_000,
            };
            let url = format!("https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/{}.tar.bz2", model_id);
            Ok(ModelInfo {
                engine: "sherpa_onnx".into(),
                model_id: model_id.into(),
                url,
                sha256: None,
                size_bytes,
                dest_filename: format!("sherpa/{}", model_id),
            })
        }
        "whisper" => {
            let size_bytes = match model_id {
                "tiny" => 77_704_715,
                "base" => 147_000_000,
                "small" => 487_601_637,
                "medium" => 1_500_000_000,
                "large-v3" => 3_000_000_000,
                _ => 500_000_000,
            };
            
            let url = format!(
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-{}.bin",
                model_id
            );
            
            Ok(ModelInfo {
                engine: "whisper".into(),
                model_id: model_id.into(),
                url,
                sha256: None,
                size_bytes,
                dest_filename: format!("whisper/ggml-{}.bin", model_id),
            })
        }
        _ => Err(anyhow::anyhow!("Nieobsługiwany silnik: {}", engine)),
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InstalledModelItem {
    pub model_id: String,
    pub name: String,
    pub size_text: String,
    pub size_bytes: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InstalledEngineGroup {
    pub engine_id: String,
    pub engine_name: String,
    pub total_size_text: String,
    pub total_size_bytes: u64,
    pub models: Vec<InstalledModelItem>,
}

fn dir_size_recursive(p: &Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = std::fs::read_dir(p) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Ok(meta) = path.metadata() {
                    total += meta.len();
                }
            } else if path.is_dir() {
                total += dir_size_recursive(&path);
            }
        }
    }
    total
}

pub fn get_installed_models_summary() -> Vec<InstalledEngineGroup> {
    let mut groups = Vec::new();
    let engines = vec![
        ("vosk", "Vosk Offline", "vosk"),
        ("sherpa_onnx", "Sherpa-ONNX", "sherpa"),
        ("whisper", "Whisper / Faster-Whisper", "whisper"),
    ];

    for (engine_id, engine_name, folder_name) in engines {
        let mut models_dir = Path::new("models").join(folder_name);
        if !models_dir.exists() {
            models_dir = Path::new("..").join("models").join(folder_name);
        }

        let mut installed_items = Vec::new();
        let mut group_total_bytes = 0u64;

        if models_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&models_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    if file_name == ".keep" || file_name.ends_with(".tmp") {
                        continue;
                    }

                    let (model_id, size_bytes) = if path.is_dir() {
                        (file_name.to_string(), dir_size_recursive(&path))
                    } else if path.is_file() {
                        let size = path.metadata().map(|m| m.len()).unwrap_or(0);
                        let clean_id = file_name.strip_prefix("ggml-").and_then(|s| s.strip_suffix(".bin")).unwrap_or(file_name);
                        (clean_id.to_string(), size)
                    } else {
                        continue;
                    };

                    group_total_bytes += size_bytes;
                    let size_text = if size_bytes > 1_073_741_824 {
                        format!("{:.2} GB", size_bytes as f64 / 1_073_741_824.0)
                    } else {
                        format!("{:.1} MB", size_bytes as f64 / 1_048_576.0)
                    };
                    installed_items.push(InstalledModelItem {
                        model_id: model_id.clone(),
                        name: model_id,
                        size_text,
                        size_bytes,
                    });
                }
            }
        }

        let total_size_text = if group_total_bytes > 1_073_741_824 {
            format!("{:.2} GB", group_total_bytes as f64 / 1_073_741_824.0)
        } else {
            format!("{:.1} MB", group_total_bytes as f64 / 1_048_576.0)
        };
        groups.push(InstalledEngineGroup {
            engine_id: engine_id.to_string(),
            engine_name: engine_name.to_string(),
            total_size_text,
            total_size_bytes: group_total_bytes,
            models: installed_items,
        });
    }

    groups
}

pub fn delete_installed_model(engine_id: &str, model_id: Option<&str>) -> anyhow::Result<()> {
    let folder_name = match engine_id {
        "vosk" => "vosk",
        "sherpa_onnx" => "sherpa",
        "whisper" | "faster_whisper" => "whisper",
        _ => return Err(anyhow::anyhow!("Nieznany silnik")),
    };

    let mut models_dir = Path::new("models").join(folder_name);
    if !models_dir.exists() {
        models_dir = Path::new("..").join("models").join(folder_name);
    }

    if !models_dir.exists() {
        return Ok(());
    }

    if let Some(mid) = model_id {
        if folder_name == "whisper" {
            let file_path = models_dir.join(format!("ggml-{}.bin", mid));
            if file_path.exists() { std::fs::remove_file(file_path)?; }
        } else {
            let dir_path = models_dir.join(mid);
            if dir_path.exists() { std::fs::remove_dir_all(dir_path)?; }
        }
    } else {
        if let Ok(entries) = std::fs::read_dir(&models_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if fname == ".keep" { continue; }
                if path.is_dir() {
                    std::fs::remove_dir_all(path).ok();
                } else if path.is_file() {
                    std::fs::remove_file(path).ok();
                }
            }
        }
    }

    Ok(())
}

pub fn cleanup_model_tmp_files(engine_id: &str, model_id: &str) -> anyhow::Result<()> {
    crate::downloader::abort_download(engine_id, model_id);

    let folder_name = match engine_id {
        "vosk" => "vosk",
        "sherpa_onnx" => "sherpa",
        "whisper" | "faster_whisper" => "whisper",
        _ => return Ok(()),
    };

    let mut models_dir = Path::new("models").join(folder_name);
    if !models_dir.exists() {
        models_dir = Path::new("..").join("models").join(folder_name);
    }

    if !models_dir.exists() {
        return Ok(());
    }

    if folder_name == "whisper" {
        let file_path = models_dir.join(format!("ggml-{}.bin", model_id));
        let tmp_path = models_dir.join(format!("ggml-{}.bin.tmp", model_id));
        if tmp_path.exists() { std::fs::remove_file(tmp_path).ok(); }
        if file_path.exists() { std::fs::remove_file(file_path).ok(); }
    } else {
        let dir_path = models_dir.join(model_id);
        let tmp_path = models_dir.join(format!("{}.tmp", model_id));
        if tmp_path.exists() { std::fs::remove_file(tmp_path).ok(); }
        if dir_path.exists() { std::fs::remove_dir_all(dir_path).ok(); }
    }

    Ok(())
}
