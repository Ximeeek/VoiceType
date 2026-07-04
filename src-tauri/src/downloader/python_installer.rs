use std::path::Path;
use std::fs::File;
use std::io::Write;
use tauri::{AppHandle, Emitter};
use futures_util::StreamExt;
use zip::ZipArchive;

#[derive(Clone, serde::Serialize)]
pub struct InstallProgress {
    pub step: String,
    pub step_key: Option<String>,
    pub percent: f64,
    pub done: bool,
    pub error: Option<String>,
}

pub async fn install_portable_python(app: AppHandle) -> Result<(), String> {
    let target_dir = Path::new("..").join("python_embed");
    let zip_path = Path::new("..").join("python_embed.zip");
    let pip_script_path = Path::new("..").join("get-pip.py");
    
    let emit_progress = |step: &str, step_key: Option<&str>, percent: f64, done: bool, error: Option<String>| {
        app.emit("python_install_progress", InstallProgress {
            step: step.to_string(),
            step_key: step_key.map(|s| s.to_string()),
            percent,
            done,
            error,
        }).ok();
    };

    emit_progress("Downloading Python environment (approx. 10 MB)...", Some("addons.py.step.download_init"), 10.0, false, None);

    // 1. Download portable Python 3.10.11 embeddable
    let client = reqwest::Client::new();
    let url = "https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip";
    
    let res = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        let err = format!("Python download error, status: {}", res.status());
        emit_progress("Error", None, 0.0, false, Some(err.clone()));
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
        emit_progress("Downloading Python environment...", Some("addons.py.step.downloading"), percent, false, None);
    }
    drop(file);

    emit_progress("Unpacking Python...", Some("addons.py.step.unpacking"), 90.0, false, None);

    // 2. Extract to python_embed folder
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

    // 3. Enable import site in python310._pth
    // This is crucial! By default, embedded Python ignores packages installed by pip.
    let pth_file_path = target_dir.join("python310._pth");
    if pth_file_path.exists() {
        let content = std::fs::read_to_string(&pth_file_path).unwrap_or_default();
        // Uncomment import site
        let new_content = content.replace("#import site", "import site");
        std::fs::write(&pth_file_path, new_content).ok();
    }

    emit_progress("Installing pip package manager...", Some("addons.py.step.installing_pip"), 92.0, false, None);

    // 4. Download get-pip.py
    let pip_res = client.get("https://bootstrap.pypa.io/get-pip.py").send().await.map_err(|e| e.to_string())?;
    if pip_res.status().is_success() {
        let mut pip_file = File::create(&pip_script_path).map_err(|e| e.to_string())?;
        let bytes = pip_res.bytes().await.map_err(|e| e.to_string())?;
        pip_file.write_all(&bytes).map_err(|e| e.to_string())?;
    }

    // 5. Run pip installation
    let python_exe = target_dir.join("python.exe");
    let mut cmd = std::process::Command::new(&python_exe);
    cmd.arg(&pip_script_path);
    crate::platform::suppress_console_in_release(&mut cmd);
    let pip_install_output = cmd.output();
        
    std::fs::remove_file(&pip_script_path).ok();

    if let Err(e) = pip_install_output {
        let err = format!("Failed to run pip installation: {}", e);
        emit_progress("Error", None, 0.0, false, Some(err.clone()));
        return Err(err);
    }

    emit_progress("Downloading and installing Faster-Whisper library (this may take a moment)...", Some("addons.py.step.installing_whisper"), 95.0, false, None);

    // 6. Install faster-whisper using pip
    let mut cmd = std::process::Command::new(&python_exe);
    cmd.args(["-m", "pip", "install", "faster-whisper"]);
    crate::platform::suppress_console_in_release(&mut cmd);
    let whisper_install_output = cmd.output();

    match whisper_install_output {
        Ok(out) => {
            if out.status.success() {
                emit_progress("Installation completed successfully!", Some("addons.py.step.completed"), 100.0, true, None);
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                let err = format!("Pip finished with error: {}", stderr);
                emit_progress("Error", None, 0.0, false, Some(err.clone()));
                Err(err)
            }
        }
        Err(e) => {
            let err = format!("Failed to install faster-whisper: {}", e);
            emit_progress("Error", None, 0.0, false, Some(err.clone()));
            Err(err)
        }
    }
}

pub fn is_python_available() -> bool {
    // 1. Check if we have our local python_embed
    let local_python = Path::new("..").join("python_embed").join("python.exe");
    if local_python.exists() {
        return true;
    }
    let local_python_root = Path::new("python_embed").join("python.exe");
    if local_python_root.exists() {
        return true;
    }
    
    // 2. If not, check system Python
    let mut cmd1 = std::process::Command::new("python3");
    cmd1.arg("--version");
    crate::platform::suppress_console_in_release(&mut cmd1);

    let output = cmd1.output()
        .or_else(|_| {
            let mut cmd2 = std::process::Command::new("python");
            cmd2.arg("--version");
            crate::platform::suppress_console_in_release(&mut cmd2);
            cmd2.output()
        });
        
    if let Ok(out) = output {
        out.status.success()
    } else {
        false
    }
}
