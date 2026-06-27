# VoiceType

> **Project Status: Under Active Development**
> There is currently no pre-compiled installation package or release binary available. The codebase is rapidly evolving, and bugs or unoptimized behavior may be present across different engines. Active development is focused on reaching production stability.

VoiceType is a Windows desktop application for continuous Speech-to-Text (Voice Typing). It captures audio input, transcribes it locally or via cloud APIs, and injects the text directly into the focused field of any active Windows application (text editors, browsers, IDEs, messengers).

The application runs in the system tray, monitors focused window controls via UI Automation and WinAPI, and handles automatic clipboard fallbacks when direct injection is unavailable.

---

## Technical Architecture

- **Frontend:** HTML5 / Custom CSS / Vanilla JavaScript (Tauri Webview)
- **Backend:** Rust (Tauri v2)
- **Voice Activity Detection (VAD):** Silero VAD executing natively via ONNX Runtime (`ort`)
- **Supported Recognition Engines:**
  - **Vosk:** Native C++/Rust integration for lightweight, fast offline streaming models.
  - **Sherpa-ONNX:** Offline engine implementation using ONNX Runtime for lightweight, standalone execution.
  - **Faster-Whisper:** Managed persistent Python daemon supporting CUDA/cuBLAS acceleration for low-latency batch transcription.
  - **Whisper.cpp (`whisper-rs`):** Native C++/Rust integration executing full-precision inference using multi-threaded CPU processing.
  - **Cloud STT APIs:** Built-in infrastructure supporting Deepgram (Nova-2), AssemblyAI, OpenAI Whisper (`whisper-1`), Google Speech-to-Text, and Azure Speech APIs.
- **Translation & Trigger Features:**
  - **Trigger Word Translation (`trigger.translate`):** Automatic real-time translation and matching for wake/trigger words across supported languages.
  - **Fuzzy Trigger Matching (`trigger.fuzzy_match`):** Levenshtein-based fuzzy logic to handle imprecise pronunciation of hotwords.

---

## Prerequisites for Compilation

Building VoiceType from source on Windows requires:

1. **Rust Toolchain:** [`rustup`](https://rustup.rs/) configured with the `x86_64-pc-windows-msvc` target.
2. **Node.js:** v18 or later and `npm`.
3. **C++ Build Tools:** Visual Studio 2022 C++ Build Tools (required for compiling C++ FFI bindings such as `whisper-rs-sys` and `vosk`).
4. *(Optional for Faster-Whisper GPU acceleration)* **Python 3.10+** and NVIDIA CUDA drivers.

---

## Building and Running from Source

### 1. Clone the Repository
```powershell
git clone https://github.com/Ximeeek/VoiceType.git
cd VoiceType
```

### 2. Native Dependencies and Models
- Ensure `libvosk.dll` is present in the `src-tauri` directory (tracked in repository).
- Speech recognition models are downloaded on demand through the UI to the local `models/` directory.

### 3. Running in Development Mode
Execute the Tauri development server to run the application with live reload:
```powershell
cargo tauri dev
```
*(Alternatively, use `npx tauri dev` if the Tauri CLI is not installed globally).*

### 4. Compiling Release Binary
To build an optimized production executable:
```powershell
cargo tauri build
```
The compiled output will be generated at `src-tauri/target/release/voicetype.exe`.

Domyślna kompilacja zawiera auto-updater:
```powershell
cargo tauri build
```

Jeśli budujesz własną wersję i **nie chcesz** auto-updatera:
```powershell
cargo tauri build -- --no-default-features
```

---

## Engine Configurations & Implementation Notes

- **Vosk:** Best choice for instant, low-resource local dictation without external dependencies.
- **Sherpa-ONNX:** Optimized ONNX-based offline engine alternative.
- **Faster-Whisper:** Recommended engine for NVIDIA GPU users. Utilizes a persistent background daemon to avoid model reload overhead per chunk.
- **Whisper.cpp:** Fully native Rust/C++ engine. Configured to automatically utilize all available physical CPU threads. Recommended for CPU-only environments.

---

## License
MIT
