use crate::recognition::{SpeechEngine, Transcript};
use std::io::{BufRead, Write};

fn get_python_cmd() -> std::path::PathBuf {
    let local = std::path::Path::new("..").join("python_embed").join("python.exe");
    if local.is_file() {
        local
    } else {
        let local_root = std::path::Path::new("python_embed").join("python.exe");
        if local_root.is_file() {
            local_root
        } else {
            // Sprawdź czy python3 lub python są dostępne w systemie
            let has_python3 = std::process::Command::new("python3").arg("--version").output().is_ok();
            if has_python3 {
                std::path::PathBuf::from("python3")
            } else {
                std::path::PathBuf::from("python")
            }
        }
    }
}

pub struct FasterWhisperEngine {
    model: String,
    device: String,
    language: String,
    buffer: Vec<f32>,
    chunk_duration_s: f32, // 2.0
    child: Option<std::process::Child>,
    stdin: Option<std::io::BufWriter<std::process::ChildStdin>>,
    stdout: Option<std::io::BufReader<std::process::ChildStdout>>,
}

impl FasterWhisperEngine {
    pub fn new(model: &str, device: &str, language: &str) -> anyhow::Result<Self> {
        let python_bin = get_python_cmd();
        let output = std::process::Command::new(&python_bin).arg("--version").output()
            .map_err(|_| anyhow::anyhow!("Python nie jest zainstalowany"))?;
        if !output.status.success() { return Err(anyhow::anyhow!("Python niedostepny")); }

        let mut final_device = device.to_string();
        if device == "cuda" {
            let script = r#"import sys, os, ctypes
ok = False
base_dir = os.path.dirname(sys.executable)
site_packages = os.path.join(base_dir, 'Lib', 'site-packages')
nd = os.path.join(site_packages, 'nvidia')
if os.path.exists(nd):
    for r, ds, fs in os.walk(nd):
        if any(f.endswith('.dll') for f in fs):
            try:
                os.add_dll_directory(r)
            except:
                pass
try:
    ctypes.CDLL('cublas64_12.dll')
    ctypes.CDLL('cublasLt64_12.dll')
    ok = True
except Exception as e:
    print(e, file=sys.stderr)
sys.exit(0 if ok else 1)"#;
            let check_output = std::process::Command::new(&python_bin)
                .args(["-c", script])
                .output();
            let is_cuda_ok = match check_output {
                Ok(out) => {
                    if !out.status.success() {
                        let stderr = String::from_utf8_lossy(&out.stderr);
                        println!("[Faster-Whisper CUDA Check Failed]: {}", stderr.trim());
                    }
                    out.status.success()
                }
                Err(_) => false,
            };
            if !is_cuda_ok {
                final_device = "cpu".to_string();
            }
        }

        // Spawn the persistent daemon python process
        let script = r#"import sys, os, json, ctypes
if sys.platform == 'win32':
    base_dir = os.path.dirname(sys.executable)
    site_packages = os.path.join(base_dir, 'Lib', 'site-packages')
    nvidia_dir = os.path.join(site_packages, 'nvidia')
    if os.path.exists(nvidia_dir):
        for root, dirs, files in os.walk(nvidia_dir):
            if any(f.endswith('.dll') for f in files):
                try: os.add_dll_directory(root)
                except: pass
        try:
            ctypes.CDLL('cublasLt64_12.dll')
            ctypes.CDLL('cublas64_12.dll')
        except Exception as e:
            print("CUDA Preload failed:", e, file=sys.stderr)

from faster_whisper import WhisperModel
model = WhisperModel(sys.argv[1], device=sys.argv[2], compute_type='int8')
print("READY", flush=True)

for line in sys.stdin:
    wav_path = line.strip()
    if not wav_path:
        continue
    if wav_path == "QUIT":
        break
    try:
        segments, _ = model.transcribe(wav_path, language=sys.argv[3])
        text = ' '.join([s.text for s in segments])
        print(json.dumps({"text": text}), flush=True)
    except Exception as e:
        print(json.dumps({"error": str(e)}), flush=True)
"#;

        println!("[Faster-Whisper] Spawning persistent python process with model: {}, device: {}", model, final_device);
        let mut child = std::process::Command::new(&python_bin)
            .args(["-c", script, model, &final_device, language])
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::inherit())
            .spawn()
            .map_err(|e| anyhow::anyhow!("Failed to spawn python process: {}", e))?;

        let child_stdin = child.stdin.take().ok_or_else(|| anyhow::anyhow!("Failed to open stdin"))?;
        let child_stdout = child.stdout.take().ok_or_else(|| anyhow::anyhow!("Failed to open stdout"))?;

        let mut reader = std::io::BufReader::new(child_stdout);
        let writer = std::io::BufWriter::new(child_stdin);

        // Wait for READY signal
        let mut ready_line = String::new();
        reader.read_line(&mut ready_line)?;
        if ready_line.trim() != "READY" {
            child.kill().ok();
            return Err(anyhow::anyhow!("Failed to initialize python process: {}", ready_line));
        }
        println!("[Faster-Whisper] Persistent python process is READY!");

        Ok(Self { 
            model: model.into(), 
            device: final_device, 
            language: language.into(), 
            buffer: Vec::new(), 
            chunk_duration_s: 2.0,
            child: Some(child),
            stdin: Some(writer),
            stdout: Some(reader),
        })
    }
}

#[async_trait::async_trait]
impl SpeechEngine for FasterWhisperEngine {
    async fn feed_audio(&mut self, samples: &[f32]) -> anyhow::Result<Option<Transcript>> {
        self.buffer.extend_from_slice(samples);
        Ok(None)
    }
    
    async fn finalize(&mut self) -> anyhow::Result<String> { 
        if self.buffer.is_empty() {
            return Ok(String::new());
        }
        let chunk: Vec<f32> = self.buffer.drain(..).collect();
        let tmp_wav = tempfile::NamedTempFile::new()?.into_temp_path();
        write_wav(&tmp_wav, &chunk, 16000)?;
        
        let wav_path_str = tmp_wav.to_string_lossy().to_string();
        let mut text = String::new();
        
        if let (Some(writer), Some(reader)) = (&mut self.stdin, &mut self.stdout) {
            writeln!(writer, "{}", wav_path_str)?;
            writer.flush()?;
            
            let mut response = String::new();
            reader.read_line(&mut response)?;
            
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&response) {
                if let Some(err) = val.get("error") {
                    eprintln!("[Faster-Whisper Daemon Error]: {}", err);
                } else {
                    text = val["text"].as_str().unwrap_or("").trim().to_string();
                }
            }
        }
        Ok(text) 
    }
    
    fn supports_streaming(&self) -> bool { false }
    fn engine_name(&self) -> &str { "faster_whisper" }
    async fn start_stream(&mut self) -> anyhow::Result<()> { Ok(()) }
}

impl Drop for FasterWhisperEngine {
    fn drop(&mut self) {
        if let Some(mut writer) = self.stdin.take() {
            writeln!(writer, "QUIT").ok();
            writer.flush().ok();
        }
        if let Some(mut child) = self.child.take() {
            let mut count = 0;
            while count < 10 {
                if let Ok(Some(_)) = child.try_wait() {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(50));
                count += 1;
            }
            child.kill().ok();
        }
    }
}

fn write_wav(path: &std::path::Path, samples: &[f32], sample_rate: u32) -> anyhow::Result<()> {
    use std::io::Write;
    let mut f = std::fs::File::create(path)?;
    let num_samples = samples.len() as u32;
    let data_size = num_samples * 2;
    f.write_all(b"RIFF")?;
    f.write_all(&(36 + data_size).to_le_bytes())?;
    f.write_all(b"WAVEfmt ")?;
    f.write_all(&16u32.to_le_bytes())?; // chunk size
    f.write_all(&1u16.to_le_bytes())?;  // PCM
    f.write_all(&1u16.to_le_bytes())?;  // mono
    f.write_all(&sample_rate.to_le_bytes())?;
    f.write_all(&(sample_rate * 2).to_le_bytes())?; // byte rate
    f.write_all(&2u16.to_le_bytes())?;  // block align
    f.write_all(&16u16.to_le_bytes())?; // bits per sample
    f.write_all(b"data")?;
    f.write_all(&data_size.to_le_bytes())?;
    for s in samples {
        let i = (s * 32767.0).clamp(-32768.0, 32767.0) as i16;
        f.write_all(&i.to_le_bytes())?;
    }
    Ok(())
}
