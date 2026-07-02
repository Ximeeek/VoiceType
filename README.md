# VoiceType

> A Windows system tray application that enables continuous local and cloud-based Speech-to-Text, injecting transcribed text directly into any active application window.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Release: Beta](https://img.shields.io/badge/Release-Beta-blue.svg)](https://github.com/Ximeeek/VoiceType/releases)

---

## Why This Exists

Dictating text should be seamless and work globally across all applications. Traditional voice typing tools are often restricted to specific text editors, lack offline capabilities, or fail to integrate cleanly with developer IDEs, messengers, and web browsers. 

VoiceType solves this by running unobtrusively in the Windows system tray. It monitors your active window, processes microphone input dynamically using Voice Activity Detection (VAD), transcribes speech (either locally using offline engines or via fast cloud APIs), and inputs the resulting text directly into the focused field of any active Windows application using native UI Automation, with a reliable clipboard fallback when direct injection is blocked.

---

## Key Features

- **Continuous Offline Speech Recognition**:
  - **Vosk**: Ultra-lightweight and fast offline streaming models (configured for Polish/English and others out of the box).
  - **Sherpa-ONNX**: Offline engine using ONNX Runtime for standalone, resource-efficient dictation.
  - **Whisper.cpp (`whisper-rs`)**: Native C++/Rust integration of Whisper models utilizing multi-threaded CPU processing.
  - **Faster-Whisper**: Managed persistent Python daemon supporting CUDA/cuBLAS GPU acceleration for high-throughput transcription.
- **Fast Cloud APIs**:
  - Direct integration with Deepgram (Nova-2), AssemblyAI, OpenAI Whisper (`whisper-1`), Google Speech-to-Text, and Azure Speech APIs.
- **Intelligent Voice Activity Detection (VAD)**:
  - Natively executes the state-of-the-art Silero VAD model via ONNX Runtime (`ort`) to detect when you start/stop speaking.
- **Trigger & Stop Words**:
  - Custom trigger words (wake words) with optional real-time translation (`trigger.translate`) and fuzzy Levenshtein-based matching (`trigger.fuzzy_match`) to accommodate varied pronunciation.
  - Configure stop words to automatically finalize dictation and optionally strip the stop word from the final text.
- **Seamless Text Injection**:
  - Leverages Windows UI Automation (UIA) and Win32 APIs to detect focused controls and inject characters directly.
  - Falls back to clipboard insertion when standard injection is blocked by target applications.
- **Robust Auto-Updates**:
  - **Delta Updates**: Silent background downloads of frontend asset packages (`assets-$version.zip`, `< 2 MB`) to update UI/styles instantly without restarting the app.
  - **Binary Updates**: Native Rust/Tauri updates for core executable improvements.

---

## Project Architecture

- **Frontend**: HTML5 / CSS / Vanilla JavaScript (Tauri WebView)
- **Backend**: Rust (Tauri v2)
- **Native Interoperability**: Custom Windows UI Automation and WinAPI focus monitoring, native Silero ONNX VAD loop.
- **Update Server**: Integrates with GitHub Releases for tag-based binary updates and delta asset packages.

---

## Prerequisites for Compilation

To compile VoiceType from source on Windows, ensure you have the following installed:

1. **Rust Toolchain**: [rustup](https://rustup.rs/) configured with the `x86_64-pc-windows-msvc` target.
2. **Node.js**: v18 or later (along with `npm`).
3. **C++ Build Tools**: Visual Studio 2022 C++ Build Tools (required for compiling native C/C++ FFI bindings such as `whisper-rs-sys` and `vosk`).
4. **Python 3.10+ & CUDA** *(Optional)*: Required only if you intend to run `Faster-Whisper` with GPU acceleration.

---

## Building and Running from Source

### 1. Clone the Repository
```powershell
git clone https://github.com/Ximeeek/VoiceType.git
cd VoiceType
```

### 2. Running in Development Mode
Start the Tauri development server to run the application with live reload enabled:
```powershell
cargo tauri dev
```
*(Alternatively, run `npx tauri dev` if you do not have the Tauri CLI installed globally).*

### 3. Compiling the Production Release
To build an optimized production executable and package it into an NSIS installer:
```powershell
cargo tauri build
```
The NSIS setup installer will be generated at `src-tauri/target/release/bundle/nsis/`.

### 4. Compiling the Standalone Setup Installer (`VoiceType-Setup.exe`)
If you want to compile the custom installer app from source:
```powershell
# 1. Build the main application binary
cd src-tauri
cargo build --release
cd ..

# 2. Build the installer bootstrapper
cd installer/src-tauri
cargo build --release
cd ../..
```
The custom installer executable will be generated at `installer/src-tauri/target/release/voicetype-installer.exe`. When launched, it extracts and installs the embedded binaries, and configures desktop/start menu shortcuts.

---

## Configuration Reference

VoiceType saves its configuration file in the user's local AppData directory:
`%APPDATA%\voicetype\config.toml`

### Structure Overview

The `config.toml` is divided into several main tables:

#### `[general]`
- `autostart` (bool): Start VoiceType on Windows startup.
- `minimize_to_tray_on_close` (bool): Hides the window to the system tray instead of quitting when closed.
- `language` (string): UI language code (e.g., `"en"` or `"pl"`).
- `show_notifications` (bool): Toggle system tray notifications.
- `notification_duration_ms` (int): Duration in milliseconds for notifications.

#### `[audio]`
- `input_device` (string): Name of the audio device to capture from (`"default"` for system default).
- `sample_rate` (int): Audio sample rate (default: `16000`).
- `vad_threshold` (float): Sensitivity threshold for Silero VAD (default: `0.4`).
- `vad_min_speech_ms` (int): Minimum speech duration in milliseconds to trigger detection.

#### `[trigger]`
- `words` (array of strings): Wake words to start listening (e.g., `["computer", "komputer", "zaczynamy"]`).
- `fuzzy_match` (bool): Enable Levenshtein-based fuzzy matching.
- `fuzzy_threshold` (int): Max distance for a fuzzy match (default: `2`).
- `translate` (bool): Auto-translate trigger words to the active recognition language.

#### `[dictation]`
- `stop_words` (array of strings): Words that end the dictation (e.g., `["stop", "done"]`).
- `silence_timeout_ms` (int): Silence duration in milliseconds to auto-stop dictation (default: `2500`).
- `stop_word_remove_from_text` (bool): Remove the stop word from the final injected text.
- `live_typing` (bool): Stream text characters live as they are transcribed.

#### `[input]`
- `prefer_uia` (bool): Use Windows UI Automation API for direct text insertion.
- `clipboard_fallback` (bool): Fallback to clipboard injection if direct typing fails.
- `clipboard_toast` (bool): Show notification when clipboard injection is used.

#### `[engine]`
- `type` (string): Active transcription engine (`"vosk"`, `"sherpa_onnx"`, `"whisper"`, `"faster_whisper"`, `"deepgram"`, `"assemblyai"`, `"openai"`, `"google"`, `"azure"`).
- **Engine-specific configurations**:
  - `[engine.vosk]`: `model_path`, `enable_partial_results`.
  - `[engine.whisper]`: `model`, `use_gpu`, `gpu_device`, `language`.
  - `[engine.faster_whisper]`: `model`, `device`, `compute_type`.
  - `[engine.sherpa_onnx]`: `model_path`, `tokens_path`, `num_threads`.
  - `[engine.deepgram]`: `api_key`, `model`, `smart_format`, `punctuate`.
  - `[engine.assemblyai]`: `api_key`, `word_boost`.
  - `[engine.openai]`: `api_key`, `model`, `chunk_duration_ms`.
  - `[engine.google]`: `credentials_path`, `model`, `use_enhanced`.
  - `[engine.azure]`: `subscription_key`, `region`.

---

## Auto-Update & Fork Distribution Guide

VoiceType includes a two-layer automated update system:

1. **Delta Updates (Frontend)**:
   - Compresses frontend files in `src/` to `assets-$version.zip` and uploads them along with `assets-manifest.json` on the repository releases.
   - The app checks this manifest on launch, downloads the zip silently, and hot-swaps the frontend files in AppData.
2. **Binary Updates (Core)**:
   - Uses Tauri's native updater to update the Rust executable and DLLs.

### Building for Personal Use or Forks

If you fork the project or build a custom version, you should manage update settings to avoid pointing to the main repository:

#### Option A: Disable Updates Completely (Recommended for self-builders)
Compile the application without the default updater plugin:
```powershell
cargo tauri build -- --no-default-features
```
This disables all network calls related to update checks.

#### Option B: Configure Updates for Your Own Fork
1. Generate your cryptographic updater keys:
   ```powershell
   cargo tauri signer generate -w ~/.tauri/voicetype.key
   ```
2. Update the public key and release endpoint in `src-tauri/tauri.conf.json`:
   ```json
   "plugins": {
     "updater": {
       "pubkey": "YOUR_PUBLIC_KEY",
       "endpoints": [
         "https://github.com/YOUR_USERNAME/YOUR_REPO/releases/latest/download/latest.json"
       ]
     }
   }
   ```
3. Set up GitHub Secrets `TAURI_PRIVATE_KEY` and `TAURI_KEY_PASSWORD` so that the release pipeline signs packages correctly.

---

## License

This project is licensed under the MIT License.
