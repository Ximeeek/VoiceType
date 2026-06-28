use std::path::PathBuf;
use std::process::Command;
use std::fs;

fn main() {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let workspace_root = manifest_dir.parent().unwrap().parent().unwrap();
    let voicetype_dir = workspace_root.join("VoiceType");
    
    let release_dir = voicetype_dir.join("src-tauri").join("target").join("release");
    let debug_dir = voicetype_dir.join("src-tauri").join("target").join("debug");

    let bin_dir = if release_dir.join("voicetype.exe").exists() {
        release_dir
    } else {
        debug_dir
    };

    let target_exe = bin_dir.join("voicetype.exe");
    println!("cargo:rerun-if-changed={}", target_exe.display());

    if target_exe.exists() {
        let staging_dir = manifest_dir.join("staging_payload");
        if staging_dir.exists() {
            let _ = fs::remove_dir_all(&staging_dir);
        }
        fs::create_dir_all(&staging_dir).unwrap();
        let staging_models = staging_dir.join("models");
        fs::create_dir_all(&staging_models).unwrap();

        // Copy binaries using Rust std::fs::copy
        let files_to_copy = [
            "voicetype.exe",
            "libvosk.dll",
            "libgcc_s_seh-1.dll",
            "libstdc++-6.dll",
            "libwinpthread-1.dll",
            "DirectML.dll",
        ];

        for file_name in &files_to_copy {
            let src = bin_dir.join(file_name);
            if src.exists() {
                let _ = fs::copy(&src, staging_dir.join(file_name));
            }
        }

        let vad_src = voicetype_dir.join("models").join("silero-vad.onnx");
        if vad_src.exists() {
            let _ = fs::copy(&vad_src, staging_models.join("silero-vad.onnx"));
        }

        let payload_zip = manifest_dir.parent().unwrap().join("payload.zip");
        
        let ps_cmd = format!(
            "Compress-Archive -Path '{}\\*' -DestinationPath '{}' -Force",
            staging_dir.display().to_string().replace("'", "''"),
            payload_zip.display().to_string().replace("'", "''")
        );

        let _ = Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps_cmd])
            .status();

        let _ = fs::remove_dir_all(&staging_dir);
    }

    tauri_build::build();
}
