use std::fs;
use std::path::Path;

fn main() {
    // Copy MinGW and Vosk DLLs to target directories
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let src_dir = Path::new(&manifest_dir)
        .join("vosk-win64")
        .join("vosk-win64-0.3.45");

    if src_dir.is_dir() {
        let dlls = [
            "libvosk.dll",
            "libgcc_s_seh-1.dll",
            "libwinpthread-1.dll",
            "libstdc++-6.dll",
        ];

        let target_profile_dirs = [
            Path::new(&manifest_dir).join("target").join("debug"),
            Path::new(&manifest_dir).join("target").join("release"),
        ];

        for profile_dir in &target_profile_dirs {
            fs::create_dir_all(profile_dir).ok();
            for dll in &dlls {
                let src_file = src_dir.join(dll);
                let dest_file = profile_dir.join(dll);
                if src_file.exists() {
                    fs::copy(&src_file, &dest_file).ok();
                }
            }
        }
    }

    tauri_build::build()
}
