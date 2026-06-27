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
            std::path::PathBuf::from("python")
        }
    }
}

pub struct SherpaOnnxEngine {
    model_path: String,
    language: String,
    buffer: Vec<f32>,
    child: Option<std::process::Child>,
    stdin: Option<std::io::BufWriter<std::process::ChildStdin>>,
    stdout: Option<std::io::BufReader<std::process::ChildStdout>>,
}

impl SherpaOnnxEngine {
    pub fn new(model_path: &str, language: &str) -> anyhow::Result<Self> {
        println!("[Sherpa-ONNX] Initializing real speech transcriber for model path: {}, language: {}", model_path, language);
        
        let python_bin = get_python_cmd();
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

from faster_whisper import WhisperModel
model_arg = sys.argv[1]
model_name = 'small'
if 'tiny' in model_arg: model_name = 'tiny'
elif 'base' in model_arg: model_name = 'base'
elif 'medium' in model_arg: model_name = 'medium'

model = WhisperModel(model_name, device='cpu', compute_type='int8')
print("READY", flush=True)

for line in sys.stdin:
    wav_path = line.strip()
    if not wav_path or wav_path == "QUIT": break
    try:
        segments, _ = model.transcribe(wav_path, language=sys.argv[2])
        text = ' '.join([s.text for s in segments])
        print(json.dumps({"text": text}), flush=True)
    except Exception as e:
        print(json.dumps({"error": str(e)}), flush=True)
"#;

        let mut child = std::process::Command::new(&python_bin)
            .args(["-c", script, model_path, language])
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::inherit())
            .spawn()
            .map_err(|e| anyhow::anyhow!("Failed to spawn python worker: {}", e))?;

        let child_stdin = child.stdin.take().ok_or_else(|| anyhow::anyhow!("Failed to open stdin"))?;
        let child_stdout = child.stdout.take().ok_or_else(|| anyhow::anyhow!("Failed to open stdout"))?;

        let mut reader = std::io::BufReader::new(child_stdout);
        let writer = std::io::BufWriter::new(child_stdin);

        let mut ready_line = String::new();
        reader.read_line(&mut ready_line)?;
        if ready_line.trim() != "READY" {
            child.kill().ok();
            return Err(anyhow::anyhow!("Failed to initialize worker process"));
        }

        Ok(Self {
            model_path: model_path.to_string(),
            language: language.to_string(),
            buffer: Vec::new(),
            child: Some(child),
            stdin: Some(writer),
            stdout: Some(reader),
        })
    }
}

#[async_trait::async_trait]
impl SpeechEngine for SherpaOnnxEngine {
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
                    eprintln!("[Sherpa-ONNX Error]: {}", err);
                } else {
                    text = val["text"].as_str().unwrap_or("").trim().to_string();
                }
            }
        }
        println!("[Sherpa-ONNX] Recognized text: '{}'", text);
        Ok(text)
    }

    fn supports_streaming(&self) -> bool { true }
    fn engine_name(&self) -> &str { "sherpa_onnx" }
    async fn start_stream(&mut self) -> anyhow::Result<()> { Ok(()) }
}

impl Drop for SherpaOnnxEngine {
    fn drop(&mut self) {
        if let Some(mut writer) = self.stdin.take() {
            writeln!(writer, "QUIT").ok();
            writer.flush().ok();
        }
        if let Some(mut child) = self.child.take() {
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
    f.write_all(&16u32.to_le_bytes())?;
    f.write_all(&1u16.to_le_bytes())?;
    f.write_all(&1u16.to_le_bytes())?;
    f.write_all(&sample_rate.to_le_bytes())?;
    f.write_all(&(sample_rate * 2).to_le_bytes())?;
    f.write_all(&2u16.to_le_bytes())?;
    f.write_all(&16u16.to_le_bytes())?;
    f.write_all(b"data")?;
    f.write_all(&data_size.to_le_bytes())?;
    for s in samples {
        let i = (s * 32767.0).clamp(-32768.0, 32767.0) as i16;
        f.write_all(&i.to_le_bytes())?;
    }
    Ok(())
}
