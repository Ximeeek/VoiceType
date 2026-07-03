pub mod model_registry;
pub mod python_installer;

use reqwest::Client;
use futures_util::StreamExt;
use sha2::{Sha256, Digest};
use std::path::Path;
use tauri::Emitter;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};

static ABORT_FLAGS: Mutex<Option<HashMap<String, Arc<AtomicBool>>>> = Mutex::new(None);

fn register_abort_flag(key: &str) -> Arc<AtomicBool> {
    let mut guard = ABORT_FLAGS.lock().unwrap();
    let map = guard.get_or_insert_with(HashMap::new);
    let flag = Arc::new(AtomicBool::new(false));
    map.insert(key.to_string(), flag.clone());
    flag
}

fn remove_abort_flag(key: &str) {
    let mut guard = ABORT_FLAGS.lock().unwrap();
    if let Some(map) = guard.as_mut() {
        map.remove(key);
    }
}

pub fn abort_download(engine: &str, model_id: &str) {
    let key = format!("{}_{}", engine, model_id);
    println!("[DOWNLOAD_RUST] abort_download wywołane dla klucza: {}", key);
    let mut guard = ABORT_FLAGS.lock().unwrap();
    if let Some(map) = guard.as_mut() {
        if let Some(flag) = map.get(&key) {
            println!("[DOWNLOAD_RUST] Zapisywanie flagi abort = true dla klucza: {}", key);
            flag.store(true, Ordering::SeqCst);
        } else {
            println!("[DOWNLOAD_RUST] Nie znaleziono aktywnego pobierania dla klucza: {} przy próbie anulowania", key);
        }
    }
}

pub async fn download_model(
    app: tauri::AppHandle,
    engine: &str,
    model_id: &str,
    models_dir: &Path,
) -> anyhow::Result<()> {
    let key = format!("{}_{}", engine, model_id);
    println!("[DOWNLOAD_RUST] Rejestrowanie flagi i rozpoczynanie pobierania dla klucza: {}", key);
    let abort_flag = register_abort_flag(&key);

    let info = model_registry::get_model_info(engine, model_id).await?;
    let dest = models_dir.join(&info.dest_filename);
    
    let mut tmp_path_str = dest.to_string_lossy().to_string();
    tmp_path_str.push_str(".tmp");
    let tmp = std::path::PathBuf::from(tmp_path_str);
    
    if dest.exists() {
        println!("[DOWNLOAD_RUST] Docelowy plik modelu już istnieje: {:?}. Kończenie.", dest);
        remove_abort_flag(&key);
        app.emit("download_progress", serde_json::json!({ "model": model_id, "percent": 100.0, "done": true })).ok();
        return Ok(());
    }

    if let Some(parent) = dest.parent() { 
        std::fs::create_dir_all(parent)?; 
    }
    
    let start_byte = if tmp.exists() { std::fs::metadata(&tmp)?.len() } else { 0 };
    println!("[DOWNLOAD_RUST] Ścieżka docelowa: {:?}, start_byte={}", tmp, start_byte);
    
    let client = Client::new();
    let mut req = client.get(&info.url);
    if start_byte > 0 { req = req.header("Range", format!("bytes={}-", start_byte)); }
    
    println!("[DOWNLOAD_RUST] Wysyłanie zapytania HTTP do: {}", info.url);
    let response = req.send().await?;
    
    if !response.status().is_success() {
        println!("[DOWNLOAD_RUST] Serwer zwrócił status błędu: {}", response.status());
        remove_abort_flag(&key);
        return Err(anyhow::anyhow!("Błąd pobierania: serwer zwrócił status {}", response.status()));
    }
    
    let is_partial = response.status() == reqwest::StatusCode::PARTIAL_CONTENT;
    let actual_start = if is_partial { start_byte } else { 0 };
    
    let total = if let Some(len) = response.content_length() {
        if is_partial { len + actual_start } else { len }
    } else {
        info.size_bytes
    };
    println!("[DOWNLOAD_RUST] Rozmiar pliku: total_bytes={}, is_partial={}", total, is_partial);
    
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(!is_partial)
        .open(&tmp)?;
    
    let mut downloaded = actual_start;
    let mut hasher = Sha256::new();
    let mut stream = response.bytes_stream();
    
    println!("[DOWNLOAD_RUST] Rozpoczynanie pętli pobierania strumienia danych...");
    while let Some(chunk) = stream.next().await {
        if abort_flag.load(Ordering::SeqCst) {
            println!("[DOWNLOAD_RUST] Wykryto flagę abort = true. Usuwanie pliku tymczasowego {:?} i przerywanie.", tmp);
            drop(file);
            std::fs::remove_file(&tmp).ok();
            remove_abort_flag(&key);
            return Err(anyhow::anyhow!("Pobieranie zostało anulowane."));
        }

        let chunk = chunk?;
        use std::io::Write;
        file.write_all(&chunk)?;
        hasher.update(&chunk);
        downloaded += chunk.len() as u64;
        let percent = (downloaded as f64 / total as f64) * 100.0;
        app.emit("download_progress", serde_json::json!({
            "model": model_id,
            "downloaded_mb": downloaded as f64 / 1_048_576.0,
            "total_mb": total as f64 / 1_048_576.0,
            "percent": percent
        })).ok();
    }
    
    drop(file);
    remove_abort_flag(&key);
    println!("[DOWNLOAD_RUST] Pobieranie pliku zakończone sukcesem dla klucza: {}", key);
    
    // Opcjonalnie weryfikacja SHA256:
    if let Some(expected_hash) = &info.sha256 {
        let hash = format!("{:x}", hasher.finalize());
        if &hash != expected_hash { 
            std::fs::remove_file(&tmp)?; 
            return Err(anyhow::anyhow!("SHA256 mismatch")); 
        }
    }
    
    // Jeśli model to Vosk lub Sherpa-ONNX (zip / tar.bz2) musimy rozpakować
    if info.engine == "vosk" || info.engine == "sherpa_onnx" {
        // Windows 10+ ma wbudowane narzędzie tar, które obsługuje .zip oraz .tar.bz2
        let status = std::process::Command::new("tar")
            .arg("-xf")
            .arg(&tmp)
            .arg("-C")
            .arg(dest.parent().unwrap())
            .status();
            
        match status {
            Ok(s) if s.success() => {
                std::fs::remove_file(&tmp).ok();
            }
            _ => {
                std::fs::remove_file(&tmp).ok();
                return Err(anyhow::anyhow!("Błąd rozpakowywania archiwum modelu. Plik tymczasowy został usunięty – spróbuj pobrać ponownie."));
            }
        }
    } else {
        // W przeciwnym razie po prostu zmieniamy nazwę pliku tymczasowego na docelowy
        std::fs::rename(&tmp, &dest)?;
    }
    
    app.emit("download_progress", serde_json::json!({ "model": model_id, "percent": 100.0, "done": true })).ok();
    Ok(())
}
