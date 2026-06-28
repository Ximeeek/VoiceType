# VoiceType

> **Project Status: Beta Release Available**
> Pre-compiled Beta releases and standalone installers (`VoiceType-Setup.exe`) are available under GitHub Releases. Active development is ongoing to reach production stability.

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

### 5. Compiling Custom Setup Installer
If you want to compile the custom standalone setup installer (`VoiceType-Setup.exe`) from source:
1. Build the main application release binary first:
   ```powershell
   cd src-tauri
   cargo build --release
   cd ..
   ```
2. Build the installer package:
   ```powershell
   cd installer/src-tauri
   cargo build --release
   cd ../..
   ```
The standalone installer executable will be generated at `installer/src-tauri/target/release/voicetype-installer.exe`. When launched, it extracts and installs the embedded binaries and configures desktop/start menu shortcuts.

---

## Auto-Update System & Self-Building Guide

VoiceType includes a two-layer automated update system designed to keep the application up-to-date seamlessly:

1. **Layer 1: Delta Updates (Frontend Assets)**
   - Delivers UI fixes, style updates, and lightweight JavaScript modifications (< 2 MB) silently in the background without requiring application restarts.
2. **Layer 2: Full Binary Updates (Rust/Tauri Native Code)**
   - Updates core Rust components, native DLLs, or major backend features. Smaller binary patches execute silently, while larger installers prompt the user with a download progress bar and an "Install & Relaunch" notification.

### Building for Custom / Forked Distribution

If you are building your own custom version or fork of VoiceType, you should manage the updater feature carefully:

#### Option A: Building Without Auto-Updater (Recommended for Self-Builders)
By default, the auto-updater connects to the official repository releases (`Ximeeek/VoiceType`) and verifies signatures using the embedded public key. If you are compiling VoiceType for personal use or modifying the codebase without signing releases, disable the updater feature during build:

```powershell
cargo tauri build -- --no-default-features
```
*Note: Using `--no-default-features` disables the `tauri-plugin-updater` compilation unit, resulting in a clean standalone executable without update checks or network calls to update endpoints.*

#### Option B: Configuring Auto-Updater for Your Own Repository
If you maintain a public fork and want to publish signed updates via your own GitHub Releases:
1. Generate your own cryptographic key pair:
   ```powershell
   cargo tauri signer generate -w ~/.tauri/myapp.key
   ```
2. Update `src-tauri/tauri.conf.json` with your generated public key and GitHub repository URL endpoint:
   ```json
   "plugins": {
     "updater": {
       "pubkey": "YOUR_PUBLIC_KEY_HERE",
       "endpoints": [
         "https://github.com/YOUR_USERNAME/YOUR_REPO/releases/latest/download/latest.json"
       ]
     }
   }
   ```
3. Add your private key to your GitHub Repository Secrets as `TAURI_PRIVATE_KEY` (and `TAURI_KEY_PASSWORD` if protected).

---

## Engine Configurations & Implementation Notes

- **Vosk:** Best choice for instant, low-resource local dictation without external dependencies.
- **Sherpa-ONNX:** Optimized ONNX-based offline engine alternative.
- **Faster-Whisper:** Recommended engine for NVIDIA GPU users. Utilizes a persistent background daemon to avoid model reload overhead per chunk.
- **Whisper.cpp:** Fully native Rust/C++ engine. Configured to automatically utilize all available physical CPU threads. Recommended for CPU-only environments.

---

## License
MIT
