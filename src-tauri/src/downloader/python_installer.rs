use std::path::Path;
use std::fs::File;
use std::io::Write;
use tauri::{AppHandle, Emitter};
use futures_util::StreamExt;
use zip::ZipArchive;

#[derive(Clone, serde::Serialize)]
pub struct InstallProgress {
    pub step: String,
    pub percent: f64,
    pub done: bool,
    pub error: Option<String>,
}

pub async fn install_portable_python(app: AppHandle) -> Result<(), String> {
    let target_dir = Path::new("..").join("python_embed");
    let zip_path = Path::new("..").join("python_embed.zip");
    let pip_script_path = Path::new("..").join("get-pip.py");
    
    let emit_progress = |step: &str, percent: f64, done: bool, error: Option<String>| {
        app.emit("python_install_progress", InstallProgress {
            step: step.to_string(),
            percent,
            done,
            error,
        }).ok();
    };

    emit_progress("Pobieranie środowiska Python (ok. 10 MB)...", 10.0, false, None);

    // 1. Pobieranie portable Pythona 3.10.11 embeddable
    let client = reqwest::Client::new();
    let url = "https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip";
    
    let res = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        let err = format!("Błąd pobierania Pythona, status: {}", res.status());
        emit_progress("Błąd", 0.0, false, Some(err.clone()));
        return Err(err);
    }

    let total_size = res.content_length().unwrap_or(10_000_000);
    let mut file = File::create(&zip_path).map_err(|e| e.to_string())?;
    let mut downloaded = 0;
    let mut stream = res.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        let percent = (downloaded as f64 / total_size as f64) * 80.0 + 10.0; // 10% - 90%
        emit_progress("Pobieranie środowiska Python...", percent, false, None);
    }
    drop(file);

    emit_progress("Rozpakowywanie Pythona...", 90.0, false, None);

    // 2. Rozpakowywanie do folderu python_embed
    if target_dir.exists() {
        std::fs::remove_dir_all(&target_dir).ok();
    }
    std::fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

    let file = File::open(&zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => target_dir.join(path),
            None => continue,
        };

        if (*file.name()).ends_with('/') {
            std::fs::create_dir_all(&outpath).ok();
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    std::fs::create_dir_all(&p).ok();
                }
            }
            let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }
    std::fs::remove_file(&zip_path).ok();

    // 3. Odblokowanie import site w python310._pth
    // To jest kluczowe! Domyslnie osadzony Python ignoruje pakiety zainstalowane przez pip.
    let pth_file_path = target_dir.join("python310._pth");
    if pth_file_path.exists() {
        let content = std::fs::read_to_string(&pth_file_path).unwrap_or_default();
        // Odkomentujmy import site
        let new_content = content.replace("#import site", "import site");
        std::fs::write(&pth_file_path, new_content).ok();
    }

    emit_progress("Instalowanie menedżera pakietów pip...", 92.0, false, None);

    // 4. Pobieranie get-pip.py
    let pip_res = client.get("https://bootstrap.pypa.io/get-pip.py").send().await.map_err(|e| e.to_string())?;
    if pip_res.status().is_success() {
        let mut pip_file = File::create(&pip_script_path).map_err(|e| e.to_string())?;
        let bytes = pip_res.bytes().await.map_err(|e| e.to_string())?;
        pip_file.write_all(&bytes).map_err(|e| e.to_string())?;
    }

    // 5. Uruchomienie instalacji pip
    let python_exe = target_dir.join("python.exe");
    let pip_install_output = std::process::Command::new(&python_exe)
        .arg(&pip_script_path)
        .output();
        
    std::fs::remove_file(&pip_script_path).ok();

    if let Err(e) = pip_install_output {
        let err = format!("Nie udało się uruchomić instalacji pip: {}", e);
        emit_progress("Błąd", 0.0, false, Some(err.clone()));
        return Err(err);
    }

    emit_progress("Pobieranie i instalowanie biblioteki Faster-Whisper (to może zająć chwilę)...", 95.0, false, None);

    // 6. Instalacja faster-whisper za pomocą pip
    let whisper_install_output = std::process::Command::new(&python_exe)
        .args(["-m", "pip", "install", "faster-whisper"])
        .output();

    match whisper_install_output {
        Ok(out) => {
            if out.status.success() {
                emit_progress("Instalacja ukończona pomyślnie!", 100.0, true, None);
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                let err = format!("Pip zakończył się błędem: {}", stderr);
                emit_progress("Błąd", 0.0, false, Some(err.clone()));
                Err(err)
            }
        }
        Err(e) => {
            let err = format!("Nie udało się zainstalować faster-whisper: {}", e);
            emit_progress("Błąd", 0.0, false, Some(err.clone()));
            Err(err)
        }
    }
}

pub fn is_python_available() -> bool {
    // 1. Sprawdzamy czy mamy nasz wbudowany python_embed
    let local_python = Path::new("..").join("python_embed").join("python.exe");
    if local_python.exists() {
        return true;
    }
    let local_python_root = Path::new("python_embed").join("python.exe");
    if local_python_root.exists() {
        return true;
    }
    
    // 2. Jeśli nie, sprawdzamy systemowy
    let output = std::process::Command::new("python3").arg("--version").output()
        .or_else(|_| std::process::Command::new("python").arg("--version").output());
        
    if let Ok(out) = output {
        out.status.success()
    } else {
        false
    }
}
